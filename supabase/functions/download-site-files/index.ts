import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { App } from 'https://esm.sh/octokit@3.1.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function normalizePemKey(pem: string): string {
  return pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----\s*/g, '-----BEGIN PRIVATE KEY-----\n')
    .replace(/\s*-----END PRIVATE KEY-----/g, '\n-----END PRIVATE KEY-----')
    .trim()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const { site_id } = await req.json()

    // Verify user is a member of this site
    const { data: membership, error: membershipError } = await supabase
      .from('site_members')
      .select('role')
      .eq('site_id', site_id)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      throw new Error('User is not a member of this site')
    }

    // Get site details
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('*')
      .eq('id', site_id)
      .single()

    if (siteError || !site) {
      throw new Error('Site not found')
    }

    // Get GitHub App configuration
    const { data: appConfig, error: appError } = await supabase
      .from('github_app_config')
      .select('*')
      .single()

    if (appError || !appConfig) {
      throw new Error('GitHub App not configured')
    }

    const privateKey = normalizePemKey(Deno.env.get('GITHUB_APP_PKEY') || '')
    if (!privateKey) {
      throw new Error('GitHub private key not configured')
    }

    const app = new App({
      appId: appConfig.app_id,
      privateKey: privateKey,
    })

    const octokit = await app.getInstallationOctokit(site.installation_id)

    // Get the default branch's tree
    const { data: ref } = await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
      owner: site.repo_owner,
      repo: site.repo_name,
      ref: `heads/${site.branch}`,
    })

    const { data: commit } = await octokit.request('GET /repos/{owner}/{repo}/git/commits/{commit_sha}', {
      owner: site.repo_owner,
      repo: site.repo_name,
      commit_sha: ref.object.sha,
    })

    const { data: tree } = await octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', {
      owner: site.repo_owner,
      repo: site.repo_name,
      tree_sha: commit.tree.sha,
      recursive: '1',
    })

    // Download all files
    const files: Record<string, { content: string; encoding: string }> = {}
    
    for (const item of tree.tree) {
      if (item.type === 'blob' && item.path) {
        try {
          const { data: blob } = await octokit.request('GET /repos/{owner}/{repo}/git/blobs/{file_sha}', {
            owner: site.repo_owner,
            repo: site.repo_name,
            file_sha: item.sha!,
          })
          
          files[item.path] = {
            content: blob.content,
            encoding: blob.encoding,
          }
        } catch (error) {
          console.error(`Error fetching ${item.path}:`, error)
        }
      }
    }

    return new Response(JSON.stringify({ files }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
