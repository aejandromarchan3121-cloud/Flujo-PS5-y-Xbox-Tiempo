'use client'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { Radio, Clock, Wallet, Server, ShieldAlert, Settings, ShoppingCart, BarChart3 } from 'lucide-react'
import { sb } from '../lib/supabase'
import { useNow } from '../lib/tiempo'
import ConsoleCard from '../components/ConsoleCard'
import MusicPlayer from './MusicPlayer'
import Modal from '../components/Modal'
import ProductSalesModule from './components/ProductSalesModule'
import FinancialSummary from './components/FinancialSummary'
import React, { useEffect, useState } from 'react';

export default function ServerLogsViewer() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    // Verificar si estamos dentro del ejecutable de Electron
    if (window.require) {
      const { ipcRenderer } = window.require('electron');

      const handleLog = (event, message) => {
        setLogs(prevLogs => [...prevLogs.slice(-49), `[LOG]: ${message}`]); // Guarda los últimos 50 logs
      };

      const handleError = (event, message) => {
        setLogs(prevLogs => [...prevLogs.slice(-49), `[ERROR]: ${message}`]);
      };

      ipcRenderer.on('server-log', handleLog);
      ipcRenderer.on('server-log-error', handleError);

      return () => {
        ipcRenderer.removeListener('server-log', handleLog);
        ipcRenderer.removeListener('server-log-error', handleError);
      };
    }
  }, []);

  return (
    <div className="bg-black/90 border border-zinc-800 rounded-xl p-4 font-mono text-xs text-green-400 h-64 overflow-y-auto">
      <p className="text-zinc-500 font-bold mb-2">// LOGS EN TIEMPO REAL (SERVER INDEX.JS)</p>
      {logs.length === 0 ? (
        <p className="text-zinc-600">Esperando salida del servidor...</p>
      ) : (
        logs.map((log, index) => (
          <div key={index} className="whitespace-pre-wrap py-0.5">{log}</div>
        ))
      )}
    </div>
  );
}

const upd = (id, patch) => sb.from('consolas').update(patch).eq('id', id)

export default function AdminDashboard() {
  const now = useNow(1000)
  const [consolas, setConsolas] = useState([])
  const [rt, setRt] = useState(false)
  const [online, setOnline] = useState(true)
  const [latido, setLatido] = useState(null)
  const [total, setTotal] = useState(0)
  const [errorMsg, setErrorMsg] = useState(null)

  // Estados para el Modal de Tarifa
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [consolaSeleccionada, setConsolaSeleccionada] = useState(null)
  const [nuevaTarifa, setNuevaTarifa] = useState('')

  // Estados para los nuevos Modales (Productos y Finanzas)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [isFinanceModalOpen, setIsFinanceModalOpen] = useState(false)
  const [salesHistory, setSalesHistory] = useState([])
  const [products, setProducts] = useState([
    { id: '1', name: 'Agua 600ml', price: 2500, stock: 20 },
    { id: '2', name: 'Refresco / Soda', price: 4000, stock: 15 },
    { id: '3', name: 'Snack / Doritos', price: 5000, stock: 10 },
    { id: '4', name: 'Energizante', price: 7000, stock: 8 }
  ])

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

  // Funciones del Modal de Tarifa
  const abrirModalTarifa = (c) => {
    setConsolaSeleccionada(c)
    setNuevaTarifa(c.tarifa_hora || 0)
    setIsModalOpen(true)
  }

  const guardarTarifa = async () => {
    if (!consolaSeleccionada) return
    await handleAction('guardarTarifa', async () => {
      const { error } = await sb
        .from('consolas')
        .update({ tarifa_hora: Number(nuevaTarifa) })
        .eq('id', consolaSeleccionada.id)
      
      if (error) throw error

      setConsolas(cs => cs.map(item => item.id === consolaSeleccionada.id ? { ...item, tarifa_hora: Number(nuevaTarifa) } : item))
      setIsModalOpen(false)
    })
  }

  // Registrar venta de producto y sumar al total diario
  const handleRegisterSale = async (newSale) => {
    setSalesHistory([newSale, ...salesHistory])
    // Opcional: si creas una tabla 'historial_ventas' en Supabase, puedes hacer el insert aquí.
    setTotal(prev => prev + newSale.total)
  }

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
    <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-zinc-100 selection:bg-neon selection:text-black pb-12">
      
      {/* Alerta flotante de errores */}
      {errorMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-red-500/50 bg-red-950/90 px-4 py-3 text-sm font-medium text-red-200 shadow-2xl backdrop-blur-md animate-bounce">
          <ShieldAlert size={18} className="text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Header Moderno y Glassmorphism */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-carbon/80 backdrop-blur-xl shadow-xl">
        <div className="mx-auto flex max-w-[1700px] flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
          
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-2xl font-black tracking-tight text-neon drop-shadow-[0_0_15px_rgba(255,230,0,0.3)] sm:text-3xl">
              TR1 <span className="text-zinc-500">//</span> CONTROL DE SALA
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <Pill ok={online && rt}><Radio size={12} /> RED {online && rt ? 'ONLINE' : 'CAÍDA'}</Pill>
              <Pill ok={nodoOk}><Server size={12} /> NODO LOCAL {nodoOk ? 'ONLINE' : 'OFFLINE'}</Pill>
            </div>
          </div>

          <div className="flex-1 max-w-md w-full md:mx-4">
            <MusicPlayer />
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto flex-wrap">
            {/* Botones de Acceso Rápido a Productos y Finanzas */}
            <button
              onClick={() => setIsProductModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-900/50 transition-colors shadow-sm"
              title="Vender Productos"
            >
              <ShoppingCart size={15} className="text-emerald-400" />
              <span>Ventas</span>
            </button>

            <button
              onClick={() => setIsFinanceModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-950/40 px-3 py-2 text-xs font-bold text-blue-300 hover:bg-blue-900/50 transition-colors shadow-sm"
              title="Ver Resumen de Ingresos"
            >
              <BarChart3 size={15} className="text-blue-400" />
              <span>Caja</span>
            </button>

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
              <div key={c.id} className="relative group transition-transform duration-200 hover:-translate-y-1">
                {/* Botón flotante rápido para configurar tarifa en cada tarjeta */}
                <button
                  onClick={() => abrirModalTarifa(c)}
                  className="absolute top-3 right-3 z-20 rounded-lg bg-zinc-900/80 border border-zinc-700/60 p-1.5 text-zinc-400 hover:text-neon hover:border-neon transition-colors shadow-md backdrop-blur-sm"
                  title="Editar Tarifa de Hora"
                >
                  <Settings size={14} />
                </button>

                <ConsoleCard c={c} now={now} onAdd={onAdd} onOpen={onOpen} onFinish={onFinish} onRelease={onRelease} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal Independiente para Editar Tarifas */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={`Configurar Tarifa — ${consolaSeleccionada?.nombre || ''}`}
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-zinc-400">
            Modifica la tarifa por hora asignada a esta consola. El cálculo de cobro se actualizará de inmediato.
          </p>
          <div>
            <label className="text-xs font-semibold text-zinc-300 mb-1.5 block">Tarifa por Hora</label>
            <input 
              type="number"
              value={nuevaTarifa}
              onChange={(e) => setNuevaTarifa(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-white font-display text-lg focus:border-neon focus:outline-none transition-colors"
              placeholder="Ej: 6000 o 12000"
            />
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="rounded-xl px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={guardarTarifa}
              className="rounded-xl bg-neon px-5 py-2 text-sm font-bold text-black hover:bg-neon/90 shadow-[0_0_15px_rgba(255,230,0,0.3)] transition-all"
            >
              Guardar Tarifa
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de Venta de Productos */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title="Tienda y Venta de Productos"
      >
        <ProductSalesModule products={products} onRegisterSale={handleRegisterSale} />
      </Modal>

      {/* Modal de Finanzas e Ingresos */}
      <Modal
        isOpen={isFinanceModalOpen}
        onClose={() => setIsFinanceModalOpen(false)}
        title="Resumen Financiero y Caja"
      >
        <div className="flex flex-col gap-4">
          <FinancialSummary salesHistory={salesHistory} />
          
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mt-2">Últimos Movimientos de Hoy</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {salesHistory.length === 0 ? (
              <p className="text-xs text-zinc-500 py-3 text-center">No hay ventas o cobros registrados en esta sesión.</p>
            ) : (
              salesHistory.map((sale) => (
                <div key={sale.id} className="flex justify-between items-center bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-xs">
                  <div>
                    <p className="font-semibold text-zinc-200">{sale.itemName}</p>
                    <p className="text-[10px] text-zinc-400">{new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Cant: {sale.quantity})</p>
                  </div>
                  <span className="text-emerald-400 font-bold font-display text-sm">+${sale.total.toFixed(2)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

    </main>
  )
}