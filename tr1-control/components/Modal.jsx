'use client'
import { X } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-carbon p-6 shadow-2xl relative">
        
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <h3 className="font-display text-lg font-bold text-neon">{title}</h3>
          <button 
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Contenido dinámico */}
        <div className="py-4">
          {children}
        </div>

      </div>
    </div>
  )
}