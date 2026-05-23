/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PhotoFilterSettings } from "../types";

/**
 * Resizes and compresses an image to fit inside Firestore sizes, maintaining proportion.
 * Converts to JPEG with standard compressed quality.
 */
export function resizeAndOptimizeImage(
  dataUrl: string,
  maxDimension = 900,
  quality = 0.8
): Promise<{ dataUrl: string; width: number; height: number; size: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Calculate perfect proportional sizing
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not acquire 2D canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const optimizedUrl = canvas.toDataURL("image/jpeg", quality);
      
      // Calculate approximate size in bytes from base64 string length
      const head = "data:image/jpeg;base64,";
      const sizeInBytes = Math.round((optimizedUrl.length - head.length) * 3 / 4);

      resolve({
        dataUrl: optimizedUrl,
        width,
        height,
        size: sizeInBytes
      });
    };
    img.onerror = (e) => reject(new Error("Unable to parse image data link: " + e));
    img.src = dataUrl;
  });
}

/**
 * Applies professional editing adjustments, filters, rotations, and flips using Canvas APIs.
 */
export function applyPhotoFilters(
  srcDataUrl: string,
  filters: PhotoFilterSettings
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      
      // Compute canvas sizing based on ninety-degree rotations
      const is90or270 = filters.rotation === 90 || filters.rotation === 270;
      const targetWidth = is90or270 ? img.height : img.width;
      const targetHeight = is90or270 ? img.width : img.height;

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context is unavailable"));
        return;
      }

      ctx.save();

      // Move origin to the center of the canvas to apply transforms
      ctx.translate(canvas.width / 2, canvas.height / 2);

      // Apply Rotations
      if (filters.rotation !== 0) {
        ctx.rotate((filters.rotation * Math.PI) / 180);
      }

      // Apply Flips
      const scaleX = filters.hFlip ? -1 : 1;
      const scaleY = filters.vFlip ? -1 : 1;
      ctx.scale(scaleX, scaleY);

      // Apply Filters directly via Canvas filter property
      // Combine adjustments: brightness, contrast, saturation, exposure, sepia, grayscale, blur
      // Canvas filter brightness/contrast/saturate take percentages (e.g., "110%")
      // Manual exposure is simulated by mapping exposure to a overlay drawing or adjusting brightness slightly
      const brightnessVal = filters.brightness + (filters.exposure * 0.5); // Blend exposure into brightness
      const filterString = [
        `brightness(${brightnessVal}%)`,
        `contrast(${filters.contrast}%)`,
        `saturate(${filters.saturation}%)`,
        `sepia(${filters.sepia}%)`,
        `grayscale(${filters.grayscale}%)`,
        filters.blur > 0 ? `blur(${filters.blur}px)` : ""
      ].filter(Boolean).join(" ");

      ctx.filter = filterString;

      // Draw image centered around the origin
      const dWidth = is90or270 ? canvas.height : canvas.width;
      const dHeight = is90or270 ? canvas.width : canvas.height;
      ctx.drawImage(img, -dWidth / 2, -dHeight / 2, dWidth, dHeight);

      ctx.restore();

      // Export as optimized JPEG
      const finalUrl = canvas.toDataURL("image/jpeg", 0.9);
      resolve(finalUrl);
    };
    img.onerror = () => reject(new Error("Could not load image source for filtering"));
    img.src = srcDataUrl;
  });
}
