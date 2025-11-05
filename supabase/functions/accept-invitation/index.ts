import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);
  
  if (!record || now > record.resetAt) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  record.count++;
  return true;
}

interface AcceptInvitationRequest {
  token?: string;
  invite_code?: string;
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

    // Rate limiting check
    const rateLimitKey = `accept-invitation:${user.id}`;
    if (!checkRateLimit(rateLimitKey)) {
      console.warn(`Rate limit exceeded for user: ${user.id}`);
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { token, invite_code }: AcceptInvitationRequest = await req.json();

    if (!token && !invite_code) {
      throw new Error("token or invite_code is required");
    }

    // Find invitation by token or code
    let query = supabase
      .from("invitations")
      .select("*")
      .eq("status", "pending");
    
    if (token) {
      query = query.eq("token", token);
    } else if (invite_code) {
      query = query.eq("invite_code", invite_code);
    }
    
    const { data: invitation, error: inviteError } = await query.single();

    if (inviteError || !invitation) {
      throw new Error("Invalid or expired invitation");
    }

    // Check if invitation has expired
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);
    if (now > expiresAt) {
      // Mark as expired
      await supabase
        .from("invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);
      
      throw new Error("This invitation has expired");
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from("site_members")
      .select("*")
      .eq("site_id", invitation.site_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingMember) {
      throw new Error("You are already a member of this site");
    }

    // Add user as site member
    const { error: memberError } = await supabase
      .from("site_members")
      .insert({
        site_id: invitation.site_id,
        user_id: user.id,
        role: invitation.role,
      });

    if (memberError) {
      console.error("Error adding site member:", memberError);
      throw memberError;
    }

    // Mark invitation as accepted
    const { error: updateError } = await supabase
      .from("invitations")
      .update({ status: "accepted" })
      .eq("id", invitation.id);

    if (updateError) {
      console.error("Error updating invitation status:", updateError);
    }

    // Log activity
    await supabase
      .from("activity_log")
      .insert({
        site_id: invitation.site_id,
        user_id: user.id,
        action: "accept_invitation",
        metadata: {
          invitation_id: invitation.id,
          role: invitation.role,
        },
      });

    console.log("Invitation accepted successfully:", invitation.id);

    return new Response(
      JSON.stringify({
        success: true,
        site_id: invitation.site_id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in accept-invitation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
