import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuthToken } from "@/lib/auth";
import EditPostForm from "./edit-form";

export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: { id: string } }) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");

  const postId = Number(params.id);
  if (!Number.isFinite(postId)) notFound();

  const post = await prisma.marketPost.findFirst({
    where: { id: postId, advisorUserId: auth.userId, deletedAt: null },
  });

  if (!post) notFound();

  if (post.complianceStatus === "approved") {
    redirect(`/advisor/posts/${postId}`);
  }

  return (
    <EditPostForm
      postId={postId}
      initial={{
        title: post.title,
        content: post.content,
        marketSymbol: post.marketSymbol ?? "",
        timeframe: post.timeframe ?? "",
        targetPrice: post.targetPrice ? String(post.targetPrice) : "",
        stopLossPrice: post.stopLossPrice ? String(post.stopLossPrice) : "",
        disclaimer: post.disclaimer,
      }}
    />
  );
}
