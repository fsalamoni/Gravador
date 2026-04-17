# Audio Notes Pro — índice e cache de contexto

## Objetivo desta pasta
Centralizar o contexto verificado para o desenvolvimento do produto **Audio Notes Pro** sem perder histórico entre sessões.

## Estado verificado em 2026-04-17
- Base principal continua sendo este monorepo (`apps/web`, `apps/mobile`, `packages/*`, `workers/ai-pipeline`, `supabase/*`).
- O app importado foi extraído em `references/audionotes-pro/` apenas como **referência de UX, fluxos e integrações**.
- Branding inicial incorporado na base principal:
  - `apps/mobile/assets/icon.png`
  - `apps/mobile/assets/adaptive-icon.png`
  - `apps/web/public/icon-192.png`
  - `apps/web/public/icon-512.png`
  - `apps/web/public/apple-touch-icon.png`
- Login web passou a suportar **magic link + Google OAuth** com callback SSR.

## Documentos desta trilha
- `docs/audio-notes-pro/master-plan.md` — plano mestre de MVP, lançamento, contas, integrações e backlog.
- `docs/audio-notes-pro/incorporation-audit.md` — auditoria do que já existe, do que falta e do que pode ser reaproveitado do app importado.
- `references/audionotes-pro/` — snapshot do app paralelo para consulta pontual.

## Comandos validados nesta base
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## Regras práticas para próximas sessões
1. Priorizar a arquitetura atual do monorepo; usar `references/audionotes-pro/` somente para reaproveitar fluxos, UX e ideias isoladas.
2. Evitar migração de backend do app importado, porque a stack atual já está mais alinhada com multi-workspace, RLS, storage e pipeline de IA.
3. Sempre atualizar os documentos desta pasta ao concluir fases relevantes.
4. Ao implementar autenticação, storage, IA ou integrações, manter compatibilidade com Supabase + RLS + workers existentes.
