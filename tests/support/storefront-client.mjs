import assert from "node:assert/strict";

/**
 * Tradutor da API encadeada do supabase-js para SQL, executado no PGlite sob um papel.
 *
 * Cópia do tradutor de tests/storefront-queries.test.mjs, acrescida de `.in()` — que a
 * resolução da lista de interesse usa para ler vários produtos numa consulta só. As
 * colunas são citadas uma a uma e a consulta roda sob o papel escolhido: privilégio de
 * coluna e RLS continuam valendo, inclusive nos embutidos.
 */

/** Vínculos que os `select` da vitrine embutem, e como o PostgREST os resolveria. */
const RELATIONS = {
  stores: {
    store_settings: { table: "store_settings", localKey: "id", foreignKey: "store_id", single: true },
    store_banners: { table: "store_banners", localKey: "id", foreignKey: "store_id", single: false },
  },
  products: {
    categories: { table: "categories", localKey: "category_id", foreignKey: "id", single: true },
    product_images: { table: "product_images", localKey: "id", foreignKey: "product_id" },
    product_variants: { table: "product_variants", localKey: "id", foreignKey: "product_id" },
    product_tags: { table: "product_tags", localKey: "id", foreignKey: "product_id" },
  },
  product_tags: {
    tags: { table: "tags", localKey: "tag_id", foreignKey: "id", single: true },
  },
  collection_products: {
    products: { table: "products", localKey: "product_id", foreignKey: "id", single: true },
  },
};

/** `products!inner` -> nome "products", com join interno. */
function embedName(raw) {
  const [name, hint] = raw.split("!");
  return { name, inner: hint === "inner" };
}

/** `"id, name, filhos(a, b)"` -> árvore de nós. */
function parseSelect(text) {
  let index = 0;

  function parseList(closing) {
    const nodes = [];
    let buffer = "";
    const flush = () => {
      if (buffer.trim()) nodes.push({ name: buffer.trim() });
      buffer = "";
    };

    while (index < text.length) {
      const char = text[index];

      if (char === "(") {
        index += 1;
        const name = buffer.trim();
        buffer = "";
        nodes.push({ name, children: parseList(true) });
      } else if (char === ")") {
        index += 1;
        flush();
        return nodes;
      } else if (char === ",") {
        index += 1;
        flush();
      } else {
        buffer += char;
        index += 1;
      }
    }

    assert.equal(closing, undefined, "parêntese não fechado no select");
    flush();
    return nodes;
  }

  return parseList();
}

/** Condições de um nível: `null` é a raiz, um nome é o recurso embutido. */
function conditions(filters, embed, alias, params) {
  return filters
    .filter((filter) => filter.embed === embed)
    .map((filter) => {
      if (filter.operator === "isNotNull") return `${alias}."${filter.column}" is not null`;
      params.push(filter.value);
      if (filter.operator === "in") return `${alias}."${filter.column}" = any($${params.length})`;
      // ILIKE com o escape padrão do Postgres (`\`), como o PostgREST gera.
      const operator = { neq: "<>", ilike: "ilike" }[filter.operator] ?? "=";
      return `${alias}."${filter.column}" ${operator} $${params.length}`;
    });
}

/**
 * Cada nível vira um json_build_object; o embutido vira subconsulta correlacionada.
 * As colunas são citadas uma a uma, então privilégio de coluna e RLS continuam valendo
 * dentro dos embutidos — que é justamente o que se quer provar.
 */
function jsonObject(table, nodes, alias, sequence, params, filters, orders = []) {
  const args = nodes.flatMap((node) => {
    if (!node.children) return [`'${node.name}'`, `${alias}."${node.name}"`];

    const { name } = embedName(node.name);
    const relation = RELATIONS[table]?.[name];
    assert.ok(relation, `vínculo desconhecido: ${table}.${name}`);

    const child = `a${sequence.next++}`;
    const where = [
      `${child}."${relation.foreignKey}" = ${alias}."${relation.localKey}"`,
      ...conditions(filters, name, child, params),
    ].join(" and ");

    const object = jsonObject(relation.table, node.children, child, sequence, params, filters, orders);
    const source = `from public."${relation.table}" ${child} where ${where}`;
    const embedOrder = orders
      .filter((entry) => entry.embed === name)
      .map((entry) => `${child}."${entry.column}" ${entry.ascending ? "asc" : "desc"}`)
      .join(", ");

    return [
      `'${name}'`,
      relation.single
        ? `(select ${object} ${source} limit 1)`
        : `(select coalesce(json_agg(${object}${embedOrder ? ` order by ${embedOrder}` : ""}), '[]'::json) ${source})`,
    ];
  });

  return `json_build_object(${args.join(", ")})`;
}

/**
 * `!inner`: o filtro do embutido também corta a linha da raiz (e a contagem). Vira um
 * EXISTS sobre a mesma tabela, sob o mesmo papel — a RLS do embutido segue valendo.
 */
function innerJoins(query, params) {
  return parseSelect(query.columns)
    .filter((node) => node.children && embedName(node.name).inner)
    .map((node) => {
      const { name } = embedName(node.name);
      const relation = RELATIONS[query.table]?.[name];
      assert.ok(relation, `vínculo desconhecido: ${query.table}.${name}`);

      const where = [
        `i."${relation.foreignKey}" = a0."${relation.localKey}"`,
        ...conditions(query.filters, name, "i", params),
      ].join(" and ");
      return `exists (select 1 from public."${relation.table}" i where ${where})`;
    });
}

function rootWhere(query, params) {
  return [...conditions(query.filters, null, "a0", params), ...innerJoins(query, params)];
}

function compile(query) {
  const params = [];
  const where = rootWhere(query, params);
  const object = jsonObject(
    query.table,
    parseSelect(query.columns),
    "a0",
    { next: 1 },
    params,
    query.filters,
    query.orders,
  );

  let sql = `select ${object} as row from public."${query.table}" a0`;
  if (where.length > 0) sql += ` where ${where.join(" and ")}`;
  const rootOrders = query.orders.filter((entry) => entry.embed === null);
  if (rootOrders.length > 0) {
    const order = rootOrders
      .map((entry) => `a0."${entry.column}" ${entry.ascending ? "asc" : "desc"}`)
      .join(", ");
    sql += ` order by ${order}`;
  }
  if (query.size !== null) sql += ` limit ${query.size}`;
  if (query.from !== null) sql += ` offset ${query.from}`;

  return { sql, params };
}

function compileCount(query) {
  const params = [];
  const where = rootWhere(query, params);
  let sql = `select count(*)::int as total from public."${query.table}" a0`;
  if (where.length > 0) sql += ` where ${where.join(" and ")}`;
  return { sql, params };
}

const parseJson = (value) => (typeof value === "string" ? JSON.parse(value) : value);

class Query {
  constructor(execute, table) {
    this.execute = execute;
    this.table = table;
    this.columns = "*";
    this.filters = [];
    this.orders = [];
    this.size = null;
    this.from = null;
    this.exact = false;
    this.head = false;
    this.single = false;
  }

  select(columns, options = {}) {
    this.columns = columns;
    this.exact = options.count === "exact";
    this.head = options.head === true;
    return this;
  }

  eq(column, value) {
    return this.push(column, "eq", value);
  }

  neq(column, value) {
    return this.push(column, "neq", value);
  }

  in(column, values) {
    assert.ok(Array.isArray(values), "in() espera uma lista");
    return this.push(column, "in", values);
  }

  ilike(column, pattern) {
    return this.push(column, "ilike", pattern);
  }

  not(column, operator, value) {
    assert.equal(operator, "is", "o tradutor só conhece not(..., 'is', null)");
    assert.equal(value, null);
    return this.push(column, "isNotNull");
  }

  push(column, operator, value) {
    const [head, tail] = column.split(".");
    this.filters.push({
      embed: tail ? head : null,
      column: tail ?? head,
      operator,
      value,
    });
    return this;
  }

  // Como no PostgREST: ascendente por padrão, e `referencedTable` ordena os itens do
  // recurso embutido, não as linhas da raiz.
  order(column, { ascending = true, referencedTable } = {}) {
    this.orders.push({ column, ascending, embed: referencedTable ?? null });
    return this;
  }

  range(from, to) {
    this.from = from;
    this.size = to - from + 1;
    return this;
  }

  limit(size) {
    this.size = size;
    return this;
  }

  maybeSingle() {
    this.single = true;
    return this;
  }

  then(resolve, reject) {
    return this.run().then(resolve, reject);
  }

  async run() {
    try {
      const total = async () => {
        const counted = compileCount(this);
        return (await this.execute(counted.sql, counted.params))[0].total;
      };

      // `head: true`: só a contagem, sem linhas — como o HEAD do PostgREST.
      if (this.head) return { data: null, error: null, count: this.exact ? await total() : null };

      // O PostgREST não devolve lista vazia para um range que começa depois do último
      // registro: responde 416 com PGRST103. O Postgres puro devolveria [], e sem esta
      // imitação os testes nunca veriam o erro que a vitrine recebe de verdade.
      if (this.from !== null && this.from > 0 && this.from >= (await total())) {
        return {
          data: null,
          error: { code: "PGRST103", message: "Requested range not satisfiable" },
          count: null,
        };
      }

      const { sql, params } = compile(this);
      const found = (await this.execute(sql, params)).map((row) => parseJson(row.row));

      const count = this.exact ? await total() : null;

      if (this.single) {
        assert.ok(found.length <= 1, "maybeSingle recebeu mais de uma linha");
        return { data: found[0] ?? null, error: null, count };
      }

      return { data: found, error: null, count };
    } catch (error) {
      // O supabase-js devolve o erro no envelope; quem chama decide se lança.
      return { data: null, error: { message: String(error.message) }, count: null };
    }
  }
}

/** Cliente com a forma do supabase-js, falando com o PGlite sob o papel escolhido. */
export function createClientFactory(rows) {
  return (actor) => ({
    from: (table) => new Query((sql, params) => rows(actor, sql, params), table),
  });
}
