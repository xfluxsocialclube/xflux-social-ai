# Fase 3 — IA local com Ollama

## Instalar o Ollama (Windows 10)
1. Baixe e instale em https://ollama.com/download. Ele fica rodando em segundo plano em `http://localhost:11434`.
2. No Prompt de Comando, baixe um modelo. Você executa esses comandos; o XFLUX **não executa comandos** no seu computador.
3. No XFLUX: **Inteligência artificial > Configuração do Ollama**, clique em "Atualizar lista" e marque o modelo.

## Modelos sugeridos (pequenos; tamanhos aproximados)
| Uso | Comando | Tamanho |
|---|---|---|
| Texto (mais leve) | `ollama pull llama3.2:1b` | ≈1,3 GB |
| Texto | `ollama pull llama3.2:3b` | ≈2 GB |
| Texto | `ollama pull qwen2.5:3b` | ≈1,9 GB |
| Visão (leve) | `ollama pull moondream` | ≈1,7 GB |
| Visão (mais capaz) | `ollama pull gemma3:4b` | ≈3,3 GB |

Esses nomes e tamanhos vêm do conhecimento do autor e **não foram verificados neste ambiente**; confira em ollama.com/library. Nenhum modelo é presumido instalado.

## Limitações
- Com 8 GB de RAM e placa integrada, o Ollama roda na CPU: respostas lentas, principalmente com imagens. Feche outros programas pesados.
- Modelo de **texto** não enxerga imagens. Se o modelo escolhido não for de visão, a aba Análise recusa a execução e explica o motivo.
- Modelos pequenos erram e podem inventar. Os prompts proíbem inventar preços/descontos/benefícios, mas **sempre revise** antes de publicar.
- Vídeo: extrai de 1 a 6 quadros (padrão 3), reduzidos a 768 px; o vídeo inteiro não é lido para a memória. Limites: imagens até 50 MB, vídeos até 2 GB.
- Limites de texto por plataforma (Instagram 2.200, Pinterest descrição 500, TikTok 2.200, YouTube Shorts descrição 5.000) são valores conhecidos do autor e podem mudar. Os da Shopee Video não foram confirmados.
- O contexto enviado ao modelo é limitado (`num_ctx` 4096 e as últimas 12 mensagens).
- Resultados da análise ainda **não são gravados** na biblioteca (pendente).
- Se o Ollama estiver em outro endereço que não seja local, o app avisa que textos e imagens serão enviados para lá.
- Se o navegador bloquear a conexão (CORS), defina a variável `OLLAMA_ORIGINS` no Windows com o endereço do app e reinicie o Ollama. O padrão já aceita `localhost`.

## Banco de dados
Versão do IndexedDB subiu para 2 (nova tabela `conversations`). Os dados da Fase 2 são preservados.

## Executar
```
npm install
npm run build
npm run dev
```

## Testes
**Não executados.** O ambiente de desenvolvimento não tinha rede: não foi possível rodar `npm install`, `npm run build`, o navegador nem o Ollama. Só foi feita checagem de tipos parcial com o `tsc` global, sem os pacotes React/Vite, e revisão manual. Teste manual sugerido: parar o Ollama e ver as mensagens de erro; conectar; escolher modelo; conversar, copiar, parar e abrir nova conversa; gerar legenda por plataforma; usar a aba Shopee; analisar uma imagem com modelo de visão e com modelo de texto (deve recusar); analisar um vídeo; importar arquivo direto e salvar na biblioteca; trocar de idioma.
