import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import type { AssetConfig } from "./types";
import { FieldInput, FieldWrapper } from "./SchemaFieldInputs";

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
      if (!fieldSchema.items) {
        return null;
      }
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
                  {fieldSchema.items.type === 'object' && fieldSchema.items.properties ?
                    (
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
                            <FieldWrapper
                              key={propFullKey}
                              fullKey={propFullKey}
                              fieldKey={propKey}
                              fieldSchema={propSchema}
                            >
                              <FieldInput
                                id={propFullKey}
                                value={propValue}
                                onChange={updateArrayItemProp}
                                schema={propSchema}
                                className="h-8 text-xs"
                              />
                            </FieldWrapper>
                          );
                        })}
                      </div>
                    ) : (
                      // Array of simple types (string, number, boolean, or default to string)
                      <div className="pl-2">
                        <FieldInput
                          id={`${fullKey}[${index}]`}
                          value={item ?? (fieldSchema.items.type === 'number' || fieldSchema.items.type === 'integer' ? 0 : fieldSchema.items.type === 'boolean' ? false : '')}
                          onChange={updateArrayItem}
                          schema={fieldSchema.items}
                          className="h-8 text-xs"
                        />
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
      return (
        <FieldWrapper
          fullKey={fullKey}
          fieldKey={fieldKey}
          fieldSchema={fieldSchema}
        >
          <FieldInput
            id={fullKey}
            value={value}
            onChange={updateValue}
            schema={fieldSchema}
            className="h-9 text-xs"
          />
        </FieldWrapper>
      );

    case 'number':
    case 'integer':
      return (
        <FieldWrapper
          fullKey={fullKey}
          fieldKey={fieldKey}
          fieldSchema={fieldSchema}
        >
          <FieldInput
            id={fullKey}
            value={value}
            onChange={updateValue}
            schema={fieldSchema}
            className="h-9 text-xs"
          />
        </FieldWrapper>
      );

    default:
      return null;
  }
};
