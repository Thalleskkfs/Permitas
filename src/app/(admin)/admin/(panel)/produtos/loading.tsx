import { DashboardContainer } from "@/components/dashboard/DashboardContainer";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ProductTable } from "@/components/dashboard/ProductTable";

/** Estado de carregamento real do Next: a mesma tabela, em esqueleto. */
export default function ProdutosLoading() {
  return (
    <DashboardContainer className="flex flex-col gap-6">
      <PageHeader title="Produtos" description="Carregando o catálogo…" />
      <ProductTable
        products={[]}
        categories={[]}
        total={0}
        page={1}
        pageCount={1}
        query={{ q: "", status: "all", categoryId: null, sort: "recent" }}
        canDelete={false}
        loading
      />
    </DashboardContainer>
  );
}
