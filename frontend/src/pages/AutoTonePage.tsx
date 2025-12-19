import { useState } from "react";
import ImageSelector from "@/components/ImageSelector";
import JobStatusDisplay from "@/components/JobStatusDisplay";
import Spinner from "@/components/Spinner";
import type { S3Image, JobStatus, AutoTonePayload } from "@/types";
import {
  generateAccessToken,
  getPresignedDownloadUrl,
  getPresignedUploadUrl,
  submitAutoToneJob,
  checkLightroomJobStatus,
  pollJobUntilComplete,
} from "@/services/api";

export default function AutoTonePage() {
  // Image selection
  const [selectedImages, setSelectedImages] = useState<S3Image[]>([]);

  // Job state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);

  const extractJobIdFromHref = (href: string): string => {
    // Extract job ID from href like "https://image.adobe.io/lrService/status/<jobId>"
    return href.split("/").pop() || "";
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
      const jobPromises = selectedImages.map(async (image) => {
        // Get presigned URL for input (GET)
        const inputPresigned = await getPresignedDownloadUrl(image.name);
        setOriginalImage(inputPresigned.url[0]);

        // Generate output key with "auto_tone_" prefix
        const outputKey = `auto_tone_${image.name}`;

        // Get presigned URL for output (PUT)
        const outputPresigned = await getPresignedUploadUrl(outputKey);

        // Build payload
        const payload: AutoTonePayload = {
          inputs: {
            href: inputPresigned.url[0],
            storage: "external",
          },
          outputs: [
            {
              href: outputPresigned.url[0],
              storage: "external",
            },
          ],
        };

        console.log("Submitting auto-tone payload:", payload);

        // Submit job
        const response = await submitAutoToneJob(payload);
        console.log("Job submitted:", response);

        // Extract job ID from the _links.self.href
        const jobId = extractJobIdFromHref(response._links.self.href);

        // Get presigned download URL for viewing the result
        const alteredOutputKey = `altered/${outputKey}`;
        const downloadPresigned =
          await getPresignedDownloadUrl(alteredOutputKey);

        return {
          jobId,
          downloadHref: downloadPresigned.url,
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
          checkLightroomJobStatus,
          [job.downloadHref[0]],
          (status) => {
            setJobs((prev) => {
              const updated = [...prev];
              updated[index] = status;
              return updated;
            });
          },
        );
        return finalStatus;
      });

      const finalStatuses = await Promise.all(pollPromises);
      console.log("finalStatuses:", finalStatuses);
      setJobs(finalStatuses);
    } catch (err) {
      console.error("Error submitting auto-tone job:", err);
      setError(err instanceof Error ? err.message : "Failed to submit job");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Auto Tone</h1>
      <p className="text-gray-600 mb-8">
        Automatically adjust the tone of your images using Adobe's Lightroom
        AutoTone API. This feature analyzes your image and applies optimal
        exposure, contrast, highlights, shadows, whites, blacks, saturation, and
        vibrance adjustments to enhance your photo.
      </p>

      <div className="space-y-8">
        {/* Image Selection */}
        <section className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Select Images
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Choose one or more images from your S3 bucket to apply auto tone
            adjustments.
          </p>
          <ImageSelector
            selectedImages={selectedImages}
            onSelectionChange={setSelectedImages}
            multiSelect={false}
          />
        </section>

        {/* Info Box */}
        <section className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">
            How it works
          </h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Select one or more images from your S3 bucket</li>
            <li>• Click "Apply Auto Tone" to process the images</li>
            <li>• Processed images will be saved with "auto_tone_" prefix</li>
            <li>• View the results once processing is complete</li>
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
            `Apply Auto Tone to ${selectedImages.length} image${selectedImages.length !== 1 ? "s" : ""}`
          )}
        </button>

        {/* Job Status */}
        <JobStatusDisplay
          jobs={jobs}
          title="Auto Tone Job Status"
          originalImage={originalImage!}
          jobType="tone"
        />
      </div>
    </div>
  );
}
