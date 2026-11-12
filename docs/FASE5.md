# Fase 5 — Integrações e publicação (estrutura + publicação assistida)

## Estado real e princípio de produto

Esta fase entrega planejamento e publicação assistida. **Nenhuma rede publica automaticamente nesta versão.** O XFLUX está sendo desenvolvido como aplicativo individual/local-first: biblioteca, vídeos, legendas, planilhas, calendário, fila e histórico pertencem ao cliente e ficam no dispositivo ou no armazenamento que ele escolher.

O instalador Tauri 2 existe, mas a biblioteca ainda usa IndexedDB e APIs web. A migração para armazenamento nativo e execução em segundo plano local ainda está pendente. O backend é um protótipo de integração OAuth Meta, não uma plataforma de conteúdo pronta para produção.

## O que o usuário vê hoje
- Central de integrações com estados reais vindos do serviço técnico, quando configurado.
- Fila com status, filtros e histórico de tentativas.
- Publicação assistida: pacote de texto por rede, abrir o fluxo oficial e confirmação manual pelo usuário.
- Alertas para publicações no horário ou com falha.

## Regras de honestidade
- Não inventar contas conectadas: a conta só aparece conectada após autorização real validada.
- Não marcar publicação como concluída sem confirmação verificável; hoje a confirmação é manual do usuário.
- Não pedir senhas de redes sociais dentro do XFLUX.
- Não colocar segredos de aplicativos ou tokens no frontend.
- Não transferir a biblioteca do cliente para um armazenamento central como requisito do produto.
- Não ativar `API_PUBLISH_IMPLEMENTED` até existir envio real, testes de integração e confirmação da plataforma.

## O que o código atual faz
`src/services/publishing/queue.ts` calcula estados e registra tentativas; não envia conteúdo. `src/services/publishing/delivery.ts` mantém `API_PUBLISH_IMPLEMENTED = false` e a rota assistida. `src/services/backend/client.ts` conversa com um serviço técnico configurado no build ou em configuração administrativa. O serviço atual exige JWT de sessão; o fluxo Meta inicial está no backend, mas não é utilizável em produção sem identidade, credenciais, callback HTTPS e revisão de segurança.

## Pendências técnicas, na ordem correta
1. **Concluir o aplicativo local Windows:** migrar IndexedDB para SQLite/local storage Tauri com migração sem perda; migrar acesso a arquivos para permissões nativas mínimas; manter compatibilidade com os dados existentes.
2. **Agendador local confiável:** fila durável, execução no horário, retomada após reinicialização, logs e alertas. Deixar claro que o computador precisa estar ligado, conectado e com o XFLUX executando. Não prometer execução com o PC desligado.
3. **Conexões oficiais por rede:** implementar OAuth/PKCE no cliente quando a plataforma permitir; usar serviço técnico mínimo somente quando callback/segredo confidencial exigir. O serviço não recebe a biblioteca inteira.
4. **Primeira publicação real:** escolher uma API oficialmente disponível, validar permissões e formato, testar com conta própria e obter confirmação da plataforma.
5. **Demais redes:** integrar individualmente, respeitando auditoria, revisão e limitações. Shopee Video permanece assistida até haver API pública/parceiro comprovado.
6. **Empacotamento e distribuição:** testar instalação, atualização, backup/restauração e funcionamento no Windows 10/11; publicar instalador somente após CI verde e teste manual.

## Dependências externas que não podem ser simuladas
- Aplicativos OAuth e credenciais criados nos painéis oficiais.
- Aprovação/revisão de permissões por plataforma, quando exigida.
- Domínio HTTPS e serviço de callback apenas para as redes que exigirem backend.
- Contas de teste reais e consentimento do proprietário.
Essas aprovações e credenciais não podem ser fabricadas pelo código ou pelo mantenedor do repositório.

## Não é requisito geral do produto
- Hospedagem central de vídeos.
- Upload de toda a biblioteca para o XFLUX.
- Login XFLUX obrigatório para usar funções locais.
- Agendador em nuvem para o funcionamento normal no PC.
- IA paga ou assinatura de um provedor de IA.

## Testes e estado de validação
Os testes históricos descritos nas fases anteriores não equivalem a testes reais de OAuth/publicação. No momento desta atualização, não há comprovação de build do instalador Windows nesta revisão, migração Tauri/SQLite, execução em background, conexão real com redes ou publicação automática. A CI deve ser executada e os resultados registrados antes de chamar a versão de pronta.
