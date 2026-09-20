# catalogo-saas

Plataforma multi-loja de catálogo de produtos. Cada loja publica seu catálogo em uma
vitrine própria, e a negociação acontece pelo WhatsApp — não há checkout nem pagamento
dentro do produto.

O sistema tem duas áreas:

- **Vitrine pública** (`/loja/[loja]`) — catálogo, categorias, página de produto e lista
  de interesse. Sem login.
- **Painel administrativo** (`/admin`) — gestão do catálogo da loja. Exige autenticação,
  verificação em duas etapas e vínculo com a loja.

## Stack

- [Next.js](https://nextjs.org) 16 (App Router) e React 19
- TypeScript em modo estrito
- Tailwind CSS 4
- [Supabase](https://supabase.com): PostgreSQL, Auth e Storage
- [Zod](https://zod.dev) para validação no servidor
- pnpm como gerenciador de pacotes

## Requisitos

- Node.js 20 ou superior
- pnpm 10 ou superior
- Um projeto Supabase

## Como rodar localmente

```bash
pnpm install
```

Copie o arquivo de exemplo e preencha com os valores do seu projeto Supabase:

```bash
cp .env.example .env.local
```

| Variável | Onde usar | Observação |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | cliente e servidor | URL do projeto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente e servidor | Chave pública, sujeita às políticas de acesso |
| `SUPABASE_SERVICE_ROLE_KEY` | somente servidor | Ignora as políticas de acesso. Nunca prefixar com `NEXT_PUBLIC` |
| `NEXT_PUBLIC_SITE_URL` | servidor | Usada no link de redefinição de senha |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | cliente | Opcional. Sem ela, o fluxo administrativo funciona sem captcha |

O arquivo `.env.local` não é versionado.

```bash
pnpm dev
```

A aplicação sobe em `http://localhost:3000`.

## Comandos

```bash
pnpm dev      # servidor de desenvolvimento
pnpm build    # build de produção
pnpm start    # serve o build
pnpm lint     # ESLint
pnpm test     # suíte completa
pnpm db:test  # apenas os testes de banco e políticas de acesso
pnpm db:types # regenera src/types/database.types.ts a partir das migrations
```

Os testes rodam sobre um PostgreSQL em memória com as migrations aplicadas, então não
dependem de conexão com o projeto remoto.

## Banco de dados

O schema é versionado em `supabase/migrations/`. Toda alteração entra como uma migration
nova; nada é alterado direto pelo painel do Supabase.

Para aplicar as migrations em um ambiente que você administra:

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref <ref-do-projeto>
pnpm exec supabase db push
```

### Configuração feita no painel do Supabase

Alguns ajustes de autenticação não vivem no código e precisam ser feitos no painel do
projeto, em **Authentication**:

- desabilitar o cadastro público de usuários;
- exigir confirmação de e-mail;
- definir a política de senha e ativar a proteção contra senhas vazadas;
- habilitar MFA por aplicativo autenticador (TOTP);
- configurar o captcha em *Attack Protection*, com a chave secreta do provedor;
- definir *Site URL* e as *Redirect URLs*, incluindo `/admin/redefinir-senha`.

O arquivo `supabase/config.toml` reflete esses valores para desenvolvimento local. Ele
não é aplicado ao ambiente remoto automaticamente.

## Arquitetura

```
src/
├── app/
│   ├── (storefront)/     vitrine pública, sem autenticação
│   └── (admin)/
│       ├── (auth)/       acesso, recuperação de senha e segundo fator
│       └── (panel)/      painel protegido
├── components/           storefront, admin e painel
├── modules/
│   ├── auth/             ações de autenticação
│   ├── catalog/          consultas, mutações, validação e mapeadores
│   └── dashboard/        dados de apoio do painel
├── lib/
│   ├── auth/             identidade, nível de garantia e loja ativa
│   ├── storage/          convenção de caminho e operações de imagem
│   └── supabase/         clientes de navegador, servidor e administração
└── types/                tipos de apresentação e tipos gerados do banco
```

### Acesso e autorização

O acesso ao painel passa por três camadas independentes:

1. **Identidade** — validada no servidor a cada requisição.
2. **Nível de garantia** — a área administrativa exige o segundo fator.
3. **Vínculo com a loja** — estar autenticado não basta; é preciso ser membro.

Acima disso, o PostgreSQL aplica *Row Level Security* em todas as tabelas. A loja ativa
é sempre derivada do vínculo do usuário autenticado: um identificador de loja enviado
pelo navegador nunca concede acesso.

Existem dois papéis: **proprietário** e **editor**. Ambos criam e editam o catálogo;
apenas o proprietário exclui categorias, produtos, variantes, tags e coleções.

### Imagens

As imagens ficam em um bucket privado, sem leitura pública. O acesso acontece
exclusivamente no servidor, seguindo a convenção `{loja}/{produto}/{arquivo}`.

## Licença

Projeto privado. Todos os direitos reservados.
