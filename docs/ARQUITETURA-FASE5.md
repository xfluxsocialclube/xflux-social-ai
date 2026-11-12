# Arquitetura local-first do XFLUX Social AI

## Decisão de produto

O XFLUX é um aplicativo/robô individual instalado no dispositivo do cliente. O cliente é dono e operador do próprio ambiente. Não existe dependência de servidor central XFLUX para iniciar, organizar conteúdo, manter agenda ou usar a biblioteca.

## Onde ficam os dados

- Vídeos e imagens: pasta local ou armazenamento privado escolhido pelo cliente.
- Metadados, legendas, planos, fila, histórico e configurações: banco local do aplicativo.
- Tokens OAuth: armazenamento seguro local do sistema operacional, quando disponível.
- Backups e sincronização: somente destinos escolhidos e controlados pelo cliente.

O aplicativo não envia esses dados para a empresa XFLUX.

## Estado técnico atual

- Interface: React + TypeScript + Vite.
- Empacotamento Windows: Tauri 2 / WebView2.
- Biblioteca de mídia: pasta escolhida pelo cliente; operações nativas Tauri disponíveis.
- Metadados e planejamento: IndexedDB/localStorage nesta versão; migração nativa completa ainda pendente.
- Publicação: assistida; `API_PUBLISH_IMPLEMENTED = false`.
- A Central de integrações foi desacoplada do backend central.
- O código experimental em `backend/` é legado, não é usado pelo aplicativo e não deve ser implantado nem receber dados de clientes.

## Arquitetura de destino

```
Aplicativo XFLUX instalado no dispositivo do cliente
  ├─ Arquivos locais / armazenamento particular escolhido
  ├─ Banco local: metadados, legendas, planos, fila e histórico
  ├─ Agendador local com retomada após reinício
  ├─ Cofre de credenciais do sistema operacional
  └─ Adaptadores OAuth e publicação por rede
          └─ Autorização direta com a plataforma oficial
```

A execução automática local exige dispositivo ligado, conexão com a internet e o aplicativo/serviço local autorizado em execução. Não prometer publicação com o computador desligado.

## Segurança

- Usar OAuth oficial e PKCE quando suportado por clientes públicos.
- Nunca coletar senhas das redes sociais.
- Nunca embutir client secrets privados em aplicativos distribuídos.
- Guardar tokens no cofre seguro do sistema operacional; não usar localStorage para tokens.
- Aplicar state anti-CSRF, redirect URI exato, escopos mínimos, expiração e revogação.
- Não transmitir vídeos, legendas, planilhas ou histórico para servidores da XFLUX.
- Se a plataforma exigir segredo confidencial ou serviço remoto para publicar, manter o fluxo assistido em vez de criar dependência central ou guardar dados do cliente.
- Nunca marcar como publicada sem confirmação oficial da API ou confirmação manual claramente identificada.

## Plano de conclusão

1. Migrar metadados e configurações para persistência nativa local com migração segura dos dados existentes.
2. Implementar cofre de credenciais nativo e OAuth local por plataforma.
3. Implementar agendador local durável, lock contra duplicidade, idempotência e retomada após reinício.
4. Implementar primeiro um adaptador de publicação oficial compatível e validá-lo com conta de teste.
5. Repetir a validação rede por rede; documentar restrições e manter alternativa assistida quando necessário.
6. Validar build, testes, instalador e funcionamento em Windows 10/11.

## Critério de conclusão

O XFLUX só pode ser chamado de final quando os dados e credenciais estiverem sob controle local do cliente, a agenda local for confiável, cada integração anunciada tiver OAuth real e cada publicação automática tiver envio e confirmação reais. Até lá, a interface deve informar claramente o que está assistido ou pendente.