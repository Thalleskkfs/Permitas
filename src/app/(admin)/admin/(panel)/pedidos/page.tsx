import { DashboardContainer } from "@/components/dashboard/DashboardContainer";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { RequestTable } from "@/components/dashboard/RequestTable";
import { getRequests } from "@/modules/dashboard/mock";

export default function SolicitacoesPage() {
  return (
    <DashboardContainer className="flex flex-col gap-6">
      <PageHeader
        title="Solicitações"
        description="Pedidos de contato recebidos pelo WhatsApp. O valor é estimado e a negociação acontece na conversa."
      />
      <RequestTable requests={getRequests()} />
    </DashboardContainer>
  );
}
