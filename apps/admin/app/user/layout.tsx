import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth) redirect("/login");

  if (auth.role === "super_admin") redirect("/super-admin/dashboard");
  if (auth.role === "admin") redirect("/admin/dashboard");
  if (auth.role === "advisor") {
    const profile = await prisma.advisorProfile.findUnique({
      where: { userId: auth.userId },
      select: { verificationStatus: true },
    });
    redirect(profile?.verificationStatus === "approved" ? "/advisor/dashboard" : "/advisor/pending");
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { fullName: true },
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f4f7fb" }}>
      <header style={{ padding: "18px 32px", background: "#fff", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Corescent</div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 14, color: "#475569" }}>{user?.fullName}</span>
          <form action="/api/v1/auth/logout" method="POST">
            <button
              type="submit"
              style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid #d1d9e6", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main style={{ padding: 32 }}>{children}</main>
    </div>
  );
}
