'use client'
import React, { useEffect, useState } from 'react'
import { Terminal, ShieldCheck, Cpu } from 'lucide-react'

export default function SplashScreen({ onFinish }) {
  const [text, setText] = useState('INICIALIZANDO NODO CENTRAL...')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const steps = [
      { p: 25, t: 'CONECTANDO CON BASE DE DATOS...' },
      { p: 55, t: 'VERIFICANDO TVS Y RED LOCAL...' },
      { p: 85, t: 'CARGANDO MÓDULOS DE CONTROL...' },
      { p: 100, t: 'SISTEMA TR1 LISTO' },
    ]

    let current = 0
    const interval = setInterval(() => {
      if (current < steps.length) {
        setProgress(steps[current].p)
        setText(steps[current].t)
        current++
      } else {
        clearInterval(interval)
        setTimeout(() => onFinish(), 600)
      }
    }, 600)

    return () => clearInterval(interval)
  }, [onFinish])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0B0C10] text-white font-mono select-none">
      {/* GLOW DE FONDO */}
      <div className="absolute w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center max-w-sm w-full px-6">
        <div className="flex items-center gap-3 mb-6">
          <Cpu className="text-cyan-400 animate-pulse" size={40} />
          <h1 className="text-3xl font-black font-display tracking-widest text-white">
            TR1 <span className="text-cyan-400">//</span> OS
          </h1>
        </div>

        {/* BARRA DE PROGRESO INDUSTRIAL */}
        <div className="w-full bg-zinc-900 border border-zinc-800 h-3 rounded-none overflow-hidden p-0.5 mb-4 shadow-[0_0_15px_-3px_#06b6d4]">
          <div
            className="bg-cyan-400 h-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* LOGS DE CONSOLA */}
        <div className="flex items-center gap-2 text-xs text-cyan-300/80 uppercase tracking-wider">
          <Terminal size={14} className="animate-bounce" />
          <span>{text}</span>
        </div>
      </div>
    </div>
  )
}