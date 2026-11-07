import dotenv from 'dotenv'
import path from 'node:path'
dotenv.config({ path: path.resolve(process.cwd(), '.env') })
import fs from 'node:fs'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { createClient } from '@supabase/supabase-js'

const sh = promisify(exec)
const sb = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY
)

// Configuración de drivers por consola
const TV = {
  1: { driver: 'android' }, 2: { driver: 'android' },
  3: { driver: 'android' }, 4: { driver: 'android' },
  5: { driver: 'android' }, 6: { driver: 'android' },
  7: { driver: 'android' }, 8: { driver: 'android' },
}

/* ---------- CONTROL DE ADB / TV ---------- */
async function controlarTv(c, activar) {
  const cfg = TV[c.id] || { driver: 'none' }
  const url = `${process.env.CLIENT_URL}/pantalla/${c.id}`
  
  if (cfg.driver === 'android' && c.ip_tv) {
    const dev = `${c.ip_tv}:5555`
    try {
      await sh(`adb connect ${dev}`)
    } catch (e) {
      console.warn(`[ADB] No se pudo conectar a ${dev}:`, e.message)
    }
    
    // Si activar es true (ocupada/tiempo añadido) -> Abre la vista del juego en la TV
    // Si activar es false (finalizado/disponible) -> Vuelve a HDMI 1 (Keyevent 243)
    return activar
      ? sh(`adb -s ${dev} shell am start -a android.intent.action.VIEW -d "${url}"`)
      : sh(`adb -s ${dev} shell input keyevent 243`)
  }
}

// Acción unificada para el servidor local
const accion = async (c, activar) => {
  try {
    const modo = activar ? 'ACTIVAR (HDMI Play)' : 'LIBERAR (HDMI 1)'
    console.log(`[${modo}] Ejecutando en ${c.nombre || 'Consola #' + c.id}...`)
    const res = await controlarTv(c, activar)
    console.log(`[EXITO] ${c.nombre || 'Consola #' + c.id}:`, res ? (res.stdout || 'Comando enviado') : 'Comando enviado')
  } catch (err) {
    console.error(`[ERROR ACCION] ${c.nombre || 'Consola #' + c.id}:`, err.message || err)
  }
}

/* ---------- ESCUCHA EN TIEMPO REAL ---------- */
const prev = new Map()
const { data: inicial } = await sb.from('consolas').select('id,estado,nombre,ip_tv')
if (inicial) {
  inicial.forEach((c) => prev.set(c.id, c.estado))
}

sb.channel('consolas-watch')
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'consolas' }, ({ new: c }) => {
    const was = prev.get(c.id)
    prev.set(c.id, c.estado)

    console.log(`[DB UPDATE] Consola ${c.id} (${c.nombre}) cambió de '${was}' a '${c.estado}'`)

    // 1. Cuando pasa a 'ocupada' (ya sea desde disponible o tras sumar tiempo) -> Va al Play
    if (c.estado === 'ocupada' && was !== 'ocupada') {
      accion(c, true)
    }
    
    // 2. Cuando pasa a 'disponible' o 'finalizado' -> Vuelve a HDMI 1
    if ((c.estado === 'disponible' || c.estado === 'finalizado') && was === 'ocupada') {
      accion(c, false)
    }
  })
  .subscribe((s) => console.log('Realtime Supabase:', s))

/* ---------- WATCHDOG + LATIDO ---------- */
setInterval(async () => {
  try {
    await sb.from('sistema').upsert({ clave: 'servidor_local', valor: new Date().toISOString() })

    const { data, error } = await sb.from('consolas').select('*').eq('estado', 'ocupada')
    if (error) {
      console.error('[WATCHDOG ERROR]', error.message)
      return
    }

    const ahora = Date.now()
    for (const c of data ?? []) {
      if (!c.tiempo_inicio || !c.minutos_totales) continue
      
      const fin = new Date(c.tiempo_inicio).getTime() + c.minutos_totales * 60000
      
      if (ahora >= fin) {
        console.log(`[TIEMPO AGOTADO] La consola ${c.nombre || c.id} cumplió su tiempo. Actualizando a finalizado...`)
        // Actualizamos a finalizado; el evento postgres_changes se encargará de mandar la orden de liberar la TV
        await sb.from('consolas').update({ estado: 'finalizado' }).eq('id', c.id).eq('estado', 'ocupada')
      }
    }
  } catch (err) {
    console.error('[WATCHDOG EXCEPTION]', err)
  }
}, 5000)