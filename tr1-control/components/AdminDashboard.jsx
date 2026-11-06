'use client'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { Radio, Clock, Wallet, Server, ShieldAlert } from 'lucide-react'
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
  const [errorMsg, setErrorMsg] = useState(null)

  const cargarTotal = useCallback(async () => {
    try {
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
      const { data } = await sb.from('historial_cajas').select('monto_cobrado').gte('cerrado_at', hoy.toISOString())
      setTotal((data ?? []).reduce((a, r) => a + Number(r.monto_cobrado), 0))
    } catch (err) {
      console.error("Error cargando total:", err)
    }
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

    return () => { 
      sb.removeChannel(ch); 
      clearInterval(hb); 
      window.removeEventListener('online', on); 
      window.removeEventListener('offline', on) 
    }
  }, [cargarTotal])

  /* ---------- ACCIONES ROBUSTAS ---------- */
  const handleAction = async (actionName, callback) => {
    try {
      setErrorMsg(null)
      await callback()
    } catch (error) {
      console.error(`Error en ${actionName}:`, error)
      setErrorMsg(`Fallo en la operación (${actionName}). Intenta de nuevo.`)
      setTimeout(() => setErrorMsg(null), 4000)
    }
  }

  const onAdd = (c, m) => handleAction('onAdd', async () => {
    if (c.tiempo_abierto) return
    const extra = +(m / 60 * c.tarifa_hora).toFixed(2)
    if (c.estado === 'disponible') {
      await upd(c.id, { estado: 'ocupada', tiempo_inicio: new Date().toISOString(), minutos_totales: m, monto_total: extra, tiempo_abierto: false })
      return
    }
    const elapsed = (Date.now() - new Date(c.tiempo_inicio).getTime()) / 60000
    const vencida = c.estado === 'finalizado' || elapsed >= c.minutos_totales
    const base = vencida ? Math.ceil(elapsed) : c.minutos_totales
    await upd(c.id, { estado: 'ocupada', minutos_totales: base + m, monto_total: +(Number(c.monto_total) + extra).toFixed(2) })
  })

  const onOpen = (c) => handleAction('onOpen', async () => {
    await upd(c.id, { estado: 'ocupada', tiempo_inicio: new Date().toISOString(), minutos_totales: 0, monto_total: 0, tiempo_abierto: true })
  })

  const onFinish = (c) => handleAction('onFinish', async () => {
    if (c.tiempo_abierto) {
      const mins = Math.max(1, Math.ceil((Date.now() - new Date(c.tiempo_inicio).getTime()) / 60000))
      await upd(c.id, { estado: 'finalizado', tiempo_abierto: false, minutos_totales: mins, monto_total: +(mins / 60 * c.tarifa_hora).toFixed(2) })
      return
    }
    await upd(c.id, { estado: 'finalizado' })
  })

  const onRelease = (c) => handleAction('onRelease', async () => {
    const { error: errHist } = await sb.from('historial_cajas').insert({
      consola_id: c.id, consola_nombre: c.nombre, tiempo_inicio: c.tiempo_inicio,
      minutos_usados: c.minutos_totales, monto_cobrado: c.monto_total,
    })
    if (errHist) throw errHist

    await upd(c.id, { estado: 'disponible', tiempo_inicio: null, minutos_totales: 0, monto_total: 0, tiempo_abierto: false })
    cargarTotal()
  })

  const nodoOk = latido && now - latido < 15000
  const reloj = useMemo(() => new Date(now), [now])

  const Pill = ({ ok, children }) => (
    <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-display text-[10px] font-bold tracking-wider transition-all duration-300 ${
      ok ? 'border-cyan-400/40 bg-cyan-950/30 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.15)]' : 'border-red-500/40 bg-red-950/30 text-red-400 animate-pulse'
    }`}>
      <span className={`h-2 w-2 rounded-full ${ok ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`} />
      {children}
    </span>
  )

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-zinc-100 selection:bg-neon selection:text-black">
      
      {/* Alerta flotante de errores si ocurren */}
      {errorMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-red-500/50 bg-red-950/90 px-4 py-3 text-sm font-medium text-red-200 shadow-2xl backdrop-blur-md animate-bounce">
          <ShieldAlert size={18} className="text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Header Moderno y Glassmorphism */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-carbon/80 backdrop-blur-xl shadow-xl">
        <div className="mx-auto flex max-w-[1700px] flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
          
          {/* Título y Estado de Red */}
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-2xl font-black tracking-tight text-neon drop-shadow-[0_0_15px_rgba(255,230,0,0.3)] sm:text-3xl">
              TR1 <span className="text-zinc-500">//</span> CONTROL DE SALA
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <Pill ok={online && rt}><Radio size={12} /> RED {online && rt ? 'ONLINE' : 'CAÍDA'}</Pill>
              <Pill ok={nodoOk}><Server size={12} /> NODO LOCAL {nodoOk ? 'ONLINE' : 'OFFLINE'}</Pill>
            </div>
          </div>

          {/* Reproductor de Música central */}
          <div className="flex-1 max-w-md w-full md:mx-4">
            <MusicPlayer />
          </div>

          {/* Panel de Caja y Reloj */}
          <div className="flex items-center gap-3 self-end md:self-auto">
            <div className="rounded-xl border border-neon/30 bg-industrial/60 px-4 py-2 text-right backdrop-blur-sm shadow-inner">
              <p className="flex items-center justify-end gap-1.5 text-[10px] font-semibold tracking-wider text-zinc-400">
                <Wallet size={12} className="text-neon" /> COBRADO HOY
              </p>
              <p className="font-display text-2xl font-black tracking-tight text-neon tabular-nums">
                ${total.toFixed(2)}
              </p>
            </div>
            
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-right">
              <p className="flex items-center justify-end gap-1.5 font-display text-xl font-bold tracking-wide text-white tabular-nums sm:text-2xl">
                <Clock size={18} className="text-neon animate-pulse" /> 
                {reloj.toLocaleTimeString('es-VE', { hour12: false })}
              </p>
              <p className="text-[11px] font-medium text-zinc-400 capitalize">
                {reloj.toLocaleDateString('es-VE', { weekday: 'short', day: '2-digit', month: 'short' })}
              </p>
            </div>
          </div>

        </div>
      </header>

      {/* Grid de Consolas Responsivo */}
      <section className="mx-auto max-w-[1700px] p-4 sm:p-6">
        {consolas.length === 0 ? (
          <div className="flex h-[50vh] flex-col items-center justify-center gap-3 text-zinc-500">
            <Server size={48} className="animate-pulse text-zinc-700" />
            <p className="font-display text-sm uppercase tracking-widest">Sincronizando consolas...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {consolas.map((c) => (
              <div key={c.id} className="transition-transform duration-200 hover:-translate-y-1">
                <ConsoleCard c={c} now={now} onAdd={onAdd} onOpen={onOpen} onFinish={onFinish} onRelease={onRelease} />
              </div>
            ))}
          </div>
        )}
      </section>

    </main>
  )
}