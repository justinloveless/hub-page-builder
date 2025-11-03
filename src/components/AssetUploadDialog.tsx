import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, RefreshCw, FileText, Loader2, Trash2, ExternalLink, Eye } from "lucide-react";

interface AssetConfig {
  path: string;
  type: string;
  label?: string;
  description?: string;
  maxSize?: number;
  allowedExtensions?: string[];
}

interface AssetFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: string;
  download_url: string;
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
  const [textContent, setTextContent] = useState("");
  const [loadingContent, setLoadingContent] = useState(false);
  const [currentSha, setCurrentSha] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("view");
  const [existingFiles, setExistingFiles] = useState<AssetFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const isTextAsset = asset.type === "text" || asset.type === "markdown";

  useEffect(() => {
    if (open) {
      loadExistingFiles();
      if (isTextAsset && activeTab === 'edit') {
        loadExistingContent();
      }
    }
  }, [open, activeTab]);

  const loadExistingFiles = async () => {
    setLoadingFiles(true);
    try {
      const { data, error } = await supabase.functions.invoke('list-directory-assets', {
        body: { site_id: siteId, asset_path: asset.path },
      });

      if (error) throw error;
      setExistingFiles(data.files || []);
    } catch (error: any) {
      console.error('Error loading existing files:', error);
    } finally {
      setLoadingFiles(false);
    }
  };

  const loadExistingContent = async () => {
    setLoadingContent(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-asset-content', {
        body: { 
          site_id: siteId,
          asset_path: asset.path
        },
      });

      if (error) throw error;

      if (data.found) {
        setTextContent(data.content);
        setCurrentSha(data.sha);
      } else {
        setTextContent("");
        setCurrentSha(null);
      }
    } catch (error: any) {
      console.error("Failed to load content:", error);
      toast.error("Failed to load existing content");
    } finally {
      setLoadingContent(false);
    }
  };

  const handleDelete = async (filePath: string, sha: string) => {
    if (!confirm(`Are you sure you want to delete ${filePath}?`)) return;
    
    setDeleting(filePath);
    try {
      const { error } = await supabase.functions.invoke('delete-site-asset', {
        body: {
          site_id: siteId,
          file_path: filePath,
          sha: sha,
          message: `Delete ${filePath}`,
        },
      });

      if (error) throw error;

      toast.success("Asset deleted successfully");
      await loadExistingFiles();
      onSuccess();
    } catch (error: any) {
      console.error('Error deleting asset:', error);
      toast.error(error.message || "Failed to delete asset");
    } finally {
      setDeleting(null);
    }
  };

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

        // For directory assets, append the filename to the path
        let fullPath = asset.path;
        if (asset.type === 'directory' || asset.path.endsWith('/')) {
          const basePath = asset.path.endsWith('/') ? asset.path : asset.path + '/';
          fullPath = basePath + file.name;
        }

        const { data, error } = await supabase.functions.invoke('upload-site-asset', {
          body: {
            site_id: siteId,
            file_path: fullPath,
            content: base64,
            message: commitMessage,
          },
        });

        if (error) throw error;

        toast.success("Asset uploaded successfully!");
        setFile(null);
        setPreview(null);
        await loadExistingFiles();
        onSuccess();
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error("Failed to upload asset:", error);
      toast.error(error.message || "Failed to upload asset");
    } finally {
      setUploading(false);
    }
  };

  const uploadTextContent = async () => {
    if (!textContent.trim()) {
      toast.error("Content cannot be empty");
      return;
    }

    setUploading(true);
    try {
      const { data, error } = await supabase.functions.invoke('upload-site-asset', {
        body: {
          site_id: siteId,
          file_path: asset.path,
          content: btoa(textContent),
          message: commitMessage,
          sha: currentSha,
        },
      });

      if (error) throw error;

      toast.success("Content saved successfully!");
      setTextContent("");
      setCommitMessage(`Update ${asset.path}`);
      setCurrentSha(null);
      await loadExistingFiles();
      onSuccess();
    } catch (error: any) {
      console.error("Failed to save content:", error);
      toast.error(error.message || "Failed to save content");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage {asset.label || asset.path}</DialogTitle>
          <DialogDescription>
            {asset.description || 'View, upload, or edit this asset'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full flex-shrink-0" style={{ gridTemplateColumns: isTextAsset ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)' }}>
            <TabsTrigger value="view">
              <Eye className="mr-2 h-4 w-4" />
              Current Assets
            </TabsTrigger>
            {isTextAsset && (
              <TabsTrigger value="edit">
                <FileText className="mr-2 h-4 w-4" />
                Edit Content
              </TabsTrigger>
            )}
            <TabsTrigger value="upload">
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto pr-2">
            <TabsContent value="view" className="mt-0 h-full">
            {loadingFiles ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">Loading assets...</span>
              </div>
            ) : existingFiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No assets found. Upload one to get started.
              </div>
            ) : (
              <div className="space-y-2 pb-4 px-1">
                {existingFiles.map((file) => {
                  const isImage = file.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
                  
                  return (
                    <div
                      key={file.path}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      {isImage && file.download_url && (
                        <div className="flex-shrink-0">
                          <img
                            src={file.download_url}
                            alt={file.name}
                            className="w-16 h-16 object-cover rounded border"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(file.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {file.download_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(file.download_url, '_blank')}
                            title="View in GitHub"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(file.path, file.sha)}
                          disabled={deleting === file.path}
                          title="Delete asset"
                        >
                          {deleting === file.path ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {isTextAsset && (
            <TabsContent value="edit" className="mt-0 h-full">
              {loadingContent ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading content...</span>
                </div>
              ) : (
                <div className="space-y-4 pb-4 px-1">
                  <div className="space-y-2">
                    <Label htmlFor="content">Content</Label>
                    <Textarea
                      id="content"
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      placeholder="Enter your content here..."
                      className="min-h-[200px] font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message-edit">Commit Message</Label>
                    <Input
                      id="message-edit"
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      placeholder={`Update ${asset.label || asset.path}`}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
                      Cancel
                    </Button>
                    <Button onClick={uploadTextContent} disabled={uploading}>
                      {uploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Save & Commit
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          )}

          <TabsContent value="upload" className="mt-0 h-full">
            <div className="space-y-4 pb-4 px-1">
              <div className="text-sm text-muted-foreground space-y-1">
                {asset.maxSize && (
                  <p>• Maximum size: {(asset.maxSize / 1024 / 1024).toFixed(1)} MB</p>
                )}
                {asset.allowedExtensions && (
                  <p>• Allowed types: {asset.allowedExtensions.join(', ')}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Select File</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={handleFileChange}
                  accept={asset.allowedExtensions?.join(',')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message-upload">Commit Message</Label>
                <Textarea
                  id="message-upload"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Describe your changes..."
                  rows={2}
                />
              </div>

              {/* Actions moved above the preview for better mobile access */}
              <div className="flex justify-end gap-2 pt-1">
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

              {preview && (
                <div className="space-y-2">
                  <Label>Preview</Label>
                  {asset.type === 'image' || file?.type.startsWith('image/') ? (
                    <div className="border rounded-lg p-4 bg-muted/50">
                      <img
                        src={preview}
                        alt="Preview"
                        className="max-w-full max-h-64 mx-auto object-contain"
                      />
                    </div>
                  ) : (
                    <div className="border rounded-lg p-4 bg-muted/50">
                      <pre className="text-xs overflow-x-auto max-h-48">{preview}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AssetUploadDialog;
