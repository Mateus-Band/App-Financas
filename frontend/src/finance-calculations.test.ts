import { describe, it, expect } from 'vitest';
import { 
  calculateAccountBalance, 
  calculatePeopleDebts, 
  calculateMonthSummary, 
  calculateProjections 
} from './finance-calculations';
import type { Account, Transaction, Debt, FixedEntry } from './db';

describe('Finance Calculations', () => {
  it('calculates account balance correctly', () => {
    const acc: Account = { id: 1, name: 'Bank', balance: 1000 };
    const transactions: Transaction[] = [
      { id: 1, accountId: 1, type: 'Income', amount: 500, date: '2026-08-10', category: '', description: '' },
      { id: 2, accountId: 1, type: 'Expense', amount: 200, paymentMethod: 'Débito', date: '2026-08-11', category: '', description: '' },
      { id: 3, accountId: 1, type: 'Expense', amount: 150, paymentMethod: 'Crédito', date: '2026-08-12', category: '', description: '' }, // Shouldn't debit instantly
    ];
    const debts: Debt[] = [
      { id: 1, accountId: 1, type: 'Borrowed', amount: 300, personName: 'John', date: '2026-08-13', description: '' }
    ];
    const fixedEntries: FixedEntry[] = [
      { id: 1, accountId: 1, type: 'Expense', amount: 100, name: 'Netflix', day: 10 }
    ];

    // Balance: 1000 (base) + 500 (income) - 200 (expense, debit) + 300 (borrowed entered account) - 100 (fixed exp)
    // Credit expense is ignored for instant balance calculation in this model
    const balance = calculateAccountBalance(acc, transactions, debts, fixedEntries);
    expect(balance).toBe(1000 + 500 - 200 + 300 - 100);
  });

  it('calculates people debts correctly', () => {
    const debts: Debt[] = [
      { accountId: 1, type: 'Lent', amount: 100, personName: 'John', date: '', description: '' },
      { accountId: 1, type: 'Paid', amount: 50, personName: 'John', date: '', description: '' }, // John paid me back? Wait, Paid means I paid them.
      { accountId: 1, type: 'Borrowed', amount: 200, personName: 'Mary', date: '', description: '' }
    ];
    // Lent -> they owe me (+100)
    // Paid -> they owe me more (+50) [Wait, if I Lent them, they owe me. If I Paid them, they owe me. In our app, Lent = I gave them money, Paid = I gave them money]
    
    const summaries = calculatePeopleDebts(debts);
    expect(summaries['John']).toBe(150);
    expect(summaries['Mary']).toBe(-200);
  });

  it('calculates month summary respecting selectedMonth and startDate', () => {
    const txs: Transaction[] = [
      { accountId: 1, type: 'Income', amount: 1000, date: '2026-08-15', category: '', description: '' },
      { accountId: 1, type: 'Expense', amount: 200, date: '2026-09-05', category: '', description: '' }
    ];
    const fixed: FixedEntry[] = [
      { accountId: 1, type: 'Expense', amount: 150, name: 'Gym', day: 5, startDate: '2026-09-01' }
    ];

    const augSummary = calculateMonthSummary(new Date('2026-08-10'), txs, fixed);
    expect(augSummary.totalMonthIncome).toBe(1000);
    expect(augSummary.totalMonthExpense).toBe(0); // Gym hasn't started yet!

    const sepSummary = calculateMonthSummary(new Date('2026-09-10'), txs, fixed);
    expect(sepSummary.totalMonthIncome).toBe(0);
    expect(sepSummary.totalMonthExpense).toBe(350); // 200 (var) + 150 (fixed Gym)
  });

  it('calculates future projections correctly', () => {
    const txs: Transaction[] = [
      { accountId: 1, type: 'Expense', amount: 100, date: '2026-09-10', category: '', description: '' }
    ];
    const fixed: FixedEntry[] = [
      { accountId: 1, type: 'Income', amount: 500, name: 'Salary', day: 1, startDate: '2026-08-01' }
    ];

    const projections = calculateProjections(1000, new Date('2026-08-15'), txs, fixed, 2);
    
    // Proj 1: Sep 2026
    // Base: 1000 + 500 (Salary) - 100 (Expense) = 1400
    expect(projections[0].projectedBalance).toBe(1400);

    // Proj 2: Oct 2026
    // Prev: 1400 + 500 (Salary) - 0 = 1900
    expect(projections[1].projectedBalance).toBe(1900);
  });
});
