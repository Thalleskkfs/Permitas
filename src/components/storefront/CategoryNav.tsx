import Link from "next/link";
import type { StorefrontPaths } from "@/lib/storefront-paths";
import type { Category } from "@/types/catalog";
import { Container } from "./Container";

type CategoryNavProps = {
  categories: Category[];
  paths: StorefrontPaths;
  activeSlug?: string;
};

export function CategoryNav({ categories, paths, activeSlug }: CategoryNavProps) {
  return (
    <nav aria-label="Categorias" className="border-b border-border">
      <Container>
        <ul className="-mx-1 flex gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((category) => {
            const isActive = category.slug === activeSlug;

            return (
              <li key={category.slug} className="shrink-0">
                <Link
                  href={paths.category(category.slug)}
                  aria-current={isActive ? "page" : undefined}
                  className={`focus-ring block rounded-md px-3 py-2 text-sm ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {category.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </Container>
    </nav>
  );
}
