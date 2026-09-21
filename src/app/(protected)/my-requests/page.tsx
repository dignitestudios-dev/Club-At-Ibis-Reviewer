import MyRequestsPage from "@/features/requests/components/my-requests-page";
import { PageSuspense } from "@/components/shared/page-suspense";

export const metadata = { title: "My Assigned Requests · Club At Ibis Reviewer" };

export default function Page() {
  return (
    <PageSuspense>
      <MyRequestsPage />
    </PageSuspense>
  );
}
