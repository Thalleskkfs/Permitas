import { CustomerTable } from "@/components/dashboard/CustomerTable";
import { DashboardContainer } from "@/components/dashboard/DashboardContainer";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { getCustomers } from "@/modules/dashboard/mock";

export default function ClientesPage() {
  return (
    <DashboardContainer className="flex flex-col gap-6">
      <PageHeader
        title="Clientes"
        description="Pessoas que enviaram solicitações, com o histórico de contatos."
      />
      <CustomerTable customers={getCustomers()} />
    </DashboardContainer>
  );
}
