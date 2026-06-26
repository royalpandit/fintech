import { redirect } from "next/navigation";

export default function CompetitionWinnersRedirect() {
  redirect("/super-admin/competition/list");
}
