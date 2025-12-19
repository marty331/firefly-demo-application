import { useState, useEffect } from 'react';
import type { S3Image } from '@/types';
import { listS3Images } from '@/services/api';
import Spinner from './Spinner';

interface ImageSelectorProps {
  selectedImages: S3Image[];
  onSelectionChange: (images: S3Image[]) => void;
  multiSelect?: boolean;
}

export default function ImageSelector({
  selectedImages,
  onSelectionChange,
  multiSelect = true,
}: ImageSelectorProps) {
  const [images, setImages] = useState<S3Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadImages() {
      try {
        setLoading(true);
        const data = await listS3Images();
        setImages(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load images');
      } finally {
        setLoading(false);
      }
    }
    loadImages();
  }, []);

  const toggleImage = (image: S3Image) => {
    if (multiSelect) {
      const isSelected = selectedImages.some((img) => img.key === image.key);
      if (isSelected) {
        onSelectionChange(selectedImages.filter((img) => img.key !== image.key));
      } else {
        onSelectionChange([...selectedImages, image]);
      }
    } else {
      onSelectionChange([image]);
    }
  };

  const isSelected = (image: S3Image) =>
    selectedImages.some((img) => img.key === image.key);

  if (loading) {
    return (
      <div className="py-8">
        <Spinner />
        <p className="text-center text-gray-500 mt-2">Loading images...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-700">
          Select Image{multiSelect ? 's' : ''} from S3
        </h3>
        {multiSelect && selectedImages.length > 0 && (
          <button
            onClick={() => onSelectionChange([])}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Clear selection ({selectedImages.length})
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {images.map((image) => (
          <button
            key={image.key}
            onClick={() => toggleImage(image)}
            className={`relative p-2 border-2 rounded-lg transition-all ${
              isSelected(image)
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-400'
            }`}
          >
            <div className="aspect-square bg-gray-100 rounded flex items-center justify-center overflow-hidden">
              {image.url ? (
                <img
                  src={image.url}
                  alt={image.name}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="text-gray-400 text-xs text-center p-2">
                  {image.name}
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-600 truncate">{image.name}</p>
            {isSelected(image) && (
              <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                ✓
              </div>
            )}
          </button>
        ))}
      </div>

      {images.length === 0 && (
        <p className="text-center text-gray-500 py-4">
          No images found in the S3 bucket
        </p>
      )}
    </div>
  );
}
