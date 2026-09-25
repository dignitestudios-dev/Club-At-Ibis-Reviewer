"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Eye,
  FileCheck2,
  FileDiff,
  FileEdit,
  FileImage,
  FileText,
  LayoutTemplate,
  Lock,
  Mail,
  PlayCircle,
  ReceiptText,
  UserRoundPlus,
  XCircle,
} from "lucide-react";
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
import { HistoryTimeline } from "@/features/requests/components/history-timeline";
import { RequestJourney } from "@/features/requests/components/request-journey";
import { DepositChip, RefundChip } from "@/features/requests/components/request-chips";
import { useAssignRequest, useCategories, useRequest, useResidents, useReviewers } from "@/hooks/use-reviewer-data";
import { useMe } from "@/hooks/use-current-user";
import { useToast } from "@/hooks/use-toast";
import { IN_FLIGHT, REFUND_LABEL, currentSubmissionNumber, needsRefundOutcome, residentFullName } from "@/lib/domain";
import { formatDate, formatDateTime, formatFileSize } from "@/utils/format";
import { cn } from "@/utils/cn";

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

function StaffFile({
  label,
  file,
  staffOnly,
  onPreview,
}: {
  label: string;
  file: AttachedFile;
  staffOnly?: boolean;
  onPreview: (file: AttachedFile) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-muted/30 px-3.5 py-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
        <FileText className="size-4 text-rose-600" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {label}
          {staffOnly && <span className="rounded-full bg-amber-50 px-1.5 py-px text-[9px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">Staff only</span>}
        </p>
        <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => onPreview(file)}>
        <Eye />
        Preview
      </Button>
    </div>
  );
}

export default function RequestDetailPage({ id }: { id: string }) {
  const toast = useToast();
  const { me, isDefault } = useMe();
  const { data: req, isLoading } = useRequest(id);
  const { data: residents } = useResidents();
  const { data: reviewers } = useReviewers();
  const { data: categories } = useCategories();
  const takeOwnership = useAssignRequest();
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

  const infoFields = (req.formSnapshot || []).filter((f) => f.type !== "file").sort((a, b) => a.order - b.order);
  const fileFields = (req.formSnapshot || []).filter((f) => f.type === "file").sort((a, b) => a.order - b.order);
  const docCount = fileFields.reduce((n, f) => n + (req.uploads?.[f.id]?.length ?? 0), 0);
  const flaggedCount = Object.values(req.itemReviews || {}).filter((r) => r.state === "flagged").length;

  const canOwnIncoming = isDefault && !req.assignedReviewerId && IN_FLIGHT.includes(req.status);
  const refundAlert = needsRefundOutcome(req) || req.refund?.outcome === "awaiting";

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

      {/* Ownership banner for default reviewers looking at unassigned request */}
      {!isOwner && IN_FLIGHT.includes(req.status) && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 text-sm">
            <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="text-muted-foreground">
              {owner ? (
                <>
                  Assigned to <span className="font-semibold text-foreground">{owner.name}</span>. As a default reviewer you can reassign it if needed.
                </>
              ) : req.status === "submitted" ? (
                "Waiting in the incoming list. Take ownership to handle it, or assign it to another reviewer."
              ) : (
                "This request has no assigned reviewer."
              )}
            </p>
          </div>
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
            {isDefault && (
              <Button variant="outline" onClick={() => setAssigning(req)}>
                <UserRoundPlus />
                {owner ? "Reassign" : "Assign"}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Status alerts */}
      {refundAlert && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300/80 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-amber-950 dark:text-amber-200">{needsRefundOutcome(req) ? "Refund outcome needed" : "Awaiting refund action"}</p>
            <p className="text-amber-900/80 dark:text-amber-300/80">
              {needsRefundOutcome(req)
                ? "The resident withdrew after a deposit was received. Refund happens outside the application."
                : "The refund action is pending completion outside the application."}
            </p>
          </div>
        </div>
      )}
      {req.status === "withdrawn" && !refundAlert && (
        <div className="flex items-start gap-3 rounded-2xl border border-slate-300/80 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
          <Ban className="mt-0.5 size-5 shrink-0 text-slate-600 dark:text-slate-300" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">Withdrawn by resident {req.withdrawnAt && `on ${formatDate(req.withdrawnAt)}`}</p>
            <p className="text-muted-foreground">
              Review processing stopped{req.withdrawnFrom && ` (withdrawn while ${req.withdrawnFrom.replace("_", " ")})`}. Documents, earlier decisions and history are preserved.
            </p>
          </div>
        </div>
      )}

      <RequestJourney request={req} />

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="shadow-2xs h-full flex flex-col justify-center">
          <CardContent className="space-y-2 py-2 flex flex-1 flex-col justify-center">
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

        <Card className="shadow-2xs h-full flex flex-col justify-center">
          <CardContent className="space-y-2 py-2 flex flex-1 flex-col justify-center">
            <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Assigned reviewer</p>
            {owner ? (
              <div className="flex items-center gap-3">
                <PersonAvatar name={owner.name} className="size-10" />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">
                    {owner.name}
                    {isOwner && <span className="font-normal text-muted-foreground"> (you)</span>}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{owner.designation}</span>
                </span>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Unassigned</p>
                <p className="text-xs text-muted-foreground">
                  {req.status === "withdrawn" ? "Withdrawn before assignment." : "Waiting in the incoming list."}
                </p>
              </div>
            )}
            {isDefault && IN_FLIGHT.includes(req.status) && (
              <Button variant={owner ? "outline" : "default"} size="sm" className="w-full mt-1" onClick={() => setAssigning(req)}>
                <UserRoundPlus />
                {owner ? "Reassign reviewer" : "Assign reviewer"}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-2xs h-full flex flex-col justify-center">
          <CardContent className="space-y-2 py-2 flex flex-1 flex-col justify-center">
            <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Key dates</p>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Submitted</dt><dd className="font-medium">{formatDate(req.submittedAt)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Last update</dt><dd className="font-medium">{formatDate(req.updatedAt)}</dd></div>
              {req.decidedAt && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Decision</dt><dd className="font-medium">{formatDate(req.decidedAt)}</dd></div>}
              {req.completedAt && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Completed</dt><dd className="font-medium">{formatDate(req.completedAt)}</dd></div>}
              {req.withdrawnAt && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Withdrawn</dt><dd className="font-medium">{formatDate(req.withdrawnAt)}</dd></div>}
            </dl>
          </CardContent>
        </Card>

        <Card className="shadow-2xs h-full flex flex-col justify-center">
          <CardContent className="space-y-2 py-2 flex flex-1 flex-col justify-center">
            <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Form configuration</p>
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary dark:text-amber-300">
                <LayoutTemplate className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Submitted on form v{req.formVersion}</p>
                <p className="text-xs text-muted-foreground">
                  {req.formVersion === currentCategoryVersion ? "Matches current form" : `Category is now v${currentCategoryVersion}`}
                </p>
              </div>
            </div>
            {req.formVersion !== currentCategoryVersion && (
              <p className="text-[11px] leading-snug text-muted-foreground">
                This request keeps the form and data it was submitted with; later edits only apply to new requests.
              </p>
            )}
            {req.formVersion !== currentCategoryVersion && (
              <Link href={`/forms/${req.categoryId}?from=${req.formVersion}&to=${currentCategoryVersion}`} className="inline-block text-xs font-medium text-primary hover:underline dark:text-amber-300">
                Compare with current version
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Card className="shadow-2xs">
        <CardContent className="pt-1">
          <Tabs defaultValue="overview">
            <TabsList aria-label="Request sections">
              <TabsTrigger value="overview">Details</TabsTrigger>
              <TabsTrigger value="documents">Documents{docCount > 0 ? ` (${docCount})` : ""}</TabsTrigger>
              <TabsTrigger value="decisions">Decisions &amp; deposit</TabsTrigger>
              <TabsTrigger value="history">Activity timeline{req.history.length > 0 ? ` (${req.history.length})` : ""}</TabsTrigger>
            </TabsList>

            {/* Overview / Project Information */}
            <TabsContent value="overview" className="space-y-5 pt-4">
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

              <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
                <CardHeader className="border-b border-border/70 pb-3">
                  <CardTitle className="font-heading text-lg font-medium">Project Information</CardTitle>
                  <p className="text-xs text-muted-foreground">Fields as configured when the request was submitted (form v{req.formVersion}).</p>
                </CardHeader>
                <CardContent className="pt-5">
                  <dl className="grid gap-x-8 gap-y-5 md:grid-cols-2">
                    {infoFields.map((field) => {
                      const value = req.fieldValues[field.id];
                      return (
                        <div key={field.id} className={cn("space-y-1.5 min-w-0", field.type === "textarea" && "md:col-span-2")}>
                          <dt className="flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase break-words [overflow-wrap:anywhere]">
                            {field.label}
                            {!field.required && <span className="font-normal tracking-normal normal-case">(optional)</span>}
                          </dt>
                          <dd className="text-sm leading-relaxed text-foreground break-words [overflow-wrap:anywhere] [word-break:break-word] whitespace-pre-wrap min-w-0">
                            {value ? value : <span className="text-muted-foreground italic">Not provided</span>}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
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

            {/* Documents */}
            <TabsContent value="documents" className="space-y-5 pt-4">
              <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
                <CardHeader className="border-b border-border/70 pb-3">
                  <CardTitle className="font-heading text-lg font-medium">Submitted Documents &amp; Photos</CardTitle>
                  <p className="text-xs text-muted-foreground">Open a preview to inspect each file.</p>
                </CardHeader>
                <CardContent className="divide-y divide-border/70 pt-2">
                  {fileFields.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">This form had no document uploads.</p>}
                  {fileFields.map((field) => {
                    const files = req.uploads[field.id] ?? [];
                    return (
                      <div key={field.id} className="space-y-2.5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{field.label}</p>
                          <span className="text-[11px] text-muted-foreground">{field.required ? "Required" : "Optional"}</span>
                        </div>
                        {files.length === 0 && <p className="text-xs text-muted-foreground italic">No file uploaded</p>}
                        {files.map((file) => (
                          <div key={file.id} className="flex items-center gap-3 rounded-xl border border-border/80 bg-muted/30 px-3.5 py-2.5">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
                              {/\.(jpe?g|png)$/i.test(file.name) ? <FileImage className="size-4 text-sky-600" /> : <FileText className="size-4 text-rose-600" />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                              <p className="text-[11px] text-muted-foreground">{formatFileSize(file.size)} · uploaded {formatDate(file.uploadedAt)}</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setPreview(file)}>
                              <Eye />
                              Preview
                            </Button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {(req.deposit.receipt || req.approvalLetter) && (
                <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
                  <CardHeader className="border-b border-border/70 pb-3">
                    <CardTitle className="font-heading text-lg font-medium">Staff Documents</CardTitle>
                    <p className="text-xs text-muted-foreground">Associated with deposit and final completion.</p>
                  </CardHeader>
                  <CardContent className="space-y-2.5 pt-4">
                    {req.deposit.receipt && (
                      <StaffFile label="Deposit payment receipt" staffOnly file={req.deposit.receipt} onPreview={setPreview} />
                    )}
                    {req.approvalLetter && <StaffFile label="Final approval letter" file={req.approvalLetter} onPreview={setPreview} />}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Decisions & deposit */}
            <TabsContent value="decisions" className="space-y-5 pt-4">
              <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
                <CardHeader className="border-b border-border/70 pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="font-heading text-lg font-medium">Review Decision</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {owner ? `Assigned reviewer: ${owner.name}.` : "No reviewer assigned yet."}
                      </p>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 pt-5">
                  {req.status === "rejected" && req.rejectionReason && (
                    <div className="rounded-xl border border-rose-300/70 bg-rose-50 p-4 dark:border-rose-900/70 dark:bg-rose-950/30">
                      <p className="flex items-center gap-2 text-sm font-semibold text-rose-950 dark:text-rose-200">
                        <XCircle className="size-4" aria-hidden="true" /> Rejection reason
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-rose-900/90 dark:text-rose-300/90">{req.rejectionReason}</p>
                    </div>
                  )}
                  {(req.status === "changes_required" || req.status === "resubmitted") && (
                    <div className="rounded-xl border border-amber-300/70 bg-amber-50 p-4 dark:border-amber-800/70 dark:bg-amber-950/30">
                      <p className="flex items-center gap-2 text-sm font-semibold text-amber-950 dark:text-amber-200">
                        <FileEdit className="size-4" aria-hidden="true" />
                        {req.status === "resubmitted" ? "Resident resubmitted corrections" : `Revision requested · ${flaggedCount} flagged item${flaggedCount === 1 ? "" : "s"}`}
                      </p>
                      <p className="mt-1.5 text-sm text-amber-900/90 dark:text-amber-300/90">{req.feedback}</p>
                    </div>
                  )}
                  {["approved", "completed"].includes(req.status) && req.decidedAt && (
                    <div className="rounded-xl border border-emerald-300/70 bg-emerald-50 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/30">
                      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-950 dark:text-emerald-200">
                        <CheckCircle2 className="size-4" aria-hidden="true" /> Approved on {formatDate(req.decidedAt)}
                      </p>
                    </div>
                  )}
                  {req.status === "submitted" && (
                    <p className="text-sm text-muted-foreground">This request is newly submitted and awaiting review.</p>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-5 lg:grid-cols-2">
                <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
                  <CardHeader className="border-b border-border/70 pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="font-heading text-lg font-medium">Deposit</CardTitle>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-900 uppercase dark:bg-amber-950/40 dark:text-amber-300">
                        <Lock className="size-2.5" /> Staff only
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-5">
                    {!req.deposit.required ? (
                      <p className="text-sm text-muted-foreground">
                        {req.decidedAt ? "This request does not require a deposit." : "Deposit requirement is recorded after approval."}
                      </p>
                    ) : (
                      <dl className="space-y-3">
                        <InfoRow label="Amount">
                          <span className="font-mono text-lg font-bold">${req.deposit.amount?.toLocaleString()}</span>
                        </InfoRow>
                        <InfoRow label="Status">
                          <DepositChip deposit={{ ...req.deposit, amount: undefined }} />
                        </InfoRow>
                        {req.deposit.receivedAt && <InfoRow label="Received">{formatDateTime(req.deposit.receivedAt)}</InfoRow>}
                        {req.deposit.receipt && (
                          <InfoRow label="Receipt">
                            <button
                              type="button"
                              onClick={() => setPreview(req.deposit.receipt!)}
                              className="inline-flex items-center gap-1.5 text-primary hover:underline dark:text-amber-300"
                            >
                              <ReceiptText className="size-3.5" />
                              {req.deposit.receipt.name}
                            </button>
                          </InfoRow>
                        )}
                      </dl>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
                  <CardHeader className="border-b border-border/70 pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="font-heading text-lg font-medium">Refund Outcome</CardTitle>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-900 uppercase dark:bg-amber-950/40 dark:text-amber-300">
                        <Lock className="size-2.5" /> Staff only
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-5">
                    {!req.refund ? (
                      <p className="text-sm text-muted-foreground">
                        {req.deposit.status === "received" && req.status !== "withdrawn"
                          ? "A refund outcome is only recorded if the request is withdrawn after a deposit is received."
                          : "No refund applies to this request."}
                      </p>
                    ) : (
                      <dl className="space-y-3">
                        <InfoRow label="Outcome">
                          <RefundChip refund={req.refund} />
                        </InfoRow>
                        {req.refund.outcome === "no_refund" && (
                          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">“-” means No Refund.</span> A refund is not applicable or not agreed.
                          </p>
                        )}
                        <InfoRow label="Recorded by">{req.refund.recordedBy}</InfoRow>
                        {req.refund.proof && (
                          <InfoRow label="Proof">
                            <button type="button" onClick={() => setPreview(req.refund!.proof!)} className="inline-flex items-center gap-1.5 text-primary hover:underline dark:text-amber-300">
                              <ReceiptText className="size-3.5" />
                              {req.refund.proof.name}
                            </button>
                          </InfoRow>
                        )}
                        <InfoRow label={req.refund.outcome === "refunded" ? "Refund date" : "Recorded on"}>{formatDateTime(req.refund.date)}</InfoRow>
                        <p className="text-[11px] text-muted-foreground">{REFUND_LABEL[req.refund.outcome]}</p>
                      </dl>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
                <CardHeader className="border-b border-border/70 pb-3">
                  <CardTitle className="font-heading text-lg font-medium">Approval Letter</CardTitle>
                  <p className="text-xs text-muted-foreground">Final approval letter sent to the resident.</p>
                </CardHeader>
                <CardContent className="pt-5">
                  {!req.approvalLetter ? (
                    <p className="text-sm text-muted-foreground">No final approval letter has been uploaded yet.</p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-muted/30 px-3.5 py-3">
                        <FileCheck2 className="size-5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{req.approvalLetter.name}</p>
                          <p className="text-[11px] text-muted-foreground">{formatFileSize(req.approvalLetter.size)}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setPreview(req.approvalLetter!)}>
                          <Eye />
                          View
                        </Button>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl border border-emerald-300/70 bg-emerald-50 px-3.5 py-3 text-sm dark:border-emerald-900/70 dark:bg-emerald-950/30">
                        <Mail className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                        <div>
                          <p className="font-semibold">Emailed to resident</p>
                          <p className="text-[11px] text-muted-foreground">{req.letterEmail ? formatDateTime(req.letterEmail.at) : "Sent on completion"}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* History */}
            <TabsContent value="history" className="pt-4">
              <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
                <CardHeader className="border-b border-border/70 pb-3">
                  <CardTitle className="font-heading text-lg font-medium">Activity Timeline</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Most recent to oldest. Every event records the action, the person, date and time, and relevant details.
                  </p>
                </CardHeader>
                <CardContent className="pt-5">
                  <HistoryTimeline events={req.history} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AssignReviewerDialog request={assigning} onOpenChange={(o) => !o && setAssigning(null)} />
      <FilePreviewDialog file={preview} open={!!preview} onOpenChange={(o) => !o && setPreview(null)} />
    </div>
  );
}
