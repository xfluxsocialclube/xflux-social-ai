# Validação e testes do XFLUX Social AI

## Estado da compilação Windows

A compilação mais recente registrada neste relatório foi executada pelo GitHub Actions:

- Workflow: **XFLUX Windows installer**
- Execução: **#30**
- Resultado: **sucesso**
- Commit: `4e1575c1e0bfb9beb1c282f2c871c4db66b0ce41`
- Data: **7 de novembro de 2026**
- Pacote: instalador NSIS para Windows (Tauri 2)

Essa execução instalou as dependências, compilou o frontend e empacotou o aplicativo Windows. Portanto, não é necessário pedir ao usuário final que execute `npm install`, `npm run build` ou comandos de desenvolvimento para instalar a versão publicada.

**O que o sucesso da compilação comprova:** o código passou pela etapa de compilação/empacotamento no ambiente Windows do GitHub Actions e o instalador foi gerado.

**O que não comprova:** funcionamento em todos os computadores, permissões de pastas de cada usuário, comportamento com bibliotecas grandes, login OAuth real ou publicação em redes sociais. Isso exige testes de execução e, no caso das redes, credenciais e aprovações oficiais.

## Testes documentados por fase

- [Fase 4 — planejamento local](./FASE4.md): descreve os testes automatizados de lógica, importação/exportação de legendas, calendário, associações, ciclo e idiomas, além das limitações de ambiente.
- [Fase 5 — integrações e publicação assistida](./FASE5.md): descreve os testes de fila, estados de conexão, contrato do backend e publicação assistida. Os testes de servidor citados nessa fase usam um servidor falso de teste, não contas reais.

Os relatórios das fases registram testes realizados durante o desenvolvimento. Eles não devem ser confundidos com testes de integração real das plataformas.

## Roteiro de validação final no Windows

Quando a versão for considerada pronta para uso final, a validação deverá cobrir:

1. Instalação e abertura no Windows 10/11.
2. Fechar e reabrir o aplicativo, verificando se configurações, legendas, calendário e histórico continuam presentes.
3. Selecionar uma pasta da Biblioteca e importar vídeos/imagens; fechar e reabrir para verificar a leitura dos arquivos.
4. Importar arquivos XLSX e CSV, conferir acentos, colunas, duplicatas e exportação.
5. Criar associações, montar um calendário e ativar um ciclo do Autopilot.
6. Conferir a fila e a publicação assistida, sem tratar uma confirmação manual como publicação automática.
7. Testar os idiomas pt-BR, inglês e espanhol e o redimensionamento da janela.

## Limites atuais do produto

- O XFLUX ainda **não publica automaticamente** nas redes sociais.
- As seis redes aparecem na central de integrações, mas nenhuma conexão real deve ser presumida sem servidor e autenticação válidos.
- O backend hospedado, OAuth real, cofre de tokens, armazenamento remoto, agendador e workers ainda são etapas futuras.
- A instalação gerada pelo CI não substitui a validação em um computador Windows de usuário final.

## Para desenvolvimento

Os comandos de desenvolvimento estão no README. Eles são destinados a quem altera o código-fonte, não ao usuário que apenas instala o aplicativo.
