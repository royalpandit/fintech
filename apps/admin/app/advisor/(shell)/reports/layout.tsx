import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canType } from "@/lib/capabilities-server";

export const dynamic = "force-dynamic";

/** Blocks deep-links to Reports for types without report.sell. */
export default async function AdvisorReportsLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth || auth.role !== "advisor") redirect("/login");

  const profile = await prisma.advisorProfile.findUnique({
    where: { userId: auth.userId },
    select: { professionalType: true },
  });
  if (!(await canType(profile?.professionalType ?? null, "report.sell"))) {
    redirect("/advisor/dashboard");
  }

  return children;
}
