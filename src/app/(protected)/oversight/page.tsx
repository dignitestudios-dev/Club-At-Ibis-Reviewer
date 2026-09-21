import OversightPage from "@/features/requests/components/oversight-page";
import { PageSuspense } from "@/components/shared/page-suspense";

export const metadata = { title: "Request Oversight · Club At Ibis Reviewer" };

export default function Page() {
  return (
    <PageSuspense>
      <OversightPage />
    </PageSuspense>
  );
}
