import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0'
import { App } from 'https://esm.sh/@octokit/app@15.1.0'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Normalize PEM key for Octokit
function normalizePemKey(pem: string): string {
    let s = pem.trim()
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        s = s.slice(1, -1)
    }
    s = s.replace(/\\r\\n/g, '\n').replace(/\r\n/g, '\n').replace(/\\n/g, '\n').replace(/\r/g, '')
    s = s
        .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
        .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----')
        .replace('-----BEGIN RSA PRIVATE KEY-----', '-----BEGIN RSA PRIVATE KEY-----\n')

    if (!s.endsWith('\n')) s += '\n'
    return s
}

interface GitHubInstallation {
    installation_id: number
    account_login: string
}

async function getInstallation(
    supabaseClient: any,
    userId: string
): Promise<GitHubInstallation> {
    console.log('Fetching GitHub installation for user:', userId)

    // Get user's GitHub installation
    const { data: installation, error: installError } = await supabaseClient
        .from('github_installations')
        .select('installation_id, account_login')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .maybeSingle()

    if (installError) {
        console.error('Error fetching installation:', installError)
        throw new Error('Error fetching GitHub installation: ' + installError.message)
    }

    if (!installation) {
        console.error('No GitHub installation found for user:', userId)
        throw new Error('No GitHub installation found. Please connect your GitHub account first.')
    }

    console.log('Found installation:', installation.installation_id, 'account:', installation.account_login)

    return installation
}

async function createRepoFromTemplate(
    octokit: any,
    templateOwner: string,
    templateRepo: string,
    newRepoName: string,
    newRepoOwner: string,
    description?: string
): Promise<any> {
    console.log(`Creating repo from template: ${templateOwner}/${templateRepo} -> ${newRepoOwner}/${newRepoName}`)

    try {
        const { data } = await octokit.request('POST /repos/{template_owner}/{template_repo}/generate', {
            template_owner: templateOwner,
            template_repo: templateRepo,
            owner: newRepoOwner,
            name: newRepoName,
            description: description || `Created from ${templateOwner}/${templateRepo}`,
            include_all_branches: false,
            private: false,
            headers: {
                'X-GitHub-Api-Version': '2022-11-28',
            }
        })

        return data
    } catch (error: any) {
        console.error('GitHub API error:', error)
        console.error('Error details:', JSON.stringify(error, null, 2))

        if (error.status === 422) {
            throw new Error('Repository name already exists or is invalid')
        } else if (error.status === 404) {
            throw new Error('Template repository not found or is not a template')
        } else if (error.status === 403) {
            const errorMsg = error.response?.data?.message || error.message
            throw new Error(`Permission denied: ${errorMsg}. The GitHub App needs "Administration" permission with "Read & write" access to create repositories.`)
        } else if (error.status === 401) {
            throw new Error('Authentication failed. Please reconnect your GitHub account.')
        }

        throw new Error(`Failed to create repository: ${error.message}`)
    }
}

// Removed getGitHubUsername function - we get the username from the installation record

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

        // Get GitHub installation
        const installation = await getInstallation(supabaseClient, user.id)

        // Get GitHub username from installation
        const githubUsername = installation.account_login
        console.log('Using GitHub username:', githubUsername)

        // Get GitHub App configuration
        const { data: appConfig, error: configError } = await supabaseClient
            .from('github_app_public_config')
            .select('app_id')
            .single()

        if (configError || !appConfig || !appConfig.app_id) {
            console.error('GitHub App config error:', configError)
            throw new Error('GitHub App not configured properly. Please add app_id to github_app_config table.')
        }

        // Get private key from environment
        const privateKeyPem = Deno.env.get('GITHUB_APP_PKEY')
        if (!privateKeyPem) {
            throw new Error('GITHUB_APP_PKEY environment variable not set')
        }

        console.log('Creating Octokit App instance')
        const normalizedKey = normalizePemKey(privateKeyPem)
        const app = new App({
            appId: appConfig.app_id,
            privateKey: normalizedKey,
        })

        // Verify the installation exists and is accessible
        try {
            await app.octokit.request('GET /app/installations/{installation_id}', {
                installation_id: installation.installation_id
            })
        } catch (installError: any) {
            console.error('Installation verification error:', installError)
            if (installError.status === 404) {
                throw new Error('GitHub App installation no longer exists. The app may have been uninstalled. Please reconnect your GitHub account.')
            }
            throw installError
        }

        // Get installation-authenticated Octokit
        console.log('Getting installation-authenticated client')
        const octokit = await app.getInstallationOctokit(installation.installation_id)

        // Create repository from template
        console.log(`Creating repo ${githubUsername}/${new_repo_name} from ${template.repo_full_name}`)
        const newRepo = await createRepoFromTemplate(
            octokit,
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

