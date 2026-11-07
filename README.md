# XFLUX Social AI

> Seu conteúdo. Suas redes. Seu controle.

## O que é
Sistema de gerenciamento e automação de conteúdo para redes sociais. O projeto evoluiu por fases (1 a 5). Nenhuma integração real com redes sociais existe ainda: a publicação é **assistida** (o XFLUX planeja; o usuário publica e confirma). Os números do painel inicial continuam sendo **dados de exemplo**, identificados como tal.

## Tecnologias
React 18, TypeScript, Vite e CSS puro (tema escuro). Sem serviços pagos. Empacotamento desktop com Tauri 2; a interface usa WebView2 no Windows. Backend Python/FastAPI + SQLite permanece uma etapa futura.

## Instalação no Windows

A versão desktop é empacotada com **Tauri 2** e gera um instalador NSIS `.exe` para Windows 10/11. O instalador é criado pelo GitHub Actions em um runner Windows; o usuário final não precisa instalar Node.js, Rust, npm ou copiar código.

- Os instaladores de compilação ficam em **GitHub → Releases**.
- O instalador usa o modo por usuário (não exige administrador por padrão).
- O WebView2 é usado para exibir a interface; versões atuais do Windows 10 normalmente já o incluem.
- Enquanto o aplicativo não tiver certificado de assinatura de código, o Windows pode exibir o aviso do SmartScreen. Isso não significa, por si só, que o arquivo esteja infectado; confira sempre se o download veio da página oficial do repositório.

### Desenvolvimento

Requer Node.js 18 ou superior e Rust com os componentes de compilação do Windows.

```bash
npm install
npm run dev          # desenvolvimento web em http://localhost:5173
npm run build        # verifica tipos e gera dist/
npm run tauri:build  # empacota o aplicativo desktop no sistema de desenvolvimento
```

A compilação de distribuição e o instalador oficial são feitos no workflow `.github/workflows/ci.yml`.

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

## Situação real do produto
O aplicativo já contém biblioteca, banco de legendas, associações, calculadora, calendário, Autopilot, fila e publicação assistida. O **instalador desktop para Windows já foi compilado e validado pelo GitHub Actions** (Tauri 2 + NSIS); isso confirma a geração do instalador, mas não substitui testes de uso em diferentes computadores Windows. Ainda não é um serviço de publicação automática: faltam o servidor hospedado, autenticação de usuários, cofre de tokens, armazenamento remoto de mídia, agendador/filas e integrações aprovadas pelas plataformas. Google Drive, OneDrive, login Google e relatórios reais continuam pendentes.

## Fase 2 — Biblioteca de mídias (implementada)
- Importação de várias imagens e vídeos, miniaturas, pré-visualização, nome/formato/tamanho/data, categorias, pesquisa, filtro por tipo e categoria, exclusão com confirmação e detecção de duplicados por hash SHA-256.
- Arquivos copiados para uma pasta do computador (`XFLUX-Biblioteca/ANO/MÊS/`), escolhida pelo usuário. Metadados, categorias, hashes e histórico ficam em IndexedDB (persistem após fechar o app).
- Histórico de utilização e lógica de proteção contra repetição (dias configuráveis em Configurações), prontos para os módulos de publicação usarem. Ainda não há publicações, então esse histórico começa vazio.
- Contrato de IA em `src/services/ai.ts`; nenhum modelo conectado.
- Detalhes, limitações e testes: `docs/FASE2.md`.

## Fase 3 — IA local (opcional e fora do fluxo principal)
- A implementação histórica com Ollama foi preservada no repositório para referência, mas não é carregada nem exibida no menu do aplicativo.
- O XFLUX não exige Ollama, modelo local, GPU ou processamento de IA para funcionar.

## Fase 4 — Central de marketing automática (implementada)
- **FLUX Caption Bank**: importação de legendas por XLSX/CSV com mapeamento de colunas, validação, duplicadas, edição, filtros, cópia, controle de uso e exportação.
- **Associar vídeos e legendas** com sugestões que mostram o motivo e tela de revisão; **Calculadora de conteúdo**; **Calendário editorial** (semana, mês, próximas); **FLUX Autopilot** (ciclos, alertas e renovação); adaptadores por rede (todos "não conectado", nada simulado); **Guia do FLUX** em 8 etapas e Central de ajuda.
- Não exige IA nem Ollama. A geração de legendas pode ser feita em qualquer ferramenta externa; o XFLUX importa XLSX/CSV. Nenhuma dependência nova.
- Publicação automática (inclusive com o computador desligado) **não existe**: exigirá backend e agendador em nuvem.
- Funcionalidades, regras, pendências, dependências e relatório de testes: `docs/FASE4.md`.

## Fase 5 — Integrações e publicação (estrutura e publicação assistida)
- **Central de integrações** (menu Redes sociais): servidor do XFLUX, estado de cada conta (conectada, perto de expirar, expirada, revogada, com erro), requisitos oficiais de cada rede com fontes, e o que falta para publicar automaticamente.
- **Fila de publicações** com painel de status, histórico de tentativas, tratamento de erros e nova tentativa; **publicação assistida** integrada ao calendário.
- Nenhuma rede é publicada automaticamente ainda e nenhuma aparece como conectada sem um servidor do XFLUX confirmar. "Publicada" = confirmada pelo usuário.
- Arquitetura do servidor e do agendador em nuvem (futuro), contrato da API e pesquisa oficial de cada plataforma: `docs/ARQUITETURA-FASE5.md`, `docs/BACKEND-CONTRATO.md`, `docs/openapi-backend.yaml`, `docs/INTEGRACOES-OFICIAIS.md`.
- Funcionalidades, dependências externas, pendências e relatório de testes: `docs/FASE5.md`. Sem banco novo e sem dependências novas.


## Validação contínua
O GitHub Actions executa a instalação das dependências e a compilação de produção a cada alteração na branch principal. O artefato `dist` é guardado em cada execução bem-sucedida.
