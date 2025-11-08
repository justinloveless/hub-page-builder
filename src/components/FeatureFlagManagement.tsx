import { useState } from 'react';
import { useFeatureFlags } from '@/contexts/FeatureFlagContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type FeatureFlag = Tables<'feature_flags'>;

interface FlagFormData {
  flag_key: string;
  name: string;
  description: string;
  enabled: boolean;
  rollout_percentage: number;
}

export function FeatureFlagManagement() {
  const { flags, refreshFlags, isLoading } = useFeatureFlags();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [formData, setFormData] = useState<FlagFormData>({
    flag_key: '',
    name: '',
    description: '',
    enabled: false,
    rollout_percentage: 100,
  });

  const resetForm = () => {
    setFormData({
      flag_key: '',
      name: '',
      description: '',
      enabled: false,
      rollout_percentage: 100,
    });
    setEditingFlag(null);
  };

  const handleCreate = async () => {
    try {
      const { error } = await supabase
        .from('feature_flags')
        .insert([formData]);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Feature flag created successfully',
      });

      setIsCreateDialogOpen(false);
      resetForm();
      await refreshFlags();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create feature flag',
        variant: 'destructive',
      });
    }
  };

  const handleUpdate = async (flag: FeatureFlag) => {
    try {
      const { error } = await supabase
        .from('feature_flags')
        .update({
          name: formData.name,
          description: formData.description,
          enabled: formData.enabled,
          rollout_percentage: formData.rollout_percentage,
        })
        .eq('id', flag.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Feature flag updated successfully',
      });

      setEditingFlag(null);
      resetForm();
      await refreshFlags();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update feature flag',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (flagId: string) => {
    if (!confirm('Are you sure you want to delete this feature flag?')) return;

    try {
      const { error } = await supabase
        .from('feature_flags')
        .delete()
        .eq('id', flagId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Feature flag deleted successfully',
      });

      await refreshFlags();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete feature flag',
        variant: 'destructive',
      });
    }
  };

  const handleToggle = async (flag: FeatureFlag) => {
    try {
      const { error } = await supabase
        .from('feature_flags')
        .update({ enabled: !flag.enabled })
        .eq('id', flag.id);

      if (error) throw error;

      await refreshFlags();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to toggle feature flag',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (flag: FeatureFlag) => {
    setFormData({
      flag_key: flag.flag_key,
      name: flag.name,
      description: flag.description || '',
      enabled: flag.enabled,
      rollout_percentage: flag.rollout_percentage,
    });
    setEditingFlag(flag);
  };

  const flagsArray = Object.values(flags);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Feature Flags</h2>
          <p className="text-muted-foreground">Manage feature flags for your application</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={refreshFlags} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Create Flag
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Feature Flag</DialogTitle>
                <DialogDescription>
                  Add a new feature flag to control features in your application.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="flag_key">Flag Key</Label>
                  <Input
                    id="flag_key"
                    placeholder="my_feature_flag"
                    value={formData.flag_key}
                    onChange={(e) => setFormData({ ...formData, flag_key: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Unique identifier used in code (e.g., "new_dashboard")
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="My Feature Flag"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="What does this flag control?"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rollout_percentage">Rollout Percentage</Label>
                  <Input
                    id="rollout_percentage"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.rollout_percentage}
                    onChange={(e) => setFormData({ ...formData, rollout_percentage: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Percentage of users who will see this feature (0-100)
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enabled"
                    checked={formData.enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                  />
                  <Label htmlFor="enabled">Enabled</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {flagsArray.map((flag) => (
          <Card key={flag.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{flag.name}</CardTitle>
                  <CardDescription className="font-mono text-xs mt-1">
                    {flag.flag_key}
                  </CardDescription>
                </div>
                <Switch
                  checked={flag.enabled}
                  onCheckedChange={() => handleToggle(flag)}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {flag.description && (
                <p className="text-sm text-muted-foreground">{flag.description}</p>
              )}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rollout:</span>
                  <span className="font-medium">{flag.rollout_percentage}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${flag.rollout_percentage}%` }}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => openEditDialog(flag)}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(flag.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {flagsArray.length === 0 && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No feature flags yet</p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Flag
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingFlag} onOpenChange={(open) => !open && setEditingFlag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Feature Flag</DialogTitle>
            <DialogDescription>
              Update the settings for this feature flag.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit_flag_key">Flag Key</Label>
              <Input
                id="edit_flag_key"
                value={formData.flag_key}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">Flag key cannot be changed</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_name">Name</Label>
              <Input
                id="edit_name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_description">Description</Label>
              <Textarea
                id="edit_description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_rollout_percentage">Rollout Percentage</Label>
              <Input
                id="edit_rollout_percentage"
                type="number"
                min="0"
                max="100"
                value={formData.rollout_percentage}
                onChange={(e) => setFormData({ ...formData, rollout_percentage: parseInt(e.target.value) })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit_enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
              <Label htmlFor="edit_enabled">Enabled</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFlag(null)}>
              Cancel
            </Button>
            <Button onClick={() => editingFlag && handleUpdate(editingFlag)}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
