import dotenv from 'dotenv'
import path from 'node:path'
dotenv.config({ path: path.resolve(process.cwd(), '.env') })
import fs from 'node:fs'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import lgtv2 from 'lgtv2'

const sh = promisify(exec)
const sb = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY
)
const KEYS_FILE = './lg-keys.json'
const keys = fs.existsSync(KEYS_FILE) ? JSON.parse(fs.readFileSync(KEYS_FILE)) : {}

// Configuración de pantallas por ID (1-4: LG, 5-8: Android)
const TV = {
  1: { driver: 'lg', hdmi: 'HDMI_1' }, 2: { driver: 'lg', hdmi: 'HDMI_1' },
  3: { driver: 'lg', hdmi: 'HDMI_1' }, 4: { driver: 'lg', hdmi: 'HDMI_1' },
  5: { driver: 'android' },             6: { driver: 'android' },
  7: { driver: 'android' },             8: { driver: 'android' },
}

/* ---------- MÉTODO 1: comando a la TV ---------- */
const lgCall = (ip, uri, payload) => new Promise((ok, fail) => {
  const tv = lgtv2({
    url: `ws://${ip}:3000`, timeout: 5000, reconnect: false,
    clientKey: keys[ip],
    saveKey: (k, cb) => { keys[ip] = k; fs.writeFileSync(KEYS_FILE, JSON.stringify(keys)); cb() },
  })
  tv.on('error', fail)
  tv.on('connect', () => tv.request(uri, payload, (e, r) => { tv.disconnect(); e ? fail(e) : ok(r) }))
})

async function metodo1(c, lock) {
  const cfg = TV[c.id] || { driver: 'none' }
  const url = `${process.env.CLIENT_URL}/pantalla/${c.id}`
  
  if (cfg.driver === 'lg') {
    return lock
      ? lgCall(c.ip_tv, 'ssap://system.launcher/open', { target: url })
      : lgCall(c.ip_tv, 'ssap://tv/switchInput', { inputId: cfg.hdmi })
  }
  
  if (cfg.driver === 'android' && c.ip_tv) {
    const dev = `${c.ip_tv}:5555`
    try {
      await sh(`adb connect ${dev}`)
    } catch (e) {
      console.warn(`[ADB] No se pudo conectar a ${dev}:`, e.message)
    }
    
    return lock
      ? sh(`adb -s ${dev} shell am start -a android.intent.action.VIEW -d "${url}"`)
      : sh(`adb -s ${dev} shell input keyevent 243`) // KEYCODE_TV_INPUT_HDMI_1
  }
}

// Acción controlada para evitar caídas del proceso
const accion = async (c, lock) => {
  try {
    console.log(`[${lock ? 'BLOQUEO' : 'LIBERAR'}] Ejecutando en ${c.nombre || 'Consola #' + c.id}...`)
    const res = await metodo1(c, lock)
    console.log(`[EXITO] ${c.nombre || 'Consola #' + c.id}:`, res || 'Comando enviado')
  } catch (err) {
    console.error(`[ERROR ACCION] ${c.nombre || 'Consola #' + c.id}:`, err.message || err)
  }
}

/* ---------- ESCUCHA EN TIEMPO REAL ---------- */
const prev = new Map()
const { data: inicial } = await sb.from('consolas').select('id,estado')
if (inicial) {
  inicial.forEach((c) => prev.set(c.id, c.estado))
}

sb.channel('consolas-watch')
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'consolas' }, ({ new: c }) => {
    const was = prev.get(c.id)
    prev.set(c.id, c.estado)

    console.log(`[DB UPDATE] Consola ${c.id} (${c.nombre}) cambió de '${was}' a '${c.estado}'`)

    // Si pasa a finalizado y antes no lo estaba
    if (c.estado === 'finalizado' && was !== 'finalizado') {
      accion(c, true)
    }
    
    // Si estaba finalizado y ahora pasa a ocupada (aquí entra cuando le das "+15 min" o inicias turno)
    if (was === 'finalizado' && c.estado === 'ocupada') {
      accion(c, false)
    }
  })
  .subscribe((s) => console.log('Realtime Supabase:', s))

/* ---------- WATCHDOG + LATIDO ---------- */
setInterval(async () => {
  try {
    // Latido del servidor local
    await sb.from('sistema').upsert({ clave: 'servidor_local', valor: new Date().toISOString() })

    // Buscar consolas ocupadas que tengan tiempo límite definido
    const { data, error } = await sb.from('consolas').select('*').eq('estado', 'ocupada')
    if (error) {
      console.error('[WATCHDOG ERROR]', error.message)
      return
    }

    const ahora = Date.now()
    for (const c of data ?? []) {
      if (!c.tiempo_inicio || !c.minutos_totales) continue
      
      const fin = new Date(c.tiempo_inicio).getTime() + c.minutos_totales * 60000
      
      // Si el tiempo actual sobrepasa el límite y sigue marcada como ocupada -> la pasamos a finalizado
      if (ahora >= fin) {
        console.log(`[TIEMPO AGOTADO] La consola ${c.nombre || c.id} cumplió su tiempo. Actualizando a finalizado...`)
        await sb.from('consolas').update({ estado: 'finalizado' }).eq('id', c.id).eq('estado', 'ocupada')
      }
    }
  } catch (err) {
    console.error('[WATCHDOG EXCEPTION]', err)
  }
}, 5000)