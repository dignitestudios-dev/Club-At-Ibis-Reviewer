"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { AlertTriangle, ArrowLeft, Ban, CheckCircle2, FileDiff, FileText, LayoutTemplate, Lock, PlayCircle, UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { FilePreviewDialog, type PreviewableFile } from "@/components/shared/file-preview-dialog";
import { AssignReviewerDialog } from "@/features/requests/components/assign-reviewer-dialog";
import { EarlierSubmissions } from "@/features/requests/components/earlier-submissions";
import { CompletionPanel } from "@/features/requests/components/completion-panel";
import { HistoryTimeline } from "@/features/requests/components/history-timeline";
import { RequestJourney } from "@/features/requests/components/request-journey";
import { ReviewActionPanel } from "@/features/requests/components/review-action-panel";
import { ReviewItem } from "@/features/requests/components/review-item";
import { useAssignRequest, useCategories, useRequest, useResidents, useReviewers } from "@/hooks/use-reviewer-data";
import { useMe } from "@/hooks/use-current-user";
import { useToast } from "@/hooks/use-toast";
import { IN_FLIGHT, changedFieldIds, currentSubmissionNumber, needsRefundOutcome, residentFullName, reviewItems } from "@/lib/domain";
import { formatDate, formatDateTime } from "@/utils/format";

type Section = "review" | "completion" | "history";

export default function RequestDetailPage({ id }: { id: string }) {
  const toast = useToast();
  const { me, isDefault } = useMe();
  const { data: req, isLoading } = useRequest(id);
  const { data: residents } = useResidents();
  const { data: reviewers } = useReviewers();
  const { data: categories } = useCategories();
  const takeOwnership = useAssignRequest();
  const [section, setSection] = useState<Section>("review");
  const [preview, setPreview] = useState<PreviewableFile | null>(null);
  const [assigning, setAssigning] = useState<RequestRecord | null>(null);

  if (isLoading || !me) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  const isOwner = !!req && req.assignedReviewerId === me.id;
  const backHref = isOwner || !isDefault ? "/my-requests" : "/oversight";

  if (!req || (!isOwner && !isDefault)) {
    return (
      <EmptyState
        icon={req ? Lock : FileText}
        title={req ? "This request isn't assigned to you" : "Request not found"}
        description={
          req
            ? "You can open requests that are assigned to you. If it was reassigned, the new owner now has authority over it."
            : "This request doesn't exist or the link is no longer valid."
        }
        action={
          <Button nativeButton={false} render={<Link href="/my-requests" />}>
            Back to my requests
          </Button>
        }
      />
    );
  }

  const resident = req.resident
    ? {
        id: req.resident.id,
        residentIdNumber: req.resident.residentId || req.resident.residentIdNumber || "",
        firstName: req.resident.firstName || "",
        lastName: req.resident.lastName || "",
        displayName: req.resident.displayName || "",
        email: req.resident.email || "",
        phone: req.resident.phone || "",
        active: true,
        address: req.property?.address || req.fieldValues?.propertyAddress || "",
        lotNo: req.property?.lotNo || req.fieldValues?.lotNo || "",
        createdAt: "",
      }
    : residents?.find((r) => r.id === req.residentId);
  const owner = reviewers?.find((r) => r.id === req.assignedReviewerId);
  const category = categories?.find((c) => c.id === req.categoryId);
  const currentCategoryVersion = category?.version ?? req.formVersion;
  const canReview = isOwner && (req.status === "under_review" || req.status === "resubmitted");

  const fields = [...(req.formSnapshot || [])].sort((a, b) => a.order - b.order);
  const provided = new Set(reviewItems(req).map((f) => f.id));
  const changed = changedFieldIds(req);
  const previousOf = (fieldId: string) => [...req.revisions].reverse().find((r) => r.fieldId === fieldId)?.previous;
  const infoFields = fields.filter((f) => f.type !== "file");
  const fileFields = fields.filter((f) => f.type === "file");
  const canOwnIncoming = isDefault && !req.assignedReviewerId && IN_FLIGHT.includes(req.status);
  const refundAlert = isOwner && (needsRefundOutcome(req) || req.refund?.outcome === "awaiting");

  const renderField = (field: CategoryField) =>
    provided.has(field.id) ? (
      <ReviewItem key={field.id} request={req} field={field} canReview={canReview} changed={changed.has(field.id)} previous={previousOf(field.id)} onPreview={setPreview} />
    ) : (
      <div key={field.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-border/80 px-4 py-3">
        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {field.label} <span className="font-normal tracking-normal normal-case">(optional)</span>
        </p>
        <span className="text-xs text-muted-foreground italic">{field.type === "file" ? "No file uploaded" : "Not provided"}</span>
      </div>
    );

  const propAddress = req.property?.address || req.fieldValues?.propertyAddress || "—";
  const propLot = req.property?.lotNo || req.fieldValues?.lotNo || "—";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="space-y-4">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {backHref === "/my-requests" ? "My assigned requests" : "Request oversight"}
        </Link>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-2xl font-medium text-foreground sm:text-3xl">{req.code}</h1>
            <StatusBadge status={req.status} />
            {currentSubmissionNumber(req) > 1 && (
              <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-purple-800 uppercase dark:bg-purple-950/60 dark:text-purple-300">
                Submission #{currentSubmissionNumber(req)}
              </span>
            )}
            {isOwner ? (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-primary uppercase dark:bg-primary/20 dark:text-amber-300">Assigned to you</span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                <Lock className="size-3" aria-hidden="true" /> Read-only
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{req.categoryName}</span>
            {category?.status === "archived" && (
              <span className="rounded-full bg-slate-200 px-2 py-px text-[10px] font-bold tracking-wider text-slate-700 uppercase dark:bg-slate-700 dark:text-slate-200">Archived category</span>
            )}
            <span aria-hidden="true">·</span>
            <span>{propAddress}</span>
            <span aria-hidden="true">·</span>
            <span>{propLot}</span>
          </div>
        </div>
      </div>

      {/* Ownership banner for default reviewers looking at someone else's / an unowned request */}
      {!isOwner && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 text-sm">
            <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="text-muted-foreground">
              {owner ? (
                <>
                  Assigned to <span className="font-semibold text-foreground">{owner.name}</span>. As a default reviewer you can track progress and reassign it, but only the owner can review and decide.
                </>
              ) : req.status === "submitted" ? (
                "Waiting in the incoming list. Take ownership to review it, or assign it to another reviewer."
              ) : (
                "This request has no assigned reviewer."
              )}
            </p>
          </div>
          {IN_FLIGHT.includes(req.status) && (
            <div className="flex shrink-0 flex-wrap gap-2">
              {canOwnIncoming && (
                <Button
                  disabled={takeOwnership.isPending}
                  onClick={() =>
                    takeOwnership.mutate(
                      { requestId: req.id, reviewerId: me.id },
                      { onSuccess: () => toast.success("Ownership taken", `${req.code} is now yours.`), onError: (e: Error) => toast.error("Could not take ownership", e.message) }
                    )
                  }
                >
                  {takeOwnership.isPending ? <Spinner className="size-4" /> : <PlayCircle />}
                  Take ownership
                </Button>
              )}
              <Button variant="outline" onClick={() => setAssigning(req)}>
                <UserRoundPlus />
                {owner ? "Reassign" : "Assign"}
              </Button>
            </div>
          )}
        </div>
      )}

      {refundAlert && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300/80 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-amber-950 dark:text-amber-200">{needsRefundOutcome(req) ? "Refund outcome needed" : "Awaiting refund action"}</p>
            <p className="text-amber-900/80 dark:text-amber-300/80">
              {needsRefundOutcome(req)
                ? "The resident withdrew after a deposit was received. Record Refund to be made or No Refund."
                : "Mark the deposit Refunded once the refund has been made outside the app."}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setSection("completion")}>
            Handle refund
          </Button>
        </div>
      )}
      {req.status === "withdrawn" && !refundAlert && (
        <div className="flex items-start gap-3 rounded-2xl border border-slate-300/80 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
          <Ban className="mt-0.5 size-5 shrink-0 text-slate-600 dark:text-slate-300" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">Withdrawn by resident {req.withdrawnAt && `on ${formatDate(req.withdrawnAt)}`}</p>
            <p className="text-muted-foreground">
              Review and completion actions are stopped{req.withdrawnFrom && ` (withdrawn while ${req.withdrawnFrom.replace("_", " ")})`}. Documents, earlier decisions and history are preserved.
            </p>
          </div>
        </div>
      )}
      <RequestJourney request={req} />

      <div className="grid items-start gap-6 xl:grid-cols-3">
        {/* Main column */}
        <div className="min-w-0 xl:col-span-2">
          <Card className="shadow-2xs">
            <CardContent className="pt-1">
              <Tabs value={section} onValueChange={(v) => setSection(v as Section)}>
                <TabsList aria-label="Request sections">
                  <TabsTrigger value="review">Review</TabsTrigger>
                  <TabsTrigger value="completion">{req.status === "withdrawn" ? "Refund" : "Deposit & completion"}</TabsTrigger>
                  <TabsTrigger value="history">Activity timeline{req.history.length > 0 ? ` (${req.history.length})` : ""}</TabsTrigger>
                </TabsList>

                <TabsContent value="review" className="space-y-5 pt-4">
                  <div
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm ${
                      req.formVersion === currentCategoryVersion ? "border-border bg-muted/30" : "border-teal-300/70 bg-teal-50 dark:border-teal-800/70 dark:bg-teal-950/30"
                    }`}
                  >
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1.5">
                        <LayoutTemplate className="size-4 text-muted-foreground" aria-hidden="true" />
                        Submitted on <span className="font-semibold text-foreground">form v{req.formVersion}</span>
                      </span>
                      <span className="text-muted-foreground">Latest version: <span className="font-semibold text-foreground">v{currentCategoryVersion}</span></span>
                      {req.formVersion === currentCategoryVersion && <span className="text-xs text-muted-foreground">Up to date</span>}
                    </p>
                    {req.formVersion !== currentCategoryVersion && (
                      <Button variant="outline" size="sm" className="bg-card" nativeButton={false} render={<Link href={`/forms/${req.categoryId}?from=${req.formVersion}&to=${currentCategoryVersion}`} />}>
                        <FileDiff />
                        What changed
                      </Button>
                    )}
                  </div>
                  {isOwner && req.status === "submitted" && (
                    <p className="flex items-start gap-2 rounded-xl border border-sky-300/70 bg-sky-50 p-3 text-sm text-sky-950 dark:border-sky-800/70 dark:bg-sky-950/30 dark:text-sky-200">
                      <PlayCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      Read through the submission below, then use <span className="font-semibold">Start review</span> to begin accepting or flagging items.
                    </p>
                  )}
                  {isOwner && req.status === "changes_required" && (
                    <p className="flex items-start gap-2 rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-200">
                      Waiting for the resident to correct the flagged items — reviewing is paused until they resubmit.
                    </p>
                  )}

                  <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
                    <CardHeader className="border-b border-border/70 pb-3">
                      <CardTitle className="font-heading text-lg font-medium">Project Information</CardTitle>
                      <p className="text-xs text-muted-foreground">Fields as configured when the request was submitted (form v{req.formVersion}).</p>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-4">{infoFields.map(renderField)}</CardContent>
                  </Card>

                  <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
                    <CardHeader className="border-b border-border/70 pb-3">
                      <CardTitle className="font-heading text-lg font-medium">Submitted Documents &amp; Photos</CardTitle>
                      <p className="text-xs text-muted-foreground">Open a preview to inspect each file. You can view an item again and re-flag it until the request is approved.</p>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-4">
                      {fileFields.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">This form had no document uploads.</p>}
                      {fileFields.map(renderField)}
                    </CardContent>
                  </Card>

                  <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
                    <CardContent className="flex items-start gap-3 pt-1">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                        <CheckCircle2 className="size-4" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">HOA Approval Confirmed</p>
                        <p className="text-xs text-muted-foreground">Resident checked “I have HOA Approval” at submission · {formatDateTime(req.hoaConfirmedAt)}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {req.revisions.length > 0 && (
                    <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
                      <CardHeader className="border-b border-border/70 pb-3">
                        <CardTitle className="font-heading text-lg font-medium">Earlier Versions Retained</CardTitle>
                        <p className="text-xs text-muted-foreground">Replaced during resubmission — kept in the request history.</p>
                      </CardHeader>
                      <CardContent className="space-y-3 pt-4">
                        {req.revisions.map((rev) => (
                          <div key={rev.id} className="grid gap-2 rounded-xl border border-border/80 p-3.5 text-sm sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                            <div>
                              <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Previous · {rev.label}</p>
                              <p className="truncate text-muted-foreground line-through decoration-slate-400/60">{rev.previous}</p>
                            </div>
                            <span className="hidden text-muted-foreground sm:block" aria-hidden="true">→</span>
                            <div>
                              <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Current · {format(new Date(rev.at), "MMM d")}</p>
                              <p className="truncate font-medium text-foreground">{rev.current}</p>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                  <EarlierSubmissions request={req} onPreview={setPreview} />
                </TabsContent>

                <TabsContent value="completion" className="pt-4">
                  <CompletionPanel request={req} isOwner={isOwner} onPreview={setPreview} />
                </TabsContent>

                <TabsContent value="history" className="pt-4">
                  <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
                    <CardHeader className="border-b border-border/70 pb-3">
                      <CardTitle className="font-heading text-lg font-medium">Activity Timeline</CardTitle>
                      <p className="text-xs text-muted-foreground">Oldest to newest. Every event records the action, the actual person, the date and time, and relevant details.</p>
                    </CardHeader>
                    <CardContent className="pt-5">
                      <HistoryTimeline events={req.history} />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 xl:sticky xl:top-20">
          <ReviewActionPanel request={req} isOwner={isOwner} onGoToCompletion={() => setSection("completion")} />

          <Card className="shadow-2xs">
            <CardContent className="space-y-2 pt-1">
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Resident</p>
              {resident ? (
                <div className="flex items-center gap-3">
                  <PersonAvatar name={residentFullName(resident)} className="size-10" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{residentFullName(resident)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {resident.residentIdNumber} · {resident.email}
                    </span>
                    {resident.phone && <span className="block truncate text-xs text-muted-foreground">{resident.phone}</span>}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Unknown resident</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-2xs">
            <CardContent className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Assigned reviewer</p>
                {owner ? (
                  <div className="flex items-center gap-3">
                    <PersonAvatar name={owner.name} className="size-8" fallbackClassName="text-xs" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {owner.name}
                        {isOwner && <span className="font-normal text-muted-foreground"> (you)</span>}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{owner.designation}</span>
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Unassigned</p>
                )}
              </div>
              <dl className="space-y-1.5 border-t border-border/70 pt-3 text-sm">
                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Submitted</dt><dd className="font-medium">{formatDate(req.submittedAt)}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Last update</dt><dd className="font-medium">{formatDate(req.updatedAt)}</dd></div>
                {req.decidedAt && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Decision</dt><dd className="font-medium">{formatDate(req.decidedAt)}</dd></div>}
                {req.completedAt && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Completed</dt><dd className="font-medium">{formatDate(req.completedAt)}</dd></div>}
                {req.withdrawnAt && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Withdrawn</dt><dd className="font-medium">{formatDate(req.withdrawnAt)}</dd></div>}
              </dl>
              <div className="flex items-center gap-2 border-t border-border/70 pt-3">
                <span className="flex size-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary dark:text-amber-300">
                  <LayoutTemplate className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-foreground">Submitted on form v{req.formVersion}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Latest version: v{currentCategoryVersion}
                    {req.formVersion === currentCategoryVersion ? " · up to date" : ""}
                  </p>
                  {req.formVersion !== currentCategoryVersion && (
                    <Link href={`/forms/${req.categoryId}?from=${req.formVersion}&to=${currentCategoryVersion}`} className="text-[11px] font-medium text-primary hover:underline dark:text-amber-300">
                      Compare with the latest
                    </Link>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <AssignReviewerDialog request={assigning} onOpenChange={(o) => !o && setAssigning(null)} />
      <FilePreviewDialog file={preview} open={!!preview} onOpenChange={(o) => !o && setPreview(null)} />
    </div>
  );
}
