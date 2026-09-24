/**
 * Montagem das mensagens e dos links de WhatsApp da vitrine.
 *
 * Limitação real do canal: o link `wa.me` transporta APENAS texto — não existe
 * forma de anexar imagem, arquivo ou qualquer mídia pela URL. A foto do produto
 * só aparece na conversa como prévia quando a mensagem contém o link de uma
 * página pública com meta tags Open Graph (og:image / og:title). É por isso que
 * cada item leva a própria URL na linha seguinte.
 */

export type WhatsAppItem = {
  name: string;
  quantity: number;
  unitPriceCents: number;
  variantLabel?: string | null;
  url?: string | null;
};

type WhatsAppMessageInput = {
  items: WhatsAppItem[];
  template?: string | null;
  storeName?: string | null;
};

type WhatsAppUrlInput = WhatsAppMessageInput & {
  phone: string;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const ITEMS_PLACEHOLDER = "{itens}";
const TOTAL_PLACEHOLDER = "{total}";

// Margem conservadora: URLs longas demais são cortadas por alguns navegadores e
// pelo próprio app do WhatsApp, o que entregaria uma mensagem quebrada.
const MAX_ENCODED_TEXT_LENGTH = 1800;

function formatCents(cents: number) {
  return currencyFormatter.format(cents / 100);
}

function sumCents(items: WhatsAppItem[]) {
  return items.reduce((total, item) => total + item.quantity * item.unitPriceCents, 0);
}

function formatItemList(visibleItems: WhatsAppItem[], omittedCount: number) {
  const lines: string[] = [];

  for (const item of visibleItems) {
    const variant = item.variantLabel ? ` (${item.variantLabel})` : "";
    const lineTotal = formatCents(item.quantity * item.unitPriceCents);
    lines.push(`${item.quantity}x ${item.name}${variant} — ${lineTotal}`);

    if (item.url) {
      lines.push(item.url);
    }
  }

  if (omittedCount > 0) {
    lines.push(
      omittedCount === 1
        ? "e mais 1 item não listado (o total considera todos)."
        : `e mais ${omittedCount} itens não listados (o total considera todos).`,
    );
  } else if (lines.length === 0) {
    lines.push("(nenhum item selecionado)");
  }

  return lines.join("\n");
}

function composeMessage(
  input: WhatsAppMessageInput,
  visibleItems: WhatsAppItem[],
  omittedCount: number,
) {
  const list = formatItemList(visibleItems, omittedCount);
  const total = formatCents(sumCents(input.items));
  const template = input.template?.trim();

  if (template) {
    // split/join no lugar de String.replace: o argumento de substituição do
    // replace interpreta "$&", "$1" etc., e nome de produto é conteúdo que a
    // loja edita livremente.
    return template
      .split(ITEMS_PLACEHOLDER)
      .join(list)
      .split(TOTAL_PLACEHOLDER)
      .join(total);
  }

  const storeName = input.storeName?.trim();
  const greeting = storeName
    ? `Olá, ${storeName}! Tenho interesse nestes itens:`
    : "Olá! Tenho interesse nestes itens:";

  return `${greeting}\n\n${list}\n\nTotal: ${total}`;
}

function encodeText(text: string) {
  // encodeURIComponent preserva "+", mas quem lê a querystring como
  // form-urlencoded o traduz de volta para espaço; codificamos explicitamente.
  return encodeURIComponent(text).replace(/\+/g, "%2B");
}

export function normalizeWhatsAppNumber(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length < 8 || digits.length > 15) {
    return null;
  }

  // Sem "+" e com 10 ou 11 dígitos é telefone brasileiro sem DDI. Qualquer
  // outro tamanho já carrega o código do país — que não pode ser adivinhado.
  if (!trimmed.startsWith("+") && (digits.length === 10 || digits.length === 11)) {
    return `55${digits}`;
  }

  return digits;
}

export function buildWhatsAppMessage(input: WhatsAppMessageInput): string {
  return composeMessage(input, input.items, 0);
}

export function buildWhatsAppUrl(input: WhatsAppUrlInput): string | null {
  const phone = normalizeWhatsAppNumber(input.phone);

  if (!phone) {
    return null;
  }

  // Truncamos descartando itens inteiros, nunca fatiando a string codificada:
  // assim é impossível partir ao meio um emoji (par substituto) ou um "%XX".
  for (let visible = input.items.length; visible > 0; visible -= 1) {
    const text = encodeText(
      composeMessage(input, input.items.slice(0, visible), input.items.length - visible),
    );

    if (text.length <= MAX_ENCODED_TEXT_LENGTH) {
      return `https://wa.me/${phone}?text=${text}`;
    }
  }

  const text = encodeText(composeMessage(input, [], input.items.length));

  return `https://wa.me/${phone}?text=${text}`;
}
