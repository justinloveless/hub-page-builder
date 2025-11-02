import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0'
import { SignJWT, importPKCS1, importPKCS8 } from 'https://esm.sh/jose@5.8.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// PEM normalization and JOSE-based key import/signing
function normalizePem(pem: string): string {
  let s = pem.trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1)
  }
  s = s
    .replace(/\\r\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\\n/g, '\n')
    .trim()
  return s
}

async function importPemForRs256(pem: string): Promise<CryptoKey> {
  const p = normalizePem(pem)
  const hasBegin = p.includes('BEGIN')
  const hasEnd = p.includes('END')
  const isPkcs1 = p.includes('-----BEGIN RSA PRIVATE KEY-----')
  const isPkcs8 = p.includes('-----BEGIN PRIVATE KEY-----')
  console.log('PEM diagnostics', { hasBegin, hasEnd, isPkcs1, isPkcs8, hasNewlines: p.includes('\n'), pemLength: p.length })
  try {
    if (isPkcs8) return await importPKCS8(p, 'RS256')
    if (isPkcs1) return await importPKCS1(p, 'RS256')
    throw new Error('Unsupported PEM header. Expecting PKCS#1 or PKCS#8')
  } catch (e1) {
    try {
      return isPkcs8 ? await importPKCS1(p, 'RS256') : await importPKCS8(p, 'RS256')
    } catch (e2) {
      throw new Error(`Failed to import PEM with jose. First: ${(e1 as Error).message}. Second: ${(e2 as Error).message}`)
    }
  }
}

async function createGithubAppJwt(pem: string, appId: string | number): Promise<string> {
  const key = await importPemForRs256(pem)
  return await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .setIssuer(String(appId))
    .sign(key)
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
const jwt = await createGithubAppJwt(privateKeyPem, config.app_id)

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
