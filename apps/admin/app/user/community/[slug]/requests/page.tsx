import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireAuthToken } from "@/lib/auth";
import { getGroupBySlug, hasRole, ADMIN_ROLES } from "@/lib/community";
import JoinRequestsPanel from "@/components/community/join-requests-panel";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CommunityRequestsPage({
  params,
}: {
  params: { slug: string };
}) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect(`/login?next=/user/community/${params.slug}/requests`);

  const group = await getGroupBySlug(params.slug);
  if (!group) notFound();

  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId: auth.userId } },
  });
  if (!hasRole(member?.role, ADMIN_ROLES)) redirect(`/user/community/${params.slug}`);

  return (
    <section className="user-page-section">
      <JoinRequestsPanel slug={params.slug} communityName={group.name} />
    </section>
  );
}
