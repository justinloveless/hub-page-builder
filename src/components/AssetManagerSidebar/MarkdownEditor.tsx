import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface MarkdownEditorProps {
    value: string;
    onChange: (value: string) => void | Promise<void>;
    onBlur?: (value: string) => void | Promise<void>;
    placeholder?: string;
    className?: string;
    textareaClassName?: string;
    previewClassName?: string;
    emptyPreviewPlaceholder?: string;
}

export const MarkdownEditor = ({
    value,
    onChange,
    onBlur,
    placeholder,
    className,
    textareaClassName,
    previewClassName,
    emptyPreviewPlaceholder = "*No content to preview*",
}: MarkdownEditorProps) => {
    const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");

    return (
        <div className={cn("space-y-2", className)}>
            <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as "edit" | "preview")} className="space-y-2">
                <TabsList className="grid w-full max-w-[220px] grid-cols-2">
                    <TabsTrigger value="edit">Edit</TabsTrigger>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
                <TabsContent value="edit" className="mt-0 space-y-2">
                    <Textarea
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                        onBlur={onBlur ? (event) => onBlur(event.target.value) : undefined}
                        placeholder={placeholder}
                        className={cn("min-h-[120px]", textareaClassName)}
                    />
                </TabsContent>
                <TabsContent value="preview" className="mt-0">
                    <div className={cn("rounded-lg border bg-background p-4", previewClassName)}>
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                            <ReactMarkdown>{value?.trim() ? value : emptyPreviewPlaceholder}</ReactMarkdown>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};


