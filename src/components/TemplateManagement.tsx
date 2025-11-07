import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2, Search, X, Plus } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Template = Tables<"templates">;

interface TemplateWithProfile extends Template {
    profiles?: {
        id: string;
        full_name: string | null;
        avatar_url: string | null;
    } | null;
}

const TemplateManagement = () => {
    const [templates, setTemplates] = useState<TemplateWithProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);

    // Edit dialog state
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
    const [editFormData, setEditFormData] = useState({
        name: "",
        description: "",
        repo_full_name: "",
        preview_image_url: "",
        tags: [] as string[],
    });
    const [customTag, setCustomTag] = useState("");
    const [saving, setSaving] = useState(false);

    // Delete dialog state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingTemplate, setDeletingTemplate] = useState<Template | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('list-templates');

            if (error) throw error;
            setTemplates(data?.templates || []);
        } catch (error: any) {
            console.error('Error loading templates:', error);
            toast.error("Failed to load templates");
        } finally {
            setLoading(false);
        }
    };

    const handleEditTemplate = (template: Template) => {
        setEditingTemplate(template);
        setEditFormData({
            name: template.name,
            description: template.description,
            repo_full_name: template.repo_full_name,
            preview_image_url: template.preview_image_url || "",
            tags: [...template.tags],
        });
        setEditDialogOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!editingTemplate) return;

        setSaving(true);
        try {
            const { data, error } = await supabase.functions.invoke('update-template', {
                body: {
                    template_id: editingTemplate.id,
                    name: editFormData.name,
                    description: editFormData.description,
                    repo_full_name: editFormData.repo_full_name,
                    preview_image_url: editFormData.preview_image_url || null,
                    tags: editFormData.tags,
                },
            });

            if (error) throw error;

            toast.success("Template updated successfully");
            setEditDialogOpen(false);
            setEditingTemplate(null);
            loadTemplates();
        } catch (error: any) {
            console.error('Error updating template:', error);
            toast.error(error.message || "Failed to update template");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteTemplate = (template: Template) => {
        setDeletingTemplate(template);
        setDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!deletingTemplate) return;

        setDeleting(true);
        try {
            const { error } = await supabase.functions.invoke('delete-template', {
                body: {
                    template_id: deletingTemplate.id,
                },
            });

            if (error) throw error;

            toast.success("Template deleted successfully");
            setDeleteDialogOpen(false);
            setDeletingTemplate(null);
            loadTemplates();
        } catch (error: any) {
            console.error('Error deleting template:', error);
            toast.error(error.message || "Failed to delete template");
        } finally {
            setDeleting(false);
        }
    };

    const handleAddTag = () => {
        const trimmedTag = customTag.trim().toLowerCase();
        if (trimmedTag && !editFormData.tags.includes(trimmedTag)) {
            setEditFormData({
                ...editFormData,
                tags: [...editFormData.tags, trimmedTag],
            });
            setCustomTag("");
        }
    };

    const handleRemoveTag = (tag: string) => {
        setEditFormData({
            ...editFormData,
            tags: editFormData.tags.filter(t => t !== tag),
        });
    };

    // Filter templates
    const filteredTemplates = templates.filter(template => {
        const matchesSearch = !searchQuery ||
            template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            template.description.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesTag = !selectedTagFilter || template.tags.includes(selectedTagFilter);

        return matchesSearch && matchesTag;
    });

    // Get unique tags
    const allTags = Array.from(new Set(templates.flatMap(t => t.tags))).sort();

    if (loading) {
        return (
            <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading templates...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Template Management</h3>
                    <p className="text-sm text-muted-foreground">
                        {templates.length} {templates.length === 1 ? 'template' : 'templates'} available
                    </p>
                </div>
                <Button onClick={loadTemplates} variant="outline" size="sm">
                    Refresh
                </Button>
            </div>

            {/* Search and Filters */}
            <div className="space-y-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search templates..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>

                {allTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        <Badge
                            variant={selectedTagFilter === null ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => setSelectedTagFilter(null)}
                        >
                            All
                        </Badge>
                        {allTags.map((tag) => (
                            <Badge
                                key={tag}
                                variant={selectedTagFilter === tag ? "default" : "outline"}
                                className="cursor-pointer"
                                onClick={() => setSelectedTagFilter(tag)}
                            >
                                {tag}
                            </Badge>
                        ))}
                    </div>
                )}
            </div>

            {/* Templates Grid */}
            {filteredTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    <p>No templates found.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTemplates.map((template) => (
                        <Card key={template.id}>
                            {template.preview_image_url && (
                                <div className="aspect-video w-full overflow-hidden rounded-t-lg">
                                    <img
                                        src={template.preview_image_url}
                                        alt={template.name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            )}
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm">{template.name}</CardTitle>
                                <CardDescription className="text-xs line-clamp-2">
                                    {template.description}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="flex flex-wrap gap-1">
                                    {template.tags.map((tag) => (
                                        <Badge key={tag} variant="secondary" className="text-xs">
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    By: {template.profiles?.full_name || 'Anonymous'}
                                </p>
                                <p className="text-xs text-muted-foreground font-mono">
                                    {template.repo_full_name}
                                </p>
                            </CardContent>
                            <CardFooter className="flex gap-2 pt-3 border-t">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => handleEditTemplate(template)}
                                >
                                    <Pencil className="mr-2 h-3 w-3" />
                                    Edit
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeleteTemplate(template)}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Template</DialogTitle>
                        <DialogDescription>
                            Update template information
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Template Name *</Label>
                            <Input
                                id="edit-name"
                                value={editFormData.name}
                                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-description">Description *</Label>
                            <Textarea
                                id="edit-description"
                                value={editFormData.description}
                                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                                rows={3}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-repo">GitHub Repository *</Label>
                            <Input
                                id="edit-repo"
                                value={editFormData.repo_full_name}
                                onChange={(e) => setEditFormData({ ...editFormData, repo_full_name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-preview">Preview Image URL</Label>
                            <Input
                                id="edit-preview"
                                value={editFormData.preview_image_url}
                                onChange={(e) => setEditFormData({ ...editFormData, preview_image_url: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Tags</Label>
                            {editFormData.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {editFormData.tags.map((tag) => (
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
                                    placeholder="Add tag..."
                                    value={customTag}
                                    onChange={(e) => setCustomTag(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddTag();
                                        }
                                    }}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={handleAddTag}
                                    disabled={!customTag.trim()}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setEditDialogOpen(false)}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleSaveEdit} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Template?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{deletingTemplate?.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default TemplateManagement;

