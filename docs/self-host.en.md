# Self-host Gravador

Run Gravador entirely on your own infrastructure with zero external API calls.

## Requirements

- Linux/macOS/Windows with Docker 24+
- 8 CPUs, 16 GB RAM (32 GB recommended for larger local LLMs)
- 50 GB disk for models + recordings
- NVIDIA GPU **optional** (accelerates faster-whisper and Ollama)

## Steps

1. Clone the repo and copy the env:
   ```bash
   git clone https://github.com/fsalamoni/gravador.git && cd gravador
   cp .env.example .env
   ```
2. Generate Supabase secrets:
   ```bash
   openssl rand -base64 32   # JWT_SECRET
   ```
3. Edit `infra/docker/.env` with `ANON_KEY`, `SERVICE_ROLE_KEY`, `POSTGRES_PASSWORD`, `JWT_SECRET`
   and `APP_URL`.
4. Bring it up:
   ```bash
   pnpm selfhost:up
   ```
5. Open `http://localhost:3000`, create an account, start recording from your phone app.
6. (Optional) pull local models:
   ```bash
   docker exec -it gravador-ollama-1 ollama pull llama3.1:8b
   docker exec -it gravador-ollama-1 ollama pull nomic-embed-text
   ```

## 100% local AI

Defaults in self-host mode:
- **Transcription**: `faster-whisper` (`large-v3`, int8) in the `whisper` container
- **Chat / summaries / mind maps**: Ollama (`llama3.1:8b`)
- **Embeddings**: Ollama (`nomic-embed-text`)

If you want cloud quality, configure BYOK in workspace settings pointing to
OpenAI/Anthropic/Groq/Google.

## Updating

```bash
git pull
docker compose -f infra/docker/docker-compose.yml pull
pnpm selfhost:up
```

SQL migrations in `supabase/migrations/` are applied automatically on first boot.
