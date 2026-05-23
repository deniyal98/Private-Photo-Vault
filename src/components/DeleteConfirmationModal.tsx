/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Trash2, AlertTriangle, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  type: "photo" | "album";
}

export default function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  type
}: DeleteConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Dark blur overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal box */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-md overflow-hidden rounded-3xl bg-[#0f0f12] border border-zinc-800 shadow-2xl z-10 flex flex-col p-6"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors p-1.5 hover:bg-zinc-900 rounded-full cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon Header block */}
          <div className="flex flex-col items-center text-center space-y-4 pt-4 pb-2">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800/80 flex items-center justify-center text-red-400 shadow-inner">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold tracking-widest font-mono uppercase text-white">
                Confirm Deletion
              </h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                Direct Database Operation
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="bg-zinc-950/60 rounded-2xl p-4 border border-zinc-900 text-center my-4">
            <p className="text-xs text-zinc-400 font-sans leading-relaxed">
              Are you sure you want to permanently delete the {type}{" "}
              <span className="font-semibold text-white font-mono break-all px-1">
                "{title}"
              </span>{" "}
              directly from the secure database?
            </p>
            <p className="text-[10px] text-zinc-500 mt-2 font-mono uppercase tracking-wider font-bold">
              ⚠️ This action is irreversible & cannot be undone.
            </p>
          </div>

          {/* Footer controls */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={onClose}
              className="py-2.5 px-4 text-[10px] font-bold font-mono uppercase tracking-wider text-zinc-400 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition cursor-pointer"
            >
              No, Keep It
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="py-2.5 px-4 text-[10px] font-bold font-mono uppercase tracking-wider text-black bg-white hover:bg-zinc-200 border border-white rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Yes, Delete</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
