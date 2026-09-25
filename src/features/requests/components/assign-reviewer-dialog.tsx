"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { UserRoundCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { SearchInput } from "@/components/shared/search-input";
import { useAssignRequest, useReviewers } from "@/hooks/use-reviewer-data";
import { useDebounce } from "@/hooks/use-debounce";
import { useMe } from "@/hooks/use-current-user";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/utils/cn";

/** A default reviewer takes ownership of an incoming request, assigns it, or reassigns one in progress. */
export function AssignReviewerDialog({
  request,
  onOpenChange,
}: {
  request: RequestRecord | null;
  onOpenChange: (open: boolean) => void;
}) {
  const toast = useToast();
  const assign = useAssignRequest();
  const isSubmittingRef = useRef(false);
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const debouncedSearch = useDebounce(query.trim(), 250);
  const { data: reviewers, isLoading: isLoadingReviewers, isFetching: isFetchingReviewers } = useReviewers({
    search: debouncedSearch || undefined,
    limit: 50,
  });
  const { me } = useMe();

  useEffect(() => {
    if (request) {
      setSelected("");
      setQuery("");
    }
  }, [request]);

  const options = (reviewers ?? []).sort((a, b) => a.name.localeCompare(b.name));

  if (!request) return null;
  const current = request.assignedReviewerId ? reviewers?.find((r) => r.id === request.assignedReviewerId) : undefined;
  const chosen = reviewers?.find((r) => r.id === selected);
  const isSelf = chosen?.id === me?.id;

  function submit() {
    if (!request || !chosen || isSubmittingRef.current || assign.isPending) return;
    isSubmittingRef.current = true;
    assign.mutate(
      {
        requestId: request.id,
        reviewerId: chosen.id,
        expectedAssignmentVersion: request.assignmentVersion ?? 0,
      },
      {
        onSuccess: () => {
          isSubmittingRef.current = false;
          toast.success(current ? "Request reassigned" : isSelf ? "Ownership taken" : "Request assigned", isSelf ? `${request.code} is now yours.` : `${request.code} is now with ${chosen.name}.`);
          onOpenChange(false);
        },
        onError: (e: Error) => {
          isSubmittingRef.current = false;
          toast.error("Could not assign", e.message);
        },
        onSettled: () => {
          isSubmittingRef.current = false;
        },
      }
    );
  }

  return (
    <Dialog open={!!request} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg w-full max-w-[calc(100vw-2rem)] overflow-hidden">
        <DialogHeader>
          <div className="mb-1 flex size-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary dark:text-amber-300">
            <UserRoundCheck className="size-5" aria-hidden="true" />
          </div>
          <DialogTitle className="font-heading text-xl font-medium">{current ? "Reassign Request" : "Take Ownership or Assign"}</DialogTitle>
          <DialogDescription className="break-words">
            <span className="font-mono font-semibold text-foreground">{request.code}</span> · {request.categoryName}.{" "}
            {current
              ? `Currently with ${current.name}. After reassignment they lose authority to act on it; earlier actions stay in the history.`
              : "Choose the reviewer who becomes the request's single owner — pick yourself to take ownership."}
          </DialogDescription>
        </DialogHeader>

        <div className="relative w-full min-w-0">
          <SearchInput value={query} onChange={setQuery} placeholder="Search active reviewers by name, designation, employee number…" />
          {isFetchingReviewers && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Spinner className="size-4 text-muted-foreground" />
            </div>
          )}
        </div>

        <RadioGroup value={selected} onValueChange={(v) => setSelected(String(v))} className="grid max-h-64 w-full min-w-0 max-w-full gap-2 overflow-y-auto overflow-x-hidden pr-1 custom-scrollbar">
          {isLoadingReviewers && options.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="size-6 text-primary" />
            </div>
          ) : options.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No active reviewers match.</p>
          ) : (
            options.map((r) => {
            const isCurrent = r.id === request.assignedReviewerId;
            return (
              <label
                key={r.id}
                className={cn(
                  "flex w-full min-w-0 max-w-full box-border items-center gap-3 rounded-xl border p-3 transition-colors overflow-hidden",
                  isCurrent ? "cursor-not-allowed opacity-55" : "cursor-pointer",
                  selected === r.id ? "border-primary bg-primary/5 dark:border-amber-400 dark:bg-amber-400/5" : "border-border hover:border-foreground/30"
                )}
              >
                <div className="shrink-0 flex items-center">
                  <RadioGroupItem value={r.id} disabled={isCurrent} />
                </div>
                <div className="shrink-0">
                  <PersonAvatar name={r.name} />
                </div>
                <span className="min-w-0 flex-1 overflow-hidden">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">{r.name}{r.id === me?.id && <span className="font-normal text-muted-foreground"> (you)</span>}</span>
                    {r.receiveNewRequests && <span className="shrink-0 rounded-full bg-brand-gold/15 px-1.5 py-px text-[9px] font-bold tracking-wider text-brand-gold uppercase">Default</span>}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground font-mono">{r.email}</span>
                  {r.designation && <span className="block truncate text-[11px] text-muted-foreground/80">{r.designation}</span>}
                </span>
                {isCurrent ? (
                  <span className="shrink-0 text-right text-xs font-semibold text-foreground">Current</span>
                ) : (r as any).activeRequestsCount !== undefined ? (
                  <span className="shrink-0 text-right text-xs text-muted-foreground">
                    <span className="font-semibold tabular-nums text-foreground">{(r as any).activeRequestsCount}</span> active
                  </span>
                ) : null}
              </label>
            );
          }))}
        </RadioGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!selected || assign.isPending}>
            {assign.isPending && <Spinner className="size-4" />}
            {chosen ? (isSelf && !current ? "Take ownership" : `${current ? "Reassign" : "Assign"} to ${chosen.name.split(" ")[0]}`) : current ? "Reassign" : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
