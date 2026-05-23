/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  X, 
  Trash2, 
  Download, 
  Clock, 
  Crop, 
  ChevronLeft, 
  ChevronRight, 
  Tag, 
  Lock, 
  FileText,
  Plus
} from "lucide-react";
import { DecryptedPhoto } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface PhotoDetailModalProps {
  photo: DecryptedPhoto;
  isEncryptedInDb: boolean;
  onClose: () => void;
  onDelete: () => void;
  onEditTrigger: () => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  // Slideshow selectors
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export default function PhotoDetailModal({
  photo,
  isEncryptedInDb,
  onClose,
  onDelete,
  onEditTrigger,
  onAddTag,
  onRemoveTag,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false
}: PhotoDetailModalProps) {
  const [newTag, setNewTag] = useState("");

  const handleAddTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim()) return;
    onAddTag(newTag.trim().toLowerCase());
    setNewTag("");
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = photo.dataUrl;
    link.download = `${photo.title || "download"}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/90">
        {/* Backdrop clicking exits */}
        <div id="slideshow-backdrop" className="absolute inset-0 cursor-default" onClick={onClose} />

        {/* Floating controls */}
        <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
          <button
            id="modal-edit-action-btn"
            onClick={onEditTrigger}
            title="Edit Filters & Transformations"
            className="p-2.5 bg-[#121215] hover:bg-white hover:text-black border border-zinc-800 text-white rounded-xl transition duration-150 backdrop-blur-md cursor-pointer flex items-center gap-2 text-sm font-semibold font-mono uppercase tracking-wider shadow-xl"
          >
            <Crop className="w-4 h-4" />
            <span className="hidden sm:inline">Edit Photo</span>
          </button>
          
          <button
            id="modal-download-action-btn"
            onClick={handleDownload}
            title="Download Decrypted JPEG"
            className="p-2.5 bg-[#121215] hover:bg-zinc-800 border border-zinc-800 text-white rounded-xl transition backdrop-blur-md cursor-pointer shadow-xl"
          >
            <Download className="w-4 h-4" />
          </button>
          
          <button
            id="modal-delete-action-btn"
            onClick={onDelete}
            title="Permanently Delete Photo Directly from Database"
            className="p-2.5 bg-[#121215] hover:bg-red-950/80 hover:text-red-400 border border-zinc-800 hover:border-red-900 rounded-xl transition backdrop-blur-md cursor-pointer shadow-xl animate-pulse"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            id="modal-close-action-btn"
            onClick={onClose}
            className="p-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl transition backdrop-blur-md cursor-pointer shadow-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Slideshow Arrows */}
        {hasPrev && onPrev && (
          <button
            id="prev-slide-btn"
            onClick={onPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-40 p-3 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-white rounded-full transition backdrop-blur-md cursor-pointer focus:outline-none"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {hasNext && onNext && (
          <button
            id="next-slide-btn"
            onClick={onNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-40 p-3 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-white rounded-full transition backdrop-blur-md cursor-pointer focus:outline-none"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Main Split Layout */}
        <div className="relative w-full h-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-center pointer-events-none z-10 py-12 lg:py-6">
          
          {/* Left Area: Large Image Display */}
          <div className="lg:col-span-8 flex items-center justify-center w-full h-full select-none pointer-events-auto">
            <motion.img
              id="fullscreen-photo-item"
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.18 }}
              src={photo.dataUrl}
              alt={photo.title}
              className="max-w-full max-h-[75vh] md:max-h-[82vh] rounded-2xl object-contain shadow-2xl border border-zinc-800"
            />
          </div>

          {/* Right Area: Metadata Sidebar Panel */}
          <div className="lg:col-span-4 bg-[#0f0f12] border border-zinc-850 text-zinc-200 rounded-3xl p-6 shadow-2xl pointer-events-auto max-h-[80vh] overflow-y-auto w-full">
            <div className="space-y-6">
              {/* Type Badge */}
              <div className="flex items-center justify-between">
                {isEncryptedInDb ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-800 text-xs font-bold font-mono uppercase tracking-wider">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Secure Encrypted</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-950 text-zinc-400 border border-zinc-850 text-xs font-bold font-mono">
                    <span>Unencrypted Standard</span>
                  </div>
                )}
                
                <span className="text-xs text-zinc-550 font-mono font-bold">
                  ID: {photo.id.substring(6)}
                </span>
              </div>

              {/* Title & Desc */}
              <div className="space-y-2">
                <h2 id="photo-detail-title" className="text-xl font-bold tracking-tight text-white font-mono">
                  {photo.title || "Untitled Photo"}
                </h2>
                <p id="photo-detail-desc" className="text-sm text-zinc-400 leading-relaxed font-sans">
                  {photo.description || "No description provided."}
                </p>
              </div>

              {/* Meta items */}
              <div className="border-t border-zinc-850 pt-4 space-y-3 text-xs text-zinc-400">
                <div className="flex items-center gap-2.5 font-mono">
                  <Clock className="w-4 h-4 text-zinc-600 shrink-0" />
                  <span>Uploaded on {new Date(photo.uploadedAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Tags Section */}
              <div className="border-t border-zinc-855 pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider font-mono text-zinc-200">
                    <Tag className="w-4 h-4 text-zinc-500" />
                    <span>Photo Tags</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase font-mono">
                    {(photo.tags || []).length} registered
                  </span>
                </div>

                {/* Tags cluster */}
                <div className="flex flex-wrap gap-1.5">
                  {(photo.tags || []).map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-zinc-950 text-zinc-300 border border-zinc-850 text-xs font-semibold"
                    >
                      <span>#{tag}</span>
                      <button
                        type="button"
                        onClick={() => onRemoveTag(tag)}
                        className="text-zinc-650 hover:text-red-400 shrink-0 rounded transition p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  
                  {(photo.tags || []).length === 0 && (
                    <span className="text-xs text-zinc-550 italic">No tags added yet.</span>
                  )}
                </div>

                {/* Add Tag Form */}
                <form onSubmit={handleAddTagSubmit} className="flex gap-2">
                  <input
                    id="add-tag-field"
                    type="text"
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    placeholder="Add tag..."
                    maxLength={20}
                    className="flex-1 px-3 py-1.5 bg-zinc-950 border border-zinc-850 rounded-xl text-xs text-white placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-600 font-mono"
                  />
                  <button
                    id="add-tag-btn"
                    type="submit"
                    className="px-3 bg-white hover:bg-zinc-250 hover:scale-[1.02] text-zinc-950 rounded-xl transition duration-150 cursor-pointer flex items-center justify-center border border-white"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                </form>
              </div>

            </div>
          </div>

        </div>
      </div>
    </AnimatePresence>
  );
}
