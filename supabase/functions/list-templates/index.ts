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

        // Parse request body (optional filters)
        let tags: string[] = []
        if (req.method === 'POST') {
            const body = await req.json()
            tags = body.tags || []
        }

        // Build query
        let query = supabaseClient
            .from('templates')
            .select(`
        *,
        profiles:submitted_by (
          id,
          full_name,
          avatar_url
        )
      `)
            .order('created_at', { ascending: false })

        // Apply tag filter if provided
        if (tags.length > 0) {
            query = query.overlaps('tags', tags)
        }

        const { data: templates, error: templatesError } = await query

        if (templatesError) throw templatesError

        return new Response(
            JSON.stringify({ templates: templates || [] }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
        return new Response(
            JSON.stringify({ error: errorMessage }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})

