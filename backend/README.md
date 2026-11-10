# Estado atual do backend (atualizado em 10/11/2026)

O backend contém um fluxo inicial de OAuth da Meta (Facebook/Instagram) e agora suporta **sessões independentes por instalação do XFLUX**, sem exigir cadastro/login em um provedor central. O aplicativo cria uma chave aleatória local e recebe uma sessão curta assinada pelo servidor. Cada instalação tem seu próprio identificador e suas próprias contas conectadas.

O serviço seguro é necessário somente para concluir OAuth que depende de segredo privado e callback HTTPS. Ele não armazena vídeos, legendas, planilhas ou calendário do cliente. Tokens de redes sociais são armazenados criptografados no banco do serviço e nunca retornam ao frontend.

**Ainda dependem de configuração externa:** hospedagem HTTPS, segredo de sessão, chave Fernet, credenciais e aprovação do aplicativo Meta, URL de callback e configuração de produção. Sem esses dados, o botão de conexão permanece corretamente bloqueado. Não existem credenciais reais no repositório.

**Ainda não estão concluídos:** publicação por API, upload remoto de mídia, fila durável, agendador, integrações OAuth reais de TikTok/Pinterest/YouTube e publicação oficial da Shopee Video. Conectar uma conta não significa que a publicação automática esteja pronta.

A variável XFLUX_DEVICE_SESSION_SECRET (mínimo 32 caracteres) permite emitir sessões curtas por instalação. Configure-a somente no servidor. XFLUX_JWT_ISSUER e XFLUX_JWT_AUDIENCE identificam o emissor e o público. O endpoint POST /v1/device/session recebe somente uma chave aleatória de instalação; aplique rate limit no proxy HTTPS.


# Servidor XFLUX — base inicial

Esta pasta contém o primeiro serviço executável do backend. Ele ainda **não conecta redes nem publica conteúdo**.

## O que já está implementado no código

- GET /v1/health: informa as capacidades conforme a configuração; Meta OAuth só aparece habilitado quando identidade, credenciais, callback e chave de criptografia estão presentes.
- GET /v1/accounts: exige JWT assinado e validado pelo servidor; retorna somente metadados pertencentes ao usuário autenticado.
- DELETE /v1/accounts/{id}: só remove metadados pertencentes ao usuário autenticado.
- POST /v1/oauth/{network}/start: inicia o fluxo oficial Meta para Facebook/Instagram quando configurado e autenticado; outras redes permanecem indisponíveis.
- GET /v1/oauth/meta/callback: troca o código, valida permissões e páginas e persiste tokens cifrados; ainda requer validação ponta a ponta com credenciais reais.
- SQLite para metadados/contas e tokens cifrados, CORS configurável e testes automatizados.
- **Publicação por API, upload de mídia e agendador ainda não estão implementados.**

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

O backend valida JWT com emissor, público, expiração e identificador de usuário obrigatórios. Em desenvolvimento, aceita HS256 com segredo local. Em produção, exige JWKS em HTTPS e valida tokens RS256 usando a chave pública publicada pelo provedor de identidade; não existe fallback para o segredo de desenvolvimento. O `sub` verificado é a única origem do identificador de cliente; não existe parâmetro para o navegador escolher outro usuário. As contas agora têm `owner_id`, as listagens filtram pelo usuário autenticado e a exclusão também exige correspondência do proprietário. Bancos antigos recebem uma migração: registros sem proprietário ficam ocultos, sem serem atribuídos automaticamente.

O backend também cria a tabela `oauth_states` e inclui utilitários para gerar `state` aleatório, armazenar somente seu hash e consumi-lo uma única vez. Esse mecanismo já é utilizado pelo callback Meta inicial. Ainda é necessário integrar um provedor de identidade real, publicar o serviço com HTTPS, configurar credenciais/callback oficiais e testar o fluxo com contas Meta autorizadas. O fluxo inicial Meta não habilita publicação; TikTok, Pinterest, YouTube e Shopee continuam sem OAuth próprio.

## Próxima integração: Meta

O plano de implementação segura de Instagram e Facebook está em [docs/META_OAUTH_ROLLOUT.md](docs/META_OAUTH_ROLLOUT.md). Ele descreve requisitos internos do servidor; não peça App ID, segredo ou URL de servidor ao usuário final.

## Configuração mínima de produção (ainda não habilita multiusuário)

Além de `XFLUX_ENV=production`, configure no ambiente do servidor:

- `XFLUX_JWT_ISSUER`: emissor exato configurado no provedor de identidade.
- `XFLUX_JWT_AUDIENCE`: público esperado pelo backend, por exemplo `xflux-api`.
- `XFLUX_JWKS_URL`: URL HTTPS do documento JWKS do provedor de identidade. Em produção, o backend aceita somente RS256 e consulta a chave pública pelo `kid`; a chave JWKS fica em cache por cinco minutos.
- `XFLUX_JWT_SECRET`: somente para desenvolvimento local com HS256. Não é usado em produção.
- `XFLUX_ALLOWED_ORIGINS`: lista explícita separada por vírgulas, contendo somente origens HTTPS do aplicativo e, se necessário, `tauri://localhost`. Não use `*` nem origens HTTP em produção.
- `XFLUX_DATABASE_PATH`: caminho persistente para o arquivo SQLite, fora de diretórios temporários.

O backend agora recusa chamadas autenticadas em produção quando a URL JWKS HTTPS, o emissor, o público ou a lista explícita de origens não estão configurados com segurança. A validação JWT fornece identificação verificável para o backend, mas **não implementa tela de cadastro/login, recuperação de senha, emissão/renovação de tokens nem integração com provedor de identidade**. Não disponibilize o backend publicamente até conectar um emissor real e validar a configuração.

## Antes de hospedar publicamente

- Definir segredo forte no gerenciador de segredos do provedor; nunca usar o exemplo.
- Configurar HTTPS, domínio, CORS restrito e autenticação individual por usuário.
- Integrar provedor de identidade real, fluxo de login/renovação e gestão de usuários; validar isolamento em todos os novos recursos.
- Concluir revisão e testes reais do OAuth Meta já iniciado; implementar OAuth próprio para TikTok, Pinterest, YouTube e Shopee antes de habilitar essas conexões.
- Implementar upload, fila durável, agendador e confirmação da plataforma antes de habilitar publicação.
- Fazer revisão de segurança, privacidade/LGPD, backups e política de retenção.

**Não use este protótipo como servidor público de produção.** Não há login multiusuário, OAuth, cofre de tokens, upload de mídia ou worker de publicação nesta etapa.


## Cofre criptográfico de tokens (base pronta, ainda não conectado ao OAuth)

O módulo `app.token_vault` fornece criptografia autenticada Fernet para tokens de provedores externos:

- `encrypt_token(valor)` produz um envelope cifrado e autenticado; o mesmo valor gera envelopes diferentes.
- `decrypt_token(envelope)` rejeita dados adulterados ou cifrados com outra chave.
- A chave é lida de `XFLUX_TOKEN_ENCRYPTION_KEY`; sem chave válida, a operação falha fechada.
- O módulo não grava tokens, não registra valores em logs e não envia segredos ao frontend.

Gere uma chave fora do repositório e configure-a diretamente no gerenciador de segredos do ambiente hospedado:

    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

Defina o resultado como `XFLUX_TOKEN_ENCRYPTION_KEY` no ambiente do servidor. **Não** coloque o valor em arquivos versionados, no instalador, em issues ou no chat. Planeje backup seguro e rotação de chave antes de armazenar tokens reais.

Este módulo é somente o componente criptográfico: a tabela de contas ainda não persiste tokens cifrados, e OAuth, callback, rotação/revogação e publicação permanecem desativados até a implementação e testes de ponta a ponta.
