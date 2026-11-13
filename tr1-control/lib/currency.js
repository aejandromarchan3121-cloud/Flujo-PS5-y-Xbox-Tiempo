// lib/currency.js
// Lógica única de moneda y cobro: la usan page.jsx y ConsoleCard.jsx
// para que lo que ve el operador sea exactamente lo que se registra.

export const DEFAULT_TASA_BS = 2.7
export const MONEDAS = ['COP', 'BS']

// "12000" -> "12.000" (agrupación manual: no depende del locale del navegador)
const groupThousands = (intStr) => intStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

// COP: separador de miles con punto y hasta 2 decimales con coma (solo si hacen falta)
export const fmtCOP = (value) => {
  const n = Number(value || 0)
  const [int, dec = ''] = Math.abs(n).toFixed(2).split('.')
  const decimals = dec.replace(/0+$/, '')
  return `${n < 0 ? '-' : ''}${groupThousands(int)}${decimals ? ',' + decimals : ''}`
}

// BS: siempre entero con puntos de miles
export const fmtBS = (value) => groupThousands(String(Math.floor(Number(value || 0))))

export const fmtTasa = (value) => String(value).replace('.', ',')

// "2,7" o "2.7" -> 2.7 ; devuelve null si no es válida
export const parseTasa = (raw) => {
  const n = parseFloat(String(raw).trim().replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Regla de conversión a BS:
 * monto COP ÷ tasa, y se conserva únicamente la parte entera
 * (todo lo que está antes de la coma decimal). Sin redondeo hacia arriba.
 * Ej.: 12.000 ÷ 2,7 = 4.444,4444… -> 4.444 BS
 * El toFixed(6) evita errores de coma flotante (p. ej. 2999,9999999999995).
 */
export const copToBs = (cop, tasa) => {
  if (!(tasa > 0)) return 0
  return Math.floor(Number((Number(cop || 0) / tasa).toFixed(6)))
}

export const fmtMonto = (monto, moneda) =>
  moneda === 'BS' ? `${fmtBS(monto)} BS` : `${fmtCOP(monto)} COP`

// Minutos usados por una consola (tiempo abierto = transcurridos; fijo = comprados)
export const getMinutesUsed = (c, nowMs = Date.now()) => {
  if (c.tiempo_abierto && c.tiempo_inicio) {
    return Math.max(0, Math.floor((nowMs - new Date(c.tiempo_inicio).getTime()) / 60000))
  }
  return Number(c.minutos_totales || 0)
}

// Cobro completo de una consola en la moneda elegida
export const calcCharge = (c, nowMs, tasa, moneda = 'COP') => {
  const minutos = getMinutesUsed(c, nowMs)
  const tarifaHora = Number(c.tarifa_hora || 0)
  const montoCOP = Number(((tarifaHora / 60) * minutos).toFixed(2))
  const montoBS = copToBs(montoCOP, tasa)
  return {
    minutos,
    moneda,
    tasa,
    montoCOP,
    montoBS,
    montoCobrado: moneda === 'BS' ? montoBS : montoCOP,
  }
}

// Reloj mm:ss o h:mm:ss
export const fmtClock = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (v) => String(v).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}
