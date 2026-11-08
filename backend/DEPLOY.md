# Implantação do backend XFLUX com Docker

Este procedimento prepara o serviço para hospedagem. **Não cria credenciais, não registra o aplicativo na Meta e não habilita publicação automática.** Faça a implantação somente depois de configurar um provedor de identidade real e os segredos em um gerenciador seguro.

## Arquivos

- `Dockerfile`: imagem Python 3.12, dependências do backend, usuário sem privilégios e health check.
- `compose.yaml`: serviço com reinício automático e volume persistente para SQLite.
- `.env.example`: modelo de variáveis; copie para `.env` no servidor e preencha sem commitar o arquivo.

## Preparação

1. Instale Docker Engine e o plugin Docker Compose no servidor.
2. Copie a pasta `backend` para o servidor.
3. Na pasta `backend`, copie `.env.example` para `.env`.
4. Configure no provedor de identidade:
   - `XFLUX_JWT_ISSUER`: emissor exato dos tokens.
   - `XFLUX_JWT_AUDIENCE`: público destinado à API.
   - `XFLUX_JWKS_URL`: URL HTTPS do JWKS, com chaves RS256.
5. Configure `XFLUX_ALLOWED_ORIGINS` com as origens reais e HTTPS do aplicativo. Não use curingas.
6. Gere uma chave Fernet com `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` e salve em `XFLUX_TOKEN_ENCRYPTION_KEY` no gerenciador de segredos.
7. Para OAuth Meta, configure também `META_APP_ID`, `META_APP_SECRET` e `META_OAUTH_REDIRECT_URI` com os dados do aplicativo Meta e callback HTTPS cadastrado. Nunca coloque esses valores no frontend ou no repositório.

## Iniciar e conferir

Na pasta `backend`:

```sh
docker compose up --build -d
docker compose ps
docker compose logs --tail=100 xflux-backend
```

O Compose publica a porta 8000 somente em `127.0.0.1`. Coloque um proxy reverso HTTPS (por exemplo, Caddy ou Nginx) à frente e encaminhe para `127.0.0.1:8000`. Não exponha a porta diretamente à internet.

Health check local:

```sh
curl http://127.0.0.1:8000/v1/health
```

A resposta de saúde descreve capacidades efetivamente habilitadas pela configuração. Ela não substitui um teste OAuth real.

## Persistência e segurança

- O banco SQLite fica no volume Docker `xflux-data`, montado em `/data`.
- Faça backups consistentes do volume e teste a restauração.
- Restrinja acesso ao servidor, ao arquivo `.env` e ao gerenciador de segredos.
- Configure TLS, firewall, atualização de imagem, logs e monitoramento.
- Antes de produção, valide login, isolamento entre usuários, callback OAuth, expiração/revogação de tokens e plano de recuperação.
- Não use o segredo HS256 de desenvolvimento em produção. Produção exige JWKS HTTPS e RS256.
- Não apague nem recrie o volume durante atualizações.

## O que ainda não é fornecido por este pacote

- Conta/tenant e interface de cadastro/login do usuário.
- Hospedagem, domínio, certificado TLS e provedor de identidade.
- Credenciais e aprovação de aplicativos nas plataformas.
- Upload remoto de mídia, worker/agendador de publicação e publicação automática.
- Adaptadores de publicação testados com contas reais.

O container é uma base reproduzível para hospedar o backend existente, não uma declaração de que essas funções externas já estão prontas.
