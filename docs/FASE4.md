# Fase 4 — Central de marketing automática (planejamento local)

Esta fase transforma o XFLUX em um planejador de conteúdo que **não exige IA, Ollama nem computador potente**.
A identidade visual, o painel, o menu, o mascote FLUX, o IndexedDB e as Fases 1–3 foram preservados.

## Como usar (resumo para o usuário)
1. **Biblioteca**: importe vídeos/imagens (dê nomes com o produto ou o número da legenda, ex.: `03-tenis-corrida.mp4`).
2. **FLUX Caption Bank**: importe a planilha de legendas (.xlsx ou .csv). Pode ser criada em ChatGPT, Claude, Gemini ou à mão. Há um pedido pronto para copiar na tela vazia e na Central de ajuda.
3. **Associar vídeos e legendas**: "Sugerir associações", revise o motivo de cada uma e aprove.
4. **Redes sociais**: marque onde pretende publicar.
5. **Calendário editorial → Configurar**: dias, horários, regras de repetição. **FLUX Autopilot**: escolha o ciclo.
6. **Gerar calendário**, revisar e **Ativar planejamento**.
7. Na hora de publicar: abra a publicação, copie a legenda, publique na rede e clique em **Marcar como publicada**.

O **Guia do FLUX** acompanha essas 8 etapas (progresso salvo, pode pausar) e está sempre na Central de ajuda.

## O que foi implementado
| Módulo | O que faz |
|---|---|
| FLUX Caption Bank | Importa XLSX/CSV (leitor próprio, sem biblioteca), confirma o mapeamento de colunas, valida linhas sem legenda, acha repetidas (no arquivo e no banco), edita, pesquisa/filtra por produto/categoria/rede/situação, copia (legenda + CTA + hashtags), controla uso e reutilização, remove repetidas, exporta CSV e XLSX, baixa planilha modelo. Processa em blocos de 200 linhas e grava em uma única transação. |
| Associar vídeos e legendas | Sugere por critérios objetivos (ID no nome do arquivo, produto, categoria, palavras-chave) e **mostra o motivo**. Aprovar, alterar legenda, escolher outro vídeo, deixar pendente, remover, associar manualmente, aprovar todas. Sem correspondência = sem sugestão. |
| Calculadora de conteúdo | Semanas × dias × publicações; separa **pacote** de **publicação**; legenda compartilhada ou por rede; reaproveitamento de vídeos/legendas; mostra necessário, disponível, faltante, economia e quantas semanas o estoque cobre. |
| Calendário editorial | Configuração (redes, dias, horários, repetição, distribuição), visões semana/mês/próximas, pendências com o motivo, atrasadas, ativar/regerar/descartar. Evita repetir vídeo antes do prazo e não reutiliza legenda. |
| FLUX Autopilot | Ciclos de 1–4 semanas ou personalizado (até 120 dias), progresso, restantes, faltantes, situação por rede, próxima renovação, alerta N dias antes do fim (padrão 3, configurável), opções de fim de ciclo (continuar, renovar, alterar, pausar, encerrar) e histórico. |
| Redes / adaptadores | `services/publishing/adapters.ts`: um adaptador por rede, na ordem Instagram, Facebook, TikTok, Shopee Video, Pinterest, YouTube Shorts. Todos retornam "não conectado" e nada é simulado. |
| Guia do FLUX + Ajuda | 8 etapas concluídas por dados reais; Central de ajuda com perguntas frequentes. |
| i18n | pt-BR, inglês e espanhol (635 chaves iguais nos três idiomas). |

## Regras importantes
- Só entra em calendário **ativo** conteúdo com associação **aprovada**, salvo se o usuário marcar "Permitir publicar vídeos sem associação aprovada" (fica sinalizado).
- "Publicada" só existe quando o **usuário confirma**. O XFLUX não publica sozinho.
- Ao marcar como publicada, o uso do vídeo (proteção de repetição da Biblioteca) e da legenda é registrado.
- Legenda de rede específica nunca vai para outra rede. Vídeo usado não volta antes de N dias (padrão = Configurações). Legenda: 0 dias = nunca reutilizar.
- Ciclo "Continuar": encerra o atual e cria o próximo; só ativa sozinho se houver conteúdo para todos os horários; senão fica como rascunho com os pendentes.

## Dados (IndexedDB v3)
Armazenamentos novos: `captions`, `pairings`, `plans`, `posts` (planos, com ids, prontos para virar tabelas SQLite). Os existentes (`media`, `categories`, `history`, `usage`, `conversations`, `kv`) não foram alterados. A atualização v2→v3 foi testada com dados antigos. Configurações novas ficam no armazenamento de configurações já existente (`plan.config`, `plan.networks`, `plan.flags`, `guide`, `captionReuseDays`, `alertDays`).

## IA local (Fase 3)
Os arquivos foram mantidos. Nenhum módulo novo importa a IA; o menu passou a chamá-la de "IA local (opcional)" e ela fica depois do fluxo principal.

## Dependências
**Nenhuma dependência nova.** XLSX é lido e gerado por código próprio (`src/services/captions/zip.ts`, `xlsx.ts`) usando `DecompressionStream` do navegador (Chrome/Edge atuais). Justificativa: menos peso, nada a instalar, nenhuma biblioteca externa para manter.

## Limitações e pendências (não implementado)
- **Publicação automática**: não existe. Exigirá backend, autenticação (OAuth), agendador em nuvem e validação da API oficial de cada rede. Nada disso está simulado e não há custos fictícios.
- Integrações reais com Instagram, Facebook, TikTok, Pinterest e YouTube Shorts; Shopee Video segue assistida até haver API oficial comprovada.
- Planilhas antigas `.xls`, `.ods` e `.xlsx` com senha não são lidas (a tela orienta salvar como .xlsx/.csv). Datas em células são lidas como número.
- Se um vídeo for removido da Biblioteca, as associações e publicações que o usam ficam marcadas como "arquivo removido"; é preciso trocar manualmente.
- Os dados ficam no navegador: exporte as legendas de vez em quando. Backup completo, armazenamento em nuvem e migração para SQLite/Tauri continuam pendentes.
- Relatórios reais, Bom Dia com FLUX e Shopee Video seguem como módulos "em breve".
- Pré-visualização do vídeo dentro do calendário (hoje mostra miniatura e nome).

## Testes realizados (e como)
O ambiente de desenvolvimento **não tinha internet**, então **`npm install` e `npm run build` (Vite) NÃO foram executados aqui**. Rode `npm install && npm run build` no seu computador e me envie qualquer erro.

Foi executado:
- `tsc --strict` (TypeScript 6.0.3) em todo o `src/`, com tipos substitutos do React (os oficiais não estavam disponíveis): **0 erros**.
- Pacote de navegador com esbuild + **React 19** (o projeto usa React 18.3) e testes de ponta a ponta no **Chromium** (45 verificações, 0 falhas, nenhum erro de console): migração v2→v3 preservando dados, importação CSV (`;`, Windows-1252, aspas, quebras de linha) e XLSX, mensagens de validação, duplicadas, arquivo inválido, busca/filtro/edição/uso/exportação, associações, calculadora, redes, ciclo, calendário, ativação, confirmação de publicação, alerta de fim de ciclo, "continuar", guia, idiomas (pt/en/es) e celular de 390 px.
- Leitor/gerador de XLSX validado com arquivos do **openpyxl** e **xlsxwriter**, e o XLSX exportado foi aberto com **openpyxl** e **LibreOffice** sem avisos.
- Testes unitários em Node da calculadora, do motor de distribuição (36 pacotes = 3 × 6 × 2; 108 publicações em 3 redes; sem repetição de vídeo/legenda; legenda por rede; sem associação; histórico) e das sugestões de associação: 28 verificações.
- Chaves de tradução: 635 em cada idioma, sem vazias e com os mesmos marcadores `{n}`.

**Não testado:** Windows 10 real, Edge, Tauri, importação de planilhas muito grandes (o limite é 10 MB e 20 000 linhas; 500 linhas foram medidas), leitura de arquivos reais da pasta da Biblioteca (os arquivos de teste foram gravados só no banco) e uso por pessoas reais.
