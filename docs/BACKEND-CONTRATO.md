# Contrato entre o aplicativo e o servidor do XFLUX (versão 1)

Especificação OpenAPI: `docs/openapi-backend.yaml`. Cliente: `src/services/backend/`.

> **Estado desta versão:** base técnica privada/em desenvolvimento. O backend agora valida JWT e aplica isolamento de contas pelo `sub` verificado, mas ainda não há provedor de identidade conectado, fluxo de login/cadastro, sessões revogáveis nem OAuth/publicação. Não é um serviço pronto para produção.

## Regras atuais

- Transporte HTTPS; HTTP somente em `localhost`/loopback durante desenvolvimento.
- O cliente não envia cookies (`credentials: omit`).
- `GET /v1/health` é público e informa capacidades reais.
- Os endpoints de contas e início OAuth exigem `Authorization: Bearer <JWT>` assinado pelo emissor configurado, com `iss`, `aud`, `sub`, `iat` e `exp` válidos.
- O JWT identifica a pessoa perante o backend; não é token de Instagram, Facebook ou outra rede. Em desenvolvimento, o backend valida HS256 com segredo local; em produção, exige JWKS HTTPS e valida RS256 com chave pública, além de issuer, audience e validade temporal.
- O servidor não devolve tokens de redes sociais.
- Em produção, o backend recusa chamadas protegidas se `XFLUX_JWKS_URL` HTTPS, `XFLUX_JWT_ISSUER`, `XFLUX_JWT_AUDIENCE` ou a lista explícita `XFLUX_ALLOWED_ORIGINS` não estiverem configurados com segurança. `XFLUX_JWT_SECRET` é somente para desenvolvimento.
- CORS não substitui autenticação. O segredo de assinatura fica somente no servidor/emissor e nunca deve ser embutido no aplicativo desktop.

## Endpoints implementados

| Método e caminho | Estado real | Comportamento |
|---|---|---|
| `GET /v1/health` | Implementado, público | Informa somente `accounts` como capacidade disponível e todos os provedores com `oauth:false` e `publishing:false`. |
| `GET /v1/accounts` | Implementado, protegido | Lista somente metadados cujo `owner_id` corresponde ao `sub` do JWT validado. |
| `DELETE /v1/accounts/{id}` | Implementado, protegido | Apaga metadados somente quando o registro pertence ao usuário autenticado. Não revoga autorização na plataforma porque OAuth ainda não existe. |
| `POST /v1/oauth/{network}/start` | Bloqueado intencionalmente | Retorna 503; não inicia nem simula autorização. |

## Endpoints planejados — não implementar no cliente como disponíveis

- Callback OAuth e gestão segura de state/PKCE.
- Login/identidade individual XFLUX, sessões revogáveis e isolamento por usuário/tenant.
- Cofre criptografado de tokens de provedores.
- Upload retomável de mídia.
- Fila durável, agendador e publicação com confirmação da plataforma.

## Requisitos para habilitar multiusuário e OAuth

1. Adotar provedor de identidade OIDC confiável ou autenticação equivalente, com validação de assinatura, issuer, audience, expiração e rotação de chaves.
2. Derivar o identificador do usuário exclusivamente da identidade validada no servidor; nunca aceitar user_id enviado pelo cliente como autorização. **Base implementada:** validador JWT HS256 em desenvolvimento e JWKS/RS256 em produção, com extração de `sub`; ainda falta conectar um emissor OIDC real e ciclo de vida de sessão.
3. **Contas implementadas:** `owner_id` em contas, listagem e exclusão filtradas pelo `sub` autenticado. Aplicar a mesma regra a mídias, tokens, filas e jobs quando esses módulos forem persistidos no servidor.
4. Conectar um provedor de identidade OIDC e usar tokens curtos/revogáveis. Não distribuir uma chave de assinatura compartilhada embutida no aplicativo desktop.
5. Implementar OAuth state aleatório, uso único, expiração curta, vínculo à sessão e validação exata do redirect URI. Usar PKCE quando suportado pelo provedor.
6. Criptografar tokens de rede em repouso com chave gerenciada fora do banco; nunca enviar tokens ao frontend nem registrá-los em logs.
7. Implementar rate limiting, auditoria sem segredos, política de retenção, exclusão LGPD e testes de acesso cruzado entre usuários.
8. Só anunciar conexão depois do callback validado e da consulta real à plataforma. Só anunciar publicação depois de confirmação verificável da plataforma.

## Códigos de resposta relevantes

- `401`: cabeçalho de sessão ausente ou incorreto.
- `503`: configuração segura indisponível ou OAuth ainda não configurado.
- `404`: rede desconhecida ou recurso não encontrado, conforme rota.

Não usar este protótipo como servidor público de produção.
