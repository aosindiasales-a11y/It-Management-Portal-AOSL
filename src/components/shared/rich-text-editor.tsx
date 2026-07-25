"use client";

import * as React from "react";
import { Bold, Italic, Link2, List, ListOrdered, Underline } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

/**
 * A small, dependency-free rich text editor for Notes. Uses the browser's
 * built-in contentEditable + execCommand — old APIs, but they cover
 * bold/italic/underline/lists/links perfectly well for an internal notebook
 * and avoid pulling in a full editor framework for a 20-person tool.
 */
export function RichTextEditor({ value, onChange, placeholder = "Write a note…", minHeight = 160 }: RichTextEditorProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const initialized = React.useRef(false);

  React.useEffect(() => {
    if (ref.current && !initialized.current) {
      ref.current.innerHTML = value || "";
      initialized.current = true;
    }
  }, [value]);

  function exec(command: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  }

  function handleLink() {
    const url = window.prompt("Link URL");
    if (url) exec("createLink", url);
  }

  return (
    <div className="rounded-lg border border-input shadow-sm">
      <div className="flex items-center gap-0.5 border-b border-border p-1.5">
        <ToolbarButton icon={Bold} label="Bold" onClick={() => exec("bold")} />
        <ToolbarButton icon={Italic} label="Italic" onClick={() => exec("italic")} />
        <ToolbarButton icon={Underline} label="Underline" onClick={() => exec("underline")} />
        <ToolbarButton icon={List} label="Bullet list" onClick={() => exec("insertUnorderedList")} />
        <ToolbarButton icon={ListOrdered} label="Numbered list" onClick={() => exec("insertOrderedList")} />
        <ToolbarButton icon={Link2} label="Link" onClick={handleLink} />
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        data-placeholder={placeholder}
        style={{ minHeight }}
        className={cn(
          "prose-sm max-w-none px-3.5 py-2.5 text-sm text-foreground outline-none",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline",
          "empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
        )}
      />
    </div>
  );
}

function ToolbarButton({ icon: Icon, label, onClick }: { icon: typeof Bold; label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onClick} aria-label={label} title={label}>
      <Icon className="h-3.5 w-3.5" />
    </Button>
  );
}
