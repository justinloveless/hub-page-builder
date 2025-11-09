import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, Plus, PackagePlus, X, AlertCircle } from "lucide-react";

interface SubmitTemplateDialogProps {
    onTemplateAdded?: () => void;
}

const COMMON_TAGS = [
    "blog",
    "portfolio",
    "landing-page",
    "documentation",
    "e-commerce",
    "dashboard",
    "marketing",
    "business",
    "personal",
    "creative",
];

const SubmitTemplateDialog = ({ onTemplateAdded }: SubmitTemplateDialogProps) => {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        repoFullName: "",
        previewImageUrl: "",
    });
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [customTag, setCustomTag] = useState("");
    const [checkingInstallations, setCheckingInstallations] = useState(false);
    const [hasGithubInstallation, setHasGithubInstallation] = useState<boolean | null>(null);
    const [installationCheckError, setInstallationCheckError] = useState<string | null>(null);

    const handleToggleTag = (tag: string) => {
        if (selectedTags.includes(tag)) {
            setSelectedTags(selectedTags.filter(t => t !== tag));
        } else {
            setSelectedTags([...selectedTags, tag]);
        }
    };

    const handleAddCustomTag = () => {
        const trimmedTag = customTag.trim().toLowerCase();
        if (trimmedTag && !selectedTags.includes(trimmedTag)) {
            setSelectedTags([...selectedTags, trimmedTag]);
            setCustomTag("");
        }
    };

    const handleRemoveTag = (tag: string) => {
        setSelectedTags(selectedTags.filter(t => t !== tag));
    };

    const checkGithubInstallations = useCallback(async () => {
        setCheckingInstallations(true);
        setInstallationCheckError(null);

        try {
            const { data, error } = await supabase.functions.invoke('list-github-installations');
            if (error) throw error;

            const installations = data?.installations || [];
            setHasGithubInstallation(installations.length > 0);
        } catch (error: any) {
            console.error("Error checking GitHub installations:", error);
            setHasGithubInstallation(null);
            setInstallationCheckError(error.message || "Unable to verify GitHub App installations.");
        } finally {
            setCheckingInstallations(false);
        }
    }, []);

    useEffect(() => {
        if (open) {
            checkGithubInstallations();
        } else {
            setHasGithubInstallation(null);
            setInstallationCheckError(null);
        }
    }, [open, checkGithubInstallations]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");

            // Validate repo format
            if (!formData.repoFullName.match(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/)) {
                throw new Error("Invalid repository format. Use: owner/repo-name");
            }

            // Call the edge function to submit template
            const { data, error } = await supabase.functions.invoke('submit-template', {
                body: {
                    name: formData.name,
                    description: formData.description,
                    repo_full_name: formData.repoFullName,
                    tags: selectedTags,
                    preview_image_url: formData.previewImageUrl || null,
                },
            });

            if (error) throw error;
            if (!data?.template) throw new Error("Failed to add template");

            toast.success("Template added successfully!");
            setOpen(false);

            // Reset form
            setFormData({
                name: "",
                description: "",
                repoFullName: "",
                previewImageUrl: "",
            });
            setSelectedTags([]);

            if (onTemplateAdded) {
                onTemplateAdded();
            }
        } catch (error: any) {
            console.error("Error adding template:", error);
            toast.error(error.message || "Failed to add template");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <PackagePlus className="mr-2 h-4 w-4" />
                    Add Template
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add Template</DialogTitle>
                    <DialogDescription>
                        Share a GitHub template repository that others can use to create new sites
                    </DialogDescription>
                </DialogHeader>

                {installationCheckError && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Unable to check GitHub App installations</AlertTitle>
                        <AlertDescription>{installationCheckError}</AlertDescription>
                    </Alert>
                )}

                {!installationCheckError && !checkingInstallations && hasGithubInstallation === false && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>No GitHub App installation found</AlertTitle>
                        <AlertDescription className="space-y-2">
                            <p>
                                Install the GitHub App before submitting a template. You can install or refresh installations from the Add Site dialog.
                            </p>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={checkGithubInstallations}
                            >
                                Refresh status
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Template Name *</Label>
                            <Input
                                id="name"
                                placeholder="Modern Blog Template"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description *</Label>
                            <Textarea
                                id="description"
                                placeholder="A modern, responsive blog template with dark mode support..."
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={3}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="repo">GitHub Repository *</Label>
                            <Input
                                id="repo"
                                placeholder="username/template-repo"
                                value={formData.repoFullName}
                                onChange={(e) => setFormData({ ...formData, repoFullName: e.target.value })}
                                required
                            />
                            <p className="text-xs text-muted-foreground">
                                Format: owner/repo-name (must be marked as a template on GitHub)
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="preview">Preview Image URL (optional)</Label>
                            <Input
                                id="preview"
                                placeholder="https://example.com/preview.png"
                                value={formData.previewImageUrl}
                                onChange={(e) => setFormData({ ...formData, previewImageUrl: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Tags</Label>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {COMMON_TAGS.map((tag) => (
                                    <Badge
                                        key={tag}
                                        variant={selectedTags.includes(tag) ? "default" : "outline"}
                                        className="cursor-pointer"
                                        onClick={() => handleToggleTag(tag)}
                                    >
                                        {tag}
                                    </Badge>
                                ))}
                            </div>

                            {selectedTags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                    <Label className="text-sm">Selected:</Label>
                                    {selectedTags.map((tag) => (
                                        <Badge key={tag} variant="secondary" className="gap-1">
                                            {tag}
                                            <X
                                                className="h-3 w-3 cursor-pointer"
                                                onClick={() => handleRemoveTag(tag)}
                                            />
                                        </Badge>
                                    ))}
                                </div>
                            )}

                            <div className="flex gap-2">
                                <Input
                                    placeholder="Add custom tag..."
                                    value={customTag}
                                    onChange={(e) => setCustomTag(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddCustomTag();
                                        }
                                    }}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={handleAddCustomTag}
                                    disabled={!customTag.trim()}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Add Template
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default SubmitTemplateDialog;

