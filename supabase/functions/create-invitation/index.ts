import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateInvitationRequest {
  site_id: string;
  email?: string;
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

    const { site_id, email }: CreateInvitationRequest = await req.json();

    if (!site_id) {
      throw new Error("site_id is required");
    }

    // Verify user is a site owner
    const { data: membership, error: memberError } = await supabase
      .from("site_members")
      .select("role")
      .eq("site_id", site_id)
      .eq("user_id", user.id)
      .single();

    if (memberError || !membership || membership.role !== "owner") {
      throw new Error("Only site owners can create invitations");
    }

    // Generate unique token
    const token = crypto.randomUUID();
    
    // Generate short invite code (6 characters, alphanumeric)
    const inviteCode = Array.from({ length: 6 }, () => 
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]
    ).join('');
    
    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create invitation
    const { data: invitation, error: inviteError } = await supabase
      .from("invitations")
      .insert({
        site_id,
        inviter_user_id: user.id,
        email,
        token,
        invite_code: inviteCode,
        role: "manager",
        status: "pending",
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (inviteError) {
      console.error("Error creating invitation:", inviteError);
      throw inviteError;
    }

    // Generate invitation URL
    const inviteUrl = `${req.headers.get("origin") || supabaseUrl}/invite/${token}`;

    console.log("Invitation created successfully:", invitation.id);

    return new Response(
      JSON.stringify({
        success: true,
        invitation,
        invite_url: inviteUrl,
        invite_code: inviteCode,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in create-invitation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
