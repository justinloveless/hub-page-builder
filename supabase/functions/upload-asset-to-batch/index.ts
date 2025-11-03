import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { site_id, file_path, content } = await req.json();

    if (!site_id || !file_path || !content) {
      return new Response(JSON.stringify({ error: 'site_id, file_path, and content are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Uploading asset to batch for site:', site_id, 'path:', file_path);

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

    // Decode base64 content to calculate file size
    const binaryString = atob(content);
    const fileSizeBytes = binaryString.length;

    // Create a Blob from the base64 content
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Generate a unique storage path
    const timestamp = Date.now();
    const storagePath = `${site_id}/${timestamp}-${file_path.replace(/\//g, '-')}`;

    // Upload to Supabase storage
    const { error: uploadError } = await supabase
      .storage
      .from('asset-versions')
      .upload(storagePath, bytes, {
        contentType: 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      console.error('Failed to upload to storage:', uploadError);
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    console.log('Uploaded file to storage:', storagePath);

    // Check if there's already a pending version for this file path
    const { data: existingVersion } = await supabase
      .from('asset_versions')
      .select('id, storage_path')
      .eq('site_id', site_id)
      .eq('repo_path', file_path)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingVersion) {
      // Delete the old file from storage
      await supabase
        .storage
        .from('asset-versions')
        .remove([existingVersion.storage_path]);

      console.log('Deleted old pending version:', existingVersion.storage_path);

      // Update the existing record
      const { error: updateError } = await supabase
        .from('asset_versions')
        .update({
          storage_path: storagePath,
          file_size_bytes: fileSizeBytes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingVersion.id);

      if (updateError) throw updateError;

      console.log('Updated existing pending version');
    } else {
      // Create a new asset version record
      const { error: insertError } = await supabase
        .from('asset_versions')
        .insert({
          site_id,
          repo_path: file_path,
          storage_path: storagePath,
          status: 'pending',
          file_size_bytes: fileSizeBytes,
          created_by: user.id,
        });

      if (insertError) {
        // Clean up the uploaded file if database insert fails
        await supabase
          .storage
          .from('asset-versions')
          .remove([storagePath]);
        
        throw insertError;
      }

      console.log('Created new pending version record');
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Asset staged successfully',
      storage_path: storagePath,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error uploading asset to batch:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to upload asset to batch'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
