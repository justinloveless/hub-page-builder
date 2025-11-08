import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import type { AssetConfig } from "./types";

interface SchemaFieldRendererProps {
  asset: AssetConfig;
  fieldKey: string;
  fieldSchema: any;
  parentKey?: string;
  arrayIndex?: number;
  jsonFormData: Record<string, Record<string, any>>;
  onJsonFormChange: (asset: AssetConfig, jsonData: Record<string, any>) => void;
}

export const SchemaFieldRenderer = ({
  asset,
  fieldKey,
  fieldSchema,
  parentKey,
  arrayIndex,
  jsonFormData,
  onJsonFormChange,
}: SchemaFieldRendererProps) => {
  const fullKey = parentKey
    ? (arrayIndex !== undefined ? `${parentKey}[${arrayIndex}].${fieldKey}` : `${parentKey}.${fieldKey}`)
    : fieldKey;
  const assetData = jsonFormData[asset.path] || {};

  let value: any;
  if (arrayIndex !== undefined && parentKey) {
    value = assetData[parentKey]?.[arrayIndex]?.[fieldKey] ?? fieldSchema.default ?? '';
  } else if (parentKey) {
    value = assetData[parentKey]?.[fieldKey] ?? fieldSchema.default ?? '';
  } else {
    value = assetData[fieldKey] ?? fieldSchema.default ?? '';
  }

  const updateValue = async (newValue: any) => {
    let updatedData: Record<string, any>;
    if (arrayIndex !== undefined && parentKey) {
      const arrayData = [...(jsonFormData[asset.path]?.[parentKey] || [])];
      arrayData[arrayIndex] = {
        ...(arrayData[arrayIndex] || {}),
        [fieldKey]: newValue
      };
      updatedData = {
        ...(jsonFormData[asset.path] || {}),
        [parentKey]: arrayData
      };
    } else if (parentKey) {
      updatedData = {
        ...(jsonFormData[asset.path] || {}),
        [parentKey]: {
          ...(jsonFormData[asset.path]?.[parentKey] || {}),
          [fieldKey]: newValue
        }
      };
    } else {
      updatedData = { ...(jsonFormData[asset.path] || {}), [fieldKey]: newValue };
    }
    await onJsonFormChange(asset, updatedData);
  };

  switch (fieldSchema.type) {
    case 'array':
      if (fieldSchema.items) {
        const arrayValue = parentKey ? assetData[parentKey]?.[fieldKey] : assetData[fieldKey];
        const items = Array.isArray(arrayValue) ? arrayValue : [];

        const addArrayItem = async () => {
          const newItem: any = {};
          if (fieldSchema.items.type === 'object' && fieldSchema.items.properties) {
            Object.entries(fieldSchema.items.properties).forEach(([propKey, propSchema]: [string, any]) => {
              newItem[propKey] = propSchema.default ?? '';
            });
          }

          const newItems = [...items, newItem];
          const updatedData = parentKey
            ? { ...(jsonFormData[asset.path] || {}), [parentKey]: { ...(jsonFormData[asset.path]?.[parentKey] || {}), [fieldKey]: newItems } }
            : { ...(jsonFormData[asset.path] || {}), [fieldKey]: newItems };

          await onJsonFormChange(asset, updatedData);
        };

        const removeArrayItem = async (index: number) => {
          const newItems = items.filter((_, i) => i !== index);
          const updatedData = parentKey
            ? { ...(jsonFormData[asset.path] || {}), [parentKey]: { ...(jsonFormData[asset.path]?.[parentKey] || {}), [fieldKey]: newItems } }
            : { ...(jsonFormData[asset.path] || {}), [fieldKey]: newItems };

          await onJsonFormChange(asset, updatedData);
        };

        return (
          <div key={fullKey} className="space-y-2 p-3 border rounded-lg bg-accent/5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                  {fieldSchema.title || fieldKey}
                </h4>
                {fieldSchema.description && (
                  <p className="text-xs text-muted-foreground mt-1">{fieldSchema.description}</p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={addArrayItem}
                className="h-7 flex-shrink-0"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>

            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="p-2 border rounded-lg bg-background space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Item {index + 1}</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeArrayItem(index)}
                      className="h-6 w-6 p-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  {fieldSchema.items.type === 'object' && fieldSchema.items.properties && (
                    <div className="space-y-2 pl-2">
                      {Object.entries(fieldSchema.items.properties).map(([propKey, propSchema]: [string, any]) => {
                        const propValue = item[propKey] ?? propSchema.default ?? '';
                        const propFullKey = `${fullKey}[${index}].${propKey}`;

                        const updateArrayItemProp = async (newPropValue: any) => {
                          const newItems = [...items];
                          newItems[index] = { ...newItems[index], [propKey]: newPropValue };
                          const updatedData = parentKey
                            ? { ...(jsonFormData[asset.path] || {}), [parentKey]: { ...(jsonFormData[asset.path]?.[parentKey] || {}), [fieldKey]: newItems } }
                            : { ...(jsonFormData[asset.path] || {}), [fieldKey]: newItems };

                          await onJsonFormChange(asset, updatedData);
                        };

                        return (
                          <div key={propFullKey} className="space-y-1">
                            <Label htmlFor={propFullKey} className="text-xs">
                              {propSchema.title || propKey}
                            </Label>
                            {propSchema.description && (
                              <p className="text-xs text-muted-foreground">{propSchema.description}</p>
                            )}
                            {propSchema.type === 'string' && propSchema.multiline ? (
                              <Textarea
                                id={propFullKey}
                                value={propValue}
                                onChange={(e) => updateArrayItemProp(e.target.value)}
                                placeholder={propSchema.placeholder}
                                className="min-h-[60px] text-xs"
                              />
                            ) : propSchema.type === 'number' || propSchema.type === 'integer' ? (
                              <Input
                                id={propFullKey}
                                type="number"
                                value={propValue}
                                onChange={(e) => updateArrayItemProp(propSchema.type === 'integer' ? parseInt(e.target.value) || 0 : parseFloat(e.target.value) || 0)}
                                placeholder={propSchema.placeholder}
                                className="h-8 text-xs"
                              />
                            ) : (
                              <Input
                                id={propFullKey}
                                value={propValue}
                                onChange={(e) => updateArrayItemProp(e.target.value)}
                                placeholder={propSchema.placeholder}
                                className="h-8 text-xs"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
              {items.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">No items yet. Click "Add" to create one.</p>
              )}
            </div>
          </div>
        );
      }
      return null;

    case 'object':
      if (fieldSchema.properties) {
        return (
          <div key={fullKey} className="space-y-2 p-3 border rounded-lg bg-accent/5">
            <h4 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
              {fieldSchema.title || fieldKey}
            </h4>
            {fieldSchema.description && (
              <p className="text-xs text-muted-foreground -mt-1">{fieldSchema.description}</p>
            )}
            <div className="space-y-2 pl-2">
              {Object.entries(fieldSchema.properties).map(([nestedKey, nestedSchema]: [string, any]) => (
                <SchemaFieldRenderer
                  key={nestedKey}
                  asset={asset}
                  fieldKey={nestedKey}
                  fieldSchema={nestedSchema}
                  parentKey={fieldKey}
                  jsonFormData={jsonFormData}
                  onJsonFormChange={onJsonFormChange}
                />
              ))}
            </div>
          </div>
        );
      }
      return null;

    case 'string':
      if (fieldSchema.enum) {
        return (
          <div key={fullKey} className="space-y-1">
            <Label htmlFor={fullKey} className="text-xs">
              {fieldSchema.title || fieldKey}
            </Label>
            {fieldSchema.description && (
              <p className="text-xs text-muted-foreground">{fieldSchema.description}</p>
            )}
            <select
              id={fullKey}
              value={value}
              onChange={(e) => updateValue(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
            >
              <option value="">Select...</option>
              {fieldSchema.enum.map((option: string) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        );
      }
      return (
        <div key={fullKey} className="space-y-1">
          <Label htmlFor={fullKey} className="text-xs">
            {fieldSchema.title || fieldKey}
          </Label>
          {fieldSchema.description && (
            <p className="text-xs text-muted-foreground">{fieldSchema.description}</p>
          )}
          {fieldSchema.multiline ? (
            <Textarea
              id={fullKey}
              value={value}
              onChange={(e) => updateValue(e.target.value)}
              placeholder={fieldSchema.placeholder}
              className="min-h-[80px] text-xs"
            />
          ) : (
            <Input
              id={fullKey}
              value={value}
              onChange={(e) => updateValue(e.target.value)}
              placeholder={fieldSchema.placeholder}
              className="h-9 text-xs"
            />
          )}
        </div>
      );

    case 'number':
    case 'integer':
      return (
        <div key={fullKey} className="space-y-1">
          <Label htmlFor={fullKey} className="text-xs">
            {fieldSchema.title || fieldKey}
          </Label>
          {fieldSchema.description && (
            <p className="text-xs text-muted-foreground">{fieldSchema.description}</p>
          )}
          <Input
            id={fullKey}
            type="number"
            value={value}
            onChange={(e) => updateValue(fieldSchema.type === 'integer' ? parseInt(e.target.value) || 0 : parseFloat(e.target.value) || 0)}
            placeholder={fieldSchema.placeholder}
            min={fieldSchema.minimum}
            max={fieldSchema.maximum}
            className="h-9 text-xs"
          />
        </div>
      );

    default:
      return null;
  }
};
