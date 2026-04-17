# Audio Notes Pro — auditoria de incorporação

## Resumo executivo
O repositório principal já possui uma fundação mais forte para o produto final do que o app importado: Supabase com RLS, schema rico, web workspace em Next.js, worker de IA, storage, embeddings e pipeline multi-provider.

O app importado em `references/audionotes-pro/` é mais útil como **fonte de interface, fluxos móveis e integrações UX** do que como base técnica principal.

## O que já existe na base principal
- Web em Next.js 15 com áreas de workspace, gravações, chat e integrações.
- Mobile em Expo com gravação, fila offline e upload para Supabase Storage.
- Schema com usuários, workspaces, gravações, transcrições, embeddings, shares e integrações.
- Pipeline de IA com transcrição, resumo, capítulos, mapa mental, ações e embeddings.
- Estrutura para BYOK em `workspaces.ai_settings`.
- Trigger de bootstrap de workspace pessoal após signup.
- Estrutura nativa inicial para Quick Settings tile / shortcuts, ainda incompleta.

## O que o app importado agrega
| Área | Evidência no app importado | Valor para incorporação | Decisão |
|---|---|---|---|
| Branding e ícones | `assets/images/*` | Alto | Reaproveitar imediatamente |
| Google Drive UX | `app/google-drive.tsx` | Alto | Reaproveitar fluxo e copy, reimplementar com Supabase/RLS |
| Exportação | `lib/export-service.ts` | Médio/alto | Adaptar para o schema atual |
| Quick actions | `lib/quick-actions-setup.ts` | Alto | Reimplementar no app mobile atual |
| Notificações locais | `lib/notifications-service.ts` | Médio | Adaptar ao pipeline atual |
| Onboarding e skeletons | `app/onboarding.tsx`, `components/skeleton-loader.tsx` | Médio | Incorporar depois do core funcionar |
| Hook de auth | `hooks/use-auth.ts` | Baixo | Não portar; auth atual deve ficar centralizada em Supabase |
| Backend tRPC/MySQL próprio | `server/*`, `drizzle/*` | Baixo | Não portar |

## Gaps críticos confirmados na base principal
| Tema | Status atual | Impacto |
|---|---|---|
| Google login | Parcial; havia apenas magic link no web | Alto |
| Auth SSR completa | Ausência de callback/middleware | Alto |
| Mobile auth | Ainda não implementada de ponta a ponta | Alto |
| Google Drive real | Estrutura de integrações existe, UI é placeholder | Alto |
| Configuração UI de BYOK/modelos | Placeholder em settings | Alto |
| Ranking/comparativo de modelos | Não existe | Alto |
| Quick tile / widget nativo real | Plugin ainda stubado | Alto |
| Exportação real | Ainda não existe no monorepo principal | Médio/alto |
| Branding final | Nome/ícones não estavam aplicados | Médio |
| Publicação mobile | Bundle IDs, signing, store assets e release process ainda não fechados | Alto |

## Ordem recomendada de incorporação
1. **Autenticação real**: web SSR + Google OAuth + sessão estável.
2. **Branding do produto**: nome, ícones, manifestos, telas básicas.
3. **Persistência do usuário**: garantir workspace pessoal, storage e gravações vinculadas ao usuário.
4. **Google Drive**: conexão OAuth, pasta dedicada e export/upload.
5. **Settings de IA**: BYOK + seleção por tarefa + catálogo/ranking de modelos.
6. **Atalhos móveis**: quick actions, tile Android, widget/shortcut iOS.
7. **Exportação e notificações**.
8. **Polimento de MVP**: onboarding, erro/retry, empty states, analytics, crash reporting, releases.

## O que NÃO recomendo incorporar diretamente
- Estrutura backend do app importado (`server/*`, `drizzle/*`, tRPC próprio).
- Lógica de armazenamento de tokens diretamente em tabela de usuário no estilo do app importado.
- Qualquer fluxo que troque Supabase Auth/Storage por serviços paralelos sem necessidade.

## Conclusão
A melhor estratégia é manter esta base como produto principal e usar `references/audionotes-pro/` como biblioteca de referência visual/funcional. Isso reduz retrabalho e preserva a arquitetura que já está mais próxima do lançamento web + mobile com multiusuário, RLS e pipeline de IA.
