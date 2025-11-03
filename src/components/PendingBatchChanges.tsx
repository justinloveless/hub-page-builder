import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GitCommit, Trash2, RefreshCw, Package, FileText } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface PendingBatchChangesProps {
  siteId: string;
  onRefresh?: () => void;
}

interface BatchChange {
  id: string;
  repo_path: string;
  storage_path: string;
  created_at: string;
  file_size_bytes: number;
}

const PendingBatchChanges = ({ siteId, onRefresh }: PendingBatchChangesProps) => {
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [changes, setChanges] = useState<BatchChange[]>([]);
  const [commitMessage, setCommitMessage] = useState("Update multiple assets");
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);

  useEffect(() => {
    fetchPendingChanges();
  }, [siteId]);

  const fetchPendingChanges = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("asset_versions")
        .select("*")
        .eq("site_id", siteId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setChanges(data || []);
    } catch (error: any) {
      console.error("Failed to fetch pending changes:", error);
      toast.error("Failed to load pending changes");
    } finally {
      setLoading(false);
    }
  };

  const handleCommitAll = async () => {
    if (!commitMessage.trim()) {
      toast.error("Please enter a commit message");
      return;
    }

    setCommitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('commit-batch-changes', {
        body: {
          site_id: siteId,
          commit_message: commitMessage,
        },
      });

      if (error) throw error;

      toast.success(`Successfully committed ${changes.length} change(s)!`);
      setCommitMessage("Update multiple assets");
      setShowCommitDialog(false);
      await fetchPendingChanges();
      onRefresh?.();
    } catch (error: any) {
      console.error("Failed to commit changes:", error);
      toast.error(error.message || "Failed to commit changes");
    } finally {
      setCommitting(false);
    }
  };

  const handleClearBatch = async () => {
    setClearing(true);
    try {
      const { error } = await supabase
        .from("asset_versions")
        .delete()
        .eq("site_id", siteId)
        .eq("status", "pending");

      if (error) throw error;

      toast.success("Batch cleared successfully");
      setShowClearDialog(false);
      await fetchPendingChanges();
    } catch (error: any) {
      console.error("Failed to clear batch:", error);
      toast.error(error.message || "Failed to clear batch");
    } finally {
      setClearing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Changes</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (changes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pending Changes</CardTitle>
              <CardDescription>No pending changes to commit</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchPendingChanges}
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No pending changes</p>
            <p className="text-sm mt-1">Save changes to assets without committing to stage them here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pending Changes</CardTitle>
              <CardDescription>
                {changes.length} change{changes.length !== 1 ? 's' : ''} ready to commit
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchPendingChanges}
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowClearDialog(true)}
                disabled={clearing}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
              <Button
                size="sm"
                onClick={() => setShowCommitDialog(true)}
                disabled={committing}
              >
                <GitCommit className="h-4 w-4 mr-2" />
                Commit All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {changes.map((change) => (
              <div
                key={change.id}
                className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{change.repo_path}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatFileSize(change.file_size_bytes)}</span>
                    <span>•</span>
                    <span>{formatDate(change.created_at)}</span>
                  </div>
                </div>
                <Badge variant="secondary" className="flex-shrink-0">
                  Staged
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showCommitDialog} onOpenChange={setShowCommitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Commit All Changes</AlertDialogTitle>
            <AlertDialogDescription>
              This will commit {changes.length} change{changes.length !== 1 ? 's' : ''} to the repository.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="commit-message">Commit Message</Label>
            <Input
              id="commit-message"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Update multiple assets"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCommitAll} disabled={committing}>
              {committing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Committing...
                </>
              ) : (
                <>
                  <GitCommit className="mr-2 h-4 w-4" />
                  Commit
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Pending Changes</AlertDialogTitle>
            <AlertDialogDescription>
              This will discard all {changes.length} pending change{changes.length !== 1 ? 's' : ''} without committing them. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleClearBatch} 
              disabled={clearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear Batch
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PendingBatchChanges;
