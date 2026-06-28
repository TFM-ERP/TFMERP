# ScriptON Backend Extension: VERTICAL_AI_VIDEO Format

**Target AI:** This document is an execution plan to extend the ScriptON backend with a new 5-second vertical AI video generation pipeline. The frontend UI is already complete. Focus strictly on the NestJS backend and Prisma schema updates. This is additive — do not modify existing cinema/TV format logic.

---

## 0. Verified context — READ FIRST (checked against the live codebase)

**Frontend is done** (in `frontend/src/components/scripton/ScriptOnIntake.tsx`, committed/in working tree). The brief already carries these fields via the existing `...f` spread — read these exact names server-side:
`durationSec` (int 3–10) · `aspectRatio` (`'9:16' | '16:9' | '1:1'`) · `negativePrompt` (string) · `seed` (int) · `videoStyle` (string[]) · `projectType === 'VERTICAL_AI_VIDEO'`.
The format chip is gated behind `localStorage['scripon.aiVideoPreview'] === '1'`. **When this backend lands, remove that gate** (the `PTYPES.filter` in `ScriptOnIntake.tsx`) so it ships.

**Corrections to the steps below (verified against real files):**
1. `stageBrief(kind, framework)` (`scripton.service.ts:575`) returns **`{ system, shape }`** — the `shapeInstruction` referenced in step 3 is the **`shape`** field.
2. `normalizeFamily` (`formats.ts:76`) returns the union **`FormatPreset['family']`** — extend that union type to include `'VERTICAL_AI_VIDEO'`, or `normalizeFamily` won't type-check.
3. There is already a `VERTICAL_LADDER` (`formats.ts:26`, micro-drama) and `VERTICAL_PRESETS`. Keep `VERTICAL_AI_LADDER` **distinct**; do not touch the `VERTICAL` family.
4. Prisma schema path is **`backend/prisma/schema.prisma`**.
5. `PrismaService` is at **`backend/src/common/prisma/prisma.service.ts`** — the `VideoService` import is `../common/prisma/prisma.service` (already corrected below). Wire the new module so the Prisma provider is available (mirror how other domains import it).
6. Robustness: in `checkJobStatus`, null-guard the `findUnique` result and handle the unknown-provider case so `updatedStatus` is never undefined.

---

## 1. Update Knowledge Formats (`backend/src/production/scripton/knowledge/formats.ts`)
Add the new format to the normalizer and create a custom stage ladder.

- Extend the `FormatPreset['family']` union to include `'VERTICAL_AI_VIDEO'`.
- In `normalizeFamily`, add `'VERTICAL_AI_VIDEO'` as a return type and map it when `brief.projectType === 'VERTICAL_AI_VIDEO'`.
- Define `VERTICAL_AI_LADDER = ['PREMISE', 'SHOT_LIST', 'VIDEO_PROMPT'];`
- In `stageLadderFor(brief)`, return `VERTICAL_AI_LADDER` if the normalized family is `VERTICAL_AI_VIDEO`.

## 2. Update Directives (`backend/src/production/scripton/knowledge/index.ts`)
Inject the strict rules for video AI models into the system context.

- Create a new function `videoDirective(brief: any): string` that returns:
  ```text
  FORMAT CRITICAL: This is a ${brief.durationSec || 5}-second vertical video generation pipeline.
  ASPECT RATIO: ${brief.aspectRatio || '9:16'}.
  NEGATIVE PROMPTS: Avoid: ${brief.negativePrompt || 'blurry, deformed, text'}.
  RULE 1: No abstract concepts. Describe observable, physical motion only.
  RULE 2: Strict character consistency. Use exact physical tags for characters across all shots.
  RULE 3: Each shot must contain only ONE primary action.
  ```
- In `knowledgeDirective(brief)`, if the family is `VERTICAL_AI_VIDEO`, push `videoDirective(brief)` onto the parts array.

## 3. Update Generation Prompts (`backend/src/production/scripton/scripton.service.ts`)
Intercept the `VIDEO_PROMPT` stage to output the structured JSON payload.

- Inside `stageBrief(kind)`, add an evaluation for `kind === 'VIDEO_PROMPT'`:
  - `system`: `"You are an elite AI Cinematic Director. Break the story down into a strict JSON array of visual shots. Each shot represents EXACTLY the requested video duration."`
  - `shape` (the structured-output instruction):
    ```
    Return ONLY JSON matching this exact structure:
    {
      "format": "VERTICAL_AI_VIDEO",
      "aspectRatio": "9:16",
      "shots": [
        {
          "index": 0,
          "durationSec": 5,
          "reading_dialogue": "Character: text or None",
          "prompt": "<highly descriptive positive text-to-video prompt prioritizing physical movement>",
          "negativePrompt": "<the exact negative prompt provided in the directive>",
          "camera_movement": "<e.g., slow push-in, fast pan right>",
          "audio_fx_ambiance": "<e.g., heavy bass drone>",
          "seed": <integer>
        }
      ]
    }
    ```

## 4. Prisma Schema Update (`backend/prisma/schema.prisma`)
Add a new model to handle the asynchronous job polling pattern required by AI video APIs.

```prisma
model VideoRun {
  id              String   @id @default(cuid())
  projectId       String
  stageVersionId  String?  // Links back to the StageVersion.data payload
  provider        String   // "runway" | "local_comfy"
  model           String
  jobId           String
  status          String   @default("PENDING") // PENDING, PROCESSING, COMPLETED, FAILED
  videoUrl        String?
  prompt          String   @db.Text
  negativePrompt  String?  @db.Text
  durationSec     Int
  aspectRatio     String
  latencyMs       Int?
  error           String?  @db.Text
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([projectId])
  @@index([jobId])
  @@map("video_runs")
}
```

Run `npx prisma db push` or `prisma migrate dev` after adding this block.

## 5. Scaffold the VideoService (`backend/src/video/`)
Create a new domain dedicated to asynchronous API polling, prioritizing local ComfyUI endpoints with cloud fallback options like Runway Gen-4.5.

**File: `backend/src/video/providers.ts`**

```typescript
export type VideoProvider = 'runway' | 'local_comfy';

export interface VideoGenerationParams {
  prompt: string;
  negativePrompt?: string;
  durationSec: number;
  aspectRatio: string;
  seed?: number;
}

export interface VideoJobResponse {
  jobId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  videoUrl?: string;
  error?: string;
}
```

**File: `backend/src/video/video.service.ts`**
Create a NestJS service `VideoService` with the following implementation:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { VideoGenerationParams, VideoJobResponse, VideoProvider } from './providers';

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);

  constructor(private prisma: PrismaService) {}

  async generateShot(
    projectId: string,
    provider: VideoProvider,
    model: string,
    params: VideoGenerationParams
  ): Promise<string> {

    let jobResponse: VideoJobResponse;

    // Switchboard routing handles both local rendering nodes and cloud API fallbacks
    switch (provider) {
      case 'local_comfy':
        jobResponse = await this.callLocalComfyUI(model, params);
        break;
      case 'runway':
        jobResponse = await this.callRunwayApi(model, params);
        break;
      default:
        throw new Error(`Unsupported video provider: ${provider}`);
    }

    const run = await this.prisma.videoRun.create({
      data: {
        projectId,
        provider,
        model,
        jobId: jobResponse.jobId,
        status: jobResponse.status,
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        durationSec: params.durationSec,
        aspectRatio: params.aspectRatio,
      }
    });

    return run.id;
  }

  async checkJobStatus(runId: string): Promise<VideoJobResponse> {
    const run = await this.prisma.videoRun.findUnique({ where: { id: runId } });
    if (!run) throw new Error(`VideoRun not found: ${runId}`);

    if (run.status === 'COMPLETED' || run.status === 'FAILED') {
        return { jobId: run.jobId, status: run.status as any, videoUrl: run.videoUrl };
    }

    let updatedStatus: VideoJobResponse;

    if (run.provider === 'local_comfy') {
        // Polling logic for ComfyUI API /history endpoint
        updatedStatus = { jobId: run.jobId, status: 'PROCESSING' }; // Stub implementation
    } else if (run.provider === 'runway') {
        // Polling logic for Runway task status endpoint
        updatedStatus = { jobId: run.jobId, status: 'PROCESSING' }; // Stub implementation
    } else {
        updatedStatus = { jobId: run.jobId, status: run.status as any };
    }

    if (updatedStatus && updatedStatus.status !== run.status) {
       await this.prisma.videoRun.update({
         where: { id: runId },
         data: {
           status: updatedStatus.status,
           videoUrl: updatedStatus.videoUrl,
           updatedAt: new Date()
         }
       });
    }

    return updatedStatus || { jobId: run.jobId, status: run.status as any };
  }

  private async callLocalComfyUI(model: string, params: VideoGenerationParams): Promise<VideoJobResponse> {
    // Scaffold for ComfyUI REST API (/prompt endpoint).
    // The implementation will dynamically construct the JSON workflow mapping
    // the params (prompt, negativePrompt, seed) into the standard ComfyUI API format.
    return { jobId: `comfy_${Date.now()}`, status: 'PENDING' };
  }

  private async callRunwayApi(model: string, params: VideoGenerationParams): Promise<VideoJobResponse> {
    // Scaffold for Runway API endpoints (Gen-4.5).
    // Handles specific payload formatting per Runway's SDK/API requirements.
    return { jobId: `runway_${Date.now()}`, status: 'PENDING' };
  }
}
```

Register `VideoService` in a `VideoModule` (and provide `PrismaService` the same way other domains do) so it can be injected into the build pipeline.
