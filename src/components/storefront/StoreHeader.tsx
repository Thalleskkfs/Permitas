import Link from "next/link";
import type { StorefrontPaths } from "@/lib/storefront-paths";
import type { Store } from "@/types/catalog";
import { Container } from "./Container";
import { CartIcon } from "./icons";

export function StoreHeader({ store, paths }: { store: Pick<Store, "name">; paths: StorefrontPaths }) {
  return (
    <header className="border-b border-border bg-background">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href={paths.home} className="focus-ring text-lg font-semibold">
          {store.name}
        </Link>

        <Link
          href={paths.cart}
          className="focus-ring flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
        >
          <CartIcon />
          <span>Carrinho</span>
        </Link>
      </Container>
    </header>
  );
}
