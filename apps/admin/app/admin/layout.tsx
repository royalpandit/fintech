import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ModeratorShell from "../../components/moderator-shell";
import { requireAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");

  if (auth.role === "super_admin") redirect("/super-admin/dashboard");

  if (auth.role !== "admin") {
    if (auth.role === "advisor") {
      const profile = await prisma.advisorProfile.findUnique({
        where: { userId: auth.userId },
        select: { verificationStatus: true },
      });
      redirect(profile?.verificationStatus === "approved" ? "/advisor/dashboard" : "/advisor/pending");
    }
    redirect("/user/home");
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { fullName: true, email: true, role: true, status: true },
  });

  if (!user || user.status === "suspended") redirect("/login");

  return (
    <ModeratorShell
      currentUser={{
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      }}
    >
      {children}
    </ModeratorShell>
  );
}
