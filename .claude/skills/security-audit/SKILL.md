---
name: security-audit
description: Auditoria de segurança profunda do projeto (código, segredos, dependências, Supabase, React, GitHub Actions/Pages, APIs de IA). Usar quando pedir auditoria, pentest de código, revisão de segurança completa ou /security-audit.
allowed-tools: Read, Grep, Glob, Bash
---

# Security Audit — modo rigoroso

Objetivo: encontrar vulnerabilidades **reais e exploráveis**. Zero achado inventado.
Modo padrão: **somente leitura**. Corrigir só com autorização explícita.

## Regras invioláveis
1. Todo achado precisa de prova: `arquivo:linha` + caminho de exploração (entrada → sink).
2. Sem prova = "Suspeita (não confirmada)", nunca "Vulnerabilidade".
3. Segredos encontrados: mostrar só 4 primeiros caracteres + `****`. Nunca imprimir completo.
4. Não executar código do projeto, scripts de instalação ou binários desconhecidos.
5. Não enviar nada para rede além dos scanners listados.
6. Não editar arquivos até o usuário aprovar a lista de correções.

## Fase 1 — Reconhecimento (mapa de ataque)
- Identificar stack: `package.json`, `vite.config.*`, `supabase/`, `.github/workflows/`, `Dockerfile`, `*.sql`.
- Listar pontos de entrada: rotas, formulários, uploads, webhooks, Edge Functions, chamadas a APIs externas.
- Listar dados sensíveis: auth, dados pessoais (LGPD), pagamentos, chaves de API.
- Registrar fronteiras de confiança: cliente ↔ Supabase ↔ funções ↔ terceiros.

## Fase 2 — Scanners automáticos
Rodar o que estiver disponível. Se faltar, usar `npx`/`pipx` e avisar. Falha de um scanner não interrompe a auditoria.

```bash
# Segredos (inclui histórico do git)
gitleaks detect --source . --redact -v || npx --yes gitleaks detect --redact
# SAST
semgrep scan --config p/owasp-top-ten --config p/react --config p/javascript --config p/secrets --error
# Dependências
npm audit --omit=dev --audit-level=moderate
npx --yes osv-scanner -r .
# Infra / IaC / Dockerfile (se houver)
trivy fs --scanners vuln,secret,misconfig .
```

Resultado de scanner é **pista**, não achado. Validar cada um na Fase 4.

## Fase 3 — Revisão manual por domínio

### 3.1 Segredos e configuração
- `.env*` versionado? Checar `git log --all -- '*.env*'` e `.gitignore`.
- Variáveis `VITE_*` / `NEXT_PUBLIC_*` / `REACT_APP_*` vão para o bundle: nenhuma pode ser secreta.
- Chaves de IA (OpenAI, Anthropic, Gemini), WhatsApp, Stripe no frontend = **Crítico**.
- `service_role` do Supabase fora de backend/Edge Function = **Crítico**.

### 3.2 Supabase
- Toda tabela em `public` com `ENABLE ROW LEVEL SECURITY`. Listar as que não têm.
- Policies: `USING (true)` / `WITH CHECK (true)` em tabela sensível = falha.
- Policies devem amarrar a `auth.uid()`; checar UPDATE sem `WITH CHECK` (troca de dono).
- Funções `SECURITY DEFINER`: `search_path` fixo e checagem de permissão interna.
- RPCs expostas ao `anon` sem necessidade.
- Storage: buckets públicos, policies de upload, validação de tipo/tamanho.
- Edge Functions: `verify_jwt` ligado; CORS não `*` com credenciais; validação de entrada.
- Papéis/admin definidos em coluna editável pelo próprio usuário = escalonamento de privilégio.

### 3.3 Frontend (React)
- `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `setTimeout(string)`.
- `href`/`src` com dado do usuário (`javascript:`), `window.open` sem `noopener`.
- Tokens em `localStorage` + qualquer XSS = sequestro de sessão. Avaliar impacto.
- Autorização feita só no cliente (esconder botão ≠ proteger dado).
- Markdown/HTML renderizado sem sanitizador (DOMPurify).
- Redirect aberto em fluxos de login (`?redirect=`).

### 3.4 Backend / APIs / Webhooks
- Injeção: SQL concatenado, comando shell, template, NoSQL, path traversal.
- IDOR: recurso buscado por ID sem checar dono.
- Webhooks (WhatsApp, pagamento) sem verificação de assinatura.
- Sem rate limit em login, OTP, envio de mensagem, chamada de IA (custo).
- SSRF: fetch para URL vinda do usuário.
- Upload: extensão, MIME, tamanho, nome de arquivo.

### 3.5 Integração com IA (LLM)
- Prompt injection: conteúdo do usuário/documento capaz de mudar instruções ou acionar ferramentas.
- Saída do modelo executada/renderizada sem validação (HTML, SQL, comandos).
- Dados pessoais enviados ao provedor sem necessidade.
- Limite de tokens/custo por usuário.

### 3.6 GitHub Actions / Pages
- `pull_request_target` + checkout do código do PR = **Crítico**.
- `permissions:` ausente (default amplo). Exigir mínimo.
- Actions de terceiros sem pin por SHA.
- `${{ github.event.* }}` interpolado direto em `run:` (injeção).
- Segredos impressos em log ou passados para build do frontend.
- Pages: sem headers de servidor → CSP via `<meta http-equiv>`; confirmar que build não contém `.map` com segredos nem `.env`.

### 3.7 Autenticação e sessão
- Política de senha, confirmação de e-mail, expiração de sessão.
- Reset de senha: token único, expiração curta, não vaza se e-mail existe.
- MFA disponível para contas admin.

### 3.8 LGPD / dados
- Dados pessoais coletados sem necessidade, logs com dados pessoais, ausência de exclusão de conta.

## Fase 4 — Validação (anti falso positivo)
Para cada candidato:
1. Rastrear fonte → sink no código real.
2. Checar se há mitigação (sanitização, policy, middleware).
3. Descrever exploração em 1–3 passos.
4. Atribuir confiança: Alta / Média / Baixa. Baixa vai para "Suspeitas".

## Fase 5 — Relatório
Salvar em `SECURITY_AUDIT.md` na raiz. Formato:

```
# Auditoria de Segurança — <projeto> — <data>
## Resumo
| Severidade | Qtde |
Crítico / Alto / Médio / Baixo / Info

## Achados
### [CRÍTICO] <título curto>
- Local: arquivo:linha
- Categoria: OWASP A0x / CWE-xxx
- Exploração: passos
- Impacto: o que o atacante obtém
- Correção: código/SQL concreto
- Confiança: Alta

## Suspeitas (não confirmadas)
## O que não foi possível verificar
## Checklist de correção (ordem de prioridade)
```

Severidade:
- **Crítico**: acesso/alteração de dados de outros usuários, segredo exposto, RCE.
- **Alto**: XSS armazenado, IDOR em dado sensível, bypass de auth.
- **Médio**: falta de rate limit, CSP ausente, dependência vulnerável alcançável.
- **Baixo/Info**: hardening, boas práticas.

## Fase 6 — Correção (somente após aprovação)
- Corrigir do Crítico para o Baixo, um achado por commit.
- Segredo vazado: **rotacionar a chave primeiro**; limpar histórico é secundário.
- Após corrigir, reexecutar scanners e o teste de exploração do achado.
