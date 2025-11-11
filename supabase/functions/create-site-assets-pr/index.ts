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

// Template for site-assets.json
const SITE_ASSETS_TEMPLATE = {
  "$schema": "https://raw.githubusercontent.com/justinloveless/hub-page-builder/refs/heads/main/site-assets.schema.json"
  version: "1.0",
  description: "Configuration file defining manageable assets for this static site",
  assets: [
    {
      path: "images/hero.jpg",
      type: "image",
      label: "Hero Image",
      description: "Main homepage hero/banner image",
      maxSize: 2097152,
      allowedExtensions: [".jpg", ".png", ".webp"]
    },
    {
      path: "images/logo.png",
      type: "image",
      label: "Site Logo",
      description: "Primary logo displayed in header",
      maxSize: 524288,
      allowedExtensions: [".png", ".svg", ".webp"]
    },
    {
      path: "content/about.md",
      type: "text",
      label: "About Page Content",
      description: "Markdown content for the about page",
      maxSize: 51200,
      allowedExtensions: [".md"]
    },
    {
      path: "images/gallery",
      type: "directory",
      label: "Photo Gallery",
      description: "Collection of gallery images",
      contains: {
        type: "image",
        maxSize: 2097152,
        allowedExtensions: [".jpg", ".png", ".webp"]
      }
    }
  ]
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

    console.log('Creating site-assets.json PR for site:', site_id)

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

    // Check if site-assets.json already exists
    try {
      await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner,
        repo,
        path: 'site-assets.json',
        ref: site.default_branch,
      })

      // If we reach here, file exists
      throw new Error('site-assets.json already exists in the repository. Please check if you already have a configuration file.')
    } catch (error: any) {
      // 404 means file doesn't exist, which is what we want
      if (error.status !== 404) {
        throw error // Re-throw if it's not a 404
      }
    }

    // Get the latest commit SHA from the default branch
    const { data: refData } = await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
      owner,
      repo,
      ref: `heads/${site.default_branch}`,
    })
    const baseSha = refData.object.sha
    console.log('Base branch SHA:', baseSha)

    // Create a new branch
    const newBranchName = `add-site-assets-config-${Date.now()}`
    await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
      owner,
      repo,
      ref: `refs/heads/${newBranchName}`,
      sha: baseSha,
    })
    console.log('Created branch:', newBranchName)

    // Create the file in the new branch
    const fileContent = btoa(JSON.stringify(SITE_ASSETS_TEMPLATE, null, 2))
    await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
      owner,
      repo,
      path: 'site-assets.json',
      message: 'Add site-assets.json configuration template',
      content: fileContent,
      branch: newBranchName,
    })
    console.log('Created file in branch')

    // Create a pull request
    const prBody = `## Add Site Assets Configuration

This PR adds a \`site-assets.json\` configuration file to define manageable assets for the site manager.

### What's included:
- ✅ Template configuration with example assets
- ✅ JSON Schema validation (references the official schema)
- ✅ Common asset types (images, text, directories)
- ✅ Clear labels and descriptions for each asset

### Schema Validation
The file includes a \`$schema\` reference for automatic validation in your IDE. This ensures your configuration follows the correct format.

### Next steps:
1. Review the template structure
2. Customize the assets array for your site's needs
3. Update paths, labels, and descriptions to match your site
4. Merge this PR to enable asset management

The site manager will use this file to provide a user-friendly interface for non-technical users to manage site content.

📖 [Schema Documentation](https://github.com/StaticSnack/staticsnack/blob/main/SITE_ASSETS_SCHEMA.md)`

    const { data: prData } = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
      owner,
      repo,
      title: 'Add site-assets.json configuration template',
      body: prBody,
      head: newBranchName,
      base: site.default_branch,
    })
    console.log('Created PR:', prData.number)

    // Log activity
    await supabaseClient
      .from('activity_log')
      .insert({
        site_id: site_id,
        user_id: user.id,
        action: 'create_site_assets_pr',
        metadata: {
          pr_number: prData.number,
          pr_url: prData.html_url,
          branch: newBranchName,
        },
      })

    return new Response(
      JSON.stringify({
        success: true,
        pr_url: prData.html_url,
        pr_number: prData.number,
        branch: newBranchName,
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
