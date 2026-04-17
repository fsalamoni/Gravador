# AudioNotes Pro — Plano Mestre de Implementação v2

> **Documento de referência e caching** — Atualizar a cada fase concluída para evitar perda de contexto.

---

## Estado Atual do Projeto (Auditoria v2 — 2026-04-17)

### Arquivos Críticos (NÃO MODIFICAR sem necessidade)

| Arquivo | Função | Status |
|---------|--------|--------|
| `app/_layout.tsx` | Root layout, providers, RecordingsProvider | ✅ Estável |
| `app/(tabs)/_layout.tsx` | Navegação por tabs (3 tabs) | ✅ Estável |
| `app/(tabs)/index.tsx` | Biblioteca de gravações com FAB | ✅ Estável |
| `app/(tabs)/search.tsx` | Busca global | ✅ Estável |
| `app/(tabs)/settings.tsx` | Configurações | ✅ Estável |
| `app/recording.tsx` | Tela de gravação full-screen | ✅ Estável |
| `app/detail/[id].tsx` | Detalhes com 5 tabs de IA (974 linhas) | ✅ Estável |
| `lib/recordings-context.tsx` | Estado global de gravações + AsyncStorage | ✅ Estável |
| `hooks/use-audio-recorder.ts` | Hook de gravação com expo-audio | ✅ Estável |
| `lib/upload-service.ts` | Upload base64 para S3 | ✅ Estável |
| `components/waveform-visualizer.tsx` | Visualizador de waveform animado | ✅ Estável |
| `components/audio-player.tsx` | Player de áudio com controles | ✅ Estável |
| `components/upload-banner.tsx` | Banner de sincronização | ✅ Estável |
| `server/routers.ts` | tRPC routers (370 linhas) | ✅ Estável |
| `server/db.ts` | Funções CRUD do banco de dados | ✅ Estável |
| `drizzle/schema.ts` | Schema do banco (recordings, transcriptions, summaries, mindMaps, actionItems, aiMessages) | ✅ Estável |

### Dependências Instaladas (Relevantes)

- `expo` ~54.0.29, `expo-audio` ~1.1.0, `expo-notifications` ~0.32.15
- `expo-haptics`, `expo-keep-awake`, `expo-linking`, `expo-secure-store`
- `react-native-reanimated` ~4.1.6, `react-native-gesture-handler` ~2.28.0
- `react-native-svg` 15.12.1, `@tanstack/react-query` ^5.90.12
- `@trpc/client` + `@trpc/react-query` + `@trpc/server` 11.7.2
- `drizzle-orm`, `mysql2`, `expo-router` ~6.0.19

### Rotas tRPC Existentes

```
recordings.list, get, create, update, delete, search, uploadAudio
transcription.get, start
summary.list, generate
mindMap.get, generate
actionItems.list, generate, update
askAI.messages, ask
auth.me, auth.logout
system.*
```

### Servidor Backend

- Porta: 3000 (local)
- `server/_core/llm.ts` — invokeLLM (GPT-4)
- `server/_core/voiceTranscription.ts` — transcribeAudio (Whisper)
- `server/_core/notification.ts` — notifyOwner (push via Manus)
- `server/_core/imageGeneration.ts` — generateImage
- `server/storage.ts` — storagePut, storageGet (S3)

---

## Funcionalidades a Implementar (v2)

### Fase 3: Acesso Rápido — App Shortcuts + Botão Físico

**Objetivo:** Permitir iniciar gravação via:
1. Long-press no ícone do app (iOS 3D Touch / Android App Shortcuts)
2. Configuração de botão físico (volume, headphone button)

**Biblioteca escolhida:** `expo-quick-actions` v6.0.1 (compatível com Expo 54)
- GitHub: https://github.com/EvanBacon/expo-quick-actions (623 ⭐)
- Instalação: `npx expo install expo-quick-actions`

**Implementação:**
- `lib/quick-actions-setup.ts` — configurar ações ao iniciar o app
- `app/_layout.tsx` — adicionar `useQuickActionRouting()` (sem quebrar o existente)
- `app.config.ts` — adicionar plugin `expo-quick-actions` com ícones
- `app/recording.tsx` — aceitar parâmetro `?mode=` via deep link

**Para botão físico (volume/headphone):**
- Usar `react-native-headphone-detection` ou lógica nativa
- Alternativa: configurar via Settings para ativar gravação com volume down

### Fase 4: Notificações Push + Background Sync

**Objetivo:** Notificar usuário quando transcrição/resumo estiver pronto

**Implementação:**
- `lib/notifications-service.ts` — solicitar permissão, configurar handlers
- `app/_layout.tsx` — inicializar serviço de notificações (sem quebrar)
- `server/routers.ts` — adicionar `notifyOwner()` após transcrição/resumo concluir
- Background sync: verificar gravações não sincronizadas periodicamente

### Fase 5: Exportação de Conteúdo

**Objetivo:** Exportar transcrição, resumo, mapa mental como PDF/Markdown/Texto

**Implementação:**
- `lib/export-service.ts` — funções de geração de conteúdo exportável
- `app/detail/[id].tsx` — adicionar botão de exportação no header (sem quebrar tabs)
- Usar `expo-sharing` (já disponível via `expo-linking`) + `expo-file-system`

### Fase 6: Melhorias de UX

**Objetivo:** Onboarding, skeleton loading, animações suaves

**Implementação:**
- `app/onboarding.tsx` — tela de boas-vindas (3 slides)
- `components/skeleton-card.tsx` — loading state para cards
- `app/(tabs)/index.tsx` — adicionar skeleton loading (sem quebrar lista)
- `app/(tabs)/settings.tsx` — adicionar seção de Quick Actions

---

## Regras de Desenvolvimento

1. **NUNCA** sobrescrever arquivos sem ler o conteúdo atual primeiro
2. **SEMPRE** usar `file.edit` para modificações pontuais em arquivos existentes
3. **SEMPRE** verificar TypeScript após mudanças: `npx tsc --noEmit`
4. **SEMPRE** testar que o servidor continua respondendo: `curl http://127.0.0.1:3000/api/health`
5. Novos arquivos: criar do zero sem afetar existentes
6. Modificações em `_layout.tsx`: apenas adicionar, nunca remover providers existentes
7. Modificações em `app.config.ts`: apenas adicionar plugins, nunca remover

---

## Índice de Componentes e Hooks

### Hooks
- `useAudioRecorder()` → `hooks/use-audio-recorder.ts` — gravação, estado, níveis de áudio
- `useRecordings()` → `lib/recordings-context.tsx` — lista, filtros, CRUD local
- `useAuth()` → `hooks/use-auth.ts` — usuário autenticado
- `useColors()` → `hooks/use-colors.ts` — paleta de cores do tema

### Componentes
- `<ScreenContainer>` → `components/screen-container.tsx` — wrapper SafeArea
- `<WaveformVisualizer>` → `components/waveform-visualizer.tsx` — visualização de áudio
- `<AudioPlayer>` → `components/audio-player.tsx` — player completo
- `<UploadBanner>` → `components/upload-banner.tsx` — sincronização com nuvem
- `<IconSymbol>` → `components/ui/icon-symbol.tsx` — ícones SF Symbols / Material

### Tipos
- `LocalRecording` → `lib/recordings-context.tsx`
- `RecordingState` → `hooks/use-audio-recorder.ts`
- Tipos do DB → `drizzle/schema.ts`

---

## Histórico de Mudanças

| Data | Fase | O que foi feito |
|------|------|-----------------|
| 2026-04-17 | v1.0 | Projeto inicial criado: gravação, biblioteca, 5 tabs IA, upload S3 |
| 2026-04-17 | v2.0 | Iniciando: Quick Actions, notificações, exportação, UX |
