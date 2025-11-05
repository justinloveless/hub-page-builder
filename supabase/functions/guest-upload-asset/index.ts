import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Octokit } from 'https://esm.sh/@octokit/rest@20.0.2';
import { createAppAuth } from 'https://esm.sh/@octokit/auth-app@6.0.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Security constants
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_FILENAME_LENGTH = 255;

// Path traversal protection
function sanitizePath(path: string): string {
  const sanitized = path.replace(/\.\./g, '').replace(/^\/+/, '');
  if (sanitized.includes('..') || sanitized.startsWith('/')) {
    throw new Error('Invalid path: path traversal detected');
  }
  return sanitized;
}

// Validate file extension matches allowed list
function validateExtension(filename: string, allowedExtensions: string[] | null): void {
  if (!allowedExtensions || allowedExtensions.length === 0) return;
  
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) {
    throw new Error('File must have an extension');
  }
  
  // Check if extension is in allowed list (extensions in DB have leading dots)
  const extWithDot = `.${ext}`;
  if (!allowedExtensions.includes(extWithDot)) {
    throw new Error(`File type .${ext} not allowed. Allowed types: ${allowedExtensions.join(', ')}`);
  }
}

// Validate filename
function validateFilename(filename: string): void {
  if (!filename || filename.length === 0) {
    throw new Error('Filename cannot be empty');
  }
  
  if (filename.length > MAX_FILENAME_LENGTH) {
    throw new Error(`Filename too long. Maximum ${MAX_FILENAME_LENGTH} characters`);
  }
  
  // Check for dangerous characters
  if (/[<>:"|?*\x00-\x1f]/.test(filename)) {
    throw new Error('Filename contains invalid characters');
  }
  
  // Prevent hidden files
  if (filename.startsWith('.')) {
    throw new Error('Hidden files are not allowed');
  }
}

// Decode and validate base64 content
function decodeAndValidateContent(base64Content: string): { valid: boolean; sizeBytes: number; error?: string } {
  try {
    // Check if it's valid base64
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Content.replace(/\s/g, ''))) {
      return { valid: false, sizeBytes: 0, error: 'Invalid base64 encoding' };
    }
    
    const decoded = atob(base64Content);
    const sizeBytes = decoded.length;
    
    if (sizeBytes > MAX_FILE_SIZE_BYTES) {
      return { 
        valid: false, 
        sizeBytes, 
        error: `File too large: ${(sizeBytes / 1024 / 1024).toFixed(2)}MB. Maximum ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB` 
      };
    }
    
    return { valid: true, sizeBytes };
  } catch (error) {
    return { valid: false, sizeBytes: 0, error: 'Failed to decode base64 content' };
  }
}

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

    // Input validation
    if (!token || !file_content || !file_name) {
      console.error('Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate token format (should be 64-char hex string from crypto.getRandomValues)
    if (!/^[a-f0-9]{64}$/.test(token)) {
      console.error('Invalid token format');
      return new Response(
        JSON.stringify({ error: 'Invalid token format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate filename
    try {
      validateFilename(file_name);
    } catch (error: any) {
      console.error('Invalid filename:', file_name, error.message);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and decode file content
    const contentValidation = decodeAndValidateContent(file_content);
    if (!contentValidation.valid) {
      console.error('Invalid file content:', contentValidation.error);
      return new Response(
        JSON.stringify({ error: contentValidation.error }),
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
      console.error('Invalid share token:', token);
      return new Response(
        JSON.stringify({ error: 'Invalid share token' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if share is expired
    if (new Date(share.expires_at) < new Date()) {
      console.error('Share link expired:', token);
      return new Response(
        JSON.stringify({ error: 'Share link has expired' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check upload limit
    if (share.max_uploads && share.upload_count >= share.max_uploads) {
      console.error('Upload limit reached for share:', token);
      return new Response(
        JSON.stringify({ error: 'Upload limit reached' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file extension against allowed list
    try {
      validateExtension(file_name, share.allowed_extensions);
    } catch (error: any) {
      console.error('Invalid file extension:', file_name, error.message);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize the asset path to prevent path traversal
    let sanitizedAssetPath: string;
    try {
      sanitizedAssetPath = sanitizePath(share.asset_path);
    } catch (error: any) {
      console.error('Path traversal attempt detected:', share.asset_path);
      return new Response(
        JSON.stringify({ error: 'Invalid asset path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
    // Use sanitized path
    const filePath = `${sanitizedAssetPath}/${file_name}`.replace(/\/+/g, '/');

    console.log('Uploading to path:', filePath);

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
          file_size_bytes: contentValidation.sizeBytes,
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