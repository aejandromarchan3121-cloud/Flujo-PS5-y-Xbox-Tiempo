import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { exec } from 'child_process'
import lgtv from 'lgtv2' // Si usas TVs LG con WebOS

dotenv.config()

// 1. Inicialización de Supabase Client
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[SERVER ERROR] Faltan las variables de entorno de Supabase en el archivo .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

console.log('🚀 [SERVER] Servidor Local de Control TR1 Iniciado...')

// 2. Función para activar HDMI 2 en los Televisores (ADB / LGTV)
async function activarHDMI2(ipAddress) {
  return new Promise((resolve, reject) => {
    if (!ipAddress) return reject('IP no proporcionada')

    // Opción A: Comando genérico vía ADB (para Android TV / Google TV / Fire TV)
    // Conecta al dispositivo y envía la señal de entrada HDMI 2
    const adbCommand = `adb connect ${ipAddress}:5555 && adb -s ${ipAddress}:5555 shell input keyevent 243`

    exec(adbCommand, (error, stdout, stderr) => {
      if (!error) {
        console.log(`[ADB SUCCESS] HDMI 2 enviado exitosamente a ${ipAddress}`)
        return resolve(stdout)
      }

      // Opción B: Fallback / Alternativa si usas LG WebOS vía lgtv2
      console.log(`[ADB WARNING] Fallo ADB en ${ipAddress}, intentando protocolo LG WebOS...`)
      try {
        const lgtvClient = lgtv({ url: `ws://${ipAddress}:3000` })

        lgtvClient.on('connect', () => {
          lgtvClient.request('ssap://tv/switchInput', { inputId: 'HDMI_2' }, (err, res) => {
            lgtvClient.disconnect()
            if (err) return reject(err)
            resolve(res)
          })
        })

        lgtvClient.on('error', (err) => {
          reject(err)
        })
      } catch (lgErr) {
        reject(`Fallo en ADB y LGTV: ${stderr || error.message}`)
      }
    })
  })
}

// 3. Heartbeat / Latido del Nodo Local
// Actualiza en Supabase que el servidor local de la PC está activo
setInterval(async () => {
  try {
    await supabase.from('sistema').upsert({
      clave: 'servidor_local',
      valor: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
  } catch (err) {
    console.error('[HEARTBEAT ERROR] Error actualizando estado del nodo local:', err.message)
  }
}, 5000)

// 4. Listener de Cambios en Tiempo Real (Supabase Realtime)
supabase
  .channel('server-consolas-listen')
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'consolas' },
    async (payload) => {
      const consola = payload.new
      const consolaPrevia = payload.old

      // Transiciones que requieren activar el televisor:
      // A) Pasó de disponible/finalizado a OCUPADA
      const acabaDeOcuparse = consola.estado === 'ocupada' && consolaPrevia.estado !== 'ocupada'
      
      // B) Se activó explícitamente la modalidad de TIEMPO LIBRE / ABIERTO
      const seAbrioTiempoLibre = consola.tiempo_abierto && !consolaPrevia.tiempo_abierto

      if (acabaDeOcuparse || seAbrioTiempoLibre) {
        if (consola.ip_address) {
          console.log(`[RAPID-CONTROL] ⚡ Cambio detectado en ${consola.nombre}. Encendiendo y enviando a HDMI 2 (IP: ${consola.ip_address})...`)

          try {
            await activarHDMI2(consola.ip_address)
            console.log(`[RAPID-CONTROL] ✅ Pantalla ${consola.nombre} sincronizada correctamente.`)
          } catch (err) {
            console.error(`[RAPID-CONTROL] ❌ Error activando entrada en ${consola.nombre}:`, err)
          }
        } else {
          console.warn(`[RAPID-CONTROL] ⚠️ La consola ${consola.nombre} (ID: ${consola.id}) no tiene una 'ip_address' asignada en la base de datos.`)
        }
      }
    }
  )
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('📡 [REALTIME] Escuchando cambios en la tabla "consolas" de Supabase...')
    }
  })