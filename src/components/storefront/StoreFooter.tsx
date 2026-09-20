import Link from "next/link";
import type { StorefrontPaths } from "@/lib/storefront-paths";
import type { Store } from "@/types/catalog";
import { Container } from "./Container";

export function StoreFooter({
  store,
  paths,
}: {
  store: Pick<Store, "name" | "description">;
  paths: StorefrontPaths;
}) {
  return (
    <footer className="mt-16 border-t border-border">
      <Container className="grid gap-8 py-10 sm:grid-cols-[2fr_1fr]">
        <div className="flex max-w-md flex-col gap-2">
          <p className="font-semibold">{store.name}</p>
          {store.description && (
            <p className="text-sm text-muted-foreground">{store.description}</p>
          )}
        </div>

        <nav aria-label="Rodapé" className="flex flex-col gap-2 text-sm">
          <p className="font-semibold">Navegação</p>
          <Link href={paths.home} className="focus-ring text-muted-foreground hover:text-foreground">
            Início
          </Link>
          <Link href={paths.cart} className="focus-ring text-muted-foreground hover:text-foreground">
            Carrinho
          </Link>
        </nav>
      </Container>

      <div className="border-t border-border">
        <Container className="py-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {store.name}. Todos os direitos reservados.
        </Container>
      </div>
    </footer>
  );
}
