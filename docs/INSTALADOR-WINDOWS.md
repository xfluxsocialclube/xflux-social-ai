# Instalador do XFLUX no Windows

## Objetivo

Entregar o XFLUX como aplicativo desktop para Windows 10/11, sem exigir que a pessoa usuária instale Node.js, Rust, npm ou copie comandos.

## Como o instalador é produzido

O workflow `.github/workflows/ci.yml` usa um runner Windows do GitHub Actions para:

1. instalar as dependências do projeto;
2. gerar os ícones a partir de `src-tauri/icons/xflux-icon.svg`;
3. compilar a interface React/Vite;
4. empacotar o aplicativo com Tauri 2 e NSIS;
5. publicar o instalador `.exe` em Releases.

A compilação de Windows é feita no Windows, evitando depender de cross-compilação.

## Instalação para a pessoa usuária

Quando uma compilação for aprovada, o arquivo de instalação estará em:

`https://github.com/xfluxsocialclube/xflux-social-ai/releases`

Baixe o instalador Windows `.exe`, abra-o e siga as telas. O modo padrão instala somente para o usuário atual e não exige privilégios administrativos.

## Biblioteca de mídia

No primeiro uso, o XFLUX pede que a pessoa escolha uma pasta para guardar os vídeos e imagens. No aplicativo desktop, o seletor nativo do Windows concede acesso à pasta escolhida. Se o acesso precisar ser renovado depois de reiniciar o aplicativo, basta escolher novamente a mesma pasta pelo botão de reconexão.

## Segurança e assinatura

Os instaladores de desenvolvimento podem não ter assinatura digital. Até que seja contratado e configurado um certificado de assinatura de código, o Windows SmartScreen pode exibir um aviso de editor desconhecido. O download deve ser feito somente pela página oficial de Releases deste repositório.

## Limites funcionais que continuam explícitos

O instalador não cria por si só um servidor de publicação nem aprova aplicativos nas redes sociais. O produto atual oferece planejamento e publicação assistida. Publicação automática depende do servidor do XFLUX, credenciais OAuth e aprovações oficiais das plataformas, conforme `docs/FASE5.md`.
