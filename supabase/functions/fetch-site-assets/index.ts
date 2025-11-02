import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0'
import { SignJWT, importPKCS8 } from 'https://esm.sh/jose@5.9.6'

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

function encodeDerLength(len: number): Uint8Array {
  if (len < 128) return new Uint8Array([len])
  const bytes: number[] = []
  let n = len
  while (n > 0) {
    bytes.unshift(n & 0xff)
    n >>= 8
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes])
}

function pkcs1ToPkcs8(pkcs1Pem: string): string {
  const base64 = pkcs1Pem
    .replace('-----BEGIN RSA PRIVATE KEY-----', '')
    .replace('-----END RSA PRIVATE KEY-----', '')
    .replace(/\s+/g, '')
  const pkcs1 = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))

  const version = new Uint8Array([0x02, 0x01, 0x00])
  const algId = new Uint8Array([0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00])
  const pkOctetHeader = new Uint8Array([0x04, ...Array.from(encodeDerLength(pkcs1.length))])
  const pkOctet = new Uint8Array([...pkOctetHeader, ...pkcs1])

  const content = new Uint8Array([...version, ...algId, ...pkOctet])
  const seqHeader = new Uint8Array([0x30, ...Array.from(encodeDerLength(content.length))])
  const der = new Uint8Array([...seqHeader, ...content])

  const b64 = btoa(String.fromCharCode(...der))
  const wrapped = `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----`
  return wrapped
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
    if (isPkcs1) {
      const pkcs8Pem = pkcs1ToPkcs8(p)
      return await importPKCS8(pkcs8Pem, 'RS256')
    }
    throw new Error('Unsupported PEM header. Expecting PKCS#1 or PKCS#8')
  } catch (e) {
    throw new Error(`Failed to import PEM with jose: ${(e as Error).message}`)
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
const jwt = await createGithubAppJwt(privateKeyPem, config.app_id)

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
