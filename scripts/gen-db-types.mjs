import { mkdir, writeFile } from "node:fs/promises";
import { generateTypescript, introspect } from "@supabase/postgrest-typegen";
import { createMigratedDb } from "../supabase/tests/support/db.mjs";

const OUTPUT = new URL("../src/types/database.types.ts", import.meta.url);
const BANNER = [
  "// Arquivo gerado por `pnpm db:types` a partir de supabase/migrations. Não edite à mão.",
  "// Tipos manuais ficam em outros arquivos de src/types.",
  "",
  "",
].join("\n");

const db = await createMigratedDb();

try {
  const metadata = await introspect(db, { includedSchemas: ["public"] });
  const types = await generateTypescript(metadata, {
    defaultSchema: "public",
    detectOneToOneRelationships: true,
  });

  await mkdir(new URL("./", OUTPUT), { recursive: true });
  await writeFile(OUTPUT, BANNER + types);
  console.log("Tipos gerados em src/types/database.types.ts");
} finally {
  await db.close();
}
