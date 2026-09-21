import FormComparePage from "@/features/forms/components/form-compare-page";
import { PageSuspense } from "@/components/shared/page-suspense";

export const metadata = { title: "Form Comparison · Club At Ibis Reviewer" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageSuspense>
      <FormComparePage id={id} />
    </PageSuspense>
  );
}
