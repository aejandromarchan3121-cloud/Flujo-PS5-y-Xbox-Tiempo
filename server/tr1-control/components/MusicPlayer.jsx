'use client'
import { useRef, useState, useEffect } from 'react'
import { Play, Pause, SkipForward, Volume2 } from 'lucide-react'

const TRACKS = [
  { t: 'TR1', src: '/audio/tr1.mp3' },
  { t: 'DANCE CRIP', src: '/audio/dance-crip.mp3' },
  { t: 'HOOD', src: '/audio/hood.mp3' },
]

export default function MusicPlayer() {
  const ref = useRef(null)
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [vol, setVol] = useState(0.6)

  useEffect(() => { if (ref.current) ref.current.volume = vol }, [vol])
  useEffect(() => { if (playing) ref.current?.play().catch(() => setPlaying(false)) }, [i, playing])

  const toggle = () => {
    if (playing) ref.current.pause(); else ref.current.play().catch(() => {})
    setPlaying(!playing)
  }
  const next = () => setI((i + 1) % TRACKS.length)

  return (
    <div className="cut flex items-center gap-3 border border-neon/40 bg-industrial/80 px-3 py-2 shadow-[0_0_18px_-8px_#FFE600]">
      <audio ref={ref} src={TRACKS[i].src} onEnded={next} />
      <div className="flex h-8 w-9 items-end gap-[3px]" aria-hidden>
        {[0, 0.2, 0.45, 0.1, 0.35].map((d, k) => (
          <span key={k} style={{ animationDelay: `${d}s` }}
            className={`w-[5px] bg-neon shadow-[0_0_6px_#FFE600] animate-eq ${playing ? '' : '[animation-play-state:paused]'} h-[15%]`} />
        ))}
      </div>
      <select value={i} onChange={(e) => setI(+e.target.value)}
        className="max-w-[130px] border border-zinc-600 bg-carbon px-2 py-1 font-display text-[11px] text-neon outline-none focus:border-neon">
        {TRACKS.map((t, k) => <option key={t.t} value={k}>{t.t}</option>)}
      </select>
      <button onClick={toggle} className="grid h-9 w-9 place-items-center bg-neon text-carbon transition hover:bg-gold active:scale-95" aria-label="Play/Pause">
        {playing ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <button onClick={next} className="grid h-9 w-9 place-items-center border border-neon/60 text-neon transition hover:bg-neon/10 active:scale-95" aria-label="Siguiente">
        <SkipForward size={18} />
      </button>
      <div className="hidden items-center gap-1 lg:flex">
        <Volume2 size={16} className="text-zinc-400" />
        <input type="range" min="0" max="1" step="0.05" value={vol} onChange={(e) => setVol(+e.target.value)} className="w-20 accent-[#FFE600]" />
      </div>
    </div>
  )
}