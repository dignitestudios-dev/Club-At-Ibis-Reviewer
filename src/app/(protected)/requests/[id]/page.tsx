import RequestDetailPage from "@/features/requests/components/request-detail-page";
import { PageSuspense } from "@/components/shared/page-suspense";

export const metadata = { title: "Request · Club At Ibis Reviewer" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageSuspense>
      <RequestDetailPage id={id} />
    </PageSuspense>
  );
}
