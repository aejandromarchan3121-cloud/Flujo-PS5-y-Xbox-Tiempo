import './globals.css'
import { Orbitron, Rajdhani } from 'next/font/google'

const display = Orbitron({ subsets: ['latin'], variable: '--font-display', weight: ['500', '700', '900'] })
const body = Rajdhani({ subsets: ['latin'], variable: '--font-body', weight: ['500', '600', '700'] })

export const metadata = { title: 'TR1 // CONTROL DE SALA' }

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  )
}