import FormsPage from "@/features/forms/components/forms-page";
import { PageSuspense } from "@/components/shared/page-suspense";

export const metadata = { title: "Form Updates · Club At Ibis Reviewer" };

export default function Page() {
  return (
    <PageSuspense>
      <FormsPage />
    </PageSuspense>
  );
}
