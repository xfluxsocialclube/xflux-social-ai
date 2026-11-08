# Configuração OAuth Meta — Instagram e Facebook

O backend implementa o fluxo **Facebook Login for Business** para autorizar Páginas do Facebook e contas profissionais do Instagram vinculadas a uma Página. Contas pessoais do Instagram não são suportadas por esta API. A publicação ainda permanece desativada no XFLUX.

## Variáveis obrigatórias no servidor

Configure somente no gerenciador de segredos do servidor, nunca no aplicativo desktop ou no Git:

- `META_APP_ID`: ID do aplicativo criado em Meta for Developers.
- `META_APP_SECRET`: segredo do aplicativo Meta.
- `META_OAUTH_REDIRECT_URI`: URL pública HTTPS exatamente igual ao callback cadastrado na Meta, terminando em `/v1/oauth/meta/callback`.
- `META_GRAPH_VERSION`: versão Graph API aprovada para o aplicativo (padrão atual do código: `v25.0`).
- `XFLUX_TOKEN_ENCRYPTION_KEY`: chave Fernet gerada com `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. Guarde-a fora do repositório e faça backup seguro.
- `XFLUX_JWT_ISSUER`, `XFLUX_JWT_AUDIENCE`, `XFLUX_JWKS_URL`: configuração do provedor de identidade que emite as sessões XFLUX RS256.
- `XFLUX_ALLOWED_ORIGINS`: origens HTTPS permitidas para a instalação.

## Configuração no Meta for Developers

1. Crie/configure um aplicativo Meta com o caso de uso de login empresarial apropriado.
2. Ative Facebook Login for Business e configure OAuth redirect URI válido.
3. Cadastre exatamente o valor de `META_OAUTH_REDIRECT_URI` nos URIs de redirecionamento válidos.
4. Solicite as permissões usadas pelo fluxo: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `publish_video`, `instagram_basic` e `instagram_content_publish`.
5. Conclua App Review e obtenha Advanced Access quando necessário para contas de usuários fora das funções de desenvolvimento do aplicativo.

## O que acontece no fluxo

- O usuário autenticado inicia a conexão; o servidor cria um state aleatório de uso único, vinculado à identidade verificada e com validade de 10 minutos.
- O navegador é enviado ao diálogo oficial da Meta.
- O callback consome o state uma única vez, troca o código por token de usuário e tenta obter o token de longa duração.
- O servidor consulta as Páginas autorizadas. Para Facebook, salva cada Página; para Instagram, salva a conta profissional vinculada à Página.
- Tokens de Página são criptografados com Fernet antes de serem persistidos. A API de contas nunca devolve tokens ao aplicativo.
- Uma nova autorização substitui o registro anterior da mesma conta/proprietário.

## Limitações importantes

- É necessário ter um provedor de identidade real configurado. O XFLUX não emite sessões nem aceita um ID informado pelo navegador.
- O callback precisa estar publicamente acessível por HTTPS; não funciona apontando para localhost em produção.
- Instagram precisa ser Business ou Creator e estar ligado a uma Página do Facebook para este fluxo.
- A exclusão da conexão no XFLUX remove o token armazenado; a revogação no painel Meta pode ser necessária para retirar o consentimento externo.
- A conexão não significa publicação automática pronta. Publicação, renovação monitorada, fila de mídia e tratamento de permissões/App Review continuam etapas separadas.
- Nunca cole App Secret, chave Fernet, JWT ou tokens sociais em conversas, issues ou commits.
