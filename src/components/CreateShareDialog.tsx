import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Share2, Copy, Check } from "lucide-react";

interface CreateShareDialogProps {
  siteId: string;
  assetPath: string;
}

const CreateShareDialog = ({ siteId, assetPath }: CreateShareDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expiresInHours, setExpiresInHours] = useState("24");
  const [maxUploads, setMaxUploads] = useState("");
  const [allowedExtensions, setAllowedExtensions] = useState("");
  const [description, setDescription] = useState("");

  const handleCreateShare = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-asset-share', {
        body: {
          site_id: siteId,
          asset_path: assetPath,
          expires_in_hours: parseInt(expiresInHours) || 24,
          max_uploads: maxUploads ? parseInt(maxUploads) : null,
          allowed_extensions: allowedExtensions 
            ? allowedExtensions.split(',').map(ext => ext.trim().toLowerCase())
            : null,
          description: description || null,
        },
      });

      if (error) throw error;

      setShareToken(data.share.token);
      toast.success("Share link created successfully!");
    } catch (error: any) {
      console.error("Error creating share:", error);
      toast.error(error.message || "Failed to create share link");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareToken) return;
    const shareUrl = `${window.location.origin}/upload/${shareToken}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  const handleClose = () => {
    setOpen(false);
    setShareToken(null);
    setCopied(false);
    setExpiresInHours("24");
    setMaxUploads("");
    setAllowedExtensions("");
    setDescription("");
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      setOpen(isOpen);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4 mr-2" />
          Share for Uploads
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Asset for Guest Uploads</DialogTitle>
          <DialogDescription>
            Create a temporary link that allows anyone to upload files to this location
          </DialogDescription>
        </DialogHeader>

        {!shareToken ? (
          <div className="space-y-4">
            <div>
              <Label>Upload Location</Label>
              <p className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded mt-1">
                {assetPath}
              </p>
            </div>

            <div>
              <Label htmlFor="expires">Expires In (hours)</Label>
              <Input
                id="expires"
                type="number"
                value={expiresInHours}
                onChange={(e) => setExpiresInHours(e.target.value)}
                min="1"
                max="168"
                placeholder="24"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maximum: 168 hours (7 days)
              </p>
            </div>

            <div>
              <Label htmlFor="maxUploads">Max Uploads (optional)</Label>
              <Input
                id="maxUploads"
                type="number"
                value={maxUploads}
                onChange={(e) => setMaxUploads(e.target.value)}
                min="1"
                placeholder="Unlimited"
              />
            </div>

            <div>
              <Label htmlFor="extensions">Allowed File Types (optional)</Label>
              <Input
                id="extensions"
                value={allowedExtensions}
                onChange={(e) => setAllowedExtensions(e.target.value)}
                placeholder=".jpg, .png, .gif"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Comma-separated list of extensions (e.g., .jpg, .png)
              </p>
            </div>

            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Event photos, team pictures, etc."
                rows={2}
              />
            </div>

            <Button onClick={handleCreateShare} disabled={loading} className="w-full">
              {loading ? "Creating..." : "Create Share Link"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Share Link</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  value={`${window.location.origin}/upload/${shareToken}`}
                  readOnly
                  className="font-mono text-xs"
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
            </div>

            <div className="bg-muted p-3 rounded-lg space-y-2 text-sm">
              <p><strong>Location:</strong> {assetPath}</p>
              <p><strong>Expires:</strong> In {expiresInHours} hours</p>
              {maxUploads && <p><strong>Upload Limit:</strong> {maxUploads} files</p>}
              {allowedExtensions && <p><strong>Allowed Types:</strong> {allowedExtensions}</p>}
            </div>

            <Button onClick={handleClose} variant="outline" className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateShareDialog;
