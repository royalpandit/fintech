import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireAuthToken } from "@/lib/auth";
import { canUserCreatePost, getGroupBySlug } from "@/lib/community";
import CreateCommunityPostForm from "@/components/community/create-community-post-form";

export const dynamic = "force-dynamic";

export default async function CreateCommunityPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect(`/login?next=/user/community/${params.slug}/new`);

  const group = await getGroupBySlug(params.slug);
  if (!group) notFound();

  const canPost = await canUserCreatePost(group, auth.userId);
  if (!canPost) redirect(`/user/community/${params.slug}`);

  return (
    <section className="user-page-section">
      <CreateCommunityPostForm slug={params.slug} communityName={group.name} />
    </section>
  );
}
