import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Share2, Copy, Check, Users } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Asset {
  path: string;
  type: string;
  label?: string;
}

interface CreateShareDialogProps {
  siteId: string;
  assets: Asset[];
  trigger?: React.ReactNode;
}

const CreateShareDialog = ({ siteId, assets, trigger }: CreateShareDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shareTokens, setShareTokens] = useState<Array<{ path: string; token: string }>>([]);
  const [copied, setCopied] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [expiresInHours, setExpiresInHours] = useState("24");
  const [maxUploads, setMaxUploads] = useState("");
  const [allowedExtensions, setAllowedExtensions] = useState("");
  const [description, setDescription] = useState("");

  const toggleAsset = (assetPath: string) => {
    setSelectedAssets(prev => {
      const next = new Set(prev);
      if (next.has(assetPath)) {
        next.delete(assetPath);
      } else {
        next.add(assetPath);
      }
      return next;
    });
  };

  const handleCreateShare = async () => {
    if (selectedAssets.size === 0) {
      toast.error("Please select at least one asset");
      return;
    }

    setLoading(true);
    const tokens: Array<{ path: string; token: string }> = [];
    
    try {
      for (const assetPath of selectedAssets) {
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
        tokens.push({ path: assetPath, token: data.share.token });
      }

      setShareTokens(tokens);
      toast.success(`Share link${tokens.length > 1 ? 's' : ''} created successfully!`);
    } catch (error: any) {
      console.error("Error creating share:", error);
      toast.error(error.message || "Failed to create share link");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async (token: string) => {
    const shareUrl = `${window.location.origin}/upload/${token}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  const handleCopyAllLinks = async () => {
    const allLinks = shareTokens.map(({ token }) => 
      `${window.location.origin}/upload/${token}`
    ).join('\n');
    try {
      await navigator.clipboard.writeText(allLinks);
      toast.success("All links copied to clipboard!");
    } catch (error) {
      toast.error("Failed to copy links");
    }
  };

  const handleClose = () => {
    setOpen(false);
    setShareTokens([]);
    setCopied(false);
    setSelectedAssets(new Set());
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
        {trigger || (
          <Button variant="outline" size="sm">
            <Users className="h-4 w-4 mr-2" />
            Collaborate
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Share Assets for Guest Uploads</DialogTitle>
          <DialogDescription>
            Create temporary links that allow anyone to upload files to selected locations
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          {shareTokens.length === 0 ? (
            <div className="space-y-4 pb-4 px-1">
              <div>
                <Label className="mb-2 block">Select Assets to Share</Label>
                <ScrollArea className="h-48 border rounded-lg p-2">
                  <div className="space-y-2">
                    {assets.map((asset) => (
                      <div key={asset.path} className="flex items-start gap-2 p-2 hover:bg-muted/50 rounded">
                        <Checkbox
                          id={asset.path}
                          checked={selectedAssets.has(asset.path)}
                          onCheckedChange={() => toggleAsset(asset.path)}
                        />
                        <div className="flex-1 min-w-0">
                          <Label 
                            htmlFor={asset.path} 
                            className="text-sm font-medium cursor-pointer block"
                          >
                            {asset.label || asset.path.split('/').pop()}
                          </Label>
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            {asset.path}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedAssets.size} asset{selectedAssets.size !== 1 ? 's' : ''} selected
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

              <Button 
                onClick={handleCreateShare} 
                disabled={loading || selectedAssets.size === 0} 
                className="w-full"
              >
                {loading ? "Creating..." : `Create ${selectedAssets.size} Share Link${selectedAssets.size !== 1 ? 's' : ''}`}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 pb-4 px-1">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Share Links Created</Label>
                  {shareTokens.length > 1 && (
                    <Button size="sm" variant="outline" onClick={handleCopyAllLinks}>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy All
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-64 border rounded-lg p-2">
                  <div className="space-y-3">
                    {shareTokens.map(({ path, token }) => (
                      <div key={path} className="p-3 bg-muted rounded-lg space-y-2">
                        <p className="text-sm font-medium truncate">{path}</p>
                        <div className="flex gap-2">
                          <Input
                            value={`${window.location.origin}/upload/${token}`}
                            readOnly
                            className="font-mono text-xs"
                          />
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => handleCopyLink(token)}
                          >
                            {copied ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="bg-muted p-3 rounded-lg space-y-2 text-sm">
                <p><strong>Expires:</strong> In {expiresInHours} hours</p>
                {maxUploads && <p><strong>Upload Limit:</strong> {maxUploads} files per link</p>}
                {allowedExtensions && <p><strong>Allowed Types:</strong> {allowedExtensions}</p>}
              </div>

              <Button onClick={handleClose} variant="outline" className="w-full">
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateShareDialog;
