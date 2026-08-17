import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { ArrowLeft, Search, Filter, Trash2, Edit2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import Loader from './components/Loader';

export default function HistoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  
  const transactions = useLiveQuery(() => db.transactions.toArray());
  const debts = useLiveQuery(() => db.debts.toArray());
  const accounts = useLiveQuery(() => db.accounts.toArray());

  if (transactions === undefined || debts === undefined || accounts === undefined) return <Loader />;

  const allItems = [
    ...transactions.map(t => ({ ...t, isDebt: false })),
    ...debts.map(d => ({ ...d, isDebt: true, category: d.type === 'Lent' ? 'Empréstimo (Dei)' : d.type === 'Borrowed' ? 'Empréstimo (Peguei)' : d.type === 'Received' ? 'Recebimento' : 'Pagamento de Dívida', type: (d.type === 'Lent' || d.type === 'Paid') ? 'Expense' : 'Income' }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filtered = allItems.filter(t => {
    if (typeFilter !== 'All' && t.type !== typeFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const descMatch = t.description.toLowerCase().includes(term);
      const catMatch = t.category.toLowerCase().includes(term);
      if (!descMatch && !catMatch) return false;
    }
    return true;
  });

  const formatBRL = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleDelete = async (id: number, isDebt: boolean, isInstallment?: boolean, groupId?: string) => {
    if (isInstallment && groupId) {
      const option = confirm('Deseja apagar APENAS esta parcela (OK) ou TODAS as parcelas deste grupo (Cancelar)?');
      if (option) {
        await db.transactions.delete(id);
      } else {
        const toDelete = await db.transactions.where({ installmentGroupId: groupId }).primaryKeys();
        await db.transactions.bulkDelete(toDelete as number[]);
      }
    } else {
      if (confirm('Tem certeza que deseja apagar este lançamento?')) {
        if (isDebt) await db.debts.delete(id);
        else await db.transactions.delete(id);
      }
    }
  };

  return (
    <div className="mb-20">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="p-2 -ml-2 rounded-full hover:bg-[var(--surface-hover)]">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold">Histórico Completo</h1>
      </div>

      <div className="card mb-6 flex flex-col gap-4">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-3.5 text-secondary" />
          <input 
            type="text" 
            placeholder="Buscar descrição ou categoria..." 
            className="input-field pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-secondary" />
          <select 
            className="input-field py-2 text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="All">Todos os tipos</option>
            <option value="Income">Apenas Receitas</option>
            <option value="Expense">Apenas Despesas</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <p className="text-secondary text-center py-8">Nenhum lançamento encontrado.</p>
        ) : (
          filtered.map(t => (
            <div key={t.id} className="card flex justify-between items-center py-4">
              <div>
                <p className="font-semibold text-sm">{t.description}</p>
                <p className="text-xs text-secondary mt-1">
                  {format(new Date(t.date), 'dd/MM/yyyy')} • {accounts.find(a => a.id === t.accountId)?.name}
                  {(t as any).isInstallment && ` (${(t as any).currentInstallment}/${(t as any).installmentCount})`}
                </p>
                <p className="text-xs bg-[var(--surface-hover)] px-2 py-0.5 rounded inline-block mt-2">
                  {t.category}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className={`font-semibold ${t.type === 'Income' ? 'text-green' : 'text-red'}`}>
                  {t.type === 'Income' ? '+' : '-'}{formatBRL(t.amount)}
                </span>
                <Link
                  to={`/new?edit=${t.id}&isDebt=${t.isDebt}`}
                  className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-full"
                >
                  <Edit2 size={16} />
                </Link>
                <button 
                  onClick={() => handleDelete(t.id!, t.isDebt, (t as any).isInstallment, (t as any).installmentGroupId)}
                  className="p-2 text-red hover:bg-red-500/10 rounded-full"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
