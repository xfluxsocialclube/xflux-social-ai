# XFLUX Social AI

> Seu conteúdo. Suas redes. Seu controle.

## O que é
Sistema de gerenciamento e automação de conteúdo para redes sociais. O projeto evoluiu por fases (1 a 5). Nenhuma integração real com redes sociais existe ainda: a publicação é **assistida** (o XFLUX planeja; o usuário publica e confirma). Os números do painel inicial continuam sendo **dados de exemplo**, identificados como tal.

## Tecnologias
React 18, TypeScript, Vite e CSS puro (tema escuro). Sem serviços pagos. Preparado para Tauri 2 (`base: './'`) e, em fases futuras, backend Python/FastAPI + SQLite.

## Instalação e execução
Requer Node.js 18 ou superior.

```bash
npm install
npm run dev        # desenvolvimento em http://localhost:5173
npm run build      # verifica tipos (tsc) e gera a versão de produção em dist/
npm run preview    # testa a versão de produção
```

## Estrutura
```
src/
  components/  componentes reutilizáveis (FluxMascot, StatCard, Notice, EmptyState...)
  pages/       páginas (Overview, Networks, Settings, ModulePage)
  layout/      Sidebar e Header
  styles/      global.css
  i18n/        pt.ts (base), en.ts, es.ts, I18nContext.tsx
  icons/       conjunto de ícones SVG
  config/      navegação
  data/        dados demonstrativos (demo.ts)
  services/    settings, storage (contrato futuro), networks
docs/          TESTES.md
```

## Funcionalidades implementadas (Fase 1)
- Menu lateral com as 10 seções pedidas e navegação funcional.
- Painel com indicadores, gráfico de desempenho, próximas publicações e status do sistema (dados de exemplo rotulados).
- Mascote FLUX original em SVG, com mensagem de boas-vindas, espaço para mensagens futuras e opção de ocultar/exibir (salva localmente).
- Internacionalização pt-BR (padrão), inglês e espanhol, com seletor funcional e preferência salva.
- Página de Redes sociais com módulos preparados (botões desativados e rotulados "Em breve").
- Configurações: idioma, mascote e lista de opções de armazenamento planejadas.
- Estados vazios, avisos de funcionalidade indisponível e layout responsivo (menu recolhível em telas estreitas).

## Pendente (próximas fases)
agendamentos, integrações reais (Facebook, Instagram, Pinterest, TikTok, YouTube Shorts, Shopee Video após validação oficial), relatórios reais, Bom Dia com FLUX, central de ajuda, armazenamento (local, Google Drive, OneDrive, servidor próprio), empacotamento Tauri 2, backend FastAPI e SQLite.

## Fase 2 — Biblioteca de mídias (implementada)
- Importação de várias imagens e vídeos, miniaturas, pré-visualização, nome/formato/tamanho/data, categorias, pesquisa, filtro por tipo e categoria, exclusão com confirmação e detecção de duplicados por hash SHA-256.
- Arquivos copiados para uma pasta do computador (`XFLUX-Biblioteca/ANO/MÊS/`), escolhida pelo usuário. Metadados, categorias, hashes e histórico ficam em IndexedDB (persistem após fechar o app).
- Histórico de utilização e lógica de proteção contra repetição (dias configuráveis em Configurações), prontos para os módulos de publicação usarem. Ainda não há publicações, então esse histórico começa vazio.
- Contrato de IA em `src/services/ai.ts`; nenhum modelo conectado.
- Detalhes, limitações e testes: `docs/FASE2.md`.

## Fase 3 — IA local com Ollama (implementada)
- Menu **Inteligência artificial** com 5 abas: Assistente FLUX (conversas salvas), Gerador de conteúdo, Shopee, Análise de mídia e Configuração do Ollama.
- Conexão real com o Ollama (`http://localhost:11434`, editável): teste de conexão, lista de modelos, escolha do modelo, detecção de suporte a imagens, respostas em streaming com botão Parar.
- Análise de imagens e de vídeos (apenas alguns quadros reduzidos, nunca o vídeo inteiro) da Biblioteca ou de um arquivo importado na hora, sem cadastrá-lo.
- Requer o Ollama e ao menos um modelo instalado. Instruções, modelos e limitações: `docs/FASE3.md`.

## Fase 4 — Central de marketing automática (implementada)
- **FLUX Caption Bank**: importação de legendas por XLSX/CSV com mapeamento de colunas, validação, duplicadas, edição, filtros, cópia, controle de uso e exportação.
- **Associar vídeos e legendas** com sugestões que mostram o motivo e tela de revisão; **Calculadora de conteúdo**; **Calendário editorial** (semana, mês, próximas); **FLUX Autopilot** (ciclos, alertas e renovação); adaptadores por rede (todos "não conectado", nada simulado); **Guia do FLUX** em 8 etapas e Central de ajuda.
- Não exige IA nem Ollama (a IA local da Fase 3 continua disponível como opção). Nenhuma dependência nova.
- Publicação automática (inclusive com o computador desligado) **não existe**: exigirá backend e agendador em nuvem.
- Funcionalidades, regras, pendências, dependências e relatório de testes: `docs/FASE4.md`.

## Fase 5 — Integrações e publicação (estrutura e publicação assistida)
- **Central de integrações** (menu Redes sociais): servidor do XFLUX, estado de cada conta (conectada, perto de expirar, expirada, revogada, com erro), requisitos oficiais de cada rede com fontes, e o que falta para publicar automaticamente.
- **Fila de publicações** com painel de status, histórico de tentativas, tratamento de erros e nova tentativa; **publicação assistida** integrada ao calendário.
- Nenhuma rede é publicada automaticamente ainda e nenhuma aparece como conectada sem um servidor do XFLUX confirmar. "Publicada" = confirmada pelo usuário.
- Arquitetura do servidor e do agendador em nuvem (futuro), contrato da API e pesquisa oficial de cada plataforma: `docs/ARQUITETURA-FASE5.md`, `docs/BACKEND-CONTRATO.md`, `docs/openapi-backend.yaml`, `docs/INTEGRACOES-OFICIAIS.md`.
- Funcionalidades, dependências externas, pendências e relatório de testes: `docs/FASE5.md`. Sem banco novo e sem dependências novas.

