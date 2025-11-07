import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Verify the user
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

    // Verify user owns the site or is a member
    const { data: membership, error: membershipError } = await supabaseClient
      .from('site_members')
      .select('role, site_id')
      .eq('site_id', site_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError) {
      console.error('Error checking membership:', membershipError)
      throw new Error('Error verifying site membership')
    }

    if (!membership) {
      throw new Error('You are not a member of this site')
    }

    // Get the site to check who created it
    const { data: site, error: siteError } = await supabaseClient
      .from('sites')
      .select('id, created_by, github_installation_id')
      .eq('id', site_id)
      .single()

    if (siteError || !site) {
      throw new Error('Site not found')
    }

    // Get user's current GitHub installation
    const { data: installation, error: installationError } = await supabaseClient
      .from('github_installations')
      .select('installation_id')
      .eq('user_id', site.created_by)
      .maybeSingle()

    if (installationError) {
      console.error('Error checking installation:', installationError)
      throw new Error('Error verifying GitHub installation')
    }

    if (!installation) {
      throw new Error('No GitHub installation found. Please connect your GitHub account first.')
    }

    // Check if the site already has this installation_id
    if (site.github_installation_id === installation.installation_id) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Site is already connected to GitHub',
          installation_id: installation.installation_id
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Update the site with the new installation_id
    const { error: updateError } = await supabaseClient
      .from('sites')
      .update({ github_installation_id: installation.installation_id })
      .eq('id', site_id)

    if (updateError) {
      console.error('Error updating site:', updateError)
      throw updateError
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Site reconnected to GitHub successfully',
        installation_id: installation.installation_id
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
