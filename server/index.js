import dotenv from 'dotenv'
import path from 'node:path'
dotenv.config({ path: path.resolve(process.cwd(), '.env') })
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import lgtv2 from 'lgtv2'
import { RouterOSAPI } from 'node-routeros'

const sh = promisify(exec)
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const KEYS_FILE = './lg-keys.json'
const keys = fs.existsSync(KEYS_FILE) ? JSON.parse(fs.readFileSync(KEYS_FILE)) : {}

// Driver por consola: 'lg' | 'android' | 'none'  (hdmi = entrada donde está la consola)
const TV = {
  1: { driver: 'lg', hdmi: 'HDMI_1' }, 2: { driver: 'lg', hdmi: 'HDMI_1' },
  3: { driver: 'lg', hdmi: 'HDMI_1' }, 4: { driver: 'lg', hdmi: 'HDMI_1' },
  5: { driver: 'android' },            6: { driver: 'android' },
  7: { driver: 'android' },            8: { driver: 'android' },
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
  if (cfg.driver === 'android') {
    const dev = `${c.ip_tv}:5555`
    await sh(`adb connect ${dev}`)
    return lock
      ? sh(`adb -s ${dev} shell am start -a android.intent.action.VIEW -d "${url}"`)
      : sh(`adb -s ${dev} shell input keyevent 243`) // KEYCODE_TV_INPUT_HDMI_1
  }
}

/* ---------- MÉTODO 2: corte de red (MikroTik) ---------- */
const ros = async (fn) => {
  const c = new RouterOSAPI({ host: process.env.ROS_HOST, user: process.env.ROS_USER, password: process.env.ROS_PASS })
  await c.connect()
  try { return await fn(c) } finally { c.close() }
}
const LIST = 'consolas_bloqueadas'
async function metodo2(c, lock) {
  if (!process.env.ROS_HOST || !c.ip_consola) return
  if (lock) return ros((r) => r.write('/ip/firewall/address-list/add', [`=list=${LIST}`, `=address=${c.ip_consola}`, '=comment=tr1']))
  return ros(async (r) => {
    const rows = await r.write('/ip/firewall/address-list/print', [`?list=${LIST}`, `?address=${c.ip_consola}`])
    for (const x of rows) await r.write('/ip/firewall/address-list/remove', [`=.id=${x['.id']}`])
  })
}

const accion = (c, lock) =>
  Promise.allSettled([metodo1(c, lock), metodo2(c, lock)]).then((r) =>
    console.log(`[${lock ? 'BLOQUEO' : 'LIBERAR'}] ${c.nombre}`, r.map((x) => x.status).join('/')))

/* ---------- ESCUCHA EN TIEMPO REAL ---------- */
const prev = new Map()
const { data: inicial } = await sb.from('consolas').select('id,estado')
inicial.forEach((c) => prev.set(c.id, c.estado))

sb.channel('consolas-watch')
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'consolas' }, ({ new: c }) => {
    const was = prev.get(c.id); prev.set(c.id, c.estado)
    if (c.estado === 'finalizado' && was !== 'finalizado') accion(c, true)
    if (was === 'finalizado' && c.estado !== 'finalizado') accion(c, false)
  })
  .subscribe((s) => console.log('Realtime:', s))

/* ---------- WATCHDOG + LATIDO ---------- */
setInterval(async () => {
  await sb.from('sistema').upsert({ clave: 'servidor_local', valor: new Date().toISOString() })
  const { data } = await sb.from('consolas').select('*').eq('estado', 'ocupada').eq('tiempo_abierto', false)
  for (const c of data ?? []) {
    const fin = new Date(c.tiempo_inicio).getTime() + c.minutos_totales * 60000
    if (Date.now() >= fin) await sb.from('consolas').update({ estado: 'finalizado' }).eq('id', c.id).eq('estado', 'ocupada')
  }
}, 5000)