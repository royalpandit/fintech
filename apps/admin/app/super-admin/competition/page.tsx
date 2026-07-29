import { redirect } from "next/navigation";

export default function CompetitionAdminIndex() {
  redirect("/super-admin/competition/list");
}
