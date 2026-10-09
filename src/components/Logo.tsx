// Black rounded mark with a checklist glyph — the app logo
export default function Logo({ size = 44 }: { size?: number }) {
  return (
    <div className="rounded-2xl bg-ink flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg style={{ width: size * 0.55, height: size * 0.55 }} className="text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    </div>
  )
}
