'use client'
import { Gamepad2, Wifi, Infinity as Open, Square, BadgeDollarSign, Timer } from 'lucide-react'
import { derive, fmt } from '@/lib/tiempo'

const ESTILO = {
  libre:   { box: 'border-cyan-400/70 shadow-[0_0_24px_-8px_#22d3ee]', txt: 'text-cyan-300', tag: 'DISPONIBLE' },
  uso:     { box: 'border-blue-500/80 shadow-[0_0_26px_-8px_#2563eb]', txt: 'text-blue-400', tag: 'EN USO' },
  agotado: { box: 'border-red-500 shadow-[0_0_34px_-4px_#ef4444] animate-blinkred', txt: 'text-red-500', tag: 'PASE POR CAJA' },
}

function Btn({ children, onClick, tone = 'metal', disabled, className = '' }) {
  const tones = {
    metal: 'border-zinc-500 bg-gradient-to-b from-zinc-600 to-zinc-800 text-zinc-100 hover:border-neon hover:text-neon',
    neon: 'border-neon bg-neon text-carbon hover:bg-gold',
    red: 'border-red-500 bg-red-600/90 text-white hover:bg-red-500',
    cyan: 'border-cyan-400 bg-cyan-400 text-carbon hover:bg-cyan-300',
  }
  return (
    <button onClick={onClick} disabled={disabled}
      className={`cut flex items-center justify-center gap-1 border px-2 py-2 font-display text-[11px] font-bold transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-30 ${tones[tone]} ${className}`}>
      {children}
    </button>
  )
}

export default function ConsoleCard({ c, now, onAdd, onOpen, onFinish, onRelease }) {
  const d = derive(c, now)
  const s = ESTILO[d.k]
  const libre = d.k === 'libre'
  return (
    <article className={`cut relative border-2 bg-industrial/70 p-4 ${s.box}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg font-black text-white">
            <Gamepad2 size={20} className={s.txt} /> {c.nombre}
          </h3>
          <p className="mt-1 flex items-center gap-1 text-xs text-zinc-400"><Wifi size={12} /> TV {c.ip_tv}</p>
        </div>
        <span className={`border px-2 py-0.5 font-display text-[10px] font-bold ${s.txt} border-current`}>{s.tag}</span>
      </div>

      <div className={`my-4 text-center font-display text-4xl font-black tabular-nums sm:text-5xl ${s.txt}`}>
        {libre ? '--:--:--' : fmt(d.secs)}
        {d.up && <p className="mt-1 text-[10px] font-bold text-blue-300">TIEMPO ABIERTO // CONTANDO</p>}
      </div>

      {!libre && (
        <p className="mb-3 text-center text-sm text-zinc-300">
          <Timer size={13} className="mr-1 inline" /> {c.tiempo_abierto ? 'ABIERTO' : `${c.minutos_totales} MIN`} //{' '}
          <span className="font-bold text-neon">${Number(c.monto_total).toFixed(2)}</span>
        </p>
      )}

      {d.k === 'agotado' && c.estado === 'finalizado' ? (
        <Btn tone="cyan" onClick={() => onRelease(c)} className="w-full py-3"><BadgeDollarSign size={16} /> COBRADO // LIBERAR</Btn>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Btn onClick={() => onAdd(c, 15)} disabled={c.tiempo_abierto}>+15M</Btn>
            <Btn onClick={() => onAdd(c, 30)} disabled={c.tiempo_abierto}>+30M</Btn>
            <Btn onClick={() => onAdd(c, 60)} disabled={c.tiempo_abierto}>+1H</Btn>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Btn tone="neon" onClick={() => onOpen(c)} disabled={!libre}><Open size={14} /> ABIERTO</Btn>
            <Btn tone="red" onClick={() => onFinish(c)} disabled={libre}><Square size={13} /> A CAJA</Btn>
          </div>
        </>
      )}
    </article>
  )
}