import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0'
import { create as createJWT } from 'https://deno.land/x/djwt@v3.0.2/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Template for site-assets.json
const SITE_ASSETS_TEMPLATE = {
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
      maxSize: 2097152,
      allowedExtensions: [".jpg", ".png", ".webp"]
    }
  ]
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

    // Create JWT for GitHub App authentication
    const now = Math.floor(Date.now() / 1000)
    const payload = {
      iat: now,
      exp: now + 600,
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

    // Get the latest commit SHA from the default branch
    const branchUrl = `https://api.github.com/repos/${site.repo_full_name}/git/ref/heads/${site.default_branch}`
    const branchResponse = await fetch(branchUrl, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${installationToken.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })

    if (!branchResponse.ok) {
      throw new Error('Failed to get branch information')
    }

    const branchData = await branchResponse.json()
    const baseSha = branchData.object.sha
    console.log('Base branch SHA:', baseSha)

    // Create a new branch
    const newBranchName = `add-site-assets-config-${Date.now()}`
    const createBranchResponse = await fetch(
      `https://api.github.com/repos/${site.repo_full_name}/git/refs`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${installationToken.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: `refs/heads/${newBranchName}`,
          sha: baseSha,
        }),
      }
    )

    if (!createBranchResponse.ok) {
      const errorText = await createBranchResponse.text()
      console.error('Failed to create branch:', errorText)
      throw new Error('Failed to create branch')
    }

    console.log('Created branch:', newBranchName)

    // Create the file in the new branch
    const fileContent = btoa(JSON.stringify(SITE_ASSETS_TEMPLATE, null, 2))
    const createFileResponse = await fetch(
      `https://api.github.com/repos/${site.repo_full_name}/contents/site-assets.json`,
      {
        method: 'PUT',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${installationToken.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Add site-assets.json configuration template',
          content: fileContent,
          branch: newBranchName,
        }),
      }
    )

    if (!createFileResponse.ok) {
      const errorText = await createFileResponse.text()
      console.error('Failed to create file:', errorText)
      throw new Error('Failed to create file')
    }

    console.log('Created file in branch')

    // Create a pull request
    const prBody = `## Add Site Assets Configuration

This PR adds a \`site-assets.json\` configuration file to define manageable assets for the site manager.

### What's included:
- ✅ Template configuration with example assets
- ✅ Schema documentation through examples
- ✅ Common asset types (images, text, directories)

### Next steps:
1. Review the template structure
2. Customize the assets array for your site's needs
3. Update paths, labels, and descriptions
4. Merge this PR to enable asset management

The site manager will use this file to provide a user-friendly interface for non-technical users to manage site content.`

    const createPrResponse = await fetch(
      `https://api.github.com/repos/${site.repo_full_name}/pulls`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${installationToken.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Add site-assets.json configuration template',
          body: prBody,
          head: newBranchName,
          base: site.default_branch,
        }),
      }
    )

    if (!createPrResponse.ok) {
      const errorText = await createPrResponse.text()
      console.error('Failed to create PR:', errorText)
      throw new Error('Failed to create pull request')
    }

    const prData = await createPrResponse.json()
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
