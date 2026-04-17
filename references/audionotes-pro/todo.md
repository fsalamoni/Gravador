# AudioNotes Pro — TODO

## Fase 1: Fundação e Estrutura
- [x] Inicializar projeto Expo com TypeScript, NativeWind, tRPC
- [x] Criar design.md com plano completo de UI/UX
- [x] Criar schema do banco de dados (recordings, transcriptions, summaries, mindMaps, actionItems, aiMessages)
- [x] Aplicar migração do banco de dados
- [x] Criar tipos compartilhados (shared/types.ts)
- [x] Gerar logo do app (microfone + ondas de IA)
- [x] Configurar tema de cores premium (indigo/violeta)
- [x] Atualizar app.config.ts com nome e branding

## Fase 2: Backend (tRPC + Drizzle)
- [x] Criar server/db.ts com todas as funções CRUD
- [x] Criar server/routers.ts com todas as rotas tRPC
- [x] Rota recordings.list, get, create, update, delete, search
- [x] Rota recordings.uploadAudio (base64 → S3)
- [x] Rota transcription.get, start (Whisper via forge)
- [x] Rota summary.list, generate (6 templates: executive, action_items, decisions, feedback, strategic, meeting_notes)
- [x] Rota mindMap.get, generate (JSON hierárquico com cores)
- [x] Rota actionItems.list, generate, update
- [x] Rota askAI.messages, ask (chat contextual com transcrição)
- [x] Auto-geração de título com IA após transcrição

## Fase 3: Contexto e Hooks
- [x] Criar lib/recordings-context.tsx (estado local + AsyncStorage)
- [x] Criar hooks/use-audio-recorder.ts (gravação com expo-audio)
- [x] Criar lib/upload-service.ts (base64, file info, delete)

## Fase 4: Componentes
- [x] Atualizar components/ui/icon-symbol.tsx com todos os ícones necessários
- [x] Criar components/waveform-visualizer.tsx (visualização animada)
- [x] Criar components/audio-player.tsx (player com controles completos)
- [x] Criar components/upload-banner.tsx (banner de sincronização com nuvem)

## Fase 5: Telas
- [x] app/(tabs)/_layout.tsx (navegação por tabs: Biblioteca, Buscar, Config)
- [x] app/(tabs)/index.tsx (biblioteca com cards, filtros, FAB, busca)
- [x] app/(tabs)/search.tsx (busca global com resultados em tempo real)
- [x] app/(tabs)/settings.tsx (configurações, conta, tema, privacidade)
- [x] app/recording.tsx (tela de gravação full-screen com waveform)
- [x] app/detail/[id].tsx (detalhes com 5 tabs: Transcrição, Resumo, Mapa Mental, Ações, Perguntar IA)
- [x] Atualizar app/_layout.tsx com RecordingsProvider e novas rotas

## Fase 6: Funcionalidades de IA
- [x] Transcrição de áudio com Whisper (multi-idioma)
- [x] Geração de resumos com 6 templates diferentes
- [x] Geração de mapa mental interativo hierárquico
- [x] Extração de itens de ação com prioridade, responsável e prazo
- [x] Chat com IA baseado na transcrição (Ask AI)
- [x] Auto-título inteligente após transcrição

## Fase 7: Sincronização e Upload
- [x] Upload de áudio local para nuvem (S3) via base64
- [x] Banner de sincronização com progresso visual
- [x] Indicadores de status: Local, Transcrito, Resumido
- [x] Compartilhamento de conteúdo via Share API

## Melhorias Futuras
- [ ] Widget de acesso rápido na tela inicial (iOS/Android)
- [ ] Gravação em background (background audio task)
- [ ] Exportação para PDF/Word/Notion
- [ ] Integração com Google Calendar (itens de ação)
- [ ] Diarização de falantes na transcrição
- [ ] Modo offline completo com sync posterior
- [ ] Notificações push quando transcrição/resumo concluir
- [ ] Pastas e organização avançada
- [ ] Tags personalizadas
- [ ] Compartilhamento de gravações entre usuários

## Fase 8: Acesso Rápido e Melhorias (v2)

- [x] Quick Actions: atalhos no ícone do app (long-press) para iOS e Android
- [x] Suporte ao parâmetro ?mode= na tela de gravação via URL
- [x] Plugin expo-quick-actions configurado no app.config.ts
- [x] Notificações push locais para transcrição, resumo e mapa mental concluídos
- [x] Serviço de notificações com canal Android configurado
- [x] Navegação automática ao tocar em notificação
- [x] Exportação de conteúdo: Markdown (.md) e Texto Simples (.txt)
- [x] Botão de exportação avançada na tela de detalhes
- [x] Cópia de transcrição para área de transferência
- [x] Tela de onboarding com 4 slides animados
- [x] Verificação de primeiro uso com AsyncStorage
- [x] Componente SkeletonLoader para estados de carregamento
- [x] Seção de Acesso Rápido nas configurações
- [x] Configuração de notificações nas configurações
- [x] Opção de rever o tutorial nas configurações
- [x] Novos ícones mapeados no icon-symbol.tsx
- [x] 0 erros TypeScript em todo o projeto

## Fase 8: Acesso Rápido (v2)
- [ ] Instalar expo-quick-actions (compatível com Expo 54)
- [ ] Criar lib/quick-actions-setup.ts com configuração de atalhos
- [ ] Integrar useQuickActionRouting no app/_layout.tsx
- [ ] Adicionar plugin expo-quick-actions no app.config.ts
- [ ] Criar rota /quick-record para gravação via atalho
- [ ] Configurar 3 atalhos: Gravar Agora, Nova Nota de Voz, Abrir Biblioteca
- [ ] Adicionar seção de Quick Actions na tela de Settings

## Fase 9: Notificações Push (v2)
- [ ] Criar lib/notifications-service.ts com setup completo
- [ ] Integrar inicialização de notificações no app/_layout.tsx
- [ ] Adicionar notifyOwner no servidor após transcrição concluir
- [ ] Adicionar notifyOwner no servidor após resumo concluir
- [ ] Configurar canal Android para notificações de IA
- [ ] Adicionar toggle de notificações na tela de Settings

## Fase 10: Exportação de Conteúdo (v2)
- [ ] Criar lib/export-service.ts com funções de exportação
- [ ] Exportar como Markdown (transcrição + resumo + ações)
- [ ] Exportar como texto simples
- [ ] Compartilhar via Share API nativo
- [ ] Adicionar botão de exportação na tela de detalhes
- [ ] Adicionar opção de copiar transcrição para clipboard

## Fase 11: Melhorias de UX (v2)
- [ ] Criar app/onboarding.tsx com 3 slides de boas-vindas
- [ ] Criar components/skeleton-card.tsx para loading states
- [ ] Adicionar skeleton loading na biblioteca (index.tsx)
- [ ] Melhorar tela de Settings com seção de Quick Actions
- [ ] Adicionar pull-to-refresh na biblioteca
- [ ] Adicionar swipe-to-delete nos cards da biblioteca
- [ ] Melhorar empty state com animação

## Fase 12: Funcionalidades Reais End-to-End (v3)

- [ ] Criar tela de login /oauth/login com botão de entrar via Manus OAuth
- [ ] Registrar rota /oauth/login no Stack do _layout.tsx
- [ ] Corrigir fluxo de gravação: upload automático após salvar quando autenticado
- [ ] Disparar transcrição automática após upload bem-sucedido
- [ ] Polling automático de status de transcrição na tela de detalhes
- [ ] Polling automático de status de resumo na tela de detalhes
- [ ] Adicionar campo googleDriveToken e googleDriveFolderId no schema do usuário
- [ ] Implementar rota de integração com Google Drive no servidor
- [ ] Criar UI de configuração do Google Drive nas configurações
- [ ] Testar pipeline completo: gravar → upload → transcrever → resumir

## Fase 9: Funcionalidades Reais e Google Drive (v3) — CONCLUÍDA

- [x] Tela de login OAuth com design premium (expo-linear-gradient)
- [x] Rota /oauth/login registrada no Stack
- [x] Fluxo de gravação → upload automático → transcrição automática
- [x] Feedback visual do status de salvamento na tela de gravação
- [x] Schema do banco com campos Google Drive (migração aplicada)
- [x] Serviço google-drive.ts: OAuth2, token refresh, upload, listagem
- [x] googleDriveRouter: status, getAuthUrl, connect, disconnect, syncRecording, listFiles
- [x] Tela /google-drive com UI completa de conexão e listagem de arquivos
- [x] Botão Google Drive nas configurações (seção GRAVAÇÃO)
- [x] Botão de sincronização com Drive no header da tela de detalhes
- [x] Handler handleSyncToDrive com feedback de erro/sucesso
- [x] Credenciais GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET configuradas
- [x] 17 testes passando, 0 erros TypeScript
