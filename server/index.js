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

// Mapa para recordar el último estado enviado a cada TV y evitar duplicados
const estadoTvEnviado = new Map();

/* ---------- CONTROL DE ADB / TV ---------- */
async function controlarTv(c, estadoActual) {
  const cfg = TV[c.id] || { driver: 'none' }
  const url = `${process.env.CLIENT_URL}/pantalla/${c.id}`
  
  if (cfg.driver === 'android' && c.ip_tv) {
    const dev = `${c.ip_tv}:5555`
    try {
      await sh(`adb connect ${dev}`)
    } catch (e) {
      console.warn(`[ADB] No se pudo conectar a ${dev}:`, e.message)
    }
    
    // Si la TV ya recibió la orden para este estado exacto, no la repetimos
    if (estadoTvEnviado.get(c.id) === estadoActual) {
      console.log(`[IGNORADO] La TV de ${c.nombre} ya procesó el estado '${estadoActual}'.`)
      return
    }
    
    // Si pasa a 'ocupada' (le diste 15m/30m) -> Cambia al HDMI 2
    if (estadoActual === 'ocupada') {
      console.log(`[HDMI 2] Ajustando navegación en Aiwa ${c.ip_tv}...`)
      estadoTvEnviado.set(c.id, estadoActual) // Guardamos que ya se envió
      return sh(`adb -s ${dev} shell input keyevent 178 && adb -s ${dev} shell input keyevent 20 && adb -s ${dev} shell input keyevent 20 && adb -s ${dev} shell input keyevent 66`)
    } 
    
    // Si pasa a 'disponible' o 'finalizado' -> Abre la URL web
    if (estadoActual === 'disponible' || estadoActual === 'finalizado') {
      console.log(`[URL WEB] Abriendo cartelera en TV ${c.ip_tv}...`)
      estadoTvEnviado.set(c.id, estadoActual) // Guardamos que ya se envió
      return sh(`adb -s ${dev} shell am start -a android.intent.action.VIEW -d "${url}"`)
    }
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
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'consolas' }, async ({ new: c }) => {
    const was = prev.get(c.id)
    prev.set(c.id, c.estado)

    console.log(`[DB UPDATE] Consola ${c.id} (${c.nombre}) cambió de '${was}' a '${c.estado}'`)

    // Si cambia de estado, ejecutamos el control de la TV mandándole el estado actual
    if (was !== c.estado) {
      await controlarTv(c, c.estado)
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