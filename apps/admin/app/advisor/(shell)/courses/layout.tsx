import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canType } from "@/lib/capabilities-server";

export const dynamic = "force-dynamic";

/** Blocks deep-links to Courses for professional types without course.sell. */
export default async function AdvisorCoursesLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth || auth.role !== "advisor") redirect("/login");

  const profile = await prisma.advisorProfile.findUnique({
    where: { userId: auth.userId },
    select: { professionalType: true },
  });
  if (!(await canType(profile?.professionalType ?? null, "course.sell"))) {
    redirect("/advisor/dashboard");
  }

  return children;
}
