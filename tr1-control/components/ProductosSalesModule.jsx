'use client'
import React, { useState } from 'react';

// Formato de dinero con decimales y separador de miles
const fmtMoney = (val) => {
  return Number(val || 0).toLocaleString('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export default function ProductSalesModule({ products, onRegisterSale, salesHistory = [] }) {
  const [quantities, setQuantities] = useState({});

  const handleQtyChange = (productId, delta, maxStock) => {
    setQuantities(prev => {
      const current = prev[productId] || 1;
      const next = Math.max(1, Math.min(current + delta, maxStock));
      return { ...prev, [productId]: next };
    });
  };

  const handleSale = (product) => {
    const qtyToSell = quantities[product.id] || 1;
    const prodName = product.nombre || product.name || 'Producto';
    const prodPrice = Number(product.precio || product.price || 0);
    
    if (product.stock < qtyToSell) {
      alert('Stock insuficiente');
      return;
    }

    onRegisterSale({
      producto_nombre: prodName,
      cantidad: qtyToSell,
      total_cobrado: Number((prodPrice * qtyToSell).toFixed(2)),
      vendido_at: new Date().toISOString(),
      productId: product.id,
      newStock: product.stock - qtyToSell
    });

    setQuantities(prev => ({ ...prev, [product.id]: 1 }));
  };

  return (
    <div className="space-y-8 text-white">
      {/* SECCIÓN 1: VENTA RÁPIDA */}
      <div>
        <h2 className="text-lg font-bold mb-4 text-emerald-400 flex items-center gap-2">
          <span>🛒</span> Venta Rápida de Productos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
          {products.map((prod) => {
            const currentQty = quantities[prod.id] || 1;
            const isOutOfStock = prod.stock <= 0;
            const displayName = prod.nombre || prod.name || 'Sin nombre';
            const displayPrice = Number(prod.precio || prod.price || 0);

            return (
              <div
                key={prod.id}
                className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all ${
                  isOutOfStock 
                    ? 'bg-zinc-900/50 border-zinc-800 opacity-50 cursor-not-allowed' 
                    : 'bg-zinc-900 border-zinc-800 hover:border-emerald-500/50'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-semibold text-sm text-zinc-100">{displayName}</p>
                    <p className="text-[11px] text-zinc-400">Stock disponible: <span className="text-zinc-200 font-medium">{prod.stock}</span></p>
                  </div>
                  <p className="text-emerald-400 font-bold font-display text-base">
                    ${fmtMoney(displayPrice * currentQty)}
                  </p>
                </div>

                {!isOutOfStock && (
                  <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-zinc-800">
                    <div className="flex items-center border border-zinc-700 rounded-lg overflow-hidden bg-zinc-950">
                      <button
                        onClick={() => handleQtyChange(prod.id, -1, prod.stock)}
                        className="px-2.5 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                        type="button"
                      >
                        -
                      </button>
                      <span className="px-3 py-1 text-xs font-bold text-zinc-200 tabular-nums">
                        {currentQty}
                      </span>
                      <button
                        onClick={() => handleQtyChange(prod.id, 1, prod.stock)}
                        className="px-2.5 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                        type="button"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => handleSale(prod)}
                      className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 py-1.5 px-3 text-xs font-bold text-black transition-all shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                    >
                      Vender
                    </button>
                  </div>
                )}

                {isOutOfStock && (
                  <p className="text-xs text-red-400 font-semibold mt-2 text-center uppercase tracking-wider">Agotado</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECCIÓN 2: HISTORIAL DETALLADO DE TRANSACCIONES */}
      <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800">
        <h2 className="text-lg font-bold mb-4 text-indigo-300 flex items-center gap-2">
          <span>📋</span> Historial de Ventas y Alquileres de Consolas
        </h2>
        <div className="overflow-x-auto max-h-[40vh]">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-950 uppercase text-xs text-zinc-400 border-b border-zinc-800 sticky top-0">
              <tr>
                <th className="p-3">Fecha y Hora</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Descripción / Consola / Producto</th>
                <th className="p-3">Detalle / Tiempo</th>
                <th className="p-3">Total Cobrado</th>
              </tr>
            </thead>
            <tbody>
              {salesHistory.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center p-4 text-zinc-500">No hay registros recientes.</td>
                </tr>
              ) : (
                salesHistory.map((item, index) => {
                  const fechaFormatted = item.fecha ? new Date(item.fecha).toLocaleString('es-CO') : 'N/A';
                  const esConsola = item.tipo === 'consola' || item.consola_nombre;
                  // Ordenar de más reciente a más antiguo usando la fecha
const sortedHistory = [...salesHistory].sort((a, b) => {
  const dateA = new Date(a.fecha || a.vendido_at || a.tiempo_inicio || a.created_at || 0);
  const dateB = new Date(b.fecha || b.vendido_at || b.tiempo_inicio || b.created_at || 0);
  return dateB - dateA;
});
                  return (
                    <tr key={index} className="border-b border-zinc-800/50 hover:bg-zinc-850">
                      <td className="p-3 text-xs text-zinc-400">{fechaFormatted}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${esConsola ? 'bg-indigo-950 text-indigo-400 border border-indigo-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'}`}>
                          {esConsola ? 'Consola' : 'Producto'}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-white">
                        {esConsola ? `Alquiler ${item.consola_nombre || 'Consola'}` : (item.producto_nombre || item.nombre || item.name || 'Venta')}
                      </td>
                      <td className="p-3 text-xs text-zinc-400">
                        {esConsola ? `${item.minutos_usados || 0} minutos` : `Cantidad: ${item.cantidad || 1}`}
                      </td>
                      <td className="p-3 font-bold text-emerald-400">${fmtMoney(item.monto || item.total_cobrado || item.total)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}