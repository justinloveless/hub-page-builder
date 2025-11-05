import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Use cryptographically secure random token generation
function generateShareToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Path traversal protection
function sanitizePath(path: string): string {
  const sanitized = path.replace(/\.\./g, '').replace(/^\/+/, '');
  if (sanitized.includes('..') || sanitized.startsWith('/')) {
    throw new Error('Invalid path: path traversal detected');
  }
  return sanitized;
}

// Validation constants
const MAX_EXPIRY_HOURS = 8760; // 1 year
const MIN_EXPIRY_HOURS = 1;
const MAX_UPLOADS_LIMIT = 1000;
const VALID_EXTENSION_REGEX = /^[a-zA-Z0-9]+$/;
const MAX_DESCRIPTION_LENGTH = 500;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      site_id, 
      asset_path, 
      expires_in_hours = 24,
      max_uploads = null,
      allowed_extensions = null,
      description = null
    } = await req.json();

    // Validate required fields
    if (!site_id || !asset_path) {
      console.error('Missing required fields');
      return new Response(
        JSON.stringify({ error: 'site_id and asset_path are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate site_id is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(site_id)) {
      console.error('Invalid site_id format:', site_id);
      return new Response(
        JSON.stringify({ error: 'Invalid site_id format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize asset path to prevent path traversal
    let sanitizedPath: string;
    try {
      sanitizedPath = sanitizePath(asset_path);
    } catch (error: any) {
      console.error('Path traversal attempt:', asset_path);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate expires_in_hours
    if (typeof expires_in_hours !== 'number' || 
        expires_in_hours < MIN_EXPIRY_HOURS || 
        expires_in_hours > MAX_EXPIRY_HOURS ||
        !Number.isFinite(expires_in_hours) ||
        !Number.isInteger(expires_in_hours)) {
      console.error('Invalid expires_in_hours:', expires_in_hours);
      return new Response(
        JSON.stringify({ 
          error: `expires_in_hours must be an integer between ${MIN_EXPIRY_HOURS} and ${MAX_EXPIRY_HOURS}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate max_uploads
    if (max_uploads !== null) {
      if (typeof max_uploads !== 'number' || 
          max_uploads < 1 || 
          max_uploads > MAX_UPLOADS_LIMIT ||
          !Number.isFinite(max_uploads) ||
          !Number.isInteger(max_uploads)) {
        console.error('Invalid max_uploads:', max_uploads);
        return new Response(
          JSON.stringify({ 
            error: `max_uploads must be an integer between 1 and ${MAX_UPLOADS_LIMIT}` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate allowed_extensions
    if (allowed_extensions !== null) {
      if (!Array.isArray(allowed_extensions)) {
        console.error('allowed_extensions must be an array');
        return new Response(
          JSON.stringify({ error: 'allowed_extensions must be an array' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (allowed_extensions.length > 50) {
        console.error('Too many allowed extensions');
        return new Response(
          JSON.stringify({ error: 'Maximum 50 allowed extensions' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      for (const ext of allowed_extensions) {
        if (typeof ext !== 'string') {
          console.error('Extension must be a string:', ext);
          return new Response(
            JSON.stringify({ error: 'Extensions must be strings' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Remove leading dot if present
        const normalizedExt = ext.startsWith('.') ? ext.substring(1) : ext;
        
        if (!VALID_EXTENSION_REGEX.test(normalizedExt)) {
          console.error('Invalid extension format:', ext);
          return new Response(
            JSON.stringify({ 
              error: 'Extensions must be alphanumeric (e.g., "jpg", "png", ".pdf")' 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Validate description
    if (description !== null) {
      if (typeof description !== 'string') {
        console.error('Description must be a string');
        return new Response(
          JSON.stringify({ error: 'Description must be a string' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (description.length > MAX_DESCRIPTION_LENGTH) {
        console.error('Description too long');
        return new Response(
          JSON.stringify({ error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Verify user is a member of the site
    const { data: membership } = await supabase
      .from('site_members')
      .select('role')
      .eq('site_id', site_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      console.error('User not authorized for site:', user.id, site_id);
      return new Response(
        JSON.stringify({ error: 'Not authorized for this site' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = generateShareToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expires_in_hours);

    const { data: share, error: insertError } = await supabase
      .from('asset_shares')
      .insert({
        site_id,
        asset_path: sanitizedPath, // Use sanitized path
        token,
        created_by: user.id,
        expires_at: expiresAt.toISOString(),
        max_uploads: max_uploads,
        allowed_extensions: allowed_extensions,
        description: description,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Asset share created:', share.id, 'for site:', site_id);

    return new Response(
      JSON.stringify({ share }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating asset share:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});