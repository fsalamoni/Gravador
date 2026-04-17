# Credits & Inspirations

Gravador stands on the shoulders of the open-source community. This list tracks what we learned
from (or directly reused patterns from) each project.

| Project | What Gravador borrows |
|---|---|
| [openplaud/openplaud](https://github.com/openplaud/openplaud) | Self-hosted pipeline shape for Plaud-like transcription, BYOK via OpenAI-compatible endpoints. |
| [landoncrabtree/applaud](https://github.com/landoncrabtree/applaud) | Ollama integration pattern; summary/flashcard/question prompt families. |
| [BasedHardware/omi](https://github.com/BasedHardware/omi) | "Brain Map" mind-map concept; action detection from conversational audio. |
| [pluja/whishper](https://github.com/pluja/whishper) | Web UI patterns for transcript editing + translation. |
| [rishikanthc/Scriberr](https://github.com/rishikanthc/Scriberr) | Diarization pipeline (Parakeet/Canary/Whisper) and job queue design. |
| [virlow-voice/virlow-flutter-recorder](https://github.com/virlow-voice/virlow-flutter-recorder) | TL;DR + Shorthand Notes prompt ideas. |
| [Meeting-BaaS/transcript-seeker](https://github.com/meeting-baas/transcript-seeker) | Timestamp-synced player + chat-with-recording UX. |
| [lodev09/expo-recorder](https://github.com/lodev09/expo-recorder) | Expo recorder reference implementation with waveform + resumable behaviour. |
| [OpenWhispr/openwhispr](https://github.com/OpenWhispr/openwhispr) | Provider abstraction for local + cloud models. |
| [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) | Local transcription engine used in the self-host container. |
| [collabora/WhisperLive](https://github.com/collabora/WhisperLive) | Near-live transcription pattern for the future "record + see text" mode. |

Licensing: we link against these projects at runtime or re-implement patterns; we do not vendor
code from them. See each project's own license before adapting portions.
