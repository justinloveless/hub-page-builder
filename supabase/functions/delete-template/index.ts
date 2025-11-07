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

        // Check if user is admin
        const { data: isAdmin, error: roleError } = await supabaseClient.rpc('has_role', {
            _user_id: user.id,
            _role: 'admin'
        })

        if (roleError) {
            console.error('Error checking admin role:', roleError)
            throw new Error('Failed to verify admin role')
        }

        if (!isAdmin) {
            throw new Error('Only admins can delete templates')
        }

        // Parse request body
        const { template_id } = await req.json()

        if (!template_id) {
            throw new Error('Missing required field: template_id')
        }

        // Delete the template
        const { error: deleteError } = await supabaseClient
            .from('templates')
            .delete()
            .eq('id', template_id)

        if (deleteError) throw deleteError

        return new Response(
            JSON.stringify({ success: true }),
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

