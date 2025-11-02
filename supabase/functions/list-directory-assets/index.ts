import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';
import { App } from 'https://esm.sh/@octokit/app@15.1.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizePemKey(pem: string): string {
  if (!pem) throw new Error('PEM key is empty');
  let normalized = pem.replace(/\\n/g, '\n');
  if (!normalized.includes('-----BEGIN')) {
    normalized = '-----BEGIN PRIVATE KEY-----\n' + normalized + '\n-----END PRIVATE KEY-----';
  }
  return normalized.trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { site_id, asset_path } = await req.json();

    if (!site_id || !asset_path) {
      return new Response(JSON.stringify({ error: 'Missing site_id or asset_path' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user is a member of the site
    const { data: membership } = await supabase
      .from('site_members')
      .select('*')
      .eq('site_id', site_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
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

    // Get GitHub App configuration
    const { data: appConfig } = await supabase
      .from('github_app_public_config')
      .select('app_id')
      .single();

    if (!appConfig) {
      return new Response(JSON.stringify({ error: 'GitHub App not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const privateKey = normalizePemKey(Deno.env.get('GITHUB_APP_PKEY')!);
    const app = new App({
      appId: appConfig.app_id,
      privateKey: privateKey,
    });

    const octokit = await app.getInstallationOctokit(site.github_installation_id);
    const [owner, repo] = site.repo_full_name.split('/');

    // Try to get the contents of the path
    try {
      const { data: contents } = await octokit.request(
        'GET /repos/{owner}/{repo}/contents/{path}',
        {
          owner,
          repo,
          path: asset_path,
          ref: site.default_branch || 'main',
        }
      );

      // If it's a directory, return the list of files
      if (Array.isArray(contents)) {
        const files = contents.map((item: any) => ({
          name: item.name,
          path: item.path,
          sha: item.sha,
          size: item.size,
          type: item.type,
          download_url: item.download_url,
        }));

        return new Response(JSON.stringify({ files }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        // If it's a single file, return it as an array with one item
        return new Response(JSON.stringify({
          files: [{
            name: contents.name,
            path: contents.path,
            sha: contents.sha,
            size: contents.size,
            type: contents.type,
            download_url: contents.download_url,
          }]
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (error: any) {
      if (error.status === 404) {
        return new Response(JSON.stringify({ files: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error listing directory assets:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
