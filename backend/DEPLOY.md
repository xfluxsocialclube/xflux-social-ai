# Implantação do serviço seguro XFLUX

Este serviço é usado somente para autenticar cada instalação e concluir os fluxos OAuth que exigem segredo de aplicativo e callback HTTPS. **Não recebe nem armazena vídeos, legendas, planilhas ou calendário editorial.** A biblioteca do cliente continua no dispositivo/armazenamento escolhido.

## O que precisa existir antes da conexão real

1. Um domínio HTTPS e hospedagem para o backend.
2. Um segredo aleatório exclusivo para assinar sessões de instalação (XFLUX_DEVICE_SESSION_SECRET).
3. Para Instagram/Facebook, um aplicativo Meta registrado, App ID, App Secret e callback HTTPS cadastrado.
4. Chave Fernet exclusiva para criptografar tokens das redes no banco privado do serviço.
5. Persistência protegida para o SQLite e limite de requisições no proxy.

O XFLUX não exige cadastro/login central. Na primeira conexão, o próprio aplicativo cria uma chave aleatória de instalação, guarda-a localmente e troca essa chave por uma sessão curta. O servidor guarda apenas o hash dessa chave como identificador do dispositivo. Cada instalação possui suas próprias contas conectadas. A chave de instalação não deve ser compartilhada; apagar os dados locais pode exigir reconectar as redes.

## Variáveis do servidor

Copie .env.example para .env fora do repositório e configure:

- XFLUX_ENV=production
- XFLUX_JWT_ISSUER e XFLUX_JWT_AUDIENCE: identificam as sessões XFLUX.
- XFLUX_DEVICE_SESSION_SECRET: segredo aleatório com pelo menos 32 caracteres, somente no servidor.
- XFLUX_ALLOWED_ORIGINS: origens HTTPS explícitas do aplicativo; não use *.
- XFLUX_DATABASE_PATH=/data/xflux.sqlite3: banco persistente.
- XFLUX_TOKEN_ENCRYPTION_KEY: chave Fernet gerada no servidor.
- META_APP_ID, META_APP_SECRET, META_OAUTH_REDIRECT_URI e META_GRAPH_VERSION: dados do aplicativo Meta.

Gere segredos com gerador criptográfico. Nunca coloque App Secret, chave Fernet ou segredo de sessão no frontend, instalador, GitHub ou computador do cliente.

## Executar com Docker

Na pasta backend:

```sh
docker compose up --build -d
docker compose ps
docker compose logs --tail=100 xflux-backend
```

O Compose publica a porta 8000 somente em 127.0.0.1. Configure Caddy/Nginx ou serviço equivalente com TLS na frente e encaminhe para essa porta. Aplique rate limit no endpoint público POST /v1/device/session (por IP e janela de tempo) no proxy/edge. Não exponha a porta interna diretamente.

## Configuração do aplicativo Meta

Cadastre exatamente o callback HTTPS configurado em META_OAUTH_REDIRECT_URI no painel Meta. Ative os produtos/permissões exigidos para Facebook Pages e Instagram profissional. O Instagram precisa ser conta profissional e estar vinculada a uma Página do Facebook no fluxo atual. Solicite análise/permissões avançadas da Meta quando aplicável.

O botão Conectar só será habilitado quando o endpoint de saúde confirmar que as credenciais e a chave de criptografia estão configuradas. Uma resposta de saúde positiva não substitui o teste real com uma conta autorizada.

## Segurança e limites atuais

- Sessões de instalação duram 24 horas e são renovadas automaticamente pelo aplicativo.
- Tokens de redes sociais ficam criptografados no banco do serviço; nunca são enviados à interface.
- Cada instalação tem um identificador independente; o serviço não recebe a biblioteca de mídia.
- Proteja o perfil local do sistema operacional: a chave de instalação fica no armazenamento local do aplicativo e deve ser tratada como credencial.
- Faça backup do volume SQLite e teste restauração.
- Aplique firewall, TLS, rate limit, monitoramento e atualização regular.
- A publicação automática ainda não está implementada. OAuth conectado não significa que o XFLUX já envia publicações.
- Nesta versão, somente Instagram/Facebook possuem fluxo OAuth inicial no backend. TikTok, Pinterest e YouTube ainda exigem implementações próprias e aprovação/credenciais de cada plataforma. Shopee Video permanece sem API oficial de publicação confirmada.
