import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Root advisor layout: auth + role check only. No UI chrome.
// Chrome is applied by the (shell) route group for approved advisors,
// and by /advisor/pending/page.tsx directly for unapproved ones.
export default async function AdvisorRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");

  if (auth.role !== "advisor") {
    if (auth.role === "super_admin") redirect("/super-admin/dashboard");
    if (auth.role === "admin") redirect("/admin/dashboard");
    redirect("/user/home");
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { status: true },
  });
  if (!user || user.status === "suspended") redirect("/login");

  return <>{children}</>;
}
