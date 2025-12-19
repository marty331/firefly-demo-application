// ============================================
// Common Types
// ============================================

export interface S3Image {
  key: string;
  name: string;
  url?: string;
  lastModified?: string;
  size?: number;
}

export interface JobStatus {
  jobId: string | undefined;
  status: "pending" | "running" | "succeeded" | "failed";
  outputs?: Array<{
    aspectRatio?: {
      x: number;
      y: number;
    };
    url: string;
    downloadHref?: string;
    mediaDestination?: {
      url: string;
    };
    status: string;
  }>;
  result?: {
    size?: {
      width?: number;
      height?: number;
    };
    outputs?: Array<{
      destination?: {
        url: string;
      };
      image?: {
        url: string;
      };
      mediaType?: string;
      seed?: number;
      video?: {
        url?: string;
      };
    }>;
  };
  error?: string;
}

export interface OutputResult {
  url: string;
  status: string;
}

// ============================================
// Crop Image Types
// ============================================

export type CropOutputType =
  | "image/vnd.adobe.photoshop"
  | "image/jpeg"
  | "image/png"
  | "image/tiff"
  | "vnd.adobe.photoshop";

export type CropCompressionType = "small" | "medium" | "large";

export type CropUnitType = "Percent" | "Pixels";

export interface CropInput {
  href: string;
  storage: "external";
}

export interface CropOutput {
  href: string;
  downloadHref?: string;
  storage: "external";
  type: CropOutputType;
  overwrite: true;
  quality: number;
  compression?: CropCompressionType;
}

export interface CropOptions {
  unit: CropUnitType;
  width: number;
  height: number;
}

export interface CropImagePayload {
  inputs: CropInput[];
  outputs: CropOutput[];
  options: CropOptions;
}

export interface CropImageResponse {
  _links: {
    self: {
      href: string;
    };
  };
}

// ============================================
// Remove Background Types
// ============================================

export type RemoveBackgroundMode = "cutout" | "mask" | "psd";

export type RemoveBackgroundMediaType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/vnd.adobe.photoshop";

export interface RGBAColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

export interface RemoveBackgroundPayload {
  image: {
    source: {
      url: string;
    };
  };
  mode: RemoveBackgroundMode;
  output: {
    mediaType: RemoveBackgroundMediaType;
  };
  trim: boolean;
  backgroundColor?: RGBAColor;
  colorDecontamination: number;
}

// ============================================
// Video Reframe Types (V2 API)
// ============================================

export type AnchorPoint =
  | "top_left"
  | "top_center"
  | "top_right"
  | "center_left"
  | "center"
  | "center_right"
  | "bottom_left"
  | "bottom_center"
  | "bottom_right";

export interface AspectRatio {
  x: number;
  y: number;
}

export interface ReframeOverlayPosition {
  anchorPoint: AnchorPoint;
  offsetX: number;
  offsetY: number;
}

export interface ReframeOverlayScale {
  width: number;
  height: number;
}

export interface ReframeOverlay {
  source: {
    url: string;
  };
  startTime: string;
  duration: string;
  scale: ReframeOverlayScale;
  position: ReframeOverlayPosition;
}

export interface ReframeComposition {
  overlays: ReframeOverlay[];
}

export interface ReframeRendition {
  aspectRatio: AspectRatio;
  mediaDestination: {
    url: string;
  };
}

export interface VideoReframePayloadV2 {
  video: {
    source: {
      url: string;
    };
  };
  analysis: {
    sceneEditDetection: boolean;
  };
  composition?: ReframeComposition;
  output: {
    format: {
      media: "mp4";
    };
    renditions: ReframeRendition[];
  };
}

export interface VideoReframeResponse {
  jobId: string;
  statusUrl: string;
}

// Legacy Video Reframe Types
export interface VideoReframeOutput {
  format: {
    media: "mp4";
  };
  renditions: {
    aspectRatio: AspectRatio;
    mediaDestination?: {
      url: string;
    };
  }[];
}

export interface VideoReframePayload {
  video: {
    source: {
      url: string;
    };
  };
  analysis?: {
    sceneEditDetection: boolean;
    focalPoints: string[];
  };
  output: VideoReframeOutput;
}

// ============================================
// Expand Image (Generative Fill) Types
// ============================================

export type ExpandImagePlacement =
  | "center"
  | "top_left"
  | "top_center"
  | "top_right"
  | "center_left"
  | "center_right"
  | "bottom_left"
  | "bottom_center"
  | "bottom_right";

export interface ExpandImageSize {
  width: number;
  height: number;
}

export interface ImageUploadResponse {
  firefly_response: {
    images: Array<{
      id: string;
    }>;
  };
}

export interface ExpandImagePayload {
  imageId: string;
  width: number;
  height: number;
  prompt?: string;
  placement?: {
    alignment: ExpandImagePlacement;
  };
}

export interface ExpandImageResponse {
  jobId: string;
  statusUrl: string;
  results: {
    outputs: Array<{
      image: {
        url: string;
      };
    }>;
  };
}

// ============================================
// Resize Types (Stub - Legacy)
// ============================================

export interface ResizePayload {
  input: {
    href: string;
    storage: "external";
  };
  output: {
    href: string;
    storage: "external";
    type: string;
  };
  options: {
    width: number;
    height: number;
    scaleType: "fit" | "fill" | "stretch";
  };
}

// ============================================
// Color Grade Types (Stub)
// ============================================

export interface ColorGradePayload {
  input: {
    href: string;
    storage: "external";
  };
  output: {
    href: string;
    storage: "external";
    type: string;
  };
  adjustments: {
    brightness: number;
    contrast: number;
    saturation: number;
    temperature: number;
    tint: number;
  };
}

// ============================================
// Banner Variants Types (Stub)
// ============================================

export interface BannerSize {
  name: string;
  width: number;
  height: number;
}

export interface BannerVariantsPayload {
  sourceImage: {
    href: string;
    storage: "external";
  };
  sizes: BannerSize[];
  localizations?: {
    locale: string;
    textOverrides?: Record<string, string>;
  }[];
  outputPrefix: string;
}

// ============================================
// Text to Video Types
// ============================================

export type CameraMotion =
  | "camera zoom in"
  | "camera zoom out"
  | "camera pan left"
  | "camera pan right"
  | "camera tilt up"
  | "camera tilt down"
  | "camera locked down"
  | "camera handheld";

export type PromptStyle =
  | "cinematic"
  | "anime"
  | "3d"
  | "fantasy"
  | "claymation"
  | "line art"
  | "stop motion"
  | "2d"
  | "vector art"
  | "black and white";

export type ShotAngle =
  | "eye_level shot"
  | "low angle shot"
  | "high angle shot"
  | "aerial shot"
  | "top-down shot";

export type ShotSize =
  | "extreme close-up"
  | "close-up shot"
  | "medium shot"
  | "long shot"
  | "extreme long shot";

export interface VideoSize {
  width: number;
  height: number;
}

export interface VideoSettings {
  cameraMotion: CameraMotion;
  promptStyle: PromptStyle;
  shotAngle: ShotAngle;
  shotSize: ShotSize;
}

export interface ImageCondition {
  placement: {
    position: number;
  };
  source: {
    url: string;
  };
}

export interface TextToVideoPayload {
  bitRateFactor: number;
  image?:
    | {
        conditions: ImageCondition[];
      }
    | undefined;
  prompt: string;
  seeds: number[];
  sizes: VideoSize[];
  videoSettings: VideoSettings;
}

export interface TextToVideoResponse {
  jobId: string;
  statusUrl: string;
}

// ============================================
// Auto Tone Types
// ============================================

export interface AutoToneInput {
  href: string;
  storage: "external";
}

export interface AutoToneOutput {
  href: string;
  storage: "external";
  type?: string;
}

export interface AutoTonePayload {
  inputs: AutoToneInput;
  outputs: AutoToneOutput[];
}

export interface AutoToneResponse {
  _links: {
    self: {
      href: string;
    };
  };
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PresignedUrlResponse {
  url: string;
  key: string;
}

export interface JobSubmitResponse {
  jobId: string;
  statusUrl: string;
}
