import DashboardOverview from "@/features/dashboard/components/dashboard-overview";
import { PageSuspense } from "@/components/shared/page-suspense";

export const metadata = { title: "Dashboard · Club At Ibis Reviewer" };

export default function Page() {
  return (
    <PageSuspense>
      <DashboardOverview />
    </PageSuspense>
  );
}
