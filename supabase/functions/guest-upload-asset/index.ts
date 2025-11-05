import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Octokit } from 'https://esm.sh/@octokit/rest@20.0.2';
import { createAppAuth } from 'https://esm.sh/@octokit/auth-app@6.0.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizePemKey(pem: string): string {
  return pem
    .replace(/\\n/g, '\n')
    .replace(/^\s+|\s+$/g, '')
    .replace(/-----BEGIN RSA PRIVATE KEY-----\n?/, '-----BEGIN RSA PRIVATE KEY-----\n')
    .replace(/\n?-----END RSA PRIVATE KEY-----/, '\n-----END RSA PRIVATE KEY-----');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token, file_content, file_name } = await req.json();

    if (!token || !file_content || !file_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch share details
    const { data: share, error: shareError } = await supabase
      .from('asset_shares')
      .select('*, sites(*)')
      .eq('token', token)
      .maybeSingle();

    if (shareError || !share) {
      return new Response(
        JSON.stringify({ error: 'Invalid share token' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if share is expired
    if (new Date(share.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Share link has expired' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check upload limit
    if (share.max_uploads && share.upload_count >= share.max_uploads) {
      return new Response(
        JSON.stringify({ error: 'Upload limit reached' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check file extension
    if (share.allowed_extensions && share.allowed_extensions.length > 0) {
      const fileExt = file_name.split('.').pop()?.toLowerCase();
      if (!fileExt || !share.allowed_extensions.includes(`.${fileExt}`)) {
        return new Response(
          JSON.stringify({ error: `File type not allowed. Allowed: ${share.allowed_extensions.join(', ')}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get GitHub App configuration
    const { data: appConfig } = await supabase
      .from('github_app_public_config')
      .select('*')
      .single();

    if (!appConfig) {
      throw new Error('GitHub App not configured');
    }

    const privateKey = normalizePemKey(Deno.env.get('GITHUB_APP_PKEY')!);
    const appId = appConfig.app_id;

    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: appId,
        privateKey: privateKey,
      },
    });

    const { data: installation } = await octokit.apps.getRepoInstallation({
      owner: share.sites.repo_full_name.split('/')[0],
      repo: share.sites.repo_full_name.split('/')[1],
    });

    const octokitInstallation = await octokit.auth({
      type: 'installation',
      installationId: installation.id,
    }) as any;

    const authenticatedOctokit = new Octokit({
      auth: octokitInstallation.token,
    });

    const [owner, repo] = share.sites.repo_full_name.split('/');
    const filePath = `${share.asset_path}/${file_name}`.replace(/\/+/g, '/');

    // Check if file exists
    let existingSha: string | undefined;
    try {
      const { data: existingFile } = await authenticatedOctokit.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: share.sites.default_branch,
      });
      if ('sha' in existingFile) {
        existingSha = existingFile.sha;
      }
    } catch (error) {
      // File doesn't exist, that's fine
    }

    // Upload to GitHub
    const uploadResult = await authenticatedOctokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: `Guest upload: ${file_name}`,
      content: file_content,
      branch: share.sites.default_branch,
      sha: existingSha,
    });

    // Update manifest.json if it exists in the directory
    const pathParts = filePath.split('/');
    if (pathParts.length > 1) {
      const fileName = pathParts[pathParts.length - 1];
      const dirPath = pathParts.slice(0, -1).join('/');
      const manifestPath = `${dirPath}/manifest.json`;

      try {
        // Try to get the existing manifest
        const { data: manifestFile } = await authenticatedOctokit.repos.getContent({
          owner,
          repo,
          path: manifestPath,
          ref: share.sites.default_branch,
        });

        if ('content' in manifestFile && 'sha' in manifestFile) {
          const manifestContent = atob(manifestFile.content.replace(/\s/g, ''));
          const manifest = JSON.parse(manifestContent);

          // Add the file to the manifest if it's not already there
          if (!manifest.files.includes(fileName)) {
            manifest.files.push(fileName);
            manifest.files.sort(); // Keep files sorted

            // Update the manifest
            const updatedManifestContent = btoa(JSON.stringify(manifest, null, 2));
            await authenticatedOctokit.repos.createOrUpdateFileContents({
              owner,
              repo,
              path: manifestPath,
              message: `Update manifest: add ${fileName}`,
              content: updatedManifestContent,
              branch: share.sites.default_branch,
              sha: manifestFile.sha,
            });

            console.log('Updated manifest.json with guest upload');
          }
        }
      } catch (manifestError: any) {
        // If manifest doesn't exist or there's an error, continue without failing
        console.log('Could not update manifest:', manifestError.message);
      }
    }

    // Update upload count
    await supabase
      .from('asset_shares')
      .update({ upload_count: share.upload_count + 1 })
      .eq('id', share.id);

    // Log activity
    await supabase
      .from('activity_log')
      .insert({
        site_id: share.site_id,
        user_id: null,
        action: 'Guest uploaded file via share link',
        metadata: {
          file_path: filePath,
          file_name: file_name,
          commit_sha: uploadResult.data.commit.sha,
          share_id: share.id,
        },
      });

    console.log('Guest upload successful:', filePath);

    return new Response(
      JSON.stringify({
        success: true,
        file_path: filePath,
        commit_sha: uploadResult.data.commit.sha,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in guest upload:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
