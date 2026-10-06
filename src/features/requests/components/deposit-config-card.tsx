"use client";

import { useState, useEffect } from "react";
import { DollarSign, UploadCloud, CheckCircle2, AlertCircle, Edit2, Lock, ReceiptText, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useSetDepositRequirement, keys } from "@/hooks/use-reviewer-data";
import { DepositChip } from "./request-chips";
import { formatDepositAmount, isDepositConfigured } from "./deposit-fields";

import { formatDateTime } from "@/utils/format";
import { UploadReceiptDialog } from "./upload-receipt-dialog";

interface DepositConfigCardProps {
  request: RequestRecord;
  isOwner: boolean;
  onPreviewFile?: (file: AttachedFile) => void;
  /** Actions live in the Finalize panel; this card only shows the record. */
  readOnly?: boolean;
}

export function DepositConfigCard({ request, isOwner, onPreviewFile, readOnly = false }: DepositConfigCardProps) {
  const toast = useToast();
  const qc = useQueryClient();
  const setDepositMutation = useSetDepositRequirement();

  const isApproved = request.status === "approved";
  const canEdit = isOwner && isApproved && !readOnly;

  const [isEditing, setIsEditing] = useState(false);
  const [depositRequired, setDepositRequired] = useState<boolean>(
    request.deposit?.required ?? false
  );
  const [amount, setAmount] = useState<string>(
    request.deposit?.amount != null ? String(request.deposit.amount) : ""
  );
  const [uploadReceiptOpen, setUploadReceiptOpen] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);

  // Sync state when request prop updates
  useEffect(() => {
    if (!isEditing) {
      setDepositRequired(request.deposit?.required ?? false);
      setAmount(request.deposit?.amount != null ? String(request.deposit.amount) : "");
    }
  }, [request.deposit, isEditing]);

  const hasConfiguredDeposit = isDepositConfigured(request.deposit);

  function validateAmount(val: string): boolean {
    if (!depositRequired) {
      setAmountError(null);
      return true;
    }
    const trimmed = val.trim();
    if (!trimmed) {
      setAmountError(null);
      return true;
    }
    const num = Number(trimmed);
    if (isNaN(num) || num <= 0) {
      setAmountError("Please enter a valid amount greater than $0.");
      return false;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
      setAmountError("Amount can have at most 2 decimal places.");
      return false;
    }
    setAmountError(null);
    return true;
  }

  async function handleSaveDeposit() {
    if (!validateAmount(amount)) return;

    try {
      await setDepositMutation.mutateAsync({
        requestId: request.id,
        expectedAssignmentVersion: request.assignmentVersion ?? 0,
        expectedWorkflowVersion: request.workflowVersion ?? 1,
        depositRequired,
        amount: depositRequired && amount.trim() ? amount.trim() : undefined,
      });

      toast.success(
        "Deposit requirement saved",
        depositRequired
          ? `Deposit of $${Number(amount).toFixed(2)} recorded.`
          : "Request marked as no deposit required."
      );
      setIsEditing(false);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        toast.error("Conflict", "The request was updated elsewhere. Refreshed to latest state.");
        qc.invalidateQueries({ queryKey: keys.requestDetail(request.id) });
      } else {
        toast.error("Failed to save deposit requirement", err?.response?.data?.message || err?.message);
      }
    }
  }

  return (
    <>
      <Card className="rounded-xl border border-border/70 bg-transparent shadow-none ring-0">
        <CardHeader className="border-b border-border/70 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="font-heading text-lg font-medium flex items-center gap-2">
                <DollarSign className="size-5 text-amber-600 dark:text-amber-400" />
                Deposit Requirement
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Specify whether a security deposit is required for this approved project.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-900 uppercase dark:bg-amber-950/40 dark:text-amber-300">
                <Lock className="size-2.5" /> Staff only
              </span>
              {canEdit && !isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="h-8 gap-1 text-xs"
                >
                  <Edit2 className="size-3.5" />
                  {hasConfiguredDeposit ? "Edit Deposit" : "Configure"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-5">
          {/* Edit Form (for reviewer on approved request) */}
          {canEdit && (isEditing || !hasConfiguredDeposit) ? (
            <div className="space-y-4 rounded-xl border border-amber-300/60 bg-amber-50/40 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">
                  Is a deposit required for this project?
                </Label>
                <RadioGroup
                  value={depositRequired ? "yes" : "no"}
                  onValueChange={(val) => {
                    const req = val === "yes";
                    setDepositRequired(req);
                    if (!req) setAmountError(null);
                  }}
                  className="flex gap-6 pt-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="dep-yes" />
                    <Label htmlFor="dep-yes" className="cursor-pointer font-normal">
                      Yes, deposit required
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="dep-no" />
                    <Label htmlFor="dep-no" className="cursor-pointer font-normal">
                      No deposit required
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {depositRequired && (
                <div className="space-y-1.5 max-w-xs">
                  <Label htmlFor="deposit-amount" className="text-sm font-medium">
                    Deposit Amount ($ USD) <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</span>
                    <Input
                      id="deposit-amount"
                      type="text"
                      inputMode="decimal"
                      placeholder="250.00"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        if (amountError) validateAmount(e.target.value);
                      }}
                      onBlur={() => {
                        if (amount.trim() && !isNaN(Number(amount.trim()))) {
                          setAmount(Number(amount.trim()).toFixed(2));
                        }
                        validateAmount(amount);
                      }}
                      className="pl-7 font-mono"
                      maxLength={12}
                    />
                  </div>
                  {amountError && (
                    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                      <AlertCircle className="size-3.5 shrink-0" />
                      {amountError}
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="button"
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-600 dark:hover:bg-amber-700"
                  onClick={handleSaveDeposit}
                  disabled={setDepositMutation.isPending}
                >
                  {setDepositMutation.isPending ? <Spinner className="size-3.5 mr-1.5" /> : <CheckCircle2 className="size-3.5 mr-1.5" />}
                  Save Deposit Requirement
                </Button>
                {hasConfiguredDeposit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsEditing(false);
                      setDepositRequired(request.deposit?.required ?? false);
                      setAmount(request.deposit?.amount != null ? String(request.deposit.amount) : "");
                      setAmountError(null);
                    }}
                    disabled={setDepositMutation.isPending}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          ) : null}

          {/* Read-Only Summary / Details */}
          {(!canEdit || (hasConfiguredDeposit && !isEditing)) && (
            <div className="space-y-4">
              {isApproved && !hasConfiguredDeposit ? (
                <div className="rounded-xl border border-amber-300/70 bg-amber-50/50 p-3.5 text-xs text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-200">
                  Not set yet. Use the <span className="font-semibold">Finish up this approval</span> panel at the top of the page.
                </div>
              ) : !request.deposit?.required ? (
                <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/20 p-3.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">No Deposit Required</p>
                    <p className="text-xs text-muted-foreground">
                      This project has been approved without a security deposit requirement.
                    </p>
                  </div>
                  <DepositChip deposit={request.deposit} />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-border/80 bg-muted/20 p-3.5">
                    <div>
                      <p className="text-xs text-muted-foreground">Required Amount</p>
                      <p className="font-mono text-xl font-bold text-foreground mt-0.5">
                        {formatDepositAmount(request.deposit.amount) ?? "Not specified"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Payment Status</p>
                      <div className="mt-1">
                        <DepositChip deposit={request.deposit} />
                      </div>
                    </div>
                  </div>

                  {request.deposit.status === "received" ? (
                    <div className="rounded-xl border border-emerald-300/70 bg-emerald-50/50 p-3.5 dark:border-emerald-900/70 dark:bg-emerald-950/20">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-950 dark:text-emerald-200">
                          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                          <span>
                            Deposit Received
                            {request.deposit.receivedAt ? ` · ${formatDateTime(request.deposit.receivedAt)}` : ""}
                          </span>
                        </div>
                      </div>

                      {request.deposit.receipt ? (
                        <div className="mt-2.5 flex items-center justify-between gap-3 rounded-lg border border-emerald-200/80 bg-background/80 p-2.5 dark:border-emerald-900/60">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <ReceiptText className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">
                                {request.deposit.receipt.name}
                              </p>
                              <p className="text-[11px] text-muted-foreground">Staff Payment Receipt</p>
                            </div>
                          </div>
                          {onPreviewFile && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1 shrink-0"
                              onClick={() => onPreviewFile(request.deposit.receipt!)}
                            >
                              <Eye className="size-3" />
                              View
                            </Button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    /* Deposit Required but Pending */
                    <div className="rounded-xl border border-amber-300/70 bg-amber-50/50 p-3.5 dark:border-amber-900/70 dark:bg-amber-950/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-amber-950 dark:text-amber-200">
                          Awaiting Payment Receipt
                        </p>
                        <p className="text-xs text-amber-900/80 dark:text-amber-300/80 mt-0.5">
                          Deposit must be marked received with an uploaded payment receipt before this request can be completed.
                        </p>
                      </div>
                      {canEdit && (
                        <Button
                          type="button"
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-600 dark:hover:bg-amber-700 text-xs shrink-0"
                          onClick={() => setUploadReceiptOpen(true)}
                        >
                          <UploadCloud className="size-3.5 mr-1.5" />
                          Upload Receipt
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <UploadReceiptDialog
        request={request}
        open={uploadReceiptOpen}
        onOpenChange={setUploadReceiptOpen}
      />
    </>
  );
}
