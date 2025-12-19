import { useState } from "react";
import ImageSelector from "@/components/ImageSelector";
import JobStatusDisplay from "@/components/JobStatusDisplay";
import Spinner from "@/components/Spinner";
import type {
  S3Image,
  JobStatus,
  TextToVideoPayload,
  VideoSettings,
  VideoSize,
  CameraMotion,
  PromptStyle,
  ShotAngle,
  ShotSize,
} from "@/types";
import {
  generateAccessToken,
  getPresignedDownloadUrl,
  submitTextToVideoJob,
  checkVideoJobStatus,
  pollJobUntilComplete,
} from "@/services/api";

// Predefined video sizes
const VIDEO_SIZES: { label: string; size: VideoSize }[] = [
  { label: "1920x1080 (16:9 HD)", size: { width: 1920, height: 1080 } },
  { label: "1080x1920 (9:16 Vertical)", size: { width: 1080, height: 1920 } },
  { label: "1080x1080 (1:1 Square)", size: { width: 1080, height: 1080 } },
  { label: "1280x720 (720p)", size: { width: 1280, height: 720 } },
  { label: "3840x2160 (4K)", size: { width: 3840, height: 2160 } },
];

const CAMERA_MOTIONS: { value: CameraMotion; label: string }[] = [
  { value: "camera zoom in", label: "Zoom In" },
  { value: "camera zoom out", label: "Zoom Out" },
  { value: "camera pan left", label: "Pan Left" },
  { value: "camera pan right", label: "Pan Right" },
  { value: "camera tilt up", label: "Tilt Up" },
  { value: "camera tilt down", label: "Tilt Down" },
  { value: "camera locked down", label: "Locked Down" },
  { value: "camera handheld", label: "Handheld" },
];

const PROMPT_STYLES: { value: PromptStyle; label: string }[] = [
  { value: "cinematic", label: "Cinematic" },
  { value: "anime", label: "Anime" },
  { value: "3d", label: "3D" },
  { value: "fantasy", label: "Fantasy" },
  { value: "claymation", label: "Claymation" },
  { value: "line art", label: "Line Art" },
  { value: "stop motion", label: "Stop Motion" },
  { value: "2d", label: "2D" },
  { value: "vector art", label: "Vector Art" },
  { value: "black and white", label: "Black and White" },
];

const SHOT_ANGLES: { value: ShotAngle; label: string }[] = [
  { value: "eye_level shot", label: "Eye Level" },
  { value: "low angle shot", label: "Low Angle" },
  { value: "high angle shot", label: "High Angle" },
  { value: "aerial shot", label: "Aerial Shot" },
  { value: "top-down shot", label: "Top-Down" },
];

const SHOT_SIZES: { value: ShotSize; label: string }[] = [
  { value: "extreme close-up", label: "Extreme Close Up" },
  { value: "close-up shot", label: "Close Up" },
  { value: "medium shot", label: "Medium" },
  { value: "long shot", label: "Long" },
  { value: "extreme long shot", label: "Extreme Long" },
];

export default function TextToVideoPage() {
  // Form state
  const [prompt, setPrompt] = useState("");
  const [selectedImages, setSelectedImages] = useState<S3Image[]>([]);
  const [useReferenceImage, setUseReferenceImage] = useState(false);
  const [bitRateFactor, setBitRateFactor] = useState(18);
  const [selectedSizes, setSelectedSizes] = useState<VideoSize[]>([
    VIDEO_SIZES[0].size,
  ]);
  const [seed, setSeed] = useState<string>("");

  // Video settings
  const [videoSettings, setVideoSettings] = useState<VideoSettings>({
    cameraMotion: "camera zoom in",
    promptStyle: "cinematic",
    shotAngle: "eye_level shot",
    shotSize: "medium shot",
  });

  // Job state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSizeToggle = (size: VideoSize) => {
    setSelectedSizes((prev) => {
      const exists = prev.some(
        (s) => s.width === size.width && s.height === size.height,
      );
      if (exists) {
        return prev.filter(
          (s) => !(s.width === size.width && s.height === size.height),
        );
      }
      return [...prev, size];
    });
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    if (selectedSizes.length === 0) {
      setError("Please select at least one output size");
      return;
    }

    if (useReferenceImage && selectedImages.length === 0) {
      setError("Please select a reference image or disable reference image");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    setJobs([]);

    try {
      // Generate access token first
      await generateAccessToken();

      // Build payload
      const payload: TextToVideoPayload = {
        bitRateFactor,
        prompt: prompt.trim(),
        seeds: seed
          ? [parseInt(seed, 10)]
          : [Math.floor(Math.random() * 100000)],
        sizes: selectedSizes,
        videoSettings,
      };

      // Add reference image if enabled
      if (useReferenceImage && selectedImages.length > 0) {
        console.log("Selected image:", selectedImages);
        const presignedUrl = await getPresignedDownloadUrl(
          selectedImages[0].name,
        );
        payload.image = {
          conditions: [
            {
              placement: { position: 0 },
              source: { url: presignedUrl.url[0] },
            },
          ],
        };
      } else {
        payload.image = {
          conditions: [],
        };
      }

      console.log("Submitting text-to-video payload:", payload);

      // Submit job
      const response = await submitTextToVideoJob(payload);
      console.log("Job submitted:", response);

      const jobId = response.jobId;

      // Initialize job status
      const initialStatus: JobStatus = {
        jobId,
        status: "pending",
      };
      setJobs([initialStatus]);

      // Poll for completion
      const finalStatus = await pollJobUntilComplete(
        jobId,
        checkVideoJobStatus,
        [], // No download hrefs for video - they come from the response
        (status) => {
          setJobs([status]);
        },
      );

      setJobs([finalStatus]);
    } catch (err) {
      console.error("Error submitting text-to-video job:", err);
      setError(err instanceof Error ? err.message : "Failed to submit job");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Text to Video</h1>
      <p className="text-gray-600 mb-8">
        Generate a video from a text prompt using Adobe's Firefly APIs. Firefly
        is a powerful AI service that can generate high-quality videos from text
        prompts. With Firefly, you can create engaging videos that are tailored
        to your brand and audience.
      </p>

      <div className="space-y-8">
        {/* Prompt Input */}
        <section className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Video Prompt
          </h2>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the video you want to generate... (e.g., 'A majestic eagle soaring over mountain peaks at sunset, cinematic lighting')"
            className="w-full h-32 p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </section>

        {/* Reference Image (Optional) */}
        <section className="bg-white p-6 rounded-lg border">
          <div className="flex items-center gap-3 mb-4">
            <input
              type="checkbox"
              id="useReferenceImage"
              checked={useReferenceImage}
              onChange={(e) => setUseReferenceImage(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <label
              htmlFor="useReferenceImage"
              className="text-lg font-semibold text-gray-800"
            >
              Use Reference Image (Optional)
            </label>
          </div>
          {useReferenceImage && (
            <ImageSelector
              selectedImages={selectedImages}
              onSelectionChange={setSelectedImages}
              multiSelect={false}
            />
          )}
        </section>

        {/* Video Settings */}
        <section className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Video Settings
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Camera Motion */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Camera Motion
              </label>
              <select
                value={videoSettings.cameraMotion}
                onChange={(e) =>
                  setVideoSettings((prev) => ({
                    ...prev,
                    cameraMotion: e.target.value as CameraMotion,
                  }))
                }
                className="w-full p-2 border rounded-lg"
              >
                {CAMERA_MOTIONS.map((motion) => (
                  <option key={motion.value} value={motion.value}>
                    {motion.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Prompt Style */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Style
              </label>
              <select
                value={videoSettings.promptStyle}
                onChange={(e) =>
                  setVideoSettings((prev) => ({
                    ...prev,
                    promptStyle: e.target.value as PromptStyle,
                  }))
                }
                className="w-full p-2 border rounded-lg"
              >
                {PROMPT_STYLES.map((style) => (
                  <option key={style.value} value={style.value}>
                    {style.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Shot Angle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Shot Angle
              </label>
              <select
                value={videoSettings.shotAngle}
                onChange={(e) =>
                  setVideoSettings((prev) => ({
                    ...prev,
                    shotAngle: e.target.value as ShotAngle,
                  }))
                }
                className="w-full p-2 border rounded-lg"
              >
                {SHOT_ANGLES.map((angle) => (
                  <option key={angle.value} value={angle.value}>
                    {angle.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Shot Size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Shot Size
              </label>
              <select
                value={videoSettings.shotSize}
                onChange={(e) =>
                  setVideoSettings((prev) => ({
                    ...prev,
                    shotSize: e.target.value as ShotSize,
                  }))
                }
                className="w-full p-2 border rounded-lg"
              >
                {SHOT_SIZES.map((size) => (
                  <option key={size.value} value={size.value}>
                    {size.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Output Settings */}
        <section className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Output Settings
          </h2>

          {/* Video Sizes */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Output Sizes (select one or more)
            </label>
            <div className="flex flex-wrap gap-2">
              {VIDEO_SIZES.map((item) => {
                const isSelected = selectedSizes.some(
                  (s) =>
                    s.width === item.size.width &&
                    s.height === item.size.height,
                );
                return (
                  <button
                    key={item.label}
                    onClick={() => handleSizeToggle(item.size)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bit Rate Factor */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bit Rate Factor: {bitRateFactor}
            </label>
            <input
              type="range"
              min="1"
              max="30"
              value={bitRateFactor}
              onChange={(e) => setBitRateFactor(parseInt(e.target.value, 10))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Lower quality (smaller file)</span>
              <span>Higher quality (larger file)</span>
            </div>
          </div>

          {/* Seed */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Seed (optional - for reproducible results)
            </label>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="Leave empty for random"
              className="w-full p-2 border rounded-lg"
            />
          </div>
        </section>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !prompt.trim()}
          className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
            isSubmitting || !prompt.trim()
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner size="sm" />
              Generating Video...
            </span>
          ) : (
            "Generate Video"
          )}
        </button>

        {/* Job Status */}
        <JobStatusDisplay jobs={jobs} title="Video Generation Status" />
      </div>
    </div>
  );
}
