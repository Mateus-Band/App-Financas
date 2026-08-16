import { Loader2 } from 'lucide-react';

export default function Loader() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="animate-spin text-[var(--primary-color)]" size={32} />
      <p className="mt-4 text-secondary text-sm">Carregando dados...</p>
    </div>
  );
}
