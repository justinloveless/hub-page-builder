import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { AssetConfig } from "./types";
import { formatFileSize } from "./utils";

interface ComboAssetCreatorProps {
  asset: AssetConfig;
  creatingCombo: boolean;
  newComboData: {
    baseName: string;
    parts: Record<string, { content: string; file?: File; jsonData?: Record<string, any> }>;
  } | undefined;
  onStartCreating: () => void;
  onCancelCreating: () => void;
  onBaseNameChange: (value: string) => void;
  onPartFileChange: (partKey: string, file: File) => void;
  onPartJsonDataChange: (partKey: string, jsonData: Record<string, any>) => void;
  onPartContentChange: (partKey: string, content: string) => void;
  onSubmit: () => void;
}

export const ComboAssetCreator = ({
  asset,
  creatingCombo,
  newComboData,
  onStartCreating,
  onCancelCreating,
  onBaseNameChange,
  onPartFileChange,
  onPartJsonDataChange,
  onPartContentChange,
  onSubmit,
}: ComboAssetCreatorProps) => {
  if (!creatingCombo) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onStartCreating}
        className="w-full"
      >
        <Plus className="h-3 w-3 mr-2" />
        Create New Combo Asset
      </Button>
    );
  }

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-accent/5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">New Combo Asset</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancelCreating}
          className="h-6 px-2 text-xs"
        >
          Cancel
        </Button>
      </div>

      {/* Base Name Input */}
      <div className="space-y-1">
        <Label htmlFor="combo-basename" className="text-xs">
          Base Name (without extension)
        </Label>
        <Input
          id="combo-basename"
          value={newComboData?.baseName || ''}
          onChange={(e) => onBaseNameChange(e.target.value)}
          placeholder="e.g., photo1, document-a"
          className="h-8 text-xs"
        />
      </div>

      {/* Parts */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">Parts</Label>
        {asset.contains?.parts?.map((part, partIdx) => {
          const partKey = part.assetType;
          const isImage = partKey === 'image';
          const isJson = partKey === 'json';
          const isText = partKey === 'text' || partKey === 'markdown';
          const hasPart = !!newComboData?.parts[partKey];

          return (
            <div key={partIdx} className="p-2 border rounded bg-background space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{part.assetType}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {part.allowedExtensions?.join(', ')}
                  </span>
                </div>
                {hasPart && (
                  <Badge variant="secondary" className="text-xs">✓</Badge>
                )}
              </div>

              {isImage && (
                <div className="space-y-1">
                  <Label htmlFor={`combo-file-${partIdx}`} className="text-xs">
                    Upload {part.assetType}
                  </Label>
                  <Input
                    id={`combo-file-${partIdx}`}
                    type="file"
                    accept={part.allowedExtensions?.join(',')}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (part.maxSize && file.size > part.maxSize) {
                          toast.error(`File size exceeds maximum of ${formatFileSize(part.maxSize)}`);
                          return;
                        }
                        onPartFileChange(partKey, file);
                      }
                    }}
                    className="text-xs"
                  />
                  {hasPart && newComboData?.parts[partKey]?.file && (
                    <p className="text-xs text-muted-foreground">
                      Selected: {newComboData.parts[partKey].file!.name}
                    </p>
                  )}
                </div>
              )}

              {isJson && (
                <div className="space-y-2">
                  {part.schema?.properties ? (
                    /* Schema-based form */
                    <div className="space-y-2">
                      <Label className="text-xs">JSON Content (Form)</Label>
                      {Object.entries(part.schema.properties).map(([fieldKey, fieldSchema]: [string, any]) => {
                        const comboPartData = newComboData?.parts[partKey];
                        const jsonData = comboPartData?.jsonData || {};
                        const value = jsonData[fieldKey] ?? fieldSchema.default ?? '';

                        const updateJsonField = (newValue: any) => {
                          onPartJsonDataChange(partKey, {
                            ...jsonData,
                            [fieldKey]: newValue
                          });
                        };

                        return (
                          <div key={fieldKey} className="space-y-1">
                            <Label htmlFor={`combo-json-${partIdx}-${fieldKey}`} className="text-xs">
                              {fieldSchema.title || fieldKey}
                            </Label>
                            {fieldSchema.description && (
                              <p className="text-xs text-muted-foreground">{fieldSchema.description}</p>
                            )}
                            {fieldSchema.type === 'string' && fieldSchema.multiline ? (
                              <Textarea
                                id={`combo-json-${partIdx}-${fieldKey}`}
                                value={value}
                                onChange={(e) => {
                                  onPartJsonDataChange(partKey, {
                                    ...jsonData,
                                    [fieldKey]: e.target.value
                                  });
                                }}
                                placeholder={fieldSchema.placeholder}
                                className="min-h-[60px] text-xs"
                              />
                            ) : fieldSchema.type === 'number' || fieldSchema.type === 'integer' ? (
                              <Input
                                id={`combo-json-${partIdx}-${fieldKey}`}
                                type="number"
                                value={value}
                                onChange={(e) => {
                                  const numValue = fieldSchema.type === 'integer' 
                                    ? parseInt(e.target.value) || 0 
                                    : parseFloat(e.target.value) || 0;
                                  onPartJsonDataChange(partKey, {
                                    ...jsonData,
                                    [fieldKey]: numValue
                                  });
                                }}
                                placeholder={fieldSchema.placeholder}
                                className="h-8 text-xs"
                              />
                            ) : (
                              <Input
                                id={`combo-json-${partIdx}-${fieldKey}`}
                                value={value}
                                onChange={(e) => {
                                  onPartJsonDataChange(partKey, {
                                    ...jsonData,
                                    [fieldKey]: e.target.value
                                  });
                                }}
                                placeholder={fieldSchema.placeholder}
                                className="h-8 text-xs"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Raw JSON textarea */
                    <div className="space-y-1">
                      <Label htmlFor={`combo-json-${partIdx}`} className="text-xs">
                        JSON Content
                      </Label>
                      <Textarea
                        id={`combo-json-${partIdx}`}
                        value={newComboData?.parts[partKey]?.content || ''}
                        onChange={(e) => {
                          onPartContentChange(partKey, e.target.value);
                        }}
                        placeholder='{"key": "value"}'
                        className="min-h-[60px] font-mono text-xs"
                      />
                    </div>
                  )}
                </div>
              )}

              {isText && (
                <div className="space-y-1">
                  <Label htmlFor={`combo-text-${partIdx}`} className="text-xs">
                    Text Content
                  </Label>
                  <Textarea
                    id={`combo-text-${partIdx}`}
                    value={newComboData?.parts[partKey]?.content || ''}
                    onChange={(e) => onPartContentChange(partKey, e.target.value)}
                    placeholder="Enter text content..."
                    className="min-h-[60px] text-xs"
                  />
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Max: {formatFileSize(part.maxSize)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Submit Button */}
      <Button
        onClick={onSubmit}
        className="w-full"
        size="sm"
      >
        Add to Batch
      </Button>
    </div>
  );
};
