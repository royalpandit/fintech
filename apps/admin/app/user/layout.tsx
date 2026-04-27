import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import UserShell from "@/components/user-shell";

// Guests can browse user-facing pages without an account.
// Auth-only roles (advisor, admin, super_admin) get punted to their own consoles.
export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);

  // Bounce non-user roles to their own consoles
  if (auth) {
    if (auth.role === "super_admin") redirect("/super-admin/dashboard");
    if (auth.role === "admin") redirect("/admin/dashboard");
    if (auth.role === "advisor") {
      const profile = await prisma.advisorProfile.findUnique({
        where: { userId: auth.userId },
        select: { verificationStatus: true },
      });
      redirect(profile?.verificationStatus === "approved" ? "/advisor/dashboard" : "/advisor/pending");
    }
  }

  // Guest OR regular user — both see this shell
  let user: { fullName: string; email: string } | null = null;
  let unreadNotifications = 0;

  if (auth) {
    const [u, unread] = await Promise.all([
      prisma.user.findUnique({
        where: { id: auth.userId },
        select: { fullName: true, email: true, status: true },
      }),
      prisma.notification.count({ where: { userId: auth.userId, readAt: null } }),
    ]);

    if (u && u.status !== "suspended") {
      user = { fullName: u.fullName, email: u.email };
      unreadNotifications = unread;
    }
  }

  return (
    <UserShell currentUser={user} unreadNotifications={unreadNotifications}>
      {children}
    </UserShell>
  );
}
