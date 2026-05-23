/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { FolderLock, Folder, Key, Shield, X, AlertOctagon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CreateAlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, description: string, isEncrypted: boolean, keyphrase?: string) => void;
}

export default function CreateAlbumModal({ isOpen, onClose, onSubmit }: CreateAlbumModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [keyphrase, setKeyphrase] = useState("");
  const [confirmKeyphrase, setConfirmKeyphrase] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Album name is required.");
      return;
    }

    if (isEncrypted) {
      if (!keyphrase) {
        setError("Please set a Master Keyphrase to encrypt this Album.");
        return;
      }
      if (keyphrase.length < 8) {
        setError("Your Master Keyphrase must be at least 8 characters for robust GCM protection.");
        return;
      }
      if (keyphrase !== confirmKeyphrase) {
        setError("Master keyphrase matching failed. Please confirm correct spelling.");
        return;
      }
    }

    onSubmit(name.trim(), description.trim(), isEncrypted, isEncrypted ? keyphrase : undefined);
    
    // Reset state
    setName("");
    setDescription("");
    setIsEncrypted(false);
    setKeyphrase("");
    setConfirmKeyphrase("");
    setError(null);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          id="album-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60"
        />

        {/* Modal Panel */}
        <motion.div
          id="album-modal-container"
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-[#0f0f12] shadow-2xl border border-zinc-850 z-10 flex flex-col"
        >
          {/* Header Banner */}
          <div className="p-6 text-white flex items-center justify-between bg-gradient-to-r from-zinc-900 to-[#141417] border-b border-zinc-850">
            <div className="flex items-center gap-3">
              {isEncrypted ? (
                <FolderLock className="w-6 h-6 text-zinc-300 animate-pulse" />
              ) : (
                <Folder className="w-6 h-6 text-zinc-400" />
              )}
              <div>
                <h3 className="text-sm font-semibold tracking-wider font-mono uppercase">
                  {isEncrypted ? "Create Encrypted Album" : "Create Standard Album"}
                </h3>
                <p className="text-[10px] text-zinc-400 uppercase tracking-widest mt-0.5">
                  {isEncrypted ? "Client GCM Lock Encryption" : "Standard Album folder"}
                </p>
              </div>
            </div>
            <button
              id="close-modal-btn"
              type="button"
              onClick={onClose}
              className="text-zinc-400 hover:text-white transition-colors duration-150 p-1 hover:bg-zinc-800 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[75vh] space-y-5">
            {error && (
              <div className="p-3 bg-red-950/20 border border-red-900/50 text-red-400 rounded-lg flex items-start gap-2.5 text-xs animate-shake">
                <AlertOctagon className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Name Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono block">
                Album Name
              </label>
              <input
                id="album-name-input"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Private Trips, Core Receipts..."
                maxLength={80}
                className="w-full px-4 py-2.5 text-sm bg-zinc-955 text-zinc-100 border border-zinc-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-650 focus:border-zinc-750 transition-all placeholder-zinc-700"
              />
            </div>

            {/* Description Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono block">
                Description (Optional)
              </label>
              <textarea
                id="album-desc-input"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief description notes..."
                rows={2}
                maxLength={400}
                className="w-full px-4 py-2.5 text-sm bg-zinc-955 text-zinc-100 border border-zinc-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-650 focus:border-zinc-750 transition-all resize-none placeholder-zinc-700"
              />
            </div>

            {/* Vault Encryption Toggle */}
            <div className="bg-zinc-900/50 p-4 border border-zinc-850 rounded-2xl flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-xl mt-0.5 border ${isEncrypted ? "bg-zinc-800 border-zinc-700 text-white" : "bg-zinc-950 border-zinc-850 text-zinc-500"}`}>
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider font-mono">Client-Side GCM Encryption</h4>
                  <p className="text-[11px] text-zinc-400 mt-1 max-w-[280px] leading-relaxed">
                    Encrypt album photos on your device before transfer or cloud hosting. Encrypted items cannot be peeked, not even by database admins.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="album-encrypt-toggle"
                  type="checkbox"
                  checked={isEncrypted}
                  onChange={e => setIsEncrypted(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-zinc-950 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-500 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-white peer-checked:after:bg-zinc-950"></div>
              </label>
            </div>

            {/* Password Fields */}
            <AnimatePresence>
              {isEncrypted && (
                <motion.div
                  id="keyphrase-fields"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-4"
                >
                  <div className="p-3 bg-zinc-950 text-zinc-300 border border-zinc-850 rounded-xl text-xs flex items-start gap-2.5 leading-relaxed">
                    <Key className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <span className="font-bold text-white block mb-0.5">Zero-Knowledge Guarantee:</span>
                      Your password is used in-browser only to derive cryptographic keys. If you lose or forget this keyphrase, <span className="font-bold text-red-400">all photos in this album are permanently lost</span>. We cannot recover it!
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono block">
                        Master Passphrase
                      </label>
                      <input
                        id="album-password-field"
                        type="password"
                        value={keyphrase}
                        onChange={e => setKeyphrase(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="w-full px-4 py-2 text-sm bg-zinc-955 text-zinc-100 border border-zinc-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-650 bg-zinc-955/80 placeholder-zinc-700"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono block">
                        Confirm Passphrase
                      </label>
                      <input
                        id="album-confirm-password-field"
                        type="password"
                        value={confirmKeyphrase}
                        onChange={e => setConfirmKeyphrase(e.target.value)}
                        placeholder="Re-type passphrase"
                        className="w-full px-4 py-2 text-sm bg-zinc-955 text-zinc-100 border border-zinc-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-650 bg-zinc-955/80 placeholder-zinc-700"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-850">
              <button
                id="cancel-create-btn"
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-400 hover:bg-zinc-900 transition rounded-xl"
              >
                Cancel
              </button>
              <button
                id="submit-create-btn"
                type="submit"
                className="px-5 py-2 text-xs font-bold uppercase tracking-wider bg-white hover:bg-zinc-200 text-black border border-white rounded-xl transition duration-150"
              >
                Create Album
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
