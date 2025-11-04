import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0'
import { App } from 'https://esm.sh/@octokit/app@15.1.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { site_id, asset_path } = await req.json();

    if (!site_id || !asset_path) {
      return new Response(JSON.stringify({ error: 'site_id and asset_path are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Fetching asset content for site:', site_id, 'path:', asset_path);

    // Verify user is a member of the site
    const { data: membership, error: membershipError } = await supabase
      .from('site_members')
      .select('role')
      .eq('site_id', site_id)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return new Response(JSON.stringify({ error: 'Not a member of this site' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get site details
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('*')
      .eq('id', site_id)
      .single();

    if (siteError || !site) {
      return new Response(JSON.stringify({ error: 'Site not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GitHub App configuration
    const { data: config, error: configError } = await supabase
      .from('github_app_public_config')
      .select('app_id')
      .single()

    if (configError || !config || !config.app_id) {
      console.error('GitHub App config error:', configError)
      throw new Error('GitHub App not configured properly')
    }

    const privateKey = normalizePemKey(Deno.env.get('GITHUB_APP_PKEY') || '');

    if (!privateKey) {
      throw new Error('GitHub App private key not configured');
    }

    const app = new App({
      appId: config.app_id,
      privateKey,
    });

    const octokit = await app.getInstallationOctokit(site.github_installation_id);
    console.log('Got GitHub installation client');

    const [owner, repo] = site.repo_full_name.split('/');

    // Fetch the file content
    try {
      const { data: fileData } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner,
        repo,
        path: asset_path,
        ref: site.default_branch,
      });

      if (Array.isArray(fileData) || fileData.type !== 'file') {
        return new Response(JSON.stringify({
          found: false,
          message: 'Path is not a file'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Decode content from base64 with proper UTF-8 support
      const binaryString = atob(fileData.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const content = new TextDecoder('utf-8').decode(bytes);

      console.log('Successfully fetched asset content, length:', content.length);

      return new Response(JSON.stringify({
        found: true,
        content,
        sha: fileData.sha,
        size: fileData.size,
        download_url: fileData.download_url,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error: any) {
      if (error.status === 404) {
        console.log('Asset not found:', asset_path);
        return new Response(JSON.stringify({
          found: false,
          message: 'File not found in repository'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw error;
    }

  } catch (error: any) {
    console.error('Error fetching asset content:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Failed to fetch asset content'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
