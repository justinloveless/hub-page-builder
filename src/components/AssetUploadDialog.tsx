import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, RefreshCw, FileText, Image as ImageIcon } from "lucide-react";

interface AssetConfig {
  path: string;
  type: string;
  label?: string;
  description?: string;
  maxSize?: number;
  allowedExtensions?: string[];
}

interface AssetUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: AssetConfig;
  siteId: string;
  onSuccess: () => void;
}

const AssetUploadDialog = ({ open, onOpenChange, asset, siteId, onSuccess }: AssetUploadDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [commitMessage, setCommitMessage] = useState(`Update ${asset.path}`);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file size
    if (asset.maxSize && selectedFile.size > asset.maxSize) {
      toast.error(`File size exceeds maximum of ${(asset.maxSize / 1024 / 1024).toFixed(1)} MB`);
      return;
    }

    // Validate file extension
    const fileExt = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
    if (asset.allowedExtensions && !asset.allowedExtensions.includes(fileExt)) {
      toast.error(`File type not allowed. Allowed types: ${asset.allowedExtensions.join(', ')}`);
      return;
    }

    setFile(selectedFile);

    // Create preview for images and text
    if (asset.type === 'image' || selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else if (selectedFile.type.startsWith('text/') || fileExt === '.md') {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsText(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error("Not authenticated");
        return;
      }

      // Convert file to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];

        const { data, error } = await supabase.functions.invoke('upload-site-asset', {
          body: {
            site_id: siteId,
            file_path: asset.path,
            content: base64,
            message: commitMessage,
          },
        });

        if (error) throw error;

        toast.success("Asset uploaded successfully!");
        onSuccess();
        onOpenChange(false);
        setFile(null);
        setPreview(null);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error("Failed to upload asset:", error);
      toast.error(error.message || "Failed to upload asset");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Asset: {asset.label || asset.path}</DialogTitle>
          <DialogDescription>
            {asset.description || 'Upload a file to this asset location'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File constraints */}
          <div className="text-sm text-muted-foreground space-y-1">
            {asset.maxSize && (
              <p>• Maximum size: {(asset.maxSize / 1024 / 1024).toFixed(1)} MB</p>
            )}
            {asset.allowedExtensions && (
              <p>• Allowed types: {asset.allowedExtensions.join(', ')}</p>
            )}
          </div>

          {/* File input */}
          <div className="space-y-2">
            <Label htmlFor="file">Select File</Label>
            <Input
              id="file"
              type="file"
              onChange={handleFileChange}
              accept={asset.allowedExtensions?.join(',')}
            />
          </div>

          {/* Preview */}
          {preview && (
            <div className="space-y-2">
              <Label>Preview</Label>
              {asset.type === 'image' || file?.type.startsWith('image/') ? (
                <div className="border rounded-lg p-4 bg-muted/50">
                  <img
                    src={preview}
                    alt="Preview"
                    className="max-w-full max-h-96 mx-auto object-contain"
                  />
                </div>
              ) : (
                <div className="border rounded-lg p-4 bg-muted/50">
                  <pre className="text-xs overflow-x-auto max-h-64">{preview}</pre>
                </div>
              )}
            </div>
          )}

          {/* Commit message */}
          <div className="space-y-2">
            <Label htmlFor="message">Commit Message</Label>
            <Textarea
              id="message"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Describe your changes..."
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
            >
              {uploading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload & Commit
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AssetUploadDialog;
