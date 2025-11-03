import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { useNavigate } from "react-router-dom";

const JoinWithCodeDialog = () => {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleJoinSite = async () => {
    if (!code.trim()) {
      toast.error("Please enter an invite code");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("accept-invitation", {
        body: { invite_code: code.trim().toUpperCase() },
      });

      if (error) throw error;

      toast.success("Successfully joined the site!");
      setOpen(false);
      setCode("");
      
      // Navigate to the site management page
      if (data.site_id) {
        navigate(`/manage/${data.site_id}`);
      }
    } catch (error: any) {
      console.error("Error accepting invitation:", error);
      toast.error(error.message || "Failed to accept invitation");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setCode("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <KeyRound className="mr-2 h-4 w-4" />
          Join with Code
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Join Site with Invite Code</DialogTitle>
          <DialogDescription>
            Enter the 6-character code you received to join a site as a manager.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="code">Invite Code</Label>
            <Input
              id="code"
              placeholder="ABC123"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="font-mono text-lg font-bold tracking-widest text-center uppercase"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              The code is 6 characters long and case-insensitive.
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleJoinSite} disabled={loading}>
            {loading ? "Joining..." : "Join Site"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default JoinWithCodeDialog;
