# Servidor XFLUX — base inicial

Esta pasta contém o primeiro serviço executável do backend. Ele ainda **não conecta redes nem publica conteúdo**.

## O que já funciona

- GET /v1/health: informa que somente a consulta de contas está disponível; OAuth e publicação aparecem desativados para as seis redes.
- GET /v1/accounts: exige token de sessão configurado no servidor e retorna somente metadados.
- DELETE /v1/accounts/{id}: remove metadados de uma conta.
- SQLite local para metadados, CORS configurável e testes automatizados.

## Executar em desenvolvimento

Na pasta backend, crie um ambiente virtual, instale requirements.txt e execute:

    python -m venv .venv
    .\\.venv\\Scripts\\Activate.ps1
    pip install -r requirements.txt
    $env:XFLUX_SESSION_TOKEN = "use-um-segredo-longo-e-aleatorio"
    uvicorn app.main:app --host 127.0.0.1 --port 8000

A API fica em http://127.0.0.1:8000 e a documentação interativa em /docs.

## Preparação OAuth iniciada

O backend agora cria a tabela `oauth_states` e inclui utilitários testados para gerar `state` aleatório, armazenar somente seu hash e consumi-lo uma única vez, com validade curta e vínculo à sessão informada. Isso é uma peça de segurança do fluxo, **não habilita OAuth nem substitui login individual**. Os seis provedores continuam com `oauth: false` e o endpoint de início continua recusando conexões até que a autenticação multiusuário, os callbacks oficiais, a troca de códigos e o cofre criptografado estejam prontos.

## Próxima integração: Meta

O plano de implementação segura de Instagram e Facebook está em [docs/META_OAUTH_ROLLOUT.md](docs/META_OAUTH_ROLLOUT.md). Ele descreve requisitos internos do servidor; não peça App ID, segredo ou URL de servidor ao usuário final.

## Configuração mínima de produção (ainda não habilita multiusuário)

Além de `XFLUX_ENV=production`, configure no ambiente do servidor:

- `XFLUX_SESSION_TOKEN`: segredo aleatório com pelo menos 32 caracteres, guardado no gerenciador de segredos.
- `XFLUX_ALLOWED_ORIGINS`: lista explícita separada por vírgulas, contendo somente origens HTTPS do aplicativo e, se necessário, `tauri://localhost`. Não use `*` nem origens HTTP em produção.
- `XFLUX_DATABASE_PATH`: caminho persistente para o arquivo SQLite, fora de diretórios temporários.

O backend agora recusa chamadas autenticadas em produção quando o segredo é curto/ausente ou quando a lista de origens não foi definida com segurança. Essa chave ainda é compartilhada e serve somente como barreira temporária para ambiente privado; **não é login individual nem isolamento de clientes**.

## Antes de hospedar publicamente

- Definir segredo forte no gerenciador de segredos do provedor; nunca usar o exemplo.
- Configurar HTTPS, domínio, CORS restrito e autenticação individual por usuário.
- Implementar login XFLUX, OAuth oficial e cofre criptografado de tokens antes de habilitar conexão.
- Implementar upload, fila durável, agendador e confirmação da plataforma antes de habilitar publicação.
- Fazer revisão de segurança, privacidade/LGPD, backups e política de retenção.

**Não use este protótipo como servidor público de produção.** Não há login multiusuário, OAuth, cofre de tokens, upload de mídia ou worker de publicação nesta etapa.
