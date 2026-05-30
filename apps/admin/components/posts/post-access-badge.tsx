import type { PostAccessType } from "@/lib/post-access";

export default function PostAccessBadge({ type }: { type: PostAccessType | string }) {
  if (type === "paid") {
    return <span className="post-access-badge post-access-badge-premium">PREMIUM</span>;
  }
  return <span className="post-access-badge post-access-badge-free">FREE</span>;
}
