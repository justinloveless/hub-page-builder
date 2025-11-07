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

    const { site_id, commit_message, asset_changes } = await req.json();

    if (!site_id || !commit_message || !asset_changes) {
      return new Response(JSON.stringify({ error: 'site_id, commit_message, and asset_changes are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Committing batch changes for site:', site_id);

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

    console.log(`Committing ${asset_changes.length} asset changes`);

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

    // Verify the installation exists and is accessible
    try {
      await app.octokit.request('GET /app/installations/{installation_id}', {
        installation_id: site.github_installation_id
      });
    } catch (installError: any) {
      if (installError.status === 404) {
        throw new Error('GitHub App installation no longer exists. The app may have been uninstalled. Please reconnect your GitHub account and update the site settings.');
      }
      throw installError;
    }

    const octokit = await app.getInstallationOctokit(site.github_installation_id);
    console.log('Got GitHub installation client');

    const [owner, repo] = site.repo_full_name.split('/');

    // Get the latest commit SHA of the default branch
    const { data: refData } = await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
      owner,
      repo,
      ref: `heads/${site.default_branch}`,
    });

    const latestCommitSha = refData.object.sha;
    console.log('Latest commit SHA:', latestCommitSha);

    // Get the tree of the latest commit
    const { data: commitData } = await octokit.request('GET /repos/{owner}/{repo}/git/commits/{commit_sha}', {
      owner,
      repo,
      commit_sha: latestCommitSha,
    });

    const baseTreeSha = commitData.tree.sha;

    // Group files by their parent directory for manifest updates
    const directoriesWithFiles = new Map<string, Set<string>>();

    for (const change of asset_changes) {
      const pathParts = change.repo_path.split('/');
      if (pathParts.length > 1) {
        const fileName = pathParts[pathParts.length - 1];
        const dirPath = pathParts.slice(0, -1).join('/');

        if (!directoriesWithFiles.has(dirPath)) {
          directoriesWithFiles.set(dirPath, new Set());
        }
        directoriesWithFiles.get(dirPath)!.add(fileName);
      }
    }

    // Create blobs for each asset change
    const treeEntries = [];

    for (const change of asset_changes) {
      const { data: blobData } = await octokit.request('POST /repos/{owner}/{repo}/git/blobs', {
        owner,
        repo,
        content: change.content,
        encoding: 'base64',
      });

      console.log(`Created blob for ${change.repo_path}: ${blobData.sha}`);

      treeEntries.push({
        path: change.repo_path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blobData.sha,
      });
    }

    // Update manifests for directories that have files being changed
    for (const [dirPath, newFiles] of directoriesWithFiles.entries()) {
      const manifestPath = `${dirPath}/manifest.json`;

      try {
        // Try to get the existing manifest
        const { data: manifestFile } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
          owner,
          repo,
          path: manifestPath,
          ref: site.default_branch,
        });

        const manifestContent = atob((manifestFile as any).content.replace(/\s/g, ''));
        const manifest = JSON.parse(manifestContent);

        // Add any new files to the manifest
        let manifestUpdated = false;
        for (const fileName of newFiles) {
          if (!manifest.files.includes(fileName)) {
            manifest.files.push(fileName);
            manifestUpdated = true;
          }
        }

        if (manifestUpdated) {
          manifest.files.sort(); // Keep files sorted

          // Create a blob for the updated manifest
          const updatedManifestContent = JSON.stringify(manifest, null, 2);
          const { data: manifestBlob } = await octokit.request('POST /repos/{owner}/{repo}/git/blobs', {
            owner,
            repo,
            content: btoa(updatedManifestContent),
            encoding: 'base64',
          });

          console.log(`Updated manifest for ${dirPath}`);

          treeEntries.push({
            path: manifestPath,
            mode: '100644' as const,
            type: 'blob' as const,
            sha: manifestBlob.sha,
          });
        }
      } catch (manifestError: any) {
        if (manifestError.status === 404) {
          console.log(`No manifest.json found for ${dirPath}, skipping manifest update`);
        } else {
          console.error(`Error updating manifest for ${dirPath}:`, manifestError);
          // Continue with batch commit even if manifest update fails
        }
      }
    }

    // Create a new tree with all the changes
    const { data: newTree } = await octokit.request('POST /repos/{owner}/{repo}/git/trees', {
      owner,
      repo,
      base_tree: baseTreeSha,
      tree: treeEntries,
    });

    console.log('Created new tree:', newTree.sha);

    // Create a commit with the new tree
    const { data: newCommit } = await octokit.request('POST /repos/{owner}/{repo}/git/commits', {
      owner,
      repo,
      message: commit_message,
      tree: newTree.sha,
      parents: [latestCommitSha],
    });

    console.log('Created new commit:', newCommit.sha);

    // Update the reference to point to the new commit
    await octokit.request('PATCH /repos/{owner}/{repo}/git/refs/{ref}', {
      owner,
      repo,
      ref: `heads/${site.default_branch}`,
      sha: newCommit.sha,
    });

    console.log('Updated branch reference');

    // Log the activity
    await supabase.from('activity_log').insert({
      site_id,
      user_id: user.id,
      action: 'batch_commit',
      metadata: {
        commit_sha: newCommit.sha,
        commit_message,
        files_count: asset_changes.length,
        files: asset_changes.map((c: any) => c.repo_path),
      },
    });

    return new Response(JSON.stringify({
      success: true,
      commit_sha: newCommit.sha,
      commit_url: newCommit.html_url,
      files_committed: asset_changes.length,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error committing batch changes:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Failed to commit batch changes'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
