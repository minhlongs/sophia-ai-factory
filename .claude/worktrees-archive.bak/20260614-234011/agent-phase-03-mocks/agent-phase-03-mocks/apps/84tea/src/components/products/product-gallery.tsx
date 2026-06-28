"use client";

import { useState } from "react";

interface ProductGalleryProps {
  mainImage: string;
  images?: string[];
}

export function ProductGallery({ mainImage, images = [] }: ProductGalleryProps) {
  // Combine main image with additional images, ensuring unique list
  const allImages = [mainImage, ...images.filter(img => img !== mainImage)];
  const [selectedImage, setSelectedImage] = useState(allImages[0]);

  return (
    <div className="flex flex-col gap-4">
      {/* Main Image */}
      <div className="aspect-square bg-surface-container-low rounded-2xl overflow-hidden relative flex items-center justify-center border border-outline-variant">
        <div className="text-9xl select-none animate-in fade-in zoom-in duration-500">
          {selectedImage}
        </div>
      </div>

      {/* Thumbnails */}
      {allImages.length > 1 && (
        <div className="grid grid-cols-4 gap-4">
          {allImages.map((img, index) => (
            <button
              key={index}
              onClick={() => setSelectedImage(img)}
              className={`aspect-square rounded-xl flex items-center justify-center text-3xl bg-surface-container-high transition-all ${
                selectedImage === img
                  ? "border-2 border-primary"
                  : "border border-transparent hover:border-outline-variant"
              }`}
            >
              {img}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
