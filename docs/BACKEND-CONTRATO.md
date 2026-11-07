# Contrato entre o aplicativo e o servidor do XFLUX (versão 1)

Especificação OpenAPI: `docs/openapi-backend.yaml`. Cliente: `src/services/backend/`.

> **Estado desta versão:** base técnica privada/em desenvolvimento. Não é um serviço multiusuário pronto para produção. A chave Bearer atual é compartilhada e temporária; não representa a identidade de uma pessoa. OAuth e publicação estão desativados.

## Regras atuais

- Transporte HTTPS; HTTP somente em `localhost`/loopback durante desenvolvimento.
- O cliente não envia cookies (`credentials: omit`).
- `GET /v1/health` é público e informa capacidades reais.
- Os endpoints de contas e início OAuth exigem `Authorization: Bearer <XFLUX_SESSION_TOKEN>`.
- A chave de sessão do XFLUX não é token de Instagram, Facebook ou outra rede.
- O servidor não devolve tokens de redes sociais.
- Em produção, o backend recusa chamadas protegidas se o segredo tiver menos de 32 caracteres ou se `XFLUX_ALLOWED_ORIGINS` não contiver uma lista explícita de origens seguras.
- CORS não substitui autenticação. A chave compartilhada não deve ser usada como login de clientes.

## Endpoints implementados

| Método e caminho | Estado real | Comportamento |
|---|---|---|
| `GET /v1/health` | Implementado, público | Informa somente `accounts` como capacidade disponível e todos os provedores com `oauth:false` e `publishing:false`. |
| `GET /v1/accounts` | Implementado, protegido | Lista metadados da tabela SQLite. Ainda não há isolamento multiusuário. |
| `DELETE /v1/accounts/{id}` | Implementado, protegido | Apaga metadados locais. Não revoga autorização na plataforma porque OAuth ainda não existe. |
| `POST /v1/oauth/{network}/start` | Bloqueado intencionalmente | Retorna 503; não inicia nem simula autorização. |

## Endpoints planejados — não implementar no cliente como disponíveis

- Callback OAuth e gestão segura de state/PKCE.
- Login/identidade individual XFLUX, sessões revogáveis e isolamento por usuário/tenant.
- Cofre criptografado de tokens de provedores.
- Upload retomável de mídia.
- Fila durável, agendador e publicação com confirmação da plataforma.

## Requisitos para habilitar multiusuário e OAuth

1. Adotar provedor de identidade OIDC confiável ou autenticação equivalente, com validação de assinatura, issuer, audience, expiração e rotação de chaves.
2. Derivar o identificador do usuário exclusivamente da identidade validada no servidor; nunca aceitar user_id enviado pelo cliente como autorização.
3. Vincular cada conta social e cada operação ao usuário/tenant autenticado. Consultas, desconexões e jobs devem sempre filtrar pelo tenant.
4. Criar sessões curtas/revogáveis ou usar tokens de acesso emitidos pelo provedor de identidade. Não distribuir uma chave compartilhada embutida no aplicativo desktop.
5. Implementar OAuth state aleatório, uso único, expiração curta, vínculo à sessão e validação exata do redirect URI. Usar PKCE quando suportado pelo provedor.
6. Criptografar tokens de rede em repouso com chave gerenciada fora do banco; nunca enviar tokens ao frontend nem registrá-los em logs.
7. Implementar rate limiting, auditoria sem segredos, política de retenção, exclusão LGPD e testes de acesso cruzado entre usuários.
8. Só anunciar conexão depois do callback validado e da consulta real à plataforma. Só anunciar publicação depois de confirmação verificável da plataforma.

## Códigos de resposta relevantes

- `401`: cabeçalho de sessão ausente ou incorreto.
- `503`: configuração segura indisponível ou OAuth ainda não configurado.
- `404`: rede desconhecida ou recurso não encontrado, conforme rota.

Não usar este protótipo como servidor público de produção.
