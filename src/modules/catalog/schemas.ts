import { z } from "zod";

/**
 * Validação de entrada do catálogo.
 *
 * É a primeira barreira, aplicada no servidor antes de qualquer consulta. As constraints
 * do banco continuam existindo e são a última palavra: nenhuma delas foi afrouxada por
 * causa destas regras.
 */

export const PRODUCT_STATUSES = ["draft", "published", "archived"] as const;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Gera um slug estável a partir do nome, quando o formulário não informa um. */
export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

/** Campo ausente no formulário equivale a vazio, e vazio vira null no banco. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .default("")
    .transform((value) => (value === "" ? null : value));

/** Converte "49,90" ou "49.90" em centavos. Rejeita valores não positivos. */
const positiveMoneyToCents = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = value.replace(",", ".");
    const amount = Number(normalized);

    if (normalized === "" || !Number.isFinite(amount)) {
      ctx.addIssue({ code: "custom", message: "Informe um valor válido." });
      return z.NEVER;
    }
    const cents = Math.round(amount * 100);
    if (cents <= 0) {
      ctx.addIssue({ code: "custom", message: "O preço precisa ser maior que zero." });
      return z.NEVER;
    }
    return cents;
  });

const optionalMoneyToCents = z
  .string()
  .trim()
  .default("")
  .transform((value, ctx) => {
    if (value === "") return null;

    const amount = Number(value.replace(",", "."));
    if (!Number.isFinite(amount)) {
      ctx.addIssue({ code: "custom", message: "Informe um valor válido." });
      return z.NEVER;
    }
    const cents = Math.round(amount * 100);
    if (cents <= 0) {
      ctx.addIssue({ code: "custom", message: "O preço promocional precisa ser maior que zero." });
      return z.NEVER;
    }
    return cents;
  });

const stockField = z.coerce
  .number()
  .int("O estoque precisa ser um número inteiro.")
  .min(0, "O estoque não pode ser negativo.");

const uuid = z.uuid();
const optionalUuid = z
  .string()
  .trim()
  .default("")
  .transform((value) => (value === "" ? null : value))
  .refine((value) => value === null || uuid.safeParse(value).success, "Identificador inválido.");

export const productInputSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome.").max(200),
    slug: z.string().trim().max(120).optional(),
    sku: optionalText(64),
    shortDescription: optionalText(500),
    description: optionalText(20000),
    categoryId: optionalUuid,
    price: positiveMoneyToCents,
    promotionalPrice: optionalMoneyToCents,
    stock: stockField,
    status: z.enum(PRODUCT_STATUSES),
    featured: z.coerce.boolean().default(false),
    tagIds: z.array(uuid).default([]),
    collectionIds: z.array(uuid).default([]),
  })
  .transform((input) => ({ ...input, slug: input.slug ? input.slug : slugify(input.name) }))
  .superRefine((input, ctx) => {
    if (!SLUG.test(input.slug)) {
      ctx.addIssue({ code: "custom", path: ["slug"], message: "Nome inválido para gerar o endereço." });
    }
    if (input.promotionalPrice !== null && input.promotionalPrice > input.price) {
      ctx.addIssue({
        code: "custom",
        path: ["promotionalPrice"],
        message: "O preço promocional não pode ser maior que o preço.",
      });
    }
  });

export type ProductInput = z.output<typeof productInputSchema>;

export const categoryInputSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome.").max(120),
    slug: z.string().trim().max(100).optional(),
    parentId: optionalUuid,
    description: optionalText(2000),
    active: z.coerce.boolean().default(true),
    sortOrder: z.coerce.number().int().min(0).default(0),
  })
  .transform((input) => ({ ...input, slug: input.slug ? input.slug : slugify(input.name) }))
  .superRefine((input, ctx) => {
    if (!SLUG.test(input.slug)) {
      ctx.addIssue({ code: "custom", path: ["slug"], message: "Nome inválido para gerar o endereço." });
    }
  });

export const tagInputSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome.").max(80),
    slug: z.string().trim().max(80).optional(),
  })
  .transform((input) => ({ ...input, slug: input.slug ? input.slug : slugify(input.name) }))
  .superRefine((input, ctx) => {
    if (!SLUG.test(input.slug)) {
      ctx.addIssue({ code: "custom", path: ["slug"], message: "Nome inválido para gerar o endereço." });
    }
  });

export const collectionInputSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome.").max(120),
    slug: z.string().trim().max(100).optional(),
    description: optionalText(2000),
    active: z.coerce.boolean().default(true),
    position: z.coerce.number().int().min(0).default(0),
  })
  .transform((input) => ({ ...input, slug: input.slug ? input.slug : slugify(input.name) }))
  .superRefine((input, ctx) => {
    if (!SLUG.test(input.slug)) {
      ctx.addIssue({ code: "custom", path: ["slug"], message: "Nome inválido para gerar o endereço." });
    }
  });

/** Options permanece genérico: pares texto → texto, sem vocabulário de segmento. */
const variantOptions = z
  .string()
  .trim()
  .default("")
  .transform((value, ctx) => {
    if (value === "") return {} as Record<string, string>;

    const entries = value
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "")
      .map((line) => {
        const separator = line.indexOf(":");
        return separator === -1
          ? null
          : ([line.slice(0, separator).trim(), line.slice(separator + 1).trim()] as const);
      });

    if (entries.some((entry) => entry === null || entry[0] === "" || entry[1] === "")) {
      ctx.addIssue({ code: "custom", message: 'Use uma opção por linha, no formato "Chave: Valor".' });
      return z.NEVER;
    }

    return Object.fromEntries(entries as (readonly [string, string])[]);
  });

export const variantInputSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(200),
  sku: optionalText(64),
  price: optionalMoneyToCents,
  stock: stockField,
  options: variantOptions,
  active: z.coerce.boolean().default(true),
  position: z.coerce.number().int().min(0).default(0),
});

export const PRODUCT_SORTS = ["recent", "name", "price", "stock"] as const;
export const PRODUCTS_PER_PAGE = 24;

/** Filtros da listagem, lidos da URL. Entrada inválida cai no padrão, sem quebrar a tela. */
export const productQuerySchema = z.object({
  q: z.string().trim().max(120).default(""),
  status: z.enum(["all", ...PRODUCT_STATUSES]).catch("all"),
  categoryId: z
    .string()
    .trim()
    .transform((value) => (value === "" || !uuid.safeParse(value).success ? null : value))
    .nullable()
    .catch(null),
  sort: z.enum(PRODUCT_SORTS).catch("recent"),
  page: z.coerce.number().int().min(1).catch(1),
});

export type ProductQuery = z.output<typeof productQuerySchema>;

/**
 * Prepara o termo de busca para o filtro do PostgREST, onde vírgula, parênteses, aspas e
 * curingas têm significado sintático. Sem isso, um termo digitado poderia alterar o
 * próprio filtro.
 */
export function toSearchPattern(term: string) {
  const cleaned = term.replace(/[,()"'\\%*]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned === "" ? null : `%${cleaned}%`;
}
