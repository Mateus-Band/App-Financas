import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { format, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Wallet, CreditCard, Users, TrendingUp, TrendingDown, DollarSign, Download } from 'lucide-react';

export default function Dashboard() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const transactions = useLiveQuery(() => db.transactions.toArray()) || [];
  const debts = useLiveQuery(() => db.debts.toArray()) || [];
  const fixedEntries = useLiveQuery(() => db.fixedEntries.toArray()) || [];

  const handleExport = async () => {
    try {
      const blob = await db.export();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finance-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    } catch (error) {
      console.error("Erro ao exportar", error);
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedMonth(e.target.value);
  };

  const accountBalances = accounts.map(acc => {
    const accTxs = transactions.filter(t => t.accountId === acc.id);
    const incomes = accTxs.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = accTxs.filter(t => t.type === 'Expense' && t.paymentMethod !== 'Crédito').reduce((sum, t) => sum + t.amount, 0);

    const accDebts = debts.filter(d => d.accountId === acc.id);
    const lent = accDebts.filter(d => d.type === 'Lent').reduce((sum, d) => sum + d.amount, 0);
    const borrowed = accDebts.filter(d => d.type === 'Borrowed').reduce((sum, d) => sum + d.amount, 0);
    const received = accDebts.filter(d => d.type === 'Received').reduce((sum, d) => sum + d.amount, 0);
    const paid = accDebts.filter(d => d.type === 'Paid').reduce((sum, d) => sum + d.amount, 0);

    const debtNet = borrowed + received - lent - paid;
    const fixedInc = fixedEntries.filter(f => f.accountId === acc.id && f.type === 'Income').reduce((sum, f) => sum + f.amount, 0);
    const fixedExp = fixedEntries.filter(f => f.accountId === acc.id && f.type === 'Expense').reduce((sum, f) => sum + f.amount, 0);

    const computedBalance = acc.balance + incomes + fixedInc - expenses - fixedExp + debtNet;

    return { ...acc, computedBalance };
  });

  const totalBalance = accountBalances.reduce((sum, acc) => sum + acc.computedBalance, 0);
  const selectedMonthDate = new Date(`${selectedMonth}-02`);
  const creditTxs = transactions.filter(t => {
    if (t.type !== 'Expense' || t.paymentMethod !== 'Crédito') return false;
    const txDate = new Date(t.date);
    return isSameMonth(txDate, selectedMonthDate);
  });

  const faturasByAccount = accounts.reduce((acc, account) => {
    const accCredit = creditTxs.filter(t => t.accountId === account.id).reduce((sum, t) => sum + t.amount, 0);
    acc[account.name] = accCredit;
    return acc;
  }, {} as Record<string, number>);

  const peopleDebts = debts.reduce((acc, debt) => {
    if (!acc[debt.personName]) acc[debt.personName] = 0;
    if (debt.type === 'Lent' || debt.type === 'Paid') acc[debt.personName] += debt.amount;
    if (debt.type === 'Borrowed' || debt.type === 'Received') acc[debt.personName] -= debt.amount;
    return acc;
  }, {} as Record<string, number>);

  const debtSummaries = Object.entries(peopleDebts).filter(([_, amount]) => amount !== 0);

  const currentMonthTxs = transactions.filter(t => isSameMonth(new Date(t.date), selectedMonthDate));
  const monthVarIncomes = currentMonthTxs.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0);
  const monthVarExpenses = currentMonthTxs.filter(t => t.type === 'Expense').reduce((sum, t) => sum + t.amount, 0);
  const monthFixedIncomes = fixedEntries.filter(f => f.type === 'Income').reduce((sum, f) => sum + f.amount, 0);
  const monthFixedExpenses = fixedEntries.filter(f => f.type === 'Expense').reduce((sum, f) => sum + f.amount, 0);

  const totalMonthIncome = monthVarIncomes + monthFixedIncomes;
  const totalMonthExpense = monthVarExpenses + monthFixedExpenses;
  const netMonth = totalMonthIncome - totalMonthExpense;

  const formatBRL = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <div className="mb-20">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Visão Geral</h1>
        <input 
          type="month"
          className="input-field" 
          style={{ width: 'auto', marginTop: 0, padding: '0.5rem 1rem' }}
          value={selectedMonth}
          onChange={handleMonthChange}
        />
      </div>

      <section className="mb-8">
        <div className="card mb-4" style={{ background: 'linear-gradient(135deg, var(--primary-color), #7c3aed)' }}>
          <h2 className="text-sm font-medium text-white/80 flex items-center gap-2">
            <Wallet size={16} /> Saldo Total Geral
          </h2>
          <p className="text-3xl font-bold mt-1 text-white">{formatBRL(totalBalance)}</p>
        </div>
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {accountBalances.map(acc => (
            <div key={acc.id} className="card" style={{ padding: '1rem' }}>
              <h3 className="text-xs text-secondary">{acc.name}</h3>
              <p className="font-semibold">{formatBRL(acc.computedBalance)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8 card">
        <h2 className="text-lg font-bold mb-4 border-b border-[var(--border-color)] pb-2">Resumo de {format(selectedMonthDate, 'MMMM', { locale: ptBR })}</h2>
        <div className="flex justify-between mb-2">
          <span className="flex items-center gap-2 text-secondary"><TrendingUp size={16} className="text-green" /> Receitas</span>
          <span className="text-green font-semibold">{formatBRL(totalMonthIncome)}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span className="flex items-center gap-2 text-secondary"><TrendingDown size={16} className="text-red" /> Despesas</span>
          <span className="text-red font-semibold">{formatBRL(totalMonthExpense)}</span>
        </div>
        <div className="flex justify-between mt-4 pt-2 border-t border-[var(--border-color)]">
          <span className="font-semibold">Saldo Líquido</span>
          <span className={`font-bold ${netMonth >= 0 ? 'text-green' : 'text-red'}`}>{formatBRL(netMonth)}</span>
        </div>
      </section>

      <section className="mb-8 card">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b border-[var(--border-color)] pb-2">
          <CreditCard size={18} /> Faturas Projetadas
        </h2>
        {accounts.filter(a => faturasByAccount[a.name] > 0).length === 0 ? (
          <p className="text-sm text-secondary">Nenhuma fatura para este mês.</p>
        ) : (
          accounts.filter(a => faturasByAccount[a.name] > 0).map(acc => (
            <div key={acc.id} className="flex justify-between mb-2 last:mb-0">
              <span className="text-secondary">{acc.name}</span>
              <span className="text-red font-semibold">{formatBRL(faturasByAccount[acc.name])}</span>
            </div>
          ))
        )}
      </section>

      <section className="mb-8 card">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b border-[var(--border-color)] pb-2">
          <Users size={18} /> Quem deve para quem
        </h2>
        {debtSummaries.length === 0 ? (
          <p className="text-sm text-secondary">Nenhuma dívida pendente.</p>
        ) : (
          debtSummaries.map(([person, amount]) => (
            <div key={person} className="flex justify-between mb-2 last:mb-0">
              <span className="text-secondary">{person}</span>
              {amount > 0 ? (
                <span className="text-green font-semibold text-sm bg-green-500/10 px-2 py-1 rounded">Deve-me {formatBRL(amount)}</span>
              ) : (
                <span className="text-red font-semibold text-sm bg-red-500/10 px-2 py-1 rounded">Devo-lhe {formatBRL(Math.abs(amount))}</span>
              )}
            </div>
          ))
        )}
      </section>

      <section className="card mb-8">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b border-[var(--border-color)] pb-2">
          <DollarSign size={18} /> Histórico Geral
        </h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-secondary">Nenhum lançamento registrado.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {[...transactions].reverse().slice(0, 10).map(t => (
              <div key={t.id} className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-sm">{t.description}</p>
                  <p className="text-xs text-secondary">
                    {format(new Date(t.date), 'dd/MM/yyyy')} • {accounts.find(a => a.id === t.accountId)?.name}
                    {t.isInstallment && ` (${t.currentInstallment}/${t.installmentCount})`}
                  </p>
                </div>
                <span className={`font-semibold ${t.type === 'Income' ? 'text-green' : 'text-red'}`}>
                  {t.type === 'Income' ? '+' : '-'}{formatBRL(t.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
