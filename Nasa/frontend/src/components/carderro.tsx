import type { DetalheErro } from '../utils/types'

export default function CartaoErro({
  erro,
  nomeDe,
  aoSugerir,
}: {
  erro: DetalheErro
  nomeDe: (id: string) => string
  aoSugerir: (s: string) => void
}) {
  return (
    <section
      role="alert"
      className="rounded-2xl border border-red-300 bg-red-50 p-4"
    >
      <p className="font-medium text-red-950">{erro.mensagem}</p>
      {erro.sugestoes && erro.sugestoes.length > 0 && (
        <div className="mt-3">
          <p className="text-sm text-red-950">Sugestões:</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {erro.sugestoes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => aoSugerir(s)}
                className={`rounded-full border border-red-300 bg-white px-3 py-1 text-sm text-red-950 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-teal-600`}
              >
                {nomeDe(s)}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
