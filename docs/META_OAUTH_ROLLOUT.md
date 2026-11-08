# Plano de implementação OAuth — Meta (Instagram e Facebook)

## Objetivo e limites

Este documento orienta a próxima etapa de integração do XFLUX com as APIs oficiais da Meta. A existência deste plano e dos utilitários de `state` não significa que OAuth, conexão de contas ou publicação estejam ativos. Os endpoints permanecem desabilitados até que todos os controles abaixo estejam implementados e testados.

## Ordem obrigatória de implementação

1. **Identidade XFLUX:** autenticação individual verificável no servidor. O identificador do cliente deve vir de uma sessão/token validado pelo backend; nunca de um campo livre enviado pelo aplicativo.
2. **Isolamento de clientes:** todas as consultas e alterações de contas, tokens, mídias e tarefas devem ser filtradas pelo identificador autenticado do cliente. Testes devem provar que um cliente não acessa dados de outro.
3. **OAuth com proteção CSRF:** gerar `state` criptograficamente aleatório, armazenar somente seu hash, vincular à sessão e ao provedor, aplicar validade curta e consumo único. Validar também o callback e rejeitar state ausente, expirado, reutilizado ou de outra sessão.
4. **URLs e callbacks:** usar HTTPS em domínio controlado pelo XFLUX, lista explícita de URLs de retorno e validação estrita de `redirect_uri`. Não aceitar destinos fornecidos livremente pelo cliente.
5. **Troca de código:** trocar o código OAuth no servidor, validar erros e respostas, solicitar somente permissões necessárias e nunca expor App Secret ou tokens ao frontend.
6. **Cofre de tokens:** criptografar tokens em repouso com chave mantida fora do repositório (gerenciador de segredos/KMS), limitar acesso, registrar expiração e implementar rotação/revogação quando suportadas.
7. **Contas e desconexão:** persistir metadados por cliente, refletir estados reais e revogar/remover credenciais no servidor ao desconectar. Não marcar uma conta como conectada antes de validar a resposta do provedor.
8. **Publicação:** implementar upload e publicação como operações separadas, com validação de mídia, limites da plataforma, idempotência, estados pendentes/concluídos/falhos e tratamento de erros. Só confirmar publicação após confirmação da API.
9. **Revisão e testes:** testes automatizados com respostas simuladas, testes de isolamento, expiração e revogação, além de validação em aplicativo de desenvolvimento da Meta antes de habilitar produção.

## Instagram e Facebook

- Confirmar o produto/API oficial da Meta adequado ao tipo de conta e ao fluxo de publicação que será suportado.
- Para publicação no Instagram, orientar o cliente a usar uma conta profissional (Business ou Creator) e cumprir os requisitos de vínculo e permissões exigidos pelo fluxo oficial escolhido.
- Definir permissões mínimas para leitura de contas e publicação; não solicitar permissões amplas sem necessidade.
- Verificar no painel Meta for Developers os requisitos atuais de App Review, verificação empresarial e acesso avançado. Esses requisitos podem mudar e precisam ser confirmados antes do lançamento.
- Tratar Instagram e Facebook como conexões distintas na interface, mesmo quando a configuração da Meta permitir descobrir ativos relacionados.

## Configuração operacional necessária (não inserir no Git)

Quando o backend estiver pronto para receber credenciais, a equipe responsável deverá configurar no ambiente hospedado:
- identificador do aplicativo Meta;
- segredo do aplicativo em gerenciador de segredos;
- URLs de callback HTTPS cadastradas no painel Meta;
- chave de criptografia do cofre;
- domínio, origens permitidas e banco persistente.

**Nunca** colocar segredos, tokens, códigos OAuth ou credenciais em commits, issues, logs, screenshots ou mensagens de chat. O usuário final não deve enviar o App Secret ao XFLUX pelo aplicativo.

## Critérios para liberar a conexão

A conexão só pode ser ativada quando:
- autenticação individual e isolamento multiusuário estiverem aprovados;
- callback HTTPS e validação de `state` estiverem completos;
- tokens estiverem criptografados e não forem retornados ao frontend;
- desconexão e revogação estiverem implementadas;
- testes automatizados e teste real com aplicativo Meta de desenvolvimento passarem;
- interface apresentar estados reais, inclusive erro e expiração.

## Escopo posterior

Depois da Meta, avaliar YouTube, Pinterest, TikTok e Shopee Video separadamente, respeitando APIs oficiais, elegibilidade, revisão e limites de cada plataforma. Não presumir que uma integração aprovada para uma rede autoriza as demais.
