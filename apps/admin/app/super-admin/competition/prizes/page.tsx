import { redirect } from "next/navigation";

export default function CompetitionPrizesRedirect() {
  redirect("/super-admin/competition/list");
}
