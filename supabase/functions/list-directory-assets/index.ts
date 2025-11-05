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

    // Try to read the manifest.json from the directory
    const manifestPath = asset_path.endsWith('/')
      ? `${asset_path}manifest.json`
      : `${asset_path}/manifest.json`;

    try {
      const { data: manifestFile } = await octokit.request(
        'GET /repos/{owner}/{repo}/contents/{path}',
        {
          owner,
          repo,
          path: manifestPath,
          ref: site.default_branch || 'main',
        }
      );

      // Decode the manifest content
      const manifestContent = atob((manifestFile as any).content.replace(/\s/g, ''));
      const manifest = JSON.parse(manifestContent);

      // Now fetch details for each file in the manifest
      const filePromises = manifest.files.map(async (fileName: string) => {
        const filePath = asset_path.endsWith('/')
          ? `${asset_path}${fileName}`
          : `${asset_path}/${fileName}`;

        try {
          const { data: fileData } = await octokit.request(
            'GET /repos/{owner}/{repo}/contents/{path}',
            {
              owner,
              repo,
              path: filePath,
              ref: site.default_branch || 'main',
            }
          );

          return {
            name: (fileData as any).name,
            path: (fileData as any).path,
            sha: (fileData as any).sha,
            size: (fileData as any).size,
            type: (fileData as any).type,
            download_url: (fileData as any).download_url,
          };
        } catch (error: any) {
          // If file doesn't exist, skip it
          if (error.status === 404) {
            console.warn(`File ${filePath} listed in manifest but not found in repo`);
            return null;
          }
          throw error;
        }
      });

      const filesData = await Promise.all(filePromises);
      const files = filesData.filter((file) => file !== null);

      return new Response(JSON.stringify({ files }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error: any) {
      if (error.status === 404) {
        // If manifest doesn't exist, fall back to listing directory contents
        console.log('Manifest not found, falling back to directory listing');
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

          // If it's a directory, return the list of files (excluding manifest.json)
          if (Array.isArray(contents)) {
            const files = contents
              .filter((item: any) => item.name !== 'manifest.json')
              .map((item: any) => ({
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
        } catch (fallbackError: any) {
          if (fallbackError.status === 404) {
            return new Response(JSON.stringify({ files: [] }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          throw fallbackError;
        }
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
