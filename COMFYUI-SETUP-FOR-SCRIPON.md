# ComfyUI Setup for ScripON Vertical AI Video

Tailored to **your machine** (Windows, RTX 4080 16GB) and **your backend** (`C:\Projects\TFM-System\backend`). Follow the steps in order. Steps 1–4 happen on ComfyUI; steps 5–6 are the ScripON wiring (I can do most of 5 and all of 6 for you).

> **The big picture.** Your `VideoService` is already written — it just POSTs your saved workflow to ComfyUI and polls for the finished video. So all you're really doing here is: (a) get ComfyUI running, (b) build one 9:16 video workflow, (c) export it, (d) point your `.env` at it. Then I wire the button.

---

## Step 1 — Install ComfyUI (≈15 min)

**Recommended: ComfyUI Desktop** (one-click, auto-installs Python + everything).

1. Go to **https://www.comfy.org/download** and download the Windows installer.
2. Run it, accept defaults. When asked where to keep models/outputs, pick a drive with **plenty of space** (video models are several GB) — e.g. `C:\AI\ComfyUI`. Avoid paths with spaces.
3. Launch it. It opens your browser at **http://127.0.0.1:8188**. That address is already your backend's default, so you won't need to set `COMFYUI_BASE_URL`.

*(Alternative: the portable build — `ComfyUI_windows_portable_nvidia.7z` from https://github.com/comfyanonymous/ComfyUI/releases, extracted with 7-Zip. Same result. **Skip Docker** — on a single Windows PC it's the harder path with no benefit here.)*

Your RTX 4080 is fully supported out of the box — no special PyTorch/driver workarounds (those are only for 50-series cards).

---

## Step 2 — Get the Wan 2.2 **5B** model (the 16GB sweet spot)

Do **not** download the 14B model — its native version wants ~60GB VRAM. The **5B** variant fits your 16GB comfortably (~8GB used) and makes a 5-sec 720p clip in under ~9 minutes.

1. In ComfyUI's top menu: **Workflow → Browse Templates → Video**.
2. Find **"Wan 2.2 5B"** (a.k.a. *Wan 2.2 5B Video Generation / TI2V-5B*) and click it.
3. ComfyUI will prompt to **download the missing model files** — let it. (If it doesn't, install **ComfyUI Manager** and use "Install Models", or it'll link the exact HuggingFace files.) This is the multi-GB download — let it finish.

*Faster alternative if you care more about speed than quality: the **LTX-2** template (also under Video) is built for fast generation. Wan 2.2 5B is the better all-rounder; start there.*

---

## Step 3 — Make it 9:16 and do a TEST render

Before touching ScripON, confirm ComfyUI works on its own.

1. In the loaded template, find the **video size / latent** node. Set it to a **vertical 9:16**: width **720**, height **1280** (or 576×1024 to save VRAM — that's what your backend defaults to).
2. Type any test prompt in the **positive** text box (e.g. *"a neon city street at night, slow camera push-in, rain"*).
3. Click **Run / Queue Prompt**. First run is slow (it loads the model into VRAM). When it finishes you'll see a short vertical video in the output node. ✅ ComfyUI is working.

If this fails, stop here and tell me the error — no point wiring ScripON to a broken workflow.

---

## Step 4 — Export the workflow as **API JSON**

This JSON file is literally what `COMFYUI_WORKFLOW_PATH` points at.

1. Open ComfyUI **Settings** (gear icon) → enable **"Dev mode"** (a.k.a. *Enable dev mode options*).
2. A new button appears: **"Save (API Format)"**. Click it.
3. Save it somewhere stable, e.g. `C:\AI\ComfyUI\scripon-vertical.api.json`. **Keep the path** — you'll need it in Step 5.

> Note: this is *Save (API Format)*, NOT the normal Save. The normal save produces a different JSON that the backend can't use.

---

## Step 5 — Wire it into ScripON's `.env`

Your backend reads these from `C:\Projects\TFM-System\backend\.env`:

```
COMFYUI_WORKFLOW_PATH=C:\AI\ComfyUI\scripon-vertical.api.json
# COMFYUI_BASE_URL=http://127.0.0.1:8188     # leave commented — this is already the default
# Node-ID overrides — almost certainly NEEDED for the Wan template (see below):
# COMFYUI_NODE_POSITIVE=...
# COMFYUI_NODE_NEGATIVE=...
# COMFYUI_NODE_LATENT=...
# COMFYUI_NODE_SAMPLER=...
```

**Why the node-ID overrides matter:** your backend edits four nodes in the workflow by their ID number — positive prompt (`4`), negative prompt (`5`), size (`6`), seed (`3`). Those defaults match a basic image workflow, **not** the Wan video template, whose nodes have different IDs. If you skip this, your prompt won't actually get injected.

**Easiest fix: let me do it.** Once you've saved the `.api.json` (Step 4), tell me and I'll read that file straight from your repo, find the right node IDs, and set all four `COMFYUI_NODE_*` values in your `.env` correctly. It's a 2-minute job for me and fiddly by hand.

---

## Step 6 — The missing controller + go live (I do this)

This is the gap your dev flagged: `VideoService` works but **nothing calls it yet** — there's no API endpoint, so the UI can't start a render. I'll:

1. Add a **`VideoController`** — `POST` to start a render from a shot, `GET status/:runId` to poll.
2. Wire the trigger (optionally auto-fire when the `VIDEO_PROMPT` stage completes).
3. Run `npm run build` to confirm types compile.
4. Flip the `scripon.aiVideoPreview` gate so the "Vertical AI Video" option ships.
5. Test one render end-to-end with ComfyUI running.

---

## What to expect / sanity checks

- **ComfyUI must be running** (that browser window/app open) whenever ScripON renders — the backend talks to it live on port 8188.
- First render after launch is always the slowest (model loads into VRAM); later ones are faster.
- Rough time: ~5–9 min per 5-sec clip on your 4080 with Wan 2.2 5B. A **speed LoRA** can cut that a lot later.
- Runway stays available as a cloud fallback (just needs `RUNWAYML_API_SECRET`) if you ever want renders without your PC on — but you don't need it for the local path.

---

### Your move
Do **Steps 1–4** at your own pace. The moment your `.api.json` exists, ping me — I'll handle Step 5 (the node IDs) and Step 6 (the controller) and get you to a working "generate" button. Or, if you'd like, I can drive Steps 1–4 live on your screen.
