import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Plus, Github } from "lucide-react";

interface AddSiteDialogProps {
  onSiteAdded: () => void;
}

const AddSiteDialog = ({ onSiteAdded }: AddSiteDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    repoFullName: "",
    defaultBranch: "main",
    githubInstallationId: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Validate GitHub installation ID
      const installationId = parseInt(formData.githubInstallationId);
      if (isNaN(installationId) || installationId <= 0) {
        throw new Error("Please enter a valid GitHub Installation ID");
      }

      // Call the edge function to create the site
      const { data, error } = await supabase.functions.invoke('create-site', {
        body: {
          name: formData.name,
          repo_full_name: formData.repoFullName,
          default_branch: formData.defaultBranch,
          github_installation_id: installationId,
        },
      });

      if (error) throw error;
      if (!data?.site) throw new Error("Failed to create site");

      toast.success("Site added successfully!");
      setOpen(false);
      setFormData({
        name: "",
        repoFullName: "",
        defaultBranch: "main",
        githubInstallationId: "",
      });
      onSiteAdded();
    } catch (error: any) {
      console.error("Error adding site:", error);
      toast.error(error.message || "Failed to add site");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90">
          <Plus className="mr-2 h-5 w-5" />
          Add Site
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              Add New Site
            </DialogTitle>
            <DialogDescription>
              Connect a GitHub repository to start managing your static site
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Site Name</Label>
              <Input
                id="name"
                placeholder="My Awesome Site"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="repo">Repository</Label>
              <Input
                id="repo"
                placeholder="username/repository"
                value={formData.repoFullName}
                onChange={(e) => setFormData({ ...formData, repoFullName: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                Format: owner/repo-name
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch">Default Branch</Label>
              <Input
                id="branch"
                placeholder="main"
                value={formData.defaultBranch}
                onChange={(e) => setFormData({ ...formData, defaultBranch: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="installation">GitHub Installation ID</Label>
              <Input
                id="installation"
                type="number"
                placeholder="12345678"
                value={formData.githubInstallationId}
                onChange={(e) => setFormData({ ...formData, githubInstallationId: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                Get this from your GitHub App installation
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Site
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddSiteDialog;
