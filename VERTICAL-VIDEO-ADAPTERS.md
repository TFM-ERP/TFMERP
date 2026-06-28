# ScriptON · VideoService Execution Adapters (ComfyUI + Runway)

**Apply this AFTER Claude Code lands the boilerplate from `VERTICAL-VIDEO-EXTENSION.md`.** These replace the mock stubs in `backend/src/video/video.service.ts` with real provider calls + real polling. ComfyUI (local, RTX 5080) is the primary path; Runway Gen-4.5 is the cloud fallback.

## Env vars
```
COMFYUI_BASE_URL=http://127.0.0.1:8188      # local ComfyUI server
RUNWAYML_API_SECRET=...                      # Runway developer key (fallback only)
```

## ⚠ Verified corrections vs the draft snippet (checked against current Runway docs, June 2026)
- Runway base host is **`https://api.dev.runwayml.com`** (the draft used `api.runwayml.com`).
- The **`X-Runway-Version: 2024-11-06`** header is **required** — requests 400 without it.
- `ratio` is now a **resolution string** (`720:1280` vertical, `1280:720` landscape) — Gen-4.5 no longer accepts `9:16` / `16:9`.
- Body field is **`promptText`** (not `prompt`); endpoint is **`/v1/image_to_video`** for both image- and text-to-video.
- **Gen-4.5 has no `negativePrompt` / `seed` params** — those only apply to the local ComfyUI workflow. For Runway, fold avoid-terms into `promptText`.
- ComfyUI node IDs (`"3" "4" "5" "6"`) are placeholders — map them to **your** exported API-format workflow.

---

## 1. `callLocalComfyUI` — local RTX 5080 (primary)

Export your 9:16 video workflow from the ComfyUI UI as **API Format** JSON (Settings → enable dev mode → "Save (API Format)"), drop it in as `workflow`, then mutate the node inputs:

```typescript
private async callLocalComfyUI(model: string, params: VideoGenerationParams): Promise<VideoJobResponse> {
  const base = process.env.COMFYUI_BASE_URL || 'http://127.0.0.1:8188';

  // Your exported ComfyUI API-format graph. Node IDs are strings; map them to YOUR workflow.
  const workflow: any = { /* ...your 5-second vertical ComfyUI API JSON... */ };

  // Inject ScriptON params into the corresponding nodes:
  workflow['4'].inputs.text = params.prompt;                 // CLIPTextEncode (positive)
  workflow['5'].inputs.text = params.negativePrompt || '';   // CLIPTextEncode (negative)
  workflow['6'].inputs.width = params.aspectRatio === '16:9' ? 1024 : 576;   // 9:16 → 576×1024
  workflow['6'].inputs.height = params.aspectRatio === '16:9' ? 576 : 1024;
  workflow['3'].inputs.seed = params.seed || Math.floor(Math.random() * 1_000_000_000); // KSampler

  const res = await fetch(`${base}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: `scripton_${Date.now()}` }),
  });
  if (!res.ok) throw new Error(`ComfyUI API Error: ${res.status} ${res.statusText}`);

  const data = await res.json();
  // ComfyUI returns { prompt_id } which becomes our VideoRun.jobId.
  return { jobId: data.prompt_id, status: 'PROCESSING' };
}
```

## 2. `callRunwayApi` — Gen-4.5 cloud fallback

```typescript
private async callRunwayApi(model: string, params: VideoGenerationParams): Promise<VideoJobResponse> {
  // Gen-4.5 supports text-to-video: omit promptImage for a pure-text ScriptON brief.
  // ratio is a RESOLUTION string, not '9:16'. (Confirm supported values on the Models page.)
  const ratio = params.aspectRatio === '16:9' ? '1280:720' : '720:1280'; // 9:16 → 720:1280

  const res = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RUNWAYML_API_SECRET}`,
      'X-Runway-Version': '2024-11-06',           // REQUIRED
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'gen4.5',
      promptText: params.prompt,                  // negative/seed are not gen4.5 params
      ratio,
      duration: params.durationSec || 5,
    }),
  });
  if (!res.ok) throw new Error(`Runway API Error: ${res.status} ${res.statusText}`);

  const data = await res.json();
  // Runway returns a task { id } to poll.
  return { jobId: data.id, status: 'PENDING' };
}
```

## 3. `checkJobStatus` — real polling for both providers

Replaces the PROCESSING stub. Routes to the right poller, then persists any COMPLETED/FAILED transition.

```typescript
async checkJobStatus(runId: string): Promise<VideoJobResponse> {
  const run = await this.prisma.videoRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error(`VideoRun not found: ${runId}`);

  if (run.status === 'COMPLETED' || run.status === 'FAILED') {
    return { jobId: run.jobId, status: run.status as any, videoUrl: run.videoUrl ?? undefined };
  }

  let next: VideoJobResponse;
  if (run.provider === 'local_comfy')      next = await this.pollComfyUI(run.jobId);
  else if (run.provider === 'runway')      next = await this.pollRunway(run.jobId);
  else                                     next = { jobId: run.jobId, status: run.status as any };

  if (next.status !== run.status || (next.videoUrl && next.videoUrl !== run.videoUrl)) {
    await this.prisma.videoRun.update({
      where: { id: runId },
      data: { status: next.status, videoUrl: next.videoUrl ?? null, error: next.error ?? null },
    });
  }
  return next;
}

private async pollComfyUI(promptId: string): Promise<VideoJobResponse> {
  const base = process.env.COMFYUI_BASE_URL || 'http://127.0.0.1:8188';
  const res = await fetch(`${base}/history/${promptId}`);
  if (!res.ok) return { jobId: promptId, status: 'PROCESSING' };

  const hist = await res.json();
  const entry = hist[promptId];
  if (!entry) return { jobId: promptId, status: 'PROCESSING' };          // still queued/running

  if (entry.status?.status_str === 'error') {
    return { jobId: promptId, status: 'FAILED', error: 'ComfyUI workflow error' };
  }

  // Find the first saved video/gif/image output (the key depends on your save node, e.g. VHS_VideoCombine → gifs).
  const outputs = entry.outputs || {};
  for (const nodeId of Object.keys(outputs)) {
    const files = outputs[nodeId].gifs || outputs[nodeId].videos || outputs[nodeId].images;
    if (files?.length) {
      const f = files[0];
      const url = `${base}/view?filename=${encodeURIComponent(f.filename)}`
                + `&subfolder=${encodeURIComponent(f.subfolder || '')}`
                + `&type=${encodeURIComponent(f.type || 'output')}`;
      return { jobId: promptId, status: 'COMPLETED', videoUrl: url };
    }
  }
  return { jobId: promptId, status: 'PROCESSING' };
}

private async pollRunway(taskId: string): Promise<VideoJobResponse> {
  const res = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
    headers: {
      'Authorization': `Bearer ${process.env.RUNWAYML_API_SECRET}`,
      'X-Runway-Version': '2024-11-06',
    },
  });
  if (!res.ok) return { jobId: taskId, status: 'PROCESSING' };

  const data = await res.json();
  // Runway task status: PENDING | RUNNING | THROTTLED | SUCCEEDED | FAILED
  if (data.status === 'SUCCEEDED') return { jobId: taskId, status: 'COMPLETED', videoUrl: data.output?.[0] };
  if (data.status === 'FAILED')    return { jobId: taskId, status: 'FAILED', error: data.failure || data.failureCode };
  return { jobId: taskId, status: 'PROCESSING' };
}
```

## 4. Notes for go-live
- **ComfyUI status semantics:** an absent `history[promptId]` means still running; once present with `status.status_str === 'success'`, the file is in `outputs`. Video save nodes (e.g. `VHS_VideoCombine`) list under `gifs`; adjust the key to your node.
- **Runway is image_to_video for both modes** — text-to-video just omits `promptImage`. Verify the exact vertical resolution string (`720:1280`) on the [Models](https://docs.dev.runwayml.com/guides/models/) page for Gen-4.5; the supported set can vary by model.
- **negativePrompt / seed** only steer the local ComfyUI graph. If you later want determinism on Runway, check whether the current model exposes a seed param before relying on it.
- Consider a short poll interval (2–4 s) with a hard timeout; a 5-second clip typically renders in well under a minute locally.

## Sources
- [Runway API — Getting Started (auth, version header, gen4.5 text-to-video, ratio)](https://docs.dev.runwayml.com/guides/using-the-api/)
- [Runway API — Version 2024-11-06 (ratio = resolution string)](https://docs.dev.runwayml.com/api-details/versions/2024-11-06/)
- [Runway API — Models](https://docs.dev.runwayml.com/guides/models/)
