# Fase 5 — Integrações e publicação (estrutura + publicação assistida)

Esta fase prepara o XFLUX para publicar de verdade **sem fingir nada**. Nenhuma rede é publicada automaticamente ainda:
isso depende de um servidor, de credenciais e da aprovação dos aplicativos em cada plataforma (veja "Dependências externas").
Fase 4 e anteriores foram preservadas; o banco **não foi migrado** (continua v3).

## O que o usuário vê
- **Redes sociais → Central de integrações**: estado do servidor do XFLUX, estado de cada conta (não conectada, conectada, perto de expirar, expirada, revogada, com erro), o que cada plataforma oferece oficialmente (com fontes e data da pesquisa), o que falta para publicar automaticamente e botões Conectar/Reconectar/Desconectar (ativos só quando um servidor existe e habilita a rede).
- **Fila de publicações** (novo item no menu): painel de status (no horário, aguardando você, com falha, agendadas, publicadas, sem conteúdo), filtros por situação e rede, histórico de tentativas por publicação.
- **Publicação assistida** (calendário e fila): dados prontos para copiar por rede (legenda/título/descrição/tags), passos, "Comecei a publicar", "Marcar como publicada" (confirmação do usuário), "Não consegui publicar" (motivo + nova tentativa sugerida) e "Tentar de novo".
- **Alertas**: ponto no menu da Fila quando há publicação no horário ou com falha.
- **Ajuda**: 3 perguntas novas (conexão, publicação assistida, estados da conta).

## Regras obrigatórias — como foram cumpridas
| Regra | Como |
|---|---|
| Não simular conexões | Contas só existem se vierem de um servidor (validadas pelo contrato). Sem servidor: "Não conectada" em todas. Teste automático cobre. |
| Não mostrar conectada sem autenticação verdadeira | `connectionOf()` só devolve "conectada" para conta informada pelo servidor; servidor fora do ar → "não verificado agora". |
| Não afirmar publicação sem confirmação da plataforma | "Publicada" só por confirmação do **usuário** (`confirmedBy: user`). `platform` está reservado ao servidor futuro. |
| Não inventar APIs/permissões | Catálogo com fonte oficial, data e dúvidas em aberto (`docs/INTEGRACOES-OFICIAIS.md`). Onde não foi possível comprovar (Shopee Video) está dito. |
| Se a API não permitir, informar e oferecer alternativa assistida | TikTok (regras de consentimento/auditoria) e Shopee Video ficam assistidos, com explicação na tela. |
| Sem senhas de redes | OAuth no site oficial; o app só mostra o domínio de destino. |
| Sem tokens secretos no frontend | Nenhum segredo no código (teste automático). Tokens ficam só no servidor; o app nunca os recebe. |
| Sem Ollama/IA, sem custo de IA | Nada novo depende de IA. |

## Estrutura de código novo
`src/services/publishing/{catalog,delivery,queue,attempts,errors,types,adapters}.ts`, `src/services/backend/{contract,client,accounts}.ts`,
`src/pages/Networks.tsx` (reescrita como Central de integrações, mantendo os recursos anteriores), `src/pages/publishing/Queue.tsx`, `src/components/PublishPanel.tsx`,
`src/i18n/publishing.ts` (≈180 textos em pt/en/es). Alterações pequenas em `Planner.tsx`, `plans.ts`, `App.tsx`, `Autopilot.tsx`, `Help.tsx`, `nav.ts`, `Icon.tsx`.

## Dados
Sem nova versão do IndexedDB. Campo opcional `delivery` em `PlannedPost` (estado, quem confirmou, tentativas, próxima tentativa). Dados da Fase 4 continuam válidos (publicadas sem `delivery` = confirmadas pelo usuário). Detalhes em `docs/ARQUITETURA-FASE5.md`.

## Dependências
Nenhuma dependência nova no projeto.

## Dependências externas (o que ainda falta e por quê)
- **Servidor do XFLUX** (autenticação, cofre de tokens, OAuth, armazenamento de mídia, agendador, workers). Contrato pronto em `docs/BACKEND-CONTRATO.md` e `docs/openapi-backend.yaml`. Não foi construído nesta fase: sem credenciais reais não há como testá-lo de forma honesta, e um servidor de mentira violaria as regras.
- **Aplicativos aprovados em cada plataforma** (Meta: análise/acesso avançado; TikTok: auditoria; Pinterest: acesso Standard; Google: projeto OAuth e conformidade; Shopee: conta de parceiro). Credenciais e aprovações são suas.
- **Envio por API** (`API_PUBLISH_IMPLEMENTED = false` em `delivery.ts`): só deve ser ligado depois de testado com credenciais reais.
- Reconfirmar na documentação oficial, no momento da implementação, os pontos marcados como "reconfirmar" em `INTEGRACOES-OFICIAIS.md` (limites do Instagram, agendamento de Reels no Facebook, restrição de projetos não verificados no YouTube, endpoints da Shopee).

## Pendências
Servidor e workers; upload de mídia para a nuvem; envio por API por rede; confirmação da plataforma; notificações por e-mail; login de usuário no servidor; migração para SQLite/Tauri; validação de duração/proporção do vídeo antes de publicar (a Biblioteca ainda não guarda essas informações).

## Relatório de testes
Não houve internet no ambiente: **`npm install` e `npm run build` (Vite) não foram executados**. Rode-os no seu computador.
Executado aqui:
- `tsc --strict` (TypeScript 6.0.3, tipos substitutos do React): 0 erros.
- Testes unitários em Node: **38** da Fase 5 (classificação de erros, novas tentativas, expiração, estados de conexão, rotas e bloqueios, fila, pacote por rede, validação do contrato, endereço do servidor HTTPS, catálogo, ausência de segredos e de campos de senha), mais 45 da Fase 4. Traduções: **816 chaves** idênticas em pt/en/es, sem vazias, mesmos marcadores.
- Teste de ponta a ponta no Chromium (React 19): **45** verificações da Fase 4 (regressão, sem falhas) e **38** da Fase 5: central de integrações sem e com servidor, URL inválida, 401, estados de conta vindos do servidor, Reconectar/Conectar/Desconectar, OAuth mostrando o domínio de destino, servidor fora do ar e resposta incompatível, fila (painel de status, filtros, alerta no menu), publicação assistida com histórico de tentativas, falha com nova tentativa, confirmação do usuário registrando uso do vídeo e da legenda, bloqueios de TikTok e Shopee, idiomas pt/en/es.
- **O servidor usado nesses testes é um servidor falso, só de teste** (`tests`, fora do produto), para exercitar o cliente do contrato. Ele não representa nenhuma rede real.
- **Não testado**: qualquer chamada real a Instagram, Facebook, TikTok, Pinterest, YouTube ou Shopee; OAuth real; Windows 10; Edge; Tauri.
