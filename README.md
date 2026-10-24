# Portal de Serviços

Aplicação web em React e TypeScript, instalável como PWA, com os dados no Supabase.

## Estrutura

```text
frontend/
  public/                   Ícones, arquivos do PWA e fotos fictícias (exemplos/)
  src/
    components/             Componentes compartilhados
    features/               Regras e chamadas ao banco de cada parte do app
    hooks/                  Hooks compartilhados
    lib/                    Supabase (api.ts, supabase.ts) e validações
    pages/                  Páginas da aplicação
  banco/                    Testes das funções do banco (Supabase local)
  e2e/                      Testes no navegador (Playwright)
supabase/
  migrations/               Tabelas, regras (RPC) e permissões do banco
  seed.sql                  Dados de exemplo
  config.toml               Supabase local (CLI)
```

## Como o app usa o Supabase

- **Login:** Supabase Auth (e-mail e senha). A sessão vale só na aba aberta (sessionStorage).
- **Dados:** as tabelas ficam fechadas pela RLS. O app só chama funções RPC do banco
  (`supabase/migrations`), que conferem sessão, permissão e cada campo, com as mensagens que
  aparecem nas telas. CPF e senha nunca saem do banco.
- **Fotos:** bucket `fotos` do Storage. Cada conta grava só na própria pasta; a administração
  também em `modalidades/`. Só PNG, JPEG, WebP e GIF, até 5 MB.

## Executar localmente

```powershell
cd frontend
npm install
npm run dev
```

`npm run dev` sobe o app em http://localhost:5173, usando o projeto Supabase de `frontend/.env.local`
(`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, a chave publishable). Nunca coloque a chave
`service_role`/secret no frontend.

Contas de exemplo (depois de rodar `supabase/seed.sql`): `carlos@exemplo.com`,
`beatriz@exemplo.com` e `admin@exemplo.com`, senha `teste123`.

### Preparar o projeto Supabase

1. Aplique `supabase/migrations/20261024120000_inicial.sql` (SQL Editor, ou `supabase db push`).
2. Para ter os dados de exemplo, rode `supabase/seed.sql`. **Ele apaga todas as contas e dados**
   e grava os de exemplo.
3. Em Authentication → Sign In / Providers → Email, desligue **Confirm email**: o app entra
   direto depois do cadastro. Com a confirmação ligada, o cadastro avisa para abrir o link do e-mail.

## Testes

Rodam contra o Supabase local (precisa do Docker e da CLI do Supabase):

```powershell
supabase start                    # na raiz: aplica as migrações e o seed
supabase status -o env            # API_URL, PUBLISHABLE_KEY (ou ANON_KEY) e DB_URL
cd frontend
$env:VITE_SUPABASE_URL = "<API_URL>"; $env:VITE_SUPABASE_ANON_KEY = "<PUBLISHABLE_KEY>"
npm test                          # funções do banco e telas
npx playwright install chromium   # só na primeira vez
npm run test:e2e                  # navegador de verdade (computador e celular)
```

Cada teste volta o banco aos dados de exemplo (`recriar_dados_exemplo()`, do `seed.sql`). O e2e se
recusa a rodar contra um Supabase que não seja o local. No GitHub Actions tudo isso roda sozinho.

O relatório [`docs/relatorio-testes.md`](docs/relatorio-testes.md) é da versão anterior, com SQLite.

## Verificar produção

```powershell
cd frontend
npm run build
npm run preview
```

O service worker e o manifesto do PWA são gerados no build. A demonstração do GitHub Pages
(`npm run build:pages`) usa o mesmo projeto Supabase.
