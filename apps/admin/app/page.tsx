import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);

  // Guests can browse the public user home — no forced login.
  if (!auth) redirect("/user/home");

  if (auth.role === "super_admin") redirect("/super-admin/dashboard");
  if (auth.role === "admin") redirect("/admin/dashboard");

  if (auth.role === "advisor") {
    const profile = await prisma.advisorProfile.findUnique({
      where: { userId: auth.userId },
      select: { verificationStatus: true },
    });
    redirect(profile?.verificationStatus === "approved" ? "/advisor/dashboard" : "/advisor/pending");
  }

  redirect("/user/home");
}
