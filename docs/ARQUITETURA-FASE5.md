# Arquitetura da Fase 5 — revisão local-first

## Decisão de produto

O XFLUX é um aplicativo individual de marketing e publicação instalado no dispositivo do cliente. O cliente controla suas contas, arquivos, legendas, agenda e histórico. Não é uma plataforma SaaS de armazenamento de conteúdo nem um serviço central que opera as postagens dos clientes.

## Estado técnico atual
- Interface: React + TypeScript + Vite.
- Empacotamento Windows: Tauri 2 / WebView2 está configurado.
- Persistência atual da biblioteca e do planejamento: IndexedDB v3.
- Arquivos: implementação atual usa File System Access API no navegador.
- Preferências: localStorage.
- Publicação: assistida; `API_PUBLISH_IMPLEMENTED = false`.
- Backend: protótipo FastAPI/SQLite com JWT e fluxo inicial OAuth Meta; não está pronto para produção e não deve ser requisito para funções locais.

**Importante:** a presença do Tauri e do instalador não significa que o banco IndexedDB, o acesso à pasta ou o agendador já tenham sido migrados para APIs nativas.

## Arquitetura de destino

```
Aplicativo instalado no dispositivo do cliente
  ├─ Biblioteca local / pasta escolhida / armazenamento particular
  ├─ SQLite local: metadados, legendas, planos, fila e histórico
  ├─ Agendador local e worker com retomada após reinício
  ├─ Cofre de credenciais do sistema operacional
  └─ Adaptadores OAuth e publicação por rede
          │
          ├─ OAuth direto no navegador oficial quando suportado
          └─ Serviço técnico mínimo apenas quando exigido pela API
                  └─ callback/segredo confidencial; nunca biblioteca inteira
```

A execução local exige dispositivo ligado, internet e aplicativo/serviço local em execução. Execução com o computador desligado é uma opção remota futura, não uma promessa do produto local-first.

## Regras de segurança
- Usar OAuth oficial; nunca coletar senha de rede social.
- Preferir Authorization Code + PKCE em clientes públicos quando a plataforma suportar.
- Nunca embutir client secret em aplicativo desktop ou mobile.
- Guardar refresh tokens no cofre seguro do sistema operacional quando disponível.
- Aplicar escopos mínimos, state anti-CSRF, redirect URI exato, expiração, revogação e logs sem segredos.
- Não enviar vídeos/legendas/planilhas para backend central por padrão.
- Se uma rede exigir URL pública de mídia ou upload remoto, explicar a exigência e usar somente o fluxo mínimo permitido; não sincronizar toda a biblioteca.
- Nunca marcar como publicada sem confirmação retornada pela API ou confirmação manual claramente identificada.

## Plano obrigatório antes de publicação automática
1. Implementar adaptador Tauri para banco e arquivos; escrever migração IndexedDB v3 → SQLite com backup e rollback.
2. Testar importação, miniaturas, hashes, legendas, associações, planos e fila após migração.
3. Implementar agendador local durável, lock contra duplicidade, idempotência, retomada após reinício e notificações.
4. Criar interface de adaptadores de redes e OAuth seguro por plataforma.
5. Escolher uma rede com API oficial de publicação compatível e implementar primeiro somente essa rede.
6. Testar com conta própria, vídeos de teste, limites, falhas, expiração e confirmação da plataforma.
7. Repetir por rede, sem assumir que uma integração serve para todas.
8. Fazer CI, instalador assinado quando possível, testes Windows 10/11, atualização e recuperação.

## Limites conhecidos por rede
A disponibilidade de publicação depende dos termos, permissões e revisões atuais de cada plataforma. TikTok pode impor auditoria, consentimento e restrições de publicação; Shopee Video não deve ser considerada automatizável sem API/parceria oficial confirmada. Instagram/Facebook exigem contas elegíveis e permissões Meta. Pinterest e YouTube exigem projetos OAuth e permissões próprias. Nenhuma rede deve ser anunciada como pronta antes de teste real.

## Critério de conclusão
O XFLUX só pode ser declarado pronto para uso autônomo quando: os dados forem locais e persistentes; o agendador local executar e recuperar tarefas; cada conexão tiver OAuth real; cada publicação tiver envio e confirmação reais; o instalador tiver sido testado em Windows; e backup/recuperação forem validados. Até lá, a interface deve mostrar honestamente os recursos assistidos e pendentes.
