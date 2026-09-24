/**
 * Conteúdo das páginas institucionais da vitrine (políticas, contato, quem somos).
 *
 * O texto vive aqui, no código, e não no banco nem no painel: ele precisa sair
 * revisado pela assessoria jurídica, e conteúdo editável convida erro.
 *
 * Enquanto o texto definitivo não chega, o corpo de cada seção é um marcador entre
 * colchetes — nunca um parágrafo "plausível". Texto jurídico inventado numa loja é
 * passivo real. O teste `tests/institutional.test.mjs` garante que nenhum corpo
 * deixe de ser marcador enquanto `PROVISIONAL` for verdadeiro.
 *
 * Este módulo não importa nada do projeto, para poder ser lido direto pelos testes.
 */

/** Verdadeiro enquanto o texto for provisório: mostra o aviso e bloqueia a indexação. */
export const PROVISIONAL = true;

export const PROVISIONAL_NOTICE = "Texto provisório, pendente de revisão jurídica.";

const LEGAL_PLACEHOLDER = "[Texto a ser fornecido pela assessoria jurídica]";
const STORE_PLACEHOLDER = "[Texto a ser fornecido pela loja]";

export type InstitutionalSection = {
  heading: string;
  /** Parágrafos da seção. Enquanto `PROVISIONAL`, cada um é um marcador entre colchetes. */
  body: string[];
};

/** Grupo em que o link aparece no rodapé. */
export type InstitutionalGroup = "ajuda" | "politicas";

export type InstitutionalPage = {
  slug: string;
  title: string;
  /** Descrição curta para os metadados da página. */
  description: string;
  group: InstitutionalGroup;
  sections: InstitutionalSection[];
};

export const INSTITUTIONAL_GROUP_LABELS: Record<InstitutionalGroup, string> = {
  ajuda: "Ajuda",
  politicas: "Políticas",
};

// Um teste anterior tinha `PROVISIONAL` como falso e cada seção preenchida com texto
// "plausível" (CNPJ, telefone, gateway de pagamento, conta de cliente) que não existe
// nesta loja de verdade — o checkout é só WhatsApp, sem conta, sem PIX/cartão/boleto.
// Isso é exatamente o passivo que este módulo foi desenhado para evitar (ver comentário
// acima) e o teste `enquanto provisório, todo corpo de seção é marcador` já cobria essa
// regressão. Os títulos e a estrutura das seções ficam, como roteiro para quando a
// assessoria jurídica e a loja entregarem o texto real.
export const INSTITUTIONAL_PAGES: readonly InstitutionalPage[] = [
  {
    slug: "quem-somos",
    title: "Quem Somos",
    description: "Conheça a Permita-se e nossa história.",
    group: "ajuda",
    sections: [
      { heading: "Nossa História", body: [STORE_PLACEHOLDER] },
      { heading: "Nosso Compromisso", body: [STORE_PLACEHOLDER] },
    ],
  },
  {
    slug: "contato",
    title: "Contato",
    description: "Como falar com a Permita-se: canais de atendimento, horários e FAQ.",
    group: "ajuda",
    sections: [
      { heading: "Canais de Atendimento", body: [STORE_PLACEHOLDER] },
      { heading: "Endereço da Loja", body: [STORE_PLACEHOLDER] },
      { heading: "Horário de Funcionamento", body: [STORE_PLACEHOLDER] },
    ],
  },
  {
    slug: "perguntas-frequentes",
    title: "Perguntas Frequentes",
    description: "Respostas para as dúvidas mais comuns sobre produtos, pedidos e entrega.",
    group: "ajuda",
    sections: [
      { heading: "Produtos e Uso", body: [STORE_PLACEHOLDER] },
      { heading: "Pedidos e Pagamento", body: [STORE_PLACEHOLDER] },
      { heading: "Entrega e Discrição", body: [STORE_PLACEHOLDER] },
      { heading: "Trocas, Devoluções e Garantia", body: [STORE_PLACEHOLDER] },
    ],
  },
  {
    slug: "entrega",
    title: "Política de Entrega",
    description: "Informações completas sobre prazos, frete, rastreamento e regiões atendidas.",
    group: "ajuda",
    sections: [
      { heading: "Formas de Envio", body: [STORE_PLACEHOLDER] },
      { heading: "Prazos de Entrega", body: [STORE_PLACEHOLDER] },
      { heading: "Frete", body: [STORE_PLACEHOLDER] },
      { heading: "Rastreamento", body: [STORE_PLACEHOLDER] },
      { heading: "Problemas na Entrega", body: [STORE_PLACEHOLDER] },
    ],
  },
  {
    slug: "pagamento",
    title: "Formas de Pagamento",
    description: "Todas as formas de pagamento aceitas, parcelamento, segurança e prazos de aprovação.",
    group: "ajuda",
    sections: [
      { heading: "Formas Aceitas", body: [STORE_PLACEHOLDER] },
      { heading: "Parcelamento", body: [STORE_PLACEHOLDER] },
      { heading: "Segurança", body: [STORE_PLACEHOLDER] },
      { heading: "Prazos de Aprovação", body: [STORE_PLACEHOLDER] },
    ],
  },
  {
    slug: "trocas-e-devolucoes",
    title: "Trocas e Devoluções",
    description: "Política completa de trocas, devoluções, arrependimento e defeitos conforme CDC.",
    group: "politicas",
    sections: [
      { heading: "Direito de Arrependimento (7 dias)", body: [LEGAL_PLACEHOLDER] },
      { heading: "Defeito de Fabricação (30 dias)", body: [LEGAL_PLACEHOLDER] },
      { heading: "Como Solicitar Troca ou Devolução", body: [LEGAL_PLACEHOLDER] },
      { heading: "Estorno de Valores", body: [LEGAL_PLACEHOLDER] },
      { heading: "Produtos Não Elegíveis para Troca/Devolução", body: [LEGAL_PLACEHOLDER] },
    ],
  },
  {
    slug: "privacidade",
    title: "Política de Privacidade",
    description: "Como a Permita-se coleta, usa, armazena e protege seus dados pessoais conforme LGPD.",
    group: "politicas",
    sections: [
      { heading: "1. Controlador dos Dados", body: [LEGAL_PLACEHOLDER] },
      { heading: "2. Dados Coletados", body: [LEGAL_PLACEHOLDER] },
      { heading: "3. Finalidades do Tratamento", body: [LEGAL_PLACEHOLDER] },
      { heading: "4. Base Legal (LGPD)", body: [LEGAL_PLACEHOLDER] },
      { heading: "5. Compartilhamento de Dados", body: [LEGAL_PLACEHOLDER] },
      { heading: "6. Seus Direitos (Art. 18 LGPD)", body: [LEGAL_PLACEHOLDER] },
      { heading: "7. Retenção de Dados", body: [LEGAL_PLACEHOLDER] },
      { heading: "8. Segurança", body: [LEGAL_PLACEHOLDER] },
      { heading: "9. Cookies", body: [LEGAL_PLACEHOLDER] },
      { heading: "10. Transferência Internacional", body: [LEGAL_PLACEHOLDER] },
      { heading: "11. Alterações nesta Política", body: [LEGAL_PLACEHOLDER] },
      { heading: "12. Contato do Encarregado (DPO)", body: [LEGAL_PLACEHOLDER] },
    ],
  },
  {
    slug: "termos",
    title: "Termos de Uso",
    description: "Condições gerais de uso do site e serviços da Permita-se.",
    group: "politicas",
    sections: [
      { heading: "1. Aceitação dos Termos", body: [LEGAL_PLACEHOLDER] },
      { heading: "2. Capacidade e Idade Mínima", body: [LEGAL_PLACEHOLDER] },
      { heading: "3. Cadastro e Conta", body: [LEGAL_PLACEHOLDER] },
      { heading: "4. Produtos e Preços", body: [LEGAL_PLACEHOLDER] },
      { heading: "5. Compra e Pagamento", body: [LEGAL_PLACEHOLDER] },
      { heading: "6. Entrega", body: [LEGAL_PLACEHOLDER] },
      { heading: "7. Direito de Arrependimento e Trocas", body: [LEGAL_PLACEHOLDER] },
      { heading: "8. Propriedade Intelectual", body: [LEGAL_PLACEHOLDER] },
      { heading: "9. Limitação de Responsabilidade", body: [LEGAL_PLACEHOLDER] },
      { heading: "10. Lei Aplicável e Foro", body: [LEGAL_PLACEHOLDER] },
    ],
  },
  {
    slug: "cookies",
    title: "Política de Cookies",
    description: "O que são cookies, quais usamos, para que servem e como gerenciar suas preferências.",
    group: "politicas",
    sections: [
      { heading: "O que são Cookies", body: [LEGAL_PLACEHOLDER] },
      { heading: "Cookies que Utilizamos", body: [LEGAL_PLACEHOLDER] },
      { heading: "Cookies de Terceiros", body: [LEGAL_PLACEHOLDER] },
      { heading: "Como Gerenciar Cookies", body: [LEGAL_PLACEHOLDER] },
      { heading: "E se eu Rejeitar Cookies Não Essenciais?", body: [LEGAL_PLACEHOLDER] },
      { heading: "Validade do Consentimento", body: [LEGAL_PLACEHOLDER] },
    ],
  },
  {
    slug: "conteudo-adulto",
    title: "Aviso de Conteúdo Adulto",
    description: "Informações sobre a natureza do conteúdo do site e restrição de idade.",
    group: "politicas",
    sections: [
      { heading: "Aviso de Conteúdo Adulto", body: [LEGAL_PLACEHOLDER] },
      { heading: "Restrição de Idade", body: [LEGAL_PLACEHOLDER] },
      { heading: "Natureza do Conteúdo", body: [LEGAL_PLACEHOLDER] },
      { heading: "Responsabilidade dos Pais/Responsáveis", body: [LEGAL_PLACEHOLDER] },
      { heading: "Denúncia de Conteúdo Impróprio", body: [LEGAL_PLACEHOLDER] },
    ],
  },
];

export function getInstitutionalPage(slug: string): InstitutionalPage | null {
  return INSTITUTIONAL_PAGES.find((page) => page.slug === slug) ?? null;
}

export function getInstitutionalPagesByGroup(group: InstitutionalGroup): InstitutionalPage[] {
  return INSTITUTIONAL_PAGES.filter((page) => page.group === group);
}
