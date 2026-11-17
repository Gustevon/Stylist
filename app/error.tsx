"use client";

import { RefreshCw } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="app-grain grid min-h-screen place-items-center bg-[#08090a] px-5 text-[#f1f0f4]">
      <section role="alert" className="max-w-md text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#c6ff3d]">Algo não saiu como esperado</p>
        <h1 className="mt-3 font-display text-3xl">Não foi possível carregar esta tela.</h1>
        <p className="mt-3 text-sm leading-6 text-[#a3a2ad]">Tente novamente. Se o problema continuar, atualize a página.</p>
        <button type="button" onClick={reset} className="mx-auto mt-6 flex h-10 items-center gap-2 bg-[#c6ff3d] px-4 text-xs font-semibold text-[#090a0c]">
          <RefreshCw size={14} />Tentar novamente
        </button>
      </section>
    </main>
  );
}