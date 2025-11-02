import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const GithubCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const installationId = searchParams.get('installation_id');
        const setupAction = searchParams.get('setup_action');
        const state = searchParams.get('state');

        // Verify state
        const savedState = sessionStorage.getItem('github_oauth_state');
        if (state !== savedState) {
          throw new Error('Invalid state parameter');
        }
        sessionStorage.removeItem('github_oauth_state');

        if (!installationId) {
          throw new Error('No installation ID received');
        }

        // Call edge function to get installation details
        const { data, error } = await supabase.functions.invoke('github-installation-details', {
          body: { installation_id: installationId },
        });

        if (error) throw error;

        // Send message to opener window
        if (window.opener) {
          window.opener.postMessage({
            type: 'GITHUB_OAUTH_SUCCESS',
            data: {
              installation_id: installationId,
              repositories: data?.repositories || [],
              setup_action: setupAction,
            }
          }, window.location.origin);
          window.close();
        } else {
          // If no opener, redirect to dashboard
          toast.success('Connected to GitHub successfully!');
          navigate('/dashboard');
        }
      } catch (error: any) {
        console.error('GitHub callback error:', error);
        
        if (window.opener) {
          window.opener.postMessage({
            type: 'GITHUB_OAUTH_ERROR',
            error: error.message || 'Failed to connect to GitHub'
          }, window.location.origin);
          window.close();
        } else {
          toast.error(error.message || 'Failed to connect to GitHub');
          navigate('/dashboard');
        }
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Connecting to GitHub...</p>
      </div>
    </div>
  );
};

export default GithubCallback;
