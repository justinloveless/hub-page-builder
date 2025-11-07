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
        console.log('list-templates: Starting request')

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
            console.error('list-templates: No authorization header')
            throw new Error('No authorization header')
        }

        console.log('list-templates: Verifying user')
        // Verify the user
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
            authHeader.replace('Bearer ', '')
        )

        if (userError) {
            console.error('list-templates: User verification error:', userError)
            throw new Error('Unauthorized: ' + userError.message)
        }

        if (!user) {
            console.error('list-templates: No user found')
            throw new Error('Unauthorized')
        }

        console.log('list-templates: User verified:', user.id)

        // Parse request body (optional filters)
        let tags: string[] = []
        try {
            const contentType = req.headers.get('content-type')
            if (contentType && contentType.includes('application/json')) {
                const text = await req.text()
                if (text) {
                    const body = JSON.parse(text)
                    tags = body.tags || []
                }
            }
        } catch (error) {
            // No body or invalid JSON, use defaults
            console.log('list-templates: No filters provided, using defaults')
        }

        console.log('list-templates: Querying templates with tags:', tags)

        // Build query - simplified to avoid joins for now
        let query = supabaseClient
            .from('templates')
            .select('*')
            .order('created_at', { ascending: false })

        // Apply tag filter if provided
        if (tags.length > 0) {
            query = query.overlaps('tags', tags)
        }

        const { data: templates, error: templatesError } = await query

        if (templatesError) {
            console.error('list-templates: Query error:', templatesError)
            throw templatesError
        }

        console.log('list-templates: Found', templates?.length || 0, 'templates')

        // Fetch profiles separately if we have templates
        let templatesWithProfiles = templates || []
        if (templates && templates.length > 0) {
            const userIds = [...new Set(templates.map(t => t.submitted_by))]
            console.log('list-templates: Fetching profiles for', userIds.length, 'users')

            const { data: profiles, error: profilesError } = await supabaseClient
                .from('profiles')
                .select('*')
                .in('id', userIds)

            if (!profilesError && profiles) {
                const profileMap = new Map(profiles.map(p => [p.id, p]))
                templatesWithProfiles = templates.map(t => ({
                    ...t,
                    profiles: profileMap.get(t.submitted_by) || null
                }))
            } else {
                console.warn('list-templates: Profile fetch error:', profilesError)
            }
        }

        return new Response(
            JSON.stringify({ templates: templatesWithProfiles }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )
    } catch (error) {
        console.error('list-templates: Error:', error)
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

