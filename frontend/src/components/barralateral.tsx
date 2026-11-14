import { useState } from "react";
import { CONVERSAS } from "../utils/dados";
import { IconeFechar, IconeNovo } from "../icons/icons";

export default function BarraLateral({
  aberta,
  aoFechar,
}: {
  aberta: boolean;
  aoFechar: () => void;
}) {
  const [ativa, setAtiva] = useState("1");
  const grupos = Array.from(new Set(CONVERSAS.map((c) => c.grupo)));

  return (
    <>
      {/* fundo escurecido (só em telas pequenas) */}
      <div
        onClick={aoFechar}
        className={`fixed inset-0 z-30 bg-slate-900/40 transition-opacity lg:hidden ${
          aberta ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0 ${
          aberta ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Histórico de conversas"
      >
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-base font-semibold tracking-tight text-slate-900">
            Trend Detective
          </span>
          <button
            type="button"
            onClick={aoFechar}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-600 lg:hidden"
            aria-label="Fechar menu"
          >
            <IconeFechar />
          </button>
        </div>

        <div className="px-3">
          {/* bota */}
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-600"
          >
            <IconeNovo />
            Nova conversa
          </button>
        </div>

        <nav className="mt-4 flex-1 overflow-y-auto px-3 pb-4">
          {grupos.map((grupo) => (
            <div key={grupo} className="mb-4">
              <p className="px-3 pb-1 text-xs font-medium text-slate-500">{grupo}</p>
              <ul className="space-y-0.5">
                {CONVERSAS.filter((c) => c.grupo === grupo).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setAtiva(c.id)}
                      className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-teal-600 ${
                        ativa === c.id
                          ? "bg-teal-50 font-medium text-teal-900"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {c.titulo}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="space-y-2 border-t border-slate-200 p-3">
          <button
            type="button"
            className="w-full rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            Entrar
          </button>
          <button
            type="button"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-600"
          >
            Criar conta
          </button>
        </div>
      </aside>
    </>
  );
}