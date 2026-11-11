# Contrato entre o aplicativo e o serviço seguro do XFLUX (versão 1)

Especificação OpenAPI: docs/openapi-backend.yaml. Cliente: src/services/backend/.

> Estado desta versão: sessões independentes por instalação e fluxo OAuth inicial da Meta implementados no código. A implantação HTTPS, os segredos reais e a validação com contas externas ainda precisam ser configurados. Publicação automática não está implementada.

## Arquitetura e privacidade

- Cada instalação do XFLUX cria uma chave aleatória de 256 bits e a mantém no armazenamento local do próprio dispositivo.
- O endpoint POST /v1/device/session troca essa chave por um JWT de curta duração, assinado pelo serviço. O subject é derivado por SHA-256 da chave; não existe cadastro/login central nem ID de cliente arbitrário enviado pelo usuário.
- A sessão é renovada automaticamente pelo aplicativo. O segredo que assina sessões existe somente no servidor.
- O serviço seguro recebe apenas a chave de instalação para emitir sessão, estados de autorização e tokens sociais cifrados. Não recebe vídeos, legendas, planilhas, calendário ou biblioteca de mídia.
- Tokens de redes sociais ficam cifrados no banco privado do serviço porque alguns provedores exigem client secret e callback HTTPS. Nunca são enviados ao frontend.
- Transporte HTTPS em produção; HTTP somente em localhost/loopback durante desenvolvimento. O cliente não envia cookies.
- GET /v1/health é público e informa somente capacidades realmente configuradas.
- CORS não substitui autenticação. Aplicar rate limit no proxy/edge, especialmente em POST /v1/device/session.

## Endpoints implementados

| Método e caminho | Estado real | Comportamento |
|---|---|---|
| POST /v1/device/session | Implementado | Recebe installationKey hexadecimal de 64 caracteres e emite JWT de 24 horas vinculado à instalação. Não exige login central. |
| GET /v1/health | Implementado, público | Informa capacidades conforme segredo de sessão, credenciais Meta, callback e chave Fernet. Publicação permanece desativada. |
| GET /v1/accounts | Implementado, protegido | Lista somente metadados cujo owner_id corresponde à instalação autenticada. Nunca devolve tokens. |
| DELETE /v1/accounts/{id} | Implementado, protegido | Apaga metadados somente quando o registro pertence à instalação autenticada. |
| POST /v1/oauth/{network}/start | Inicial para Instagram/Facebook | Exige sessão válida e configuração Meta; gera URL oficial e state aleatório de uso único vinculado à instalação. Outras redes retornam indisponibilidade. |
| GET /v1/oauth/meta/callback | Inicial para Instagram/Facebook | Consome state, troca código por token, consulta permissões e Páginas, encontra Instagram profissional vinculado e guarda tokens cifrados. Requer credenciais e testes reais. |

## Configuração obrigatória no servidor

- XFLUX_ENV=production
- XFLUX_JWT_ISSUER e XFLUX_JWT_AUDIENCE
- XFLUX_DEVICE_SESSION_SECRET (mínimo 32 caracteres aleatórios)
- XFLUX_ALLOWED_ORIGINS com origens HTTPS explícitas
- XFLUX_DATABASE_PATH persistente
- XFLUX_TOKEN_ENCRYPTION_KEY (chave Fernet)
- META_APP_ID, META_APP_SECRET e META_OAUTH_REDIRECT_URI HTTPS
- Rate limit e TLS no proxy/edge

Nenhum desses segredos deve ser embutido no aplicativo ou commitado no Git. O serviço precisa ser implantado e configurado pelo mantenedor antes que os botões de conexão sejam liberados.

## Limites que continuam verdadeiros

- Instagram/Facebook: fluxo OAuth inicial no backend; faltam configuração e validação ponta a ponta com aplicativo Meta real, revisão/permissões e ambiente HTTPS.
- TikTok: OAuth e Content Posting API ainda não implementados. A documentação oficial exige troca do código por token no servidor, e clientes não auditados têm publicação limitada a privado. Fonte: https://developers.tiktok.com/docs/en/oauth-get-a-user-access-token e https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post
- Pinterest: OAuth e publicação ainda não implementados; requer App ID, segredo, redirect URI e aprovação/acesso da aplicação. Fonte: https://dev.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/
- YouTube: OAuth de aplicativo instalado com PKCE é possível, mas ainda não implementado no XFLUX. Fonte: https://developers.google.com/youtube/data/guides/authentication
- Shopee Video: não há API oficial de publicação confirmada no projeto.
- Nenhuma rede publica automaticamente nesta versão. OAuth conectado não significa envio de publicação concluído.

## Próximos passos técnicos

1. Implantar o backend com HTTPS, segredos, persistência e rate limit.
2. Configurar o aplicativo Meta e validar conexão Facebook/Instagram com contas reais de teste.
3. Implementar OAuth específico do TikTok e Pinterest sem expor client secrets.
4. Implementar fluxo Google OAuth/PKCE local para YouTube.
5. Somente depois, desenvolver e testar adaptadores de publicação e fila local durável.
6. Preservar os arquivos e a biblioteca do cliente no armazenamento escolhido; nunca centralizar mídia.

Não usar o protótipo como servidor público de produção antes de concluir hardening, rate limit, monitoramento, backup, revisão de segurança e testes reais.
