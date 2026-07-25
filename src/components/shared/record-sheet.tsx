"use client";

import * as React from "react";
import type { Attachment, RecordNote, ActivityLog } from "@prisma/client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { AttachmentsPanel } from "@/features/attachments/components/attachments-panel";
import { RecordNotesPanel } from "@/features/record-notes/components/record-notes-panel";
import { RecordTimeline } from "@/features/activity/components/record-timeline";
import { listAttachments } from "@/features/attachments/actions";
import { listRecordNotes } from "@/features/record-notes/actions";
import { getRecordTimeline } from "@/features/activity/actions";
import type { ModuleKey } from "@/config/modules";

interface RecordSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  module: ModuleKey;
  recordId?: string; // absent while creating a brand-new record
  children: React.ReactNode; // the module's form (Details tab)
}

/** The slide-over shell every module uses for create/edit + Notes/Attachments/Activity. */
export function RecordSheet({ open, onOpenChange, title, description, module, recordId, children }: RecordSheetProps) {
  const [tab, setTab] = React.useState("details");

  React.useEffect(() => {
    if (open) setTab("details");
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {recordId ? (
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="mb-1">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
                <TabsTrigger value="attachments">Files</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

              <TabsContent value="details">{children}</TabsContent>
              <TabsContent value="notes">
                {tab === "notes" && <NotesTab module={module} recordId={recordId} />}
              </TabsContent>
              <TabsContent value="attachments">
                {tab === "attachments" && <AttachmentsTab module={module} recordId={recordId} />}
              </TabsContent>
              <TabsContent value="activity">
                {tab === "activity" && <ActivityTab module={module} recordId={recordId} />}
              </TabsContent>
            </Tabs>
          ) : (
            children
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function NotesTab({ module, recordId }: { module: ModuleKey; recordId: string }) {
  const [notes, setNotes] = React.useState<RecordNote[] | null>(null);

  const refresh = React.useCallback(() => {
    listRecordNotes(module, recordId).then(setNotes);
  }, [module, recordId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  if (!notes) return <TabSkeleton />;
  return <RecordNotesPanel module={module} recordId={recordId} notes={notes} onChanged={refresh} />;
}

function AttachmentsTab({ module, recordId }: { module: ModuleKey; recordId: string }) {
  const [attachments, setAttachments] = React.useState<Attachment[] | null>(null);

  const refresh = React.useCallback(() => {
    listAttachments(module, recordId).then(setAttachments);
  }, [module, recordId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  if (!attachments) return <TabSkeleton />;
  return <AttachmentsPanel module={module} recordId={recordId} attachments={attachments} onChanged={refresh} />;
}

function ActivityTab({ module, recordId }: { module: ModuleKey; recordId: string }) {
  const [activity, setActivity] = React.useState<ActivityLog[] | null>(null);

  React.useEffect(() => {
    getRecordTimeline(module, recordId).then(setActivity);
  }, [module, recordId]);

  if (!activity) return <TabSkeleton />;
  return <RecordTimeline activity={activity} />;
}

function TabSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  );
}
