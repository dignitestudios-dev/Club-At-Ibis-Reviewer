"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { downloadRequestsCsv } from "@/lib/csv-export";

/**
 * Exports every request the reviewer may export that matches the list's current search and filters (not just the
 * visible page). With nothing matching, no file is created and a message explains why; a failure can be retried
 * by pressing the button again.
 */
export function ExportCsvButton({ filters }: { filters: object }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    const outcome = await downloadRequestsCsv("/reviewer/reports/requests.csv", filters);
    setBusy(false);
    if (outcome.ok) {
      toast.success("Export ready", "The CSV of all matching requests was downloaded.");
    } else if (outcome.kind === "no_matches") {
      toast.warning("Nothing to export", outcome.message);
    } else {
      toast.error("Export failed", `${outcome.message} Press Export CSV to try again.`);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={busy}
      className="h-8 gap-1.5"
      title="Download every request matching the current search and filters as a CSV file"
    >
      {busy ? <Spinner className="size-3.5" /> : <Download className="size-3.5" aria-hidden="true" />}
      <span>Export CSV</span>
    </Button>
  );
}
