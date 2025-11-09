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
          let newItem: any;
          if (fieldSchema.items.type === 'object' && fieldSchema.items.properties) {
            // Array of objects
            newItem = {};
            Object.entries(fieldSchema.items.properties).forEach(([propKey, propSchema]: [string, any]) => {
              newItem[propKey] = propSchema.default ?? '';
            });
          } else if (fieldSchema.items.type === 'string') {
            // Array of strings
            newItem = '';
          } else if (fieldSchema.items.type === 'number' || fieldSchema.items.type === 'integer') {
            // Array of numbers
            newItem = 0;
          } else if (fieldSchema.items.type === 'boolean') {
            // Array of booleans
            newItem = false;
          } else {
            // Default to string if no type specified
            newItem = '';
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
              {items.map((item, index) => {
                const updateArrayItem = async (newValue: any) => {
                  const newItems = [...items];
                  newItems[index] = newValue;
                  const updatedData = parentKey
                    ? { ...(jsonFormData[asset.path] || {}), [parentKey]: { ...(jsonFormData[asset.path]?.[parentKey] || {}), [fieldKey]: newItems } }
                    : { ...(jsonFormData[asset.path] || {}), [fieldKey]: newItems };

                  await onJsonFormChange(asset, updatedData);
                };

                return (
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
                    {fieldSchema.items.type === 'object' && fieldSchema.items.properties ? (
                      // Array of objects
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
                    ) : (
                      // Array of simple types (string, number, boolean, or default to string)
                      <div className="pl-2">
                        {fieldSchema.items.type === 'number' || fieldSchema.items.type === 'integer' ? (
                          <Input
                            value={item ?? 0}
                            onChange={(e) => updateArrayItem(fieldSchema.items.type === 'integer' ? parseInt(e.target.value) || 0 : parseFloat(e.target.value) || 0)}
                            placeholder="Enter value"
                            className="h-8 text-xs"
                          />
                        ) : fieldSchema.items.type === 'boolean' ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={item ?? false}
                              onChange={(e) => updateArrayItem(e.target.checked)}
                              className="h-4 w-4"
                            />
                            <Label className="text-xs">{item ? 'True' : 'False'}</Label>
                          </div>
                        ) : (
                          // Default to string
                          <Input
                            value={item ?? ''}
                            onChange={(e) => updateArrayItem(e.target.value)}
                            placeholder="Enter value"
                            className="h-8 text-xs"
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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
