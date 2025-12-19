import { useState } from "react";
import ImageSelector from "@/components/ImageSelector";
import JobStatusDisplay from "@/components/JobStatusDisplay";
import Spinner from "@/components/Spinner";
import type {
  S3Image,
  JobStatus,
  VideoReframePayloadV2,
  AspectRatio,
  AnchorPoint,
  ReframeOverlay,
} from "@/types";
import {
  generateAccessToken,
  getPresignedDownloadUrl,
  getPresignedUploadUrl,
  submitVideoReframeJob,
  checkAudioVideoJobStatus,
  pollJobUntilComplete,
} from "@/services/api";

// Predefined aspect ratios
const ASPECT_RATIOS: { label: string; ratio: AspectRatio }[] = [
  { label: "1:1 (Square)", ratio: { x: 1, y: 1 } },
  { label: "16:9 (Landscape)", ratio: { x: 16, y: 9 } },
  { label: "9:16 (Portrait/Vertical)", ratio: { x: 9, y: 16 } },
  { label: "4:3 (Standard)", ratio: { x: 4, y: 3 } },
  { label: "3:4 (Portrait)", ratio: { x: 3, y: 4 } },
  { label: "21:9 (Ultrawide)", ratio: { x: 21, y: 9 } },
];

const ANCHOR_POINTS: { value: AnchorPoint; label: string }[] = [
  { value: "top_left", label: "Top Left" },
  { value: "top_center", label: "Top Center" },
  { value: "top_right", label: "Top Right" },
  { value: "center_left", label: "Center Left" },
  { value: "center", label: "Center" },
  { value: "center_right", label: "Center Right" },
  { value: "bottom_left", label: "Bottom Left" },
  { value: "bottom_center", label: "Bottom Center" },
  { value: "bottom_right", label: "Bottom Right" },
];

const OVERLAY_OPTIONS = [
  { value: "Purple_Ground_Truck.png", label: "Ground Truck" },
  { value: "Purple_Ship_Facing.png", label: "Ship" },
  { value: "Purple_Heart_Icon.png", label: "Heart" },
];

interface OverlayConfig {
  id: string;
  imageKey: string;
  enabled: boolean;
  startTime: string;
  duration: string;
  width: number;
  height: number;
  anchorPoint: AnchorPoint;
  offsetX: number;
  offsetY: number;
}

const createDefaultOverlay = (): OverlayConfig => ({
  id: crypto.randomUUID(),
  imageKey: OVERLAY_OPTIONS[0].value,
  enabled: true,
  startTime: "00:00:00:00",
  duration: "00:00:10:00",
  width: 200,
  height: 200,
  anchorPoint: "bottom_right",
  offsetX: 0,
  offsetY: 0,
});

export default function VideoReframePage() {
  // Video source
  const [videoUrl, setVideoUrl] = useState("");
  const [useS3Video, setUseS3Video] = useState(false);
  const [s3VideoKey, setS3VideoKey] = useState("");

  // Analysis settings
  const [sceneEditDetection, setSceneEditDetection] = useState(true);

  // Overlay settings
  const [useOverlay, setUseOverlay] = useState(false);

  const [overlays, setOverlays] = useState<OverlayConfig[]>([
    createDefaultOverlay(),
  ]);

  // Output settings
  const [selectedAspectRatios, setSelectedAspectRatios] = useState<
    AspectRatio[]
  >([ASPECT_RATIOS[0].ratio]);
  const [outputFileName, setOutputFileName] = useState("reframed_video.mp4");

  // Job state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Overlay management functions
  const addOverlay = () => {
    setOverlays((prev) => [...prev, createDefaultOverlay()]);
  };

  const removeOverlay = (id: string) => {
    setOverlays((prev) => prev.filter((overlay) => overlay.id !== id));
  };

  const updateOverlay = (id: string, updates: Partial<OverlayConfig>) => {
    console.log(`Updating overlay ${id} with ${JSON.stringify(updates)}`);
    setOverlays((prev) =>
      prev.map((overlay) =>
        overlay.id === id ? { ...overlay, ...updates } : overlay,
      ),
    );
  };

  const handleAspectRatioToggle = (ratio: AspectRatio) => {
    setSelectedAspectRatios((prev) => {
      const exists = prev.some((r) => r.x === ratio.x && r.y === ratio.y);
      if (exists) {
        return prev.filter((r) => !(r.x === ratio.x && r.y === ratio.y));
      }
      return [...prev, ratio];
    });
  };

  const handleSubmit = async () => {
    // Validation
    let downloadVideoUrl: any = undefined;
    if (!useS3Video && !videoUrl.trim()) {
      setError("Please enter a video URL or select an S3 video");
      return;
    }

    if (useS3Video && !s3VideoKey.trim()) {
      setError("Please enter the S3 video key");
      return;
    }

    if (selectedAspectRatios.length === 0) {
      setError("Please select at least one aspect ratio");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    setJobs([]);

    try {
      // Generate access token first
      await generateAccessToken();

      // Get video source URL
      let sourceVideoUrl = videoUrl[0];
      if (useS3Video) {
        const presigned = await getPresignedDownloadUrl(`videos/${s3VideoKey}`);
        sourceVideoUrl = presigned.url[0];
      }

      // Generate output presigned URLs for each aspect ratio
      const renditions = await Promise.all(
        selectedAspectRatios.map(async (ratio, index) => {
          const outputKey = `altered/videos/${outputFileName.replace(".mp4", "")}_${ratio.x}x${ratio.y}.mp4`;
          const uploadUrl = await getPresignedUploadUrl(outputKey);
          const downloadUrl = await getPresignedDownloadUrl(outputKey);
          downloadVideoUrl = downloadUrl.url;
          return {
            aspectRatio: ratio,
            mediaDestination: {
              url: uploadUrl.url[0],
            },
          };
        }),
      );

      // Build payload
      const payload: VideoReframePayloadV2 = {
        video: {
          source: {
            url: sourceVideoUrl,
          },
        },
        analysis: {
          sceneEditDetection,
        },
        output: {
          format: {
            media: "mp4",
          },
          renditions,
        },
        composition: {
          overlays: [],
        },
      };

      // Add overlays if enabled
      if (useOverlay && overlays.length > 0) {
        const overlayPromises = overlays.map(async (config) => {
          const overlayPresigned = await getPresignedDownloadUrl(
            config.imageKey,
          );

          const overlay: ReframeOverlay = {
            source: {
              url: overlayPresigned.url[0],
            },
            startTime: config.startTime,
            duration: config.duration,
            scale: {
              width: config.width,
              height: config.height,
            },
            position: {
              anchorPoint: config.anchorPoint,
              offsetX: config.offsetX,
              offsetY: config.offsetY,
            },
          };
          return overlay;
        });

        const resolvedOverlays = await Promise.all(overlayPromises);
        payload.composition = {
          overlays: resolvedOverlays,
        };
      }

      console.log(
        "Submitting video reframe payload:",
        JSON.stringify(payload, null, 2),
      );

      // Submit job
      const response = await submitVideoReframeJob(payload);
      console.log("Job submitted:", response);

      const jobId = response.jobId;

      // Generate download URLs for viewing results
      const downloadHrefs = await Promise.all(
        selectedAspectRatios.map(async (ratio) => {
          const outputKey = `altered/altered/videos/${outputFileName.replace(".mp4", "")}_${ratio.x}x${ratio.y}.mp4`;
          console.log("Generating download URL for", outputKey);
          const downloadUrl = await getPresignedDownloadUrl(outputKey);
          console.log("Download URL:", downloadUrl);
          return downloadUrl.url;
        }),
      );

      // Initialize job status
      const initialStatus: JobStatus = {
        jobId,
        status: "pending",
      };
      setJobs([initialStatus]);

      // Poll for completion
      const finalStatus = await pollJobUntilComplete(
        jobId,
        checkAudioVideoJobStatus,
        downloadHrefs,
        (status) => {
          setJobs([status]);
        },
        120, // More attempts for video processing
        5000, // Longer interval for video
      );
      console.log(
        `FinalStatus: ${JSON.stringify(finalStatus)} downloadHrefs ${JSON.stringify(downloadHrefs)}`,
      );
      finalStatus.outputs?.forEach((output, index) => {
        output!.mediaDestination!.url = downloadHrefs[index][0];
      });
      setJobs([finalStatus]);
    } catch (err) {
      console.error("Error submitting video reframe job:", err);
      setError(err instanceof Error ? err.message : "Failed to submit job");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Video Reframe</h1>
      <p className="text-gray-600 mb-8">
        Intelligently reframe your videos to different aspect ratios using
        Adobe's AI-powered Video Reframe API. Add overlays, detect scene
        changes, and create multiple output formats from a single source video.
      </p>

      <div className="space-y-8">
        {/* Video Source */}
        <section className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Video Source
          </h2>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={!useS3Video}
                  onChange={() => setUseS3Video(false)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Enter Video URL</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={useS3Video}
                  onChange={() => setUseS3Video(true)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Use S3 Video</span>
              </label>
            </div>

            {!useS3Video ? (
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://example.com/video.mp4"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  S3 Video Key (in videos/ folder)
                </label>
                <input
                  type="text"
                  value={s3VideoKey}
                  onChange={(e) => setS3VideoKey(e.target.value)}
                  placeholder="my_video.mp4"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter just the filename (e.g., "waves.mp4")
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Analysis Settings */}
        <section className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Analysis Settings
          </h2>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={sceneEditDetection}
              onChange={(e) => setSceneEditDetection(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">
                Scene Edit Detection
              </span>
              <p className="text-xs text-gray-500">
                Automatically detect scene changes for better reframing
              </p>
            </div>
          </label>
        </section>

        {/* Overlay Settings - Multiple Overlays */}
        <section className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="useOverlay"
                checked={useOverlay}
                onChange={(e) => setUseOverlay(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <label
                htmlFor="useOverlay"
                className="text-lg font-semibold text-gray-800"
              >
                Add Overlays (Optional)
              </label>
            </div>
            {useOverlay && (
              <span className="text-sm text-gray-500">
                {overlays.length} overlay{overlays.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {useOverlay && (
            <div className="space-y-6">
              {overlays.map((overlay, index) => (
                <div
                  key={overlay.id}
                  className="p-4 border border-gray-200 rounded-lg bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-gray-700">
                      Overlay {index + 1}
                    </h3>
                    {overlays.length > 1 && (
                      <button
                        onClick={() => removeOverlay(overlay.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Image
                      </label>
                      <select
                        value={overlay.imageKey}
                        onChange={(e) =>
                          updateOverlay(overlay.id, {
                            imageKey: e.target.value,
                          })
                        }
                        className="w-full p-2 border rounded-lg"
                      >
                        {OVERLAY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Time (HH:MM:SS:FF)
                      </label>
                      <input
                        type="text"
                        value={overlay.startTime}
                        onChange={(e) =>
                          updateOverlay(overlay.id, {
                            startTime: e.target.value,
                          })
                        }
                        placeholder="00:00:00:00"
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Duration (HH:MM:SS:FF)
                      </label>
                      <input
                        type="text"
                        value={overlay.duration}
                        onChange={(e) =>
                          updateOverlay(overlay.id, {
                            duration: e.target.value,
                          })
                        }
                        placeholder="00:00:10:00"
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Width (px)
                      </label>
                      <input
                        type="number"
                        value={overlay.width}
                        onChange={(e) =>
                          updateOverlay(overlay.id, {
                            width: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Height (px)
                      </label>
                      <input
                        type="number"
                        value={overlay.height}
                        onChange={(e) =>
                          updateOverlay(overlay.id, {
                            height: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Anchor Point
                      </label>
                      <select
                        value={overlay.anchorPoint}
                        onChange={(e) =>
                          updateOverlay(overlay.id, {
                            anchorPoint: e.target.value as AnchorPoint,
                          })
                        }
                        className="w-full p-2 border rounded-lg"
                      >
                        {ANCHOR_POINTS.map((point) => (
                          <option key={point.value} value={point.value}>
                            {point.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Offset X
                        </label>
                        <input
                          type="number"
                          value={overlay.offsetX}
                          onChange={(e) =>
                            updateOverlay(overlay.id, {
                              offsetX: parseInt(e.target.value, 10) || 0,
                            })
                          }
                          className="w-full p-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Offset Y
                        </label>
                        <input
                          type="number"
                          value={overlay.offsetY}
                          onChange={(e) =>
                            updateOverlay(overlay.id, {
                              offsetY: parseInt(e.target.value, 10) || 0,
                            })
                          }
                          className="w-full p-2 border rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={addOverlay}
                className="w-full py-2 px-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                + Add Another Overlay
              </button>
            </div>
          )}
        </section>

        {/* Output Settings */}
        <section className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Output Settings
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Output Aspect Ratios (select one or more)
              </label>
              <div className="flex flex-wrap gap-2">
                {ASPECT_RATIOS.map((item) => {
                  const isSelected = selectedAspectRatios.some(
                    (r) => r.x === item.ratio.x && r.y === item.ratio.y,
                  );
                  return (
                    <button
                      key={item.label}
                      onClick={() => handleAspectRatioToggle(item.ratio)}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Output Filename
              </label>
              <input
                type="text"
                value={outputFileName}
                onChange={(e) => setOutputFileName(e.target.value)}
                placeholder="reframed_video.mp4"
                className="w-full p-2 border rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                Each aspect ratio will append its ratio to the filename (e.g.,
                reframed_video_1x1.mp4)
              </p>
            </div>
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
          disabled={isSubmitting}
          className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
            isSubmitting
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner size="sm" />
              Reframing Video...
            </span>
          ) : (
            `Reframe Video to ${selectedAspectRatios.length} Aspect Ratio${selectedAspectRatios.length !== 1 ? "s" : ""}`
          )}
        </button>

        {/* Job Status */}
        <JobStatusDisplay jobs={jobs} title="Video Reframe Status" />

        {/* Video Preview */}
        {jobs.length > 0 &&
          jobs[0].status === "succeeded" &&
          jobs[0].outputs?.some((o) => o.downloadHref) && (
            <section className="bg-white p-6 rounded-lg border">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                Reframed Videos
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {jobs[0].outputs
                  ?.filter((o) => o.mediaDestination)
                  .map((output, index) => (
                    <div
                      key={index}
                      className="border rounded-lg overflow-hidden"
                    >
                      <video
                        src={output.mediaDestination!.url}
                        controls
                        className="w-full"
                      >
                        Your browser does not support the video tag.
                      </video>
                      <div className="p-2 bg-gray-50">
                        <p className="text-sm text-gray-600">
                          {selectedAspectRatios[index]
                            ? `${selectedAspectRatios[index].x}:${selectedAspectRatios[index].y}`
                            : `Output ${index + 1}`}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          )}
      </div>
    </div>
  );
}
