# AudioNotes Pro — Design Document

## App Concept

**AudioNotes Pro** is a premium AI-powered audio note-taking app that captures ambient audio, transcribes it with high accuracy, and processes it with AI to generate summaries, mind maps, action items, and insights. The experience is designed to feel like a first-party iOS app — clean, fast, and purposeful.

---

## Color Palette

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `primary` | `#6366F1` (Indigo) | `#818CF8` | CTAs, active states, recording indicator |
| `background` | `#FAFAFA` | `#0F0F12` | Screen backgrounds |
| `surface` | `#FFFFFF` | `#1C1C24` | Cards, modals, panels |
| `foreground` | `#111827` | `#F9FAFB` | Primary text |
| `muted` | `#6B7280` | `#9CA3AF` | Secondary text, timestamps |
| `border` | `#E5E7EB` | `#2D2D3A` | Dividers, card borders |
| `success` | `#10B981` | `#34D399` | Sync status, completed |
| `warning` | `#F59E0B` | `#FBBF24` | Processing, pending |
| `error` | `#EF4444` | `#F87171` | Errors, delete |
| `recording` | `#EF4444` | `#F87171` | Active recording pulse |

**Accent**: Deep Indigo `#6366F1` — conveys intelligence, focus, and premium quality.

---

## Screen List

### Core Screens
1. **Home / Library** — Main recording library with search, filters, and quick record button
2. **Recording** — Full-screen recording interface with waveform, timer, and controls
3. **Recording Detail** — View a single recording with tabs for transcript, summary, mind map, actions
4. **Transcript View** — Full transcript with speaker labels, timestamps, and search
5. **Summary View** — AI-generated summaries with multiple templates
6. **Mind Map View** — Interactive visual mind map generated from the recording
7. **Action Items** — Extracted action items with assignees and deadlines
8. **Ask AI** — Chat interface to ask questions about the recording
9. **Search** — Global search across all recordings and transcripts
10. **Settings** — App preferences, AI settings, cloud sync, account

### Onboarding Screens
11. **Onboarding** — Welcome and feature highlights (3 slides)
12. **Permissions** — Microphone and notification permission requests

---

## Primary Content and Functionality

### 1. Home / Library Screen
- **Header**: App title + search icon + profile avatar
- **Quick Record FAB**: Large pulsing record button at bottom center (always visible)
- **Filter Bar**: All | Today | Meetings | Calls | Voice Memos | Starred
- **Recording Cards** (FlatList):
  - Title (auto-generated from transcript)
  - Date + time + duration
  - Waveform thumbnail
  - AI status badges (Transcribed, Summarized, Mind Map)
  - Sync status indicator
  - Swipe-to-delete and swipe-to-star actions
- **Empty State**: Illustration + "Tap the record button to capture your first note"

### 2. Recording Screen
- **Full-screen immersive design** with dark background
- **Live Waveform**: Animated real-time audio visualization
- **Timer**: Large, prominent elapsed time display
- **Recording Mode Badge**: "Ambient" / "Meeting" / "Call"
- **Controls**:
  - Center: Large stop/pause button with haptic feedback
  - Left: Discard recording
  - Right: Add text note / highlight moment
- **Status Bar**: Battery-style indicator for storage space
- **Background Recording**: Notification shown when app is backgrounded

### 3. Recording Detail Screen
- **Header**: Back button + recording title (editable) + share/export menu
- **Audio Player**: Compact player with waveform scrubber, play/pause, speed control
- **Tab Navigation**: Transcript | Summary | Mind Map | Actions | Ask AI
- **Metadata Row**: Date, duration, language, sync status

### 4. Transcript View
- **Speaker Labels**: Color-coded per speaker with names
- **Timestamps**: Tappable — jumps audio player to that moment
- **Highlight Support**: Long-press to highlight important passages
- **Search**: Inline search with navigation between results
- **Edit Mode**: Correct transcription errors inline

### 5. Summary View
- **Template Selector**: Executive | Action Items | Decisions | Feedback | Strategic | Custom
- **Generated Summary**: Formatted with headings, bullets, and emphasis
- **Regenerate**: Re-run AI with different template
- **Copy / Share**: Quick actions

### 6. Mind Map View
- **Interactive Canvas**: Pinch-to-zoom, pan, tap nodes
- **Auto-generated hierarchy**: Central topic → subtopics → details
- **Node Colors**: Color-coded by category
- **Export**: Save as image or share

### 7. Action Items Screen
- **Extracted Tasks**: Checkbox list with task text
- **Assignees**: Auto-detected names from transcript
- **Due Dates**: Suggested from context
- **Priority**: High / Medium / Low
- **Export to Calendar / Reminders**

### 8. Ask AI Screen
- **Chat Interface**: Message bubbles with AI responses
- **Reference Citations**: Each answer cites the source timestamp
- **Suggested Questions**: Contextual suggestions based on content
- **Save Answer**: Save as a note

### 9. Search Screen
- **Global Search Bar**: Searches across all recordings, transcripts, summaries
- **Results grouped by**: Recording title, transcript snippet, summary content
- **Filters**: Date range, duration, language, tags

### 10. Settings Screen
- **Account**: Login/logout, profile info
- **AI Settings**: Language preference, summary templates, transcription quality
- **Storage**: Local storage usage, cloud sync toggle, auto-upload settings
- **Notifications**: Recording reminders, sync notifications
- **Privacy**: Data retention, export all data, delete account

---

## Key User Flows

### Flow 1: Quick Record from Home
1. User opens app → sees Library
2. Taps large FAB (record button) at bottom
3. Recording screen appears with animation
4. Waveform animates as audio is captured
5. User taps stop → recording saved locally
6. Returns to Library with new card at top
7. AI processing badge shows "Processing..."
8. Push notification when transcript is ready

### Flow 2: Review and Summarize
1. User taps recording card in Library
2. Detail screen opens with audio player
3. User taps "Transcript" tab → reads transcript
4. Taps "Summary" tab → sees AI summary
5. Taps template selector → chooses "Action Items"
6. AI generates action items list
7. User exports to Reminders app

### Flow 3: Mind Map Generation
1. User on Detail screen → taps "Mind Map" tab
2. Mind map loads with central topic
3. User pinches to zoom, taps nodes to expand
4. Taps "Export" → saves as image to Photos

### Flow 4: Ask AI
1. User on Detail screen → taps "Ask AI" tab
2. Types question: "What were the key decisions?"
3. AI responds with answer + citations
4. User taps citation → audio jumps to that moment
5. User saves answer as note

### Flow 5: Background Recording
1. User starts recording
2. Locks phone or switches app
3. Recording continues in background
4. Persistent notification shows: "Recording... 5:23"
5. User taps notification → returns to recording screen

---

## Navigation Architecture

```
Root Stack
├── (tabs)/
│   ├── index (Library / Home)
│   ├── search (Global Search)
│   └── settings (Settings)
├── recording (Full-screen recording modal)
├── detail/[id] (Recording detail)
│   ├── transcript
│   ├── summary
│   ├── mindmap
│   ├── actions
│   └── ask
└── onboarding (First-launch flow)
```

---

## Component Design Principles

1. **Cards**: Rounded corners (16px), subtle shadow, border in light mode
2. **Buttons**: Primary = filled indigo, Secondary = outlined, Destructive = red
3. **Typography**: System font (SF Pro on iOS), bold headings, regular body
4. **Spacing**: 16px base unit, 8px for tight spacing, 24px for sections
5. **Icons**: SF Symbols (iOS) / Material Icons (Android)
6. **Animations**: Subtle, purposeful — 200-300ms, ease-in-out
7. **Haptics**: Light for taps, medium for toggles, success/error for completions
8. **Empty States**: Friendly illustrations with clear CTAs
9. **Loading States**: Skeleton screens, not spinners
10. **Error States**: Inline errors with retry actions

---

## Accessibility

- Minimum touch target: 44x44pt
- Color contrast: WCAG AA compliant
- Dynamic Type support
- VoiceOver labels on all interactive elements
- Reduced Motion support for animations
