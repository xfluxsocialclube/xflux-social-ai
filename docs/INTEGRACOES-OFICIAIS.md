# Integrações oficiais — pesquisa de 05/11/2026

Resumo do que cada plataforma oferece **oficialmente** para publicar vídeo, com as fontes consultadas.
Regra do projeto: o que não foi confirmado em fonte oficial está marcado como **não confirmado** ou **não documentado**.
Documentações mudam: **reconfirme cada item antes de implementar** o envio por API (o catálogo no código tem a data da pesquisa).

Legenda das fontes: **[oficial]** documentação do próprio fornecedor lida diretamente; **[terceiros]** guias, SDKs ou blogs (apoio, não prova).

| Rede | API oficial de publicação de vídeo | Agendamento pela própria API | Publicar sem o usuário presente |
|---|---|---|---|
| Instagram | Sim, para contas profissionais (Content Publishing API) | Não documentado | Possível, com servidor |
| Facebook | Sim, Reels em **Páginas** | Não documentado para Reels (terceiros divergem) | Possível, com servidor |
| TikTok | Sim (Direct Post e Upload), com auditoria | Não documentado | **Restrito pelas diretrizes** (consentimento por publicação) |
| Shopee Video | **Não confirmada** | Não documentado | Indisponível |
| Pinterest | Sim (v5), acesso Standard exige análise | Não documentado | Possível, com servidor |
| YouTube Shorts | Sim (`videos.insert`) | **Sim** (`status.publishAt`) | Possível, com servidor |

## Instagram — [oficial] Instagram Platform, Content Publishing (atualizada em 30/06/2026)
https://developers.facebook.com/documentation/instagram-platform/content-publishing
- Publica em **contas profissionais** (Business/Creator): imagens, vídeos/Reels, carrosséis.
- Fluxo em duas etapas (criar contêiner de mídia, depois publicar). Reels: tipo `REELS`.
- A mídia deve estar em **servidor público** no momento da tentativa, ou ser enviada por **upload retomável** (somente para apps com Login do Facebook para Empresas).
- Limite informado: **100 publicações por API em 24 h por conta** (versões anteriores diziam 50: reconfirmar).
- Permissões citadas: `instagram_business_content_publish` (Login do Instagram) ou `instagram_content_publish` (Login do Facebook); níveis de acesso Padrão e Avançado; contas ligadas a Página podem exigir a Autorização de Publicação de Página (PPA).
- Agendamento: a documentação não descreve agendamento pela API e recomenda que o app controle o limite ao agendar publicações futuras.
- Existe campo para declarar conteúdo gerado por IA (o XFLUX não gera conteúdo; o usuário decide).

## Facebook — [oficial] Video API, Reels Publishing (atualizada em 30/07/2026)
https://developers.facebook.com/documentation/video-api/guides/reels-publishing
- Reels **somente em Páginas** do Facebook. Fluxo em 3 passos (iniciar sessão de upload, enviar o vídeo, publicar).
- Vídeo: `.mp4`, 9:16, recomendado 1080×1920 (mínimo 540×960), 24–60 fps, **3 a 90 s**.
- Limite informado: **30 Reels por API em 24 h**.
- Permissões: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`; token de Página de quem pode criar conteúdo.
- Exige mostrar ao usuário a divulgação de como os Reels serão usados e o público (Páginas: apenas Público).
- Agendamento de Reels: **a página oficial não descreve**; duas fontes [terceiros] divergem → o XFLUX deve agendar por conta própria até confirmação.
- Acesso Avançado/análise do app: citados como necessários para operar contas de terceiros em fontes [terceiros]; confirmar no painel de apps da Meta.

## TikTok — [oficial] Content Posting API (Direct Post, Aug/2026) e Content Sharing Guidelines
https://developers.tiktok.com/doc/content-posting-api-reference-direct-post · https://developers.tiktok.com/doc/content-sharing-guidelines
- **Direct Post** (escopo `video.publish`): publica no perfil. **Upload** (escopo `video.upload`): envia à caixa de entrada do app; o criador conclui a publicação.
- **Aplicativos sem auditoria só publicam em modo privado** (erro oficial `unaudited_client_can_only_post_to_private_accounts`). A auditoria libera a visibilidade pública.
- Diretrizes de uso, a cada publicação: consultar as opções do criador, mostrar o nome da conta, o usuário **escolher manualmente a privacidade (sem valor padrão)** e **consentir antes do envio**.
- As diretrizes listam como **não aceitável** uma ferramenta que apenas ajuda a subir conteúdo em contas que você ou sua equipe administra. **Isso precisa ser avaliado na auditoria**: pode inviabilizar a publicação totalmente automática para o caso de afiliados que administram as próprias contas. Por isso o catálogo marca "restrito pelas regras da plataforma".
- Limites: 6 requisições/min por token; teto diário de posts por criador (em torno de 15, compartilhado).
- Agendamento pela API: não documentado.

## Shopee Video — [oficial indireto] Shopee Open Platform + [terceiros]
https://open.shopee.com/developer-guide (portal; as páginas de API exigem navegação no portal)
- Há APIs oficiais de **Media Space** para enviar vídeos à mídia da loja (uso em **anúncios de produtos**), duração de 10 a 60 s.
- Há um módulo **Video (`v2.video`)** com autorização em nível de usuário e tipo de app "Shopee Video Management". Nas fontes consultadas ([terceiros] que citam a documentação) aparecem listar vídeos, consultar detalhes e editar informações (inclusive rótulo de conteúdo gerado por IA, anunciado em set/2026).
- **Não foi possível comprovar** uma API pública para **publicar** no feed do Shopee Video. ERPs parceiros (ex.: BigSeller) anunciam publicar e agendar, o que sugere acesso de parceiro, **mas não está confirmado**.
- Decisão: **publicação assistida** até haver documentação oficial + conta de parceiro. Próximo passo prático: abrir o portal Shopee Open Platform com uma conta de parceiro e conferir os endpoints do módulo Video.

## Pinterest — [oficial] Access tiers + [terceiros]
https://developers.pinterest.com/docs/key-concepts/access-tiers/
- API v5 cria **Pins de vídeo**: registrar a mídia, enviar o arquivo e criar o Pin. Todo Pin pertence a um **quadro**.
- **Trial**: Pins ficam visíveis só para o criador e só a conta dona do app autoriza. **Standard**: exige análise do app.
- Escopos citados por [terceiros]: `boards:read`, `boards:write`, `pins:read`, `pins:write` (conferir na referência).
- Agendamento pela API: não encontrado.

## YouTube — [oficial] YouTube Data API, videos.insert (página atualizada em 03/11/2026)
https://developers.google.com/youtube/data/reference/rest/v3/videos/insert
- Escopo `youtube.upload`. Não há campo de Shorts na referência: o YouTube classifica o vídeo.
- **Cota: 100 envios por dia por projeto** (1 unidade no grupo "Video Uploads"). Guias de 2025/2026 de terceiros ainda citam 1.600 unidades; a página oficial atual prevalece.
- **Agendamento**: `status.publishAt`.
- A página oficial atual afirma que vídeos enviados de projetos **não verificados não ficam restritos ao modo privado**. Versões antigas e [terceiros] diziam o contrário. **Reconfirmar antes do lançamento.**
- Campo de divulgação de conteúdo sintético existe (`status.containsSyntheticMedia`).
- Valem os Termos e as Políticas para Desenvolvedores da API; auditoria de conformidade pode ser exigida para ampliar cota.

## Conclusões que guiaram a arquitetura
1. Publicar de verdade exige **aplicativos aprovados em cada plataforma** (análise/auditoria) e **tokens guardados em servidor**. Não é possível no navegador sozinho.
2. Nenhuma API pesquisada oferece agendamento confiável documentado, exceto YouTube: o **agendador é do XFLUX** (servidor), respeitando os limites diários de cada rede.
3. **TikTok** e **Shopee Video** devem permanecer **assistidos** por regra/ausência de API. Instagram, Facebook, Pinterest e YouTube são candidatos à automação.
4. Várias redes pedem arquivo em endereço público ou upload próprio: para publicar com o computador desligado, o vídeo precisa estar em **armazenamento na nuvem** (ver ARQUITETURA-FASE5.md).
