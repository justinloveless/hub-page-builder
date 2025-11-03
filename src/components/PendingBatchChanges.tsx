import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, GitCommit, Trash2, FileText, ChevronDown, ChevronRight } from "lucide-react";
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
  const [expandedChanges, setExpandedChanges] = useState<Set<string>>(new Set());

  const toggleExpanded = (repoPath: string) => {
    const newExpanded = new Set(expandedChanges);
    if (newExpanded.has(repoPath)) {
      newExpanded.delete(repoPath);
    } else {
      newExpanded.add(repoPath);
    }
    setExpandedChanges(newExpanded);
  };

  const decodeContent = (base64Content: string): string => {
    try {
      return decodeURIComponent(escape(atob(base64Content)));
    } catch (error) {
      console.error("Failed to decode content:", error);
      return "";
    }
  };

  const renderDiff = (change: PendingAssetChange) => {
    const newContent = decodeContent(change.content);
    const oldContent = change.originalContent ? decodeContent(change.originalContent) : "";

    if (!oldContent) {
      return (
        <div className="bg-muted/50 rounded-md p-4 max-h-96 overflow-auto">
          <div className="text-xs text-muted-foreground mb-2">New file</div>
          <pre className="text-sm font-mono whitespace-pre-wrap text-green-600 dark:text-green-400">
            {newContent.split('\n').map((line, i) => (
              <div key={i} className="hover:bg-accent/50">
                <span className="inline-block w-12 text-right pr-4 select-none text-muted-foreground">{i + 1}</span>
                <span className="before:content-['+_'] before:text-green-600 dark:before:text-green-400">{line}</span>
              </div>
            ))}
          </pre>
        </div>
      );
    }

    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const maxLines = Math.max(oldLines.length, newLines.length);

    return (
      <div className="bg-muted/50 rounded-md p-4 max-h-96 overflow-auto">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-muted-foreground mb-2 font-semibold">Original</div>
            <pre className="text-sm font-mono whitespace-pre-wrap">
              {oldLines.map((line, i) => {
                const isChanged = newLines[i] !== line;
                return (
                  <div 
                    key={i} 
                    className={`hover:bg-accent/50 ${isChanged ? 'bg-red-500/10' : ''}`}
                  >
                    <span className="inline-block w-12 text-right pr-4 select-none text-muted-foreground">{i + 1}</span>
                    <span className={isChanged ? 'text-red-600 dark:text-red-400 line-through' : ''}>{line}</span>
                  </div>
                );
              })}
            </pre>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-2 font-semibold">New</div>
            <pre className="text-sm font-mono whitespace-pre-wrap">
              {newLines.map((line, i) => {
                const isChanged = oldLines[i] !== line;
                return (
                  <div 
                    key={i} 
                    className={`hover:bg-accent/50 ${isChanged ? 'bg-green-500/10' : ''}`}
                  >
                    <span className="inline-block w-12 text-right pr-4 select-none text-muted-foreground">{i + 1}</span>
                    <span className={isChanged ? 'text-green-600 dark:text-green-400' : ''}>{line}</span>
                  </div>
                );
              })}
            </pre>
          </div>
        </div>
      </div>
    );
  };

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
      setExpandedChanges(new Set());
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
    setExpandedChanges(new Set());
    toast.success('All pending changes cleared');
    setShowClearDialog(false);
  };

  const handleRemoveChange = (repoPath: string) => {
    setPendingChanges(pendingChanges.filter(c => c.repoPath !== repoPath));
    const newExpanded = new Set(expandedChanges);
    newExpanded.delete(repoPath);
    setExpandedChanges(newExpanded);
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
            {pendingChanges.map((change, index) => {
              const isExpanded = expandedChanges.has(change.repoPath);
              
              return (
                <div key={change.repoPath}>
                  <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(change.repoPath)}>
                    <div className="flex items-start justify-between py-2">
                      <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left hover:bg-accent/50 rounded px-2 py-1 transition-colors">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="space-y-1 flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{change.repoPath}</p>
                          <p className="text-xs text-muted-foreground">{change.fileName}</p>
                        </div>
                      </CollapsibleTrigger>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <Badge variant="outline">Pending</Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveChange(change.repoPath);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CollapsibleContent className="px-2 pb-2">
                      {renderDiff(change)}
                    </CollapsibleContent>
                  </Collapsible>
                  {index < pendingChanges.length - 1 && <Separator />}
                </div>
              );
            })}
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
