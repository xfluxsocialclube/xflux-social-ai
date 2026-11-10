# Fase 6 — Conexões locais e experiência simples

## Decisão obrigatória do produto

O XFLUX é um aplicativo individual instalado no dispositivo do cliente. Não depende de servidor central da XFLUX, não exige conta XFLUX e não envia dados pessoais, arquivos, credenciais ou históricos para uma infraestrutura da empresa.

- Biblioteca, vídeos, legendas, planilhas, calendário, fila, configurações e histórico ficam no dispositivo ou no armazenamento particular escolhido pelo cliente.
- As autorizações das redes devem ser feitas diretamente com os provedores oficiais, usando OAuth/PKCE ou fluxo equivalente apropriado para aplicativo público quando suportado.
- Tokens e credenciais devem permanecer no dispositivo, protegidos pelo cofre do sistema operacional quando disponível.
- Nunca embutir client secrets privados em executáveis distribuídos.
- Se uma plataforma não permitir autorização/publicação segura sem um componente central, não contornar essa limitação nem armazenar dados do cliente: manter a publicação assistida e explicar a restrição.
- Não solicitar ao cliente URL de servidor, chave, token ou configuração técnica manual.

## Estado desta entrega

- A Central de integrações foi desacoplada do backend central: não consulta servidor XFLUX, não oferece configuração de URL e não tenta conectar contas por meio do serviço legado.
- Os adaptadores não afirmam que uma conta está conectada sem uma autorização local real.
- A rota de publicação permanece assistida; nenhum envio automático é simulado.
- Os detalhes oficiais de cada rede e a seleção das redes do plano continuam disponíveis.
- O código experimental `backend/` é legado e não deve ser implantado nem usado para processar dados de clientes.

## Trabalho ainda necessário antes de chamar o produto de final

1. Implementar OAuth local e seguro, com callback de loopback/URI de aplicativo e PKCE onde a plataforma suportar.
2. Guardar tokens no cofre nativo do Windows e implementar revogação/renovação.
3. Implementar cada adaptador de publicação exclusivamente com APIs oficiais e permissões aprovadas.
4. Construir agendador local durável, com retomada após reinício, bloqueio de duplicidade e logs locais.
5. Migrar metadados e configurações para persistência nativa local, preservando os dados existentes.
6. Testar cada fluxo com contas reais próprias e validar a confirmação devolvida pela plataforma.
7. Só liberar instalador final depois de build, testes e validação em Windows.

## Estado por rede

Instagram/Facebook, TikTok, Pinterest e YouTube exigem análise separada de OAuth, tipos de conta, permissões, formatos e regras de publicação. Shopee Video não deve ser considerada automatizável sem API oficial documentada e acesso autorizado. Nenhuma dessas redes pode ser marcada como pronta sem teste real.

## Regra de interface

A interface deve distinguir claramente conta não conectada, autorização local concluída e verificada, publicação assistida, publicação confirmada pela própria plataforma e publicação confirmada manualmente pelo usuário. Nunca exibir conectado ou publicado por simulação.