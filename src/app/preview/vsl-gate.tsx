'use client'

import { useRef, useState } from 'react'

const VSL_URL =
  'https://kpdphzvmrgyruojntjpg.supabase.co/storage/v1/object/public/media/NutriPlan%20-%20VSL.mp4'

export function VslGate({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  function handlePlay() {
    videoRef.current?.play()
    setPlaying(true)
  }

  return (
    <>
      {!revealed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="relative w-full max-w-[360px] px-4">
            <video
              ref={videoRef}
              src={VSL_URL}
              className="w-full rounded-2xl"
              onEnded={() => setRevealed(true)}
              onContextMenu={(e) => e.preventDefault()}
              playsInline
            />
            {!playing && (
              <button
                onClick={handlePlay}
                className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl bg-black/50"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary shadow-[0_0_30px_rgba(34,108,69,0.6)]">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-white drop-shadow">
                  Ver mi plan personalizado
                </p>
              </button>
            )}
          </div>
        </div>
      )}
      <div className={revealed ? '' : 'hidden'}>{children}</div>
    </>
  )
}
