# Relatório de testes — Portal de Serviços com SQLite temporário

**Data:** 23/10/2026 · **Ambiente:** Windows 10, Node 24.19 (SQLite 3.53 embutido em `node:sqlite`), Vite 8, Vitest 5, Playwright 1.64 (Chromium) · **Banco:** `frontend/data/portal.sqlite`

## 1. Resumo

O app deixou de guardar dados em memória: contas, perfis, prestadores, serviços, publicação, modalidades, configurações do plano, avaliações e contatos agora ficam num banco SQLite, acessado por uma API local (`frontend/server/`). Os testes rodam contra esse servidor e esse banco, sem simulação, e conferem no próprio banco o que cada tela gravou.

| | |
|---|---|
| Verificações feitas | **339** — 290 testes Vitest, 30 execuções no Playwright e 19 checagens de exploração |
| Testes automáticos | **todos passam** (290/290 no Vitest; 29/30 no Playwright, com 1 pulado de propósito) |
| Defeitos achados e já corrigidos | **9** (seção 6) |
| Pontos em aberto | **3 críticos, 5 altos, 5 médios, 4 baixos** (seção 7) |

Os três pontos críticos em aberto são: **o login não limita tentativas de senha**, **o banco local não serve para produção** e **o contato pelo WhatsApp não é registrado** (a aba "Contatos" do prestador nunca recebe pedidos reais).

## 2. O que foi construído

- **Banco** (`server/schema.sql`): tabelas `accounts`, `sessions`, `photos`, `professions`, `professionals`, `services`, `reviews`, `contacts` e `plan_settings`, com chaves estrangeiras e verificações (`CHECK`) no próprio banco. Na primeira execução, o banco é criado com os mesmos dados de exemplo de antes.
- **API** (`server/app.ts`): cada rota confere sessão, permissão e dados **no servidor**, reaproveitando as mesmas validações das telas (`src/lib/nome.ts`, `email.ts`, `cpf.ts`, `whatsapp.ts`, `cep.ts`). Senhas ficam só como hash scrypt; o token da sessão fica só como hash SHA-256.
- **Telas**: passaram a carregar e gravar pela API, com estados de "Carregando…", erro com "Tentar de novo" e botões bloqueados durante o envio (sem envio duplo).
- **Comandos** (em `frontend/`): `npm run dev` (API + app), `npm run db:reset` (recria o banco), `npm test`, `npm run test:e2e`.
- **CI**: o workflow ganhou o job `e2e`, que roda o Playwright no Chromium. Ainda não rodou no GitHub (nada foi enviado).

## 3. Resultado por camada

| Camada | Arquivos | Testes | Passaram |
|---|---:|---:|---:|
| API + SQLite (Vitest, Node) | 5 | 125 | 125 |
| Telas contra o servidor real (Vitest + jsdom) | 8 | 102 | 102 |
| Componentes (Vitest + jsdom) | 3 | 13 | 13 |
| Regras e utilitários (Vitest) | 9 | 50 | 50 |
| Ponta a ponta no navegador (Playwright, Chromium) | 3 | 30 | 29 (+1 pulado) |
| Exploração manual roteirizada (Chromium) | 1 | 19 | ver seção 4 |

O Playwright roda cada cenário duas vezes: numa tela de computador e numa de celular (Pixel 7, 412 px). O cenário "entrar só com o teclado" é pulado no celular.

## 4. Exploração de usabilidade

A exploração estava prevista para o Chrome com a extensão, mas a extensão estava desconectada na hora. Foi feita então com um roteiro no Chromium do Playwright, contra o app rodando em `localhost:5173`, com capturas de tela. Esse roteiro também simulou casos difíceis de reproduzir à mão: servidor fora do ar e rede lenta. A coluna "Antes" mostra o resultado da primeira rodada; "Depois", o da rodada após as correções.

| Id | Cenário | Antes | Depois | Observação |
|---|---|:---:|:---:|---|
| E1 | Clique duplo em "Criar conta" | ✅ | ✅ | Só 1 conta criada (botão fica bloqueado durante o envio) |
| E2 | Colar o WhatsApp com "+55 (62) 99999-8888" | ❌ | ✅ | Virava "(55) 62999-9988"; corrigido |
| E3 | Número do endereço "Qd 12 Lt 34" | ❌ | ✅ | Cortava em 10 caracteres sem avisar; limite agora é 20 |
| E4 | Nome muito longo na saudação | ✅ | ✅ | A saudação usa só o primeiro nome |
| E5 | Abrir o app em outra aba | ⚠️ | ⚠️ | A nova aba pede login de novo (ponto A2) |
| E6 | Servidor fora do ar ao abrir o app | ✅ | ✅ | Mostra aviso e "Tentar de novo" (ver B1) |
| E7 | Rede lenta (catálogo demora 2,5 s) | ✅ | ✅ | Mostra "Carregando…" |
| E8 | Admin digita o preço como "19.90" | ❌ crítico | ✅ | Gravava **R$ 1.990,00**; corrigido |
| E9 | Cliente toca em "Falar no WhatsApp" | ❌ | ❌ | Nada é registrado (ponto C3) |
| C1 | Cadastro de prestador no celular (390 px) | ✅ | ✅ | Sem rolagem lateral |
| C2 | Início, perfil público, entrar, serviços e perfil em 390 px | ✅ | ✅ | Nenhuma página com rolagem lateral |
| C3 | Fim do perfil público no celular | ✅ | ✅ | A última avaliação fica acima do botão fixo do WhatsApp |
| C4 | Área de toque do botão "Mostrar senha" | ✅ | ✅ | 40×40 px (ver B2) |
| K1 | Ordem do Tab no cadastro | ✅ | ✅ | Nome → E-mail → Senha → olho → Confirmar → olho → chave → Criar conta → Entrar |
| K2 | Ligar "oferecer serviços" com a barra de espaço | ✅ | ✅ | Liga, e o contorno de foco aparece |

Os testes automáticos também revelaram problemas de usabilidade, já corrigidos e listados na seção 6: o voltar do navegador depois de entrar e o aviso de imagem que nunca aparecia no admin.

## 5. Validação do armazenamento (campo → coluna)

Cada linha vem de um teste que envia o valor pela tela ou pela API e depois lê a coluna direto no SQLite.

| Tela | Campo | Enviado | Coluna | Gravado |
|---|---|---|---|---|
| Cadastro | Nome | `"  Ana   Lima "` | `accounts.name` | `Ana Lima` (espaços aparados e repetidos juntados) |
| Cadastro | E-mail | `"  Ana.Lima@Exemplo.COM "` | `accounts.email` | `ana.lima@exemplo.com` |
| Cadastro | Senha | `segredo1` | `accounts.password_hash` | `scrypt$<sal>$<hash>`; nunca o texto, e sal diferente em cada conta |
| Cadastro | CPF (prestador) | `529.982.247-25` | `accounts.cpf` | `52998224725`; `NULL` para quem só contrata, mesmo se enviado |
| Cadastro | Oferecer serviços | ligado | `professionals` | Nova linha com `status = 'rascunho'`, sem plano |
| Login | Sessão | — | `sessions.token_hash` | Hash do token (não o token), vencendo em 7 dias |
| Perfil | WhatsApp | `(62) 99999-8888` | `accounts.phone` e `professionals.whatsapp` | `62999998888` |
| Perfil | CEP | `74215-010` | `accounts.cep` | `74215010` |
| Perfil | Rua | `" Rua T-30 "` | `accounts.street` | `Rua T-30` |
| Perfil | Número | `Qd 12 Lt 34 Casa 2` | `accounts.number` | igual (até 20 caracteres) |
| Perfil | Complemento | `Apto 302` | `accounts.complement` | igual |
| Perfil | Bairro | `Setor Bueno` | `accounts.neighborhood` e `professionals.neighborhood` | igual; só o bairro vai para o perfil público |
| Perfil | Cidade | `Pau-d’Arco` | `accounts.city` | igual |
| Perfil | UF | `go` | `accounts.state` | `GO` |
| Perfil | Foto | PNG | `photos.data` (BLOB) + `accounts.photo_id` + `professionals.photo_id` | Bytes idênticos aos enviados; a foto antiga é apagada ao trocar |
| Serviços | Serviço | `"  Instalar   ventilador "`, R$ 120 | `services.name`, `price`, `position` | `Instalar ventilador`, `120`, `0`; preço vazio vira `NULL` |
| Serviços | Sobre | `"  Atendo a região sul.  "` | `professionals.about` | aparado; emoji e acentos íntegros; SQL e HTML gravados como texto |
| Publicar | Plano e pagamento | Semestral, cartão | `professionals.status/plan/payment_method/trial_ends_at` | `publicado`, `semestral`, `cartao`, hoje + 15 dias |
| Contatos | Marcar respondido | — | `contacts.answered` | `1` |
| Admin | Plano | 25 / 120,456 / 30 dias / Stripe / só cartão | `plan_settings.*` | `25`, `120.46`, `30`, `stripe`, `pix_enabled 0`, `card_enabled 1` |
| Admin | Modalidade | `" Técnico de Ar-condicionado "` | `professions.id/name/tasks/position` | `tecnico-de-ar-condicionado`, nome aparado, serviços em JSON, posição 9 |
| Admin | Remover modalidade | Eletricista | `services` | Os serviços dessa modalidade são apagados de todos os perfis |

Quando o envio é recusado, outros testes conferem que o banco **não muda**: a linha da conta fica igual, nenhuma foto é gravada e a lista de serviços continua a anterior.

## 6. Defeitos encontrados e corrigidos

| # | Gravidade | Defeito | Como foi achado | Correção |
|---|---|---|---|---|
| 1 | **Crítica** | Admin: preço "19.90" gravado como R$ 1.990,00 | Exploração (E8) | O ponto vira separador dos centavos quando não há vírgula; valores ambíguos como "1.234" são recusados |
| 2 | **Crítica** | Antes da API, preços, sobrenome e WhatsApp dos prestadores ficavam no código do navegador mesmo sem login; a tela só escondia | Revisão ao montar a API | O servidor não envia esses dados a quem não entrou na conta (teste "nada disso sai do servidor") |
| 3 | **Alta** | Administração protegida só escondendo a tela | Revisão ao montar a API | Toda escrita de admin é conferida no servidor (401 sem login, 403 para quem não é admin) |
| 4 | **Alta** | A foto aceitava SVG, que pode carregar script, servido pelo mesmo endereço do app | Revisão ao montar a API | Só PNG, JPEG, WebP e GIF, conferidos pelo conteúdo do arquivo (um PDF renomeado para .png é recusado) |
| 5 | Média | Depois de um envio acima de 8 MB, a próxima requisição na mesma conexão travava | Teste da API (timeout) | A conexão é fechada depois de responder 413 |
| 6 | Média | Admin: o aviso "Escolha uma imagem PNG ou WebP" nunca aparecia (o formulário apagava o aviso logo em seguida) | Teste de tela | O evento do arquivo não chega mais ao formulário |
| 7 | Média | Voltar pelo navegador depois de entrar mostrava o formulário de login de novo | Teste no Playwright | Quem já entrou vê "Você já está na sua conta" com link para o início |
| 8 | Baixa | WhatsApp colado com +55 ficava errado | Exploração (E2) | O código 55 sai quando o número tem mais de 11 dígitos |
| 9 | Baixa | Número do endereço cortado em 10 caracteres, sem aviso | Teste de tela e exploração (E3) | Limite de 20 na tela e no servidor |

## 7. Pontos em aberto

### Críticos

| Id | Ponto | Evidência | Recomendação |
|---|---|---|---|
| C1 | **O login não limita tentativas de senha**: dá para testar senhas sem parar | Teste `PONTO CRÍTICO: não limita tentativas seguidas de senha` (15 erros seguidos e o login seguinte entra) | Bloqueio progressivo por e-mail e por IP, ou usar o Supabase Auth, que já limita |
| C2 | **O banco local não serve para produção**: a API só roda na máquina, uma hospedagem estática (como GitHub Pages) não executa servidor e não há backup | Arquitetura | Usar só em desenvolvimento e migrar para o Supabase (seção 9) |
| C3 | **O contato pelo WhatsApp não é registrado**: a aba "Contatos" do prestador e o número "contatos pedidos" do painel só mostram dados de exemplo | Exploração (E9) | Gravar um registro em `contacts` ao tocar em "Falar no WhatsApp" |

### Altos

| Id | Ponto | Evidência | Recomendação |
|---|---|---|---|
| A1 | Quem vira prestador pelo botão "Quero oferecer serviços", na tela Serviços, não informa CPF (no cadastro, o CPF é exigido) | Teste `PONTO DE ATENÇÃO: vira prestador sem informar CPF` | Pedir o CPF nesse botão ou antes de publicar |
| A2 | A sessão vale só na aba: um link aberto em outra aba pede login de novo; o token fica no `sessionStorage`, legível por script se um dia houver XSS | Exploração (E5) | Cookie `httpOnly` ou a sessão do Supabase com "manter conectado" |
| A3 | Publicar ativa o período grátis sem criar assinatura no gateway | Código (`TODO` em `/api/prestador/publicar`) | Integrar o gateway antes de cobrar de verdade |
| A4 | Não há recuperação de senha nem confirmação de e-mail | Funcionalidade ausente | O Supabase Auth oferece as duas |
| A5 | O CPF não pode ser visto nem corrigido depois do cadastro | Funcionalidade ausente | Mostrar mascarado no Perfil e permitir correção com conferência |

### Médios

| Id | Ponto | Evidência | Recomendação |
|---|---|---|---|
| M1 | A API devolve só o primeiro erro de validação por vez (a tela já mostra todos) | Teste `PONTO DE ATENÇÃO: cadastro só devolve o primeiro problema de cada vez` | Juntar todos os erros na resposta |
| M2 | Acessibilidade: o texto de ajuda fica dentro do `<label>`, então o leitor de tela lê "Senha Pelo menos 6 caracteres." como nome do campo e repete a ajuda em seguida | Playwright (nome acessível do campo) | Tirar a ajuda de dentro do `<label>`, deixando só o `aria-describedby` |
| M3 | Clientes não têm como avaliar prestadores; notas e contagens são as dos dados de exemplo | Funcionalidade ausente | Tela de avaliação depois do contato |
| M4 | Os gráficos de "Evolução" no admin são de exemplo | A própria tela avisa | Calcular a partir de datas de cadastro e pagamento |
| M5 | Prestadores de exemplo publicados continuam sem foto (a exigência nova não vale para quem já estava publicado) | Dados de exemplo | Pedir foto na próxima vez que entrarem |

### Baixos

| Id | Ponto | Recomendação |
|---|---|---|
| B1 | Com o servidor fora do ar, o Início mostra o aviso de erro e também a dica "Escolha uma profissão", que fica sem sentido | Esconder a dica enquanto houver erro |
| B2 | Os botões de ícone têm 40×40 px; a WCAG 2.2 exige 24 px (ok), mas o recomendado para toque é 44 px | Aumentar para 44 px |
| B3 | Fotos guardadas no SQLite: serve para o protótipo | Mover para um storage de arquivos (Supabase Storage) |
| B4 | Ao remover uma modalidade, a imagem dela continua no banco, sem uso | Apagar a imagem junto |

## 8. Como rodar

Na pasta `frontend/`:

- `npm run dev`: sobe a API (porta 3001, banco em `data/portal.sqlite`) e o app em http://localhost:5173.
- `npm run db:reset`: apaga o banco e recria com os dados de exemplo. Contas de teste: `carlos@exemplo.com`, `beatriz@exemplo.com` e `admin@exemplo.com`, todas com a senha `teste123`.
- `npm test`: testes da API e das telas, cada arquivo com um banco novo na memória.
- `npm run test:e2e`: Playwright. Sobe API, banco temporário e app sozinho. Na primeira vez, rode `npx playwright install chromium`.

## 9. Próximos passos: do SQLite para o Supabase

As telas não falam com o SQLite diretamente: falam com funções em `src/features/*` (`signIn`, `createAccount`, `updateAccount`, `fetchProfessionalsFor`, `saveServices`, `publishProfile`…). Para migrar, basta trocar o corpo dessas funções por chamadas ao Supabase e transformar `server/schema.sql` em migration, com RLS amarrada a `auth.uid()`. As regras que hoje estão em `server/app.ts` viram políticas RLS e funções do banco, e os testes da API servem de lista do que essas regras precisam garantir.

## Apêndice — todos os testes automáticos

Resultado da execução final (todos os ✅ são de 23/10/2026).

#### `server/admin.test.ts` — API + SQLite (Vitest, Node)

| # | Teste | Resultado |
|---:|---|:---:|
| 1 | Administração: permissões conferidas no servidor › POST /api/catalogo: 401 sem login e 403 para quem não é admin | ✅ |
| 2 | Administração: permissões conferidas no servidor › DELETE /api/catalogo/eletricista: 401 sem login e 403 para quem não é admin | ✅ |
| 3 | Administração: permissões conferidas no servidor › PUT /api/plano: 401 sem login e 403 para quem não é admin | ✅ |
| 4 | Administração: permissões conferidas no servidor › GET /api/admin/estatisticas: 401 sem login e 403 para quem não é admin | ✅ |
| 5 | Administração: permissões conferidas no servidor › a modalidade continua lá depois da tentativa sem permissão | ✅ |
| 6 | Administração: modalidades › cria a modalidade e grava nome, id, serviços e posição | ✅ |
| 7 | Administração: modalidades › grava a imagem enviada (PNG) e recusa SVG | ✅ |
| 8 | Administração: modalidades › recusa nome vazio | ✅ |
| 9 | Administração: modalidades › recusa nome com número | ✅ |
| 10 | Administração: modalidades › recusa nome repetido (sem acento/maiúscula) | ✅ |
| 11 | Administração: modalidades › recusa sem serviços | ✅ |
| 12 | Administração: modalidades › recusa serviços em formato errado | ✅ |
| 13 | Administração: modalidades › remover a modalidade apaga os serviços dela de todos os perfis | ✅ |
| 14 | Administração: plano › grava os novos valores e todo mundo passa a ver | ✅ |
| 15 | Administração: plano › o novo período grátis vale para quem publicar depois | ✅ |
| 16 | Administração: plano › recusa preço zero | ✅ |
| 17 | Administração: plano › recusa preço em texto | ✅ |
| 18 | Administração: plano › recusa período grátis acima de 90 | ✅ |
| 19 | Administração: plano › recusa período grátis quebrado | ✅ |
| 20 | Administração: plano › recusa gateway fora da lista | ✅ |
| 21 | Administração: plano › recusa sem forma de pagamento | ✅ |
| 22 | Administração: painel › conta os números a partir do banco | ✅ |
| 23 | Administração: painel › acompanha um prestador novo no período grátis | ✅ |

#### `server/auth.test.ts` — API + SQLite (Vitest, Node)

| # | Teste | Resultado |
|---:|---|:---:|
| 24 | Cadastro real: dados gravados no banco › grava a conta de quem só contrata, campo a campo | ✅ |
| 25 | Cadastro real: dados gravados no banco › guarda a senha só como hash, com sal diferente em cada conta | ✅ |
| 26 | Cadastro real: dados gravados no banco › grava o prestador com CPF só em dígitos e cria o perfil em rascunho | ✅ |
| 27 | Cadastro real: dados gravados no banco › não devolve senha, hash nem CPF na resposta | ✅ |
| 28 | Cadastro real: dados gravados no banco › recusa e-mail já usado, mesmo com maiúsculas e espaços | ✅ |
| 29 | Cadastro real: dados gravados no banco › recusa CPF já usado por outro prestador | ✅ |
| 30 | Cadastro real: dados gravados no banco › recusa nome vazio | ✅ |
| 31 | Cadastro real: dados gravados no banco › recusa nome com número | ✅ |
| 32 | Cadastro real: dados gravados no banco › recusa nome com símbolo | ✅ |
| 33 | Cadastro real: dados gravados no banco › recusa nome com mais de 60 letras | ✅ |
| 34 | Cadastro real: dados gravados no banco › recusa nome que não é texto | ✅ |
| 35 | Cadastro real: dados gravados no banco › recusa e-mail vazio | ✅ |
| 36 | Cadastro real: dados gravados no banco › recusa e-mail sem domínio | ✅ |
| 37 | Cadastro real: dados gravados no banco › recusa e-mail com espaço no meio | ✅ |
| 38 | Cadastro real: dados gravados no banco › recusa e-mail que não é texto | ✅ |
| 39 | Cadastro real: dados gravados no banco › recusa senha curta | ✅ |
| 40 | Cadastro real: dados gravados no banco › recusa senha que não é texto | ✅ |
| 41 | Cadastro real: dados gravados no banco › recusa senha longa demais | ✅ |
| 42 | Cadastro real: dados gravados no banco › recusa prestador sem CPF | ✅ |
| 43 | Cadastro real: dados gravados no banco › recusa prestador com CPF inválido | ✅ |
| 44 | Cadastro real: dados gravados no banco › recusa prestador com CPF de dígitos iguais | ✅ |
| 45 | Cadastro real: dados gravados no banco › aceita nomes com acento, apóstrofo e hífen | ✅ |
| 46 | Cadastro real: dados gravados no banco › ignora CPF enviado por quem não vai oferecer serviços | ✅ |
| 47 | Cadastro real: dados gravados no banco › recusa corpo que não é JSON de objeto | ✅ |
| 48 | Login real › entra com a conta de teste, ignorando maiúsculas e espaços no e-mail | ✅ |
| 49 | Login real › entra com a conta recém-criada | ✅ |
| 50 | Login real › dá a mesma resposta para senha errada e e-mail que não existe | ✅ |
| 51 | Login real › diferencia maiúsculas na senha | ✅ |
| 52 | Login real › recusa login sem dados | ✅ |
| 53 | Login real › identifica a conta pelo token e sai de verdade | ✅ |
| 54 | Login real › guarda só o hash do token da sessão | ✅ |
| 55 | Login real › sessão vencida não vale mais | ✅ |
| 56 | Login real › cada login abre uma sessão; sair de uma não derruba a outra | ✅ |
| 57 | Login real › token inventado ou mal formatado não entra | ✅ |
| 58 | Login real › PONTO CRÍTICO: não limita tentativas seguidas de senha | ✅ |

#### `server/conta.test.ts` — API + SQLite (Vitest, Node)

| # | Teste | Resultado |
|---:|---|:---:|
| 59 | Perfil: cada campo gravado no banco › normaliza e grava todos os campos | ✅ |
| 60 | Perfil: cada campo gravado no banco › aceita endereço em branco (é opcional) | ✅ |
| 61 | Perfil: cada campo gravado no banco › copia nome, WhatsApp e bairro para o perfil público do prestador (e nada mais) | ✅ |
| 62 | Perfil: cada campo gravado no banco › recusa nome com número e não altera o banco | ✅ |
| 63 | Perfil: cada campo gravado no banco › recusa nome vazio e não altera o banco | ✅ |
| 64 | Perfil: cada campo gravado no banco › recusa WhatsApp sem DDD e não altera o banco | ✅ |
| 65 | Perfil: cada campo gravado no banco › recusa WhatsApp com DDD começando em 0 e não altera o banco | ✅ |
| 66 | Perfil: cada campo gravado no banco › recusa CEP incompleto e não altera o banco | ✅ |
| 67 | Perfil: cada campo gravado no banco › recusa cidade com número e não altera o banco | ✅ |
| 68 | Perfil: cada campo gravado no banco › recusa UF que não existe e não altera o banco | ✅ |
| 69 | Perfil: cada campo gravado no banco › recusa rua com mais de 80 letras e não altera o banco | ✅ |
| 70 | Perfil: cada campo gravado no banco › recusa complemento que não é texto e não altera o banco | ✅ |
| 71 | Perfil: cada campo gravado no banco › exige foto de quem oferece serviços, não de quem só contrata | ✅ |
| 72 | Perfil: cada campo gravado no banco › não deixa mudar e-mail, senha, CPF nem virar admin pelo perfil | ✅ |
| 73 | Perfil: cada campo gravado no banco › cada um só altera a própria conta | ✅ |
| 74 | Perfil: foto › grava a imagem no banco e devolve a mesma imagem | ✅ |
| 75 | Perfil: foto › trocar a foto apaga a antiga do banco | ✅ |
| 76 | Perfil: foto › recusa SVG (pode conter script) | ✅ |
| 77 | Perfil: foto › recusa PDF disfarçado de PNG | ✅ |
| 78 | Perfil: foto › recusa texto que não é data URL | ✅ |
| 79 | Perfil: foto › recusa campo vazio | ✅ |
| 80 | Perfil: foto › recusa foto acima de 5 MB | ✅ |
| 81 | Perfil: foto › recusa envio acima de 8 MB sem ler tudo | ✅ |
| 82 | Perfil: foto › foto que não existe responde 404 | ✅ |
| 83 | Perfil: virar prestador › cria um único perfil de prestador, mesmo chamando duas vezes | ✅ |
| 84 | Perfil: virar prestador › PONTO DE ATENÇÃO: vira prestador sem informar CPF | ✅ |
| 85 | Perfil: sem login › GET /api/auth/eu responde 401 | ✅ |
| 86 | Perfil: sem login › PATCH /api/conta responde 401 | ✅ |
| 87 | Perfil: sem login › POST /api/conta/foto responde 401 | ✅ |
| 88 | Perfil: sem login › POST /api/conta/prestador responde 401 | ✅ |
| 89 | Perfil: sem login › POST /api/auth/sair responde 401 | ✅ |

#### `server/prestador.test.ts` — API + SQLite (Vitest, Node)

| # | Teste | Resultado |
|---:|---|:---:|
| 90 | Busca de prestadores › sem login: só o primeiro nome, sem preço e sem WhatsApp (nada disso sai do servidor) | ✅ |
| 91 | Busca de prestadores › com login: nome completo, preço e WhatsApp | ✅ |
| 92 | Busca de prestadores › serviço "a combinar" não aparece como escondido | ✅ |
| 93 | Busca de prestadores › ordena pela reputação (poucas avaliações não passam na frente) | ✅ |
| 94 | Busca de prestadores › rascunho não aparece na busca nem no perfil público, só para o dono | ✅ |
| 95 | Busca de prestadores › perfil público traz as avaliações | ✅ |
| 96 | Meus serviços: gravação › grava os serviços na ordem, com preço inteiro ou a combinar | ✅ |
| 97 | Meus serviços: gravação › substitui a lista inteira (apagar um serviço some do banco) | ✅ |
| 98 | Meus serviços: gravação › recusa profissão que não existe e mantém a lista anterior | ✅ |
| 99 | Meus serviços: gravação › recusa nome vazio e mantém a lista anterior | ✅ |
| 100 | Meus serviços: gravação › recusa nome com mais de 60 letras e mantém a lista anterior | ✅ |
| 101 | Meus serviços: gravação › recusa preço negativo e mantém a lista anterior | ✅ |
| 102 | Meus serviços: gravação › recusa preço com centavos e mantém a lista anterior | ✅ |
| 103 | Meus serviços: gravação › recusa preço em texto e mantém a lista anterior | ✅ |
| 104 | Meus serviços: gravação › recusa preço acima do limite e mantém a lista anterior | ✅ |
| 105 | Meus serviços: gravação › recusa serviço repetido na mesma profissão, sem diferenciar maiúsculas e acentos | ✅ |
| 106 | Meus serviços: gravação › aceita o mesmo nome em profissões diferentes | ✅ |
| 107 | Meus serviços: gravação › grava o texto "Sobre" e recusa acima de 300 caracteres | ✅ |
| 108 | Meus serviços: gravação › quem só contrata não tem área de prestador | ✅ |
| 109 | Publicar perfil › lista o que falta: foto, WhatsApp e serviço | ✅ |
| 110 | Publicar perfil › publica e grava plano, forma de pagamento e fim do período grátis | ✅ |
| 111 | Publicar perfil › não publica duas vezes | ✅ |
| 112 | Publicar perfil › recusa plano inválido e forma de pagamento desligada | ✅ |
| 113 | Contatos do prestador › lista os contatos e grava "respondido" | ✅ |
| 114 | Contatos do prestador › não marca contato de outro prestador | ✅ |

#### `server/seguranca.test.ts` — API + SQLite (Vitest, Node)

| # | Teste | Resultado |
|---:|---|:---:|
| 115 | Textos maliciosos ou incomuns › SQL injection no login não entra (' OR '1'='1) | ✅ |
| 116 | Textos maliciosos ou incomuns › SQL injection em texto livre é gravado como texto, sem efeito no banco | ✅ |
| 117 | Textos maliciosos ou incomuns › HTML/script é gravado literalmente (a tela mostra como texto) | ✅ |
| 118 | Textos maliciosos ou incomuns › emoji e acentos chegam inteiros ao banco e de volta | ✅ |
| 119 | Textos maliciosos ou incomuns › nome com emoji é recusado | ✅ |
| 120 | Dados sensíveis nunca saem do servidor › CPF e hash da senha não aparecem em nenhuma resposta | ✅ |
| 121 | Dados sensíveis nunca saem do servidor › respostas da API não ficam em cache | ✅ |
| 122 | Endereços e métodos › rota que não existe: 404; método errado: 405 | ✅ |
| 123 | Endereços e métodos › erros vêm com mensagem em português e campo | ✅ |
| 124 | Endereços e métodos › PONTO DE ATENÇÃO: cadastro só devolve o primeiro problema de cada vez | ✅ |
| 125 | Endereços e métodos › conta apagada derruba as sessões dela | ✅ |

#### `src/App.test.tsx` — Telas contra o servidor real (Vitest + jsdom)

| # | Teste | Resultado |
|---:|---|:---:|
| 126 | App › abre na página inicial | ✅ |
| 127 | App › abre a página pelo endereço | ✅ |
| 128 | App › entra e volta para a página de onde saiu, já com os dados completos | ✅ |
| 129 | App › leva quem administra direto para o painel | ✅ |
| 130 | App › quem já entrou e volta para #/entrar não vê o formulário de novo | ✅ |
| 131 | App › recarregar a página mantém a pessoa na conta | ✅ |
| 132 | App › sair encerra a sessão no servidor | ✅ |
| 133 | App › sessão vencida no meio do uso volta para visitante | ✅ |

#### `src/components/BottomMenu.test.tsx` — Componentes (Vitest + jsdom)

| # | Teste | Resultado |
|---:|---|:---:|
| 134 | BottomMenu › leva para as páginas principais e marca a atual | ✅ |
| 135 | BottomMenu › só mostra a administração para quem administra | ✅ |
| 136 | BottomMenu › avisa a página inicial ao tocar em Início | ✅ |

#### `src/components/graficos/escala.test.ts` — Componentes (Vitest + jsdom)

| # | Teste | Resultado |
|---:|---|:---:|
| 137 | niceTicks › usa 0 e 1 quando não há valores | ✅ |
| 138 | niceTicks › arredonda o teto para um passo limpo | ✅ |
| 139 | niceTicks › respeita a quantidade de intervalos pedida | ✅ |
| 140 | niceTicks › sempre cobre o valor máximo | ✅ |
| 141 | compact › abrevia milhares no padrão brasileiro | ✅ |
| 142 | columnPath › desenha a barra com o topo arredondado | ✅ |
| 143 | columnPath › reduz o raio em barras baixas | ✅ |

#### `src/components/Rating.test.tsx` — Componentes (Vitest + jsdom)

| # | Teste | Resultado |
|---:|---|:---:|
| 144 | Rating › mostra a nota e a quantidade de avaliações | ✅ |
| 145 | Rating › usa o singular com uma avaliação | ✅ |
| 146 | Rating › avisa quando o prestador ainda não tem avaliações | ✅ |

#### `src/features/conta/plano.test.ts` — Regras e utilitários (Vitest)

| # | Teste | Resultado |
|---:|---|:---:|
| 147 | planos › oferece mensal e semestral com os preços configurados | ✅ |
| 148 | planos › acompanha os valores da administração | ✅ |
| 149 | planos › cai no mensal quando o plano não existe | ✅ |
| 150 | planSavings › não há economia no mensal | ✅ |
| 151 | planSavings › compara o semestral com 6 meses do mensal | ✅ |
| 152 | monthlyValue › divide o preço pelo período | ✅ |
| 153 | trialEndDate › soma os dias grátis, virando o mês | ✅ |
| 154 | trialEndDate › usa os dias configurados | ✅ |
| 155 | isoDate › usa o dia local, não o UTC | ✅ |

#### `src/hooks/useHashRoute.test.ts` — Regras e utilitários (Vitest)

| # | Teste | Resultado |
|---:|---|:---:|
| 156 | parse › reconhece cada rota | ✅ |
| 157 | parse › mantém o link antigo da Área do prestador | ✅ |
| 158 | parse › manda para o início o que não conhece ou está incompleto | ✅ |
| 159 | parse › aceita o hash sem a barra | ✅ |
| 160 | routes › gera links que voltam para a mesma rota | ✅ |

#### `src/lib/cep.test.ts` — Regras e utilitários (Vitest)

| # | Teste | Resultado |
|---:|---|:---:|
| 161 | isValidUf › aceita as siglas dos estados, em qualquer caixa | ✅ |
| 162 | isValidUf › recusa siglas que não existem | ✅ |
| 163 | formatCep › aplica a máscara 00000-000 | ✅ |
| 164 | fetchAddress › não consulta CEP incompleto | ✅ |
| 165 | fetchAddress › converte a resposta do ViaCEP | ✅ |
| 166 | fetchAddress › preenche campos ausentes com texto vazio | ✅ |
| 167 | fetchAddress › devolve null para CEP inexistente, erro HTTP ou falha de rede | ✅ |

#### `src/lib/cpf.test.ts` — Regras e utilitários (Vitest)

| # | Teste | Resultado |
|---:|---|:---:|
| 168 | formatCpf › aplica a máscara conforme a digitação | ✅ |
| 169 | formatCpf › ignora o que não é dígito e corta no 11º | ✅ |
| 170 | isValidCpf › aceita CPFs com dígitos verificadores certos | ✅ |
| 171 | isValidCpf › aceita dígito verificador zero | ✅ |
| 172 | isValidCpf › recusa dígito verificador errado | ✅ |
| 173 | isValidCpf › recusa todos os dígitos iguais, tamanho errado e máscara | ✅ |

#### `src/lib/email.test.ts` — Regras e utilitários (Vitest)

| # | Teste | Resultado |
|---:|---|:---:|
| 174 | isValidEmail › aceita e-mails comuns | ✅ |
| 175 | isValidEmail › recusa e-mails incompletos ou malformados | ✅ |
| 176 | isValidEmail › recusa e-mail longo demais | ✅ |

#### `src/lib/format.test.ts` — Regras e utilitários (Vitest)

| # | Teste | Resultado |
|---:|---|:---:|
| 177 | normalize › ignora maiúsculas e acentos | ✅ |
| 178 | formatRating › mostra sempre uma casa decimal com vírgula | ✅ |
| 179 | formatPrice › formata em reais sem centavos | ✅ |
| 180 | formatDate › mostra dia e mês abreviado sem mudar o dia pelo fuso | ✅ |
| 181 | greeting › cumprimenta conforme a hora | ✅ |
| 182 | nomes › pega o primeiro nome | ✅ |
| 183 | nomes › pega as iniciais dos dois primeiros nomes | ✅ |

#### `src/lib/nome.test.ts` — Regras e utilitários (Vitest)

| # | Teste | Resultado |
|---:|---|:---:|
| 184 | isValidName › aceita nomes com acento, apóstrofo e hífen | ✅ |
| 185 | isValidName › aceita acento digitado como letra + sinal separado | ✅ |
| 186 | isValidName › recusa números e símbolos | ✅ |
| 187 | isValidName › recusa vazio e separador solto | ✅ |

#### `src/lib/supabase.test.ts` — Regras e utilitários (Vitest)

| # | Teste | Resultado |
|---:|---|:---:|
| 188 | getSupabaseClient › avisa quando as variáveis de ambiente faltam | ✅ |
| 189 | getSupabaseClient › cria o cliente uma vez e reaproveita | ✅ |

#### `src/lib/whatsapp.test.ts` — Regras e utilitários (Vitest)

| # | Teste | Resultado |
|---:|---|:---:|
| 190 | isValidPhone › aceita DDD + 8 ou 9 dígitos | ✅ |
| 191 | isValidPhone › recusa DDD começando com zero, tamanho errado ou máscara | ✅ |
| 192 | formatPhone › aplica a máscara conforme a digitação | ✅ |
| 193 | formatPhone › tira o código do Brasil de número colado | ✅ |
| 194 | formatPhone › ignora o que não é dígito e corta no 11º | ✅ |
| 195 | contactMessage › cita o serviço quando informado | ✅ |
| 196 | openWhatsapp › abre o wa.me com o código do Brasil e a mensagem codificada | ✅ |

#### `src/pages/Admin.test.tsx` — Telas contra o servidor real (Vitest + jsdom)

| # | Teste | Resultado |
|---:|---|:---:|
| 197 | Admin: acesso › sem login pede a conta de administração | ✅ |
| 198 | Admin: acesso › bloqueia quem não administra | ✅ |
| 199 | Admin: painel com números do banco › mostra os números e os gráficos | ✅ |
| 200 | Admin: painel com números do banco › troca o período dos gráficos | ✅ |
| 201 | Admin: modalidades gravadas no banco › adiciona uma modalidade nova com imagem | ✅ |
| 202 | Admin: modalidades gravadas no banco › valida nome, números, duplicidade e serviços | ✅ |
| 203 | Admin: modalidades gravadas no banco › recusa imagem SVG | ✅ |
| 204 | Admin: modalidades gravadas no banco › remove só depois de confirmar e apaga os serviços junto | ✅ |
| 205 | Admin: plano e pagamentos gravados no banco › salva os novos valores do plano | ✅ |
| 206 | Admin: plano e pagamentos gravados no banco › aceita preço com separador de milhar ("1.234,50") | ✅ |
| 207 | Admin: plano e pagamentos gravados no banco › entende "19.90" como R$ 19.9 | ✅ |
| 208 | Admin: plano e pagamentos gravados no banco › entende "19,90" como R$ 19.9 | ✅ |
| 209 | Admin: plano e pagamentos gravados no banco › entende "25" como R$ 25 | ✅ |
| 210 | Admin: plano e pagamentos gravados no banco › recusa preço ambíguo ("1.234" sem vírgula) | ✅ |
| 211 | Admin: plano e pagamentos gravados no banco › recusa preço inválido, período longo e nenhuma forma de pagamento | ✅ |

#### `src/pages/Conta.test.tsx` — Telas contra o servidor real (Vitest + jsdom)

| # | Teste | Resultado |
|---:|---|:---:|
| 212 | Conta: gravação real › sem login pede para entrar | ✅ |
| 213 | Conta: gravação real › grava nome, telefone e endereço no banco, normalizados | ✅ |
| 214 | Conta: gravação real › o que foi salvo continua lá ao abrir o perfil de novo | ✅ |
| 215 | Conta: gravação real › formata o WhatsApp e não grava número incompleto | ✅ |
| 216 | Conta: gravação real › não grava nome com números | ✅ |
| 217 | Conta: gravação real › não grava cidade com números | ✅ |
| 218 | Conta: gravação real › não grava CEP incompleto | ✅ |
| 219 | Conta: gravação real › aceita número de endereço no formato quadra/lote | ✅ |
| 220 | Conta: gravação real › WhatsApp colado com +55 é gravado sem o código do país | ✅ |
| 221 | Conta: gravação real › UF aceita só letras e recusa sigla que não existe | ✅ |
| 222 | Conta: gravação real › mostra o link da administração só para admin | ✅ |
| 223 | Conta: gravação real › sai da conta | ✅ |
| 224 | Conta: foto › quem só contrata salva sem foto | ✅ |
| 225 | Conta: foto › exige foto de quem oferece serviços e grava a imagem no banco | ✅ |
| 226 | Conta: foto › recusa SVG antes de enviar | ✅ |
| 227 | Conta: foto › o servidor recusa arquivo disfarçado de imagem | ✅ |
| 228 | Conta: foto › recusa foto maior que 5 MB | ✅ |
| 229 | Conta: CEP › preenche o endereço pelo CEP e põe o foco no número | ✅ |
| 230 | Conta: CEP › avisa quando o CEP não existe | ✅ |

#### `src/pages/Entrar.test.tsx` — Telas contra o servidor real (Vitest + jsdom)

| # | Teste | Resultado |
|---:|---|:---:|
| 231 | Entrar: login real › entra com e-mail e senha corretos e guarda a sessão | ✅ |
| 232 | Entrar: login real › avisa quando a senha está errada e limpa o aviso ao digitar | ✅ |
| 233 | Entrar: login real › bloqueia o botão enquanto confere a senha (sem envio duplo) | ✅ |
| 234 | Entrar: login real › avisa quando o servidor não responde | ✅ |
| 235 | Entrar: login real › avisa que o login social ainda não funciona | ✅ |
| 236 | Entrar: login real › não oferece entrar com Apple | ✅ |
| 237 | Entrar: login real › oferece o link para criar conta | ✅ |
| 238 | Entrar: validação dos campos › marca os campos vazios ao tentar entrar e leva o foco ao primeiro | ✅ |
| 239 | Entrar: validação dos campos › só acusa o campo depois que a pessoa sai dele | ✅ |
| 240 | Entrar: validação dos campos › confere todos os campos do cadastro | ✅ |
| 241 | Entrar: validação dos campos › recusa nome com números | ✅ |
| 242 | Entrar: mostrar senha › mostra e esconde a senha digitada | ✅ |
| 243 | Entrar: mostrar senha › tocar no olho não acusa o campo antes da hora | ✅ |
| 244 | Entrar: oferta para prestador (valores do banco) › só mostra o preço depois de ligar a opção | ✅ |
| 245 | Entrar: oferta para prestador (valores do banco) › acompanha os valores gravados pela administração | ✅ |
| 246 | Entrar: oferta para prestador (valores do banco) › sem período grátis mostra só o valor | ✅ |
| 247 | Entrar: cadastro real › grava a conta de consumidor no banco e abre a sessão | ✅ |
| 248 | Entrar: cadastro real › grava o prestador com CPF e o perfil em rascunho, e leva para Serviços | ✅ |
| 249 | Entrar: cadastro real › exige repetir a mesma senha | ✅ |
| 250 | Entrar: cadastro real › mostra no campo o e-mail já cadastrado (resposta do servidor) | ✅ |
| 251 | Entrar: cadastro real › mostra no campo o CPF já usado por outro prestador | ✅ |

#### `src/pages/Inicio.test.tsx` — Telas contra o servidor real (Vitest + jsdom)

| # | Teste | Resultado |
|---:|---|:---:|
| 252 | Inicio: busca › pede para escolher uma profissão antes de listar serviços | ✅ |
| 253 | Inicio: busca › mostra as modalidades gravadas no banco, inclusive as novas | ✅ |
| 254 | Inicio: busca › filtra pela profissão escolhida e permite tirar o filtro | ✅ |
| 255 | Inicio: busca › busca sem diferenciar acentos | ✅ |
| 256 | Inicio: busca › avisa quando nada é encontrado e limpa a busca | ✅ |
| 257 | Inicio: busca › mostra erro e permite tentar de novo quando o servidor falha | ✅ |
| 258 | Inicio: profissionais › sem login: o servidor não manda preço nem sobrenome | ✅ |
| 259 | Inicio: profissionais › com login mostra nome completo, preço e o contato | ✅ |
| 260 | Inicio: profissionais › abre o WhatsApp com o número gravado no banco | ✅ |
| 261 | Inicio: profissionais › rascunho não aparece na lista | ✅ |
| 262 | Inicio: profissionais › serviço sem profissionais avisa | ✅ |
| 263 | Inicio: cabeçalho › cumprimenta pelo primeiro nome e permite sair | ✅ |
| 264 | Inicio: cabeçalho › mostra o atalho da administração só para admin | ✅ |

#### `src/pages/PerfilPrestador.test.tsx` — Telas contra o servidor real (Vitest + jsdom)

| # | Teste | Resultado |
|---:|---|:---:|
| 265 | PerfilPrestador › avisa quando o prestador não existe | ✅ |
| 266 | PerfilPrestador › sem login mostra só o primeiro nome e esconde os preços | ✅ |
| 267 | PerfilPrestador › com login mostra nome completo, preços e avaliações do banco | ✅ |
| 268 | PerfilPrestador › mostra o texto "Sobre" com HTML como texto, sem executar | ✅ |
| 269 | PerfilPrestador › abre o WhatsApp quando o prestador tem número | ✅ |
| 270 | PerfilPrestador › avisa quando o prestador não tem WhatsApp | ✅ |
| 271 | PerfilPrestador › rascunho só aparece para o próprio prestador | ✅ |

#### `src/pages/Publicar.test.tsx` — Telas contra o servidor real (Vitest + jsdom)

| # | Teste | Resultado |
|---:|---|:---:|
| 272 | Publicar › sem login pede para entrar | ✅ |
| 273 | Publicar › manda quem não é prestador para Serviços | ✅ |
| 274 | Publicar › avisa quando o perfil já está publicado | ✅ |
| 275 | Publicar › troca o resumo da cobrança conforme o plano e a forma de pagamento | ✅ |
| 276 | Publicar › publica e grava plano, forma de pagamento e fim do período grátis | ✅ |
| 277 | Publicar › mostra o que falta quando alguém abre a tela antes da hora | ✅ |
| 278 | Publicar › mostra só as formas de pagamento ligadas na administração | ✅ |
| 279 | Publicar › não deixa publicar sem forma de pagamento | ✅ |

#### `src/pages/Servicos.test.tsx` — Telas contra o servidor real (Vitest + jsdom)

| # | Teste | Resultado |
|---:|---|:---:|
| 280 | Servicos: quem ainda não oferece › sem login pede para entrar | ✅ |
| 281 | Servicos: quem ainda não oferece › vira prestador e o perfil é criado no banco | ✅ |
| 282 | Servicos: meus serviços gravados no banco › adiciona, edita, apaga e desfaz, sempre conferindo o banco | ✅ |
| 283 | Servicos: meus serviços gravados no banco › recusa serviço sem nome ou repetido na mesma profissão | ✅ |
| 284 | Servicos: meus serviços gravados no banco › mantém o editor aberto e avisa se o servidor recusar | ✅ |
| 285 | Servicos: meus serviços gravados no banco › grava o texto "Sobre seu trabalho" | ✅ |
| 286 | Servicos: publicação › só libera publicar com foto, WhatsApp e pelo menos um serviço | ✅ |
| 287 | Servicos: publicação › com tudo pronto, o botão leva para a tela de publicar | ✅ |
| 288 | Servicos: perfil publicado › mostra o plano e pede o WhatsApp | ✅ |
| 289 | Servicos: perfil publicado › lista os contatos do banco e grava "respondido" | ✅ |
| 290 | Servicos: perfil publicado › mostra a nota e os comentários | ✅ |

#### Playwright (`e2e/`) — navegador de verdade, computador e celular

| # | Arquivo | Cenário | Tela | Resultado |
|---:|---|---|---|:---:|
| 291 | admin.spec.ts | Administração real › novo preço do plano aparece no cadastro | computador | ✅ |
| 292 | admin.spec.ts | Administração real › modalidade criada aparece no início e some ao remover | computador | ✅ |
| 293 | admin.spec.ts | Administração real › quem não é admin vê o bloqueio | computador | ✅ |
| 294 | admin.spec.ts | Administração real › novo preço do plano aparece no cadastro | celular | ✅ |
| 295 | admin.spec.ts | Administração real › modalidade criada aparece no início e some ao remover | celular | ✅ |
| 296 | admin.spec.ts | Administração real › quem não é admin vê o bloqueio | celular | ✅ |
| 297 | conta.spec.ts | perfil: dados salvos continuam depois de recarregar | computador | ✅ |
| 298 | conta.spec.ts | perfil: dados salvos continuam depois de recarregar | celular | ✅ |
| 299 | conta.spec.ts | Cadastro e login reais › cadastro de quem só contrata: entra e continua na conta ao recarregar | computador | ✅ |
| 300 | conta.spec.ts | Cadastro e login reais › e-mail já cadastrado aparece no campo | computador | ✅ |
| 301 | conta.spec.ts | Cadastro e login reais › senha errada mostra aviso e não entra | computador | ✅ |
| 302 | conta.spec.ts | Cadastro e login reais › campos inválidos ganham contorno vermelho e mensagem | computador | ✅ |
| 303 | conta.spec.ts | Cadastro e login reais › mostrar senha | computador | ✅ |
| 304 | conta.spec.ts | Cadastro e login reais › dá para entrar só com o teclado | computador | ✅ |
| 305 | conta.spec.ts | Cadastro e login reais › voltar do navegador depois de entrar não volta para o formulário preenchido | computador | ✅ |
| 306 | conta.spec.ts | Cadastro e login reais › telas de acesso cabem na largura da tela | computador | ✅ |
| 307 | conta.spec.ts | Cadastro e login reais › cadastro de quem só contrata: entra e continua na conta ao recarregar | celular | ✅ |
| 308 | conta.spec.ts | Cadastro e login reais › e-mail já cadastrado aparece no campo | celular | ✅ |
| 309 | conta.spec.ts | Cadastro e login reais › senha errada mostra aviso e não entra | celular | ✅ |
| 310 | conta.spec.ts | Cadastro e login reais › campos inválidos ganham contorno vermelho e mensagem | celular | ✅ |
| 311 | conta.spec.ts | Cadastro e login reais › mostrar senha | celular | ✅ |
| 312 | conta.spec.ts | Cadastro e login reais › dá para entrar só com o teclado | celular | ⏭️ |
| 313 | conta.spec.ts | Cadastro e login reais › voltar do navegador depois de entrar não volta para o formulário preenchido | celular | ✅ |
| 314 | conta.spec.ts | Cadastro e login reais › telas de acesso cabem na largura da tela | celular | ✅ |
| 315 | prestador.spec.ts | prestador do cadastro à busca: serviço, foto, WhatsApp, publicar e aparecer para clientes | computador | ✅ |
| 316 | prestador.spec.ts | perfil público de exemplo cabe na tela e esconde preço sem login | computador | ✅ |
| 317 | prestador.spec.ts | início: busca e lista cabem na tela | computador | ✅ |
| 318 | prestador.spec.ts | prestador do cadastro à busca: serviço, foto, WhatsApp, publicar e aparecer para clientes | celular | ✅ |
| 319 | prestador.spec.ts | perfil público de exemplo cabe na tela e esconde preço sem login | celular | ✅ |
| 320 | prestador.spec.ts | início: busca e lista cabem na tela | celular | ✅ |
