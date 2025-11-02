import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0'
import { App } from 'https://esm.sh/@octokit/app@15.1.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Normalize PEM key for Octokit
function normalizePemKey(pem: string): string {
  let s = pem.trim()
  // strip wrapping quotes if present
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1)
  }
  s = s.replace(/\\r\\n/g, '\n').replace(/\r\n/g, '\n').replace(/\\n/g, '\n').replace(/\r/g, '')
  // ensure header/footer on their own lines
  s = s
    .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
    .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----')
    .replace('-----BEGIN RSA PRIVATE KEY-----', '-----BEGIN RSA PRIVATE KEY-----\n')
    .replace('-----END RSA PRIVATE KEY-----', '\n-----END RSA PRIVATE KEY-----')
  // ensure trailing newline
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
    const { site_id } = await req.json()

    if (!site_id) {
      throw new Error('Missing site_id')
    }

    console.log('Fetching site assets for site:', site_id)

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
    console.log('Key format:', {
      hasBegin: normalizedKey.includes('BEGIN'),
      hasEnd: normalizedKey.includes('END'),
      isPKCS8: normalizedKey.includes('BEGIN PRIVATE KEY'),
      length: normalizedKey.length,
    })
    
    const app = new App({
      appId: config.app_id,
      privateKey: normalizedKey,
    })

    // Get installation-authenticated Octokit
    const octokit = await app.getInstallationOctokit(site.github_installation_id)
    console.log('Got GitHub installation client')

    // Fetch site-assets.json from the repository
    console.log('Fetching site-assets.json from:', site.repo_full_name)

    const { data: fileData } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner: site.repo_full_name.split('/')[0],
      repo: site.repo_full_name.split('/')[1],
      path: 'site-assets.json',
      ref: site.default_branch,
    }).catch((error) => {
      if (error.status === 404) {
        throw { status: 404, message: 'File not found' }
      }
      throw error
    })

    const fileResponse = { ok: fileData !== undefined, status: fileData ? 200 : 404 }

    // Decode base64 content
    const content = atob((fileData as any).content.replace(/\s/g, ''))
    const assetsConfig = JSON.parse(content)

    console.log('Successfully fetched and parsed site-assets.json')

    return new Response(
      JSON.stringify({
        found: true,
        config: assetsConfig,
        sha: (fileData as any).sha,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    if (error?.status === 404 || error?.message === 'File not found') {
      console.log('site-assets.json not found in repository')
      return new Response(
        JSON.stringify({
          found: false,
          message: 'site-assets.json not found in repository root',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }
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
