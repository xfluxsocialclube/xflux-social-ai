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

## Antes de hospedar publicamente

- Definir segredo forte no gerenciador de segredos do provedor; nunca usar o exemplo.
- Configurar HTTPS, domínio, CORS restrito e autenticação individual por usuário.
- Implementar login XFLUX, OAuth oficial e cofre criptografado de tokens antes de habilitar conexão.
- Implementar upload, fila durável, agendador e confirmação da plataforma antes de habilitar publicação.
- Fazer revisão de segurança, privacidade/LGPD, backups e política de retenção.

**Não use este protótipo como servidor público de produção.** Não há login multiusuário, OAuth, cofre de tokens, upload de mídia ou worker de publicação nesta etapa.
