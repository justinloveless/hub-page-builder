import type { PendingAssetChange } from "@/pages/Manage";

interface FileChange {
  path: string;
  isNew?: boolean;
  isDeleted?: boolean;
  isModified?: boolean;
}

/**
 * Generates a descriptive commit message based on file changes
 */
export function generateCommitMessage(changes: PendingAssetChange[]): string {
  if (changes.length === 0) {
    return "Update files";
  }

  // Categorize changes
  const newFiles = changes.filter(c => !c.originalContent);
  const modifiedFiles = changes.filter(c => c.originalContent);
  
  // Count file types
  const fileTypes: Record<string, number> = {};
  changes.forEach(change => {
    const ext = change.fileName.split('.').pop()?.toLowerCase() || 'file';
    fileTypes[ext] = (fileTypes[ext] || 0) + 1;
  });

  // Generate message based on the nature of changes
  if (changes.length === 1) {
    const change = changes[0];
    const action = !change.originalContent ? "Add" : "Update";
    return `${action} ${change.fileName}`;
  }

  // Multiple files
  const parts: string[] = [];
  
  if (newFiles.length > 0 && modifiedFiles.length === 0) {
    // All new files
    if (newFiles.length <= 3) {
      return `Add ${newFiles.map(f => f.fileName).join(', ')}`;
    } else {
      const primaryType = Object.entries(fileTypes).sort((a, b) => b[1] - a[1])[0];
      return `Add ${newFiles.length} ${getPrettyFileType(primaryType[0])} files`;
    }
  }

  if (modifiedFiles.length > 0 && newFiles.length === 0) {
    // All modifications
    if (modifiedFiles.length <= 3) {
      return `Update ${modifiedFiles.map(f => f.fileName).join(', ')}`;
    } else {
      const primaryType = Object.entries(fileTypes).sort((a, b) => b[1] - a[1])[0];
      return `Update ${modifiedFiles.length} ${getPrettyFileType(primaryType[0])} files`;
    }
  }

  // Mix of new and modified
  if (newFiles.length > 0) {
    parts.push(`Add ${newFiles.length} file${newFiles.length > 1 ? 's' : ''}`);
  }
  if (modifiedFiles.length > 0) {
    parts.push(`update ${modifiedFiles.length} file${modifiedFiles.length > 1 ? 's' : ''}`);
  }

  return parts.join(' and ');
}

/**
 * Generates a more detailed commit message with file list
 */
export function generateDetailedCommitMessage(changes: PendingAssetChange[]): string {
  const baseMessage = generateCommitMessage(changes);
  
  if (changes.length <= 5) {
    const fileList = changes.map(c => {
      const action = !c.originalContent ? '+ ' : '* ';
      return `${action}${c.repoPath}`;
    }).join('\n');
    
    return `${baseMessage}\n\n${fileList}`;
  }
  
  return baseMessage;
}

/**
 * Generates commit message suggestions for user to choose from
 */
export function generateCommitMessageSuggestions(changes: PendingAssetChange[]): string[] {
  const suggestions: string[] = [];
  
  // Primary suggestion - descriptive
  suggestions.push(generateCommitMessage(changes));
  
  // Secondary suggestions based on context
  const fileTypes: Record<string, number> = {};
  changes.forEach(change => {
    const ext = change.fileName.split('.').pop()?.toLowerCase() || 'file';
    fileTypes[ext] = (fileTypes[ext] || 0) + 1;
  });

  const hasImages = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].some(ext => fileTypes[ext]);
  const hasStyles = ['css', 'scss', 'sass'].some(ext => fileTypes[ext]);
  const hasScripts = ['js', 'ts', 'jsx', 'tsx'].some(ext => fileTypes[ext]);
  const hasMarkup = ['html', 'htm'].some(ext => fileTypes[ext]);
  const hasData = ['json', 'yaml', 'yml', 'xml'].some(ext => fileTypes[ext]);

  if (hasImages) {
    suggestions.push("Update images and assets");
  }
  if (hasStyles) {
    suggestions.push("Update styles");
  }
  if (hasScripts) {
    suggestions.push("Update scripts and functionality");
  }
  if (hasMarkup) {
    suggestions.push("Update page content");
  }
  if (hasData) {
    suggestions.push("Update configuration");
  }

  // Check if changes are in same directory
  const directories = new Set(changes.map(c => {
    const parts = c.repoPath.split('/');
    return parts.length > 1 ? parts[0] : '';
  }));

  if (directories.size === 1 && [...directories][0]) {
    const dir = [...directories][0];
    suggestions.push(`Update ${dir} directory`);
  }

  // Generic fallbacks
  suggestions.push(`Update ${changes.length} ${changes.length === 1 ? 'file' : 'files'}`);
  
  // Remove duplicates and return up to 4 suggestions
  return [...new Set(suggestions)].slice(0, 4);
}

function getPrettyFileType(ext: string): string {
  const typeMap: Record<string, string> = {
    'js': 'JavaScript',
    'ts': 'TypeScript',
    'jsx': 'React',
    'tsx': 'React',
    'css': 'style',
    'scss': 'style',
    'sass': 'style',
    'html': 'HTML',
    'htm': 'HTML',
    'json': 'config',
    'yaml': 'config',
    'yml': 'config',
    'md': 'documentation',
    'txt': 'text',
    'png': 'image',
    'jpg': 'image',
    'jpeg': 'image',
    'gif': 'image',
    'svg': 'image',
    'webp': 'image',
  };

  return typeMap[ext] || ext;
}

