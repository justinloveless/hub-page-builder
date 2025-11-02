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
    .replace('-----END RSA PRIVATE KEY-----', '\n-----END RSA PRIVATE KEY-----')
  if (!s.endsWith('\n')) s += '\n'
  return s
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

    // Verify the user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Parse request body
    const { site_id, file_path, content, message, branch, sha } = await req.json()

    if (!site_id || !file_path || !content) {
      throw new Error('Missing required fields: site_id, file_path, content')
    }

    console.log('Uploading asset to:', file_path)

    // Get site details
    const { data: site, error: siteError } = await supabaseClient
      .from('sites')
      .select('*')
      .eq('id', site_id)
      .single()

    if (siteError || !site) {
      console.error('Site not found:', siteError)
      throw new Error('Site not found')
    }

    // Verify user is a member of this site
    const { data: membership } = await supabaseClient
      .from('site_members')
      .select('*')
      .eq('site_id', site_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      throw new Error('Not authorized to access this site')
    }

    // Get GitHub app config
    const { data: config, error: configError } = await supabaseClient
      .from('github_app_public_config')
      .select('app_id')
      .single()

    if (configError || !config || !config.app_id) {
      console.error('GitHub App config error:', configError)
      throw new Error('GitHub App not configured properly')
    }

    // Get private key from environment
    const privateKeyPem = Deno.env.get('GITHUB_APP_PKEY')
    if (!privateKeyPem) {
      throw new Error('GITHUB_APP_PKEY environment variable not set')
    }

    // Create Octokit App instance
    const normalizedKey = normalizePemKey(privateKeyPem)
    const app = new App({
      appId: config.app_id,
      privateKey: normalizedKey,
    })

    // Get installation-authenticated Octokit
    const octokit = await app.getInstallationOctokit(site.github_installation_id)
    console.log('Got GitHub installation client')

    const [owner, repo] = site.repo_full_name.split('/')
    const targetBranch = branch || site.default_branch

    // Check if file already exists to get its SHA (if not provided)
    let fileSha: string | undefined = sha
    if (!fileSha) {
      try {
        const { data: existingFile } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
          owner,
          repo,
          path: file_path,
          ref: targetBranch,
        })
        fileSha = (existingFile as any).sha
        console.log('File exists, will update. SHA:', fileSha)
      } catch (error: any) {
        if (error.status === 404) {
          console.log('File does not exist, will create new')
        } else {
          throw error
        }
      }
    } else {
      console.log('Using provided SHA:', fileSha)
    }

    // Upload or update the file
    const commitMessage = message || `Update ${file_path}`
    const response = await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
      owner,
      repo,
      path: file_path,
      message: commitMessage,
      content: content, // Should be base64 encoded
      branch: targetBranch,
      ...(fileSha && { sha: fileSha }),
    })

    console.log('File uploaded successfully')

    // Log activity
    await supabaseClient
      .from('activity_log')
      .insert({
        site_id: site_id,
        user_id: user.id,
        action: 'upload_asset',
        metadata: {
          file_path,
          branch: targetBranch,
          commit_sha: response.data.commit.sha,
        },
      })

    return new Response(
      JSON.stringify({
        success: true,
        commit_sha: response.data.commit.sha,
        file_url: response.data.content?.html_url,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    console.error('Error:', errorMessage)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
