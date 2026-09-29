import { useQuery } from "@tanstack/react-query";
import { getReviewerDashboard } from "./dashboard.service";

export function useReviewerDashboard() {
  return useQuery({
    queryKey: ["dashboard", "reviewer"],
    queryFn: getReviewerDashboard,
    staleTime: 30_000,
  });
}
