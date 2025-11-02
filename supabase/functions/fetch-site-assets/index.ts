import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0'
import { create as createJWT } from 'https://deno.land/x/djwt@v3.0.2/mod.ts'
import { createPrivateKey } from 'node:crypto'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Convert PEM private key to CryptoKey for JWT signing using Node crypto
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // Use Node.js crypto to handle both PKCS#1 and PKCS#8 formats
  const keyObject = createPrivateKey(pem)
  
  // Export as PKCS#8 PEM
  const pkcs8Pem = keyObject.export({
    type: 'pkcs8',
    format: 'pem',
  }) as string

  // Remove PEM headers/footers and whitespace
  const pemContents = pkcs8Pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0))

  return await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
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

    // Create JWT for GitHub App authentication
    const now = Math.floor(Date.now() / 1000)
    const payload = {
      iat: now,
      exp: now + 600, // 10 minutes
      iss: config.app_id,
    }

    const privateKey = await importPrivateKey(privateKeyPem)
    const jwt = await createJWT({ alg: 'RS256', typ: 'JWT' }, payload, privateKey)

    console.log('Created GitHub App JWT')

    // Get installation access token
    const installationTokenResponse = await fetch(
      `https://api.github.com/app/installations/${site.github_installation_id}/access_tokens`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${jwt}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    )

    if (!installationTokenResponse.ok) {
      const errorData = await installationTokenResponse.text()
      console.error('GitHub API error:', errorData)
      throw new Error('Failed to get installation access token')
    }

    const installationToken = await installationTokenResponse.json()
    console.log('Got installation access token')

    // Fetch site-assets.json from the repository
    const fileUrl = `https://api.github.com/repos/${site.repo_full_name}/contents/site-assets.json?ref=${site.default_branch}`
    console.log('Fetching site-assets.json from:', fileUrl)

    const fileResponse = await fetch(fileUrl, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${installationToken.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })

    if (!fileResponse.ok) {
      if (fileResponse.status === 404) {
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
      const errorText = await fileResponse.text()
      console.error('Failed to fetch file:', errorText)
      throw new Error('Failed to fetch site-assets.json')
    }

    const fileData = await fileResponse.json()
    
    // Decode base64 content
    const content = atob(fileData.content.replace(/\s/g, ''))
    const assetsConfig = JSON.parse(content)

    console.log('Successfully fetched and parsed site-assets.json')

    return new Response(
      JSON.stringify({
        found: true,
        config: assetsConfig,
        sha: fileData.sha,
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
