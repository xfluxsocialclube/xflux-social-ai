# Fase 6 — Conexões guiadas e experiência simples

## Objetivo

Permitir que uma pessoa sem conhecimento técnico encontre o estado real das integrações, siga o próximo passo indicado pelo XFLUX e autorize cada rede exclusivamente no site oficial. Preservar as fases 1–5, a versão 0.5.0 e os dados locais existentes.

## Entregas desta fase

- Navegação rápida Voltar, Início e Avançar no cabeçalho, usando a ordem real do menu.
- Central de integrações com estados provenientes do servidor; o aplicativo não inventa contas conectadas.
- Configuração de servidor escondida em área avançada, destinada a testes e administração.
- Endereço do serviço central pode ser injetado pelo mantenedor na compilação com `VITE_XFLUX_API_URL`. Assim, quando o serviço oficial estiver implantado, o usuário final não precisa digitar endereço de servidor.
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

## Configuração do mantenedor

1. Implantar o backend em um serviço HTTPS escolhido pelo mantenedor.
2. Configurar autenticação real multiusuário, domínio/callback e segredos fora do repositório.
3. Configurar o valor público `VITE_XFLUX_API_URL` como variável de repositório no GitHub Actions. Não é segredo.
4. Configurar credenciais e permissões nos painéis oficiais de cada plataforma, mantendo App Secret e tokens somente no servidor.
5. Gerar um novo instalador depois de validar o backend e os fluxos OAuth reais.

O aplicativo não deve pedir ao cliente final que configure hospedagem, domínio, chaves, tokens ou servidores. A configuração é responsabilidade de quem distribui o XFLUX.

## Regra de custo

A arquitetura deve priorizar hospedagem gratuita dentro dos limites reais do plano escolhido. Não afirmar que o serviço é gratuito ou permanente antes de selecionar o provedor, confirmar limites, persistência, disponibilidade, tráfego de mídia e política de suspensão. Se uma opção gratuita não suportar os requisitos com segurança, manter a publicação assistida em vez de transferir custos ou configuração técnica ao usuário.

## O que ainda impede declarar conexões reais concluídas

- Não há endpoint central de produção implantado nem URL oficial configurada.
- O backend atual ainda exige uma sessão XFLUX emitida por provedor de identidade; a experiência completa de cadastro/login multiusuário não está entregue.
- O OAuth Meta depende de App ID, App Secret, callback HTTPS, chave Fernet e análise/permissões da Meta.
- Instagram usa atualmente o fluxo Meta via Facebook Login e exige conta profissional ligada a Página; não equivale ao fluxo Instagram Login independente.
- TikTok e Shopee Video não têm fluxos OAuth implementados.
- Não há workers de publicação, upload remoto de mídia nem confirmação automática de publicação.

## Validação

O workflow do GitHub Actions compila o instalador Windows e executa os testes do backend. A aprovação do workflow não substitui testes reais com contas de teste das plataformas, servidor HTTPS implantado, login multiusuário, callback OAuth e uso em Windows 10/11.

**Critério de conclusão:** a interface guiada e a injeção do endereço central podem ser concluídas no código; conexões reais só podem ser declaradas prontas após a implantação e aprovação dos serviços externos listados acima.
