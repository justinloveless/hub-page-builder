import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0'
import { App } from 'https://esm.sh/@octokit/app@15.1.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Security configuration
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function sanitizePath(path: string): string {
  const sanitized = path.replace(/\.\./g, '').replace(/^\/+/, '');
  if (sanitized.includes('..') || sanitized.startsWith('/')) {
    throw new Error('Invalid path: path traversal detected');
  }
  return sanitized;
}

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  record.count++;
  return true;
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

    // Rate limiting check
    const rateLimitKey = `upload-asset:${user.id}`;
    if (!checkRateLimit(rateLimitKey)) {
      console.warn(`Rate limit exceeded for user: ${user.id}`);
      throw new Error('Too many requests. Please try again later.');
    }

    // Parse request body
    const { site_id, file_path, content, message, branch, sha } = await req.json()

    if (!site_id || !file_path || !content) {
      throw new Error('Missing required fields: site_id, file_path, content')
    }

    // Sanitize file path to prevent path traversal
    const sanitizedPath = sanitizePath(file_path);

    // Validate file size
    const binaryString = atob(content);
    const fileSizeBytes = binaryString.length;
    if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      console.warn(`File too large: ${fileSizeBytes} bytes (max: ${MAX_FILE_SIZE_BYTES})`);
      throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`);
    }

    console.log('Uploading asset to:', sanitizedPath)

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

    // Verify the installation exists and is accessible
    try {
      await app.octokit.request('GET /app/installations/{installation_id}', {
        installation_id: site.github_installation_id
      })
    } catch (installError: any) {
      if (installError.status === 404) {
        throw new Error('GitHub App installation no longer exists. The app may have been uninstalled. Please reconnect your GitHub account and update the site settings.')
      }
      throw installError
    }

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
          path: sanitizedPath,
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
    const commitMessage = message || `Update ${sanitizedPath}`
    const response = await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
      owner,
      repo,
      path: sanitizedPath,
      message: commitMessage,
      content: content, // Should be base64 encoded
      branch: targetBranch,
      ...(fileSha && { sha: fileSha }),
    })

    console.log('File uploaded successfully')

    // Check if this file is in a directory and update manifest.json if it exists
    const pathParts = sanitizedPath.split('/')
    if (pathParts.length > 1) {
      const fileName = pathParts[pathParts.length - 1]
      const dirPath = pathParts.slice(0, -1).join('/')
      const manifestPath = `${dirPath}/manifest.json`

      try {
        // Try to get the existing manifest
        const { data: manifestFile } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
          owner,
          repo,
          path: manifestPath,
          ref: targetBranch,
        })

        const manifestSha = (manifestFile as any).sha
        const manifestContent = atob((manifestFile as any).content.replace(/\s/g, ''))
        const manifest = JSON.parse(manifestContent)

        // Add the file to the manifest if it's not already there
        if (!manifest.files.includes(fileName)) {
          manifest.files.push(fileName)
          manifest.files.sort() // Keep files sorted

          // Update the manifest
          const updatedManifestContent = btoa(JSON.stringify(manifest, null, 2))
          await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
            owner,
            repo,
            path: manifestPath,
            message: `Update manifest: add ${fileName}`,
            content: updatedManifestContent,
            branch: targetBranch,
            sha: manifestSha,
          })

          console.log('Updated manifest.json with new file')
        }
      } catch (manifestError: any) {
        if (manifestError.status === 404) {
          console.log('No manifest.json found for this directory, skipping manifest update')
        } else {
          console.error('Error updating manifest:', manifestError)
          // Don't fail the upload if manifest update fails
        }
      }
    }

    // Log activity
    await supabaseClient
      .from('activity_log')
      .insert({
        site_id: site_id,
        user_id: user.id,
        action: 'upload_asset',
        metadata: {
          file_path: sanitizedPath,
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
