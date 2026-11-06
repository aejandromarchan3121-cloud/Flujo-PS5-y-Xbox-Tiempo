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

// Estado visual derivado: libre | uso | agotado
export function derive(c, now) {
  if (!c || c.estado === 'disponible') return { k: 'libre', secs: 0 }
  if (c.estado === 'finalizado') return { k: 'agotado', secs: 0 }
  const ini = new Date(c.tiempo_inicio).getTime()
  if (c.tiempo_abierto) return { k: 'uso', secs: (now - ini) / 1000, up: true }
  const rest = (ini + c.minutos_totales * 60000 - now) / 1000
  return rest <= 0 ? { k: 'agotado', secs: 0 } : { k: 'uso', secs: rest }
}