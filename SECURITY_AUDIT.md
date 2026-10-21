# Auditoria de Segurança — portal_servicos — 2026-10-20

Escopo: todo o repositório (27 arquivos versionados), histórico completo do git (todos os commits/refs), `frontend/dist/` local (não versionado).
Modo: somente leitura. Nenhum código do projeto foi executado.

## Resumo

| Severidade | Qtde |
|---|---|
| Crítico | 0 |
| Alto | 0 |
| Médio | 0 |
| Baixo | 1 |
| Info | 4 |

**Conclusão:** o projeto ainda é um esqueleto (uma landing page estática em React + cliente Supabase não utilizado). Não há entradas de usuário, rotas, autenticação, tabelas, Edge Functions nem workflows — portanto **não há superfície explorável hoje**. Nenhuma vulnerabilidade confirmada. Os itens abaixo são hardening e pontos de atenção para quando as funcionalidades forem implementadas.

## Mapa de ataque (Fase 1)

- **Stack:** React 19 + TypeScript + Vite 8 + Mantine 9 + vite-plugin-pwa; `@supabase/supabase-js` 2.x.
- **Pontos de entrada:** nenhum. `App.tsx` só renderiza conteúdo estático; os botões não têm handlers.
- **Supabase:** `frontend/src/lib/supabase.ts` cria o cliente com `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, mas `getSupabaseClient()` não é chamado em lugar nenhum. `supabase/migrations/` está vazio (só `.gitkeep`).
- **Dados sensíveis:** nenhum coletado ainda.
- **Fronteiras de confiança:** cliente ↔ Supabase (futuro). Não há backend, Edge Functions nem terceiros.
- **CI/CD:** não existe `.github/workflows/`, `Dockerfile` nem arquivos `*.sql`.

## Scanners (Fase 2)

| Scanner | Resultado |
|---|---|
| `npm audit` (com e sem dev) | 0 vulnerabilidades |
| gitleaks | **Não executado** — não instalado; os pacotes npm `gitleaks`/`osv-scanner` não são distribuições oficiais (são binários Go), e rodá-los violaria a regra 4. Substituído por varredura regex de todo o histórico (`git grep` em `git rev-list --all`) buscando JWT, `sb_secret_`, `service_role`, `sk-`, `sk-ant-`, `AIza`, `ghp_`, chaves privadas e `password=` → **nenhum segredo**. |
| semgrep | **Não executado** — não instalado e sem `pipx`. Revisão manual cobriu 100% do código (3 arquivos `.ts/.tsx`). |
| osv-scanner | **Não executado** (mesmo motivo do gitleaks). |
| trivy | Não aplicável (sem Dockerfile/IaC) e não instalado. |

Verificações complementares:
- `.env*` no histórico: só `frontend/.env.example`, contendo apenas placeholders (`your-project.supabase.co`, `your-supabase-anon-key`).
- `.gitignore` raiz ignora `.env` / `.env.*` (exceto `.env.example`), `dist/`, `*.local`. Correto.
- Lockfile: 446 pacotes, todos de `registry.npmjs.org`, todos com `integrity`. Único install script: `fsevents` (opcional, macOS, padrão do Vite).
- `frontend/dist/`: sem `.map`, sem JWT/chaves, sem URL Supabase embutida.
- Sinks perigosos (`dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `window.open`, `localStorage`, `href` dinâmico): nenhum.

## Achados

### [BAIXO] Ausência de Content-Security-Policy
- Local: `frontend/index.html:3-10`
- Categoria: OWASP A05 (Security Misconfiguration) / CWE-1021, CWE-693
- Exploração: hoje nenhuma — não há sink de XSS. Classificado como Baixo (e não Médio) porque não há dado de usuário renderizado; passa a ter peso real quando entrarem formulários/solicitações.
- Impacto: sem CSP, um XSS futuro teria execução irrestrita e poderia ler a sessão do Supabase (que o `supabase-js` guarda em `localStorage` por padrão).
- Correção: se o hosting não permitir headers (ex.: GitHub Pages), adicionar em `index.html`:
  ```html
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://<projeto>.supabase.co wss://<projeto>.supabase.co; manifest-src 'self'; worker-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'">
  ```
  (`frame-ancestors` não funciona via `<meta>`; se o host suportar headers, prefira header HTTP com `frame-ancestors 'none'`.) Testar após o build: Mantine injeta estilos inline, daí o `'unsafe-inline'` em `style-src`.
- Confiança: Alta (ausência confirmada); impacto atual: nenhum.

### [INFO] Sessão do Supabase em `localStorage`
- Local: `frontend/src/lib/supabase.ts:17`
- `createClient(url, anonKey)` usa o storage padrão (`localStorage`). Aceitável para SPA, mas qualquer XSS futuro = sequestro de sessão. Mitigação: CSP (acima) + nunca renderizar HTML de usuário sem DOMPurify.

### [INFO] RLS ainda não existe — obrigatório antes de criar tabelas
- Local: `supabase/migrations/` (vazio)
- A chave `anon` vai para o bundle por design; a única proteção dos dados será RLS. Toda tabela em `public` precisa de `ENABLE ROW LEVEL SECURITY` + policies amarradas a `auth.uid()`, inclusive `WITH CHECK` em UPDATE. Papel de admin não pode ficar em coluna editável pelo próprio usuário.

### [INFO] Dados pessoais em arquivo versionado
- Local: `GIT_COMANDOS.md:6-8`
- Contém nome, e-mail e usuário do GitHub do autor. Não é segredo e é o mesmo dado já presente nos metadados dos commits, mas fica visível se o repositório for público. Remover se não for intencional.

### [INFO] Mensagem de erro com caminho de configuração
- Local: `frontend/src/lib/supabase.ts:12-14`
- O erro cita `frontend/.env.local`. Inofensivo (sem valores), apenas expõe detalhe de estrutura caso apareça em produção.

## Suspeitas (não confirmadas)

Nenhuma.

## O que não foi possível verificar

- **Configuração real do projeto Supabase** (RLS, Storage, Auth: política de senha, confirmação de e-mail, MFA, rate limits) — está no painel, não no repositório.
- **Visibilidade do repositório GitHub** (`jotadlf/portal_servicos`) e configurações de branch protection/secrets.
- **Hosting/headers de produção** — não há configuração de deploy no repositório.
- **gitleaks / semgrep / osv-scanner** — não executados (ver Fase 2). Recomenda-se instalar binários oficiais (`winget install gitleaks`, `pip install semgrep`) e rodar novamente.

## Checklist de correção (ordem de prioridade)

1. [ ] Adicionar CSP em `frontend/index.html` (ou via header no host).
2. [ ] Ao criar a primeira migration: RLS em todas as tabelas + policies com `auth.uid()` + `WITH CHECK`.
3. [ ] Ao implementar formulários: validação no banco (constraints/policies), não só no cliente; sem `dangerouslySetInnerHTML` sem DOMPurify.
4. [ ] Ao criar CI (GitHub Actions): `permissions:` mínimo, actions pinadas por SHA, nunca `pull_request_target` com checkout do PR.
5. [ ] Decidir se `GIT_COMANDOS.md` deve permanecer versionado.
6. [ ] Rodar novamente esta auditoria com gitleaks/semgrep instalados quando houver funcionalidades reais.
