import MarketPostDetailView from "@/components/views/market-post-detail-view";

export default function SuperAdminMarketPostDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  return (
    <MarketPostDetailView
      postId={id}
      advisorHrefPrefix="/super-admin/advisors"
      backHref="/super-admin/market-posts"
    />
  );
}
