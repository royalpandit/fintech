import CompetitionFormPage from "@/components/competition/competition-form";

type Props = { params: Promise<{ id: string }> };

export default async function EditCompetitionPage({ params }: Props) {
  const { id } = await params;
  return <CompetitionFormPage competitionId={id} />;
}
