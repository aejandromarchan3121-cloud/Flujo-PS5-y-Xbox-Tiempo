import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { exec } from 'child_process'
import { promisify } from 'util'
import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const execAsync = promisify(exec)

// Configuración de rutas absolutas para ES Modules (Evita errores al iniciar con PM2)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Cargar el archivo .env apuntando exactamente a la carpeta server
dotenv.config({ path: path.join(__dirname, '.env') })

// 1. Inicialización de Supabase Client
// 1. Inicialización de Supabase Client (Con respaldo directo)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qesklhtslfucuahylhzb.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlc2tsaHRzbGZ1Y3VhaHlsaHpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5NzkzNTAsImV4cCI6MjEwOTU1NTM1MH0.8fum3Kd7LRz84ungaV2RpeLzSyN5vFLLCIScN2xhEAQ'
const CLIENT_URL = process.env.CLIENT_URL || 'https://flujo-ps5-y-xbox-tiempo.vercel.app'

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[SERVER ERROR] Faltan las variables de entorno de Supabase en el archivo .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

console.log('🚀 [SERVER] Servidor Local de Control TR1 Iniciado...')

// 2. Configuración del Servidor Express y Base de Datos Local JSON
const app = express()
app.use(express.json())
app.use(cors())

const DATA_FILE = path.join(__dirname, 'data.json')

if (!fs.existsSync(DATA_FILE)) {
  const initialData = {
    consolas: [
      { id: 1, name: 'PS5 - 01', status: 'libre', startTime: null, elapsedSeconds: 0, ratePerHour: 2 }
    ],
    products: [],
    salesHistory: [],
    dailyFinances: {}
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2))
}

const readData = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
const writeData = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))

app.get('/api/state', (req, res) => {
  res.json(readData())
})

// 3. Función ADB robusta para forzar HDMI 2 desde cualquier pantalla (Home, perfiles, apps, etc.)
async function gestionarTvAndroid(ipAddress, accion, consolaId) {
  if (!ipAddress) throw new Error('IP no proporcionada')
  const dev = `${ipAddress}:5555`

  try {
    await execAsync(`adb connect ${dev}`)
  } catch (err) {
    console.warn(`[ADB] No se pudo conectar a ${dev}:`, err.message)
  }

  if (accion === 'bloquear') {
    const url = `${CLIENT_URL}/pantalla/${consolaId}`
    const cmd = `adb -s ${dev} shell am start -a android.intent.action.VIEW -d "${url}"`
    await execAsync(cmd)
    console.log(`[ADB SUCCESS] Alerta de tiempo agotado enviada a ${dev}`)
  } 
  else if (accion === 'liberar') {
    console.log(`[ADB] Forzando cambio a HDMI 2 en Google TV Aiwa (${dev}) desde cualquier menú...`)
    
    try {
      // Paso 1: Enviar tecla HOME o KEYCODE_TV_INPUT para sacar el TV de la pantalla de perfiles/apps
      await execAsync(`adb -s ${dev} shell input keyevent 3`) // Keycode HOME
      await new Promise(r => setTimeout(r, 600)) // Pausa de 600ms

      // Paso 2: Lanzar el Intent directo al puerto HW2 (HDMI 2)
      const intentHdmi2 = 'content://android.media.tv/passthrough/com.mediatek.tvinput%2F.hdmi.HdmiInputService%2FHW2'
      await execAsync(`adb -s ${dev} shell am start -a android.intent.action.VIEW -d "${intentHdmi2}"`)
    } catch (e1) {
      try {
        // Paso 3 (Respaldo): Si el Intent falla, abrir menú de inputs y simular selección
        await execAsync(`adb -s ${dev} shell input keyevent 178`) // Menú de fuentes
        await new Promise(r => setTimeout(r, 500))
        await execAsync(`adb -s ${dev} shell input keyevent 20`)  // Bajar
        await execAsync(`adb -s ${dev} shell input keyevent 66`)  // Enter
      } catch (e2) {
        // Paso 4 (Último recurso): Keycode directo HDMI 2
        await execAsync(`adb -s ${dev} shell input keyevent 243`)
      }
    }
    
    console.log(`[ADB SUCCESS] Cambio forzado a HDMI 2 ejecutado en ${dev}`)
  }
}

// 4. Heartbeat / Latido del Nodo Local hacia Supabase
setInterval(async () => {
  try {
    await supabase.from('sistema').upsert({
      clave: 'servidor_local',
      valor: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
  } catch (err) {
    console.error('[HEARTBEAT ERROR] Error actualizando estado:', err.message)
  }
}, 5000)

// 5. Watchdog local para expirar tiempos de consolas ocupadas
setInterval(async () => {
  try {
    const { data, error } = await supabase.from('consolas').select('*').eq('estado', 'ocupada')
    if (error) return

    const ahora = Date.now()
    for (const c of data ?? []) {
      if (!c.tiempo_inicio || !c.minutos_totales) continue
      const fin = new Date(c.tiempo_inicio).getTime() + c.minutos_totales * 60000

      if (ahora >= fin) {
        console.log(`[TIEMPO AGOTADO] La consola ${c.nombre || c.id} cumplió su tiempo. Actualizando a finalizado...`)
        await supabase.from('consolas').update({ estado: 'finalizado' }).eq('id', c.id).eq('estado', 'ocupada')
      }
    }
  } catch (err) {
    console.error('[WATCHDOG ERROR]', err)
  }
}, 5000)

// 6. Listener de Cambios en Tiempo Real (Supabase Realtime)
supabase
  .channel('server-consolas-listen')
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'consolas' },
    async (payload) => {
      const consola = payload.new
      const consolaPrevia = payload.old

      // Si pasa a 'finalizado', bloqueamos mostrando el cartel de Vercel
      if (consola.estado === 'finalizado' && consolaPrevia.estado !== 'finalizado') {
        if (consola.ip_tv || consola.ip_address) {
          const ip = consola.ip_tv || consola.ip_address
          console.log(`[REALTIME] ⚡ Consola ${consola.nombre} finalizada. Abriendo cartel de tiempo en ${ip}...`)
          try {
            await gestionarTvAndroid(ip, 'bloquear', consola.id)
          } catch (err) {
            console.error(`[ERROR ADB] No se pudo notificar a la TV ${consola.nombre}:`, err.message)
          }
        }
      }

      // Si pasa de 'finalizado' a 'ocupada' (ej. le dan +15 min), liberamos la pantalla
      if (consolaPrevia.estado === 'finalizado' && consola.estado === 'ocupada') {
        if (consola.ip_tv || consola.ip_address) {
          const ip = consola.ip_tv || consola.ip_address
          console.log(`[REALTIME] ⚡ Consola ${consola.nombre} reanudada (+15 min). Restaurando HDMI en ${ip}...`)
          try {
            await gestionarTvAndroid(ip, 'liberar', consola.id)
          } catch (err) {
            console.error(`[ERROR ADB] No se pudo restaurar la TV ${consola.nombre}:`, err.message)
          }
        }
      }
    }
  )
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('📡 [REALTIME] Escuchando cambios en la tabla "consolas" de Supabase...')
    }
  })

// 7. Inicializar el Servidor HTTP
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🚀 [EXPRESS] Servidor corriendo y listo en http://localhost:${PORT}`)
})