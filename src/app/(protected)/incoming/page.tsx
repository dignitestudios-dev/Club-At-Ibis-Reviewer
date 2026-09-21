import IncomingPage from "@/features/requests/components/incoming-page";
import { PageSuspense } from "@/components/shared/page-suspense";

export const metadata = { title: "Incoming Requests · Club At Ibis Reviewer" };

export default function Page() {
  return (
    <PageSuspense>
      <IncomingPage />
    </PageSuspense>
  );
}
