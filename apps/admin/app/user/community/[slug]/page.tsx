import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { requireAuthToken } from "@/lib/auth";
import { getGroupBySlug, serializeCommunity } from "@/lib/community";
import CommunityDetailClient from "@/components/community/community-detail-client";

export const dynamic = "force-dynamic";

export default async function CommunityDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  const group = await getGroupBySlug(params.slug);
  if (!group) notFound();

  const community = await serializeCommunity(group, auth?.userId ?? null);

  return (
    <section className="user-page-section">
      <CommunityDetailClient initialCommunity={community} isAuthed={Boolean(auth)} />
    </section>
  );
}
