# SYS-15 · Local (free) audio engines for ScriptON Audio

The **LOCAL** engine row (Setup → Audio Engines) talks to any OpenAI-compatible TTS
server running on your machine: free, unlimited characters, no API key, fully private.
Point "Server URL" at one of the options below, enable the engine, and route
**Live reading → Local server (free)** in the routing matrix. Renders can stay on
ElevenLabs v3 for the premium performance pass.

The adapter also reads the server's voice catalog (`/v1/audio/voices`) — voice names
and any gender / age / accent / language labels flow straight into the casting
dropdowns, filters, and auto-cast matching, exactly like ElevenLabs voices do.
Expressive controls are passed when the server supports them (Chatterbox:
`exaggeration` from the Style amount, `cfg_weight` from stability, `instructions`
from emotion tags + accents) and are harmlessly ignored by simpler servers.

## Option A — Chatterbox (recommended: emotion + voice cloning, MIT)

Best quality and the only local option with EMOTION control and free voice cloning
(drop in a reference WAV of any actor and cast that voice). Wants a GPU for snappy
synthesis; works on CPU but slower.

```powershell
# with Docker Desktop:
docker run -d --name chatterbox -p 4123:4123 ghcr.io/travisvn/chatterbox-tts-api:latest
# GPU (NVIDIA): add --gpus all
```
Server URL: `http://localhost:4123` · Model: `chatterbox`
Voice cloning: PUT your reference WAVs in the server's voice library (see the
chatterbox-tts-api README — uploaded voices appear in TFM's voice dropdown).

## Option B — Piper via openedai-speech (900+ voices, fastest CPU)

Hundreds of pre-built voices across many languages; runs on anything.

```powershell
docker run -d --name openedai-speech -p 8000:8000 ghcr.io/matatonic/openedai-speech:latest
```
Server URL: `http://localhost:8000` · Model: `tts-1` (Piper voices)

## Option C — MeloTTS (multi-language + English accents)

US / UK / Australian / Indian English accents plus ES, FR, ZH, JP, KR.

```powershell
docker run -d --name melotts -p 8888:8080 timhagel/melotts-api-server
```
Server URL: `http://localhost:8888` (wrapper APIs vary — prefer A or B unless you
specifically need Melo's accent set).

## After starting a server

1. Setup → Audio Engines → **Local server (free)**: set the Server URL, pick the
   model, tick **Enabled**, Save. (Seed defaults creates the row if missing.)
2. The row shows the live **voice count** when the server responds.
3. Routing & defaults: set **Live reading** (and TTS, if you want free drafting)
   to *Local server (free)*. Per-project overrides work as usual.
4. Cast characters in Audio Studio → Cast — local voices appear in the dropdown
   with whatever labels the server provides.

## Honest limits vs ElevenLabs

- No `[whispers]`-style audio tags or multi-speaker dialogue interplay (Chatterbox's
  exaggeration is the closest thing — TFM maps your sliders to it automatically).
- No SFX / music generation locally yet (cue ✨ generation stays on ElevenLabs).
- Quality ranking for dialogue: Chatterbox ≳ ElevenLabs v2 > Piper/Melo > browser.
Use Local for unlimited table reads and drafting; ElevenLabs v3 for the final pass.
