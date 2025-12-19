import { Link } from "react-router-dom";

interface ScenarioCard {
  title: string;
  description: string;
  path: string;
  icon: string;
  status: "ready" | "stub";
}

const scenarios: ScenarioCard[] = [
  {
    title: "Crop Image",
    description:
      "Bulk crop images with customizable padding options using the Photoshop productCrop API.",
    path: "/crop-image",
    icon: "✂️",
    status: "ready",
  },
  {
    title: "Remove Background",
    description:
      "Remove backgrounds from images with cutout, mask, or PSD output modes.",
    path: "/remove-background",
    icon: "🎭",
    status: "ready",
  },
  {
    title: "Resize",
    description:
      "Batch resize images with various scaling options (fit, fill, stretch).",
    path: "/resize",
    icon: "📐",
    status: "ready",
  },
  {
    title: "Color Grade",
    description:
      "Apply color grading adjustments: brightness, contrast, saturation, temperature.",
    path: "/color-grade",
    icon: "🎨",
    status: "ready",
  },
  {
    title: "Video Reframe",
    description:
      "Automatically reframe videos for different aspect ratios with intelligent scene detection.",
    path: "/video-reframe",
    icon: "🎬",
    status: "ready",
  },
  {
    title: "Banner Variants",
    description:
      "Generate unlimited banner and image variants for channels, localization, and personalization.",
    path: "/banner-variants",
    icon: "🖼️",
    status: "stub",
  },
  {
    title: "Text to Video",
    description: "Generate a video from text with intelligent scene detection.",
    path: "/text-to-video",
    icon: "🎥",
    status: "ready",
  },
];

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Adobe Firefly API Demo
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Select a scenario below to demonstrate Adobe Firefly's powerful image
          and video processing capabilities.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {scenarios.map((scenario) => (
          <Link
            key={scenario.path}
            to={scenario.path}
            className="group block p-6 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all"
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl">{scenario.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600">
                    {scenario.title}
                  </h2>
                  {scenario.status === "stub" && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                      Stub
                    </span>
                  )}
                </div>
                <p className="mt-2 text-gray-600 text-sm">
                  {scenario.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
