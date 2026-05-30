import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { requireAuthToken } from "@/lib/auth";
import { getGroupBySlug } from "@/lib/community";
import MembersPanel from "@/components/community/members-panel";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CommunityMembersPage({
  params,
}: {
  params: { slug: string };
}) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  const group = await getGroupBySlug(params.slug);
  if (!group) notFound();

  let myRole: string | null = null;
  if (auth) {
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: auth.userId } },
    });
    myRole = member?.role ?? null;
  }

  return (
    <section className="user-page-section">
      <MembersPanel slug={params.slug} communityName={group.name} myRole={myRole} />
    </section>
  );
}
