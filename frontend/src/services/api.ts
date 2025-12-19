/**
 * API Service Layer for Adobe Firefly Demo
 *
 * All API calls are proxied through /api to the FastAPI backend
 * running at localhost:8000 (configured in vite.config.ts)
 */

import axios from "axios";

import type {
  S3Image,
  JobStatus,
  CropImagePayload,
  CropImageResponse,
  RemoveBackgroundPayload,
  VideoReframePayload,
  VideoReframePayloadV2,
  VideoReframeResponse,
  ResizePayload,
  ColorGradePayload,
  BannerVariantsPayload,
  PresignedUrlResponse,
  JobSubmitResponse,
  TextToVideoPayload,
  TextToVideoResponse,
  AutoTonePayload,
  AutoToneResponse,
  ExpandImagePayload,
  ExpandImageResponse,
  ImageUploadResponse,
} from "@/types";

const API_BASE = "/api";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ============================================
// Helper Functions
// ============================================

async function fetchWithCredentials<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "include", // Include cookies for access token
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============================================
// Authentication
// ============================================

export async function generateAccessToken(): Promise<{ access_token: string }> {
  return fetchWithCredentials(`${API_BASE}/generate-access-token`, {
    method: "POST",
  });
}

// ============================================
// S3 Image Operations
// ============================================

export async function listS3Images(): Promise<S3Image[]> {
  // TODO: Backend endpoint needed to list images from firefly-images-demo-bucket
  // For now, return mock data
  console.warn(
    "listS3Images: Using mock data - backend endpoint not yet implemented",
  );
  const response = await api.get(
    "/get-s3-thumbnails?bucket_name=firefly-images-demo-bucket&prefix=thumbnails",
  );
  const data = await response.data;
  return data.map((image: any, index: number) => ({
    key: index,
    url: image[0],
    name: image[1],
  }));
}

export async function getPresignedDownloadUrl(
  name: string,
): Promise<PresignedUrlResponse> {
  // TODO: Backend endpoint needed to generate presigned GET URL
  const response = await api.get(
    `/get-s3-presigned-url?bucket_name=firefly-images-demo-bucket&key=${name}&method=get_object`,
  );
  const data = await response.data;
  return data;
}

export async function getPresignedUploadUrl(
  name: string,
): Promise<PresignedUrlResponse> {
  // TODO: Backend endpoint needed to generate presigned PUT URL
  const response = await api.get(
    `/get-s3-presigned-url?bucket_name=firefly-images-demo-bucket&key=${name}&method=put_object`,
  );
  const data = await response.data;
  return data;
}

// ============================================
// Crop Image Operations
// ============================================

export async function submitCropJob(
  payload: CropImagePayload,
): Promise<CropImageResponse> {
  const response = await api.post("/crop-image", payload);
  return response.data;
}

// ============================================
// Remove Background Operations
// ============================================

export async function submitRemoveBackgroundJob(
  payload: RemoveBackgroundPayload,
): Promise<JobSubmitResponse> {
  return fetchWithCredentials(`${API_BASE}/remove-background-async`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ============================================
// Auto Tone Operations
// ============================================

export async function submitAutoToneJob(
  payload: AutoTonePayload,
): Promise<AutoToneResponse> {
  return fetchWithCredentials(`${API_BASE}/auto-tone`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function checkLightroomJobStatus(
  jobId: string,
): Promise<JobStatus> {
  const response = await fetchWithCredentials<{
    jobId?: string;
    outputs?: Array<{
      status: string;
      _links?: {
        self?: { href: string };
      };
    }>;
  }>(`${API_BASE}/lightroom-status?job_id=${jobId}`);

  const outputStatus = response.outputs?.[0]?.status || "pending";

  return {
    jobId: response.jobId || jobId,
    status: outputStatus as JobStatus["status"],
    outputs: response.outputs?.map((o) => ({
      url: o._links?.self?.href || "",
      status: o.status,
    })),
  };
}

// ============================================
// Text to Video Operations
// ============================================

export async function submitTextToVideoJob(
  payload: TextToVideoPayload,
): Promise<TextToVideoResponse> {
  return fetchWithCredentials(`${API_BASE}/generate-video-from-text`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function checkVideoJobStatus(jobId: string): Promise<JobStatus> {
  const response = await fetchWithCredentials<{
    jobId: string;
    status?: string;
    outputs?: { status: string; url?: string }[];
    result?: { outputs?: { seed: number; video: { url: string } }[] };
  }>(`${API_BASE}/check-status?job_id=${jobId}`);

  const status = response.status || response.outputs?.[0]?.status || "pending";

  return {
    jobId: response.jobId || jobId,
    status: status as JobStatus["status"],
    outputs: response.outputs?.map((o) => ({
      url: o.url || "",
      status: o.status,
    })),
    result: {
      outputs: response.result?.outputs?.map((output) => ({
        video: { url: output.video.url || "" },
        seed: output.seed,
      })),
      size: {
        width: response.result?.size?.width || 0,
        height: response.result?.size?.height || 0,
      },
    },
  };
}

// ============================================
// Video Reframe Operations
// ============================================

export async function submitVideoReframeJob(
  payload: VideoReframePayloadV2,
): Promise<VideoReframeResponse> {
  return fetchWithCredentials(`${API_BASE}/reframe-video`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function checkAudioVideoJobStatus(
  jobId: string,
): Promise<JobStatus> {
  const response = await fetchWithCredentials<{
    jobId?: string;
    status?: string;
    outputs?: Array<{
      aspectRatio?: {
        x: number;
        y: number;
      };
      status: string;
      mediaDestination?: { url: string };
      renditions?: Array<{
        url?: string;
        mediaDestination?: { url: string };
      }>;
    }>;
  }>(`${API_BASE}/check-audio-video-status?job_id=${jobId}`);

  const outputStatus =
    response.status || response.outputs?.[0]?.status || "pending";

  console.log(`check video response: ${JSON.stringify(response)}`);
  return {
    jobId: response.jobId || jobId,
    status: outputStatus as JobStatus["status"],
    outputs: response.outputs?.map((o) => ({
      url: o.mediaDestination?.url || "",
      aspectRatio: o.aspectRatio || undefined,
      mediaDestination: o.mediaDestination || undefined,
      status: o.status,
    })) || [{ url: "", status: outputStatus }],
  };
}

// ============================================
// Expand Image Operations
// ============================================

export async function fetchImageFromS3Proxy(imageName: string): Promise<Blob> {
  // Fetch the image through the backend proxy (avoids CORS)
  const response = await fetch(
    `${API_BASE}/proxy-s3-image?image_name=${encodeURIComponent(imageName)}`,
    {
      method: "GET",
      credentials: "include",
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP ${response.status}`);
  }

  return response.blob();
}

export async function uploadImageForExpand(
  imageName: string,
): Promise<ImageUploadResponse> {
  // Step 1: Fetch the image through backend proxy (avoids CORS)
  const blob = await fetchImageFromS3Proxy(imageName);
  console.log(`Image fetched successfully: ${blob}`);

  // Step 2: Create a File object from the blob
  const file = new File([blob], imageName, { type: blob.type || "image/png" });

  // Step 3: Create FormData and append the file
  const formData = new FormData();
  formData.append("file", file);

  // Step 4: Send as multipart/form-data
  const response = await fetch(`${API_BASE}/image-upload`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  console.log(`Response status: ${response.status}`);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function submitExpandImageJob(
  payload: ExpandImagePayload,
): Promise<ExpandImageResponse> {
  console.log(`submitExpandImageJob: ${payload}`);
  return fetchWithCredentials(`${API_BASE}/expand-image-async`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ============================================
// Job Status Polling
// ============================================

export async function checkFireflyJobStatus(jobId: string): Promise<JobStatus> {
  const response = await fetchWithCredentials<{
    status?: string;
    outputs?: { status: string; url?: string }[];
    error?: string;
    result?: {
      outputs: [
        {
          destination?: {
            url: string;
          };
          image?: {
            url: string;
          };
          mediaType?: string;
        },
      ];
    };
  }>(`${API_BASE}/check-status?job_id=${jobId}`);

  // Normalize the response to our JobStatus type
  const status = response.status || response.outputs?.[0]?.status || "pending";

  return {
    jobId,
    status: status as JobStatus["status"],
    outputs: response.outputs?.map((o) => ({
      url: o.url || "",
      status: o.status,
    })),
    result: {
      outputs: response.result?.outputs?.map((o) => ({
        destination: {
          url: o.destination?.url || "",
        },
        image: {
          url: o.image?.url || "",
        },
        mediaType: o.mediaType,
      })),
    },
  };
}

export async function checkPsdJobStatus(jobId: string): Promise<JobStatus> {
  const response = await fetchWithCredentials<{
    jobId: string;
    status: string;
    outputs?: {
      status: string;
      _links?: { renditions?: { href: string }[] };
    }[];
  }>(`${API_BASE}/get-psd-status/${jobId}`);

  return {
    jobId: response.jobId,
    status: response.status as JobStatus["status"],
    outputs: response.outputs?.map((o) => ({
      url: o._links?.renditions?.[0]?.href || "",
      status: o.status,
    })),
  };
}

// ============================================
// Polling Helper
// ============================================

export async function pollJobUntilComplete(
  jobId: string,
  checkFn: (jobId: string, destinationUrl?: string) => Promise<JobStatus>,
  downloadHrefs: (string | undefined)[],
  onStatusUpdate?: (status: JobStatus) => void,
  maxAttempts = 100,
  intervalMs = 2000,
): Promise<JobStatus> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const status = await checkFn(jobId);
    console.log(`Job ID: ${jobId}, Status: ${JSON.stringify(status)}`);
    onStatusUpdate?.(status);

    // Check top-level status OR outputs array status
    const jobStatus = status.status ?? status.outputs?.[0]?.status;

    if (jobStatus === "succeeded" || jobStatus === "failed") {
      console.log(
        `CompletedJob ID: ${jobId}, Status: ${JSON.stringify(status)}`,
      );
      status.outputs?.forEach((output, index) => {
        if (output.status === "succeeded") {
          output.downloadHref = downloadHrefs[index];
        }
      });
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    attempts++;
  }

  throw new Error(`Job ${jobId} timed out after ${maxAttempts} attempts`);
}
