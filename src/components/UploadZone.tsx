/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { Upload, Image as ImageIcon, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { resizeAndOptimizeImage } from "../utils/canvas";

interface UploadZoneProps {
  onFileProcessed: (payload: {
    title: string;
    dataUrl: string;
    size: number;
    width: number;
    height: number;
    mimeType: string;
  }) => void;
}

export default function UploadZone({ onFileProcessed }: UploadZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMsg("Selected file is not an image. Please upload JPEGs, PNGs, etc.");
      return;
    }

    setCompressing(true);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        setErrorMsg("Failed to read image file content.");
        setCompressing(false);
        return;
      }

      try {
        // Automatically optimize and resize image client-side to keep under 150KB (highly compatible with Firestore)
        const optimized = await resizeAndOptimizeImage(dataUrl, 900, 0.8);
        
        let fileTitle = file.name;
        // Trim file extension
        const dotIdx = fileTitle.lastIndexOf(".");
        if (dotIdx > 0) {
          fileTitle = fileTitle.substring(0, dotIdx);
        }

        onFileProcessed({
          title: fileTitle,
          dataUrl: optimized.dataUrl,
          size: optimized.size,
          width: optimized.width,
          height: optimized.height,
          mimeType: "image/jpeg" // Always jpeg after canvas processing
        });
      } catch (err: any) {
        setErrorMsg("Failed to process and compress image: " + err.message);
      } finally {
        setCompressing(false);
      }
    };

    reader.onerror = () => {
      setErrorMsg("Error reading image file.");
      setCompressing(false);
    };

    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerSelectFile = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <div
        id="upload-dropzone"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerSelectFile}
        className={`border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-205 py-10 relative ${
          isDragActive 
            ? "border-zinc-400 bg-zinc-900/80 scale-[0.99]" 
            : "border-zinc-850 hover:border-zinc-700 bg-zinc-950/40 hover:bg-zinc-900/30"
        }`}
      >
        <input
          id="hidden-file-input"
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          disabled={compressing}
        />

        {compressing ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
            <div>
              <p className="text-xs font-bold text-zinc-200 uppercase tracking-widest font-mono">Optimizing Photo Payload...</p>
              <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider font-mono">Client-Side GCM Safe Encoding</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-zinc-900 text-zinc-350 flex items-center justify-center border border-zinc-800">
              <Upload className="w-6 h-6 shrink-0" />
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold font-mono uppercase tracking-widest text-zinc-200">
                Drag & Drop photo or <span className="text-white underline font-semibold decoration-zinc-500 cursor-pointer">browse file</span>
              </p>
              <p className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">Supports PNG, JPG, GIF, WebP up to 10MB</p>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-950 text-zinc-400 rounded-full border border-zinc-850 text-[10px] font-bold uppercase font-mono tracking-widest">
              <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
              <span>Auto-optimized below 100KB</span>
            </div>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-950/20 border border-red-900/50 text-red-400 rounded-xl flex items-start gap-2 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
          <span className="font-mono">{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
