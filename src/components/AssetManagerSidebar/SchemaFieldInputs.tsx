import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MarkdownEditor } from "./MarkdownEditor";

interface BaseInputProps {
    id: string;
    value: any;
    onChange: (value: any) => void;
    schema: any;
    className?: string;
}

export const StringInput = ({ id, value, onChange, schema, className = "h-9 text-xs" }: BaseInputProps) => {
    if (schema.enum) {
        return (
            <select
                id={id}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
            >
                <option value="">Select...</option>
                {schema.enum.map((option: string) => (
                    <option key={option} value={option}>{option}</option>
                ))}
            </select>
        );
    }

    if (schema.multiline) {
        return (
            <MarkdownEditor
                value={value}
                onChange={onChange}
                placeholder={schema.placeholder}
                textareaClassName="min-h-[120px] text-xs"
                previewClassName="text-xs"
            />
        );
    }

    return (
        <Input
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={schema.placeholder}
            className={className}
        />
    );
};

export const DateInput = ({ id, value, onChange, schema, className = "h-8 text-xs" }: BaseInputProps) => {
    const dateValue = value
        ? (value instanceof Date
            ? value.toISOString().split('T')[0]
            : typeof value === 'string'
                ? value.split('T')[0]
                : '')
        : '';

    return (
        <Input
            id={id}
            type="date"
            value={dateValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={schema.placeholder || 'Enter date'}
            className={className}
        />
    );
};

export const TimeInput = ({ id, value, onChange, schema, className = "h-8 text-xs" }: BaseInputProps) => {
    const timeValue = value
        ? (typeof value === 'string'
            ? (value.includes('T')
                ? value.split('T')[1]?.split('.')[0]?.substring(0, 5) ?? ''
                : value.substring(0, 5))
            : '')
        : '';

    return (
        <Input
            id={id}
            type="time"
            value={timeValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={schema.placeholder || 'Enter time'}
            className={className}
        />
    );
};

export const DateTimeInput = ({ id, value, onChange, schema, className = "h-8 text-xs" }: BaseInputProps) => {
    const datetimeValue = value
        ? (value instanceof Date
            ? new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
            : typeof value === 'string'
                ? (value.includes('T')
                    ? value.substring(0, 16)
                    : value)
                : '')
        : '';

    return (
        <Input
            id={id}
            type="datetime-local"
            value={datetimeValue}
            onChange={(e) => {
                const localValue = e.target.value;
                if (localValue) {
                    const date = new Date(localValue);
                    onChange(date.toISOString());
                } else {
                    onChange('');
                }
            }}
            placeholder={schema.placeholder || 'Enter date and time'}
            className={className}
        />
    );
};

export const NumberInput = ({ id, value, onChange, schema, className = "h-8 text-xs" }: BaseInputProps) => {
    return (
        <Input
            id={id}
            type="number"
            value={value}
            onChange={(e) => {
                const numValue = schema.type === 'integer'
                    ? parseInt(e.target.value) || 0
                    : parseFloat(e.target.value) || 0;
                onChange(numValue);
            }}
            placeholder={schema.placeholder}
            min={schema.minimum}
            max={schema.maximum}
            className={className}
        />
    );
};

export const BooleanInput = ({ id, value, onChange, className }: BaseInputProps) => {
    return (
        <div className="flex items-center gap-2">
            <input
                id={id}
                type="checkbox"
                checked={value ?? false}
                onChange={(e) => onChange(e.target.checked)}
                className="h-4 w-4"
            />
            <Label htmlFor={id} className="text-xs">{value ? 'True' : 'False'}</Label>
        </div>
    );
};

interface FieldInputProps extends BaseInputProps {
    schema: any;
}

export const FieldInput = ({ id, value, onChange, schema, className }: FieldInputProps) => {
    if (schema.type === 'string') {
        if (schema.format === 'date') {
            return <DateInput id={id} value={value} onChange={onChange} schema={schema} className={className} />;
        }
        if (schema.format === 'time') {
            return <TimeInput id={id} value={value} onChange={onChange} schema={schema} className={className} />;
        }
        if (schema.format === 'date-time' || schema.format === 'datetime') {
            return <DateTimeInput id={id} value={value} onChange={onChange} schema={schema} className={className} />;
        }
        return <StringInput id={id} value={value} onChange={onChange} schema={schema} className={className} />;
    }

    if (schema.type === 'number' || schema.type === 'integer') {
        return <NumberInput id={id} value={value} onChange={onChange} schema={schema} className={className} />;
    }

    if (schema.type === 'boolean') {
        return <BooleanInput id={id} value={value} onChange={onChange} schema={schema} className={className} />;
    }

    // Default to string input
    return <StringInput id={id} value={value} onChange={onChange} schema={schema} className={className} />;
};

interface FieldWrapperProps {
    fullKey: string;
    fieldKey: string;
    fieldSchema: any;
    children: React.ReactNode;
}

export const FieldWrapper = ({ fullKey, fieldKey, fieldSchema, children }: FieldWrapperProps) => {
    return (
        <div key={fullKey} className="space-y-1">
            <Label htmlFor={fullKey} className="text-xs">
                {fieldSchema.title || fieldKey}
            </Label>
            {fieldSchema.description && (
                <p className="text-xs text-muted-foreground">{fieldSchema.description}</p>
            )}
            {children}
        </div>
    );
};

