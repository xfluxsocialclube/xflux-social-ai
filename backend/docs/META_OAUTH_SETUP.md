# Configuração OAuth Meta — Instagram e Facebook

O backend contém um fluxo de autorização OAuth pelo diálogo do Facebook Login (não é ainda o fluxo Facebook Login for Business com `config_id`). Ele autoriza Páginas do Facebook e contas profissionais do Instagram vinculadas a uma Página. Contas pessoais do Instagram não são suportadas por esta integração. A publicação ainda permanece desativada no XFLUX.

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

1. Crie/configure um aplicativo Meta e adicione o produto Facebook Login.
2. Configure OAuth redirect URI válido nas configurações do Facebook Login.
3. Cadastre exatamente o valor de `META_OAUTH_REDIRECT_URI` nos URIs de redirecionamento válidos.
4. Solicite as permissões usadas pelo fluxo: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `publish_video`, `instagram_basic` e `instagram_content_publish`. Para a conexão básica, o backend exige `pages_show_list` e `pages_read_engagement`; para Instagram também exige `instagram_basic`. Permissões de publicação são registradas apenas se concedidas e serão necessárias quando a publicação for implementada.
5. Conclua App Review e obtenha Advanced Access quando necessário para contas de usuários fora das funções de desenvolvimento do aplicativo.

## O que acontece no fluxo

- O usuário autenticado inicia a conexão; o servidor cria um state aleatório de uso único, vinculado à identidade verificada e com validade de 10 minutos.
- O navegador é enviado ao diálogo oficial da Meta.
- O callback consome o state uma única vez, troca o código por token de usuário e tenta obter o token de longa duração.
- O servidor consulta `/me/permissions` e exige as permissões mínimas para o tipo de conexão; só grava os escopos que a Meta realmente marcou como `granted`. Depois consulta todas as páginas autorizadas, seguindo a paginação Meta com validação do domínio. Para Facebook, salva cada Página; para Instagram, salva as contas profissionais vinculadas às Páginas.
- Tokens de Página são criptografados com Fernet antes de serem persistidos. A API de contas nunca devolve tokens ao aplicativo. A validade do token de usuário não é copiada incorretamente como expiração do token da Página.
- Uma nova autorização substitui o registro anterior da mesma conta/proprietário.

## Limitações importantes

- É necessário ter um provedor de identidade real configurado. O XFLUX não emite sessões nem aceita um ID informado pelo navegador.
- O callback precisa estar publicamente acessível por HTTPS; não funciona apontando para localhost em produção.
- Instagram precisa ser Business ou Creator e estar ligado a uma Página do Facebook para este fluxo.
- A exclusão da conexão no XFLUX remove o token armazenado; a revogação no painel Meta pode ser necessária para retirar o consentimento externo.
- A conexão não significa publicação automática pronta. Publicação, renovação monitorada, fila de mídia e tratamento de permissões/App Review continuam etapas separadas.
- Nunca cole App Secret, chave Fernet, JWT ou tokens sociais em conversas, issues ou commits.
