import React, { useState } from 'react';

export default function ProductSalesModule({ products, onRegisterSale }) {
  const [qty, setQty] = useState(1);

  const handleSale = (product) => {
    onRegisterSale({
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      type: 'product_sale',
      itemId: product.id,
      itemName: product.name,
      quantity: qty,
      total: product.price * qty
    });
    setQty(1);
  };

  return (
    <div className="text-white">
      <h2 className="text-xl font-bold mb-4 text-emerald-400">🛒 Venta de Productos</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {products.map((prod) => (
          <button
            key={prod.id}
            onClick={() => handleSale(prod)}
            className="flex flex-col justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition active:scale-95 text-left"
          >
            <div>
              <p className="font-semibold text-sm sm:text-base text-slate-100">{prod.name}</p>
              <p className="text-xs text-slate-400">Stock: {prod.stock}</p>
            </div>
            <p className="mt-2 text-emerald-400 font-bold">${prod.price.toFixed(2)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}