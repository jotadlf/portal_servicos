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
Copy-Item .env.example .env.local
npm run dev
```

Preencha `frontend/.env.local` com a URL do projeto Supabase e a chave `anon`/publishable. Nunca coloque a chave `service_role` no frontend.

## Verificar produção

```powershell
cd frontend
npm run build
npm run preview
```

O service worker e o manifesto do PWA são gerados no build. A integração Supabase está preparada em `frontend/src/lib/supabase.ts`; as credenciais e o esquema do banco devem ser definidos para o projeto antes de habilitar funcionalidades que dependam deles.
