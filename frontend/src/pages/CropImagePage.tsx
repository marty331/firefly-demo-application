import { useState } from "react";
import ImageSelector from "@/components/ImageSelector";
import JobStatusDisplay from "@/components/JobStatusDisplay";
import Spinner from "@/components/Spinner";
import type {
  S3Image,
  JobStatus,
  CropImagePayload,
  CropImageResponse,
  CropOutputType,
  CropCompressionType,
  CropUnitType,
} from "@/types";
import {
  generateAccessToken,
  getPresignedDownloadUrl,
  getPresignedUploadUrl,
  submitCropJob,
  checkPsdJobStatus,
  pollJobUntilComplete,
} from "@/services/api";

const OUTPUT_TYPES: { value: CropOutputType; label: string }[] = [
  { value: "image/png", label: "PNG" },
  { value: "image/jpeg", label: "JPEG" },
  { value: "image/tiff", label: "TIFF" },
  { value: "image/vnd.adobe.photoshop", label: "Photoshop (PSD)" },
  { value: "vnd.adobe.photoshop", label: "Photoshop (alt)" },
];

const COMPRESSION_OPTIONS: { value: CropCompressionType; label: string }[] = [
  { value: "small", label: "Small (fastest)" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large (best quality)" },
];

const UNIT_OPTIONS: { value: CropUnitType; label: string }[] = [
  { value: "Percent", label: "Percent" },
  { value: "Pixels", label: "Pixels" },
];

export default function CropImagePage() {
  // Image selection
  const [selectedImages, setSelectedImages] = useState<S3Image[]>([]);

  // Output settings
  const [outputType, setOutputType] = useState<CropOutputType>("image/png");
  const [quality, setQuality] = useState(7);
  const [compression, setCompression] = useState<CropCompressionType>("large");

  // Crop options
  const [unit, setUnit] = useState<CropUnitType>("Percent");
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  // Job state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isJpeg = outputType === "image/jpeg";
  const isPng = outputType === "image/png";

  const handleSubmit = async () => {
    if (selectedImages.length === 0) {
      setError("Please select at least one image");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setJobs([]);

    try {
      // Generate access token first
      await generateAccessToken();

      // Process each selected image as a separate job
      const jobPromises = selectedImages.map(async (img, index) => {
        console.log(`Processing image ${index + 1}: ${JSON.stringify(img)}`);

        // Get presigned URL for input (GET)
        const { url: inputUrl } = await getPresignedDownloadUrl(img.name);

        // Get presigned URL for output (PUT)
        const outputKey = `cropped_${img.name}`;
        const { url: uploadUrl } = await getPresignedUploadUrl(outputKey);

        // Get presigned URL for viewing result (GET)
        const { url: downloadUrl } = await getPresignedDownloadUrl(
          `altered/${outputKey}`,
        );

        // Build payload for single image
        const payload: CropImagePayload = {
          inputs: [
            {
              href: Array.isArray(inputUrl) ? inputUrl[0] : inputUrl,
              storage: "external" as const,
            },
          ],
          outputs: [
            {
              href: Array.isArray(uploadUrl) ? uploadUrl[0] : uploadUrl,
              storage: "external" as const,
              type: outputType,
              overwrite: true as const,
              quality,
              ...(isPng && { compression }),
            },
          ],
          options: {
            unit,
            width,
            height,
          },
        };

        console.log(`Payload for image ${index + 1}:`, JSON.stringify(payload));

        // Submit the crop job
        const response: CropImageResponse = await submitCropJob(payload);
        console.log(
          `Crop Job ${index + 1} submitted:`,
          JSON.stringify(response),
        );

        const jobId = new URL(response._links.self.href).pathname
          .split("/")
          .pop();

        return {
          jobId: jobId!,
          imageName: img.name,
          downloadHref: Array.isArray(downloadUrl)
            ? downloadUrl[0]
            : downloadUrl,
        };
      });

      const submittedJobs = await Promise.all(jobPromises);

      // Initialize job statuses for all jobs
      const initialStatuses: JobStatus[] = submittedJobs.map((job) => ({
        jobId: job.jobId,
        status: "pending",
      }));
      setJobs(initialStatuses);

      // Poll each job for completion
      const pollPromises = submittedJobs.map(async (job, index) => {
        const finalStatus = await pollJobUntilComplete(
          job.jobId,
          checkPsdJobStatus,
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
      setJobs(finalStatuses);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getExtension = (type: CropOutputType): string => {
    const extensions: Record<CropOutputType, string> = {
      "image/png": ".png",
      "image/jpeg": ".jpg",
      "image/tiff": ".tiff",
      "image/vnd.adobe.photoshop": ".psd",
      "vnd.adobe.photoshop": ".psd",
    };
    return extensions[type];
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Crop Image</h1>
      <p className="text-gray-600 mb-8">
        Bulk crop images using Adobe Photoshop's productCrop API. Select
        multiple images and configure crop settings to process them all at once.
      </p>

      <div className="space-y-8">
        {/* Image Selection */}
        <section className="bg-white p-6 rounded-lg border">
          <ImageSelector
            selectedImages={selectedImages}
            onSelectionChange={setSelectedImages}
            multiSelect={true}
          />
        </section>

        {/* Output Settings */}
        <section className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Output Settings
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Output Type
              </label>
              <select
                value={outputType}
                onChange={(e) =>
                  setOutputType(e.target.value as CropOutputType)
                }
                className="w-full border rounded px-3 py-2"
              >
                {OUTPUT_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {isJpeg && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quality (1-7)
                </label>
                <input
                  type="range"
                  min={1}
                  max={7}
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="w-full"
                />
                <div className="text-sm text-gray-500 text-center">
                  {quality}
                </div>
              </div>
            )}

            {isPng && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Compression
                </label>
                <select
                  value={compression}
                  onChange={(e) =>
                    setCompression(e.target.value as CropCompressionType)
                  }
                  className="w-full border rounded px-3 py-2"
                >
                  {COMPRESSION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </section>

        {/* Crop Options */}
        <section className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Crop Options
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as CropUnitType)}
                className="w-full border rounded px-3 py-2"
              >
                {UNIT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Width Padding
              </label>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                min={0}
                className="w-full border rounded px-3 py-2"
              />
              <span className="text-xs text-gray-500">
                {unit === "Percent" ? "%" : "px"}
              </span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Height Padding
              </label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                min={0}
                className="w-full border rounded px-3 py-2"
              />
              <span className="text-xs text-gray-500">
                {unit === "Percent" ? "%" : "px"}
              </span>
            </div>
          </div>
        </section>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || selectedImages.length === 0}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSubmitting && <Spinner size="sm" />}
          {isSubmitting
            ? `Processing ${selectedImages.length} image${selectedImages.length !== 1 ? "s" : ""}...`
            : `Crop ${selectedImages.length} Image${selectedImages.length !== 1 ? "s" : ""}`}
        </button>

        {/* Job Status */}
        {jobs.length > 0 && (
          <section className="bg-white p-6 rounded-lg border">
            <JobStatusDisplay jobs={jobs} title="Crop Job Status" />
          </section>
        )}
      </div>
    </div>
  );
}
