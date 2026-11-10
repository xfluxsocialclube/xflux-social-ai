# Fase 6 — Conexões guiadas e experiência simples

> **Diretriz de arquitetura atualizada:** o XFLUX é um aplicativo individual, local-first. Biblioteca, vídeos, legendas, agendamentos e histórico pertencem ao usuário e permanecem no armazenamento escolhido por ele. O backend descrito neste documento é somente um componente técnico de autorização/integração quando exigido pelas APIs; não é um servidor central de vídeos, biblioteca ou armazenamento dos clientes.

## Objetivo

Permitir que uma pessoa sem conhecimento técnico encontre o estado real das integrações, siga o próximo passo indicado pelo XFLUX e autorize cada rede exclusivamente no site oficial. Preservar as fases 1–5, a versão 0.5.0 e os dados locais existentes.

## Entregas desta fase

- Navegação rápida Voltar, Início e Avançar no cabeçalho, usando a ordem real do menu.
- Central de integrações com estados provenientes do servidor; o aplicativo não inventa contas conectadas.
- Configuração técnica escondida em área avançada, destinada a testes e administração; ela não representa armazenamento central de conteúdo.
- Quando uma plataforma exigir troca segura de credenciais no backend, o endereço desse serviço técnico poderá ser injetado pelo mantenedor na compilação com `VITE_XFLUX_API_URL`. O usuário final não configura endereço, tokens ou chaves. Esse serviço não deve receber nem armazenar a biblioteca de vídeos/legendas do usuário.
- Após voltar do navegador de autorização, o aplicativo atualiza o estado das contas automaticamente ao recuperar o foco.
- A tela de autorização informa o domínio oficial de destino; senhas e tokens das redes não são solicitados no aplicativo.
- Publicação continua assistida quando não existe integração real e validada. Nenhuma rede é marcada como conectada ou publicada por simulação.

## Redes e limites reais

| Rede | Situação implementada nesta base |
|---|---|
| Instagram | Backend possui fluxo Meta por Facebook Login para contas profissionais vinculadas a Páginas; não é Instagram Login independente. |
| Facebook | Backend possui fluxo Meta para Páginas. |
| TikTok | Não há OAuth implementado nesta base. A publicação permanece assistida e sujeita às regras de auditoria/consentimento. |
| Shopee Video | Não há OAuth/publicação implementados nesta base; permanece assistida até confirmação de API e acesso oficial de parceiro. |
| Pinterest e YouTube | Catálogo e fluxo assistido preservados; OAuth e publicação reais ainda dependem de configuração e implementação próprias. |

## Separação obrigatória: dados locais e serviço de autorização

- **Dados do usuário:** vídeos, imagens, planilhas, legendas, links, calendário, fila e histórico ficam no computador/celular, Google Drive, OneDrive ou servidor particular escolhido pelo usuário.
- **Serviço técnico opcional por necessidade de plataforma:** pode intermediar OAuth, proteger segredos de aplicativos e executar callbacks que não podem ficar com segurança no cliente.
- **Proibição:** não enviar bibliotecas inteiras ao backend, não criar repositório central de vídeos e não exigir hospedagem de armazenamento do XFLUX.
- A necessidade de um serviço técnico deve ser avaliada por plataforma. Não assumir que todas as redes exigem o mesmo fluxo.

## Configuração do mantenedor

1. Somente para as integrações que realmente exigirem backend, implantar o serviço técnico de autorização em HTTPS escolhido pelo mantenedor.
2. Configurar autenticação real multiusuário, domínio/callback e segredos fora do repositório.
3. Configurar o valor público `VITE_XFLUX_API_URL` como variável de repositório no GitHub Actions. Não é segredo.
4. Configurar credenciais e permissões nos painéis oficiais de cada plataforma, mantendo App Secret e tokens somente no servidor.
5. Gerar um novo instalador depois de validar o backend e os fluxos OAuth reais.

O aplicativo não deve pedir ao cliente final que configure hospedagem, domínio, chaves, tokens ou servidores. A configuração é responsabilidade de quem distribui o XFLUX.

## Regra de custo

A arquitetura deve priorizar hospedagem gratuita dentro dos limites reais do plano escolhido. Não afirmar que o serviço é gratuito ou permanente antes de selecionar o provedor, confirmar limites, persistência, disponibilidade, tráfego de mídia e política de suspensão. Se uma opção gratuita não suportar os requisitos com segurança, manter a publicação assistida em vez de transferir custos ou configuração técnica ao usuário.

## O que ainda impede declarar conexões reais concluídas

- O serviço técnico de autorização usado pelo fluxo Meta ainda não está implantado/configurado em produção; isso não implica criar servidor de armazenamento.
- O backend atual ainda exige uma sessão XFLUX emitida por provedor de identidade; a experiência completa de cadastro/login multiusuário não está entregue.
- O OAuth Meta depende de App ID, App Secret, callback HTTPS, chave Fernet e análise/permissões da Meta.
- Instagram usa atualmente o fluxo Meta via Facebook Login e exige conta profissional ligada a Página; não equivale ao fluxo Instagram Login independente.
- TikTok e Shopee Video não têm fluxos OAuth implementados.
- Não há workers de publicação, upload remoto de mídia nem confirmação automática de publicação.

## Validação

O workflow do GitHub Actions compila o instalador Windows e executa os testes do backend. A aprovação do workflow não substitui testes reais com contas de teste das plataformas, serviço seguro de autorização implantado quando exigido, sessão/identidade necessária ao OAuth, callback e uso em Windows 10/11.

**Critério de conclusão:** a interface guiada e a injeção do endereço central podem ser concluídas no código; conexões reais só podem ser declaradas prontas após a implantação e aprovação dos serviços externos listados acima.
