import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { format, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Wallet, CreditCard, Users, TrendingUp, TrendingDown, DollarSign, CalendarDays } from 'lucide-react';
import { calculateAccountBalance, calculatePeopleDebts, calculateMonthSummary, calculateProjections } from './finance-calculations';
import { triggerAutoSync } from './GoogleSync';
import Loader from './components/Loader';

export default function Dashboard() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  const accounts = useLiveQuery(() => db.accounts.toArray());
  const transactions = useLiveQuery(() => db.transactions.toArray());
  const debts = useLiveQuery(() => db.debts.toArray());
  const fixedEntries = useLiveQuery(() => db.fixedEntries.toArray());

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedMonth(e.target.value);
  };

  if (accounts === undefined || transactions === undefined || debts === undefined || fixedEntries === undefined) {
    return <Loader />;
  }

  const accountBalances = accounts.map(acc => {
    const computedBalance = calculateAccountBalance(acc, transactions, debts);
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
    const accCredit = creditTxs.filter(t => t.accountId === account.id && !t.invoicePaid).reduce((sum, t) => sum + t.amount, 0);
    acc[account.name] = accCredit;
    return acc;
  }, {} as Record<string, number>);

  const handlePayInvoice = async (accountId: number, accountName: string, amount: number) => {
    const txsToMark = creditTxs.filter(t => t.accountId === accountId && !t.invoicePaid);
    if (txsToMark.length === 0) return;

    if (!confirm(`Confirmar o pagamento da fatura de ${accountName} no valor de ${formatBRL(amount)}?`)) return;

    await db.transaction('rw', db.transactions, async () => {
      // Create debit transaction
      await db.transactions.add({
        type: 'Expense',
        category: 'Fatura Cartão',
        description: `Fatura ${accountName} - ${format(selectedMonthDate, 'MM/yyyy')}`,
        amount: amount,
        accountId: accountId,
        paymentMethod: 'Débito',
        date: format(new Date(), 'yyyy-MM-dd'),
        updatedAt: new Date().toISOString()
      });

      // Mark all as paid
      await Promise.all(txsToMark.map(t => db.transactions.update(t.id!, { invoicePaid: true, updatedAt: new Date().toISOString() })));
    });

    triggerAutoSync();
  };

  const peopleDebts = calculatePeopleDebts(debts);
  const debtSummaries = Object.entries(peopleDebts).filter(([_, amount]) => amount !== 0);

  const { totalMonthIncome, totalMonthExpense, netMonth } = calculateMonthSummary(selectedMonthDate, transactions);

  const projections = calculateProjections(totalBalance, selectedMonthDate, transactions, fixedEntries, 6);

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
            <div key={acc.id} className="flex justify-between items-center mb-2 last:mb-0 border border-[var(--border-color)] p-3 rounded-lg">
              <div>
                <span className="text-secondary block text-sm">{acc.name}</span>
                <span className="text-red font-semibold">{formatBRL(faturasByAccount[acc.name])}</span>
              </div>
              <button 
                onClick={() => handlePayInvoice(acc.id!, acc.name, faturasByAccount[acc.name])}
                className="btn btn-outline text-xs px-2 py-1 border-green text-green hover:bg-green-500/10"
              >
                Pagar Fatura
              </button>
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

      <section className="card mb-8">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b border-[var(--border-color)] pb-2">
          <CalendarDays size={18} /> Projeção de Saldo (Próximos 6 meses)
        </h2>
        <div className="flex flex-col gap-3">
          {projections.map((proj, idx) => (
            <div key={idx} className="flex justify-between items-center pb-2 border-b border-[var(--border-color)] last:border-0 last:pb-0">
              <div>
                <p className="font-semibold text-sm capitalize">{format(proj.date, 'MMMM yyyy', { locale: ptBR })}</p>
                <div className="flex gap-3 mt-1">
                  <span className="text-xs text-green flex items-center gap-1"><TrendingUp size={12}/> {formatBRL(proj.incomes)}</span>
                  <span className="text-xs text-red flex items-center gap-1"><TrendingDown size={12}/> {formatBRL(proj.expenses)}</span>
                </div>
              </div>
              <span className={`font-bold ${proj.projectedBalance >= 0 ? 'text-green' : 'text-red'}`}>
                {formatBRL(proj.projectedBalance)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
