import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return (
    <main className="app-grain grid min-h-screen place-items-center bg-[#08090a] text-[#f1f0f4]">
      <div role="status" className="flex items-center gap-3 text-sm text-[#a3a2ad]">
        <LoaderCircle size={19} className="animate-spin text-[#c6ff3d]" />
        Carregando seu espaço...
      </div>
    </main>
  );
}