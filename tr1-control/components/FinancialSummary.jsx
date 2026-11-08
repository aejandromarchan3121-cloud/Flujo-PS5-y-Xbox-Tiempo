import React, { useMemo } from 'react';

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
      const saleTime = new Date(sale.timestamp).getTime();
      
      if (saleTime >= startOfDay) {
        dailyTotal += sale.total;
        if (sale.type === 'console_time') consoleIncome += sale.total;
        if (sale.type === 'product_sale') productIncome += sale.total;
      }
      
      if (saleTime >= startOfWeek) {
        weeklyTotal += sale.total;
      }
    });

    return { dailyTotal, weeklyTotal, consoleIncome, productIncome };
  }, [salesHistory]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl">
        <p className="text-xs text-slate-400 uppercase font-semibold">Ingresos Hoy</p>
        <p className="text-2xl font-extrabold text-emerald-400 mt-1">${analytics.dailyTotal.toFixed(2)}</p>
      </div>
      <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl">
        <p className="text-xs text-slate-400 uppercase font-semibold">Ingresos Esta Semana</p>
        <p className="text-2xl font-extrabold text-blue-400 mt-1">${analytics.weeklyTotal.toFixed(2)}</p>
      </div>
    </div>
  );
}