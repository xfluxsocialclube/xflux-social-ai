# XFLUX Social AI — Relatório de continuidade

**Objetivo deste arquivo:** permitir que outro assistente/desenvolvedor (incluindo Claude) continue o projeto exatamente do ponto atual, sem recomeçar do zero.

## 1. Identificação da cópia

- Repositório: https://github.com/xfluxsocialclube/xflux-social-ai
- Branch de trabalho: `fix/local-first-social-connections`
- Branch-base: `feat/simple-integration-center`
- Pull request: https://github.com/xfluxsocialclube/xflux-social-ai/pull/3
- Snapshot de código validado pelo instalador: commit `1cee8f4d071705d99b48a8bf64adc3dc7dc1eb99`
- A cópia ZIP baixada desta branch inclui este relatório de continuidade, que foi adicionado depois da compilação do instalador.

## 2. Visão correta do produto — decisão fundamental

O XFLUX deve ser um **aplicativo/robô individual**, instalado no computador ou dispositivo de cada cliente. Depois da instalação, o cliente usa o próprio XFLUX para organizar e publicar o conteúdo das próprias contas.

O XFLUX não deve funcionar como uma plataforma central que guarda vídeos de todos os clientes ou opera as publicações de todos eles.

Princípios obrigatórios:
- Cada cliente conecta suas próprias redes sociais por login/autorização oficial da plataforma.
- Vídeos, legendas, planilhas, calendário, fila e histórico ficam no dispositivo do cliente ou no armazenamento privado que ele escolher.
- O cliente pode escolher PC, celular, Google Drive ou servidor privado próprio, conforme suporte real implementado.
- O cliente define redes, quantidade de vídeos por dia e horários.
- O XFLUX organiza os vídeos, associa as legendas corretas e agenda/publica automaticamente onde a API oficial permitir.
- Não exigir que o cliente configure servidor, tokens ou chaves manualmente. Detalhes técnicos devem ficar nos bastidores.
- Não centralizar a biblioteca de mídia nem o controle operacional das contas dos clientes.
- Serviços externos mínimos só podem ser usados quando uma plataforma exigir callback, segredo de aplicação ou infraestrutura segura. Isso não deve transformar o XFLUX em hospedagem central de conteúdo.
- Não prometer publicação automática em redes cuja API, aprovação ou permissão ainda não esteja implementada.

## 3. Estado real do projeto — não confundir interface com função concluída

O projeto já tem interface React + TypeScript + Vite e um invólucro Tauri 2 para Windows. Preservar o design escuro roxo/azul, menus, gráficos e telas existentes. Não recriar o app do zero, não apagar funções e não substituir toda a pasta `src`.

### O que existe
- Navegação e telas para Visão geral, Guia do FLUX, Biblioteca de conteúdos, FLUX Caption Bank, Associar vídeos e legendas, Calculadora de conteúdo, Calendário editorial, Fila de publicações, FLUX Autopilot, Redes sociais, Shopee Video, Relatórios, Bom Dia com FLUX, Central de ajuda e Configurações.
- Tauri 2 e fluxo de empacotamento/instalador Windows.
- Armazenamento nativo parcial de arquivos de mídia em pasta escolhida pelo usuário via plugins Tauri; no navegador há fallback via File System Access API.
- Metadados da biblioteca ainda usam IndexedDB; preferências usam localStorage.
- Backend FastAPI/SQLite de protótipo e implementação inicial de OAuth da Meta.
- CI de backend e instalador Windows passou no run informado abaixo.

### O que NÃO está concluído
- A publicação real por API ainda não está implementada. Em `src/services/publishing/delivery.ts`, `API_PUBLISH_IMPLEMENTED = false` e o planejamento bloqueia o envio com `api-submit-not-implemented`.
- `src/services/publishing/adapters.ts` não publica: retorna indisponível ou não conectado.
- `src/services/publishing/queue.ts` mantém fila/alertas enquanto o app está aberto; não existe worker local durável que retome agendamentos após fechar/reiniciar.
- O estado “Publicado” depende de confirmação manual no fluxo assistido; não significa envio real automático.
- Conexão de redes ainda não é uma experiência final simples para o cliente. A tela `src/pages/Networks.tsx` depende de URL de backend e token.
- OAuth Meta é protótipo inicial, não pronto para produção: há dependência de JWT emitido externamente, credenciais Meta, callback HTTPS e chave Fernet. O backend não possui emissor de identidade/sessão.
- TikTok, Shopee Video, Pinterest e YouTube precisam de integrações próprias e validação das permissões/API. Não assumir que todas permitem publicação automática irrestrita.
- Tauri existe, mas a migração completa da biblioteca/metadados para armazenamento nativo local ainda não foi finalizada.

## 4. Auditoria técnica já realizada

Arquivos importantes examinados:
- `src/services/publishing/delivery.ts`: montagem de pacote por rede existe; envio real bloqueado.
- `src/services/publishing/queue.ts`: fila não envia à rede; exige fluxo assistido e confirmação manual.
- `src/services/publishing/adapters.ts`: adaptadores ainda não fazem publicação.
- `src/services/library/fsStore.ts`: seletor e operações de arquivos nativos Tauri parciais, com fallback navegador.
- `src/services/library/library.ts`: metadados IndexedDB, arquivos em pasta selecionada; importação calcula hash lendo arquivo e limite atual informado de 1 GB.
- `src/pages/Networks.tsx`: integração exige configuração de backend/token e não está simplificada para usuário leigo.
- `backend/`: protótipo FastAPI/SQLite com OAuth Meta inicial.

## 5. Histórico de alterações recentes nesta branch

PR #3 documenta e ajusta a arquitetura para refletir o modelo individual/local-first, sem fingir que as integrações já estão prontas. Entre as alterações:
- Textos em português, inglês e espanhol esclarecem que o serviço OAuth não é armazenamento central de vídeos.
- Documentação FASE 2, FASE 5, FASE 6, arquitetura, contrato do backend e README foram alinhados com o estado real.
- CI ajustada para executar também em branches `fix/**` e PRs com base `feat/**`.
- Não houve implementação de envio real para redes sociais nesta etapa.
- PR #3 permanece aberto/draft; não mesclar na `main` sem autorização e revisão.

## 6. Compilação Windows

- Workflow: `XFLUX Windows installer`
- Run: https://github.com/xfluxsocialclube/xflux-social-ai/actions/runs/42791869700
- Resultado verificado: `completed / success`
- Artifact: `XFLUX-Social-AI-Windows-Installer`
- Artifact ID: `13752935932`
- O instalador foi compilado a partir do commit `1cee8f4d071705d99b48a8bf64adc3dc7dc1eb99`.
- Atenção: sucesso da compilação não prova que OAuth de todas as redes ou publicação automática estejam concluídos.

## 7. Como continuar sem quebrar o projeto

1. Antes de editar, leia este arquivo, `README.md`, `docs/FASE2.md`, `docs/FASE5.md`, `docs/FASE6.md`, `docs/ARQUITETURA-FASE5.md` e `docs/BACKEND-CONTRATO.md`.
2. Confira a branch atual e o estado do PR #3. Não trabalhe diretamente na `main`.
3. Preserve todas as telas, menus, identidade visual e funções existentes.
4. Faça alterações pequenas, por etapa, com testes e build após cada etapa. Não substitua arquivos/pastas inteiros sem necessidade.
5. Prioridade técnica: terminar armazenamento local nativo e persistente no Tauri; depois implementar agendador local confiável que sobreviva a reinicializações; em seguida simplificar conexão OAuth por rede; só então implementar adaptadores reais de publicação, cada um baseado na API oficial e nas permissões efetivamente disponíveis.
6. Para cada rede, documentar requisitos, permissões, formatos, limites, aprovação e comportamento de erro. Se a API não permitir determinada publicação, informar claramente e manter alternativa assistida.
7. Nunca colocar client secrets privados dentro do aplicativo desktop/mobile. Usar OAuth/PKCE quando suportado e serviço mínimo seguro somente quando obrigatório pela plataforma.
8. Não mover a biblioteca dos clientes para um servidor central. Não inventar endpoints, tokens, APIs ou permissões.
9. Validar build, testes, instalador e funcionamento real antes de afirmar que uma fase está concluída.

## 8. Ambiente e comandos

Projeto: React + TypeScript + Vite, com Tauri 2 para desktop Windows.

Comandos já usados no projeto:
```bash
npm install
npm run build
npm run dev
```

Para tarefas Tauri, consultar os scripts existentes no `package.json` e a configuração atual antes de executar comandos adicionais.

## 9. Contexto do usuário e instruções de comunicação

O responsável pelo projeto é iniciante em programação e prefere instruções simples, diretas e passo a passo. Não fazer perguntas repetidas quando a decisão já estiver documentada. Explicar riscos antes de ações irreversíveis. Não confundir este projeto XFLUX com o aplicativo Android separado chamado Smart Care.

**Pedido central do responsável:** continuar o projeto existente e finalizá-lo, não começar um produto novo. Priorizar funcionamento real e segurança, sem inventar conclusão de integrações.
