import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2 } from "lucide-react";

interface AssetConfig {
  path: string;
  type: string;
  schema?: Record<string, any>;
}

interface AssetJsonEditorProps {
  asset: AssetConfig;
  jsonFormData: Record<string, any>;
  loading: boolean;
  newKey: string;
  onJsonFormChange: (jsonData: Record<string, any>) => void;
  onAddEntry: () => void;
  onRemoveEntry: (key: string) => void;
  onNewKeyChange: (value: string) => void;
  renderSchemaField: (key: string, fieldSchema: any, parentKey?: string) => React.ReactNode;
}

export const AssetJsonEditor = ({
  asset,
  jsonFormData,
  loading,
  newKey,
  onJsonFormChange,
  onAddEntry,
  onRemoveEntry,
  onNewKeyChange,
  renderSchemaField,
}: AssetJsonEditorProps) => {
  if (loading) {
    return <Skeleton className="h-32 w-full" />;
  }

  const assetData = jsonFormData[asset.path] || {};

  return (
    <div className="space-y-3">
      {asset.schema?.properties && (
        <div className="space-y-2">
          {Object.entries(asset.schema.properties).map(([key, fieldSchema]: [string, any]) =>
            renderSchemaField(key, fieldSchema)
          )}
        </div>
      )}

      {asset.schema?.additionalProperties && (
        <div className="space-y-2 pt-2 border-t">
          <Label className="text-xs font-semibold">Entries</Label>
          {Object.keys(assetData).map((key) => (
            <div key={key} className="p-2 border rounded-lg space-y-2 w-full">
              <div className="flex items-center justify-between gap-2 w-full">
                <Label className="text-xs font-semibold truncate flex-1 min-w-0">{key}</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveEntry(key)}
                  className="h-6 w-6 p-0 flex-shrink-0"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              {asset.schema?.additionalProperties?.properties && (
                <div className="space-y-2 pl-2">
                  {Object.entries(asset.schema.additionalProperties.properties).map(([nestedKey, nestedSchema]: [string, any]) =>
                    renderSchemaField(nestedKey, nestedSchema, key)
                  )}
                </div>
              )}
            </div>
          ))}

          <div className="flex gap-2 pt-2 w-full">
            <Input
              placeholder="New key..."
              value={newKey}
              onChange={(e) => onNewKeyChange(e.target.value)}
              className="h-8 text-xs flex-1 min-w-0"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={onAddEntry}
              className="h-8 flex-shrink-0"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Changes are automatically saved to batch</p>
    </div>
  );
};
