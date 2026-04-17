# Self-host do Gravador

Rode o Gravador totalmente na sua infraestrutura, sem depender de APIs externas.

## Requisitos

- Linux/macOS/Windows com Docker 24+
- 8 CPUs, 16 GB RAM (32 GB recomendado se for rodar LLM local grande)
- 50 GB de disco para modelos e áudios
- GPU NVIDIA **opcional** (acelera faster-whisper e Ollama)

## Passos

1. Clone o repositório e copie o `.env`:
   ```bash
   git clone https://github.com/fsalamoni/gravador.git && cd gravador
   cp .env.example .env
   ```
2. Gere segredos do Supabase:
   ```bash
   # JWT_SECRET: aleatório, >=32 chars. ANON_KEY / SERVICE_ROLE_KEY: gerar com supabase-cli ou script
   openssl rand -base64 32   # JWT_SECRET
   ```
3. Edite `infra/docker/.env` com `ANON_KEY`, `SERVICE_ROLE_KEY`, `POSTGRES_PASSWORD`, `JWT_SECRET` e `APP_URL`.
4. Suba tudo:
   ```bash
   pnpm selfhost:up
   ```
5. Acesse `http://localhost:3000`, crie sua conta, e comece a gravar.
6. (Opcional) baixe modelos locais:
   ```bash
   docker exec -it gravador-ollama-1 ollama pull llama3.1:8b
   docker exec -it gravador-ollama-1 ollama pull nomic-embed-text
   ```

## IA 100% local

No modo self-host o padrão é:
- **Transcrição**: `faster-whisper` (modelo `large-v3`, int8) via contêiner `whisper`
- **Chat / resumo / mapa mental**: Ollama (`llama3.1:8b` por padrão)
- **Embeddings**: Ollama (`nomic-embed-text`)

Se preferir qualidade de nuvem, configure BYOK nas configurações do workspace e aponte para
OpenAI/Anthropic/Groq/Google.

## Atualizando

```bash
git pull
docker compose -f infra/docker/docker-compose.yml pull
pnpm selfhost:up
```

As migrations SQL em `supabase/migrations/` são aplicadas automaticamente no primeiro boot. Para
re-rodar após mudanças manualmente: `docker compose exec db psql -U postgres -f /docker-entrypoint-initdb.d/migrations/XXXX.sql`.
