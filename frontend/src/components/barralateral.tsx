import { IconeFechar, IconeNovo } from "../icons/icons";

interface ConversaResumo {
  id: string
  titulo: string
} // fora do contrato atual: ajustar quando o endpoint de histórico existir

export default function BarraLateral(props: {
  aberta: boolean
  aoFechar: () => void
  aoNovaConversa: () => void
  conversas: ConversaResumo[]
}) {
  const { aberta, aoFechar, aoNovaConversa, conversas } = props
  return (
    <>
      <div
        onClick={aoFechar}
        className={`fixed inset-0 z-30 bg-slate-900/40 transition-opacity lg:hidden ${aberta ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        aria-hidden
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0 ${aberta ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Histórico de conversas"
      >
        <div className="flex items-start justify-between gap-2 px-4 py-4">
          <span className="text-sm font-semibold leading-snug text-slate-900">
            Earth System Trend Detective
          </span>
          <button
            type="button"
            onClick={aoFechar}
            className={`rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden focus-visible:outline-2 focus-visible:outline-teal-600`}
            aria-label="Fechar menu"
          >
            <IconeFechar />
          </button>
        </div>

        <div className="px-3">
          <button
            type="button"
            onClick={aoNovaConversa}
            className={`flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-600`}
          >
            <IconeNovo />
            Nova conversa
          </button>
        </div>

        <nav className="mt-4 flex-1 overflow-y-auto px-3 pb-4">
          {conversas.length === 0 ? (
            <p className="px-3 text-sm text-slate-600">
              Entre na sua conta para ver o histórico de conversas.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {conversas.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-600`}
                  >
                    {c.titulo}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>

        {/* TODO(login): ver passo 1 do fluxo no topo do ficheiro. */}
        <div className="space-y-2 border-t border-slate-200 p-3">
          <button
            type="button"
            className={`w-full rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-teal-600`}
          >
            Entrar
          </button>
          <button
            type="button"
            className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-600`}
          >
            Criar conta
          </button>
        </div>
      </aside>
    </>
  )
}