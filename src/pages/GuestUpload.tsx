import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Upload, CheckCircle2, AlertCircle, FileUp } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type AssetShare = Tables<"asset_shares"> & {
  sites: Tables<"sites">;
};

const GuestUpload = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [share, setShare] = useState<AssetShare | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    loadShareDetails();
  }, [token]);

  const loadShareDetails = async () => {
    if (!token) {
      setError("Invalid share link");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("asset_shares")
        .select("*, sites(*)")
        .eq("token", token)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setError("Share link not found");
        setLoading(false);
        return;
      }

      // Check if expired
      if (new Date(data.expires_at) < new Date()) {
        setError("This share link has expired");
        setLoading(false);
        return;
      }

      // Check upload limit
      if (data.max_uploads && data.upload_count >= data.max_uploads) {
        setError("Upload limit reached for this share link");
        setLoading(false);
        return;
      }

      setShare(data as AssetShare);
    } catch (error: any) {
      console.error("Error loading share:", error);
      setError("Failed to load share details");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file extension if restrictions exist
    if (share?.allowed_extensions && share.allowed_extensions.length > 0) {
      const fileExt = `.${file.name.split('.').pop()?.toLowerCase()}`;
      if (!share.allowed_extensions.includes(fileExt)) {
        toast.error(`File type not allowed. Allowed types: ${share.allowed_extensions.join(', ')}`);
        return;
      }
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !token) return;

    setUploading(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      const fileContentPromise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(selectedFile);
      });

      const fileContent = await fileContentPromise;

      const { data, error } = await supabase.functions.invoke('guest-upload-asset', {
        body: {
          token,
          file_content: fileContent,
          file_name: selectedFile.name,
        },
      });

      if (error) throw error;

      setUploadSuccess(true);
      toast.success("File uploaded successfully!");
      setSelectedFile(null);
      
      // Reload share details to update upload count
      await loadShareDetails();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="w-full mt-4"
            >
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Upload Files
          </CardTitle>
          <CardDescription>
            {share?.description || "Upload files to the shared location"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {uploadSuccess && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Your file was uploaded successfully!
              </AlertDescription>
            </Alert>
          )}

          <div>
            <Label className="text-sm font-medium">Site</Label>
            <p className="text-sm text-muted-foreground">{share?.sites.name}</p>
          </div>

          <div>
            <Label className="text-sm font-medium">Upload Location</Label>
            <p className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded mt-1">
              {share?.asset_path}
            </p>
          </div>

          {share?.allowed_extensions && share.allowed_extensions.length > 0 && (
            <div>
              <Label className="text-sm font-medium">Allowed File Types</Label>
              <p className="text-sm text-muted-foreground">
                {share.allowed_extensions.join(', ')}
              </p>
            </div>
          )}

          <div>
            <Label className="text-sm font-medium">Upload Status</Label>
            <p className="text-sm text-muted-foreground">
              {share?.max_uploads 
                ? `${share.upload_count} / ${share.max_uploads} uploads used`
                : `${share?.upload_count || 0} uploads`
              }
            </p>
          </div>

          <div>
            <Label className="text-sm font-medium">Expires</Label>
            <p className="text-sm text-muted-foreground">
              {new Date(share?.expires_at || '').toLocaleString()}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Select File</Label>
            <Input
              id="file"
              type="file"
              onChange={handleFileSelect}
              disabled={uploading}
              accept={share?.allowed_extensions?.join(',') || undefined}
            />
          </div>

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Upload className="mr-2 h-4 w-4 animate-pulse" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload File
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default GuestUpload;
