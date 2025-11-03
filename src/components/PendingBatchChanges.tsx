import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, GitCommit, Trash2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PendingAssetChange } from "@/pages/Manage";

interface PendingBatchChangesProps {
  siteId: string;
  pendingChanges: PendingAssetChange[];
  setPendingChanges: (changes: PendingAssetChange[]) => void;
  onRefresh?: () => void;
}

const PendingBatchChanges = ({ siteId, pendingChanges, setPendingChanges, onRefresh }: PendingBatchChangesProps) => {
  const [isCommitting, setIsCommitting] = useState(false);
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");

  const handleCommitAll = async () => {
    if (!commitMessage.trim()) {
      toast.error("Please enter a commit message");
      return;
    }

    try {
      setIsCommitting(true);
      
      const assetChanges = pendingChanges.map(change => ({
        repo_path: change.repoPath,
        content: change.content
      }));

      const { data, error } = await supabase.functions.invoke('commit-batch-changes', {
        body: {
          site_id: siteId,
          commit_message: commitMessage,
          asset_changes: assetChanges
        }
      });

      if (error) throw error;

      toast.success(data.message || 'All changes committed successfully');
      setPendingChanges([]);
      setCommitMessage("");
      if (onRefresh) onRefresh();
    } catch (error: any) {
      console.error('Error committing changes:', error);
      toast.error(error.message || 'Failed to commit changes');
    } finally {
      setIsCommitting(false);
      setShowCommitDialog(false);
    }
  };

  const handleClearAll = () => {
    setPendingChanges([]);
    toast.success('All pending changes cleared');
    setShowClearDialog(false);
  };

  const handleRemoveChange = (repoPath: string) => {
    setPendingChanges(pendingChanges.filter(c => c.repoPath !== repoPath));
    toast.success('Change removed');
  };

  if (pendingChanges.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pending Batch Changes
          </CardTitle>
          <CardDescription>No pending changes to commit.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No pending changes to commit.</p>
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
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Pending Batch Changes
              </CardTitle>
              <CardDescription>
                <Badge variant="secondary">{pendingChanges.length} {pendingChanges.length === 1 ? 'change' : 'changes'}</Badge>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {pendingChanges.map((change, index) => (
              <div key={change.repoPath}>
                <div className="flex items-start justify-between py-2">
                  <div className="space-y-1 flex-1">
                    <p className="text-sm font-medium">{change.repoPath}</p>
                    <p className="text-xs text-muted-foreground">{change.fileName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Pending</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveChange(change.repoPath)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {index < pendingChanges.length - 1 && <Separator />}
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => setShowClearDialog(true)}
              variant="outline"
              size="sm"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
            <Button
              onClick={() => setShowCommitDialog(true)}
              size="sm"
              disabled={isCommitting}
              className="ml-auto"
            >
              <GitCommit className="h-4 w-4 mr-2" />
              Commit All
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showCommitDialog} onOpenChange={setShowCommitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Commit All Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              This will commit {pendingChanges.length} pending {pendingChanges.length === 1 ? 'change' : 'changes'} to your repository.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="commit-message">Commit Message</Label>
            <Input
              id="commit-message"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Describe your changes..."
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCommitAll} disabled={isCommitting || !commitMessage.trim()}>
              {isCommitting ? "Committing..." : "Commit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all {pendingChanges.length} pending {pendingChanges.length === 1 ? 'change' : 'changes'} without committing them. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PendingBatchChanges;
