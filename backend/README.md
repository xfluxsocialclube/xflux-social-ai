# Servidor XFLUX — base inicial

Esta pasta contém o primeiro serviço executável do backend. Ele ainda **não conecta redes nem publica conteúdo**.

## O que já funciona

- GET /v1/health: informa que somente a consulta de contas está disponível; OAuth e publicação aparecem desativados para as seis redes.
- GET /v1/accounts: exige JWT assinado e validado pelo servidor; retorna somente metadados pertencentes ao usuário autenticado.
- DELETE /v1/accounts/{id}: só remove metadados pertencentes ao usuário autenticado.
- SQLite local para metadados, CORS configurável e testes automatizados.

## Executar em desenvolvimento

Na pasta backend, crie um ambiente virtual, instale requirements.txt e execute:

    python -m venv .venv
    .\\.venv\\Scripts\\Activate.ps1
    pip install -r requirements.txt
    $env:XFLUX_JWT_SECRET = "segredo-de-assinatura-com-pelo-menos-32-caracteres"
    $env:XFLUX_JWT_ISSUER = "https://seu-provedor-de-identidade"
    $env:XFLUX_JWT_AUDIENCE = "xflux-api"
    uvicorn app.main:app --host 127.0.0.1 --port 8000

A API fica em http://127.0.0.1:8000 e a documentação interativa em /docs.

## Preparação OAuth iniciada

O backend valida JWT HS256 com assinatura, emissor, público, expiração e identificador de usuário obrigatórios. O `sub` verificado é a única origem do identificador de cliente; não existe parâmetro para o navegador escolher outro usuário. As contas agora têm `owner_id`, as listagens filtram pelo usuário autenticado e a exclusão também exige correspondência do proprietário. Bancos antigos recebem uma migração: registros sem proprietário ficam ocultos, sem serem atribuídos automaticamente.\n\nO backend também cria a tabela `oauth_states` e inclui utilitários para gerar `state` aleatório, armazenar somente seu hash e consumi-lo uma única vez. Isso é uma base de segurança, **não habilita OAuth nem cria o login do usuário**. Ainda é necessário integrar um provedor de identidade real, publicar o serviço com HTTPS e implementar callbacks oficiais, cofre criptografado e publicação. Os seis provedores continuam desativados.

## Próxima integração: Meta

O plano de implementação segura de Instagram e Facebook está em [docs/META_OAUTH_ROLLOUT.md](docs/META_OAUTH_ROLLOUT.md). Ele descreve requisitos internos do servidor; não peça App ID, segredo ou URL de servidor ao usuário final.

## Configuração mínima de produção (ainda não habilita multiusuário)

Além de `XFLUX_ENV=production`, configure no ambiente do servidor:

- `XFLUX_JWT_SECRET`: chave HS256 com pelo menos 32 caracteres, guardada no gerenciador de segredos e compartilhada com o provedor emissor de tokens.
- `XFLUX_JWT_ISSUER`: emissor exato configurado no provedor de identidade.
- `XFLUX_JWT_AUDIENCE`: público esperado pelo backend, por exemplo `xflux-api`.
- `XFLUX_ALLOWED_ORIGINS`: lista explícita separada por vírgulas, contendo somente origens HTTPS do aplicativo e, se necessário, `tauri://localhost`. Não use `*` nem origens HTTP em produção.
- `XFLUX_DATABASE_PATH`: caminho persistente para o arquivo SQLite, fora de diretórios temporários.

O backend agora recusa chamadas autenticadas em produção quando a chave JWT está ausente/curta ou quando a lista de origens não foi definida com segurança. A validação JWT fornece identificação verificável para o backend, mas **não implementa tela de cadastro/login, recuperação de senha, emissão/renovação de tokens nem integração com provedor de identidade**. Não disponibilize o backend publicamente até conectar um emissor real e validar a configuração.

## Antes de hospedar publicamente

- Definir segredo forte no gerenciador de segredos do provedor; nunca usar o exemplo.
- Configurar HTTPS, domínio, CORS restrito e autenticação individual por usuário.
- Integrar provedor de identidade real, fluxo de login/renovação e gestão de usuários; validar isolamento em todos os novos recursos.\n- Implementar OAuth oficial e cofre criptografado de tokens antes de habilitar conexão.
- Implementar upload, fila durável, agendador e confirmação da plataforma antes de habilitar publicação.
- Fazer revisão de segurança, privacidade/LGPD, backups e política de retenção.

**Não use este protótipo como servidor público de produção.** Não há login multiusuário, OAuth, cofre de tokens, upload de mídia ou worker de publicação nesta etapa.
