# Plano de integração oficial Meta (Instagram e Facebook)

Este documento define a próxima etapa do backend. **Não significa que OAuth esteja implementado**: até que o fluxo, o armazenamento seguro e os testes estejam concluídos, os provedores devem continuar com `oauth: false` e a API deve continuar recusando a conexão.

## 1. Separar os dois produtos de login

- **Instagram API with Instagram Login:** caminho preferido para conectar contas profissionais do Instagram (Business ou Creator). Não tratar contas pessoais como compatíveis com a API de publicação profissional.
- **Facebook Login:** fluxo separado para autorizar acesso a páginas e recursos do Facebook. Não assumir que o login do Instagram concede permissões de Página do Facebook, ou vice-versa.

A interface pode apresentar ambos sob a marca Meta, mas deve manter estados e permissões por rede.

## 2. Fluxo de autorização esperado

1. O usuário clica em **Conectar Instagram** no XFLUX.
2. O backend identifica a sessão autenticada do usuário XFLUX e cria um `state` aleatório, de uso único, com validade curta (por exemplo, 10 minutos). Persistir somente o hash do state.
3. O backend monta a URL oficial de autorização usando o App ID, callback HTTPS fixo e escopos mínimos aprovados.
4. O aplicativo abre a URL devolvida pelo backend. O usuário entra na Meta e aprova as permissões.
5. A Meta redireciona para o callback HTTPS do backend com `code` e `state`.
6. O backend valida e consome o state atomicamente; rejeita state ausente, expirado, reutilizado ou associado a outra sessão.
7. O backend troca o código por token diretamente com a Meta. O segredo do aplicativo nunca é enviado ao frontend.
8. O backend valida a identidade/permissões recebidas, obtém o identificador e nome da conta e guarda tokens criptografados.
9. O XFLUX recebe apenas metadados da conta e o estado da conexão. Nunca recebe access token ou app secret.
10. Desconectar deve revogar quando suportado e apagar tokens e metadados de forma consistente.

## 3. Configuração interna do servidor

Os valores abaixo são segredos/configuração de implantação, não campos para o usuário final:

- `META_INSTAGRAM_APP_ID`
- `META_INSTAGRAM_APP_SECRET`
- `META_INSTAGRAM_REDIRECT_URI` (HTTPS fixo, registrado exatamente no painel Meta)
- `XFLUX_TOKEN_ENCRYPTION_KEY` (chave de criptografia forte, mantida em Secret Manager)
- segredo de sessão/autenticação individual do XFLUX, com identidade de usuário e autorização por conta

Não colocar esses valores em arquivos versionados, no aplicativo desktop, em logs, respostas HTTP ou screenshots. Não usar um token de sessão compartilhado entre todos os clientes como substituto de login multiusuário em produção.

## 4. Condições antes de habilitar o botão

- Aplicativo Meta criado e configurado no painel de desenvolvedor.
- URI de callback HTTPS registrada e idêntica à usada no backend.
- Permissões mínimas solicitadas e App Review/Live mode concluídos quando exigidos.
- Conta de teste profissional Business ou Creator disponível.
- Banco com isolamento por usuário, state de uso único e armazenamento criptografado de tokens.
- Testes automatizados para state inválido/expirado/reutilizado, callback, troca de código, falhas da Meta, expiração/revogação e isolamento entre usuários.
- Monitoramento sem registrar códigos OAuth, tokens ou segredos.
- Revisão de segurança e privacidade/LGPD.

## 5. Publicação não é a mesma coisa que conexão

Uma autorização bem-sucedida não prova que a publicação está pronta. Habilitar publicação somente depois de implementar e testar permissões de publicação, requisitos de mídia, limites da plataforma, tratamento de falhas e confirmação de publicação pela API oficial. Até lá, manter `publishing: false`.

## Referências oficiais

- Instagram API with Instagram Login: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/
- Business Login for Instagram: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/
- Instagram Platform: https://developers.facebook.com/docs/instagram-platform/
- Facebook Login: https://developers.facebook.com/docs/facebook-login/
