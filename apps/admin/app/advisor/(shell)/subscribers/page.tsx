import { redirect } from "next/navigation";

// Subscribers now live inside each Subscription Service (Manage → Subscribers).
export default function AdvisorSubscribersRedirect() {
  redirect("/advisor/services");
}
