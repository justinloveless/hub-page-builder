import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0'
import { create as createJWT } from 'https://deno.land/x/djwt@v3.0.2/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Convert PEM private key to CryptoKey for JWT signing
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // Check if it's PKCS#8 or PKCS#1 format
  const isPkcs8 = pem.includes('-----BEGIN PRIVATE KEY-----')
  const isPkcs1 = pem.includes('-----BEGIN RSA PRIVATE KEY-----')

  if (!isPkcs8 && !isPkcs1) {
    throw new Error('Invalid private key format. Expected PKCS#1 or PKCS#8 PEM format.')
  }

  // Remove PEM headers/footers and whitespace
  let pemContents = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace('-----BEGIN RSA PRIVATE KEY-----', '')
    .replace('-----END RSA PRIVATE KEY-----', '')
    .replace(/\s/g, '')

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0))

  // PKCS#8 can be imported directly
  if (isPkcs8) {
    return await crypto.subtle.importKey(
      'pkcs8',
      binaryDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    )
  }

  // For PKCS#1, we need to wrap it in PKCS#8 structure
  // PKCS#8 structure for RSA private key
  const pkcs8Header = new Uint8Array([
    0x30, 0x82, 0x04, 0xbd, // SEQUENCE, length will be adjusted
    0x02, 0x01, 0x00,       // version: 0
    0x30, 0x0d,             // SEQUENCE
    0x06, 0x09,             // OID length
    0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, // RSA OID
    0x05, 0x00,             // NULL
    0x04, 0x82, 0x04, 0xa7  // OCTET STRING, length will be adjusted
  ])

  // Calculate total length
  const totalLength = pkcs8Header.length + binaryDer.length
  const pkcs8Der = new Uint8Array(totalLength)
  
  // Copy header
  pkcs8Der.set(pkcs8Header, 0)
  // Copy PKCS#1 key
  pkcs8Der.set(binaryDer, pkcs8Header.length)

  // Update lengths in the header
  const keyLength = binaryDer.length
  pkcs8Der[2] = ((keyLength + 24) >> 8) & 0xff
  pkcs8Der[3] = (keyLength + 24) & 0xff
  pkcs8Der[16] = ((keyLength) >> 8) & 0xff
  pkcs8Der[17] = keyLength & 0xff

  return await crypto.subtle.importKey(
    'pkcs8',
    pkcs8Der,
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
    const { installation_id } = await req.json()

    if (!installation_id) {
      throw new Error('Missing installation_id')
    }

    // Get GitHub app config
    const { data: config, error: configError } = await supabaseClient
      .from('github_app_public_config')
      .select('app_id')
      .single()

    if (configError || !config || !config.app_id) {
      console.error('GitHub App config error:', configError)
      throw new Error('GitHub App not configured properly. Please add app_id to github_app_config table.')
    }

    // Get private key from environment
    const privateKeyPem = Deno.env.get('GITHUB_APP_PKEY')
    if (!privateKeyPem) {
      throw new Error('GITHUB_APP_PKEY environment variable not set')
    }

    console.log('Getting installation details for:', installation_id)

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
      `https://api.github.com/app/installations/${installation_id}/access_tokens`,
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

    // Get installation repositories
    const reposResponse = await fetch(
      'https://api.github.com/installation/repositories',
      {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${installationToken.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    )

    if (!reposResponse.ok) {
      const errorText = await reposResponse.text()
      console.error('Failed to fetch repositories:', errorText)
      throw new Error('Failed to fetch repositories')
    }

    const reposData = await reposResponse.json()
    console.log(`Found ${reposData.repositories.length} repositories`)

    return new Response(
      JSON.stringify({
        repositories: reposData.repositories.map((repo: any) => ({
          name: repo.name,
          full_name: repo.full_name,
          default_branch: repo.default_branch,
          private: repo.private,
        })),
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
