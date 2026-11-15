import { useEffect, useState } from 'react'
import { PASSOS } from '../utils/handlers'

export default function Carregando() {
  // A API não reporta progresso: os passos abaixo são apenas uma indicação visual (a análise pode levar 10–40 s).
  const [passo, setPasso] = useState(0)
  useEffect(() => {
    const id = setInterval(
      () => setPasso((p) => Math.min(p + 1, PASSOS.length - 1)),
      8000,
    )
    return () => clearInterval(id)
  }, [])
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-slate-200 bg-white p-4"
    >
      <ol className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        {PASSOS.map((p, i) => (
          <li
            key={p}
            className={`flex items-center gap-2 ${i === passo ? 'font-medium text-teal-900' : i < passo ? 'text-slate-600' : 'text-slate-400'}`}
          >
            <span
              className={`h-2 w-2 rounded-full ${i === passo ? 'animate-pulse bg-teal-600' : i < passo ? 'bg-slate-500' : 'bg-slate-300'}`}
              aria-hidden
            />
            {p}
          </li>
        ))}
      </ol>
    </div>
  )
}