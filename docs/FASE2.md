# Fase 2 — Biblioteca de mídias e fundação local

## Estado real da arquitetura (atualizado em 10/11/2026)

A implementação original da biblioteca foi criada para navegador (Vite/React) e usa:
- **Arquivos:** File System Access API (Chrome/Edge no Windows). O usuário escolhe uma pasta; o app cria `XFLUX-Biblioteca/ANO/MÊS/` e copia os arquivos para lá.
- **Dados:** IndexedDB (`src/services/db.ts`) com metadados, categorias, hashes, histórico, legendas, associações, planos e publicações.
- **Miniaturas:** somente miniaturas reduzidas ficam no banco; os arquivos originais permanecem na pasta escolhida.

**Atualização importante:** o repositório agora também contém um invólucro desktop Tauri 2 e configuração para gerar instalador Windows NSIS. Isso, por si só, **não migrou** o banco IndexedDB nem o acesso a arquivos para APIs nativas. O código Rust atual registra plugins de diálogo e sistema de arquivos, mas a camada de biblioteca ainda precisa ser adaptada e testada para usá-los no aplicativo instalado.

Portanto, a descrição histórica abaixo continua válida para a implementação web original, mas não deve ser interpretada como prova de que a persistência nativa do Tauri já está concluída.

## Limitações da implementação atual

1. No modo navegador, o acesso à pasta depende da autorização File System Access API e pode exigir nova autorização ao reabrir.
2. A implementação web depende de Chrome/Edge; outros navegadores podem não oferecer os mesmos recursos.
3. Limpar os dados do navegador pode apagar os metadados do IndexedDB, embora os arquivos originais na pasta não sejam apagados por isso.
4. Arquivos acima de 1 GB são rejeitados pela implementação atual de hash/processamento em memória; isso deve ser revisto antes de prometer suporte a bibliotecas grandes.
5. Se um arquivo for apagado ou movido fora do app, a referência pode ficar inválida.
6. O painel "Visão geral" ainda contém indicadores de exemplo identificados como tais.

## Próxima etapa técnica obrigatória — migração local-first para Tauri

Antes de implementar publicação automática, concluir e testar:
- Uma camada de armazenamento com adaptadores: navegador (compatibilidade) e Tauri (versão desktop).
- Persistência nativa dos metadados em SQLite ou solução local equivalente, com migração segura dos dados existentes do IndexedDB.
- Acesso à pasta escolhida pelo usuário usando os recursos Tauri e permissões mínimas; não pedir acesso amplo ao computador.
- Importação, leitura, pré-visualização e organização de mídia sem transferir os arquivos para um servidor XFLUX.
- Backup/exportação e recuperação em caso de atualização, sem apagar a biblioteca existente.
- Testes de instalação, atualização, reinicialização e recuperação no Windows 10/11.

A migração deve preservar os dados existentes e a interface aprovada. Não substituir a biblioteca inteira nem alterar o visual como parte dessa etapa.

## Testes históricos

Os testes manuais da implementação web incluem: escolher pasta; importar várias imagens/vídeos; importar o mesmo arquivo novamente; criar categoria e atribuir; pesquisar/filtrar; abrir pré-visualização; excluir com confirmação; fechar e reabrir; trocar idioma; alterar dias de repetição.

**Ainda não comprovado:** migração IndexedDB → armazenamento nativo Tauri, execução de tarefas em segundo plano, nem funcionamento da biblioteca nativa em diferentes computadores Windows.
