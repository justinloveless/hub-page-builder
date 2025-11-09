import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    Bold,
    Italic,
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    Quote,
    Code,
} from "lucide-react";

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
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                codeBlock: false,
                heading: {
                    levels: [1, 2, 3],
                },
            }),
            Markdown.configure({
                html: false,
            }),
            Placeholder.configure({
                placeholder: placeholder || "Start writing...",
            }),
        ],
        content: value || "",
        editorProps: {
            attributes: {
                class: cn(
                    "prose prose-sm max-w-none focus:outline-none min-h-[140px] px-3 py-2 text-foreground dark:prose-invert",
                    textareaClassName
                ),
            },
        },
        onUpdate({ editor }) {
            const markdown = editor.storage.markdown?.getMarkdown?.() ?? "";
            if (markdown !== value) {
                onChange(markdown);
            }
        },
    });

    useEffect(() => {
        if (!editor) {
            return;
        }
        const markdown = editor.storage.markdown?.getMarkdown?.() ?? "";
        if ((value || "") !== markdown) {
            editor.commands.setContent(value || "", false);
        }
    }, [editor, value]);

    useEffect(() => {
        if (!editor || !onBlur) {
            return;
        }
        const handler = () => {
            const markdown = editor.storage.markdown?.getMarkdown?.() ?? "";
            onBlur(markdown);
        };
        editor.on("blur", handler);
        return () => {
            editor.off("blur", handler);
        };
    }, [editor, onBlur]);

    if (!editor) {
        return (
            <div className={cn("rounded-md border bg-muted/10 px-3 py-2 text-xs text-muted-foreground", className)}>
                Loading editor...
            </div>
        );
    }

    const applyHeading = (level: 1 | 2 | 3) => {
        editor.chain().focus().toggleHeading({ level }).run();
    };

    return (
        <div className={cn("space-y-2", className)}>
            <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/20 p-1">
                <Button
                    type="button"
                    size="icon"
                    variant={editor.isActive("bold") ? "default" : "ghost"}
                    className="h-7 w-7"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                >
                    <Bold className="h-3.5 w-3.5" />
                </Button>
                <Button
                    type="button"
                    size="icon"
                    variant={editor.isActive("italic") ? "default" : "ghost"}
                    className="h-7 w-7"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                >
                    <Italic className="h-3.5 w-3.5" />
                </Button>
                <Button
                    type="button"
                    size="icon"
                    variant={editor.isActive("code") ? "default" : "ghost"}
                    className="h-7 w-7"
                    onClick={() => editor.chain().focus().toggleCode().run()}
                >
                    <Code className="h-3.5 w-3.5" />
                </Button>
                <div className="mx-1 h-5 w-px bg-border" />
                <Button
                    type="button"
                    size="icon"
                    variant={editor.isActive("heading", { level: 1 }) ? "default" : "ghost"}
                    className="h-7 w-7"
                    onClick={() => applyHeading(1)}
                >
                    <Heading1 className="h-3.5 w-3.5" />
                </Button>
                <Button
                    type="button"
                    size="icon"
                    variant={editor.isActive("heading", { level: 2 }) ? "default" : "ghost"}
                    className="h-7 w-7"
                    onClick={() => applyHeading(2)}
                >
                    <Heading2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                    type="button"
                    size="icon"
                    variant={editor.isActive("heading", { level: 3 }) ? "default" : "ghost"}
                    className="h-7 w-7"
                    onClick={() => applyHeading(3)}
                >
                    <Heading3 className="h-3.5 w-3.5" />
                </Button>
                <div className="mx-1 h-5 w-px bg-border" />
                <Button
                    type="button"
                    size="icon"
                    variant={editor.isActive("bulletList") ? "default" : "ghost"}
                    className="h-7 w-7"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                >
                    <List className="h-3.5 w-3.5" />
                </Button>
                <Button
                    type="button"
                    size="icon"
                    variant={editor.isActive("orderedList") ? "default" : "ghost"}
                    className="h-7 w-7"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                >
                    <ListOrdered className="h-3.5 w-3.5" />
                </Button>
                <Button
                    type="button"
                    size="icon"
                    variant={editor.isActive("blockquote") ? "default" : "ghost"}
                    className="h-7 w-7"
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                >
                    <Quote className="h-3.5 w-3.5" />
                </Button>
            </div>
            <div className={cn("rounded-md border bg-background", previewClassName)}>
                <div className="relative max-h-[60vh] overflow-y-auto">
                    <EditorContent editor={editor} />
                    {!value?.trim() && (
                        <div className="pointer-events-none absolute inset-0 px-3 py-2 text-xs text-muted-foreground">
                            {emptyPreviewPlaceholder}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

