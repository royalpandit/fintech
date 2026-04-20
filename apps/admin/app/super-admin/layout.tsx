import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminShell from "../../components/admin-shell";
import { requireAuthToken } from "@/lib/auth";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth || auth.role !== "admin") {
    redirect("/login");
  }

  return <AdminShell>{children}</AdminShell>;
}

