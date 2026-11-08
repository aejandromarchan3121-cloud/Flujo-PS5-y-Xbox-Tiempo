'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

// Importa tus componentes modulares si prefieres mantener la separación
import ConsoleCard from './ConsoleCard'
import FinancialSummary from './FinancialSummary'
import ProductosSalesModule from './ProductosSalesModule'
import Modal from './Modal'

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

  // Estado para el modal de agregar producto
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newProd, setNewProd] = useState({ name: '', type: 'consumible', price: '', stock: '' })

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

  const handleDeleteProduct = async (id) => {
    try {
      const res = await fetch(`http://localhost:3000/api/products/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) setProducts(data.products)
    } catch (err) {
      console.error('Error al eliminar producto:', err)
    }
  }

  const handleSellProduct = async (productId, quantity = 1) => {
    try {
      const res = await fetch('http://localhost:3000/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity })
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
    <div className="p-6 bg-gray-950 min-h-screen text-white font-sans">
      {/* HEADER Y PESTAÑAS */}
      <header className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
        <h1 className="text-2xl font-bold tracking-wider text-indigo-400">TR1 // CONTROL DE SALA</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setActiveTab('consolas')}
            className={`px-4 py-2 rounded-lg font-semibold transition ${activeTab === 'consolas' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            Consolas & TVs
          </button>
          <button
            onClick={() => setActiveTab('productos')}
            className={`px-4 py-2 rounded-lg font-semibold transition ${activeTab === 'productos' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            Ventas & Inventario
          </button>
          <button
            onClick={() => setActiveTab('finanzas')}
            className={`px-4 py-2 rounded-lg font-semibold transition ${activeTab === 'finanzas' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            Finanzas Diarias
          </button>
        </div>
      </header>

      {/* PESTAÑA 1: CONSOLAS Y TVS */}
      {activeTab === 'consolas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {consolas.map((consola) => (
            <div key={consola.id} className="bg-gray-900 p-5 rounded-xl border border-gray-800 shadow-lg">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xl font-bold">{consola.nombre}</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${consola.estado === 'ocupada' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-green-500/20 text-green-400 border border-green-500/30'}`}>
                  {consola.estado}
                </span>
              </div>
              <p className="text-sm text-gray-400 mb-4">IP TV: <span className="text-indigo-300">{consola.ip_address || 'Sin asignar'}</span></p>
              <div className="flex gap-2">
                <button
                  onClick={() => supabase.from('consolas').update({ estado: 'ocupada' }).eq('id', consola.id)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2 rounded-lg font-bold text-sm transition"
                >
                  Iniciar Tiempo
                </button>
                <button
                  onClick={() => supabase.from('consolas').update({ estado: 'disponible' }).eq('id', consola.id)}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 py-2 rounded-lg font-bold text-sm transition"
                >
                  Liberar
                </button>
              </div>
            </div>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {products.map((p) => (
              <div key={p.id} className="bg-gray-900 p-5 rounded-xl border border-gray-800 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-lg text-white">{p.name}</h4>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mt-1">Tipo: {p.type}</p>
                  <p className="text-xl font-bold text-emerald-400 mt-2">${p.price?.toFixed(2)} USD</p>
                  <p className="text-xs text-gray-400 mt-1">Stock disponible: <span className="font-bold text-white">{p.stock}</span></p>
                </div>
                <div className="flex gap-2 mt-5">
                  <button
                    onClick={() => handleSellProduct(p.id, 1)}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 py-2 rounded-lg font-bold text-sm transition"
                  >
                    Vender (1)
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(p.id)}
                    className="bg-gray-800 hover:bg-rose-600/30 text-rose-400 px-3 py-2 rounded-lg font-bold text-sm transition"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PESTAÑA 3: FINANZAS DIARIAS */}
      {activeTab === 'finanzas' && (
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
          <h2 className="text-xl font-bold mb-4 text-indigo-300">Historial de Finanzas por Día</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-950 uppercase text-xs text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Total Consolas</th>
                  <th className="p-3">Total Productos / Alquileres</th>
                  <th className="p-3">Total General</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(finances).map(([date, f]) => (
                  <tr key={date} className="border-b border-gray-800/50 hover:bg-gray-850">
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

      {/* MODAL PARA AGREGAR PRODUCTOS/ALQUILERES */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleAddProduct} className="bg-gray-900 p-6 rounded-2xl border border-gray-800 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-indigo-300">Agregar Nuevo Producto o Alquiler</h3>
            
            <div>
              <label className="text-xs text-gray-400">Nombre del artículo</label>
              <input
                type="text"
                placeholder="Ej. Pepsi, Doritos, Auriculares (Alquiler)"
                value={newProd.name}
                onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
                className="w-full mt-1 bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Tipo</label>
                <select
                  value={newProd.type}
                  onChange={(e) => setNewProd({ ...newProd, type: e.target.value })}
                  className="w-full mt-1 bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="consumible">Consumible</option>
                  <option value="alquiler">Alquiler</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400">Precio ($)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="1.50"
                  value={newProd.price}
                  onChange={(e) => setNewProd({ ...newProd, price: e.target.value })}
                  className="w-full mt-1 bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400">Stock Inicial</label>
              <input
                type="number"
                placeholder="20"
                value={newProd.stock}
                onChange={(e) => setNewProd({ ...newProd, stock: e.target.value })}
                className="w-full mt-1 bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm font-semibold transition"
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
        </div>
      )}
    </div>
  )
}