import { SkeletonPageHeader, SkeletonTable } from "@/components/skeleton";

export default function WatchlistLoading() {
  return (
    <section>
      <SkeletonPageHeader titleWidth={140} />
      <SkeletonTable cols={6} rows={8} />
    </section>
  );
}
