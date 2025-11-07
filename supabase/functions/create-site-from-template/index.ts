import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GitHubInstallation {
    installation_id: number
    access_token: string
    access_token_expires_at: string
}

async function getInstallationToken(
    supabaseClient: any,
    userId: string
): Promise<GitHubInstallation> {
    // Get user's GitHub installation
    const { data: installation, error: installError } = await supabaseClient
        .from('github_installations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .maybeSingle()

    if (installError || !installation) {
        throw new Error('No GitHub installation found. Please connect your GitHub account first.')
    }

    // Check if token is still valid (with 5 minute buffer)
    const expiresAt = new Date(installation.access_token_expires_at)
    const now = new Date()
    const bufferTime = 5 * 60 * 1000 // 5 minutes

    if (expiresAt.getTime() - now.getTime() < bufferTime) {
        throw new Error('GitHub token expired. Please reconnect your GitHub account.')
    }

    return installation
}

async function createRepoFromTemplate(
    accessToken: string,
    templateOwner: string,
    templateRepo: string,
    newRepoName: string,
    newRepoOwner: string,
    description?: string
): Promise<any> {
    const url = `https://api.github.com/repos/${templateOwner}/${templateRepo}/generate`

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            owner: newRepoOwner,
            name: newRepoName,
            description: description || `Created from ${templateOwner}/${templateRepo}`,
            include_all_branches: false,
            private: false,
        }),
    })

    if (!response.ok) {
        const errorData = await response.text()
        console.error('GitHub API error:', response.status, errorData)

        if (response.status === 422) {
            throw new Error('Repository name already exists or is invalid')
        } else if (response.status === 404) {
            throw new Error('Template repository not found or is not a template')
        } else if (response.status === 403) {
            throw new Error('Permission denied. Please check GitHub App permissions.')
        }

        throw new Error(`Failed to create repository: ${response.statusText}`)
    }

    return await response.json()
}

async function getGitHubUsername(accessToken: string): Promise<string> {
    const response = await fetch('https://api.github.com/user', {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    })

    if (!response.ok) {
        throw new Error('Failed to get GitHub user info')
    }

    const userData = await response.json()
    return userData.login
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    persistSession: false,
                },
            }
        )

        // Get the authorization header
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('No authorization header')
        }

        // Verify the user
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
            authHeader.replace('Bearer ', '')
        )

        if (userError || !user) {
            throw new Error('Unauthorized')
        }

        // Parse request body
        const { template_id, new_repo_name, site_name } = await req.json()

        // Validate input
        if (!template_id || !new_repo_name || !site_name) {
            throw new Error('Missing required fields: template_id, new_repo_name, site_name')
        }

        // Validate repo name format
        const repoNameRegex = /^[a-zA-Z0-9_.-]+$/
        if (!repoNameRegex.test(new_repo_name)) {
            throw new Error('Invalid repository name. Use only letters, numbers, hyphens, underscores, and dots.')
        }

        // Get template details
        const { data: template, error: templateError } = await supabaseClient
            .from('templates')
            .select('*')
            .eq('id', template_id)
            .single()

        if (templateError || !template) {
            throw new Error('Template not found')
        }

        // Parse template repo
        const [templateOwner, templateRepo] = template.repo_full_name.split('/')

        // Get GitHub installation and token
        const installation = await getInstallationToken(supabaseClient, user.id)

        // Get GitHub username
        const githubUsername = await getGitHubUsername(installation.access_token)

        // Create repository from template
        console.log(`Creating repo ${githubUsername}/${new_repo_name} from ${template.repo_full_name}`)
        const newRepo = await createRepoFromTemplate(
            installation.access_token,
            templateOwner,
            templateRepo,
            new_repo_name,
            githubUsername,
            `${site_name} - Created from ${template.name}`
        )

        console.log('Repository created:', newRepo.full_name)

        // Wait a moment for GitHub to finalize the repo
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Now create the site using the new repository
        const { data: site, error: siteError } = await supabaseClient
            .from('sites')
            .insert({
                name: site_name,
                repo_full_name: newRepo.full_name,
                default_branch: newRepo.default_branch || 'main',
                github_installation_id: installation.installation_id,
                created_by: user.id,
            })
            .select()
            .single()

        if (siteError) {
            console.error('Error creating site:', siteError)
            throw new Error('Failed to create site: ' + siteError.message)
        }

        // Add the creator as an owner
        const { error: memberError } = await supabaseClient
            .from('site_members')
            .insert({
                site_id: site.id,
                user_id: user.id,
                role: 'owner',
            })

        if (memberError) {
            console.error('Error adding site member:', memberError)
            throw new Error('Failed to add site owner')
        }

        return new Response(
            JSON.stringify({
                site,
                repository: {
                    full_name: newRepo.full_name,
                    html_url: newRepo.html_url,
                },
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
        console.error('Error in create-site-from-template:', errorMessage)
        return new Response(
            JSON.stringify({ error: errorMessage }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})

