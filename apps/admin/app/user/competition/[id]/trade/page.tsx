import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

/** Legacy trading route — redirect to prediction competition detail */
export default async function UserCompetitionTradeRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/user/competition/${id}`);
}
