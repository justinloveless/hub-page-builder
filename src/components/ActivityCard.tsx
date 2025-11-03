import { GitBranch, FileUp, FileText, UserPlus, Shield, Trash2, ExternalLink, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";

type ActivityLog = Tables<"activity_log">;

interface ActivityCardProps {
  activity: ActivityLog;
  repoFullName: string;
}

const ActivityCard = ({ activity, repoFullName }: ActivityCardProps) => {
  const getActivityIcon = () => {
    const action = activity.action.toLowerCase();
    
    if (action.includes('upload') || action.includes('asset')) {
      return <FileUp className="h-4 w-4 text-primary" />;
    }
    if (action.includes('pr') || action.includes('pull request')) {
      return <GitBranch className="h-4 w-4 text-primary" />;
    }
    if (action.includes('member') || action.includes('invite')) {
      return <UserPlus className="h-4 w-4 text-primary" />;
    }
    if (action.includes('delete') || action.includes('remove')) {
      return <Trash2 className="h-4 w-4 text-primary" />;
    }
    if (action.includes('role') || action.includes('permission')) {
      return <Shield className="h-4 w-4 text-primary" />;
    }
    return <FileText className="h-4 w-4 text-primary" />;
  };

  const getActivityDetails = () => {
    const metadata = activity.metadata as any;
    if (!metadata) return null;

    const details: JSX.Element[] = [];

    // Handle PR-related activities
    if (metadata.pr_url && metadata.pr_number) {
      details.push(
        <a
          key="pr"
          href={metadata.pr_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <GitBranch className="h-3 w-3" />
          Pull Request #{metadata.pr_number}
        </a>
      );
    }

    // Handle commit
    if (metadata.commit_sha) {
      details.push(
        <a
          key="commit"
          href={`https://github.com/${repoFullName}/commit/${metadata.commit_sha}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ExternalLink className="h-3 w-3" />
          Commit {metadata.commit_sha.substring(0, 7)}
        </a>
      );
    }

    // Handle file/asset info
    if (metadata.file_path) {
      details.push(
        <div key="file" className="flex items-center gap-1 text-sm text-muted-foreground">
          <FileText className="h-3 w-3" />
          <span className="font-mono text-xs truncate">{metadata.file_path}</span>
        </div>
      );
    }

    if (metadata.file_name) {
      details.push(
        <div key="filename" className="flex items-center gap-1 text-sm text-muted-foreground">
          <FileText className="h-3 w-3" />
          <span className="font-mono text-xs">{metadata.file_name}</span>
        </div>
      );
    }

    // Handle asset count
    if (metadata.asset_count) {
      details.push(
        <Badge key="count" variant="secondary" className="text-xs">
          <Upload className="h-3 w-3 mr-1" />
          {metadata.asset_count} {metadata.asset_count === 1 ? 'file' : 'files'}
        </Badge>
      );
    }

    // Handle user email for invitations
    if (metadata.email) {
      details.push(
        <div key="email" className="text-sm text-muted-foreground">
          Sent to: <span className="font-medium">{metadata.email}</span>
        </div>
      );
    }

    // Handle role changes
    if (metadata.role) {
      details.push(
        <Badge key="role" variant="outline" className="text-xs">
          <Shield className="h-3 w-3 mr-1" />
          {metadata.role}
        </Badge>
      );
    }

    return details.length > 0 ? (
      <div className="flex flex-wrap gap-2 mt-2">
        {details}
      </div>
    ) : null;
  };

  return (
    <div className="flex gap-3 p-4 border border-border rounded-lg hover:bg-accent/5 transition-colors">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        {getActivityIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm break-words">{activity.action}</p>
        {getActivityDetails()}
        <p className="text-xs text-muted-foreground mt-2">
          {new Date(activity.created_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
};

export default ActivityCard;
