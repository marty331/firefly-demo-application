import { useState } from "react";
import ImageSelector from "@/components/ImageSelector";
import ColorPicker from "@/components/ColorPicker";
import JobStatusDisplay from "@/components/JobStatusDisplay";
import Spinner from "@/components/Spinner";
import type {
  S3Image,
  JobStatus,
  RemoveBackgroundPayload,
  RemoveBackgroundMode,
  RemoveBackgroundMediaType,
  RGBAColor,
} from "@/types";
import {
  generateAccessToken,
  getPresignedDownloadUrl,
  submitRemoveBackgroundJob,
  checkFireflyJobStatus,
  pollJobUntilComplete,
} from "@/services/api";

const MODE_OPTIONS: {
  value: RemoveBackgroundMode;
  label: string;
  description: string;
}[] = [
  {
    value: "cutout",
    label: "Cutout",
    description: "Returns the subject with transparent background",
  },
  {
    value: "mask",
    label: "Mask",
    description: "Returns a grayscale mask of the subject",
  },
  {
    value: "psd",
    label: "PSD",
    description: "Returns a layered Photoshop file",
  },
];

const MEDIA_TYPE_OPTIONS: {
  value: RemoveBackgroundMediaType;
  label: string;
}[] = [
  { value: "image/png", label: "PNG (recommended for transparency)" },
  { value: "image/jpeg", label: "JPEG" },
  { value: "image/webp", label: "WebP" },
  { value: "image/vnd.adobe.photoshop", label: "PSD (Photoshop)" },
];

export default function RemoveBackgroundPage() {
  // Image selection
  const [selectedImages, setSelectedImages] = useState<S3Image[]>([]);

  // Settings
  const [mode, setMode] = useState<RemoveBackgroundMode>("cutout");
  const [outputType, setOutputType] =
    useState<RemoveBackgroundMediaType>("image/png");
  const [trim, setTrim] = useState(false);
  const [useBackgroundColor, setUseBackgroundColor] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState<RGBAColor>({
    red: 255,
    green: 255,
    blue: 255,
    alpha: 1,
  });
  const [colorDecontamination, setColorDecontamination] = useState(1);

  // Job state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  // const extractJobIdFromHref = (href: string): string => {
  //   // Extract job ID from href like "https://image.adobe.io/pie/psdService/status/<jobId>"
  //   return href.split("/").pop() || "";
  // };

  const getOutputExtension = (): string => {
    switch (outputType) {
      case "image/png":
        return ".png";
      case "image/jpeg":
        return ".jpg";
      case "image/webp":
        return ".webp";
      case "image/vnd.adobe.photoshop":
        return ".psd";
      default:
        return ".png";
    }
  };

  const handleSubmit = async () => {
    if (selectedImages.length === 0) {
      setError("Please select at least one image");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    setJobs([]);

    try {
      // Generate access token first
      await generateAccessToken();

      // Process each selected image
      const jobPromises = selectedImages.map(async (image, index) => {
        // Get presigned URL for input (GET)
        const inputPresigned = await getPresignedDownloadUrl(image.name);

        // Generate output key with "nobg_" prefix
        const baseName = image.name.replace(/\.[^.]+$/, ""); // Remove extension
        const outputKey = `nobg_${baseName}${getOutputExtension()}`;

        // Get presigned URL for output (PUT) - not needed for this API as it returns the result
        const downloadPresigned = await getPresignedDownloadUrl(outputKey);

        // Build payload
        const payload: RemoveBackgroundPayload = {
          image: {
            source: {
              url: inputPresigned.url[0],
            },
          },
          mode,
          output: {
            mediaType: outputType,
          },
          trim,
          colorDecontamination,
        };

        // Add background color if enabled and mode is cutout
        if (useBackgroundColor && mode === "cutout") {
          payload.backgroundColor = backgroundColor;
        }

        console.log(
          `Submitting remove background for image ${index + 1}:`,
          payload,
        );

        // Submit job
        const response = await submitRemoveBackgroundJob(payload);
        console.log(`Job ${index + 1} submitted:`, response);

        // Extract job ID from the response
        const jobId = response.jobId;

        return {
          jobId,
          imageName: image.name,
          downloadHref: downloadPresigned.url[0],
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
          [job.downloadHref],
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
      console.log(`Final statuses: ${JSON.stringify(finalStatuses)}`);
      setJobs(finalStatuses);
    } catch (err) {
      console.error("Error submitting remove background job:", err);
      setError(err instanceof Error ? err.message : "Failed to submit job");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleColorChange = (color: {
    r: number;
    g: number;
    b: number;
    a: number;
  }) => {
    setBackgroundColor({
      red: color.r,
      green: color.g,
      blue: color.b,
      alpha: color.a,
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Remove Background
      </h1>
      <p className="text-gray-600 mb-8">
        Remove backgrounds from your images using Adobe's Photoshop AI-powered
        Remove Background API. Select multiple images to process them in batch,
        with options for cutout mode, masking, and background replacement.
      </p>

      <div className="space-y-8">
        {/* Image Selection */}
        <section className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Select Images
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Choose one or more images from your S3 bucket to remove backgrounds.
          </p>
          <ImageSelector
            selectedImages={selectedImages}
            onSelectionChange={setSelectedImages}
            multiSelect={true}
          />
        </section>

        {/* Mode Selection */}
        <section className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Output Mode
          </h2>
          <div className="space-y-3">
            {MODE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  mode === option.value
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  value={option.value}
                  checked={mode === option.value}
                  onChange={(e) =>
                    setMode(e.target.value as RemoveBackgroundMode)
                  }
                  className="mt-1"
                />
                <div>
                  <span className="font-medium text-gray-800">
                    {option.label}
                  </span>
                  <p className="text-sm text-gray-500">{option.description}</p>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Output Format */}
        <section className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Output Format
          </h2>
          <select
            value={outputType}
            onChange={(e) =>
              setOutputType(e.target.value as RemoveBackgroundMediaType)
            }
            className="w-full p-3 border rounded-lg"
          >
            {MEDIA_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </section>

        {/* Additional Options */}
        <section className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Additional Options
          </h2>

          <div className="space-y-6">
            {/* Trim */}
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={trim}
                onChange={(e) => setTrim(e.target.checked)}
                className="mt-1 w-4 h-4 rounded"
              />
              <div>
                <span className="font-medium text-gray-800">
                  Trim Transparent Pixels
                </span>
                <p className="text-sm text-gray-500">
                  If enabled, crops the image to the cutout border, removing
                  transparent pixels
                </p>
              </div>
            </label>

            {/* Color Decontamination */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color Decontamination: {colorDecontamination}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={colorDecontamination}
                onChange={(e) =>
                  setColorDecontamination(parseFloat(e.target.value))
                }
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Off (0)</span>
                <span>Full (1)</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Removes colored reflections left on the subject by the original
                background
              </p>
            </div>

            {/* Background Color (only for cutout mode) */}
            {mode === "cutout" && (
              <div>
                <label className="flex items-start gap-3 mb-3">
                  <input
                    type="checkbox"
                    checked={useBackgroundColor}
                    onChange={(e) => setUseBackgroundColor(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded"
                  />
                  <div>
                    <span className="font-medium text-gray-800">
                      Replace Background Color
                    </span>
                    <p className="text-sm text-gray-500">
                      Fill the background with a solid color instead of
                      transparency
                    </p>
                  </div>
                </label>

                {useBackgroundColor && (
                  <div className="ml-7">
                    <ColorPicker
                      color={{
                        r: backgroundColor.red,
                        g: backgroundColor.green,
                        b: backgroundColor.blue,
                        a: backgroundColor.alpha,
                      }}
                      onChange={handleColorChange}
                    />
                    <div className="mt-2 text-sm text-gray-500">
                      Selected: RGBA({backgroundColor.red},{" "}
                      {backgroundColor.green}, {backgroundColor.blue},{" "}
                      {backgroundColor.alpha})
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Info Box */}
        <section className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">
            How it works
          </h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Select one or more images from your S3 bucket</li>
            <li>• Choose the output mode (cutout, mask, or PSD)</li>
            <li>• Configure output format and additional options</li>
            <li>• Click "Remove Background" to process all selected images</li>
            <li>• Processed images will be saved with "nobg_" prefix</li>
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
              Processing {selectedImages.length} image
              {selectedImages.length > 1 ? "s" : ""}...
            </span>
          ) : (
            `Remove Background from ${selectedImages.length} image${selectedImages.length !== 1 ? "s" : ""}`
          )}
        </button>

        {/* Job Status */}
        <JobStatusDisplay jobs={jobs} title="Remove Background Status" />
      </div>
    </div>
  );
}
