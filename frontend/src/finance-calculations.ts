import { isSameMonth, addMonths } from 'date-fns';
import type { Account, Transaction, Debt, FixedEntry } from './db';

// Extract balance for a single account
export function calculateAccountBalance(
  acc: Account,
  transactions: Transaction[],
  debts: Debt[],
  fixedEntries: FixedEntry[]
): number {
  const cutoffDate = acc.balanceAsOf || '2000-01-01';
  const accTxs = transactions.filter(t => t.accountId === acc.id && t.date >= cutoffDate);
  const accDebts = debts.filter(d => d.accountId === acc.id && d.date >= cutoffDate);

  const incomes = accTxs.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0);
  const expenses = accTxs.filter(t => t.type === 'Expense' && t.paymentMethod !== 'Crédito').reduce((sum, t) => sum + t.amount, 0);

  const lent = accDebts.filter(d => d.type === 'Lent').reduce((sum, d) => sum + d.amount, 0);
  const borrowed = accDebts.filter(d => d.type === 'Borrowed').reduce((sum, d) => sum + d.amount, 0);
  const received = accDebts.filter(d => d.type === 'Received').reduce((sum, d) => sum + d.amount, 0);
  const paid = accDebts.filter(d => d.type === 'Paid').reduce((sum, d) => sum + d.amount, 0);

  const debtNet = borrowed + received - lent - paid;
  
  const fixedInc = fixedEntries.filter(f => f.accountId === acc.id && f.type === 'Income').reduce((sum, f) => sum + f.amount, 0);
  const fixedExp = fixedEntries.filter(f => f.accountId === acc.id && f.type === 'Expense').reduce((sum, f) => sum + f.amount, 0);

  return acc.balance + incomes + fixedInc - expenses - fixedExp + debtNet;
}

export function calculatePeopleDebts(debts: Debt[]) {
  return debts.reduce((acc, debt) => {
    if (!acc[debt.personName]) acc[debt.personName] = 0;
    if (debt.type === 'Lent' || debt.type === 'Paid') acc[debt.personName] += debt.amount;
    if (debt.type === 'Borrowed' || debt.type === 'Received') acc[debt.personName] -= debt.amount;
    return acc;
  }, {} as Record<string, number>);
}

export function calculateMonthSummary(
  selectedMonthDate: Date,
  transactions: Transaction[],
  fixedEntries: FixedEntry[]
) {
  const currentMonthTxs = transactions.filter(t => isSameMonth(new Date(t.date), selectedMonthDate));
  const monthVarIncomes = currentMonthTxs.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0);
  const monthVarExpenses = currentMonthTxs.filter(t => t.type === 'Expense').reduce((sum, t) => sum + t.amount, 0);
  
  const activeFixedEntries = fixedEntries.filter(f => {
    // If it has no startDate, assume it's always active
    if (!f.startDate) return true;
    const start = f.startDate.includes('T') ? new Date(f.startDate) : new Date(f.startDate + 'T12:00:00');
    if (isNaN(start.getTime())) return true; // fallback
    // Compare year and month
    const startNum = start.getFullYear() * 12 + start.getMonth();
    const selectedNum = selectedMonthDate.getFullYear() * 12 + selectedMonthDate.getMonth();
    return startNum <= selectedNum;
  });

  const monthFixedIncomes = activeFixedEntries.filter(f => f.type === 'Income').reduce((sum, f) => sum + f.amount, 0);
  const monthFixedExpenses = activeFixedEntries.filter(f => f.type === 'Expense').reduce((sum, f) => sum + f.amount, 0);

  return {
    totalMonthIncome: monthVarIncomes + monthFixedIncomes,
    totalMonthExpense: monthVarExpenses + monthFixedExpenses,
    netMonth: (monthVarIncomes + monthFixedIncomes) - (monthVarExpenses + monthFixedExpenses)
  };
}

export interface ProjectionMonth {
  date: Date;
  label: string;
  incomes: number;
  expenses: number;
  projectedBalance: number;
}

export function calculateProjections(
  baseBalance: number,
  startMonthDate: Date,
  transactions: Transaction[],
  fixedEntries: FixedEntry[],
  monthsToProject: number = 6
): ProjectionMonth[] {
  let currentProjectedBalance = baseBalance;
  const projections: ProjectionMonth[] = [];

  for (let i = 1; i <= monthsToProject; i++) {
    const projDate = addMonths(startMonthDate, i);
    const { totalMonthIncome, totalMonthExpense } = calculateMonthSummary(projDate, transactions, fixedEntries);
    
    currentProjectedBalance += totalMonthIncome;
    currentProjectedBalance -= totalMonthExpense;

    projections.push({
      date: projDate,
      label: projDate.toISOString().slice(0, 7),
      incomes: totalMonthIncome,
      expenses: totalMonthExpense,
      projectedBalance: currentProjectedBalance
    });
  }

  return projections;
}
