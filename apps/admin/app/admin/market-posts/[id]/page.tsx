import MarketPostDetailView from "@/components/views/market-post-detail-view";

export default function AdminMarketPostDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  return (
    <MarketPostDetailView
      postId={id}
      advisorHrefPrefix="/admin/advisors"
      backHref="/admin/market-posts"
    />
  );
}
