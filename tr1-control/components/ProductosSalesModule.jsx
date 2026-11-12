'use client'
import React, { useState } from 'react';

export default function ProductSalesModule({ products, onRegisterSale }) {
  // Manejador de cantidad por cada producto ID
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
    
    if (product.stock < qtyToSell) {
      alert('Stock insuficiente');
      return;
    }

    // Estructura adaptada exactamente a las columnas de Supabase
    onRegisterSale({
      producto_nombre: product.name,
      cantidad: qtyToSell,
      total_cobrado: Number((product.price * qtyToSell).toFixed(2)),
      vendido_at: new Date().toISOString(),
      productId: product.id,
      newStock: product.stock - qtyToSell
    });

    // Resetear cantidad de este producto a 1
    setQuantities(prev => ({ ...prev, [product.id]: 1 }));
  };

  return (
    <div className="text-white">
      <h2 className="text-lg font-bold mb-4 text-emerald-400 flex items-center gap-2">
        <span>🛒</span> Venta Rápida de Productos
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
        {products.map((prod) => {
          const currentQty = quantities[prod.id] || 1;
          const isOutOfStock = prod.stock <= 0;

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
                  <p className="font-semibold text-sm text-zinc-100">{prod.name}</p>
                  <p className="text-[11px] text-zinc-400">Stock disponible: <span className="text-zinc-200 font-medium">{prod.stock}</span></p>
                </div>
                <p className="text-emerald-400 font-bold font-display text-base">
                  ${(prod.price * currentQty).toFixed(2)}
                </p>
              </div>

              {!isOutOfStock && (
                <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-zinc-800">
                  {/* Selector de cantidad individual */}
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

                  {/* Botón de cobrar / vender */}
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
  );
}