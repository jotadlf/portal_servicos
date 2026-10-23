# Portal de Serviços

Aplicação web em React e TypeScript, preparada para instalação como PWA e integração com Supabase.

## Estrutura

```text
frontend/
  public/                   Ícones e arquivos públicos do PWA
  src/
    components/layout/      Componentes compartilhados de layout
    features/solicitacoes/  Funcionalidades de solicitações
    hooks/                  Hooks compartilhados
    lib/                    Clientes e integrações externas
    pages/                  Páginas da aplicação
    types/                  Tipos compartilhados
supabase/
  migrations/               Migrações SQL do banco
```

## Executar localmente

```powershell
cd frontend
npm install
npm run dev
```

`npm run dev` sobe o app (http://localhost:5173) e a API local (`frontend/server/`), que grava num banco SQLite temporário em `frontend/data/portal.sqlite`, criado com dados de exemplo na primeira vez. `npm run db:reset` recria o banco. Contas de teste: `carlos@exemplo.com`, `beatriz@exemplo.com` e `admin@exemplo.com`, senha `teste123`.

## Testes

```powershell
cd frontend
npm test                          # API + SQLite reais e telas contra esse servidor
npx playwright install chromium   # só na primeira vez
npm run test:e2e                  # navegador de verdade (computador e celular)
```

O relatório completo dos testes está em [`docs/relatorio-testes.md`](docs/relatorio-testes.md).

## Supabase (futuro)

Preencha `frontend/.env.local` com a URL do projeto Supabase e a chave `anon`/publishable. Nunca coloque a chave `service_role` no frontend.

## Verificar produção

```powershell
cd frontend
npm run build
npm run preview
```

O service worker e o manifesto do PWA são gerados no build. A integração Supabase está preparada em `frontend/src/lib/supabase.ts`; as credenciais e o esquema do banco devem ser definidos para o projeto antes de habilitar funcionalidades que dependam deles.
