import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';
import { App } from 'https://esm.sh/@octokit/app@15.1.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizePemKey(pem: string): string {
  let s = pem.trim()
  // strip wrapping quotes if present
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1)
  }
  s = s.replace(/\\r\\n/g, '\n').replace(/\r\n/g, '\n').replace(/\\n/g, '\n').replace(/\r/g, '')
  // ensure header/footer on their own lines
  s = s
    .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
    .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----')
    .replace('-----BEGIN RSA PRIVATE KEY-----', '-----BEGIN RSA PRIVATE KEY-----\n')
    .replace('-----END RSA PRIVATE KEY-----', '\n-----END RSA PRIVATE KEY-----')
  // ensure trailing newline
  if (!s.endsWith('\n')) s += '\n'
  return s
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

    const { site_id, file_path, sha, message } = await req.json();

    if (!site_id || !file_path || !sha) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
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

    const privateKeyPem = Deno.env.get('GITHUB_APP_PKEY');
    if (!privateKeyPem) {
      return new Response(JSON.stringify({ error: 'GITHUB_APP_PKEY environment variable not set' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalizedKey = normalizePemKey(privateKeyPem);
    console.log('Key format:', {
      hasBegin: normalizedKey.includes('BEGIN'),
      hasEnd: normalizedKey.includes('END'),
      isPKCS8: normalizedKey.includes('BEGIN PRIVATE KEY'),
      length: normalizedKey.length,
    });

    const app = new App({
      appId: appConfig.app_id,
      privateKey: normalizedKey,
    });

    const octokit = await app.getInstallationOctokit(site.github_installation_id);
    console.log('Got GitHub installation client');
    const [owner, repo] = site.repo_full_name.split('/');

    // Delete the file
    const commitMessage = message || `Delete ${file_path}`;
    const { data: deleteData } = await octokit.request(
      'DELETE /repos/{owner}/{repo}/contents/{path}',
      {
        owner,
        repo,
        path: file_path,
        message: commitMessage,
        sha: sha,
        branch: site.default_branch || 'main',
      }
    ).catch((error: any) => {
      if (error.status === 404) {
        throw { status: 404, message: 'File not found' };
      }
      throw error;
    });

    // Log the activity
    await supabase.from('activity_log').insert({
      site_id: site_id,
      user_id: user.id,
      action: 'delete_asset',
      metadata: {
        file_path,
        branch: site.default_branch || 'main',
        commit_sha: deleteData.commit.sha,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      commit_sha: deleteData.commit.sha,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error deleting asset:', error);
    const status = error?.status === 404 ? 404 : 500;
    const message = error?.message || 'Unexpected error';
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
