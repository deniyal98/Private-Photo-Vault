/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  X, 
  RotateCw, 
  FlipHorizontal, 
  FlipVertical, 
  SlidersHorizontal,
  Sparkles,
  Loader2,
  Check,
  Undo2
} from "lucide-react";
import { PhotoFilterSettings } from "../types";
import { applyPhotoFilters } from "../utils/canvas";
import { motion } from "motion/react";

interface PhotoEditorProps {
  isOpen: boolean;
  photoUrl: string;
  photoTitle: string;
  onClose: () => void;
  onSave: (newCompiledDataUrl: string) => void;
}

const INITIAL_FILTERS: PhotoFilterSettings = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  exposure: 0,
  sepia: 0,
  grayscale: 0,
  blur: 0,
  rotation: 0,
  hFlip: false,
  vFlip: false
};

interface FilterPreset {
  name: string;
  settings: Partial<PhotoFilterSettings>;
}

const PRESETS: FilterPreset[] = [
  { name: "Original", settings: INITIAL_FILTERS },
  { name: "Vintage Cafe", settings: { sepia: 65, saturation: 90, contrast: 110 } },
  { name: "Noir Mono", settings: { grayscale: 100, contrast: 130, brightness: 90 } },
  { name: "Warm Velvet", settings: { brightness: 108, saturation: 115, exposure: 12 } },
  { name: "Dreamy Mist", settings: { blur: 1.5, brightness: 105, contrast: 95 } },
  { name: "Cyberpunk", settings: { contrast: 140, saturation: 160, exposure: -5 } }
];

export default function PhotoEditor({ isOpen, photoUrl, photoTitle, onClose, onSave }: PhotoEditorProps) {
  const [filters, setFilters] = useState<PhotoFilterSettings>(INITIAL_FILTERS);
  const [activePreset, setActivePreset] = useState("Original");
  const [previewUrl, setPreviewUrl] = useState(photoUrl);
  const [generating, setGenerating] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setFilters(INITIAL_FILTERS);
    setActivePreset("Original");
    setPreviewUrl(photoUrl);
  }, [photoUrl]);

  // Compute live browser-rendered canvas filters for smooth preview performance
  const generatePreviewLive = async (settings: PhotoFilterSettings) => {
    try {
      const rendered = await applyPhotoFilters(photoUrl, settings);
      setPreviewUrl(rendered);
    } catch (e) {
      console.error("Live preview computation failed:", e);
    }
  };

  // Debounced filters change to avoid blocking UI during live updates
  const handleFilterChange = (key: keyof PhotoFilterSettings, value: any) => {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    setActivePreset("Custom");

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      generatePreviewLive(nextFilters);
    }, 150);
  };

  const applyPreset = (preset: FilterPreset) => {
    const nextFilters = { ...INITIAL_FILTERS, ...preset.settings };
    setFilters(nextFilters);
    setActivePreset(preset.name);
    generatePreviewLive(nextFilters);
  };

  const rotateCw = () => {
    const nextRotation = ((filters.rotation + 90) % 360) as PhotoFilterSettings["rotation"];
    const nextFilters = { ...filters, rotation: nextRotation };
    setFilters(nextFilters);
    generatePreviewLive(nextFilters);
  };

  const toggleHFlip = () => {
    const nextFilters = { ...filters, hFlip: !filters.hFlip };
    setFilters(nextFilters);
    generatePreviewLive(nextFilters);
  };

  const toggleVFlip = () => {
    const nextFilters = { ...filters, vFlip: !filters.vFlip };
    setFilters(nextFilters);
    generatePreviewLive(nextFilters);
  };

  const resetAll = () => {
    setFilters(INITIAL_FILTERS);
    setActivePreset("Original");
    setPreviewUrl(photoUrl);
  };

  const handleSaveSubmit = async () => {
    setGenerating(true);
    try {
      // Computes full high-quality filtered rendering on raw canvas
      const finalCompiled = await applyPhotoFilters(photoUrl, filters);
      onSave(finalCompiled);
    } catch (e) {
      console.error("Could not compile photo development:", e);
    } finally {
      setGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 text-white overflow-hidden backdrop-blur-md">
      
      {/* Container Grid */}
      <div className="w-full h-full max-w-7xl flex flex-col lg:grid lg:grid-cols-12 gap-6 bg-[#0f0f12] border border-zinc-850 rounded-3xl p-6 shadow-2xl relative">
        
        {/* Header Controls */}
        <div className="lg:col-span-12 flex items-center justify-between border-b border-zinc-850 pb-4 h-fit">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-zinc-900 text-zinc-200 border border-zinc-800 rounded-2xl">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight font-mono uppercase">Photo Editing Studio</h3>
              <p className="text-xs text-zinc-450 uppercase tracking-widest mt-0.5 font-mono">Develop and Adjustments on "{photoTitle}"</p>
            </div>
          </div>

          <button
            id="close-editor-btn"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-805 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Central Workspace: Photo Preview Canvas */}
        <div className="lg:col-span-8 flex flex-col items-center justify-center bg-[#070709] border border-zinc-850 rounded-2xl p-6 min-h-[350px] lg:h-full relative overflow-hidden">
          <div className="relative max-w-full max-h-[50vh] lg:max-h-[60vh] flex items-center justify-center">
            {generating && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3 rounded-2xl">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-300">Applying professional grade rendering...</span>
              </div>
            )}
            
            <img
              id="editor-preview-frame"
              src={previewUrl}
              alt="Editor preview workspace"
              className="max-w-full max-h-[50vh] lg:max-h-[58vh] object-contain rounded-xl shadow-xl border border-zinc-800"
            />
          </div>

          {/* Quick Transform Bar */}
          <div className="flex items-center gap-2 mt-4 bg-zinc-950 border border-zinc-850 px-3.5 py-2 rounded-2xl shadow-md z-10">
            <button
              id="rotate-cw-btn"
              onClick={rotateCw}
              title="Rotate 90 degrees Clockwise"
              className="p-2 hover:bg-zinc-900 text-zinc-300 hover:text-white rounded-xl transition cursor-pointer flex items-center gap-2 text-xs font-semibold font-mono"
            >
              <RotateCw className="w-4 h-4" />
              <span>Rotate</span>
            </button>

            <div className="w-px h-5 bg-zinc-850" />

            <button
              id="flip-h-btn"
              onClick={toggleHFlip}
              title="Flip Horizontally"
              className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-2 text-xs font-semibold font-mono ${filters.hFlip ? "bg-white text-black border border-white" : "text-zinc-300 hover:bg-zinc-900 hover:text-white"}`}
            >
              <FlipHorizontal className="w-4 h-4" />
              <span>Flip H</span>
            </button>

            <button
              id="flip-v-btn"
              onClick={toggleVFlip}
              title="Flip Vertically"
              className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-2 text-xs font-semibold font-mono ${filters.vFlip ? "bg-white text-black border border-white" : "text-zinc-300 hover:bg-zinc-900 hover:text-white"}`}
            >
              <FlipVertical className="w-4 h-4" />
              <span>Flip V</span>
            </button>

            <div className="w-px h-5 bg-zinc-850" />

            <button
              id="reset-editor-btn"
              onClick={resetAll}
              title="Reset all settings to Original"
              className="p-2 hover:bg-red-950/30 text-zinc-400 hover:text-red-400 rounded-xl transition cursor-pointer flex items-center gap-2 text-xs font-semibold font-mono"
            >
              <Undo2 className="w-4 h-4" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Sidebar Controls: Filter Sliders */}
        <div className="lg:col-span-4 flex flex-col justify-between bg-[#0f0f12] lg:h-full overflow-y-auto space-y-6">
          <div className="space-y-6">
            
            {/* Presets Segment */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5 font-mono">
                <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
                Selected Developer Presets
              </span>

              <div className="grid grid-cols-3 gap-2">
                {PRESETS.map(p => (
                  <button
                    key={p.name}
                    id={`preset-${p.name.replace(/\s+/g, "-").toLowerCase()}`}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`px-2 py-2 text-[10px] font-bold uppercase tracking-tight leading-none text-center rounded-xl border transition cursor-pointer ${
                      activePreset === p.name 
                        ? "bg-white border-white text-black font-semibold shadow-md" 
                        : "bg-zinc-950 border-zinc-850 text-zinc-300 hover:bg-zinc-900 hover:text-white"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full h-px bg-zinc-850" />

            {/* Adjustment Sliders */}
            <div className="space-y-5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 font-mono">Manual Micro-Adjustments</span>

              {/* Exposure Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-zinc-300">Exposure</span>
                  <span className="font-mono text-white">{filters.exposure > 0 ? `+${filters.exposure}` : filters.exposure}%</span>
                </div>
                <input
                  id="slider-exposure"
                  type="range"
                  min={-100}
                  max={100}
                  value={filters.exposure}
                  onChange={e => handleFilterChange("exposure", parseInt(e.target.value))}
                  className="w-full accent-white bg-zinc-900 rounded-lg cursor-pointer h-1.5"
                />
              </div>

              {/* Brightness Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-zinc-300">Brightness</span>
                  <span className="font-mono text-white">{filters.brightness}%</span>
                </div>
                <input
                  id="slider-brightness"
                  type="range"
                  min={0}
                  max={200}
                  value={filters.brightness}
                  onChange={e => handleFilterChange("brightness", parseInt(e.target.value))}
                  className="w-full accent-white bg-zinc-900 rounded-lg cursor-pointer h-1.5"
                />
              </div>

              {/* Contrast Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-zinc-300">Contrast</span>
                  <span className="font-mono text-white">{filters.contrast}%</span>
                </div>
                <input
                  id="slider-contrast"
                  type="range"
                  min={0}
                  max={200}
                  value={filters.contrast}
                  onChange={e => handleFilterChange("contrast", parseInt(e.target.value))}
                  className="w-full accent-white bg-zinc-900 rounded-lg cursor-pointer h-1.5"
                />
              </div>

              {/* Saturation Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-zinc-300">Saturation</span>
                  <span className="font-mono text-white">{filters.saturation}%</span>
                </div>
                <input
                  id="slider-saturation"
                  type="range"
                  min={0}
                  max={200}
                  value={filters.saturation}
                  onChange={e => handleFilterChange("saturation", parseInt(e.target.value))}
                  className="w-full accent-white bg-zinc-900 rounded-lg cursor-pointer h-1.5"
                />
              </div>

              {/* Sepia Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-zinc-300">Sepia Warmth</span>
                  <span className="font-mono text-white">{filters.sepia}%</span>
                </div>
                <input
                  id="slider-sepia"
                  type="range"
                  min={0}
                  max={100}
                  value={filters.sepia}
                  onChange={e => handleFilterChange("sepia", parseInt(e.target.value))}
                  className="w-full accent-white bg-zinc-900 rounded-lg cursor-pointer h-1.5"
                />
              </div>

              {/* Grayscale Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-zinc-300">Grayscale Decay</span>
                  <span className="font-mono text-white">{filters.grayscale}%</span>
                </div>
                <input
                  id="slider-grayscale"
                  type="range"
                  min={0}
                  max={100}
                  value={filters.grayscale}
                  onChange={e => handleFilterChange("grayscale", parseInt(e.target.value))}
                  className="w-full accent-white bg-zinc-900 rounded-lg cursor-pointer h-1.5"
                />
              </div>

              {/* Blur Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-zinc-300">Blur Glow</span>
                  <span className="font-mono text-white">{filters.blur}px</span>
                </div>
                <input
                  id="slider-blur"
                  type="range"
                  min={0}
                  max={15}
                  value={filters.blur}
                  step={0.5}
                  onChange={e => handleFilterChange("blur", parseFloat(e.target.value))}
                  className="w-full accent-white bg-zinc-900 rounded-lg cursor-pointer h-1.5"
                />
              </div>
            </div>

          </div>

          {/* Sibling Buttons in sidebar footer */}
          <div className="flex items-center gap-3 pt-6 border-t border-zinc-850 h-fit bg-[#0f0f12] w-full z-10">
            <button
              id="cancel-editor-submit"
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider hover:bg-zinc-900 rounded-xl transition border border-transparent text-zinc-400 hover:text-white text-center cursor-pointer"
            >
              Discard Changes
            </button>
            <button
              id="save-editor-submit"
              type="button"
              onClick={handleSaveSubmit}
              disabled={generating}
              className="flex-1 py-2.5 px-4 text-[10px] font-bold uppercase tracking-wider bg-white hover:bg-zinc-200 text-black border border-white rounded-xl shadow-md transition text-center cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Apply Filters</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
