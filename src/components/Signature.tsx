import { useRef, useState } from 'react'
import { useAppStore } from '../store'

const W = 480, H = 160

// A member stores their signature once, by drawing it or uploading an image. Signing then just uses it.
export function SignatureModal({ onClose }: { onClose: () => void }) {
  const { currentUser, updateMember } = useAppStore()
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  if (!currentUser) return null

  const ctx = () => canvas.current!.getContext('2d')!
  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect()
    return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)] as const
  }
  const start = (e: React.PointerEvent) => {
    drawing.current = true
    canvas.current!.setPointerCapture(e.pointerId)
    const c = ctx(); c.lineWidth = 2.5; c.lineCap = 'round'; c.strokeStyle = '#0B0B0B'
    c.beginPath(); c.moveTo(...point(e))
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    const c = ctx(); c.lineTo(...point(e)); c.stroke(); setHasInk(true)
  }
  const clear = () => { ctx().clearRect(0, 0, W, H); setHasInk(false) }
  const upload = (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        clear()
        const scale = Math.min(W / img.width, H / img.height)
        ctx().drawImage(img, (W - img.width * scale) / 2, (H - img.height * scale) / 2, img.width * scale, img.height * scale)
        setHasInk(true)
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  }
  const save = () => {
    updateMember({ ...currentUser, signature: { image: canvas.current!.toDataURL('image/png'), at: new Date().toISOString() } })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-float w-full max-w-lg p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-ink">{currentUser.signature ? 'Change your signature' : 'Store your signature'}</h2>
          <p className="text-sm text-slate-400">Draw it below or upload an image. It is used whenever you press Sign. Only you can set it.</p>
        </div>
        {currentUser.signature && !hasInk && (
          <div className="text-xs text-slate-500">Current: <img src={currentUser.signature.image} alt="Your stored signature" className="inline-block h-10 align-middle" /></div>
        )}
        <canvas ref={canvas} width={W} height={H} onPointerDown={start} onPointerMove={move} onPointerUp={() => { drawing.current = false }}
          aria-label="Signature drawing area" className="w-full rounded-2xl border border-dashed border-slate-600 bg-white touch-none cursor-crosshair" />
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm font-semibold text-coral-dark cursor-pointer hover:underline">
            Upload an image<input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          </label>
          <button onClick={clear} disabled={!hasInk} className="text-sm text-slate-400 hover:text-ink disabled:opacity-40">Clear</button>
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-full bg-slate-800 text-slate-200 text-sm font-semibold">{currentUser.signature ? 'Cancel' : 'Later'}</button>
            <button onClick={save} disabled={!hasInk} className="px-5 py-2 rounded-full bg-ink hover:bg-ink-soft disabled:opacity-40 text-white text-sm font-semibold">Save signature</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Asks a project member without a stored signature for one, once per sign-in session
export function SignaturePrompt() {
  const currentUser = useAppStore((s) => s.currentUser)
  const key = `itp-signature-later-${currentUser?.id}`
  const [dismissed, setDismissed] = useState(() => { try { return !!sessionStorage.getItem(key) } catch { return false } })
  if (!currentUser || currentUser.role === 'it' || currentUser.signature || !currentUser.projectIds.length || dismissed) return null
  return <SignatureModal onClose={() => { try { sessionStorage.setItem(key, '1') } catch { /* storage unavailable */ } setDismissed(true) }} />
}
