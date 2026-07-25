"use client";

import type { ReactNode } from "react";
import { Archive, Copy, MoreHorizontal, Pencil, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface RowActionsMenuProps {
  onEdit?: () => void;
  onDuplicate?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
  archived?: boolean;
  /** Extra menu items rendered above the Edit block — undefined preserves the exact default menu every other module uses. */
  extraItems?: ReactNode;
}

/** One consistent row-actions menu (edit / duplicate / archive / restore / delete) for every module's table. */
export function RowActionsMenu({ onEdit, onDuplicate, onArchive, onRestore, onDelete, archived, extraItems }: RowActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => e.stopPropagation()}
          aria-label="Row actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {extraItems}
        {extraItems && <DropdownMenuSeparator />}
        {onEdit && (
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil />
            Edit
          </DropdownMenuItem>
        )}
        {onDuplicate && (
          <DropdownMenuItem onSelect={onDuplicate}>
            <Copy />
            Duplicate
          </DropdownMenuItem>
        )}
        {(onArchive || onRestore) && <DropdownMenuSeparator />}
        {!archived && onArchive && (
          <DropdownMenuItem onSelect={onArchive}>
            <Archive />
            Archive
          </DropdownMenuItem>
        )}
        {archived && onRestore && (
          <DropdownMenuItem onSelect={onRestore}>
            <RotateCcw />
            Restore
          </DropdownMenuItem>
        )}
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
