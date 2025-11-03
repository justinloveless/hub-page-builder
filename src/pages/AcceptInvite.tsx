import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, UserPlus, AlertCircle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Site = Tables<"sites">;
type Invitation = Tables<"invitations">;

const AcceptInvite = () => {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAuthAndLoadInvite();
  }, [token]);

  const checkAuthAndLoadInvite = async () => {
    try {
      // Check if user is logged in
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);

      if (!token) {
        setError("Invalid invitation link");
        setLoading(false);
        return;
      }

      // Load invitation details to get site info
      const { data: invitation, error: inviteError } = await supabase
        .from("invitations")
        .select("*")
        .eq("token", token)
        .eq("status", "pending")
        .maybeSingle();

      if (inviteError || !invitation) {
        setError("This invitation is invalid or has already been used");
        setLoading(false);
        return;
      }

      // Check if expired
      const now = new Date();
      const expiresAt = new Date(invitation.expires_at);
      if (now > expiresAt) {
        setError("This invitation has expired");
        setLoading(false);
        return;
      }

      setInvitation(invitation);
      setLoading(false);
    } catch (error: any) {
      console.error("Error loading invitation:", error);
      setError("Failed to load invitation");
      setLoading(false);
    }
  };

  const handleAcceptInvite = async () => {
    if (!user) {
      // Redirect to auth page with return URL
      const returnUrl = encodeURIComponent(window.location.pathname);
      navigate(`/auth?redirect=${returnUrl}`);
      return;
    }

    setAccepting(true);
    try {
      const { data, error } = await supabase.functions.invoke("accept-invitation", {
        body: { token },
      });

      if (error) throw error;

      toast.success("You've successfully joined the site as a manager!");
      navigate(`/manage/${data.site_id}`);
    } catch (error: any) {
      console.error("Error accepting invitation:", error);
      toast.error(error.message || "Failed to accept invitation");
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive mb-2">
              <AlertCircle className="h-5 w-5" />
              <CardTitle>Invalid Invitation</CardTitle>
            </div>
            <CardDescription>{error || "This invitation could not be found"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/dashboard")} className="w-full">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary mb-2">
            <UserPlus className="h-5 w-5" />
            <CardTitle>You've Been Invited!</CardTitle>
          </div>
          <CardDescription>
            You've been invited to join this site as a site manager.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {site && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p className="text-sm font-medium">Site Details:</p>
              <p className="text-sm text-muted-foreground">Name: {site.name}</p>
              <p className="text-sm text-muted-foreground">Repository: {site.repo_full_name}</p>
            </div>
          )}

          {user ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Logged in as: <strong>{user.email}</strong>
              </p>
              <Button 
                onClick={handleAcceptInvite} 
                disabled={accepting}
                className="w-full"
              >
                {accepting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  "Accept Invitation"
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Please sign in to accept this invitation
              </p>
              <Button onClick={handleAcceptInvite} className="w-full">
                Sign In to Accept
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvite;
