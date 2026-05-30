import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireAuthToken } from "@/lib/auth";
import { getGroupBySlug, hasRole, ADMIN_ROLES, serializeCommunity } from "@/lib/community";
import CommunitySettingsForm from "@/components/community/community-settings-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CommunitySettingsPage({
  params,
}: {
  params: { slug: string };
}) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect(`/login?next=/user/community/${params.slug}/settings`);

  const group = await getGroupBySlug(params.slug);
  if (!group) notFound();

  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId: auth.userId } },
  });
  if (!hasRole(member?.role, ADMIN_ROLES)) redirect(`/user/community/${params.slug}`);

  const community = await serializeCommunity(group, auth.userId);

  return (
    <section className="user-page-section">
      <CommunitySettingsForm initialCommunity={community} />
    </section>
  );
}
