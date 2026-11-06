# Arquitetura da Fase 5 — integrações e publicação

## 1. Análise da arquitetura atual (fim da Fase 4)
- **Aplicativo web local** (React 18 + TypeScript + Vite + CSS puro), pronto para Tauri 2. Sem servidor.
- **Dados** no IndexedDB (`media`, `categories`, `history`, `usage`, `conversations`, `kv`, `captions`, `pairings`, `plans`, `posts`) e configurações no armazenamento de configurações do navegador.
- **Planejamento** (Fases 2–4): Biblioteca → Caption Bank → Associações → Calendário → Autopilot. O registro `PlannedPost` já é a unidade de publicação (dia, hora, rede, mídia, legenda, status).
- **Lacunas para publicar de verdade**: (a) onde guardar autorizações/tokens com segurança; (b) quem executa no horário, com o computador desligado; (c) onde ficam os vídeos para a rede poder buscá-los; (d) confirmação oficial de que a rede publicou; (e) tratamento de expiração, limites e erros.
- Um navegador **não pode** guardar segredos de aplicativo (`client_secret`) nem executar tarefas com o computador desligado. Logo, a publicação automática exige um **servidor**.

## 2. Estrutura adotada
```
 Aplicativo (este projeto)                 Servidor do XFLUX (futuro, hospedagem central)      Plataformas
 ┌───────────────────────────┐   HTTPS    ┌───────────────────────────────────────────┐      ┌─────────────┐
 │ Planejamento local        │──────────▶ │ API (contrato v1)                         │      │ Instagram    │
 │ Central de integrações    │  estado    │ ├ Autenticação do usuário XFLUX           │ OAuth│ Facebook     │
 │ Fila e painel de status   │◀────────── │ ├ OAuth (código + state/PKCE)  ───────────┼─────▶│ TikTok       │
 │ Publicação assistida      │  contas    │ ├ Cofre de tokens (criptografado)         │      │ Pinterest    │
 └───────────────────────────┘ (sem token)│ ├ Armazenamento de mídia (URL assinada)   │ API  │ YouTube      │
        ▲ nunca recebe tokens             │ ├ Agendador + fila de jobs + workers      ├─────▶│ (Shopee:     │
                                          │ └ Confirmação (consulta/webhook) + log    │      │  assistida)  │
                                          └───────────────────────────────────────────┘      └─────────────┘
```
**Princípio**: o aplicativo é a fonte do *planejamento*; o servidor é a fonte da *execução* (autorizações, tentativas, confirmações).

## 3. O que foi implementado na Fase 5 (no aplicativo)
| Peça | Arquivo(s) | Função |
|---|---|---|
| Catálogo oficial | `services/publishing/catalog.ts` | O que cada rede oferece, restrições, fontes e data da pesquisa. |
| Contrato e cliente do servidor | `services/backend/contract.ts`, `client.ts` | Valida respostas, exige HTTPS, timeout de 8 s, sem cookies, sem tokens de rede. |
| Contas e conexão | `services/backend/accounts.ts`, `publishing/errors.ts` | Estados `não conectada / conectada / perto de expirar / expirada / revogada / com erro`. Só existem se o servidor informar. |
| Rota de entrega | `services/publishing/delivery.ts` | Decide assistida × API e lista **o que falta** (bloqueios). Hoje: sempre assistida. |
| Pacote por rede | `delivery.ts → buildPackage` | Campos por rede (legenda, título, descrição, tags, quadro, privacidade) só com dados do usuário; horário em UTC + fuso. |
| Fila e histórico | `services/publishing/queue.ts`, `attempts.ts` | Estados da fila, tentativas, falhas, nova tentativa (1, 5, 30, 120, 360 min), confirmação do usuário. |
| Erros | `publishing/errors.ts` | 13 códigos, se valem repetir e o próximo passo. |
| Telas | `pages/Networks.tsx` (Central de integrações), `pages/publishing/Queue.tsx`, `components/PublishPanel.tsx` | Servidor, contas, requisitos oficiais, fila, painel de status, publicação assistida. |
| Integração com o calendário | `pages/planner/Planner.tsx` | Diálogo da publicação passou a usar o painel de publicação; alerta no menu para publicações no horário ou com falha. |

## 4. Dados e compatibilidade (sem migração de banco)
- **Não houve mudança de versão do IndexedDB** (continua v3). Decisão: a entrega e o histórico de tentativas ficam num campo **opcional** `delivery` dentro de `PlannedPost` (máx. 20 tentativas por publicação). Dados da Fase 4 continuam válidos: publicação marcada como publicada sem `delivery` = confirmada pelo usuário.
- Estado do servidor (último `health` e lista de contas, **sem tokens**) fica em configurações (`backend.snapshot`), como cache de exibição. A fonte da verdade das contas é o servidor.
- Quando o servidor existir, a fila pode ganhar um armazenamento próprio sem quebrar nada: `delivery` mapeia 1:1 para uma tabela `publication_attempts` no SQLite/servidor.

## 5. Estados
Fila (visão do usuário): `agendada → no horário → aguardando você → publicada (confirmada por você)`; desvio `com falha → tentar de novo`; `sem conteúdo` (pendente do calendário); `cancelada`.
`confirmedBy`: `user` (hoje) ou `platform` (futuro, só com confirmação oficial recebida pelo servidor). **O app nunca marca "confirmada pela plataforma" por conta própria.**

## 6. Segurança
- Senhas de redes sociais: **nunca** coletadas (OAuth no site oficial; o app só mostra o domínio de destino antes de abrir).
- Segredos (`client_secret`, tokens de acesso/refresh): **somente no servidor**, criptografados (chave em KMS/segredo do ambiente). Teste automático garante que o código do app não contém segredos.
- OAuth: servidor gera `state` (anti-CSRF) e PKCE quando a rede suportar; callback no servidor; o app só consulta o estado das contas.
- Chave de sessão do XFLUX (para falar com o servidor): fica em `sessionStorage`; login real é tarefa do servidor.
- Servidor aceito apenas por **HTTPS** (HTTP só em localhost), sem credenciais na URL.
- Respostas desconhecidas ou com campos inesperados são descartadas (tokens enviados por engano são ignorados).
- Dados pessoais (LGPD): servidor deve registrar finalidade, permitir **desconectar e apagar** tokens e mídia, e manter log de auditoria.

## 7. Agendador em nuvem (futuro, sem exigir instalação do usuário)
1. **Hospedagem central única** (multi-usuário). O cliente só abre o aplicativo e autoriza as redes pelos sites oficiais.
2. **Armazenamento de mídia**: ao ativar o planejamento, o app envia os vídeos para o servidor (upload retomável); o servidor gera URLs assinadas quando a rede exigir endereço público (ex.: Instagram) ou envia por upload retomável.
3. **Sincronização**: cada `PlannedPost` vira um *job* com chave de idempotência `clientPostId`. O servidor guarda `scheduledAt` (UTC) e o fuso do usuário. Alterações no calendário reenviam o job (substitui, sem duplicar).
4. **Execução**: o agendador acorda no horário (fila de jobs com atraso ou verificação por minuto) e chama o **worker da rede** (mesma interface de adaptador). Antes de enviar: valida token (renova se possível), limites diários por conta (Instagram 100/24 h, Facebook Reels 30/24 h, YouTube 100 envios/dia/projeto, TikTok ~15/dia/criador) e regras da rede.
5. **Nova tentativa**: backoff 1, 5, 30, 120 e 360 min para erros transitórios; sem repetição para erros que exigem ação do usuário (reconectar, ajustar mídia).
6. **Confirmação**: o servidor só marca `published` quando a **plataforma confirma** (consulta de status do contêiner/vídeo/`publish_id` ou webhook). Esse resultado volta ao app como `confirmedBy = platform`.
7. **Falhas visíveis**: e-mail/notificação e alerta na Fila; o usuário pode cair no fluxo assistido a qualquer momento.
8. **Regras por rede**: TikTok exige consentimento e privacidade escolhida pelo usuário a cada publicação → fica no fluxo assistido (ou "enviar para a caixa de entrada") até a auditoria e a avaliação das diretrizes; Shopee Video assistida até haver API oficial comprovada.
9. **Custos**: dependem da hospedagem escolhida e do volume de vídeos. **Nenhum valor foi estimado**; o processamento de IA não existe e não gera custo ao cliente.

## 8. Plano de implementação por etapas (próximas fases)
1. Servidor mínimo (autenticação + `GET /v1/health`, `/v1/accounts`, OAuth) para **um** provedor com credenciais de teste. Habilita a Central de integrações (já pronta no app).
2. Upload de mídia + `POST /v1/publications` + agendador + worker do **YouTube** (agendamento oficial por `publishAt`, cota documentada) → primeira publicação real com confirmação da plataforma.
3. Workers do **Instagram** e do **Facebook (Reels em Páginas)** após a análise dos apps na Meta.
4. **Pinterest** (acesso Standard) e **TikTok** (auditoria; modo caixa de entrada).
5. **Shopee Video**: reavaliar com conta de parceiro.
6. No app: ligar `API_PUBLISH_IMPLEMENTED` somente quando o envio for testado com credenciais reais.
