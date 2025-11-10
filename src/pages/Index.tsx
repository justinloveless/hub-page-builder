import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Github, Zap, Shield, Users, Loader2 } from "lucide-react";
import logo from "@/assets/staticsnack-logo.png";

const Index = () => {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      } else {
        setCheckingSession(false);
      }
    });
  }, [navigate]);

  // Show loading state while checking session
  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-background via-background to-secondary/20">
      {/* Header - Fixed */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm flex-shrink-0">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="StaticSnack" className="w-10 h-10 rounded-lg" />
            <h1 className="text-xl font-bold">StaticSnack</h1>
          </div>
          <Button onClick={() => navigate("/auth")}>Get Started</Button>
        </div>
      </header>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted mb-6">
            <Zap className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium">Powered by GitHub Pages</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Manage Static Sites Like a Pro
          </h1>

          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Empower your team to manage content without touching code. Connect GitHub repositories
            and let non-technical users update sites with confidence.
          </p>

          <div className="flex gap-4 justify-center">
            <Button
              size="lg"
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
              onClick={() => navigate("/auth")}
            >
              Start Free
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="text-center p-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent mx-auto mb-4 flex items-center justify-center">
              <Github className="w-8 h-8 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">GitHub Integration</h3>
            <p className="text-muted-foreground">
              Seamlessly sync with GitHub repositories. Developers and content managers work in harmony.
            </p>
          </div>

          <div className="text-center p-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent mx-auto mb-4 flex items-center justify-center">
              <Users className="w-8 h-8 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Team Management</h3>
            <p className="text-muted-foreground">
              Collaborate with your team. Multiple managers per site with role-based permissions.
            </p>
          </div>

          <div className="text-center p-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent mx-auto mb-4 flex items-center justify-center">
              <Shield className="w-8 h-8 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Safe & Secure</h3>
            <p className="text-muted-foreground">
              Contract-based content management. Only approved content types can be modified.
            </p>
          </div>
        </div>
      </section>
      </div>
    </div>
  );
};

export default Index;
