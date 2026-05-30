import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuthToken } from "@/lib/auth";
import CreateCommunityForm from "@/components/community/create-community-form";

export const dynamic = "force-dynamic";

export default async function CreateCommunityPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login?next=/user/community/create");

  return (
    <section className="user-page-section">
      <CreateCommunityForm />
    </section>
  );
}
