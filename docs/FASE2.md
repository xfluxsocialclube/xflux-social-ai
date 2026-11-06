# Fase 2 — Biblioteca de mídias e fundação local

## Arquitetura escolhida
O app é **web (Vite)**, não Tauri. Por isso:
- **Arquivos:** File System Access API (Chrome/Edge no Windows 10). O usuário escolhe uma pasta; o app cria `XFLUX-Biblioteca/ANO/MÊS/` e copia os arquivos para lá.
- **Dados:** IndexedDB (`src/services/db.ts`) com metadados, categorias, hashes, histórico e usos. Arquivos inteiros **não** vão para o banco; só a miniatura reduzida (até 240 px).
- Ao migrar para Tauri 2 + SQLite, basta trocar `db.ts` e `fsStore.ts`; as regras ficam em `library.ts`.

## Limitações (importantes)
1. O navegador **pede autorização da pasta de novo toda vez que o app é aberto** (botão "Autorizar acesso"). Não há acesso permanente ao disco numa app web.
2. Funciona apenas em Chrome/Edge. Firefox/Safari mostram aviso.
3. Limpar os dados do navegador apaga a lista (não os arquivos da pasta).
4. Arquivos acima de **1 GB** são rejeitados (o hash lê o arquivo na memória; 8 GB de RAM).
5. Se um arquivo for apagado fora do app, a pré-visualização avisa "arquivo não encontrado".
6. O painel "Visão geral" ainda mostra números de **exemplo** (rotulados); ligar aos dados reais fica para uma fase seguinte.

## Pendente
IA real, publicação (que alimentará `recordUsage`), agendamentos, backup/exportação da lista, reimportar pasta existente.

## Testes
Não executados: o ambiente de desenvolvimento não tinha rede (sem `npm install`). Teste manual sugerido: escolher pasta; importar várias imagens/vídeos; importar o mesmo arquivo de novo (deve contar como duplicado); criar categoria e atribuir; pesquisar/filtrar; abrir pré-visualização; excluir com confirmação; fechar e reabrir o app (dados continuam, autorizar a pasta); trocar idioma; alterar dias de repetição em Configurações.
