import { useState } from "react";
import type { JobStatus } from "@/types";
import Spinner from "./Spinner";

interface JobStatusDisplayProps {
  jobs: JobStatus[];
  title?: string;
  originalImage?: string;
  jobType?: string;
}

export default function JobStatusDisplay({
  jobs,
  title = "Job Status",
  originalImage,
  jobType,
}: JobStatusDisplayProps) {
  if (jobs.length === 0) return null;
  console.log(`Jobs: ${JSON.stringify(jobs)}`);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const allCompleted = jobs.every(
    (job) =>
      job.outputs &&
      job.outputs.length > 0 &&
      job.outputs[0].status === "succeeded",
  );
  const backgroundCompleted = jobs.every(
    (job) =>
      job.result &&
      job.result.outputs &&
      job.result.outputs.length > 0 &&
      job.result.outputs[0].destination &&
      job.result.outputs[0].destination.url &&
      (job.status === "succeeded" || job.status === "failed"),
  );
  const expandCompleted = jobs.every(
    (job) =>
      job.result &&
      job.result.outputs &&
      job.result.outputs.length > 0 &&
      job.result.outputs[0].image &&
      job.result.outputs[0].image.url &&
      (job.status === "succeeded" || job.status === "failed"),
  );
  const videoCompleted = jobs.every(
    (job) =>
      (job.result &&
        job.result.outputs &&
        job.result.outputs.length > 0 &&
        job.result.outputs[0].video) ||
      (job.outputs &&
        job.outputs.length > 0 &&
        job.outputs[0].mediaDestination &&
        job.outputs[0].mediaDestination.url &&
        (job.status === "succeeded" || job.status === "failed")),
  );
  console.log(
    `allCompleted: ${allCompleted}, backgroundCompleted: ${backgroundCompleted}, videoCompleted: ${videoCompleted}, expandCompleted ${expandCompleted}, jobs: ${JSON.stringify(jobs)}`,
  );
  const anyFailed = jobs.some((job) => job.status === "failed");
  const anyRunning = jobs.some(
    (job) => job.status === "running" || job.status === "pending",
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="font-medium text-gray-700">{title}</h3>
        {anyRunning && <Spinner size="sm" />}
        {(allCompleted || videoCompleted || backgroundCompleted) &&
          !anyFailed && (
            <span className="text-green-600 text-sm">✓ All completed</span>
          )}
        {anyFailed && (
          <span className="text-red-600 text-sm">Some jobs failed</span>
        )}
      </div>

      <div className="space-y-2">
        {jobs.map((job) => (
          <div
            key={job.jobId}
            className={`p-3 rounded border ${
              job.status === "succeeded"
                ? "bg-green-50 border-green-200"
                : job.status === "failed"
                  ? "bg-red-50 border-red-200"
                  : "bg-gray-50 border-gray-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono truncate flex-1">
                {job.jobId}
              </span>
              <span
                className={`text-xs px-2 py-1 rounded ${
                  job.status === "succeeded"
                    ? "bg-green-100 text-green-800"
                    : job.status === "failed"
                      ? "bg-red-100 text-red-800"
                      : job.status === "running"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-800"
                }`}
              >
                {job.status}
              </span>
            </div>

            {job.error && (
              <p className="mt-2 text-sm text-red-600">{job.error}</p>
            )}
          </div>
        ))}
      </div>

      {/* Rendered Images */}
      {(allCompleted || backgroundCompleted || expandCompleted) && (
        <div className="mt-6">
          <h4 className="font-medium text-gray-700 mb-3">Results</h4>
          {/* Regular Images */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {jobs
              .filter((job) => job.outputs)
              .flatMap((job) =>
                job.outputs!.map((output, idx) => (
                  <div
                    key={`${job.jobId}-${idx}`}
                    className="border rounded overflow-hidden"
                  >
                    {output.downloadHref ? (
                      <img
                        src={output.downloadHref}
                        alt={`Result ${idx + 1}`}
                        className="w-full aspect-square object-cover"
                        onClick={() => setSelectedImage(output.downloadHref!)}
                      />
                    ) : (
                      <div className="w-full aspect-square bg-gray-100 flex items-center justify-center text-sm text-gray-500">
                        No preview
                      </div>
                    )}
                  </div>
                )),
              )}
          </div>
          {/* Background Images */}
          {backgroundCompleted && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {jobs
                .filter((job) => job.result!.outputs)
                .flatMap((job) =>
                  job.result!.outputs!.map((output, idx) => (
                    <div
                      key={`${job.jobId}-${idx}`}
                      className="border rounded overflow-hidden"
                    >
                      {output.destination ? (
                        <img
                          src={output.destination.url}
                          alt={`Result ${idx + 1}`}
                          className="w-full aspect-square object-cover"
                          onClick={() =>
                            setSelectedImage(output.destination!.url)
                          }
                        />
                      ) : (
                        <div className="w-full aspect-square bg-gray-100 flex items-center justify-center text-sm text-gray-500">
                          No preview
                        </div>
                      )}
                    </div>
                  )),
                )}
            </div>
          )}
          {expandCompleted && jobType === "expand" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {jobs
                .filter((job) => job.result!.outputs)
                .flatMap((job) =>
                  job.result!.outputs!.map((output, idx) => (
                    <div
                      key={`${job.jobId}-${idx}`}
                      className="border rounded overflow-hidden"
                    >
                      {output.image ? (
                        <img
                          src={output.image.url}
                          alt={`Result ${idx + 1}`}
                          className="w-full aspect-square object-cover"
                          onClick={() => setSelectedImage(output!.image!.url)}
                        />
                      ) : (
                        <div className="w-full aspect-square bg-gray-100 flex items-center justify-center text-sm text-gray-500">
                          No preview
                        </div>
                      )}
                    </div>
                  )),
                )}
            </div>
          )}
          {/* Image Modal */}
          {selectedImage && (
            <div
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
              onClick={() => setSelectedImage(null)}
            >
              <div className="relative max-w-4xl max-h-[90vh]">
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute -top-10 right-0 text-white hover:text-gray-300 text-xl"
                >
                  ✕ Close
                </button>
                <img
                  src={selectedImage}
                  alt="Full size preview"
                  className="max-w-full max-h-[85vh] object-contain rounded"
                  onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image
                />
              </div>
            </div>
          )}
          {selectedImage && jobType === "tone" && originalImage && (
            <div
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
              onClick={() => setSelectedImage(null)}
            >
              <div className="relative max-w-4xl max-h-[90vh] mb-4 bg-black">
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute -top-10 right-0 text-white hover:text-gray-300 text-xl"
                >
                  ✕ Close
                </button>
                <div className="top-0 left-0 right-0 bottom-0 opacity-50 text-white">
                  Enhanced Image
                </div>
                <img
                  src={selectedImage}
                  alt="Full size preview"
                  className="max-w-full max-h-[50vh] object-contain rounded"
                  onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image
                />
                <div>
                  <div className="top-20 left-0 right-0 bottom-0 opacity-50 text-white">
                    Original Image
                  </div>
                  <img
                    src={originalImage}
                    alt="Full size preview"
                    className="max-w-full max-h-[50vh] object-contain rounded"
                    onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Render Video */}
      {videoCompleted && (
        <div className="flex flex-col items-center justify-center">
          {jobs
            .filter((job) => job.result?.outputs)
            .flatMap((job) =>
              job.result!.outputs!.map((output) => (
                <video
                  key={job.jobId}
                  src={output!.video!.url}
                  controls
                  className="w-full aspect-video object-cover"
                />
              )),
            )}
        </div>
      )}
      {videoCompleted && (
        <div className="flex flex-col items-center justify-center">
          {jobs
            .filter((job) => job.outputs)
            .flatMap((job) =>
              job.outputs!.map((output) => (
                <video
                  key={job.jobId}
                  src={output!.mediaDestination!.url}
                  controls
                  className="w-full aspect-video object-cover"
                />
              )),
            )}
        </div>
      )}
    </div>
  );
}
