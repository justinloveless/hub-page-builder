import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SearchUsersRequest {
    query?: string;
    userIds?: string[];
    limit?: number;
}

serve(async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            throw new Error("Missing Authorization header");
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get user from JWT
        const jwt = authHeader.replace("Bearer ", "");
        const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);

        if (userError || !user) {
            throw new Error("Unauthorized");
        }

        // Check if user is admin
        const { data: hasAdminRole, error: roleError } = await supabase
            .rpc('has_role', {
                _user_id: user.id,
                _role: 'admin'
            });

        if (roleError || !hasAdminRole) {
            throw new Error("Forbidden: Admin access required");
        }

        const { query, userIds, limit = 10 }: SearchUsersRequest = await req.json();

        // Get all users from admin API
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

        if (listError) {
            throw listError;
        }

        let filteredUsers;

        // If userIds are provided, return those specific users
        if (userIds && userIds.length > 0) {
            filteredUsers = users
                .filter(u => userIds.includes(u.id))
                .map(u => ({
                    id: u.id,
                    email: u.email,
                }));
        }
        // Otherwise, search by email query
        else if (query && query.trim().length > 0) {
            const searchQuery = query.toLowerCase().trim();
            filteredUsers = users
                .filter(u => u.email?.toLowerCase().includes(searchQuery))
                .slice(0, limit)
                .map(u => ({
                    id: u.id,
                    email: u.email,
                }));
        }
        // Return empty array if no query or userIds provided
        else {
            return new Response(
                JSON.stringify({ users: [] }),
                {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 200,
                }
            );
        }

        return new Response(
            JSON.stringify({ users: filteredUsers }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            }
        );
    } catch (error: any) {
        console.error("Error searching users:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            }
        );
    }
});

