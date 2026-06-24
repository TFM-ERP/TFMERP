# SYS-09b — Live Walkie Radio (WebRTC) · Scope & Decision Doc

**Goal:** replace today's store-and-forward push-to-talk with **true low-latency, live duplex audio** — a numbered-channel radio experience (Channel 1 = Production, Channel 4 = Camera) crew use with a Bluetooth earpiece, like physical walkies but over the network.

---

## 1. Where we are today

The PTT we shipped is **voice-notes over the message log**:
- A `Channel` with `isPTT = true` (e.g. "Drivers on shift") + a `PttSession` row for live presence.
- "Hold to talk" records with `MediaRecorder`, uploads the clip, and posts it as a `VOICE` message; recipients tap to play.
- Latency is "record → upload → notify → tap → play" (seconds), and it's half-duplex by nature.

This already covers most coordination ("copy that", "we're wrapping"). What it does **not** do is the always-on, sub-second radio bed where you key up and everyone hears you instantly. That needs a real-time media path — which is the work below.

## 2. What "true radio" requires (and why it's a different class of work)

Live audio can't ride the REST/socket text path. It needs:
- **A media transport** — WebRTC (Opus audio, UDP/SRTP) between each client and a server.
- **A media server (SFU)** — to fan one speaker's audio out to N listeners without N² connections.
- **NAT/firewall traversal** — a **TURN** relay, because on-set networks (cellular, location Wi-Fi, bonded LTE) almost always block direct peer connections.
- **Echo cancellation / noise suppression** — handled by the browser's `getUserMedia` constraints, but must be enabled and tested with earpieces.

## 3. Architecture decision

| Option | Verdict |
|---|---|
| **P2P mesh** (clients connect directly) | ✗ Only viable for 2–3 people; every speaker uploads to every listener. Dies on a real crew. |
| **MCU** (server mixes one stream) | ✗ Heavy CPU (transcoding), adds latency. Overkill for voice. |
| **SFU** (server forwards selective streams) | ✓ **Recommended.** One upload per speaker, server fans out. Standard for this. |

**SFU choice: LiveKit** (open-source, self-hostable or cloud).
- Mature server + first-party JS/Swift/Kotlin SDKs, built-in active-speaker detection, mute/publish controls, and **egress** for recording.
- Ships a token model that maps cleanly onto our auth.
- *Alternative:* `mediasoup` — more control, but you build the signalling, room logic, and SDK glue yourself (≈2–3× the backend effort). Only pick it if LiveKit's model is too opinionated.

## 4. What you'd run (infra)

1. **LiveKit server** — one Docker container (or LiveKit Cloud to skip ops entirely).
2. **coturn** (TURN/STUN) — one Docker container with a public IP + UDP range open; essential for cellular/location networks.
3. **TLS** — WebRTC needs HTTPS/WSS; reuse the reverse proxy in front of the API.
4. **Env:** `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, TURN credentials.

LiveKit Cloud removes items 1–3 (you only keep the keys) — recommended for the first cut; self-host later if data-residency or cost demands it.

## 5. How it maps onto our existing model (minimal schema impact)

The data model **already fits** — no migration needed for the core:
- **Channel (`isPTT`) → a LiveKit room.** Room name = `ptt:${channelId}`. "Channel 1 / Channel 4" is just the channel's title.
- **`PttSession`** keeps doing presence (LIVE/ENDED + `participants[]`); we sync it from LiveKit webhooks.
- **`PttSession.recordingPath`** (already in schema) holds the LiveKit egress recording URL when a session is recorded.
- The existing `startPtt` / `endPtt` / `activePtt` endpoints stay; we add **one** token endpoint beside them.

## 6. Backend work (NestJS) — small

- `POST /comms/channels/:id/ptt/token` → verify the user is a channel member, mint a **LiveKit access token** (`roomJoin`, `room = ptt:${id}`, `canPublish`, `canSubscribe`, identity = userId) with the `livekit-server-sdk`. Return `{ url, token }`.
- `POST /comms/livekit/webhook` → on `participant_joined/left` and `room_finished`, update the `PttSession` row (participants, status, recordingPath). Reuses `CommsGateway` to push presence to the channel.
- *(optional)* kick off **egress recording** on session start for the audit vault.

Roughly **half a day**, since auth, membership, and the session model already exist.

## 7. Frontend work (Next.js) — the bulk

In the PTT channel view, swap the `MediaRecorder` block for the LiveKit client:
- Fetch the token, `room.connect(url, token)`, and **subscribe to all participants** (the always-on radio bed in the earpiece).
- **Push-to-talk:** hold the on-screen key → `setMicrophoneEnabled(true)` (publish); release → `false` (mute). Default muted, so it behaves like a radio PTT, not an open mic.
- **Active speaker:** LiveKit emits speaking events → show "● Maya is transmitting" and a level meter.
- **Bluetooth earpiece** works transparently (it's just an audio output/input device); enable `echoCancellation`, `noiseSuppression`, `autoGainControl` in the mic constraints.
- Keep the channel list / numbering and the existing "Go live" presence pill.

Roughly **1–2 days** including the speaker UI and reconnection handling.

## 8. On-set realities to test (don't skip)

- **Networks:** location Wi-Fi and cellular are hostile — verify the TURN relay actually carries media (force-relay test). Budget for **bonded-LTE / Starlink** at remote units.
- **Latency target:** < 300 ms mouth-to-ear over LTE is achievable with a regional SFU; test on the actual carriers used.
- **Battery & backgrounding:** mobile browsers suspend WebRTC when backgrounded — a thin native wrapper (or PWA with a wake strategy) may be needed for all-day use.
- **Channel discipline:** one person keys at a time per channel (radio etiquette); consider a "channel busy" indicator.

## 9. Effort & phasing

| Phase | Work | Est. |
|---|---|---|
| 0 | Stand up LiveKit Cloud + coturn (or Cloud only), keys in `.env` | 0.5 day |
| 1 | Token endpoint + webhook + PttSession sync | 0.5 day |
| 2 | Frontend LiveKit client + push-to-talk + active speaker | 1.5 days |
| 3 | Recording → vault, reconnection, channel-busy UX | 1 day |
| 4 | Real-network testing on set (the long pole) | 1+ day |

**~4–5 engineering days**, plus a new always-on service to run and monitor. This is why it sits apart from the features we shipped this week — those reused infrastructure you already had; this introduces a media server.

## 10. Decisions needed before building

1. **LiveKit Cloud vs self-host** — Cloud for speed (recommended first cut) vs self-host for data residency/cost at scale.
2. **Concurrency** — how many simultaneous PTT channels × participants at peak (sizes the SFU / cloud tier).
3. **Recording** — record PTT for the audit vault? (retention + storage cost.)
4. **Native wrapper** — is all-day backgrounded use required now, or is foreground-only acceptable for v1?

---

**Recommendation:** if/when you want this, start with **LiveKit Cloud + the token endpoint + a single PTT channel** as a one-day spike to validate latency on your actual on-set carriers, *before* committing to the full build or self-hosting. Everything above the media path (channels, presence, membership, numbering, UI shell) is already in place.
