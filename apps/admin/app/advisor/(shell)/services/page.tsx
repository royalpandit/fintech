import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuthToken } from "@/lib/auth";
import { advisorServices } from "@/lib/subscription-services";
import ServicesClient from "./services-client";

export const dynamic = "force-dynamic";

export default async function AdvisorServicesPage() {
  const token = cookies().get("access_token")?.value ?? null;
  const auth = await requireAuthToken(token);
  if (!auth || auth.role !== "advisor") redirect("/login");

  const services = await advisorServices(auth.userId);

  return (
    <section>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div>
          <h1 className="page-title">Subscription Services</h1>
          <p className="page-subtitle">
            Offer plans by market or strategy (Long Term Stocks, Options, Commodity…). Each has its own
            subscribers, broadcasts, chats and paid recommendations.
          </p>
        </div>
      </div>
      <ServicesClient initialServices={services} />
    </section>
  );
}
