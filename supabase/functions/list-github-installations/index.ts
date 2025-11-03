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

    console.log('Listing all installations for GitHub App')

    // Create Octokit App instance
    const normalizedKey = normalizePemKey(privateKeyPem)
    const app = new App({
      appId: config.app_id,
      privateKey: normalizedKey,
    })

    // Get all installations
    const octokit = await app.getInstallationOctokit(0) // Use 0 to get app-level token
    
    // List all installations
    const { data: installations } = await octokit.request('GET /app/installations')
    console.log(`Found ${installations.length} total installations`)

    // For each installation, get basic info
    const installationDetails = await Promise.all(
      installations.map(async (installation: any) => {
        try {
          const installationOctokit = await app.getInstallationOctokit(installation.id)
          const { data: reposData } = await installationOctokit.request('GET /installation/repositories')
          
          return {
            id: installation.id,
            account: {
              login: installation.account.login,
              type: installation.account.type,
              avatar_url: installation.account.avatar_url,
            },
            repository_count: reposData.total_count,
            repositories: reposData.repositories.map((repo: any) => ({
              name: repo.name,
              full_name: repo.full_name,
              default_branch: repo.default_branch,
              private: repo.private,
            })),
            created_at: installation.created_at,
            updated_at: installation.updated_at,
          }
        } catch (error) {
          console.error(`Error fetching details for installation ${installation.id}:`, error)
          return {
            id: installation.id,
            account: {
              login: installation.account.login,
              type: installation.account.type,
              avatar_url: installation.account.avatar_url,
            },
            repository_count: 0,
            repositories: [],
            created_at: installation.created_at,
            updated_at: installation.updated_at,
            error: 'Failed to fetch repositories',
          }
        }
      })
    )

    return new Response(
      JSON.stringify({
        installations: installationDetails,
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
