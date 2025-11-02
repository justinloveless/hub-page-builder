import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Github, Zap, Shield, Users } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Github className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">Static Hub</h1>
          </div>
          <Button onClick={() => navigate("/auth")}>Get Started</Button>
        </div>
      </header>

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
  );
};

export default Index;
