'use client'
import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import ConsoleCard from '../../components/ConsoleCard'
import FinancialSummary from '../../components/FinancialSummary'
import ProductosSalesModule from '../../components/ProductosSalesModule'
import Modal from '../../components/Modal'
import {
  DEFAULT_TASA_BS,
  calcCharge,
  copToBs,
  fmtBS,
  fmtCOP,
  fmtMonto,
  fmtTasa,
  getMinutesUsed,
  parseTasa,
} from '../../lib/currency'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TASA_STORAGE_KEY = 'tr1_tasa_bs'

// ---------- Utilidades ----------
const fmtMoney = (val) =>
  Number(val || 0).toLocaleString('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

// Fecha local (YYYY-MM-DD). Evita que una venta de las 9 pm en Venezuela
// caiga en el día siguiente por usar UTC (toISOString).
const toLocalDay = (value) => {
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const fmtDayLabel = (isoDay) =>
  new Date(`${isoDay}T00:00:00`).toLocaleDateString('es-VE', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

const fmtDateTime = (value) => {
  const d = new Date(value)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-VE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------- Iconos ----------
const iconProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

const GamepadIcon = () => (
  <svg {...iconProps}>
    <path d="M6 11h4M8 9v4" />
    <path d="M15 12h.01M18 10h.01" />
    <path d="M17.3 5H6.7a4 4 0 0 0-3.9 3.2l-1.1 6A3 3 0 0 0 4.6 18c.8 0 1.5-.4 2-1l1.6-2h7.6l1.6 2c.5.6 1.2 1 2 1a3 3 0 0 0 2.9-3.8l-1.1-6A4 4 0 0 0 17.3 5Z" />
  </svg>
)

const BagIcon = () => (
  <svg {...iconProps}>
    <path d="M6 7h12l1 13H5L6 7Z" />
    <path d="M9 7V6a3 3 0 0 1 6 0v1" />
  </svg>
)

const ChartIcon = () => (
  <svg {...iconProps}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
)

const SwapIcon = () => (
  <svg {...iconProps} width={16} height={16}>
    <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
  </svg>
)

// ---------- Configuración de pestañas ----------
const TABS = [
  { id: 'consolas', label: 'Consolas & TVs', short: 'Consolas', Icon: GamepadIcon },
  { id: 'productos', label: 'Ventas & Inventario', short: 'Ventas', Icon: BagIcon },
  { id: 'finanzas', label: 'Finanzas Diarias', short: 'Finanzas', Icon: ChartIcon },
]

// ---------- Clases reutilizables ----------
const inputClass =
  'w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-3 sm:py-2.5 text-base sm:text-sm text-white placeholder:text-zinc-600 transition-all duration-200 ease-in-out focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30'

const btnPrimary =
  'inline-flex items-center justify-center min-h-[44px] px-4 rounded-lg bg-indigo-600 text-white text-sm font-bold transition-all duration-200 ease-in-out hover:bg-indigo-500 hover:shadow-[0_0_18px_-4px_rgba(129,140,248,0.7)] active:scale-95 active:brightness-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 disabled:opacity-50 disabled:pointer-events-none'

const btnGhost =
  'inline-flex items-center justify-center min-h-[44px] px-4 rounded-lg bg-zinc-800 text-zinc-200 text-sm font-semibold transition-all duration-200 ease-in-out hover:bg-zinc-700 active:scale-95 active:brightness-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500'

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('consolas') // 'consolas' | 'productos' | 'finanzas'
  const [consolas, setConsolas] = useState([])
  const [products, setProducts] = useState([])
  const [finances, setFinances] = useState({})
  const [salesHistory, setSalesHistory] = useState([])
  const [now, setNow] = useState(Date.now())
  const [live, setLive] = useState(false)

  // Tasa de cambio (COP por 1 BS) y widget de ajuste
  const [tasaBs, setTasaBs] = useState(DEFAULT_TASA_BS)
  const [rateOpen, setRateOpen] = useState(false)
  const [rateDraft, setRateDraft] = useState('')
  const [rateError, setRateError] = useState('')

  // Avisos (cobro registrado / errores)
  const [notice, setNotice] = useState(null) // { type: 'ok' | 'error', text }
  const noticeTimer = useRef(null)

  // Modal de agregar producto
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newProd, setNewProd] = useState({ name: '', type: 'consumible', price: '', stock: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const showNotice = (type, text) => {
    clearTimeout(noticeTimer.current)
    setNotice({ type, text })
    noticeTimer.current = setTimeout(() => setNotice(null), 6000)
  }

  // Reloj en tiempo real para las tarjetas de consola
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Cargar la tasa guardada en este dispositivo
  useEffect(() => {
    try {
      const saved = parseTasa(localStorage.getItem(TASA_STORAGE_KEY))
      if (saved) setTasaBs(saved)
    } catch (e) {
      // Sin acceso a localStorage: se usa la tasa por defecto
    }
    return () => clearTimeout(noticeTimer.current)
  }, [])

  // Cerrar el widget de tasa con Escape
  useEffect(() => {
    if (!rateOpen) return
    const onKey = (e) => e.key === 'Escape' && setRateOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rateOpen])

  useEffect(() => {
    fetchCloudData()
    fetchConsolas()

    // Realtime con Supabase para sincronizar datos
    const channel = supabase
      .channel('realtime-tr1')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consolas' }, () => {
        fetchConsolas()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, () => {
        fetchCloudData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'historial_cajas' }, () => {
        fetchCloudData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'historial_ventas' }, () => {
        fetchCloudData()
      })
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Sincronización completa con Supabase (productos, ventas e historial de cajas)
  const fetchCloudData = async () => {
    try {
      const { data: prodData } = await supabase.from('productos').select('*')
      if (prodData) setProducts(prodData)

      const { data: salesData } = await supabase.from('historial_ventas').select('*')
      const { data: cajasData } = await supabase.from('historial_cajas').select('*')

      const combinedHistory = [
        ...(salesData || []).map((s) => ({
          ...s,
          tipo: 'producto',
          fecha: s.vendido_at || s.created_at,
          monto: Number(s.total_cobrado || s.total || 0),
        })),
        ...(cajasData || []).map((c) => ({
          ...c,
          tipo: 'consola',
          fecha: c.tiempo_inicio || c.cerrado_at,
          // `monto` siempre en COP: los cobros en BS suman por su equivalente en COP,
          // así los totales y el resumen no mezclan monedas.
          monto: Number(c.monto_cop ?? c.monto_cobrado ?? 0),
        })),
      ]

      setSalesHistory(combinedHistory)

      // Agrupar por día
      const groupedFinances = {}
      combinedHistory.forEach((item) => {
        if (!item.fecha) return
        const date = toLocalDay(item.fecha)
        if (!date) return

        if (!groupedFinances[date]) {
          groupedFinances[date] = { totalConsoles: 0, totalProducts: 0, totalGeneral: 0 }
        }

        if (item.tipo === 'consola') {
          groupedFinances[date].totalConsoles += item.monto
        } else {
          groupedFinances[date].totalProducts += item.monto
        }
        groupedFinances[date].totalGeneral += item.monto
      })

      // Ordenar de la fecha más reciente a la más antigua
      const sortedFinances = Object.fromEntries(
        Object.entries(groupedFinances).sort((a, b) => (a[0] < b[0] ? 1 : -1))
      )

      setFinances(sortedFinances)
    } catch (e) {
      console.log('Error al sincronizar con Supabase:', e)
    }
  }

  const fetchConsolas = async () => {
    const { data } = await supabase.from('consolas').select('*')
    if (data) {
      // Orden estricto por ID para que nunca cambien de lugar al activarlas
      const sortedConsolas = [...data].sort((a, b) => Number(a.id) - Number(b.id))
      setConsolas(sortedConsolas)
    }
  }

  // --- TASA DE CAMBIO ---
  const openRateWidget = () => {
    setRateDraft(fmtTasa(tasaBs))
    setRateError('')
    setRateOpen(true)
  }

  const handleSaveRate = (e) => {
    e.preventDefault()
    const parsed = parseTasa(rateDraft)
    if (!parsed) {
      setRateError('Escribe un número mayor que 0, por ejemplo 2,7')
      return
    }
    setTasaBs(parsed)
    try {
      localStorage.setItem(TASA_STORAGE_KEY, String(parsed))
    } catch (err) {
      // Si no se puede guardar, la tasa queda activa solo en esta sesión
    }
    setRateOpen(false)
    showNotice('ok', `Tasa actualizada: ${fmtTasa(parsed)}`)
  }

  const draftTasa = parseTasa(rateDraft)
  const previewBs = draftTasa ? fmtBS(copToBs(12000, draftTasa)) : '—'

  const selectTab = (id) => {
    setRateOpen(false)
    setActiveTab(id)
  }

  // --- ACCIONES DE CONSOLAS ---
  const handleAddTime = async (c, mins) => {
    const isStartingNew = c.estado === 'disponible' || c.estado === 'finalizado' || !c.tiempo_inicio
    const currentMins = isStartingNew ? 0 : Number(c.minutos_totales || 0)
    const newMins = Math.max(0, currentMins + Number(mins))

    const updates = {
      minutos_totales: Number(newMins),
      estado: 'ocupada',
      tiempo_abierto: false,
    }

    if (isStartingNew) {
      updates.tiempo_inicio = new Date().toISOString()
    }

    const { error } = await supabase.from('consolas').update(updates).eq('id', Number(c.id))
    if (error) {
      console.error('Error detallado de Supabase:', error.message)
    } else {
      fetchConsolas()
    }
  }

  const handleOpenTime = async (c) => {
    const updates = {
      estado: 'ocupada',
      tiempo_abierto: true,
      minutos_totales: 0,
      tiempo_inicio: new Date().toISOString(),
    }

    const { error } = await supabase.from('consolas').update(updates).eq('id', Number(c.id))
    if (error) {
      console.error('Error detallado de Supabase:', error.message)
    } else {
      fetchConsolas()
    }
  }

  const handleFinishTime = async (c) => {
    const updates = {
      estado: 'finalizado',
      tiempo_abierto: false,
    }

    // En tiempo libre, congela los minutos transcurridos para poder cobrarlos después
    if (c.tiempo_abierto) {
      updates.minutos_totales = getMinutesUsed(c, Date.now())
    }

    const { error } = await supabase.from('consolas').update(updates).eq('id', Number(c.id))
    if (error) {
      console.error('Error detallado de Supabase:', error.message)
    } else {
      fetchConsolas()
    }
  }

  // payment = cobro que el operador vio en la tarjeta (moneda, montos, tasa, minutos)
  const handleReleaseConsole = async (c, payment) => {
    const charge = payment || calcCharge(c, Date.now(), tasaBs, 'COP')
    const nombre = c.nombre || c.name || `Consola #${c.id}`

    // 1. Registrar el cobro en 'historial_cajas' (moneda elegida + monto correspondiente)
    const { error: cajaError } = await supabase.from('historial_cajas').insert([
      {
        consola_id: c.id,
        consola_nombre: nombre,
        tiempo_inicio: c.tiempo_inicio || new Date().toISOString(),
        minutos_usados: charge.minutos,
        monto_cobrado: charge.montoCobrado,
        moneda: charge.moneda,
        tasa_cambio: charge.moneda === 'BS' ? charge.tasa : null,
        monto_cop: charge.montoCOP,
        metodo_pago: 'Efectivo',
        cerrado_at: new Date().toISOString(),
      },
    ])

    // Si no se pudo registrar el cobro, NO se libera la consola: así no se pierde la venta
    if (cajaError) {
      console.error('Error al registrar caja de consola:', cajaError.message)
      const faltanColumnas = /moneda|tasa_cambio|monto_cop|schema cache|column/i.test(cajaError.message)
      showNotice(
        'error',
        faltanColumnas
          ? 'No se registró el cobro: faltan las columnas nuevas en historial_cajas. Ejecuta el SQL de migración en Supabase.'
          : `No se registró el cobro (${cajaError.message}). La consola sigue activa.`
      )
      return
    }

    // 2. Dejar la consola disponible
    const updates = {
      estado: 'disponible',
      minutos_totales: 0,
      tiempo_abierto: false,
      monto_total: 0,
      tiempo_inicio: null,
    }

    const { error } = await supabase.from('consolas').update(updates).eq('id', Number(c.id))
    if (error) {
      console.error('Error detallado de Supabase al liberar:', error.message)
      showNotice('error', 'El cobro se registró, pero no se pudo liberar la consola. Inténtalo de nuevo.')
    } else {
      showNotice('ok', `Cobrado ${fmtMonto(charge.montoCobrado, charge.moneda)} · ${nombre}`)
      fetchCloudData()
      fetchConsolas()
    }
  }

  // --- ACCIONES DE PRODUCTOS E INVENTARIO ---
  const closeModal = () => {
    setIsModalOpen(false)
    setFormError('')
  }

  const handleAddProduct = async (e) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setFormError('')

    try {
      const { error } = await supabase.from('productos').insert([
        {
          nombre: newProd.name,
          tipo: newProd.type,
          precio: parseFloat(newProd.price),
          stock: parseInt(newProd.stock, 10),
        },
      ])

      if (error) {
        console.error('Error detallado de Supabase al insertar producto:', error.message)
        setFormError('No se pudo guardar el producto: ' + error.message)
      } else {
        closeModal()
        setNewProd({ name: '', type: 'consumible', price: '', stock: '' })
        fetchCloudData()
      }
    } catch (err) {
      console.error('Error al agregar producto:', err)
      setFormError('No se pudo guardar el producto. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const handleRegisterSale = async (saleData) => {
    try {
      const { productId, newStock, ...dbData } = saleData

      // 1. Insertar en historial de ventas
      const { error: saleError } = await supabase.from('historial_ventas').insert([dbData])

      // 2. Actualizar el stock del producto
      if (!saleError && productId) {
        await supabase.from('productos').update({ stock: newStock }).eq('id', productId)
      }

      fetchCloudData()
    } catch (err) {
      console.error('Error al registrar venta:', err)
    }
  }

  // ---------- Derivados ----------
  const consolasEnUso = consolas.filter((c) => c.estado === 'ocupada').length
  const financeRows = Object.entries(finances)
  const grandTotals = financeRows.reduce(
    (acc, [, f]) => ({
      consoles: acc.consoles + f.totalConsoles,
      products: acc.products + f.totalProducts,
      general: acc.general + f.totalGeneral,
    }),
    { consoles: 0, products: 0, general: 0 }
  )

  // Últimos 50 cierres de consola, del más reciente al más antiguo
  const cierres = salesHistory
    .filter((i) => i.tipo === 'consola')
    .sort((a, b) => new Date(b.cerrado_at || b.fecha) - new Date(a.cerrado_at || a.fecha))
    .slice(0, 50)

  return (
    <div className="min-h-screen bg-carbon text-white font-sans">
      {/* Animación de cambio de pestaña (respeta "reducir movimiento") */}
      <style>{`
        @keyframes tr1-tab-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .tr1-tab-in { animation: tr1-tab-in .22s ease-out; }
        @keyframes tr1-pop-in { from { opacity: 0; transform: translateY(-4px) scale(.98); } to { opacity: 1; transform: none; } }
        .tr1-pop-in { animation: tr1-pop-in .16s ease-out; }
        @media (prefers-reduced-motion: reduce) { .tr1-tab-in, .tr1-pop-in { animation: none; } }
      `}</style>

      {/* ENCABEZADO */}
      <header className="sticky top-0 z-30 bg-carbon border-b border-zinc-800">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-baseline gap-2">
            <h1 className="font-display text-xl font-bold tracking-wider text-indigo-400 sm:text-2xl">
              TR1
              <span className="hidden lg:inline"> // CONTROL DE SALA</span>
            </h1>
          </div>

          {/* Pestañas de escritorio: control segmentado */}
          <nav
            role="tablist"
            aria-label="Secciones del panel"
            className="hidden md:flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1"
          >
            {TABS.map(({ id, label, Icon }) => {
              const active = activeTab === id
              return (
                <button
                  key={id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectTab(id)}
                  className={`flex min-h-[40px] items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-all duration-200 ease-in-out active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
                    active
                      ? 'bg-indigo-600 text-white shadow-[0_0_20px_-4px_rgba(129,140,248,0.7)]'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <span className="scale-90">
                    <Icon />
                  </span>
                  {label}
                </button>
              )
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            {/* WIDGET DE TASA (esquina superior) */}
            <div className="sm:relative">
              <button
                type="button"
                onClick={() => (rateOpen ? setRateOpen(false) : openRateWidget())}
                aria-expanded={rateOpen}
                aria-haspopup="dialog"
                className={`flex min-h-[40px] items-center gap-2 rounded-lg border px-3 text-sm font-semibold tabular-nums transition-all duration-200 ease-in-out active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                  rateOpen
                    ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300 shadow-[0_0_18px_-6px_rgba(52,211,153,0.8)]'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-emerald-400/40 hover:text-emerald-300'
                }`}
              >
                <SwapIcon />
                <span>
                  <span className="hidden sm:inline">Tasa: </span>
                  {fmtTasa(tasaBs)}
                </span>
              </button>

              {rateOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Cerrar ajuste de tasa"
                    onClick={() => setRateOpen(false)}
                    className="fixed inset-0 z-40 cursor-default bg-black/40 sm:bg-transparent"
                  />
                  <form
                    onSubmit={handleSaveRate}
                    role="dialog"
                    aria-label="Ajustar tasa de cambio"
                    className="tr1-pop-in fixed inset-x-4 top-[68px] z-50 rounded-xl border border-zinc-800 bg-zinc-900 p-4 shadow-2xl shadow-black/60 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80"
                  >
                    <h2 className="text-sm font-bold text-emerald-400">Tasa de cambio a bolívares</h2>
                    <p className="mt-1 text-xs text-zinc-400">
                      BS = COP ÷ tasa. Se cobra solo la parte entera del resultado, sin redondear hacia arriba.
                    </p>

                    <label htmlFor="tasa-bs" className="mt-3 block text-xs text-zinc-400">
                      Tasa (COP por cada 1 BS)
                    </label>
                    <input
                      id="tasa-bs"
                      type="text"
                      inputMode="decimal"
                      autoFocus
                      value={rateDraft}
                      onChange={(e) => {
                        setRateDraft(e.target.value)
                        setRateError('')
                      }}
                      placeholder="2,7"
                      className={inputClass}
                    />

                    <p className="mt-2 text-xs tabular-nums text-zinc-400">
                      Ejemplo: <span className="text-zinc-200">12.000 COP</span> →{' '}
                      <span className="font-bold text-emerald-400">{previewBs} BS</span>
                    </p>

                    {rateError && (
                      <p role="alert" className="mt-2 text-xs text-rose-300">
                        {rateError}
                      </p>
                    )}

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setRateOpen(false)} className={btnGhost}>
                        Cancelar
                      </button>
                      <button type="submit" className={btnPrimary}>
                        Guardar tasa
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>

            {/* Estado de la conexión en tiempo real */}
            <div className="flex items-center gap-2 text-xs text-zinc-400" role="status">
              <span className="relative flex h-2.5 w-2.5">
                {live && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                )}
                <span
                  className={`relative inline-flex h-2.5 w-2.5 rounded-full transition-colors duration-200 ${
                    live ? 'bg-emerald-400' : 'bg-zinc-600'
                  }`}
                />
              </span>
              <span className="hidden sm:inline">{live ? 'En vivo' : 'Reconectando'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* CONTENIDO (padding inferior en móvil para no tapar la barra de pestañas) */}
      <div className="mx-auto max-w-[1600px] px-4 pb-28 pt-4 sm:px-6 sm:pt-6 md:pb-10">
        {/* RESUMEN FINANCIERO SUPERIOR */}
        <div className="mb-6 min-w-0">
          <FinancialSummary salesHistory={salesHistory} />
        </div>

        <main key={activeTab} className="tr1-tab-in">
          {/* PESTAÑA 1: CONSOLAS Y TVS */}
          {activeTab === 'consolas' && (
            <section aria-labelledby="titulo-consolas">
              <div className="mb-4 flex items-end justify-between gap-3">
                <h2 id="titulo-consolas" className="text-lg font-bold text-indigo-300 sm:text-xl">
                  Consolas y TVs
                </h2>
                {consolas.length > 0 && (
                  <p className="text-sm text-zinc-400">
                    <span className="font-bold text-emerald-400">{consolasEnUso}</span> de{' '}
                    {consolas.length} en uso
                  </p>
                )}
              </div>

              {consolas.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900 p-8 text-center text-sm text-zinc-400">
                  No hay consolas cargadas. Agrégalas en la tabla <code className="text-indigo-300">consolas</code> de Supabase y aparecerán aquí.
                </div>
              ) : (
                <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
                  {consolas.map((consola) => (
                    <div key={consola.id} className="h-full min-w-0">
                      <ConsoleCard
                        c={consola}
                        now={now}
                        tasaBs={tasaBs}
                        onAdd={handleAddTime}
                        onOpen={handleOpenTime}
                        onFinish={handleFinishTime}
                        onRelease={handleReleaseConsole}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* PESTAÑA 2: PRODUCTOS, ALQUILERES E INVENTARIO */}
          {activeTab === 'productos' && (
            <section aria-labelledby="titulo-productos" className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 id="titulo-productos" className="text-lg font-bold text-indigo-300 sm:text-xl">
                  Gestión de productos y alquileres
                </h2>
                <button onClick={() => setIsModalOpen(true)} className={`${btnPrimary} w-full sm:w-auto`}>
                  + Nuevo producto / alquiler
                </button>
              </div>

              <div className="min-w-0 overflow-x-auto overscroll-x-contain scroll-smooth [-webkit-overflow-scrolling:touch]">
                <ProductosSalesModule
                  products={products}
                  onRegisterSale={handleRegisterSale}
                  salesHistory={salesHistory}
                />
              </div>
            </section>
          )}

          {/* PESTAÑA 3: FINANZAS DIARIAS */}
          {activeTab === 'finanzas' && (
            <div className="space-y-6">
              <section
                aria-labelledby="titulo-finanzas"
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6"
              >
                <h2 id="titulo-finanzas" className="text-lg font-bold text-indigo-300 sm:text-xl">
                  Historial de finanzas por día
                </h2>
                <p className="mb-4 mt-1 text-xs text-zinc-400">
                  Totales en COP. Los cobros hechos en BS se suman por su equivalente en COP.
                </p>

                {financeRows.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-400">
                    Aún no hay movimientos. Cuando liberes una consola o registres una venta, el total del día aparecerá aquí.
                  </p>
                ) : (
                  <div className="overflow-x-auto overscroll-x-contain scroll-smooth rounded-lg border border-zinc-800 [-webkit-overflow-scrolling:touch]">
                    <table className="w-full min-w-[560px] text-left text-sm text-zinc-300">
                      <thead className="border-b border-zinc-800 bg-zinc-950 text-xs text-zinc-400">
                        <tr>
                          <th className="sticky left-0 z-10 bg-zinc-950 p-3 font-semibold">Fecha</th>
                          <th className="whitespace-nowrap p-3 text-right font-semibold">Consolas</th>
                          <th className="whitespace-nowrap p-3 text-right font-semibold">Productos / alquileres</th>
                          <th className="whitespace-nowrap p-3 text-right font-semibold">Total general</th>
                        </tr>
                      </thead>
                      <tbody>
                        {financeRows.map(([date, f]) => (
                          <tr
                            key={date}
                            className="group border-b border-zinc-800/50 transition-colors duration-200 ease-in-out hover:bg-zinc-800"
                          >
                            <td className="sticky left-0 z-10 whitespace-nowrap bg-zinc-900 p-3 font-medium text-white transition-colors duration-200 group-hover:bg-zinc-800">
                              {fmtDayLabel(date)}
                            </td>
                            <td className="whitespace-nowrap p-3 text-right tabular-nums">${fmtMoney(f.totalConsoles)}</td>
                            <td className="whitespace-nowrap p-3 text-right tabular-nums">${fmtMoney(f.totalProducts)}</td>
                            <td className="whitespace-nowrap p-3 text-right font-bold tabular-nums text-emerald-400">
                              ${fmtMoney(f.totalGeneral)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-zinc-700 bg-zinc-950 font-bold text-white">
                        <tr>
                          <td className="sticky left-0 z-10 bg-zinc-950 p-3">Acumulado</td>
                          <td className="whitespace-nowrap p-3 text-right tabular-nums">${fmtMoney(grandTotals.consoles)}</td>
                          <td className="whitespace-nowrap p-3 text-right tabular-nums">${fmtMoney(grandTotals.products)}</td>
                          <td className="whitespace-nowrap p-3 text-right tabular-nums text-emerald-400">
                            ${fmtMoney(grandTotals.general)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </section>

              {/* Historial detallado de cierres de consola, con la moneda de cada cobro */}
              <section
                aria-labelledby="titulo-cierres"
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6"
              >
                <h2 id="titulo-cierres" className="text-lg font-bold text-indigo-300 sm:text-xl">
                  Cierres de consola
                </h2>
                <p className="mb-4 mt-1 text-xs text-zinc-400">Últimos 50 cobros, con la moneda en que pagó el cliente.</p>

                {cierres.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-400">
                    Todavía no hay cierres. Cada vez que uses «A caja» quedará registrado aquí.
                  </p>
                ) : (
                  <div className="overflow-x-auto overscroll-x-contain scroll-smooth rounded-lg border border-zinc-800 [-webkit-overflow-scrolling:touch]">
                    <table className="w-full min-w-[640px] text-left text-sm text-zinc-300">
                      <thead className="border-b border-zinc-800 bg-zinc-950 text-xs text-zinc-400">
                        <tr>
                          <th className="sticky left-0 z-10 bg-zinc-950 p-3 font-semibold">Fecha y hora</th>
                          <th className="whitespace-nowrap p-3 font-semibold">Consola</th>
                          <th className="whitespace-nowrap p-3 text-right font-semibold">Tiempo</th>
                          <th className="whitespace-nowrap p-3 text-right font-semibold">Cobrado</th>
                          <th className="whitespace-nowrap p-3 text-right font-semibold">Equivalente</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cierres.map((c, i) => {
                          const moneda = c.moneda === 'BS' ? 'BS' : 'COP'
                          return (
                            <tr
                              key={c.id ?? `${c.cerrado_at}-${i}`}
                              className="group border-b border-zinc-800/50 transition-colors duration-200 ease-in-out hover:bg-zinc-800"
                            >
                              <td className="sticky left-0 z-10 whitespace-nowrap bg-zinc-900 p-3 font-medium text-white transition-colors duration-200 group-hover:bg-zinc-800">
                                {fmtDateTime(c.cerrado_at || c.fecha)}
                              </td>
                              <td className="whitespace-nowrap p-3">{c.consola_nombre || `Consola #${c.consola_id}`}</td>
                              <td className="whitespace-nowrap p-3 text-right tabular-nums">
                                {Number(c.minutos_usados || 0)} min
                              </td>
                              <td className="whitespace-nowrap p-3 text-right font-bold tabular-nums text-emerald-400">
                                {fmtMonto(c.monto_cobrado, moneda)}
                              </td>
                              <td className="whitespace-nowrap p-3 text-right text-xs tabular-nums text-zinc-400">
                                {moneda === 'BS'
                                  ? `${fmtCOP(c.monto_cop ?? 0)} COP${c.tasa_cambio ? ` · tasa ${fmtTasa(c.tasa_cambio)}` : ''}`
                                  : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}
        </main>
      </div>

      {/* AVISO DE COBRO / ERRORES */}
      {notice && (
        <div
          role={notice.type === 'error' ? 'alert' : 'status'}
          className={`tr1-pop-in fixed inset-x-4 bottom-24 z-50 rounded-xl border p-4 text-sm font-semibold shadow-2xl shadow-black/60 md:inset-x-auto md:bottom-6 md:right-6 md:w-96 ${
            notice.type === 'error'
              ? 'border-rose-400/40 bg-zinc-900 text-rose-300'
              : 'border-emerald-400/40 bg-zinc-900 text-emerald-300'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* BARRA DE PESTAÑAS MÓVIL: fija abajo, al alcance del pulgar */}
      <nav
        role="tablist"
        aria-label="Secciones del panel"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-zinc-800 bg-zinc-950 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {TABS.map(({ id, short, Icon }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(id)}
              className={`relative flex min-h-[60px] flex-col items-center justify-center gap-1 text-xs font-semibold transition-all duration-200 ease-in-out active:scale-95 active:brightness-90 focus:outline-none focus-visible:bg-zinc-900 ${
                active ? 'text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <span
                className={`absolute top-0 h-0.5 rounded-full bg-indigo-400 transition-all duration-200 ease-in-out ${
                  active ? 'w-10 opacity-100' : 'w-0 opacity-0'
                }`}
              />
              <Icon />
              {short}
            </button>
          )
        })}
      </nav>

      {/* MODAL PARA AGREGAR PRODUCTOS/ALQUILERES */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title="Agregar nuevo producto o alquiler">
        <form onSubmit={handleAddProduct} className="space-y-4">
          <div>
            <label htmlFor="prod-name" className="text-xs text-zinc-400">
              Nombre del artículo
            </label>
            <input
              id="prod-name"
              type="text"
              placeholder="Ej. Pepsi, Doritos, Auriculares (alquiler)"
              value={newProd.name}
              onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
              className={inputClass}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="prod-type" className="text-xs text-zinc-400">
                Tipo
              </label>
              <select
                id="prod-type"
                value={newProd.type}
                onChange={(e) => setNewProd({ ...newProd, type: e.target.value })}
                className={inputClass}
              >
                <option value="consumible">Consumible</option>
                <option value="alquiler">Alquiler</option>
              </select>
            </div>

            <div>
              <label htmlFor="prod-price" className="text-xs text-zinc-400">
                Precio ($)
              </label>
              <input
                id="prod-price"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="1.50"
                value={newProd.price}
                onChange={(e) => setNewProd({ ...newProd, price: e.target.value })}
                className={inputClass}
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="prod-stock" className="text-xs text-zinc-400">
              Stock inicial
            </label>
            <input
              id="prod-stock"
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="20"
              value={newProd.stock}
              onChange={(e) => setNewProd({ ...newProd, stock: e.target.value })}
              className={inputClass}
              required
            />
          </div>

          {formError && (
            <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {formError}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 pt-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={closeModal} className={`${btnGhost} w-full sm:w-auto`}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} className={`${btnPrimary} w-full sm:w-auto`}>
              {saving ? 'Guardando…' : 'Guardar producto'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}