import type { Metadata } from "next";
import FormComparePage from "@/features/forms/components/form-compare-page";
import { PageSuspense } from "@/components/shared/page-suspense";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Form Comparison ${id ? `#${id.slice(0, 8)}` : ""} · Club At Ibis Reviewer`,
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageSuspense>
      <FormComparePage id={id} />
    </PageSuspense>
  );
}
