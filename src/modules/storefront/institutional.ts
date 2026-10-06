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
export const PROVISIONAL = false;

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
  provisional?: boolean;
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
    provisional: false,
    sections: [
      {
        heading: "Sobre a Permita-se",
        body: [
          "A Permita-se é uma marca criada para mulheres que desejam se conhecer, se cuidar e viver sua feminilidade com mais liberdade e confiança. Unimos produtos, informação e experiências para promover prazer, autoestima, autoconhecimento e saúde íntima, sempre com respeito à individualidade de cada mulher. Somos mais do que um sex shop: somos um espaço de conexão, descoberta e transformação feminina.",
        ],
      },
      {
        heading: "Nosso Compromisso",
        body: [
          "Nosso compromisso é oferecer qualidade, discrição, acolhimento e informação, respeitando cada história, cada corpo e cada momento. Buscamos proporcionar uma experiência segura e leve, desde a escolha de um produto até o acesso aos nossos conteúdos, experiências e projetos. Acreditamos que toda mulher merece ter liberdade para se conhecer, fazer suas escolhas e viver sua feminilidade sem culpa, vergonha ou julgamentos.",
          "Permita-se. Conheça-se. Viva-se.",
        ],
      },
    ],
  },
  {
    slug: "contato",
    title: "Contato",
    description: "Como falar com a Permita-se: canais de atendimento, horários e FAQ.",
    group: "ajuda",
    provisional: false,
    sections: [
      {
        heading: "Canais de Atendimento",
        body: [
          "Atendemos de forma totalmente personalizada, humanizada e discreta por meio dos nossos canais oficiais.",
          "Você pode tirar suas dúvidas sobre produtos, recomendações de uso ou consultar o andamento do seu pedido através do nosso WhatsApp oficial ou e-mail de atendimento.",
        ],
      },
      {
        heading: "Horário de Funcionamento",
        body: [
          "Nosso atendimento funciona de segunda a sexta-feira, das 09h às 18h, e aos sábados das 09h às 13h (exceto feriados).",
          "As mensagens enviadas fora do horário de expediente serão respondidas no próximo dia útil por ordem de chegada.",
        ],
      },
      {
        heading: "Atendimento Digital",
        body: [
          "A Permita-se opera exclusivamente em ambiente digital para garantir total conveniência, segurança e privacidade em suas compras.",
          "Todas as entregas são enviadas com embalagens 100% discretas para o endereço de sua escolha.",
        ],
      },
    ],
  },
  {
    slug: "perguntas-frequentes",
    title: "Perguntas Frequentes",
    description: "Respostas para as dúvidas mais comuns sobre produtos, pedidos e entrega.",
    group: "ajuda",
    provisional: false,
    sections: [
      {
        heading: "Produtos e Uso",
        body: [
          "Nossos produtos são selecionados com foco em qualidade, bem-estar e segurança íntima. Recomendamos sempre ler as instruções contidas na embalagem de cada item.",
          "Em caso de sensibilidade ou reações alérgicas a algum componente, suspenda o uso e consulte um profissional de saúde.",
        ],
      },
      {
        heading: "Pedidos e Pagamento",
        body: [
          "Aceitamos pagamentos via Pix e cartão de crédito. Seus pedidos são confirmados assim que o pagamento for aprovado pela instituição financeira ou plataforma de pagamento.",
        ],
      },
      {
        heading: "Entrega e Discrição",
        body: [
          "Como é a embalagem do pedido? As embalagens são totalmente discretas, sem nenhum tipo de identificação do conteúdo ou menção a sex shop na caixa externa, garantindo a sua privacidade.",
          "Quais são os prazos de entrega? O prazo varia de acordo com o CEP de destino e a modalidade de envio escolhida no momento da compra.",
        ],
      },
      {
        heading: "Trocas, Devoluções e Garantia",
        body: [
          "Por se tratarem de produtos de uso íntimo e pessoal, só realizamos trocas ou devoluções em casos de defeito comprovado de fabricação, conforme detalhado em nossa Política de Trocas e Devoluções.",
        ],
      },
    ],
  },
  {
    slug: "entrega",
    title: "Política de Entrega",
    description: "Informações completas sobre prazos, frete, rastreamento e regiões atendidas.",
    group: "ajuda",
    provisional: false,
    sections: [
      {
        heading: "Embalagem Discreta",
        body: [
          "Na Permita-se, a sua privacidade é prioridade absoluta. Todos os pedidos são enviados em caixas ou envelopes neutros, sem logos ostensivos ou qualquer referência ao conteúdo interno ou a termos como sex shop.",
          "A etiqueta de envio contém apenas as informações estritamente necessárias para a entrega pelos Correios ou transportadora.",
        ],
      },
      {
        heading: "Formas de Envio",
        body: [
          "Trabalhamos com os Correios (Sedex e PAC) e transportadoras parceiras credenciadas para entregar seus produtos em todo o território nacional de forma ágil e segura.",
        ],
      },
      {
        heading: "Prazos e Frete",
        body: [
          "O prazo de entrega e o valor do frete são calculados de acordo com o CEP de destino e a modalidade de envio selecionada no momento da finalização do pedido.",
          "O prazo de entrega começa a contar a partir da confirmação do pagamento do seu pedido.",
        ],
      },
      {
        heading: "Rastreamento e Acompanhamento",
        body: [
          "Assim que o seu pedido for postado, você receberá o código de rastreamento para acompanhar cada etapa do envio até a entrega no endereço informado.",
        ],
      },
      {
        heading: "Problemas na Entrega",
        body: [
          "Certifique-se de preencher o endereço de entrega corretamente. Em caso de divergências nos dados fornecidos ou ausência de destinatário no momento da entrega, o pedido poderá retornar à loja, podendo haver necessidade de novo pagamento de frete para reenvio.",
        ],
      },
    ],
  },
  {
    slug: "pagamento",
    title: "Formas de Pagamento",
    description: "Todas as formas de pagamento aceitas, parcelamento, segurança e prazos de aprovação.",
    group: "ajuda",
    provisional: false,
    sections: [
      {
        heading: "Apresentação",
        body: [
          "Na Permita-se, oferecemos opções de pagamento práticas e seguras para facilitar sua compra.",
        ],
      },
      {
        heading: "Cartão de crédito",
        body: [
          "Aceitamos pagamentos com cartão de crédito, conforme as condições disponíveis no momento da compra.",
        ],
      },
      {
        heading: "Pix",
        body: [
          "Você também pode realizar seu pagamento via Pix, de forma rápida e segura.",
        ],
      },
      {
        heading: "Segurança",
        body: [
          "Todos os pagamentos são processados por meios seguros, garantindo maior tranquilidade durante sua compra.",
          "Em caso de dúvidas sobre as formas de pagamento disponíveis para o seu pedido, entre em contato com nossa equipe.",
        ],
      },
    ],
  },
  {
    slug: "trocas-e-devolucoes",
    title: "Trocas e Devoluções",
    description: "Política completa de trocas, devoluções, arrependimento e defeitos conforme CDC.",
    group: "politicas",
    provisional: false,
    sections: [
      {
        heading: "Apresentação",
        body: [
          "Na Permita-se, prezamos pela segurança, higiene e bem-estar de nossas clientes. Por trabalharmos com produtos de uso íntimo e pessoal, adotamos critérios específicos para trocas e devoluções.",
        ],
      },
      {
        heading: "Produtos íntimos",
        body: [
          "Por questões de higiene, saúde e segurança, não realizamos trocas ou devoluções de produtos que tenham sido abertos, utilizados ou que não apresentem defeito.",
          "Por se tratarem de produtos de uso íntimo, não realizamos trocas ou devoluções por arrependimento ou desistência após a compra, observadas as hipóteses previstas na legislação aplicável.",
        ],
      },
      {
        heading: "Produto com defeito",
        body: [
          "Caso o produto apresente algum problema, entre em contato com nossa equipe para solicitar a análise.",
          "A solicitação deverá ser realizada dentro do prazo legal aplicável e o produto poderá ser encaminhado para avaliação técnica, a fim de verificar se o problema caracteriza defeito de fabricação.",
          "Sendo constatado defeito de fabricação, a Permita-se realizará a solução cabível conforme a legislação vigente.",
        ],
      },
      {
        heading: "Produto recebido com embalagem violada ou item incorreto",
        body: [
          "Se você receber um produto diferente do adquirido ou perceber alguma irregularidade na embalagem no momento da entrega, entre em contato conosco o mais breve possível, preferencialmente antes de abrir ou utilizar o produto, para que possamos orientar sobre os próximos passos.",
        ],
      },
      {
        heading: "Como solicitar atendimento",
        body: [
          "Para solicitar uma análise relacionada a defeito ou divergência no pedido, entre em contato com nossa equipe pelos canais oficiais da Permita-se, informando o número do pedido e, quando solicitado, enviando fotos ou vídeos que auxiliem na análise.",
          "Nossa prioridade é garantir uma experiência segura, discreta e transparente em todas as suas compras.",
        ],
      },
    ],
  },
  {
    slug: "privacidade",
    title: "Política de Privacidade",
    description: "Como a Permita-se coleta, usa, armazena e protege seus dados pessoais conforme LGPD.",
    group: "politicas",
    provisional: false,
    sections: [
      {
        heading: "Apresentação",
        body: [
          "A Permita-se valoriza a sua privacidade e está comprometida em proteger os dados pessoais de suas clientes e visitantes. Esta Política de Privacidade explica como coletamos, utilizamos, armazenamos e protegemos as informações fornecidas durante a navegação e utilização de nossos canais digitais.",
        ],
      },
      {
        heading: "Quais dados podemos coletar?",
        body: [
          "Dependendo da sua interação com a Permita-se, podemos coletar informações como:",
          "• Nome;",
          "• Telefone e WhatsApp;",
          "• E-mail;",
          "• Endereço de entrega;",
          "• Dados necessários para processamento do pedido e pagamento;",
          "• Informações relacionadas ao seu pedido e atendimento;",
          "• Dados de navegação e utilização do site, quando aplicável.",
        ],
      },
      {
        heading: "Como utilizamos seus dados?",
        body: [
          "As informações coletadas podem ser utilizadas para:",
          "• Processar e entregar seus pedidos;",
          "• Confirmar pagamentos e informações da compra;",
          "• Entrar em contato sobre pedidos, entregas e atendimento;",
          "• Prestar suporte ao cliente;",
          "• Melhorar nossos produtos, serviços e experiência no site;",
          "• Enviar comunicações e ofertas, quando houver autorização ou outra base legal aplicável;",
          "• Cumprir obrigações legais e regulatórias.",
        ],
      },
      {
        heading: "Privacidade e discrição",
        body: [
          "A Permita-se entende que compras relacionadas à intimidade exigem respeito, discrição e confidencialidade.",
          "Por isso, buscamos tratar as informações relacionadas às compras com cuidado e utilizar os dados somente para finalidades legítimas e necessárias à prestação dos nossos serviços.",
          "As embalagens dos pedidos são preparadas de forma discreta, sem identificação do conteúdo adquirido.",
        ],
      },
      {
        heading: "Dados de pagamento",
        body: [
          "Os dados de pagamento poderão ser processados por plataformas e instituições responsáveis pela intermediação e processamento das transações. A Permita-se não solicita, por canais de atendimento, senhas ou códigos pessoais de acesso à sua conta bancária.",
        ],
      },
      {
        heading: "Compartilhamento de informações",
        body: [
          "Seus dados poderão ser compartilhados somente quando necessário para a realização dos serviços, como processamento do pagamento, entrega do pedido, funcionamento da plataforma do site ou cumprimento de obrigações legais.",
          "Não comercializamos seus dados pessoais.",
        ],
      },
      {
        heading: "Segurança das informações",
        body: [
          "Adotamos medidas técnicas e organizacionais compatíveis com as atividades da empresa para proteger os dados pessoais contra acessos não autorizados, perda, alteração, divulgação ou utilização indevida.",
        ],
      },
      {
        heading: "Armazenamento dos dados",
        body: [
          "Os dados pessoais são mantidos pelo período necessário para cumprir as finalidades para as quais foram coletados, atender obrigações legais e regulatórias e resguardar direitos da Permita-se e de seus clientes.",
        ],
      },
      {
        heading: "Seus direitos",
        body: [
          "Nos termos da legislação aplicável, especialmente da Lei Geral de Proteção de Dados Pessoais (LGPD), você poderá exercer direitos relacionados aos seus dados pessoais, conforme aplicável, incluindo solicitar informações sobre o tratamento de seus dados, correção de informações incompletas ou desatualizadas e outras solicitações previstas em lei.",
        ],
      },
      {
        heading: "Fale conosco",
        body: [
          "Caso tenha dúvidas sobre esta Política de Privacidade ou queira fazer uma solicitação relacionada aos seus dados pessoais, entre em contato com a Permita-se pelos nossos canais oficiais de atendimento.",
          "A Permita-se poderá atualizar esta Política de Privacidade sempre que necessário para refletir alterações em nossos serviços, processos ou na legislação aplicável.",
        ],
      },
    ],
  },
  {
    slug: "termos",
    title: "Termos de Uso",
    description: "Condições gerais de uso do site e serviços da Permita-se.",
    group: "politicas",
    provisional: false,
    sections: [
      {
        heading: "Apresentação",
        body: [
          "Bem-vinda à Permita-se. Ao acessar e utilizar nosso site, você concorda com os presentes Termos de Uso. Recomendamos a leitura deste documento antes de realizar qualquer compra ou utilizar nossos canais digitais.",
        ],
      },
      {
        heading: "1. Sobre o site",
        body: [
          "O site da Permita-se tem como objetivo apresentar e comercializar produtos, além de disponibilizar informações e conteúdos relacionados à sexualidade, autoestima, autoconhecimento, saúde íntima e bem-estar.",
          "As informações apresentadas no site possuem caráter informativo e não substituem avaliação ou orientação de profissionais da área da saúde quando esta for necessária.",
        ],
      },
      {
        heading: "2. Cadastro e informações do cliente",
        body: [
          "Para realizar determinadas compras ou utilizar funcionalidades do site, poderão ser solicitadas informações pessoais, como nome, telefone, e-mail e endereço de entrega.",
          "O cliente se compromete a fornecer informações verdadeiras, completas e atualizadas, sendo responsável pela exatidão dos dados informados.",
        ],
      },
      {
        heading: "3. Produtos e disponibilidade",
        body: [
          "A Permita-se busca manter as informações sobre produtos, características, preços e disponibilidade sempre atualizadas.",
          "Entretanto, imagens, cores e características visuais podem apresentar pequenas diferenças em relação ao produto recebido, especialmente em razão de configurações de tela e características de fabricação.",
          "A disponibilidade dos produtos está sujeita ao estoque.",
        ],
      },
      {
        heading: "4. Preços e pagamentos",
        body: [
          "Os preços apresentados no site podem ser alterados sem aviso prévio, respeitando-se as condições aplicáveis às compras já confirmadas.",
          "As formas de pagamento disponíveis serão apresentadas no momento da finalização do pedido.",
          "O pedido somente será considerado confirmado após a aprovação do pagamento e demais procedimentos necessários.",
        ],
      },
      {
        heading: "5. Entrega",
        body: [
          "As entregas são realizadas conforme as condições descritas em nossa Política de Entrega.",
          "O cliente é responsável por fornecer corretamente os dados necessários para a entrega. Informações incorretas ou incompletas poderão ocasionar atrasos ou impossibilidade de entrega.",
        ],
      },
      {
        heading: "6. Trocas e devoluções",
        body: [
          "Por trabalharmos com produtos de uso íntimo, aplicam-se condições específicas de higiene e segurança.",
          "As situações relacionadas a trocas, devoluções e produtos com eventual defeito estão descritas em nossa Política de Trocas e Devoluções, sempre observando a legislação aplicável.",
        ],
      },
      {
        heading: "7. Uso adequado do site",
        body: [
          "O usuário se compromete a utilizar o site de maneira lícita e responsável, não podendo:",
          "• Utilizar o site para atividades ilegais ou fraudulentas;",
          "• Tentar acessar áreas restritas ou sistemas de segurança;",
          "• Inserir informações falsas ou de terceiros sem autorização;",
          "• Praticar qualquer atividade que possa prejudicar o funcionamento do site;",
          "• Reproduzir ou utilizar indevidamente conteúdos, imagens, textos, marcas ou materiais pertencentes à Permita-se.",
        ],
      },
      {
        heading: "8. Conteúdo e propriedade intelectual",
        body: [
          "Os textos, imagens, logotipos, materiais gráficos, identidade visual, conteúdos e demais elementos disponibilizados no site pertencem à Permita-se ou são utilizados de forma autorizada.",
          "É proibida a reprodução, cópia, distribuição ou utilização comercial desses materiais sem autorização prévia.",
        ],
      },
      {
        heading: "9. Links e serviços de terceiros",
        body: [
          "O site poderá apresentar links ou utilizar serviços de terceiros, como plataformas de pagamento, sistemas de entrega, ferramentas de comunicação e outros serviços necessários ao funcionamento da operação.",
          "A utilização desses serviços poderá estar sujeita aos respectivos termos e políticas de privacidade de seus fornecedores.",
        ],
      },
      {
        heading: "10. Privacidade",
        body: [
          "O tratamento dos dados pessoais dos usuários é realizado conforme nossa Política de Privacidade e a legislação aplicável, especialmente a Lei Geral de Proteção de Dados Pessoais (LGPD).",
        ],
      },
      {
        heading: "11. Alterações dos Termos de Uso",
        body: [
          "A Permita-se poderá atualizar estes Termos de Uso sempre que necessário para adequá-los às mudanças em seus serviços, funcionamento do site ou legislação aplicável.",
          "A versão vigente estará sempre disponível no site.",
        ],
      },
      {
        heading: "12. Contato",
        body: [
          "Em caso de dúvidas sobre estes Termos de Uso, produtos, pedidos ou qualquer outro assunto relacionado à Permita-se, entre em contato conosco pelos nossos canais oficiais de atendimento.",
          "Ao utilizar o site da Permita-se, você declara estar de acordo com estes Termos de Uso e com as demais políticas disponibilizadas em nosso site.",
        ],
      },
    ],
  },
  {
    slug: "cookies",
    title: "Política de Cookies",
    description: "O que são cookies, quais usamos, para que servem e como gerenciar suas preferências.",
    group: "politicas",
    provisional: false,
    sections: [
      {
        heading: "O que são Cookies",
        body: [
          "Cookies são pequenos arquivos de texto armazenados no seu computador ou dispositivo móvel ao acessar um site. Eles servem para reconhecer a sua navegação, guardar preferências de uso e otimizar a experiência da visitante.",
        ],
      },
      {
        heading: "Cookies que Utilizamos",
        body: [
          "Utilizamos cookies essenciais, necessários para garantir o funcionamento correto e seguro da vitrine (como o registro da declaração de idade maior de 18 anos).",
          "Também podemos utilizar cookies analíticos para mensurar o acesso e compreender como o site é utilizado, nos ajudando a aprimorar nossos produtos e conteúdos.",
        ],
      },
      {
        heading: "Gerenciamento e Desativação",
        body: [
          "Você pode configurar seu navegador para recusar ou excluir cookies a qualquer momento nas configurações do seu sistema. Note que desativar cookies essenciais pode impactar a navegação em determinadas áreas do site.",
        ],
      },
    ],
  },
  {
    slug: "conteudo-adulto",
    title: "Aviso de Conteúdo Adulto",
    description: "Informações sobre a natureza do conteúdo do site e restrição de idade.",
    group: "politicas",
    provisional: false,
    sections: [
      {
        heading: "Restrição de Idade (+18)",
        body: [
          "A Permita-se trabalha com produtos destinados exclusivamente ao público adulto (maiores de 18 anos) e conteúdos relacionados à sexualidade, intimidade, autoconhecimento e saúde íntima.",
          "Ao acessar e utilizar este site, você declara que possui 18 anos ou mais e está legalmente autorizado(a) a visualizar e adquirir os produtos disponibilizados.",
        ],
      },
      {
        heading: "Natureza do Conteúdo e Uso Consciente",
        body: [
          "Nossos produtos são destinados ao bem-estar, prazer e autoconhecimento. Devem ser utilizados de acordo com suas respectivas orientações e recomendações de segurança dos fabricantes.",
          "As informações disponibilizadas possuem caráter informativo e não substituem consulta ou avaliação médica profissional.",
        ],
      },
      {
        heading: "Respeito e Privacidade",
        body: [
          "A Permita-se preza pelo respeito, pela privacidade, pelo uso consciente de seus produtos e pela discrição total em todas as entregas e atuações.",
          "Se você tiver menos de 18 anos, não prossiga com a navegação ou compras neste site.",
        ],
      },
    ],
  },
];

export function isPageProvisional(page: InstitutionalPage): boolean {
  return page.provisional ?? PROVISIONAL;
}

export function getInstitutionalPage(slug: string): InstitutionalPage | null {
  return INSTITUTIONAL_PAGES.find((page) => page.slug === slug) ?? null;
}

export function getInstitutionalPagesByGroup(group: InstitutionalGroup): InstitutionalPage[] {
  return INSTITUTIONAL_PAGES.filter((page) => page.group === group);
}
