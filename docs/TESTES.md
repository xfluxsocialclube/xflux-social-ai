# Relatório de testes — Fase 1

## Importante
O ambiente em que o projeto foi escrito **não tinha acesso à rede**, então `npm install`, `tsc` e `vite build` **não puderam ser executados**. O projeto **não foi compilado nem aberto no navegador** por quem o escreveu.

## O que foi feito
- Revisão manual do código (tipos, imports, chaves de tradução presentes nos três idiomas).
- Arquivos conferidos: 29 arquivos gerados.

## O que você deve rodar no seu computador
1. `npm install`
2. `npm run build` (executa `tsc --noEmit` e `vite build`). Se houver erro de tipos, envie a mensagem para correção antes da Fase 2.
3. `npm run dev` e verificar: navegação pelos 10 itens, troca de idioma (pt/en/es), ocultar/exibir o FLUX em Configurações, menu recolhível com a janela estreita.

## Fase 4
Roteiro manual sugerido no seu computador (Windows 10 + Chrome/Edge), após `npm install` e `npm run build`:
1. Importe um `.xlsx` e um `.csv` (inclusive salvo pelo Excel em português, com `;`) no FLUX Caption Bank; confira acentos e a tela de verificação.
2. Importe 10+ vídeos na Biblioteca com nomes que contenham o produto; sugira e aprove associações.
3. Marque 2 redes, defina o ciclo de 1 semana, gere e ative o calendário; confirme uma publicação e veja o uso do vídeo na Biblioteca.
4. Troque o idioma (pt/en/es) em todas as telas novas e reduza a janela para ver o layout de celular.
O relatório do que já foi testado de forma automatizada está em `docs/FASE4.md`.

## Fase 5
Roteiro manual no seu computador (Windows 10 + Chrome/Edge), após `npm install` e `npm run build`:
1. Redes sociais: confirme que as 6 redes estão "Não conectada" e que Conectar está desativado sem servidor; abra "Requisitos oficiais" de cada rede.
2. Fila de publicações: com um calendário ativo, abra uma publicação, copie os dados, use "Comecei a publicar", registre uma falha e depois confirme a publicação. Confira o histórico.
3. Troque o idioma (pt/en/es) nas telas novas.
Os testes automatizados e o que depende de credenciais reais estão em `docs/FASE5.md`.
