# AI Vertical Video — Audit & Roadmap to Generated Episodes

A full read of the current `VERTICAL_AI_VIDEO` flow against your walkthrough, plus the 2026
best-practice for AI vertical serial video, and a concrete roadmap to the end goal:
**a series → episodes (60–90s) → scenes (≤5s each) → real generated clips → stitched episodes.**

_Researched June 2026._

---

## 1) Your walkthrough, decoded

| # | What you saw | Status | Why |
|---|---|---|---|
| 1 | "Generate video" → **Internal server error** | 🔴 bug | No *usable* render engine. ComfyUI is enabled but its workflow path isn't set (and the local server may be off); Runway/Seedance have no key. The endpoint also threw a raw 500 instead of a clear message — **fixed** (now returns a clean "enable an engine" message). |
| 2 | AI-video format asks **no episodes / length** | 🟠 gap | `VERTICAL_AI_VIDEO` is currently modeled as **one ~5s piece**, not a series. This is the core structural gap (Part 5–6). |
| 3 | Develop ladder shows **11 stages** (Logline…VIDEO_PROMPT) | 🔴 bug | Load-order: the build's format loads async; the page first paints the **default feature ladder**, then corrects. |
| 4 | "Generate logline" → **nothing** | 🔴 bug | Logline isn't a stage in this format — the stale 11-stage UI offered it. Fixed by #3 (gate the ladder on the loaded format). |
| 5 | Refresh → correct **3 stages** (Premise · SHOT_LIST · VIDEO_PROMPT) | ✅ expected | After the format loads, the real `VERTICAL_AI_LADDER` shows. |
| 6 | "Generate premise" → great output | ✅ works | The creative engine is solid. |
| 7 | "Generate SHOT_LIST" → great output | ✅ works | 5 observable, physical, single-action shots with camera — exactly right. |
| 8 | "Generate VIDEO_PROMPT" → full JSON (5 × 5s shots) | ✅ works | Per-shot prompt + negative + camera + audio + seed. This is genuinely good output. |
| 9 | "Generating VIDEO_PROMPT" ran, then **no video** | ⚠️ misread | `VIDEO_PROMPT` only writes the **prompts** (the JSON you got). The actual pixels come from a **separate** step — "▶ Generate video" — which is #1. Nothing failed silently; the render is just the missing link. |

**Bottom line:** the hard part — turning an idea into shot-accurate, render-ready prompts — **works well**. What's missing is (a) a configured render engine, and (b) the **series → episode → scene** structure.

---

## 2) The two real problems

**A. No engine actually renders.** `VIDEO_PROMPT` produces text; the render needs a live engine. Today none is usable (ComfyUI half-configured/off; no cloud key). → Set `FAL_KEY` and enable **Seedance 2.0** (see `SEEDANCE-ENGINE.md`). That single step turns "Generate video" from a 500 into a real clip.

**B. The pipeline is "one short clip," not "a series."** You want total duration → N episodes → scenes (≤5s). The current ladder yields a flat 5-shot list (~25s). The fix is structural (Part 6).

---

## 3) Best practice — AI vertical serial video, 2026

The research strongly confirms your instinct. The dominant format and method:

- **Structure:** serialized vertical micro-drama — **60–80 episodes/series, 60–90s per episode**, each episode built from **several short scenes**, **each scene a separate ≤5s clip**, then **stitched**. Every episode ends on a **cliffhanger**.
- **Why ≤5s scenes:** it matches model clip limits, keeps character/motion consistent, and fits the "pattern interrupt every 2–3s" retention rule (angle change / push-in / text).
- **Character consistency — the #1 technique:** **reference images, not text re-description.** The rule is *"identity lives in the reference, action lives in the prompt."* Use 3–5 refs per character (frontal, ¾, full outfit); chain the **last frame of clip N as the reference for clip N+1** for continuity. This reaches ~90–95% consistency vs. the drift you get from re-describing a character every shot (which is what our prompts do today).
- **Engine fit:** **Seedance 2.0** (the one we wired) is the consistency leader for this exact use — it accepts **up to 9 reference images + 3 video + 3 audio per generation**, native audio, multi-shot to 15s. Veo 3.1 (3 refs, strong prompt adherence, 4K portrait) and Kling 3.0 (Character ID, multi-shot storyboard) are the main alternatives. No single "best" — Seedance is the right default for character-driven serial drama.
- **Audio is non-negotiable:** lip-sync + ambient + an emotional underscore. Silent AI video reads as amateur. Seedance generates native audio.
- **Assembly:** generate each beat as a clip → stitch (ffmpeg / CapCut / Resolve) → burn subtitles → 9:16. ~25–35 min of compute per episode; an 80-episode series in 1–2 weeks.

---

## 4) Current ScriptON vs. the target

| Layer | Today | Target |
|---|---|---|
| Intake | one 5s piece, 9:16 | total duration **or** episode count × episode length → scenes/episode |
| Ladder | PREMISE → SHOT_LIST → VIDEO_PROMPT (flat) | PREMISE → STORY_ENGINE → EPISODE_MAP → per-episode SCENE_LIST (≤5s) → VIDEO_PROMPT/scene |
| Character | re-described in every prompt (drifts) | **character bible + reference images** fed to Seedance (locks identity) |
| Render | broken (no engine) | per-scene ≤5s Seedance clip, last-frame → next ref |
| Output | (none) | scenes **stitched into an episode**, subtitles + audio, cliffhanger |

Good news: ScriptON **already has** the episodic micro-drama ladder (`PREMISE → STORY_ENGINE → BEAT_ENGINE`, sized for 60–90s episodes) in the *Vertical micro-drama* family. `VERTICAL_AI_VIDEO` just needs to **adopt that episode structure** and add the **render + stitch** layer — most pieces already exist.

---

## 5) Target architecture (duration → episodes → scenes → clips → episodes)

```
Intake:   episodes (N) + episode length (60–90s)  →  scenes/episode = round(len / 5)
            │
PREMISE ──► STORY_ENGINE ──► EPISODE_MAP (per-ep logline + cliffhanger)
            │
   per episode:  SCENE_LIST (≤5s beats)  ──►  VIDEO_PROMPT per scene  (self-contained prompt)
            │
CHARACTER BIBLE → reference image(s) per character  ──┐  (identity in reference)
            │                                          ▼
   per scene:  Seedance render (≤5s clip, 9:16, ref image + frame-chain, native audio)
            │
   per episode:  STITCH scenes (ffmpeg) → subtitles → episode.mp4  (ends on cliffhanger)
            │
SERIES view: all episodes, export
```

Engine: **Seedance 2.0** (already wired, config-driven). The per-scene render already maps cleanly to it (prompt + 9:16 + ≤5s + seed); the missing pieces are the **episode/scene layer**, the **character-reference** input, and the **stitch** step.

---

## 6) Roadmap (phased — each phase is independently shippable)

**Phase 0 — prove the render (now, ~1 setting):** set `FAL_KEY`, enable Seedance, click "▶ Generate video" on a VIDEO_PROMPT shot → confirm a real 5s clip returns and shows in Recent Runs. This validates the whole render path with zero new code.

**Phase 1 — episodic intake + ladder:** add *episode count* + *episode length* to the AI-video intake; derive scenes/episode (len ÷ 5); switch `VERTICAL_AI_VIDEO` to the episodic ladder (PREMISE → STORY_ENGINE → EPISODE_MAP → per-episode SCENE_LIST → VIDEO_PROMPT/scene). Also fix the load-order so the correct ladder shows without a refresh.

**Phase 2 — character consistency (the head-shot step — your point, and it's the #1 quality lever):** before *any* video, generate **2–3 approved reference head-shots per character** and feed them to every scene so the face/outfit can't drift.
- **Recommended engine for our stack: Seedream 4.5** (ByteDance's image model) — it runs on the **same fal account / `FAL_KEY`** as Seedance, is the highest-quality image model in the ByteDance family, holds ~5 characters consistent without fine-tuning, and is the *natural anchor* for Seedance video. Alternatives: **Nano Banana Pro** (best pure-headshot realism, held eye-line, skin texture), **Flux Kontext / Ideogram V3** (top-tier identity).
- **Flow:** script → **Character Bible** (one tight description per character) → generate head-shots (**straight-on · ¾ · profile, same lighting/session**) → **you approve or regenerate** → the approved stills anchor each scene's Seedance render.
- **Rules that matter:** *identity lives in the reference, action lives in the prompt*; use **2–3 stills max** with **similar angles** (mixing front + profile makes Seedance invent features); repeat one **stable identity phrase every scene**; weight **~70% identity / 30% motion**. Optional: chain the **last frame of scene N as a reference for scene N+1** for seamless continuity.

**Phase 3 — render + stitch a full episode:** batch-render every scene of an episode, **stitch** with ffmpeg, burn subtitles, keep Seedance's native audio → one finished 60–90s episode ending on its cliffhanger.

**Phase 4 — series:** the Slate/Versions views list episodes; export; iterate. (Optional: voice/dubbing per character, music under cliffhangers.)

---

## 7) Immediate fixes already applied
- The render endpoint now returns a **clear, actionable message** instead of a 500 (and rejects an empty prompt with "generate VIDEO_PROMPT first").

## Recommended next step
Do **Phase 0** to confirm a clip actually renders (set `FAL_KEY` + enable Seedance), then I build **Phase 1** (episodic intake + ladder) — that's the change that turns this from "one 5s clip" into "a 60–90s episode made of ≤5s scenes," which is exactly the trend.

## Sources
- [How to Make AI Micro Dramas for TikTok & Reels (2026) — MuleRun](https://blog.mulerun.com/p/how-to-make-ai-micro-dramas-for-tiktok-and-reels-2026/)
- [AI micro-dramas — VML](https://www.vml.com/insight/ai-micro-dramas)
- [AI Is Rewriting the Vertical Short Drama Industry — Real Reel](https://www.real-reel.com/ai-is-rewriting-vertical-drama-microdrama-industry/)
- [Best AI Video Generator 2026: Veo 3.1 vs Kling 3.0 vs Seedance 2.0 — 3DAI Studio](https://www.3daistudio.com/blog/best-ai-video-generator-2026)
- [AI Video Models Comparison 2026 — OpenCreator](https://opencreator.io/blog/ai-video-models-comparison-2026)
- [How to Keep AI Characters Consistent Across Scenes (2026) — Vertical Motion](https://motion.verticalstudio.ai/blog/ai-character-consistency-guide)
- [Character consistency workflow (first frame / end frame) — Kittl](https://www.kittl.com/blogs/ai-video-character-consistency-workflow/)
- [How to Create AI Short Dramas Solo — Genra](https://genra.ai/blog/ai-short-drama-tools-workflow-2026)
