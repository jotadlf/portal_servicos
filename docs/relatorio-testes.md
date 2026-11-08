# Relatório de testes — Portal de Serviços com Supabase

**Data:** 08/11/2026 · **Onde os testes rodam:** GitHub Actions, a cada push na `main` (Supabase local pela CLI, Node, Vitest, Playwright no Chromium) · **Produção:** projeto Supabase hospedado e o site no GitHub Pages

Este relatório substitui o de 23/10/2026, feito quando o app ainda guardava tudo num SQLite local. Aquele protótipo virou o app atual: login pelo Supabase Auth, dados no Postgres do Supabase e fotos no Supabase Storage.

## 1. Resumo

| | |
|---|---|
| Testes automáticos | **350 no Vitest**, em 28 arquivos, e **15 cenários no Playwright**, cada um rodado no computador e no celular (30 execuções) |
| Última execução completa | CI [`42514439611`](https://github.com/jotadlf/portal_servicos/actions/runs/42514439611), commit `d4a62d3`, 08/11/2026: **348/348 no Vitest** e **29/30 no Playwright**, com 1 pulado de propósito |
| Ainda sem execução | 2 testes novos (imagem da modalidade e cancelar o WhatsApp). Eles rodam no próximo CI |
| Pontos do relatório anterior | **10 resolvidos, 6 em aberto, 1 decidido** de outro jeito (seção 4) |

Desde o relatório anterior, o app ganhou o registro dos contatos pelo WhatsApp, com uma confirmação "Abrir conversa" antes, as avaliações feitas pelos clientes e a opção de apagar a própria conta.

## 2. Como o app guarda e protege os dados

- **Login:** Supabase Auth, com e-mail e senha. A sessão fica no `sessionStorage` e vale só na aba aberta.
- **Tabelas** (`supabase/migrations/`): `contas`, `prestadores`, `servicos`, `modalidades`, `avaliacoes`, `contatos` e `ajustes_plano`. Todas ficam fechadas pela RLS. O app não lê nem grava tabela direto: chama funções RPC do banco, que conferem a sessão, a permissão e cada campo, e devolvem as mensagens que aparecem nas telas. CPF e senha nunca saem do banco.
- **Fotos:** bucket `fotos` do Storage. Cada conta grava só na própria pasta, e a administração grava também em `modalidades/`. São aceitos só PNG, JPEG, WebP e GIF, até 5 MB.
- **Contatos:** confirmar "Abrir conversa" chama `registrar_contato`, que grava o contato na aba "Contatos" do prestador. Vale no máximo um contato por cliente, por prestador, por dia.
- **Avaliações:** só quem já falou com o prestador pode avaliá-lo (`avaliar`). É uma avaliação por pessoa, que ela pode refazer. Um trigger mantém a nota e o total do prestador a partir da soma das notas.
- **Apagar conta:** `apagar_conta` remove o login e, em cascata, o perfil, os serviços, os contatos e as avaliações. As fotos saem do Storage pela tela, porque o banco não apaga arquivo. A conta da administração não pode ser apagada pelo app.

## 3. Resultado por camada

Contagens da última execução completa (`d4a62d3`), mais os 2 testes novos.

| Camada | Arquivos | Testes | Último CI |
|---|---:|---:|---|
| Funções do banco (`banco/`, Vitest no Node contra o Supabase local) | 7 | 155 | 155/155 |
| Telas contra o Supabase local (Vitest + jsdom) | 8 | 128 | 126/126, mais 2 novos |
| Componentes (Vitest + jsdom) | 3 | 13 | 13/13 |
| Regras e utilitários (Vitest) | 10 | 54 | 54/54 |
| Ponta a ponta no navegador (Playwright, Chromium) | 3 | 15 cenários × 2 telas | 29/30 (+1 pulado) |

O Playwright roda cada cenário numa tela de computador e numa de celular (Pixel 7, 412 px). O cenário "entrar só com o teclado" é pulado no celular. Cada teste volta o banco aos dados de exemplo antes de começar (`recriar_dados_exemplo()`, de `supabase/seed.sql`). O e2e se recusa a rodar contra um Supabase que não seja o local.

## 4. Pontos do relatório anterior

| Id | Ponto | Situação |
|---|---|---|
| C1 | O login não limitava tentativas de senha | ✅ Resolvido: o login passou para o Supabase Auth, que limita tentativas por IP (Authentication → Rate Limits) |
| C2 | O banco local não servia para produção | ✅ Resolvido: dados no Supabase hospedado |
| C3 | O contato pelo WhatsApp não era registrado | ✅ Resolvido em 08/11: `registrar_contato`, depois da confirmação "Abrir conversa" |
| A1 | Virar prestador pela tela Serviços não pedia CPF | ✅ Resolvido: o CPF é exigido para virar prestador |
| A2 | A sessão vale só na aba (`sessionStorage`) | ⏳ Em aberto: continua assim; um link aberto em outra aba pede login de novo |
| A3 | Publicar ativa o período grátis sem cobrar no gateway | ⏳ Em aberto: depende de escolher o gateway e criar a conta nele |
| A4 | Sem recuperação de senha nem confirmação de e-mail | ⏳ Em aberto: falta o "esqueci a senha". A confirmação de e-mail existe no Supabase e está desligada de propósito (README) |
| A5 | O CPF não pode ser corrigido depois do cadastro | ↪️ Decidido: o CPF não muda depois do cadastro. Quem errou apaga a conta e cria outra |
| M1 | O cadastro devolve só o primeiro erro de cada vez (a tela já mostra todos) | ⏳ Em aberto: teste `PONTO DE ATENÇÃO` em `banco/seguranca.test.ts` |
| M2 | A ajuda do campo fica dentro do `<label>`, e o leitor de tela a lê junto com o nome do campo | ⏳ Em aberto (`src/components/Field.tsx`) |
| M3 | Clientes não avaliavam prestadores | ✅ Resolvido em 08/11 |
| M4 | Os gráficos de "Evolução" no admin são de exemplo | ⏳ Em aberto (`src/features/admin/historico.ts`) |
| M5 | Prestadores de exemplo sem foto | ✅ Resolvido: todos os de exemplo têm foto |
| B1 | Com o servidor fora do ar, o Início mostrava uma dica sem sentido | ✅ Resolvido: a dica só aparece com o catálogo carregado |
| B2 | Botões de ícone com 40 px (o recomendado para toque é 44 px) | ✅ Resolvido em 08/11: botões de ícone, do olho da senha e das ações da lista com 44 px |
| B3 | Fotos guardadas no SQLite | ✅ Resolvido: Supabase Storage |
| B4 | Ao remover uma modalidade, a imagem dela continuava guardada | ✅ Resolvido em 08/11: a tela apaga a imagem do Storage depois que o banco remove a modalidade |

Fora da lista antiga, o login com Google também está em aberto: o botão existe, mas depende de configurar as credenciais do Google no Supabase.

## 5. Como rodar

Os passos estão no [README](../README.md#testes): `supabase start` na raiz, as variáveis do `supabase status -o env` e, em `frontend/`, `npm test` e `npm run test:e2e`. Os testes precisam do Docker por causa do Supabase local. Sem Docker, rodam só no GitHub Actions.

## Apêndice — testes automáticos

Nomes como o Vitest lista (`vitest list`), em ordem de arquivo. Testes com tabela (`it.each`, com `%s` no nome) aparecem uma vez aqui, mas contam uma vez por linha da tabela no CI. Por isso o apêndice tem menos nomes que o total da seção 3.

#### `banco/admin.test.ts` — funções do banco

- Administração: permissões conferidas no banco › %s: 401 sem login e 403 para quem não é admin
- Administração: permissões conferidas no banco › a modalidade continua lá depois da tentativa sem permissão
- Administração: permissões conferidas no banco › quem não é admin não envia imagem de modalidade
- Administração: modalidades › cria a modalidade e grava nome, id, serviços e posição
- Administração: modalidades › grava a imagem enviada (PNG); o Storage recusa SVG
- Administração: modalidades › recusa %s
- Administração: modalidades › remover a modalidade apaga os serviços dela de todos os perfis
- Administração: plano › grava os novos valores e todo mundo passa a ver
- Administração: plano › o novo período grátis vale para quem publicar depois
- Administração: plano › recusa %s
- Administração: painel › conta os números a partir do banco
- Administração: painel › acompanha um prestador novo no período grátis
- Administração: painel › perfil da administração conta como publicado, mas não como pagante nem na receita

#### `banco/apagar-conta.test.ts` — funções do banco

- Apagar conta › apaga o login, a conta e o prestador com tudo dele
- Apagar conta › a sessão deixa de valer
- Apagar conta › o CPF fica livre para uma conta nova
- Apagar conta › não mexe nas outras contas
- Apagar conta › a administração não apaga a própria conta
- Apagar conta › sem login responde 401 e não apaga nada

#### `banco/cadastro.test.ts` — funções do banco

- Cadastro real: dados gravados no banco › grava a conta de quem só contrata, campo a campo
- Cadastro real: dados gravados no banco › a senha fica só no Supabase Auth, como hash bcrypt com sal diferente em cada conta
- Cadastro real: dados gravados no banco › grava o prestador com CPF só em dígitos e cria o perfil em rascunho
- Cadastro real: dados gravados no banco › não devolve senha nem CPF na resposta
- Cadastro real: dados gravados no banco › recusa e-mail já usado, mesmo com maiúsculas e espaços
- Cadastro real: dados gravados no banco › recusa CPF já usado por outro prestador
- Cadastro real: dados gravados no banco › recusa %s
- Cadastro real: dados gravados no banco › aceita nomes com acento, apóstrofo e hífen
- Cadastro real: dados gravados no banco › ignora CPF enviado por quem não vai oferecer serviços
- Cadastro real: dados gravados no banco › recusa corpo que não é objeto
- Cadastro real: dados gravados no banco › quem chama o signUp direto, pulando a conferência, também é barrado
- Cadastro real: dados gravados no banco › não dá para virar admin pelos dados do signUp
- Login real › entra com a conta de teste, ignorando maiúsculas e espaços no e-mail
- Login real › entra com a conta recém-criada
- Login real › dá a mesma resposta para senha errada e e-mail que não existe
- Login real › diferencia maiúsculas na senha
- Login real › recusa login sem dados
- Login real › identifica a conta pela sessão e sai de verdade
- Login real › cada login abre uma sessão; sair de uma não derruba a outra
- Login real › token inventado não entra

#### `banco/conta.test.ts` — funções do banco

- Perfil: cada campo gravado no banco › normaliza e grava todos os campos
- Perfil: cada campo gravado no banco › aceita endereço em branco (é opcional)
- Perfil: cada campo gravado no banco › copia nome, WhatsApp e bairro para o perfil público do prestador (e nada mais)
- Perfil: cada campo gravado no banco › recusa %s e não altera o banco
- Perfil: cada campo gravado no banco › exige foto de quem oferece serviços, não de quem só contrata
- Perfil: cada campo gravado no banco › não deixa mudar e-mail, senha, CPF nem virar admin pelo perfil
- Perfil: cada campo gravado no banco › cada um só altera a própria conta
- Perfil: cada campo gravado no banco › as tabelas não abrem direto pela API, nem para quem entrou
- Perfil: foto › grava a imagem no Storage, na pasta da conta, e o caminho na conta e no perfil público
- Perfil: foto › não grava na pasta de outra conta nem usa a foto de outra pessoa
- Perfil: foto › recusa caminho que não existe no Storage
- Perfil: foto › o Storage recusa %s
- Perfil: foto › o Storage recusa foto acima de 5 MB
- Perfil: foto › sem login não envia foto
- Perfil: virar prestador › cria um único perfil de prestador, mesmo chamando duas vezes
- Perfil: virar prestador › grava o CPF só com dígitos
- Perfil: virar prestador › recusa CPF %j sem criar o perfil
- Perfil: virar prestador › recusa CPF que já é de outra conta
- Perfil: virar prestador › a administração vira prestador sem CPF
- Perfil: CPF fixo › depois de gravado, o CPF não muda nem direto no banco
- Perfil: CPF fixo › salvar o perfil não mexe no CPF
- Perfil: sem login › %s responde 401

#### `banco/contatos-avaliacoes.test.ts` — funções do banco

- Registrar contato › grava o contato com o nome e o bairro de quem chamou
- Registrar contato › tocar de novo no mesmo dia não repete o contato
- Registrar contato › serviço que o prestador não oferece fica em branco
- Registrar contato › o próprio prestador não gera contato
- Registrar contato › prestador em rascunho ou que não existe: 404
- Avaliar prestador › sem ter falado com o prestador, não avalia
- Avaliar prestador › avalia, a nota entra na média e aparece primeiro na lista pública
- Avaliar prestador › refazer troca a nota sem contar duas vezes
- Avaliar prestador › recusa nota fora de 1 a 5 e comentário longo
- Avaliar prestador › o próprio prestador não se avalia
- Avaliar prestador › apagar a conta do cliente tira os contatos e a avaliação dele da média
- Avaliar prestador › sem login, nada disso abre

#### `banco/prestador.test.ts` — funções do banco

- Busca de prestadores › sem login: só o primeiro nome, sem foto, preço e WhatsApp (nada disso sai do banco)
- Busca de prestadores › com login: nome completo, foto, preço e WhatsApp
- Busca de prestadores › serviço \"a combinar\" não aparece como escondido
- Busca de prestadores › ordena pela reputação (poucas avaliações não passam na frente)
- Busca de prestadores › rascunho não aparece na busca nem no perfil público, só para o dono
- Busca de prestadores › perfil público traz as avaliações
- Meus serviços: gravação › grava como o preço é cobrado; sem unidade, fica por serviço
- Meus serviços: gravação › grava os serviços na ordem, com preço inteiro ou a combinar
- Meus serviços: gravação › substitui a lista inteira (apagar um serviço some do banco)
- Meus serviços: gravação › recusa %s e mantém a lista anterior
- Meus serviços: gravação › recusa serviço repetido na mesma profissão, sem diferenciar maiúsculas e acentos
- Meus serviços: gravação › aceita o mesmo nome em profissões diferentes
- Meus serviços: gravação › grava o texto \"Sobre\" e recusa acima de 300 caracteres
- Meus serviços: gravação › quem só contrata não tem área de prestador
- Publicar perfil › lista o que falta: foto, WhatsApp e serviço
- Publicar perfil › administração publica sem plano nem pagamento; os demais precisam escolher
- Publicar perfil › publica e grava plano, forma de pagamento e fim do período grátis
- Publicar perfil › não publica duas vezes
- Publicar perfil › recusa plano inválido e forma de pagamento desligada
- Contatos do prestador › lista os contatos e grava \"respondido\"
- Contatos do prestador › não marca contato de outro prestador

#### `banco/seguranca.test.ts` — funções do banco

- Textos maliciosos ou incomuns › SQL injection no login não entra (' OR '1'='1)
- Textos maliciosos ou incomuns › SQL injection em texto livre é gravado como texto, sem efeito no banco
- Textos maliciosos ou incomuns › HTML/script é gravado literalmente (a tela mostra como texto)
- Textos maliciosos ou incomuns › emoji e acentos chegam inteiros ao banco e de volta
- Textos maliciosos ou incomuns › nome com emoji é recusado
- Dados sensíveis nunca saem do banco › CPF e senha não aparecem em nenhuma resposta
- Dados sensíveis nunca saem do banco › as funções internas e a de recriar os dados não abrem pela API
- Endereços e erros › função que não existe não responde
- Endereços e erros › erros vêm com mensagem em português e campo
- Endereços e erros › PONTO DE ATENÇÃO: cadastro só devolve o primeiro problema de cada vez
- Endereços e erros › conta apagada não usa mais a sessão
- Endereços e erros › anônimo não chama nada que exige login

#### `src/App.test.tsx` — tela

- App › abre na página inicial
- App › abre a página pelo endereço
- App › entra e volta para a página de onde saiu, já com os dados completos
- App › leva quem administra direto para o painel
- App › quem já entrou e volta para #/entrar não vê o formulário de novo
- App › recarregar a página mantém a pessoa na conta
- App › sair encerra a sessão no Supabase
- App › sessão vencida no meio do uso volta para visitante

#### `src/components/BottomMenu.test.tsx` — componente

- BottomMenu › leva para as páginas principais e marca a atual
- BottomMenu › só mostra a administração para quem administra
- BottomMenu › avisa a página inicial ao tocar em Início

#### `src/components/Rating.test.tsx` — componente

- Rating › mostra a nota e a quantidade de avaliações
- Rating › usa o singular com uma avaliação
- Rating › avisa quando o prestador ainda não tem avaliações

#### `src/components/graficos/escala.test.ts` — componente

- niceTicks › usa 0 e 1 quando não há valores
- niceTicks › arredonda o teto para um passo limpo
- niceTicks › respeita a quantidade de intervalos pedida
- niceTicks › sempre cobre o valor máximo
- compact › abrevia milhares no padrão brasileiro
- columnPath › desenha a barra com o topo arredondado
- columnPath › reduz o raio em barras baixas

#### `src/features/conta/plano.test.ts` — regra

- planos › oferece mensal e semestral com os preços configurados
- planos › acompanha os valores da administração
- planos › cai no mensal quando o plano não existe
- planSavings › não há economia no mensal
- planSavings › compara o semestral com 6 meses do mensal
- monthlyValue › divide o preço pelo período
- trialEndDate › soma os dias grátis, virando o mês
- trialEndDate › usa os dias configurados
- isoDate › usa o dia local, não o UTC

#### `src/hooks/useHashRoute.test.ts` — regra

- parse › reconhece cada rota
- parse › mantém o link antigo da Área do prestador
- parse › manda para o início o que não conhece ou está incompleto
- parse › aceita o hash sem a barra
- routes › gera links que voltam para a mesma rota

#### `src/lib/cep.test.ts` — regra

- isValidUf › aceita as siglas dos estados, em qualquer caixa
- isValidUf › recusa siglas que não existem
- formatCep › aplica a máscara 00000-000
- fetchAddress › não consulta CEP incompleto
- fetchAddress › converte a resposta do ViaCEP
- fetchAddress › preenche campos ausentes com texto vazio
- fetchAddress › devolve null para CEP inexistente, erro HTTP ou falha de rede

#### `src/lib/cpf.test.ts` — regra

- formatCpf › aplica a máscara conforme a digitação
- formatCpf › ignora o que não é dígito e corta no 11º
- isValidCpf › aceita CPFs com dígitos verificadores certos
- isValidCpf › aceita dígito verificador zero
- isValidCpf › recusa dígito verificador errado
- isValidCpf › recusa todos os dígitos iguais, tamanho errado e máscara

#### `src/lib/email.test.ts` — regra

- isValidEmail › aceita e-mails comuns
- isValidEmail › recusa e-mails incompletos ou malformados
- isValidEmail › recusa e-mail longo demais

#### `src/lib/format.test.ts` — regra

- normalize › ignora maiúsculas e acentos
- formatRating › mostra sempre uma casa decimal com vírgula
- formatPrice › formata em reais sem centavos
- formatDate › mostra dia e mês abreviado sem mudar o dia pelo fuso
- greeting › cumprimenta conforme a hora
- nomes › pega o primeiro nome
- nomes › pega as iniciais dos dois primeiros nomes

#### `src/lib/imagem.test.ts` — regra

- compressImage › reduz a foto pelo maior lado e converte para WebP
- compressImage › sem WebP no navegador, foto vira JPEG e ícone continua PNG
- compressImage › não amplia imagem pequena e mantém o original se não ficar menor
- compressImage › sem suporte no navegador, mantém o original

#### `src/lib/nome.test.ts` — regra

- isValidName › aceita nomes com acento, apóstrofo e hífen
- isValidName › aceita acento digitado como letra + sinal separado
- isValidName › recusa números e símbolos
- isValidName › recusa vazio e separador solto

#### `src/lib/supabase.test.ts` — regra

- getSupabaseClient › avisa quando as variáveis de ambiente faltam
- getSupabaseClient › cria o cliente uma vez e reaproveita

#### `src/lib/whatsapp.test.ts` — regra

- isValidPhone › aceita DDD + 8 ou 9 dígitos
- isValidPhone › recusa DDD começando com zero, tamanho errado ou máscara
- formatPhone › aplica a máscara conforme a digitação
- formatPhone › tira o código do Brasil de número colado
- formatPhone › ignora o que não é dígito e corta no 11º
- contactMessage › cita o serviço quando informado
- openWhatsapp › abre o wa.me com o código do Brasil e a mensagem codificada

#### `src/pages/Admin.test.tsx` — tela

- Admin: acesso › sem login pede a conta de administração
- Admin: acesso › bloqueia quem não administra
- Admin: painel com números do banco › mostra os números e os gráficos
- Admin: painel com números do banco › mostra só as 5 modalidades com mais serviços
- Admin: modalidades gravadas no banco › adiciona uma modalidade nova com imagem
- Admin: modalidades gravadas no banco › valida nome, números, duplicidade e serviços
- Admin: modalidades gravadas no banco › recusa imagem SVG
- Admin: modalidades gravadas no banco › remove só depois de confirmar e apaga os serviços junto
- Admin: modalidades gravadas no banco › remover a modalidade apaga a imagem dela do Storage
- Admin: plano e pagamentos gravados no banco › salva os novos valores do plano
- Admin: plano e pagamentos gravados no banco › aceita preço com separador de milhar (\"1.234,50\")
- Admin: plano e pagamentos gravados no banco › entende \"%s\" como R$ %s
- Admin: plano e pagamentos gravados no banco › recusa preço ambíguo (\"1.234\" sem vírgula)
- Admin: plano e pagamentos gravados no banco › recusa preço inválido, período longo e nenhuma forma de pagamento

#### `src/pages/Conta.test.tsx` — tela

- Conta: gravação real › sem login pede para entrar
- Conta: gravação real › grava nome, telefone e endereço no banco, normalizados
- Conta: gravação real › o que foi salvo continua lá ao abrir o perfil de novo
- Conta: gravação real › formata o WhatsApp e não grava número incompleto
- Conta: gravação real › não grava %s
- Conta: gravação real › aceita número de endereço no formato quadra/lote
- Conta: gravação real › WhatsApp colado com +55 é gravado sem o código do país
- Conta: gravação real › UF aceita só letras e recusa sigla que não existe
- Conta: gravação real › mostra o link da administração só para admin
- Conta: gravação real › sai da conta
- Conta: foto › quem só contrata salva sem foto
- Conta: foto › exige foto de quem oferece serviços e grava a imagem no banco
- Conta: foto › recusa SVG antes de enviar
- Conta: foto › recusa arquivo disfarçado de imagem antes de enviar
- Conta: foto › recusa foto maior que 5 MB
- Conta: CEP › preenche o endereço pelo CEP e põe o foco no número
- Conta: CEP › avisa quando o CEP não existe
- Conta: apagar a conta › pede confirmação; cancelar não apaga nada
- Conta: apagar a conta › apaga a conta, as fotos e encerra a sessão
- Conta: apagar a conta › a administração não vê a opção

#### `src/pages/Entrar.test.tsx` — tela

- Entrar: login real › entra com e-mail e senha corretos e guarda a sessão
- Entrar: login real › oferece entrar como visitante, voltando para a página de antes
- Entrar: login real › avisa quando a senha está errada e limpa o aviso ao digitar
- Entrar: login real › bloqueia o botão enquanto confere a senha (sem envio duplo)
- Entrar: login real › avisa quando o servidor não responde
- Entrar: login real › avisa que o login social ainda não funciona
- Entrar: login real › não oferece entrar com Apple
- Entrar: login real › oferece o link para criar conta
- Entrar: validação dos campos › marca os campos vazios ao tentar entrar e leva o foco ao primeiro
- Entrar: validação dos campos › só acusa o campo depois que a pessoa sai dele
- Entrar: validação dos campos › confere todos os campos do cadastro
- Entrar: validação dos campos › recusa nome com números
- Entrar: mostrar senha › mostra e esconde a senha digitada
- Entrar: mostrar senha › tocar no olho não acusa o campo antes da hora
- Entrar: oferta para prestador (valores do banco) › só mostra o preço depois de ligar a opção
- Entrar: oferta para prestador (valores do banco) › acompanha os valores gravados pela administração
- Entrar: oferta para prestador (valores do banco) › sem período grátis mostra só o valor
- Entrar: cadastro real › grava a conta de consumidor no banco e abre a sessão
- Entrar: cadastro real › grava o prestador com CPF e o perfil em rascunho, e leva para Serviços
- Entrar: cadastro real › exige repetir a mesma senha
- Entrar: cadastro real › mostra no campo o e-mail já cadastrado (resposta do servidor)
- Entrar: cadastro real › mostra no campo o CPF já usado por outro prestador

#### `src/pages/Inicio.test.tsx` — tela

- Inicio: busca › pede para escolher uma profissão antes de listar serviços
- Inicio: busca › mostra as modalidades novas assim que algum prestador publicado oferece o serviço
- Inicio: busca › modalidade sem prestador publicado não aparece
- Inicio: busca › sem nenhum serviço oferecido, avisa que o portal ainda está vazio
- Inicio: busca › escolher a profissão só mostra o Exibir; a lista abre em outra tela
- Inicio: busca › exibe juntos os serviços de mais de uma profissão
- Inicio: busca › busca sem diferenciar acentos
- Inicio: busca › avisa quando nada é encontrado e limpa a busca
- Inicio: busca › ao tocar na busca abre o card de resultados, e o X volta ao início
- Inicio: busca › a busca procura em todos os serviços, mesmo com profissão escolhida
- Inicio: busca › mostra erro e permite tentar de novo quando o servidor falha
- Inicio: profissionais › sem login: o servidor não manda preço nem sobrenome
- Inicio: profissionais › com login mostra nome completo, preço e o contato
- Inicio: profissionais › abre o WhatsApp com o número gravado no banco
- Inicio: profissionais › abre o WhatsApp direto da lista, sem abrir o perfil
- Inicio: profissionais › cancelar a confirmação não abre o WhatsApp nem conta o contato
- Inicio: profissionais › sem login a lista mostra o WhatsApp desfocado e o toque leva ao login
- Inicio: profissionais › ordena por avaliação, nome, menor e maior valor (\"a combinar\" no fim)
- Inicio: profissionais › procura profissional por nome, sem ligar para acento e maiúscula
- Inicio: profissionais › sem login não ordena por valor e procura só pelo primeiro nome
- Inicio: profissionais › rascunho não aparece na lista
- Inicio: profissionais › serviço que ninguém oferece não aparece na busca
- Inicio: cabeçalho › cumprimenta pelo primeiro nome e permite sair
- Inicio: cabeçalho › mostra o atalho da administração só para admin

#### `src/pages/PerfilPrestador.test.tsx` — tela

- PerfilPrestador › avisa quando o prestador não existe
- PerfilPrestador › sem login mostra só o primeiro nome e esconde os preços
- PerfilPrestador › com login mostra nome completo, preços e avaliações do banco
- PerfilPrestador › mostra o texto \"Sobre\" com HTML como texto, sem executar
- PerfilPrestador › abre o WhatsApp quando o prestador tem número
- PerfilPrestador › avisa quando o prestador não tem WhatsApp
- PerfilPrestador › o toque no WhatsApp grava o contato e libera a avaliação
- PerfilPrestador › avaliar grava a nota, mostra o comentário e atualiza a média
- PerfilPrestador › quem já avaliou vê a própria avaliação para refazer
- PerfilPrestador › o próprio prestador não vê o convite para avaliar
- PerfilPrestador › rascunho só aparece para o próprio prestador

#### `src/pages/Publicar.test.tsx` — tela

- Publicar › sem login pede para entrar
- Publicar › manda quem não é prestador para Serviços
- Publicar › avisa quando o perfil já está publicado
- Publicar › troca o resumo da cobrança conforme o plano e a forma de pagamento
- Publicar › administração publica direto, sem plano nem pagamento
- Publicar › publica e grava plano, forma de pagamento e fim do período grátis
- Publicar › mostra o que falta quando alguém abre a tela antes da hora
- Publicar › mostra só as formas de pagamento ligadas na administração
- Publicar › não deixa publicar sem forma de pagamento

#### `src/pages/Servicos.test.tsx` — tela

- Servicos: quem ainda não oferece › sem login pede para entrar
- Servicos: quem ainda não oferece › vira prestador com CPF e o perfil é criado no banco
- Servicos: quem ainda não oferece › sem CPF, ou com CPF inválido, avisa no campo e não cria o perfil
- Servicos: quem ainda não oferece › CPF de outra conta: mostra o aviso do banco no campo
- Servicos: quem ainda não oferece › administração não vê oferta de plano nem preço
- Servicos: meus serviços gravados no banco › adiciona, edita, apaga e desfaz, sempre conferindo o banco
- Servicos: meus serviços gravados no banco › escolhe como o preço é cobrado (padrão: por serviço)
- Servicos: meus serviços gravados no banco › adicionar abre a folha \"Novo serviço\"; o X fecha e reabre limpa
- Servicos: meus serviços gravados no banco › recusa serviço sem nome ou repetido na mesma profissão
- Servicos: meus serviços gravados no banco › mantém o editor aberto e avisa se o servidor recusar
- Servicos: meus serviços gravados no banco › grava o texto \"Sobre seu trabalho\"
- Servicos: publicação › só libera publicar com foto, WhatsApp e pelo menos um serviço
- Servicos: publicação › com tudo pronto, o botão leva para a tela de publicar
- Servicos: perfil publicado › mostra o plano e pede o WhatsApp
- Servicos: perfil publicado › lista os contatos do banco e grava \"respondido\"
- Servicos: perfil publicado › mostra a nota e os comentários

#### `e2e/admin.spec.ts` — navegador (computador e celular)

- Administração real › novo preço do plano aparece no cadastro
- Administração real › modalidade criada só aparece no início quando algum prestador oferece; some ao remover
- Administração real › quem não é admin vê o bloqueio

#### `e2e/conta.spec.ts` — navegador (computador e celular)

- Cadastro e login reais › cadastro de quem só contrata: entra e continua na conta ao recarregar
- Cadastro e login reais › e-mail já cadastrado aparece no campo
- Cadastro e login reais › senha errada mostra aviso e não entra
- Cadastro e login reais › campos inválidos ganham contorno vermelho e mensagem
- Cadastro e login reais › mostrar senha
- Cadastro e login reais › dá para entrar só com o teclado
- Cadastro e login reais › voltar do navegador depois de entrar não volta para o formulário preenchido
- Cadastro e login reais › telas de acesso cabem na largura da tela
- perfil: dados salvos continuam depois de recarregar

#### `e2e/prestador.spec.ts` — navegador (computador e celular)

- prestador do cadastro à busca: serviço, foto, WhatsApp, publicar e aparecer para clientes
- perfil público de exemplo cabe na tela e esconde preço sem login
- início: busca e lista cabem na tela
