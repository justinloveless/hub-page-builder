import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserPlus, Copy, Check } from "lucide-react";

interface InviteMemberDialogProps {
  siteId: string;
  onInviteCreated?: () => void;
}

const InviteMemberDialog = ({ siteId, onInviteCreated }: InviteMemberDialogProps) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const handleCreateInvite = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-invitation", {
        body: { site_id: siteId, email: email || undefined },
      });

      if (error) throw error;

      setInviteUrl(data.invite_url);
      setInviteCode(data.invite_code);
      toast.success("Invitation created successfully!");
      if (onInviteCreated) onInviteCreated();
    } catch (error: any) {
      console.error("Error creating invitation:", error);
      toast.error(error.message || "Failed to create invitation");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Invite link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCodeCopied(true);
      toast.success("Invite code copied to clipboard!");
      setTimeout(() => setCodeCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy code");
    }
  };

  const handleClose = () => {
    setOpen(false);
    setEmail("");
    setInviteUrl("");
    setInviteCode("");
    setCopied(false);
    setCodeCopied(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Manager
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invite Site Manager</DialogTitle>
          <DialogDescription>
            Create an invitation link to add a new manager to this site. The link will expire in 7 days.
          </DialogDescription>
        </DialogHeader>
        
        {!inviteUrl ? (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="manager@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Optional: Add an email for reference. The invitation link works for anyone who has it.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleCreateInvite} disabled={loading}>
                {loading ? "Creating..." : "Generate Invite Link"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Invitation Link</Label>
                <div className="flex gap-2">
                  <Input
                    value={inviteUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={handleCopyLink}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this link with the person you want to invite.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Invite Code</Label>
                <div className="flex gap-2">
                  <Input
                    value={inviteCode}
                    readOnly
                    className="font-mono text-lg font-bold tracking-widest text-center"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={handleCopyCode}
                  >
                    {codeCopied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this code if the link doesn't work. They can enter it on the dashboard.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InviteMemberDialog;
