'use client'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { Radio, Clock, Wallet, Server } from 'lucide-react'
import { sb } from '../lib/supabase'
import { useNow } from '../lib/tiempo'
import ConsoleCard from '../components/ConsoleCard'
import MusicPlayer from './MusicPlayer'

const upd = (id, patch) => sb.from('consolas').update(patch).eq('id', id)

export default function AdminDashboard() {
  const now = useNow(1000)
  const [consolas, setConsolas] = useState([])
  const [rt, setRt] = useState(false)
  const [online, setOnline] = useState(true)
  const [latido, setLatido] = useState(null)
  const [total, setTotal] = useState(0)

  const cargarTotal = useCallback(async () => {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const { data } = await sb.from('historial_cajas').select('monto_cobrado').gte('cerrado_at', hoy.toISOString())
    setTotal((data ?? []).reduce((a, r) => a + Number(r.monto_cobrado), 0))
  }, [])

  useEffect(() => {
    sb.from('consolas').select('*').order('id').then(({ data }) => setConsolas(data ?? []))
    cargarTotal()
    const ch = sb.channel('admin-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consolas' }, ({ new: n }) =>
        setConsolas((cs) => cs.map((c) => (c.id === n.id ? n : c))))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'historial_cajas' }, cargarTotal)
      .subscribe((s) => setRt(s === 'SUBSCRIBED'))
    const hb = setInterval(async () => {
      const { data } = await sb.from('sistema').select('valor').eq('clave', 'servidor_local').maybeSingle()
      setLatido(data ? new Date(data.valor).getTime() : null)
    }, 5000)
    const on = () => setOnline(navigator.onLine)
    window.addEventListener('online', on); window.addEventListener('offline', on)
    setOnline(navigator.onLine)
    return () => { sb.removeChannel(ch); clearInterval(hb); window.removeEventListener('online', on); window.removeEventListener('offline', on) }
  }, [cargarTotal])

  /* ---------- ACCIONES ---------- */
  const onAdd = (c, m) => {
    if (c.tiempo_abierto) return
    const extra = +(m / 60 * c.tarifa_hora).toFixed(2)
    if (c.estado === 'disponible')
      return upd(c.id, { estado: 'ocupada', tiempo_inicio: new Date().toISOString(), minutos_totales: m, monto_total: extra, tiempo_abierto: false })
    const elapsed = (Date.now() - new Date(c.tiempo_inicio).getTime()) / 60000
    const vencida = c.estado === 'finalizado' || elapsed >= c.minutos_totales
    const base = vencida ? Math.ceil(elapsed) : c.minutos_totales
    return upd(c.id, { estado: 'ocupada', minutos_totales: base + m, monto_total: +(Number(c.monto_total) + extra).toFixed(2) })
  }
  const onOpen = (c) =>
    upd(c.id, { estado: 'ocupada', tiempo_inicio: new Date().toISOString(), minutos_totales: 0, monto_total: 0, tiempo_abierto: true })
  const onFinish = (c) => {
    if (c.tiempo_abierto) {
      const mins = Math.max(1, Math.ceil((Date.now() - new Date(c.tiempo_inicio).getTime()) / 60000))
      return upd(c.id, { estado: 'finalizado', tiempo_abierto: false, minutos_totales: mins, monto_total: +(mins / 60 * c.tarifa_hora).toFixed(2) })
    }
    return upd(c.id, { estado: 'finalizado' })
  }
  const onRelease = async (c) => {
    await sb.from('historial_cajas').insert({
      consola_id: c.id, consola_nombre: c.nombre, tiempo_inicio: c.tiempo_inicio,
      minutos_usados: c.minutos_totales, monto_cobrado: c.monto_total,
    })
    await upd(c.id, { estado: 'disponible', tiempo_inicio: null, minutos_totales: 0, monto_total: 0, tiempo_abierto: false })
  }

  const nodoOk = latido && now - latido < 15000
  const reloj = useMemo(() => new Date(now), [now])
  const Pill = ({ ok, children }) => (
    <span className={`flex items-center gap-1 border px-2 py-1 font-display text-[10px] font-bold ${ok ? 'border-cyan-400 text-cyan-300' : 'border-red-500 text-red-400 animate-blinkred'}`}>
      <span className={`h-2 w-2 rounded-full ${ok ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-red-500'}`} /> {children}
    </span>
  )

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-40 border-b-2 border-neon bg-carbon/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="font-display text-xl font-black text-neon drop-shadow-[0_0_10px_#FFE60099] sm:text-3xl">TR1 // CONTROL DE SALA</h1>
            <div className="mt-1 flex flex-wrap gap-2">
              <Pill ok={online && rt}><Radio size={11} /> RED {online && rt ? 'ONLINE' : 'CAÍDA'}</Pill>
              <Pill ok={nodoOk}><Server size={11} /> NODO LOCAL {nodoOk ? 'ONLINE' : 'OFFLINE'}</Pill>
            </div>
          </div>
          <MusicPlayer />
          <div className="flex items-center gap-4">
            <div className="cut border border-neon/50 bg-industrial px-3 py-1 text-right">
              <p className="flex items-center justify-end gap-1 text-[10px] text-zinc-400"><Wallet size={11} /> COBRADO HOY</p>
              <p className="font-display text-xl font-black text-neon tabular-nums">${total.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="flex items-center justify-end gap-1 font-display text-2xl font-black tabular-nums text-white">
                <Clock size={18} className="text-neon" /> {reloj.toLocaleTimeString('es-VE', { hour12: false })}
              </p>
              <p className="text-[10px] text-zinc-400">{reloj.toLocaleDateString('es-VE', { weekday: 'short', day: '2-digit', month: 'short' })}</p>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
        {consolas.map((c) => (
          <ConsoleCard key={c.id} c={c} now={now} onAdd={onAdd} onOpen={onOpen} onFinish={onFinish} onRelease={onRelease} />
        ))}
      </section>
    </main>
  )
}