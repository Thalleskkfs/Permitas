import { notFound } from "next/navigation";
import { DashboardContainer } from "@/components/dashboard/DashboardContainer";
import { FormSection } from "@/components/dashboard/FormSection";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ProductForm } from "@/components/dashboard/ProductForm";
import { ProductStatusBadge } from "@/components/dashboard/StatusBadge";
import { VariantsEditor } from "@/components/dashboard/VariantsEditor";
import { requireCurrentStore } from "@/lib/auth/current-store";
import { canDeleteStructures } from "@/modules/catalog/authorization";
import { getProduct, listCategoryTree, listCollections, listTags } from "@/modules/catalog/queries";

export default async function EditarProdutoPage({ params }: PageProps<"/admin/produtos/[id]">) {
  const { id } = await params;
  const store = await requireCurrentStore();

  // A consulta é restrita à loja autorizada: um id de outra loja não retorna nada.
  const product = await getProduct(store.storeId, id);
  if (!product) notFound();

  const [categories, tags, collections] = await Promise.all([
    listCategoryTree(store.storeId),
    listTags(store.storeId),
    listCollections(store.storeId),
  ]);

  return (
    <DashboardContainer className="flex flex-col gap-8">
      <PageHeader
        title={product.name}
        description={`/${product.slug}`}
        actions={<ProductStatusBadge status={product.status} />}
      />

      <ProductForm product={product} categories={categories} tags={tags} collections={collections} />

      <FormSection title="Variantes" description="Opcional. Cada variante tem estoque próprio e preço opcional.">
        <VariantsEditor
          productId={product.id}
          variants={product.variants}
          canDelete={canDeleteStructures(store.role)}
        />
      </FormSection>
    </DashboardContainer>
  );
}
