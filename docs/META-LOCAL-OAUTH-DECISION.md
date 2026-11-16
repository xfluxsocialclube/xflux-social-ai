# Decisão técnica: Instagram/Meta no aplicativo desktop local-first

## Estado observado

O aplicativo Meta usado no desenvolvimento do XFLUX está configurado com **Instagram API / Unified Login**. Isso não deve ser confundido com o fluxo legado de Instagram Login nem com o antigo fluxo de Facebook Login baseado apenas em uma lista de permissões.

O XFLUX ainda não implementa nem valida o OAuth da Meta. A existência de App ID, Business Portfolio, configuração de login ou URL de retorno cadastrada no painel não significa que uma conta esteja conectada.

## Regras de segurança

1. Não incluir `META_APP_SECRET`, segredo de Instagram, tokens de usuário/sistema ou chaves privadas no executável, no frontend, em arquivos de configuração distribuídos ou no repositório.
2. Não pedir ao usuário final que informe segredo de aplicativo, token, URL de servidor ou chave técnica.
3. Não reutilizar código do fluxo antigo de Instagram Login sem confirmar que os parâmetros e permissões correspondem ao Unified Login efetivamente configurado no painel.
4. Não marcar a conta como conectada até validar a resposta real da Meta, identificar o ativo autorizado e guardar o token no cofre nativo do sistema.
5. Não habilitar publicação automática antes de implementar e testar separadamente as operações oficiais de mídia e publicação.

## Por que a integração está bloqueada para implementação direta sem validação adicional

A documentação da Meta descreve usuários do sistema como identidades para servidores ou software que fazem chamadas automatizadas a ativos empresariais. Também informa que esse modelo não percorre o login OAuth padrão de uma pessoa. Consulte:
- [Visão geral de usuários do sistema da Meta](https://developers.facebook.com/docs/business-management-apis/system-users/overview/)
- [Instalar aplicativos e gerar tokens de usuários do sistema](https://developers.facebook.com/docs/business-management-apis/system-users/install-apps-and-generate-tokens)
- [Proteger chamadas à Graph API com appsecret_proof](https://developers.facebook.com/docs/graph-api/guides/secure-requests/)

A Meta também documenta o uso de `appsecret_proof`, calculado com o segredo do aplicativo, para reforçar chamadas à Graph API. Um segredo distribuído dentro de um aplicativo desktop pode ser extraído; portanto, não deve ser tratado como segredo.

Antes de implementar o Unified Login, é obrigatório confirmar no painel e na documentação oficial correspondente:
- se a configuração selecionada usa token de usuário ou token de usuário do sistema;
- qual URL de login foi gerada e quais parâmetros ela exige, especialmente `config_id` e `response_type`;
- qual tipo de retorno é permitido para aplicativo desktop (loopback ou URI de aplicativo);
- como o código é trocado por token e se a Meta exige segredo privado nessa troca;
- quais permissões e ativos empresariais são concedidos pela configuração.

## Decisão do XFLUX

- Se a Meta oferecer fluxo público de desktop com PKCE ou mecanismo equivalente que não exija segredo privado no cliente, implementar navegador externo, callback local restrito a `127.0.0.1`, validação de `state`, troca segura e armazenamento no cofre nativo.
- Se a troca exigir segredo privado ou componente confiável do lado do servidor, não embutir o segredo no XFLUX nem improvisar uma API intermediária. Manter a conexão Meta indisponível ou assistida até existir uma alternativa oficial compatível com a arquitetura local-first.
- Não implantar o backend legado de `backend/` como atalho. Ele não faz parte da arquitetura aprovada para o produto.

## URL pública e callback OAuth são coisas diferentes

O site institucional e suas páginas de privacidade/termos podem ser hospedados no GitHub Pages. Isso não faz do endereço da página inicial um callback OAuth válido. O callback só deve ser cadastrado depois de o fluxo real estar definido e testado. Não usar automaticamente `https://xfluxsocialclube.github.io/xflux-social-ai/` como callback do aplicativo.

## Situação atual

- YouTube: existe uma implementação experimental de OAuth local com navegador externo, loopback e PKCE na branch deste PR; CI passou, mas ainda precisa de teste real no Windows.
- Instagram/Meta: não implementado; Unified Login precisa de validação específica.
- Facebook, TikTok e Pinterest: não implementados nesta entrega.
- Publicação automática: desabilitada; nenhum sucesso é simulado.
