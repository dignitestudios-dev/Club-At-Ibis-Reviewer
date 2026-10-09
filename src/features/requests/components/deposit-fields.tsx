"use client";

import { useId } from "react";
import { AlertCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** There is no "undecided": unchecked simply means no deposit is required. */
export interface DepositValue {
  required: boolean;
  amount: string;
}

/**
 * Has the reviewer answered "deposit required?" yet? The backend sends `required: null` until they do
 * (and the fallback mapper sets `confirmed: false`), so a plain `not_required` status is NOT an answer.
 */
export function isDepositConfigured(deposit?: { required?: boolean | null; confirmed?: boolean } | null): boolean {
  if (!deposit) return false;
  if (deposit.required === true) return true;
  return deposit.required === false && deposit.confirmed !== false;
}

/** Configured, and (when required) it is marked as received — i.e. nothing left to do for the deposit. */
export function isDepositSatisfied(deposit?: { required?: boolean | null; confirmed?: boolean; status?: string } | null): boolean {
  if (!isDepositConfigured(deposit)) return false;
  return deposit!.required === false || deposit!.status === "received";
}

/** "$250.00", or null when no amount was set (it is optional). */
export function formatDepositAmount(amount?: number | string | null): string | null {
  if (amount === null || amount === undefined || amount === "") return null;
  const n = Number(amount);
  if (Number.isNaN(n)) return null;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** The PATCH /deposit body fields: `amount` is only sent when a deposit is required AND an amount was entered. */
export function depositPayload(value: DepositValue): { depositRequired: boolean; amount?: string } {
  const amount = value.amount.trim();
  return value.required ? { depositRequired: true, ...(amount ? { amount } : {}) } : { depositRequired: false };
}

/** Returns an error message, or null when the value can be sent to the backend as-is. */
export function validateDeposit(value: DepositValue): string | null {
  if (!value.required) return null;
  const trimmed = value.amount.trim();
  // The amount is optional; only check it when one was entered.
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (Number.isNaN(num) || num <= 0) return "Enter a valid amount greater than $0.";
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return "Amount can have at most 2 decimal places.";
  return null;
}

/**
 * The one place the deposit is entered (approve dialog + edit dialog). Deliberately not a yes/no question:
 * a single checkbox — checked means a deposit is required, unchecked means none, and the text says so.
 */
export function DepositFields({
  value,
  onChange,
  error,
  disabled,
}: {
  value: DepositValue;
  onChange: (next: DepositValue) => void;
  error?: string | null;
  disabled?: boolean;
}) {
  const checkId = useId();
  const amountId = useId();

  return (
    <div className="space-y-3">
      <label
        htmlFor={checkId}
        className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors hover:bg-muted/40"
      >
        <Checkbox
          id={checkId}
          checked={value.required}
          disabled={disabled}
          className="mt-0.5"
          onCheckedChange={(checked) => onChange({ required: checked === true, amount: checked === true ? value.amount : "" })}
        />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">Yes, a deposit is required</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Leave this unchecked if no deposit is needed — the project will be recorded as{" "}
            <span className="font-semibold text-foreground">No deposit required</span>.
          </span>
        </span>
      </label>

      {value.required && (
        <div className="w-full space-y-1.5">
          <Label htmlFor={amountId} className="text-sm font-medium">
            Deposit amount (USD) <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <div className="relative">
            <span className="absolute top-2.5 left-3 text-sm text-muted-foreground">$</span>
            <Input
              id={amountId}
              type="text"
              inputMode="decimal"
              placeholder="250.00"
              value={value.amount}
              disabled={disabled}
              maxLength={12}
              className="pl-7 font-mono"
              aria-invalid={!!error}
              onChange={(e) => onChange({ ...value, amount: e.target.value })}
              onBlur={() => {
                const t = value.amount.trim();
                if (t && !Number.isNaN(Number(t)) && Number(t) > 0) onChange({ ...value, amount: Number(t).toFixed(2) });
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
