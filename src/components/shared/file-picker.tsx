"use client";

import { useRef } from "react";
import { Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/utils/format";
import { cn } from "@/utils/cn";

export interface PickedFile {
  name: string;
  size: number;
}

/**
 * Prototype file chooser: reads the chosen file's name and size only — nothing
 * is uploaded anywhere.
 */
export function FilePicker({
  value,
  onChange,
  accept,
  label = "Choose file",
  className,
}: {
  value: PickedFile | null;
  onChange: (file: PickedFile | null) => void;
  accept?: string;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          onChange(f ? { name: f.name, size: f.size } : null);
          e.target.value = "";
        }}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()}>
        <Paperclip />
        {value ? "Change file" : label}
      </Button>
      {value && (
        <span className="inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-muted/40 py-1 pr-1 pl-2.5 text-xs">
          <span className="truncate font-medium">{value.name}</span>
          <span className="text-muted-foreground">{formatFileSize(value.size)}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remove file"
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </span>
      )}
    </div>
  );
}
