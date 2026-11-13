'use client'
import { useState, useEffect, useRef } from 'react'
import { Gamepad2, Wifi, Infinity as Open, Square, BadgeDollarSign, Timer } from 'lucide-react'
import { derive, fmt } from '../lib/tiempo'
import { MONEDAS, copToBs, fmtBS, fmtCOP, fmtMonto, fmtTasa, getMinutesUsed } from '../lib/currency'

const ESTILO = {
  libre:   { box: 'border-cyan-400/70 shadow-[0_0_24px_-8px_#22d3ee]', txt: 'text-cyan-300', tag: 'DISPONIBLE' },
  uso:     { box: 'border-blue-500/80 shadow-[0_0_26px_-8px_#2563eb]', txt: 'text-blue-400', tag: 'EN USO' },
  agotado: { box: 'border-red-500 shadow-[0_0_34px_-4px_#ef4444] animate-blinkred', txt: 'text-red-500', tag: 'PASE POR CAJA' },
}

function Btn({ children, onClick, tone = 'metal', disabled, className = '', ...rest }) {
  const tones = {
    metal: 'border-zinc-500 bg-gradient-to-b from-zinc-600 to-zinc-800 text-zinc-100 hover:border-neon hover:text-neon',
    neon: 'border-neon bg-neon text-carbon hover:bg-gold',
    red: 'border-red-500 bg-red-600/90 text-white hover:bg-red-500',
    cyan: 'border-cyan-400 bg-cyan-400 text-carbon hover:bg-cyan-300',
    amber: 'border-amber-400 bg-amber-400 text-carbon hover:bg-amber-300',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...rest}
      className={`cut flex min-h-[44px] items-center justify-center gap-1 border px-2 py-2 font-display text-[11px] font-bold transition-all duration-200 ease-in-out active:translate-y-px active:brightness-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-30 ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  )
}

export default function ConsoleCard({ c, now, tasaBs, onAdd, onOpen, onFinish, onRelease }) {
  const d = derive(c, now)
  const s = ESTILO[d.k]
  const libre = d.k === 'libre'
  const porCobrar = d.k === 'agotado' && c.estado === 'finalizado'

  const [moneda, setMoneda] = useState('COP')
  const [confirming, setConfirming] = useState(false)
  const [releasing, setReleasing] = useState(false)
  const confirmTimer = useRef(null)

  useEffect(() => () => clearTimeout(confirmTimer.current), [])

  // ---------- Cobro (lo que se ve es lo que se registra) ----------
  // COP: monto de la sesión. BS: COP ÷ tasa, solo la parte entera (12.000 ÷ 2,7 → 4.444 BS)
  const montoCOP = libre ? 0 : Number(Number(d.monto || 0).toFixed(2))
  const montoBS = copToBs(montoCOP, tasaBs)
  const charge = {
    minutos: getMinutesUsed(c, now),
    moneda,
    tasa: tasaBs,
    montoCOP,
    montoBS,
    montoCobrado: moneda === 'BS' ? montoBS : montoCOP,
  }
  const amountLine = libre ? '—' : fmtMonto(charge.montoCobrado, moneda)
  const refLine = libre
    ? 'Sin sesión activa'
    : moneda === 'BS'
      ? `${fmtCOP(montoCOP)} COP ÷ ${fmtTasa(tasaBs)}`
      : `Equivale a ${fmtBS(montoBS)} BS`

  const changeMoneda = (m) => {
    clearTimeout(confirmTimer.current)
    setConfirming(false)
    setMoneda(m)
  }

  // Primer toque pide confirmar (3,5 s); el segundo registra el cobro y libera
  const handleRelease = async () => {
    if (releasing) return
    if (!confirming) {
      setConfirming(true)
      confirmTimer.current = setTimeout(() => setConfirming(false), 3500)
      return
    }
    clearTimeout(confirmTimer.current)
    setConfirming(false)
    setReleasing(true)
    try {
      await onRelease(c, charge)
      setMoneda('COP') // cada cliente empieza en COP y se elige a conciencia
    } finally {
      setReleasing(false)
    }
  }

  const canSub = !libre && !c.tiempo_abierto && Number(c.minutos_totales || 0) >= 15

  return (
    <article className={`cut relative flex h-full min-w-0 flex-col border-2 bg-industrial/70 p-4 ${s.box}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-display text-lg font-black text-white">
            <Gamepad2 size={20} className={`shrink-0 ${s.txt}`} /> <span className="truncate">{c.nombre}</span>
          </h3>
          <p className="mt-1 flex items-center gap-1 text-xs text-zinc-400"><Wifi size={12} /> TV {c.ip_tv}</p>
        </div>
        <span className={`shrink-0 border px-2 py-0.5 font-display text-[10px] font-bold ${s.txt} border-current`}>{s.tag}</span>
      </div>

      {/* Reloj (alto reservado: la línea "tiempo abierto" siempre ocupa su sitio) */}
      <div className={`my-3 text-center font-display text-4xl font-black tabular-nums sm:text-5xl ${s.txt}`}>
        {libre ? '--:--:--' : fmt(d.secs)}
        <p className={`mt-1 text-[10px] font-bold text-blue-300 ${d.up ? '' : 'invisible'}`}>TIEMPO ABIERTO // CONTANDO</p>
      </div>

      <p className={`mb-3 text-center text-sm text-zinc-300 ${libre ? 'invisible' : ''}`}>
        <Timer size={13} className="mr-1 inline" /> {c.tiempo_abierto ? 'ABIERTO' : `${c.minutos_totales} MIN`}
      </p>

      {/* Selector de moneda */}
      <div className="mb-2">
        <p id={`moneda-${c.id}`} className="mb-1 font-display text-[10px] font-bold text-zinc-400">EL CLIENTE PAGA EN</p>
        <div role="radiogroup" aria-labelledby={`moneda-${c.id}`} className="grid grid-cols-2 gap-2">
          {MONEDAS.map((m) => (
            <Btn
              key={m}
              role="radio"
              aria-checked={moneda === m}
              tone={moneda === m ? 'neon' : 'metal'}
              disabled={libre}
              onClick={() => changeMoneda(m)}
            >
              {m === 'COP' ? 'COP · PESOS' : 'BS · BOLÍVARES'}
            </Btn>
          ))}
        </div>
      </div>

      {/* Monto a cobrar (alto fijo) */}
      <div className="cut mb-3 flex h-[84px] flex-col justify-center border border-zinc-700 bg-black/30 px-3">
        <p className="font-display text-[10px] font-bold text-zinc-400">A COBRAR</p>
        <p className={`truncate font-display text-2xl font-black tabular-nums ${libre ? 'text-zinc-600' : 'text-neon'}`}>{amountLine}</p>
        <p className="truncate text-[11px] tabular-nums text-zinc-500">{refLine}</p>
      </div>

      {/* Acciones: misma altura reservada en todos los estados para que nada se mueva */}
      <div className="mt-auto h-[96px]">
        {porCobrar ? (
          <Btn
            tone={confirming ? 'amber' : 'cyan'}
            onClick={handleRelease}
            disabled={releasing}
            className="h-full w-full flex-col gap-0.5"
          >
            <span className="flex items-center gap-1 text-xs">
              <BadgeDollarSign size={16} />
              {releasing ? 'REGISTRANDO…' : confirming ? 'TOCA DE NUEVO PARA CONFIRMAR' : 'COBRADO // LIBERAR'}
            </span>
            {!releasing && <span className="max-w-full truncate text-base font-black tabular-nums">{amountLine}</span>}
          </Btn>
        ) : (
          <div className="grid h-full grid-rows-2 gap-2">
            <div className="grid grid-cols-4 gap-2">
              <Btn onClick={() => onAdd(c, -15)} disabled={!canSub} aria-label="Restar 15 minutos">−15M</Btn>
              <Btn onClick={() => onAdd(c, 15)} disabled={c.tiempo_abierto}>+15M</Btn>
              <Btn onClick={() => onAdd(c, 30)} disabled={c.tiempo_abierto}>+30M</Btn>
              <Btn onClick={() => onAdd(c, 60)} disabled={c.tiempo_abierto}>+1H</Btn>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Btn tone="neon" onClick={() => onOpen(c)} disabled={!libre}><Open size={14} /> ABIERTO</Btn>
              <Btn tone="red" onClick={() => onFinish(c)} disabled={libre}><Square size={13} /> A CAJA</Btn>
            </div>
          </div>
        )}
      </div>
    </article>
  )
}