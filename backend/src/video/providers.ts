/**
 * Video provider contracts for the VERTICAL_AI_VIDEO pipeline.
 * Primary = local ComfyUI (RTX 5080); cloud = Runway Gen-4.5 + Seedance 2.0 (ByteDance, via fal.ai).
 */
export type VideoProvider = 'runway' | 'local_comfy' | 'seedance';

export interface VideoGenerationParams {
  prompt: string;
  negativePrompt?: string;
  durationSec: number;
  aspectRatio: string;
  seed?: number;
  // Continuity / cohesive-episode pipeline (Seedance image-to-video & reference-to-video):
  imageUrl?: string;      // starting frame (character anchor, or previous clip's last frame → chaining)
  endImageUrl?: string;   // optional ending frame (start→end transition)
  imageUrls?: string[];   // reference identity images (@Image1…@Image9) for reference-to-video Face Lock
  videoUrls?: string[];   // reference videos (@Video1…@Video3) — pass the previous clip → scene continuity
  generateAudio?: boolean; // native dialogue + music + SFX in one pass (Seedance, free)
}

export interface VideoJobResponse {
  jobId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  videoUrl?: string;
  error?: string;
}
