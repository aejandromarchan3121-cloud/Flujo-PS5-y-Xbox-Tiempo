'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Gamepad2, TriangleAlert } from 'lucide-react'
import { sb } from '../lib/supabase'
import { useNow, derive, fmt } from '../lib/tiempo  '

export default function ClientScreen() {
  const { id } = useParams()
  const now = useNow(1000)
  const [c, setC] = useState(null)

  useEffect(() => {
    const load = () => sb.from('consolas').select('*').eq('id', id).single().then(({ data }) => setC(data))
    load()
    const ch = sb.channel(`pantalla-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'consolas', filter: `id=eq.${id}` },
        ({ new: n }) => setC(n))
      .subscribe()
    const poll = setInterval(load, 15000) // red de seguridad si el WebSocket se cae
    return () => { sb.removeChannel(ch); clearInterval(poll) }
  }, [id])

  if (!c) return <div className="grid min-h-screen place-items-center font-display text-neon">CONECTANDO…</div>
  const d = derive(c, now)

  /* ---------- BLOQUEADO ---------- */
  if (d.k === 'agotado') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black">
        <div className="hazard h-10 animate-stripes" />
        <div className="relative m-4 flex flex-1 flex-col items-center justify-center border-4 border-neon px-6 text-center shadow-[inset_0_0_80px_-20px_#FFE600,0_0_60px_-10px_#FFE600] sm:m-8">
          <span className="absolute left-0 top-0 h-10 w-10 border-b-4 border-r-4 border-neon bg-carbon" />
          <span className="absolute bottom-0 right-0 h-10 w-10 border-l-4 border-t-4 border-neon bg-carbon" />
          <TriangleAlert className="mb-4 h-16 w-16 animate-blinkred text-red-500 sm:h-24 sm:w-24" />
          <h1 className="font-display text-5xl font-black leading-none text-neon drop-shadow-[0_0_25px_#FFE600] sm:text-7xl lg:text-9xl">
            TIEMPO AGOTADO
          </h1>
          <p className="my-4 font-display text-xl font-bold tracking-[0.3em] text-zinc-500 sm:text-3xl">//</p>
          <h2 className="font-display text-2xl font-black text-white sm:text-5xl lg:text-6xl">
            FAVOR PASAR A <span className="text-red-500 animate-blinkred">CAJA DE COBRO</span>
          </h2>
          <p className="mt-8 border-2 border-neon bg-industrial px-6 py-2 font-display text-lg font-bold text-neon sm:text-3xl">
            {c.nombre}
          </p>
        </div>
        <div className="hazard h-10 animate-stripes [animation-direction:reverse]" />
      </div>
    )
  }

  /* ---------- NORMAL ---------- */
  const uso = d.k === 'uso'
  return (
    <main className="min-h-screen bg-carbon">
      <div className="cut fixed right-4 top-4 border border-neon/60 bg-industrial/80 px-4 py-2 shadow-[0_0_20px_-8px_#FFE600]">
        <p className="flex items-center gap-1 font-display text-[10px] text-zinc-400">
          <Gamepad2 size={12} /> {c.nombre} // {uso ? 'ACTIVO' : 'LIBRE'}
        </p>
        <p className="font-display text-3xl font-black tabular-nums text-neon">{uso ? fmt(d.secs) : '--:--:--'}</p>
      </div>
    </main>
  )
}