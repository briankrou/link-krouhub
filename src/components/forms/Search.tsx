"use client";

import React, { useState, useEffect } from "react";
import { Search, X } from "lucide-react";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md flex items-start justify-center pt-20 px-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-4 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <Search className="text-cyan-400 w-5 h-5" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en KrouHub..."
            className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none text-sm font-medium"
            autoFocus
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-6 text-center text-xs text-slate-400">
          {query ? (
            <p>Buscando "{query}" en las herramientas de KrouHub...</p>
          ) : (
            <p>Escribe tu búsqueda o presiona <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300 font-mono">ESC</kbd> para salir.</p>
          )}
        </div>
      </div>
    </div>
  );
}
