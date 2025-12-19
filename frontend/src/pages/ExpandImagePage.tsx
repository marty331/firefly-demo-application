import { useState } from "react";
import ImageSelector from "@/components/ImageSelector";
import JobStatusDisplay from "@/components/JobStatusDisplay";
import Spinner from "@/components/Spinner";
import type {
  S3Image,
  JobStatus,
  ExpandImagePayload,
  ExpandImagePlacement,
} from "@/types";
import {
  generateAccessToken,
  uploadImageForExpand,
  submitExpandImageJob,
  checkFireflyJobStatus,
  pollJobUntilComplete,
} from "@/services/api";

const PLACEMENT_OPTIONS: { value: ExpandImagePlacement; label: string }[] = [
  { value: "center", label: "Center" },
  { value: "top_left", label: "Top Left" },
  { value: "top_center", label: "Top Center" },
  { value: "top_right", label: "Top Right" },
  { value: "center_left", label: "Center Left" },
  { value: "center_right", label: "Center Right" },
  { value: "bottom_left", label: "Bottom Left" },
  { value: "bottom_center", label: "Bottom Center" },
  { value: "bottom_right", label: "Bottom Right" },
];

const PRESET_SIZES = [
  { label: "1024 x 1024 (Square)", width: 1024, height: 1024 },
  { label: "1920 x 1080 (16:9 Landscape)", width: 1920, height: 1080 },
  { label: "1080 x 1920 (9:16 Portrait)", width: 1080, height: 1920 },
  { label: "1200 x 628 (Facebook/LinkedIn)", width: 1200, height: 628 },
  { label: "1080 x 1080 (Instagram Square)", width: 1080, height: 1080 },
  { label: "1080 x 1350 (Instagram Portrait)", width: 1080, height: 1350 },
  { label: "2048 x 2048 (Large Square)", width: 2048, height: 2048 },
  { label: "Custom", width: 0, height: 0 },
];

export default function ExpandImagePage() {
  // Image selection
  const [selectedImages, setSelectedImages] = useState<S3Image[]>([]);

  // Size settings
  const [presetSize, setPresetSize] = useState(PRESET_SIZES[0]);
  const [customWidth, setCustomWidth] = useState(1024);
  const [customHeight, setCustomHeight] = useState(1024);

  // Options
  const [prompt, setPrompt] = useState("");
  const [usePlacement, setUsePlacement] = useState(false);
  const [placement, setPlacement] = useState<ExpandImagePlacement>("center");

  // Job state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  const getTargetSize = () => {
    if (presetSize.label === "Custom") {
      return { width: customWidth, height: customHeight };
    }
    return { width: presetSize.width, height: presetSize.height };
  };

  const handlePresetChange = (index: number) => {
    setPresetSize(PRESET_SIZES[index]);
    if (PRESET_SIZES[index].label !== "Custom") {
      setCustomWidth(PRESET_SIZES[index].width);
      setCustomHeight(PRESET_SIZES[index].height);
    }
  };

  const handleSubmit = async () => {
    if (selectedImages.length === 0) {
      setError("Please select at least one image");
      return;
    }

    const targetSize = getTargetSize();
    if (targetSize.width < 1 || targetSize.height < 1) {
      setError("Please enter valid width and height values");
      return;
    }

    if (targetSize.width > 4096 || targetSize.height > 4096) {
      setError("Maximum dimension is 4096 pixels");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    setJobs([]);

    try {
      // Generate access token first
      await generateAccessToken();

      // Process each selected image as a separate job
      const jobPromises = selectedImages.map(async (image, index) => {
        console.log(`Processing image ${index + 1}: ${image.name}`);

        // Step 1: Upload image to get imageId (backend handles S3 fetch)
        const uploadResponse = await uploadImageForExpand(image.name);
        console.log(`Upload response  ${JSON.stringify(uploadResponse)}`);
        const imageId = uploadResponse.firefly_response.images[0].id;
        console.log(`Image ${index + 1} uploaded, imageId:`, imageId);

        // Step 2: Build expand image payload with imageId
        const payload: ExpandImagePayload = {
          imageId: imageId,
          width: targetSize.width,
          height: targetSize.height,
        };

        // Add optional prompt
        if (prompt.trim()) {
          payload.prompt = prompt.trim();
        }

        // Add optional placement
        if (usePlacement) {
          payload.placement = {
            alignment: placement,
          };
        }

        console.log(`Submitting expand image for image ${index + 1}:`, payload);

        // Step 4: Submit expand job
        const response = await submitExpandImageJob(payload);
        console.log(`Job ${index + 1} submitted:`, response);

        return {
          jobId: response.jobId,
          imageName: image.name,
        };
      });

      const submittedJobs = await Promise.all(jobPromises);

      // Initialize job statuses
      const initialStatuses: JobStatus[] = submittedJobs.map((job) => ({
        jobId: job.jobId,
        status: "pending",
      }));
      setJobs(initialStatuses);

      // Poll each job for completion
      const pollPromises = submittedJobs.map(async (job, index) => {
        const finalStatus = await pollJobUntilComplete(
          job.jobId,
          checkFireflyJobStatus,
          [], // downloadHrefs not needed - result comes from API
          (status) => {
            setJobs((prev) => {
              const updated = [...prev];
              updated[index] = status;
              return updated;
            });
          },
          60, // Max attempts
          3000, // 3 second interval
        );
        return finalStatus;
      });

      const finalStatuses = await Promise.all(pollPromises);
      setJobs(finalStatuses);
    } catch (err) {
      console.error("Error submitting expand image job:", err);
      setError(err instanceof Error ? err.message : "Failed to submit job");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Expand Image (Generative Fill)
      </h1>
      <p className="text-gray-600 mb-8">
        Expand your images to larger dimensions using Adobe Firefly's AI-powered
        generative fill. The AI intelligently generates content to fill the
        expanded areas, matching the style and context of your original image.
      </p>

      <div className="space-y-8">
        {/* Image Selection */}
        <section className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Select Images
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Choose one or more images from your S3 bucket to expand.
          </p>
          <ImageSelector
            selectedImages={selectedImages}
            onSelectionChange={setSelectedImages}
            multiSelect={true}
          />
        </section>

        {/* Size Settings */}
        <section className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Target Size
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preset Sizes
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {PRESET_SIZES.map((size, index) => (
                  <button
                    key={size.label}
                    onClick={() => handlePresetChange(index)}
                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                      presetSize.label === size.label
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                    }`}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
            </div>

            {presetSize.label === "Custom" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Width (px)
                  </label>
                  <input
                    type="number"
                    value={customWidth}
                    onChange={(e) =>
                      setCustomWidth(parseInt(e.target.value, 10) || 0)
                    }
                    min={1}
                    max={4096}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Height (px)
                  </label>
                  <input
                    type="number"
                    value={customHeight}
                    onChange={(e) =>
                      setCustomHeight(parseInt(e.target.value, 10) || 0)
                    }
                    min={1}
                    max={4096}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
              </div>
            )}

            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>Current size:</strong> {getTargetSize().width} x{" "}
                {getTargetSize().height} pixels
              </p>
            </div>
          </div>
        </section>

        {/* Prompt (Optional) */}
        <section className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Generation Prompt (Optional)
          </h2>
          <p className="text-sm text-gray-600 mb-3">
            Provide a text description to guide what the AI generates in the
            expanded areas. Leave empty to let the AI infer from the image.
          </p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., 'A serene beach at sunset with gentle waves' or 'A modern office space with plants'"
            rows={3}
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </section>

        {/* Placement Settings */}
        <section className="bg-white p-6 rounded-lg border">
          <div className="flex items-center gap-3 mb-4">
            <input
              type="checkbox"
              id="usePlacement"
              checked={usePlacement}
              onChange={(e) => setUsePlacement(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <label
              htmlFor="usePlacement"
              className="text-lg font-semibold text-gray-800"
            >
              Custom Placement (Optional)
            </label>
          </div>

          {usePlacement && (
            <div>
              <p className="text-sm text-gray-600 mb-3">
                Choose where to position the original image within the expanded
                canvas.
              </p>

              {/* Visual placement grid */}
              <div className="grid grid-cols-3 gap-2 max-w-xs mb-4">
                {[
                  "top_left",
                  "top_center",
                  "top_right",
                  "center_left",
                  "center",
                  "center_right",
                  "bottom_left",
                  "bottom_center",
                  "bottom_right",
                ].map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setPlacement(pos as ExpandImagePlacement)}
                    className={`aspect-square rounded-lg border-2 transition-colors flex items-center justify-center ${
                      placement === pos
                        ? "bg-blue-600 border-blue-600"
                        : "bg-gray-100 border-gray-300 hover:border-blue-400"
                    }`}
                    title={
                      PLACEMENT_OPTIONS.find((p) => p.value === pos)?.label
                    }
                  >
                    <div
                      className={`w-4 h-4 rounded ${
                        placement === pos ? "bg-white" : "bg-gray-400"
                      }`}
                    />
                  </button>
                ))}
              </div>

              <select
                value={placement}
                onChange={(e) =>
                  setPlacement(e.target.value as ExpandImagePlacement)
                }
                className="w-full p-2 border rounded-lg"
              >
                {PLACEMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>

        {/* Info Box */}
        <section className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">
            How it works
          </h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Select one or more images from your S3 bucket</li>
            <li>• Choose the target size for the expanded image</li>
            <li>• Optionally provide a prompt to guide the AI generation</li>
            <li>• Optionally specify where to position the original image</li>
            <li>• The AI will generate content to fill the expanded areas</li>
          </ul>
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
          disabled={isSubmitting || selectedImages.length === 0}
          className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
            isSubmitting || selectedImages.length === 0
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner size="sm" />
              Expanding {selectedImages.length} image
              {selectedImages.length > 1 ? "s" : ""}...
            </span>
          ) : (
            `Expand ${selectedImages.length} Image${selectedImages.length !== 1 ? "s" : ""} to ${getTargetSize().width}x${getTargetSize().height}`
          )}
        </button>

        {/* Job Status */}
        <JobStatusDisplay
          jobs={jobs}
          title="Expand Image Status"
          jobType="expand"
        />
      </div>
    </div>
  );
}
