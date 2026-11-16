# Autorizações oficiais do XFLUX — arquitetura local

**Estado:** preparação técnica; nenhuma conta está conectada nesta etapa.
**Regra do produto:** cada cliente autoriza as próprias contas no navegador oficial da plataforma. Tokens, vídeos, legendas, fila e histórico ficam no dispositivo do cliente. O XFLUX não recebe nem armazena dados em servidor central.

## Cadastro do aplicativo
O cliente final não deve criar aplicativo de desenvolvedor, copiar chaves, informar URL de servidor ou entregar senha ao XFLUX. O proprietário do produto registra os aplicativos oficiais, solicita os escopos e passa pela análise exigida. Depois disso, o cliente só vê Conectar e a tela oficial de consentimento.
Credenciais de desenvolvedor não são senhas dos clientes. Um segredo OAuth confidencial não pode ser embutido num executável distribuído: qualquer pessoa poderia extraí-lo. Não publicar segredos em variáveis Vite, JavaScript, repositório, instalador ou armazenamento do cliente.

## Situação por plataforma
| Plataforma | API oficial | Autorização e bloqueios |
|---|---|---|
| Instagram | Publicação de conteúdo para contas profissionais | Registrar app Meta, habilitar produto/permissões de Instagram, configurar redirect URI e solicitar análise quando exigida. O fluxo e a troca de token precisam seguir o produto de login escolhido pela Meta; não presumir que um segredo confidencial possa ser distribuído em cliente desktop. |
| Facebook | Reels e conteúdo de Página | App Meta, permissões de Página e análise de acesso conforme o caso. Usar somente endpoints oficiais e contas/Páginas autorizadas. |
| TikTok | Content Posting API | Registrar app, adicionar Content Posting API, solicitar video.publish e obter autorização do usuário. Clientes não auditados têm publicações limitadas à visibilidade privada; a auditoria é necessária para liberar visibilidade pública. |
| YouTube | YouTube Data API videos.insert | Criar projeto Google Cloud, habilitar YouTube Data API v3 e configurar OAuth para aplicativo instalado. O Google documenta PKCE e redirect loopback 127.0.0.1. Projetos não verificados podem ter uploads restritos/privados até auditoria. |
| Pinterest | API v5 para Pins | Registrar app, configurar redirect URI e escopos. A troca de authorization code exige HTTP Basic com client_id e client_secret; por isso não se deve implementar essa troca diretamente no executável público sem mecanismo oficial seguro compatível com a exigência de não haver servidor central. |
| Shopee Video | Não confirmada para publicação aberta por API | Não implementar automação por endpoints privados, scraping ou engenharia reversa. Manter publicação assistida até existir documentação e acesso oficial que autorizem esse uso. |

## Fluxo esperado no aplicativo
1. Cliente clica em Conectar na rede desejada.
2. O XFLUX gera state aleatório e, quando suportado, PKCE (code_verifier/code_challenge).
3. Abre o navegador padrão na página HTTPS oficial da rede.
4. Cliente entra na própria conta e concede apenas os escopos apresentados.
5. A plataforma redireciona para o callback local registrado.
6. O XFLUX valida state, conclui a troca de código somente por fluxo permitido pela plataforma e guarda os tokens no cofre seguro do sistema operacional.
7. O aplicativo consulta a identidade/conta autorizada e só então exibe Conectado.
8. Revogar/desconectar remove o token local e invalida a associação local.

## Requisitos antes de ativar qualquer botão
- Implementar callback OAuth local no Tauri (loopback em 127.0.0.1 com porta aleatória ou deep-link permitido pelo provedor).
- Implementar geração criptográfica de state, PKCE quando suportado, expiração e proteção contra replay.
- Usar cofre nativo do Windows/macOS/Linux para tokens; não usar localStorage, IndexedDB, arquivos JSON ou sessionStorage para segredos.
- Não incluir client_secret em frontend, variáveis VITE_*, executável ou instalador.
- Separar adaptadores por plataforma e implementar publicação somente depois de validar escopos, limites, mídia, consentimento explícito e resposta real da API.
- Nunca marcar conta como conectada ou publicação como concluída sem confirmação da plataforma.
- Se a plataforma exigir segredo confidencial no servidor para a troca do código e não oferecer fluxo público seguro, manter essa integração desativada nesta arquitetura local-only. Não contornar a exigência.

## Fontes oficiais consultadas
- TikTok Direct Post: https://developers.tiktok.com/docs/en/content-posting-api-get-started
- TikTok Upload/Draft: https://developers.tiktok.com/docs/en/content-posting-api-get-started-upload-content
- YouTube OAuth para apps instalados e PKCE: https://developers.google.com/youtube/reporting/guides/authorization/installed-apps
- YouTube upload: https://developers.google.com/youtube/v3/docs/videos/insert
- Pinterest OAuth e troca de token: https://developer.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/
- Meta Instagram Content Publishing: https://developers.facebook.com/documentation/instagram-platform/content-publishing
- Meta Reels Publishing: https://developers.facebook.com/documentation/video-api/guides/reels-publishing

## Limite desta etapa
Este documento prepara o trabalho e registra as exigências reais. Ele não significa que OAuth, publicação automática, aprovação das plataformas ou cofre de tokens já estejam implementados. O estado do código permanece not-connected até cada integração passar por implementação e teste real.