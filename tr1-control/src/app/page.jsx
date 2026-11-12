'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import ConsoleCard from '../../components/ConsoleCard'
import FinancialSummary from '../../components/FinancialSummary'
import ProductosSalesModule from '../../components/ProductosSalesModule'
import Modal from '../../components/Modal'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('consolas') // 'consolas' | 'productos' | 'finanzas'
  const [consolas, setConsolas] = useState([])
  const [products, setProducts] = useState([])
  const [finances, setFinances] = useState({})
  const [salesHistory, setSalesHistory] = useState([])
  const [now, setNow] = useState(Date.now())

  // Estado para el modal de agregar producto
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newProd, setNewProd] = useState({ name: '', type: 'consumible', price: '', stock: '' })

  // Actualizar el reloj en tiempo real para las tarjetas de consola
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    fetchLocalData()
    fetchConsolas()

    // Realtime con Supabase para sincronizar consolas
    const channel = supabase
      .channel('realtime-consolas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consolas' }, () => {
        fetchConsolas()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchLocalData = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/state')
      const data = await res.json()
      setProducts(data.products || [])
      setFinances(data.dailyFinances || {})
      setSalesHistory(data.salesHistory || [])
    } catch (e) {
      console.log('Servidor local offline o conectando...')
    }
  }

  const fetchConsolas = async () => {
    const { data } = await supabase.from('consolas').select('*')
    if (data) setConsolas(data)
  }

  // --- ACCIONES DE CONSOLAS ---
  const handleAddTime = async (c, mins) => {
    // Lógica para sumar minutos a la consola
    const currentMins = c.minutos_totales || 0
    await supabase.from('consolas').update({ minutos_totales: currentMins + mins, estado: 'uso' }).eq('id', c.id)
    fetchConsolas()
  }

  const handleOpenTime = async (c) => {
    await supabase.from('consolas').update({ estado: 'uso', tiempo_abierto: true, hora_inicio: new Date().toISOString() }).eq('id', c.id)
    fetchConsolas()
  }

  const handleFinishTime = async (c) => {
    await supabase.from('consolas').update({ estado: 'agotado' }).eq('id', c.id)
    fetchConsolas()
  }

  const handleReleaseConsole = async (c) => {
    await supabase.from('consolas').update({ estado: 'libre', minutos_totales: 0, tiempo_abierto: false, monto_total: 0 }).eq('id', c.id)
    fetchConsolas()
  }
// --- ACTIVACION DE ANIMACION ---
const [showSplash, setShowSplash] = useState(true)

if (showSplash) {
  return <SplashScreen onFinish={() => setShowSplash(false)} />
}

  // --- ACCIONES DE PRODUCTOS E INVENTARIO ---
  const handleAddProduct = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch('http://localhost:3000/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProd)
      })
      const data = await res.json()
      if (data.success) {
        setProducts(data.products)
        setIsModalOpen(false)
        setNewProd({ name: '', type: 'consumible', price: '', stock: '' })
      }
    } catch (err) {
      console.error('Error al agregar producto:', err)
    }
  }

  const handleRegisterSale = async (saleData) => {
    try {
      const res = await fetch('http://localhost:3000/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData)
      })
      const data = await res.json()
      if (data.success) {
        setProducts(data.products)
        fetchLocalData()
      }
    } catch (err) {
      console.error('Error al registrar venta:', err)
    }
  }

  return (
    <div className="p-6 bg-carbon min-h-screen text-white font-sans">
      {/* HEADER Y PESTAÑAS */}
      <header className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
        <h1 className="text-2xl font-bold tracking-wider text-indigo-400 font-display">TR1 // CONTROL DE SALA</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setActiveTab('consolas')}
            className={`px-4 py-2 rounded-lg font-semibold transition ${activeTab === 'consolas' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
          >
            Consolas & TVs
          </button>
          <button
            onClick={() => setActiveTab('productos')}
            className={`px-4 py-2 rounded-lg font-semibold transition ${activeTab === 'productos' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
          >
            Ventas & Inventario
          </button>
          <button
            onClick={() => setActiveTab('finanzas')}
            className={`px-4 py-2 rounded-lg font-semibold transition ${activeTab === 'finanzas' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
          >
            Finanzas Diarias
          </button>
        </div>
      </header>

      {/* RESUMEN FINANCIERO SUPERIOR */}
      <FinancialSummary salesHistory={salesHistory} />

      {/* PESTAÑA 1: CONSOLAS Y TVS (USANDO ConsoleCard) */}
      {activeTab === 'consolas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {consolas.map((consola) => (
            <ConsoleCard
              key={consola.id}
              c={consola}
              now={now}
              onAdd={handleAddTime}
              onOpen={handleOpenTime}
              onFinish={handleFinishTime}
              onRelease={handleReleaseConsole}
            />
          ))}
        </div>
      )}

      {/* PESTAÑA 2: PRODUCTOS, ALQUILERES E INVENTARIO */}
      {activeTab === 'productos' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-indigo-300">Gestión de Productos y Alquileres</h2>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg font-bold text-sm transition"
            >
              + Nuevo Producto / Alquiler
            </button>
          </div>

          <ProductosSalesModule products={products} onRegisterSale={handleRegisterSale} />
        </div>
      )}

      {/* PESTAÑA 3: FINANZAS DIARIAS */}
      {activeTab === 'finanzas' && (
        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
          <h2 className="text-xl font-bold mb-4 text-indigo-300">Historial de Finanzas por Día</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-zinc-950 uppercase text-xs text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Total Consolas</th>
                  <th className="p-3">Total Productos / Alquileres</th>
                  <th className="p-3">Total General</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(finances).map(([date, f]) => (
                  <tr key={date} className="border-b border-zinc-800/50 hover:bg-zinc-850">
                    <td className="p-3 font-medium text-white">{date}</td>
                    <td className="p-3">${f.totalConsoles?.toFixed(2) || '0.00'}</td>
                    <td className="p-3">${f.totalProducts?.toFixed(2) || '0.00'}</td>
                    <td className="p-3 text-emerald-400 font-bold">${f.totalGeneral?.toFixed(2) || '0.00'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL PARA AGREGAR PRODUCTOS/ALQUILERES (USANDO Modal) */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Agregar Nuevo Producto o Alquiler">
        <form onSubmit={handleAddProduct} className="space-y-4">
          <div>
            <label className="text-xs text-zinc-400">Nombre del artículo</label>
            <input
              type="text"
              placeholder="Ej. Pepsi, Doritos, Auriculares (Alquiler)"
              value={newProd.name}
              onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
              className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400">Tipo</label>
              <select
                value={newProd.type}
                onChange={(e) => setNewProd({ ...newProd, type: e.target.value })}
                className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="consumible">Consumible</option>
                <option value="alquiler">Alquiler</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-zinc-400">Precio ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="1.50"
                value={newProd.price}
                onChange={(e) => setNewProd({ ...newProd, price: e.target.value })}
                className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400">Stock Inicial</label>
            <input
              type="number"
              placeholder="20"
              value={newProd.stock}
              onChange={(e) => setNewProd({ ...newProd, stock: e.target.value })}
              className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-lg text-sm font-semibold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg text-sm font-bold transition"
            >
              Guardar Producto
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}