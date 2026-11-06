# Contrato entre o aplicativo e o servidor do XFLUX (versão 1)

Especificação máquina-legível: `docs/openapi-backend.yaml`. O cliente está em `src/services/backend/`.

## Regras
- Transporte **HTTPS** (HTTP só em `localhost`). Sem cookies (`credentials: omit`). Cabeçalho opcional `Authorization: Bearer <chave de sessão do XFLUX>`.
- O servidor **nunca** devolve tokens de redes sociais. O aplicativo descarta qualquer campo desconhecido.
- CORS: o servidor deve permitir a origem do aplicativo e os cabeçalhos `Authorization` e `Content-Type`.

## Endpoints
| Método e caminho | Situação | O que faz |
|---|---|---|
| `GET /v1/health` | **usado pelo app** | `{service:"xflux-backend", apiVersion:"1", capabilities:["accounts","oauth","publishing","scheduler"], providers:[{network, oauth, publishing}]}` |
| `GET /v1/accounts` | **usado pelo app** | Contas conectadas: `id, network, displayName, state (connected/expired/revoked/error), scopes[], connectedAt, expiresAt|null, lastCheckedAt, lastError?` |
| `POST /v1/oauth/{network}/start` | **usado pelo app** | Corpo opcional `{reconnectAccountId}`. Devolve `{authorizationUrl (https), expiresInSeconds}`. O app mostra o domínio e abre o site oficial. O retorno (callback) é no servidor. |
| `DELETE /v1/accounts/{id}` | **usado pelo app** | Revoga e apaga a autorização. 204. |
| `POST /v1/uploads` | planejado | Upload retomável de mídia; devolve `mediaRef`. |
| `PUT /v1/publications/{clientPostId}` | planejado | Cria/atualiza o job (idempotente): `network, accountId, mediaRef, fields, scheduledAtUtc, timeZone`. |
| `GET /v1/publications/{clientPostId}` | planejado | Estado e tentativas: `queued/processing/published/failed`, `externalId`, `confirmedBy:"platform"`, `errorCode`. |
| `DELETE /v1/publications/{clientPostId}` | planejado | Cancela o job. |

## Códigos de erro esperados nas tentativas
Mapeados em `services/publishing/errors.ts`: `token-expired`, `token-revoked`, `permission-missing`, `rate-limited`, `media-invalid`, `media-unreachable`, `platform-rejected`, `audit-required`, `backend-unreachable`, `network-error`, `unknown`.

## Segurança que o servidor deve garantir
`state` anti-CSRF e PKCE no OAuth; tokens criptografados; renovação de tokens antes de expirar quando a rede permitir; limites por conta; log de auditoria; exclusão sob pedido (LGPD); validação do `Origin`.
