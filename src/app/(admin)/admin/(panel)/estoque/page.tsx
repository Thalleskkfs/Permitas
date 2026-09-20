import { DashboardContainer } from "@/components/dashboard/DashboardContainer";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { StockTable } from "@/components/dashboard/StockTable";
import { requireCurrentStore } from "@/lib/auth/current-store";
import { listStockRows } from "@/modules/catalog/queries";

export default async function EstoquePage() {
  const store = await requireCurrentStore();
  const rows = await listStockRows(store.storeId);

  return (
    <DashboardContainer className="flex flex-col gap-6">
      <PageHeader
        title="Estoque"
        description="Quantidades atuais por produto e por variante. Não há histórico de movimentação."
      />
      <StockTable rows={rows} />
    </DashboardContainer>
  );
}
