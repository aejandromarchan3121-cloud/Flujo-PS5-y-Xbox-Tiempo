'use client'
import React, { useMemo } from 'react';

// Función auxiliar de formato con separador de miles
const fmtMoney = (val) => {
  return Number(val || 0).toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
};

export default function FinancialSummary({ salesHistory }) {
  const analytics = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    const dayOfWeek = now.getDay() || 7;
    const startOfWeek = new Date(now).setDate(now.getDate() - dayOfWeek + 1);

    let dailyTotal = 0;
    let weeklyTotal = 0;
    let consoleIncome = 0;
    let productIncome = 0;

    salesHistory.forEach((sale) => {
      const dateStr = sale.fecha || sale.vendido_at || sale.tiempo_inicio || sale.created_at;
      if (!dateStr) return;
      
      const saleTime = new Date(dateStr).getTime();
      const amount = Number(sale.monto || sale.total_cobrado || sale.total || 0);
      
      if (saleTime >= startOfDay) {
        dailyTotal += amount;
        if (sale.tipo === 'consola' || sale.consola_nombre) consoleIncome += amount;
        if (sale.tipo === 'producto' || sale.producto_nombre) productIncome += amount;
      }
      
      if (saleTime >= startOfWeek) {
        weeklyTotal += amount;
      }
    });

    return { dailyTotal, weeklyTotal, consoleIncome, productIncome };
  }, [salesHistory]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
        <p className="text-xs text-zinc-400 uppercase font-semibold">Ingresos Hoy</p>
        <p className="text-2xl font-extrabold text-emerald-400 mt-1">${fmtMoney(analytics.dailyTotal)}</p>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
        <p className="text-xs text-zinc-400 uppercase font-semibold">Ingresos Esta Semana</p>
        <p className="text-2xl font-extrabold text-blue-400 mt-1">${fmtMoney(analytics.weeklyTotal)}</p>
      </div>
    </div>
  );
}