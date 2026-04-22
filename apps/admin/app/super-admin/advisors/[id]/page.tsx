import AdvisorDetailView from "@/components/views/advisor-detail-view";

export default function SuperAdminAdvisorDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  return <AdvisorDetailView advisorUserId={id} backHref="/super-admin/advisors" />;
}
