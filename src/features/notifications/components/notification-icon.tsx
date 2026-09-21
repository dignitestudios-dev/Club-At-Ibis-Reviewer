import { AlertTriangle, CheckCircle2, FileDiff, Inbox, Repeat2, UserRoundCheck, UserX, type LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";

const CONFIG: Record<ReviewerNotificationType, { icon: LucideIcon; className: string; label: string }> = {
  new_assignment: {
    icon: UserRoundCheck,
    className: "bg-sky-50 dark:bg-sky-950/40 border-sky-200/70 dark:border-sky-800/60 text-sky-700 dark:text-sky-300",
    label: "New assignment",
  },
  incoming_request: {
    icon: Inbox,
    className: "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200/70 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300",
    label: "Incoming request",
  },
  form_updated: {
    icon: FileDiff,
    className: "bg-teal-50 dark:bg-teal-950/40 border-teal-200/70 dark:border-teal-800/60 text-teal-700 dark:text-teal-300",
    label: "Form updated",
  },
  resubmission: {
    icon: Repeat2,
    className: "bg-purple-50 dark:bg-purple-950/40 border-purple-200/70 dark:border-purple-800/60 text-purple-700 dark:text-purple-300",
    label: "Resubmission",
  },
  request_update: {
    icon: CheckCircle2,
    className: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/70 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300",
    label: "Request update",
  },
  withdrawal: {
    icon: UserX,
    className: "bg-slate-100 dark:bg-slate-800 border-slate-200/70 dark:border-slate-700 text-slate-700 dark:text-slate-300",
    label: "Withdrawal",
  },
  action_required: {
    icon: AlertTriangle,
    className: "bg-amber-50 dark:bg-amber-950/40 border-amber-300/70 dark:border-amber-800/60 text-amber-700 dark:text-amber-300",
    label: "Needs attention",
  },
};

export const NOTIFICATION_LABEL: Record<ReviewerNotificationType, string> = Object.fromEntries(
  Object.entries(CONFIG).map(([k, v]) => [k, v.label])
) as Record<ReviewerNotificationType, string>;

export function NotificationIcon({ type, className }: { type: ReviewerNotificationType; className?: string }) {
  const { icon: Icon, className: tone } = CONFIG[type];
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl border", tone, className)}>
      <Icon className="size-4" aria-hidden="true" />
    </span>
  );
}
