# Backend experimental legado — não implantar

Este diretório contém um protótipo antigo de backend FastAPI/SQLite com fluxo OAuth Meta.

**Decisão atual do produto:** o XFLUX distribuído deve funcionar sem servidor central da empresa. O cliente controla seus próprios arquivos, dados, credenciais e contas. O backend deste diretório não faz parte do aplicativo e não deve ser implantado, conectado ao instalador ou usado para armazenar tokens, contas ou quaisquer dados de clientes.

Não siga instruções antigas de deploy deste arquivo. Não configure domínio, banco central, segredos compartilhados ou callback central para colocar o XFLUX em funcionamento.

A conexão de cada rede deve ser implementada diretamente no aplicativo, usando fluxos oficiais adequados para clientes públicos (PKCE quando suportado) e armazenamento seguro local. Se uma plataforma exigir segredo confidencial/infraestrutura remota que não possa ser mantida sem centralizar dados do cliente, mantenha a publicação assistida até existir uma solução compatível com a decisão de privacidade.

O código legado permanece apenas para referência técnica durante a migração. Ele não representa uma funcionalidade disponível nem uma versão pronta para produção.