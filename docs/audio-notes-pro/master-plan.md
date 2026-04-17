# Audio Notes Pro — plano mestre de MVP e lançamento

## 1. Objetivo
Lançar o **MVP testável web + mobile** do Audio Notes Pro com gravação real, autenticação, persistência por usuário, processamento de IA, exportação básica e atalhos móveis.

## 2. Decisão de stack
### Base recomendada
- **Frontend web**: Next.js atual (`apps/web`)
- **App mobile**: Expo atual (`apps/mobile`)
- **Banco/Auth/Storage**: Supabase
- **Jobs de IA**: worker atual (`workers/ai-pipeline`) + Trigger.dev
- **IA**: BYOK por usuário/workspace, com suporte adicional planejado para OpenRouter

### O que manter
- Supabase como fonte de verdade de auth, DB, storage e RLS
- Schema atual com workspaces, recordings, integrations e ai settings
- Pipeline atual de transcrição/resumo/embeddings

## 3. O que é obrigatório para o MVP funcionar de verdade

### A. Autenticação e conta
- [x] Corrigir auth SSR web
- [x] Adicionar login com Google no web
- [ ] Implementar login/logout no mobile com Supabase Auth
- [ ] Garantir refresh de sessão e deep link OAuth no mobile
- [ ] Completar tela de conta/configurações de usuário
- [ ] Permitir logout seguro em web e mobile

### B. Dados do usuário e persistência
- [ ] Garantir seleção do workspace padrão no mobile
- [ ] Garantir que toda gravação salve em `audio-raw/<workspace_id>/...`
- [ ] Garantir criação de linha de `recordings` após upload
- [ ] Garantir reprocessamento manual em caso de falha
- [ ] Garantir exclusão/soft delete e recuperação de erros

### C. Gravação e upload real
- [ ] Validar gravação real em Android físico
- [ ] Validar gravação real em iPhone físico
- [ ] Corrigir/background audio quando tela bloqueia
- [ ] Implementar retomada de upload robusta para arquivos grandes
- [ ] Adicionar estados claros: gravando, pausado, upload, processando, pronto, erro

### D. Pipeline de IA real
- [ ] Fechar webhook/storage trigger → worker → persistência final
- [ ] Validar transcrição fim a fim com 1 áudio curto e 1 longo
- [ ] Validar resumo, capítulos, ações, mapa mental e chat para um áudio pronto
- [ ] Persistir custos, latência e provedor utilizado
- [ ] Adicionar reprocessamento por tarefa

### E. Settings de IA / BYOK / modelos
- [ ] Construir UI real de settings BYOK
- [ ] Permitir chaves por usuário/workspace
- [ ] Permitir escolha de provedor por tarefa: transcrição, resumo, chat, embeddings, mapa mental, capítulos, ações
- [ ] Adicionar suporte a OpenRouter
- [ ] Criar catálogo de modelos com:
  - [ ] nome do modelo
  - [ ] provedor
  - [ ] contexto máximo
  - [ ] custo input/output
  - [ ] modalidade (texto/áudio/imagem)
  - [ ] score 0-100
  - [ ] justificativa do score
  - [ ] casos ideais de uso
- [ ] Criar rotina de atualização do catálogo de modelos

### F. Google Drive e storage pessoal
- [ ] Implementar OAuth do Google Drive no produto principal
- [ ] Permitir escolher pasta padrão do usuário
- [ ] Permitir salvar áudio bruto, transcrição e exportações no Drive
- [ ] Adicionar refresh token seguro e expiração
- [ ] Adicionar opção: salvar apenas no Supabase, apenas no Drive, ou nos dois

### G. Exportação e consumo
- [ ] Exportar Markdown
- [ ] Exportar TXT
- [ ] Exportar PDF
- [ ] Exportar DOCX
- [ ] Enviar para Notion/Obsidian (pós-MVP se necessário)

### H. Atalhos móveis
- [ ] App shortcut / long-press icon no Android
- [ ] Quick Settings tile Android real (não stub)
- [ ] Home screen quick action iOS
- [ ] Widget/shortcut iOS para início rápido
- [ ] Estudo de botão físico: mapear limitações por plataforma
- [ ] Se botão físico não for viável de forma universal, entregar alternativa via quick actions + widget + tile

### I. Qualidade, suporte e lançamento
- [ ] Analytics mínimo
- [ ] Crash reporting
- [ ] Logs estruturados para jobs
- [ ] Monitoramento de falhas de fila/processamento
- [ ] Política de privacidade
- [ ] Termos de uso
- [ ] Página de suporte/contato
- [ ] Store listing assets
- [ ] TestFlight/Internal testing

## 4. Contas e ferramentas: o que você já pode usar

### GitHub
Você já pode usar para:
- repositório e versionamento
- GitHub Actions para CI/CD
- GitHub Projects/Issues para roadmap
- Releases e changelog

### Google
Você já pode usar para:
- Google OAuth
- Google Drive
- Google Play Console (se a conta for de desenvolvedor)
- Google Cloud Console para configurar OAuth e APIs
- Gemini/OpenRouter comparativamente, se quiser avaliar custo/benefício

### Firebase
No estado atual, **não é obrigatório** para o MVP.
Use Firebase apenas se você quiser:
- FCM nativo no futuro
- Crashlytics/Analytics nativos
- Dynamic Links equivalentes

### Serviços adicionais necessários
- **Supabase**: obrigatório nesta arquitetura, a menos que você opte por self-host completo
- **Trigger.dev**: recomendado para jobs de IA do worker atual
- **Provedor(s) de IA**: pelo menos um entre OpenAI, Groq, Google, Anthropic, OpenRouter ou Ollama local
- **Expo/EAS**: obrigatório para builds mobile
- **Apple Developer**: obrigatório para iOS real/TestFlight/App Store
- **Google Play Console**: obrigatório para Android release na Play Store
- **Domínio**: recomendado para web production e callbacks OAuth estáveis
- **Sentry (ou equivalente)**: altamente recomendado

## 5. Passo a passo perfeito para viabilizar a infra

### Passo 1 — Supabase
1. Criar um projeto Supabase cloud.
2. Copiar `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Aplicar migrations desta base.
4. Habilitar Google provider em Auth > Providers.
5. Configurar URLs de callback do web e do mobile.
6. Criar buckets usados pelo app e validar políticas.

### Passo 2 — Google Cloud
1. Criar projeto no Google Cloud Console.
2. Habilitar APIs necessárias:
   - Google Drive API
   - Google People API (opcional)
3. Criar credenciais OAuth para web.
4. Criar credenciais OAuth para app mobile posteriormente.
5. Adicionar redirect URIs do Supabase Auth e do app para Drive.
6. Definir tela de consentimento OAuth.
7. Publicar app OAuth ou adicionar test users enquanto estiver em teste.

### Passo 3 — Expo / EAS
1. Criar conta/projeto Expo/EAS.
2. Definir `projectId` e `updates.url` reais em `app.config.ts`.
3. Gerar builds development para Android/iOS.
4. Validar permissões de microfone, notificações e deep links.
5. Fechar strategy de bundle identifiers finais antes de subir para lojas.

### Passo 4 — Trigger.dev / jobs
1. Criar conta/projeto Trigger.dev.
2. Configurar `TRIGGER_SECRET_KEY` e `TRIGGER_API_URL`.
3. Publicar o worker `workers/ai-pipeline`.
4. Validar job de processamento após upload.

### Passo 5 — IA
1. Escolher provedor inicial de transcrição (Groq costuma ser o melhor custo/velocidade para MVP).
2. Escolher provedor inicial de chat/resumo (OpenRouter ou Anthropic/OpenAI/Google).
3. Definir fallback por tarefa.
4. Implementar tela de comparação de modelos.
5. Registrar custos por gravação para orientar o usuário.

### Passo 6 — Lançamento web
1. Subir web em Vercel ou infraestrutura equivalente.
2. Configurar domínio próprio.
3. Ajustar `NEXT_PUBLIC_APP_URL`.
4. Validar auth, upload, worker, share e export.

### Passo 7 — Lançamento mobile
1. Gerar build Android internal.
2. Gerar build iOS development/TestFlight.
3. Validar gravação real, upload, background, notificações e atalhos.
4. Abrir beta fechado primeiro.

## 6. Sequência recomendada de desenvolvimento

### Fase 1 — Fundamentos de lançamento (imediata)
- branding
- auth web SSR + Google
- mobile auth
- gravação/upload fim a fim
- worker fim a fim

### Fase 2 — MVP funcional
- Google Drive
- settings BYOK
- export Markdown/TXT/PDF
- quick actions móveis
- error/retry flows

### Fase 3 — MVP testável em lojas
- push/observability
- política/termos
- store assets
- beta fechado Android/iOS

### Fase 4 — Pós-MVP
- OpenRouter + ranking completo de modelos
- widget/tile completos
- compartilhamento avançado
- Notion/Obsidian/Dropbox/OneDrive
- billing/plans

## 7. Riscos e decisões importantes
- **Firebase não substitui Supabase aqui** sem retrabalho grande.
- **Botão físico do celular** depende de limitações nativas e pode não ser viável universalmente; quick actions, tile e widget devem ser a entrega primária.
- **OpenRouter** ainda precisa ser adicionado ao pacote de IA e ao schema/configuração.
- **Bundle IDs / slugs / scheme** devem ser migrados com cuidado para não quebrar deep links existentes.

## 8. Definição de pronto para o MVP
O MVP estará pronto quando:
- o usuário entrar com Google
- gravar áudio real no celular
- o áudio subir automaticamente
- a transcrição/resumo/chat funcionarem
- o conteúdo ficar salvo por usuário/workspace
- o usuário puder exportar ou mandar para o Drive
- o app abrir gravação rápida por atalho no celular
- web e mobile estiverem testáveis em ambiente real
