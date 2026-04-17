"""
Local transcription server used by the self-host worker.
Matches the `TranscribeResult` shape consumed by @gravador/ai.
"""
import os
import tempfile
import httpx
from fastapi import FastAPI
from pydantic import BaseModel
from faster_whisper import WhisperModel

MODEL_NAME = os.environ.get("WHISPER_MODEL", "large-v3")
COMPUTE_TYPE = os.environ.get("COMPUTE_TYPE", "int8")
MODEL_DIR = os.environ.get("MODEL_DIR", "/models")

app = FastAPI()
model = WhisperModel(MODEL_NAME, compute_type=COMPUTE_TYPE, download_root=MODEL_DIR)


class TranscribeRequest(BaseModel):
    audio_url: str
    language: str | None = None
    diarize: bool = False


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_NAME}


@app.post("/transcribe")
def transcribe(req: TranscribeRequest):
    with tempfile.NamedTemporaryFile(suffix=".m4a", delete=False) as tmp:
        with httpx.stream("GET", req.audio_url, follow_redirects=True, timeout=300.0) as r:
            r.raise_for_status()
            for chunk in r.iter_bytes():
                tmp.write(chunk)
            tmp.flush()
        path = tmp.name

    segments_iter, info = model.transcribe(
        path,
        language=req.language,
        vad_filter=True,
        word_timestamps=False,
    )

    segments = []
    full_text_parts: list[str] = []
    for s in segments_iter:
        text = s.text.strip()
        full_text_parts.append(text)
        segments.append({
            "startMs": int(s.start * 1000),
            "endMs": int(s.end * 1000),
            "text": text,
            "confidence": float(s.avg_logprob) if s.avg_logprob is not None else None,
            "speakerId": None,
        })

    lang = info.language
    detected = "pt-BR" if lang and lang.startswith("pt") else ("en" if lang == "en" else None)

    return {
        "provider": "local-faster-whisper",
        "model": MODEL_NAME,
        "detectedLocale": detected,
        "fullText": " ".join(full_text_parts).strip(),
        "segments": segments,
    }
