'use client'
import { useEffect, useState } from 'react'

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

export const fmt = (s) => {
  const a = Math.max(0, Math.floor(s))
  return [Math.floor(a / 3600), Math.floor((a % 3600) / 60), a % 60]
    .map((v) => String(v).padStart(2, '0')).join(':')
}

// Estado visual derivado: libre | uso | agotado + cálculo dinámico de precio
export function derive(c, now) {
  if (!c || c.estado === 'disponible') return { k: 'libre', secs: 0, monto: 0 }

  const tarifa = Number(c.tarifa_hora || 0)

  if (c.estado === 'finalizado') {
    const montoFinal = Number(c.monto_total || (c.minutos_totales / 60) * tarifa)
    return { k: 'agotado', secs: 0, monto: montoFinal }
  }

  const ini = c.tiempo_inicio ? new Date(c.tiempo_inicio).getTime() : now
  const elapsedSecs = Math.max(0, (now - ini) / 1000)

  // Si es TIEMPO ABIERTO (cuenta hacia adelante)
  if (c.tiempo_abierto) {
    const montoActual = (elapsedSecs / 3600) * tarifa
    return { k: 'uso', secs: elapsedSecs, monto: montoActual, up: true }
  } 

  // Si es TIEMPO FIJO (cuenta regresiva)
  const totalSecs = (c.minutos_totales || 0) * 60
  const rest = (ini + totalSecs * 1000 - now) / 1000
  const montoFijo = ((c.minutos_totales || 0) / 60) * tarifa

  if (rest <= 0) {
    return { k: 'agotado', secs: 0, monto: montoFijo }
  }

  return { k: 'uso', secs: rest, monto: montoFijo }
}