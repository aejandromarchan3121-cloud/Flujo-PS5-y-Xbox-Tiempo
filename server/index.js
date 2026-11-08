import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { exec } from 'child_process'
import lgtv from 'lgtv2' // Si usas TVs LG con WebOS
import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Configuración de rutas para ES Modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

// 2. Configuración del Servidor Express y Base de Datos Local JSON (Fallback / Finanzas / Productos)
const app = express()
app.use(express.json())
app.use(cors())

const DATA_FILE = path.join(__dirname, 'data.json')

// Inicializar base de datos local JSON si no existe
if (!fs.existsSync(DATA_FILE)) {
  const initialData = {
    consoles: [
      { id: 1, name: 'PS5 - 01', status: 'libre', startTime: null, elapsedSeconds: 0, ratePerHour: 2 },
      { id: 2, name: 'Xbox - 01', status: 'libre', startTime: null, elapsedSeconds: 0, ratePerHour: 2 }
    ],
    products: [
      { id: 1, name: 'Bebida / Refresco', type: 'consumible', price: 1.5, stock: 20 },
      { id: 2, name: 'Paquete de Papitas', type: 'consumible', price: 1.0, stock: 15 },
      { id: 3, name: 'Alquiler de Auriculares', type: 'alquiler', price: 0.5, stock: 5 }
    ],
    salesHistory: [],
    dailyFinances: {}
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2))
}

const readData = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
const writeData = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))

// --- RUTAS DE API LOCAL PARA GESTIÓN, FINANZAS Y PRODUCTOS ---

// Obtener estado general local (consolas y productos)
app.get('/api/state', (req, res) => {
  res.json(readData())
})

// Registrar venta de productos o alquileres extra
app.post('/api/sales', (req, res) => {
  const { productId, quantity } = req.body
  const data = readData()
  const product = data.products.find(p => p.id === productId)

  if (!product || product.stock < quantity) {
    return res.status(400).json({ error: 'Producto no encontrado o stock insuficiente' })
  }

  product.stock -= quantity
  const totalSale = product.price * quantity
  const today = new Date().toISOString().split('T')[0]

  const saleRecord = {
    id: Date.now(),
    productName: product.name,
    quantity,
    total: totalSale,
    date: new Date().toISOString()
  }

  data.salesHistory.push(saleRecord)

  if (!data.dailyFinances[today]) {
    data.dailyFinances[today] = { totalConsoles: 0, totalProducts: 0, totalGeneral: 0 }
  }
  data.dailyFinances[today].totalProducts += totalSale
  data.dailyFinances[today].totalGeneral += totalSale

  writeData(data)
  res.json({ success: true, sale: saleRecord, products: data.products })
})

// Agregar nuevo producto / artículo de alquiler al inventario
app.post('/api/products', (req, res) => {
  const { name, type, price, stock } = req.body
  const data = readData()
  const newProduct = {
    id: Date.now(),
    name,
    type, // 'consumible' o 'alquiler'
    price: parseFloat(price),
    stock: parseInt(stock)
  }
  data.products.push(newProduct)
  writeData(data)
  res.json({ success: true, products: data.products })
})

// Eliminar producto del inventario
app.delete('/api/products/:id', (req, res) => {
  const data = readData()
  data.products = data.products.filter(p => p.id != req.params.id)
  writeData(data)
  res.json({ success: true, products: data.products })
})


// 3. Función para activar HDMI 2 en los Televisores (ADB / LGTV)
async function activarHDMI2(ipAddress) {
  return new Promise((resolve, reject) => {
    if (!ipAddress) return reject('IP no proporcionada')

    // Opción A: Comando genérico vía ADB (para Android TV / Google TV / Fire TV)
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

// 4. Heartbeat / Latido del Nodo Local hacia Supabase
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

// 5. Listener de Cambios en Tiempo Real (Supabase Realtime) para las Consolas y TVs
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

// 6. Inicializar el Servidor HTTP en el puerto 3000 (o el que dicte el entorno)
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🚀 [EXPRESS] Servidor corriendo y listo en http://localhost:${PORT}`)
})