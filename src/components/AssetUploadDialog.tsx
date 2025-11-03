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
import { Upload, RefreshCw, FileText, Loader2, Trash2, ExternalLink, Eye, Package } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { PendingAssetChange } from "@/pages/Manage";

interface AssetConfig {
  path: string;
  type: string;
  label?: string;
  description?: string;
  maxSize?: number;
  allowedExtensions?: string[];
  schema?: Record<string, any>;
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
  pendingChanges: PendingAssetChange[];
  setPendingChanges: (changes: PendingAssetChange[]) => void;
  onSuccess: () => void;
}

const AssetUploadDialog = ({ open, onOpenChange, asset, siteId, pendingChanges, setPendingChanges, onSuccess }: AssetUploadDialogProps) => {
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
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [jsonFormData, setJsonFormData] = useState<Record<string, any>>({});

  const isTextAsset = asset.type === "text" || asset.type === "markdown";
  const isJsonAsset = asset.type === "json" && asset.schema;
  const isMarkdownAsset = asset.type === "markdown" || asset.path.endsWith(".md");

  useEffect(() => {
    if (open) {
      loadExistingFiles();
      if ((isTextAsset || isJsonAsset) && activeTab === 'edit') {
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
        
        // Parse JSON for schema-based editing
        if (isJsonAsset) {
          try {
            const parsed = JSON.parse(data.content);
            setJsonFormData(parsed);
          } catch (e) {
            console.error("Failed to parse JSON:", e);
            setJsonFormData({});
          }
        }
      } else {
        setTextContent("");
        setCurrentSha(null);
        setJsonFormData({});
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
    setShowConfirmation(false);

    // Create preview for images and text
    if (asset.type === 'image' || selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
        setShowConfirmation(true);
      };
      reader.readAsDataURL(selectedFile);
    } else if (selectedFile.type.startsWith('text/') || fileExt === '.md') {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
        setShowConfirmation(true);
      };
      reader.readAsText(selectedFile);
    } else {
      // For other file types, show confirmation without preview
      setShowConfirmation(true);
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

  const uploadTextContent = async (saveToBatch: boolean = false) => {
    let contentToUpload = textContent;
    
    if (isJsonAsset) {
      try {
        contentToUpload = JSON.stringify(jsonFormData, null, 2);
      } catch (e) {
        toast.error("Invalid JSON data");
        return;
      }
    }
    
    if (!contentToUpload.trim()) {
      toast.error("Content cannot be empty");
      return;
    }

    setUploading(true);
    
    try {
      const base64Content = btoa(unescape(encodeURIComponent(contentToUpload)));
      
      if (saveToBatch) {
        // Fetch original content for diff comparison
        let originalContent = "";
        try {
          const { data: originalData } = await supabase.functions.invoke('fetch-asset-content', {
            body: { 
              site_id: siteId,
              asset_path: asset.path
            },
          });
          if (originalData?.found) {
            originalContent = originalData.content;
          }
        } catch (error) {
          console.error("Failed to fetch original content for diff:", error);
        }

        const fileName = asset.path.split('/').pop() || 'file';
        const newChange: PendingAssetChange = {
          repoPath: asset.path,
          content: base64Content,
          originalContent: originalContent ? btoa(unescape(encodeURIComponent(originalContent))) : undefined,
          fileName
        };
        
        const updatedChanges = pendingChanges.filter(c => c.repoPath !== asset.path);
        setPendingChanges([...updatedChanges, newChange]);
        toast.success("Added to batch");
      } else {
        const { error } = await supabase.functions.invoke('upload-site-asset', {
          body: {
            site_id: siteId,
            file_path: asset.path,
            content: base64Content,
            message: commitMessage,
            sha: currentSha,
          },
        });

        if (error) throw error;
        toast.success("Content saved and committed!");
      }
      
      setTextContent("");
      setJsonFormData({});
      setCommitMessage(`Update ${asset.path}`);
      setCurrentSha(null);
      await loadExistingFiles();
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Failed to save content");
    } finally {
      setUploading(false);
    }
  };

  const updateJsonField = (key: string, value: any) => {
    setJsonFormData(prev => ({ ...prev, [key]: value }));
  };

  const renderSchemaField = (key: string, fieldSchema: any, parentKey?: string) => {
    const fullKey = parentKey ? `${parentKey}.${key}` : key;
    const value = parentKey 
      ? jsonFormData[parentKey]?.[key] ?? fieldSchema.default ?? ''
      : jsonFormData[key] ?? fieldSchema.default ?? '';
    
    const updateValue = (newValue: any) => {
      if (parentKey) {
        setJsonFormData(prev => ({
          ...prev,
          [parentKey]: {
            ...(prev[parentKey] || {}),
            [key]: newValue
          }
        }));
      } else {
        updateJsonField(key, newValue);
      }
    };
    
    switch (fieldSchema.type) {
      case 'object':
        if (fieldSchema.properties) {
          return (
            <div key={fullKey} className="space-y-3 p-4 border rounded-lg bg-accent/5">
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                {fieldSchema.title || key}
              </h3>
              {fieldSchema.description && (
                <p className="text-xs text-muted-foreground -mt-2">{fieldSchema.description}</p>
              )}
              <div className="space-y-3 pl-2">
                {Object.entries(fieldSchema.properties).map(([nestedKey, nestedSchema]: [string, any]) =>
                  renderSchemaField(nestedKey, nestedSchema, key)
                )}
              </div>
            </div>
          );
        }
        return null;
      
      case 'string':
        if (fieldSchema.enum) {
          return (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>
                {fieldSchema.title || key}
                {fieldSchema.description && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {fieldSchema.description}
                  </span>
                )}
              </Label>
              <select
                id={fullKey}
                value={value}
                onChange={(e) => updateValue(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select...</option>
                {fieldSchema.enum.map((option: string) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          );
        }
        return (
          <div key={fullKey} className="space-y-2">
            <Label htmlFor={fullKey}>
              {fieldSchema.title || key}
              {fieldSchema.description && (
                <span className="text-xs text-muted-foreground ml-2">
                  {fieldSchema.description}
                </span>
              )}
            </Label>
            {fieldSchema.multiline ? (
              <Textarea
                id={fullKey}
                value={value}
                onChange={(e) => updateValue(e.target.value)}
                placeholder={fieldSchema.placeholder}
                className="min-h-[100px]"
              />
            ) : (
              <Input
                id={fullKey}
                value={value}
                onChange={(e) => updateValue(e.target.value)}
                placeholder={fieldSchema.placeholder}
              />
            )}
          </div>
        );
      
      case 'number':
      case 'integer':
        return (
          <div key={fullKey} className="space-y-2">
            <Label htmlFor={fullKey}>
              {fieldSchema.title || key}
              {fieldSchema.description && (
                <span className="text-xs text-muted-foreground ml-2">
                  {fieldSchema.description}
                </span>
              )}
            </Label>
            <Input
              id={fullKey}
              type="number"
              value={value}
              onChange={(e) => updateValue(fieldSchema.type === 'integer' ? parseInt(e.target.value) || 0 : parseFloat(e.target.value) || 0)}
              placeholder={fieldSchema.placeholder}
              min={fieldSchema.minimum}
              max={fieldSchema.maximum}
            />
          </div>
        );
      
      case 'boolean':
        return (
          <div key={fullKey} className="flex items-center space-x-2 py-2">
            <input
              id={fullKey}
              type="checkbox"
              checked={!!value}
              onChange={(e) => updateValue(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor={fullKey} className="cursor-pointer">
              {fieldSchema.title || key}
              {fieldSchema.description && (
                <span className="text-xs text-muted-foreground ml-2">
                  {fieldSchema.description}
                </span>
              )}
            </Label>
          </div>
        );
      
      default:
        return (
          <div key={fullKey} className="space-y-2">
            <Label htmlFor={fullKey}>{fieldSchema.title || key}</Label>
            <Input
              id={fullKey}
              value={typeof value === 'object' ? JSON.stringify(value) : value}
              onChange={(e) => {
                try {
                  updateValue(JSON.parse(e.target.value));
                } catch {
                  updateValue(e.target.value);
                }
              }}
            />
          </div>
        );
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
          <TabsList className="grid w-full flex-shrink-0" style={{ gridTemplateColumns: isMarkdownAsset ? 'repeat(4, 1fr)' : (isTextAsset || isJsonAsset) ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)' }}>
            <TabsTrigger value="view">
              <Eye className="mr-2 h-4 w-4" />
              Current Assets
            </TabsTrigger>
            {(isTextAsset || isJsonAsset) && (
              <TabsTrigger value="edit">
                <FileText className="mr-2 h-4 w-4" />
                Edit Content
              </TabsTrigger>
            )}
            {isMarkdownAsset && (
              <TabsTrigger value="preview">
                <Eye className="mr-2 h-4 w-4" />
                Preview
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

          {(isTextAsset || isJsonAsset) && (
            <TabsContent value="edit" className="mt-0 h-full">
              {loadingContent ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading content...</span>
                </div>
              ) : (
                <div className="space-y-4 pb-4 px-1">
                  {isJsonAsset && asset.schema ? (
                    <>
                      <div className="space-y-4">
                        {Object.entries(asset.schema.properties || {}).map(([key, fieldSchema]: [string, any]) => 
                          renderSchemaField(key, fieldSchema)
                        )}
                      </div>
                    </>
                  ) : (
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
                  )}

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
                    <Button 
                      variant="secondary" 
                      onClick={() => uploadTextContent(true)} 
                      disabled={uploading}
                    >
                      <Package className="mr-2 h-4 w-4" />
                      Save to Batch
                    </Button>
                    <Button onClick={() => uploadTextContent(false)} disabled={uploading}>
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

          {isMarkdownAsset && (
            <TabsContent value="preview" className="mt-0 h-full">
              {loadingContent ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading content...</span>
                </div>
              ) : (
                <div className="pb-4 px-1">
                  <div className="rounded-lg border bg-background p-6">
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{textContent || "*No content to preview*"}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          )}

          <TabsContent value="upload" className="mt-0 h-full">
            <div className="space-y-4 pb-4 px-1">
              {!showConfirmation ? (
                <>
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

                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Eye className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-lg">Preview</h3>
                      </div>
                      
                      {preview && (
                        <>
                          {asset.type === 'image' || file?.type.startsWith('image/') ? (
                            <div className="rounded-lg border bg-background p-4">
                              <img
                                src={preview}
                                alt="Preview"
                                className="max-w-full max-h-96 mx-auto object-contain rounded"
                              />
                            </div>
                          ) : file?.type.startsWith('text/') || file?.name.endsWith('.md') ? (
                            <div className="rounded-lg border bg-background p-4 max-h-96 overflow-auto">
                              <pre className="text-sm whitespace-pre-wrap font-mono">{preview}</pre>
                            </div>
                          ) : null}
                        </>
                      )}

                      <div className="mt-3 pt-3 border-t text-sm space-y-1">
                        <p><span className="font-medium">File:</span> {file?.name}</p>
                        <p><span className="font-medium">Size:</span> {file ? (file.size / 1024).toFixed(2) : 0} KB</p>
                        <p><span className="font-medium">Type:</span> {file?.type || 'Unknown'}</p>
                        {asset.type === 'directory' && (
                          <p className="text-muted-foreground text-xs mt-2">
                            Will be uploaded to: {asset.path}/{file?.name}
                          </p>
                        )}
                      </div>
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

                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setFile(null);
                          setPreview(null);
                          setShowConfirmation(false);
                        }}
                        disabled={uploading}
                      >
                        Back
                      </Button>
                      <Button
                        onClick={handleUpload}
                        disabled={!file || uploading}
                        className="bg-primary"
                      >
                        {uploading ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Confirm & Upload
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </>
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
