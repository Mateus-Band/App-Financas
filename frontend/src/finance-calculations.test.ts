import { describe, it, expect } from 'vitest';
import { 
  calculateAccountBalance, 
  calculatePeopleDebts, 
  calculateMonthSummary, 
  calculateProjections,
  projectFixedEntriesForMonth,
  calculateCategoryBreakdown
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

    // Balance: 1000 (base) + 500 (income) - 200 (expense, debit) + 300 (borrowed entered account)
    // Credit expense is ignored for instant balance calculation in this model
    const balance = calculateAccountBalance(acc, transactions, debts);
    expect(balance).toBe(1000 + 500 - 200 + 300);
  });

  it('calculates account balance ignoring entries before balanceAsOf', () => {
    const acc: Account = { id: 1, name: 'Bank', balance: 1500, balanceAsOf: '2026-08-15' };
    const transactions: Transaction[] = [
      { id: 1, accountId: 1, type: 'Income', amount: 500, date: '2026-08-10', category: '', description: 'Old Income' },
      { id: 2, accountId: 1, type: 'Expense', amount: 200, paymentMethod: 'Débito', date: '2026-08-16', category: '', description: 'New Expense' }
    ];
    
    // Balance: 1500 (base from 15th) - 200 (expense on 16th). The 500 income from the 10th should be ignored.
    const balance = calculateAccountBalance(acc, transactions, []);
    expect(balance).toBe(1500 - 200);
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

    const augSummary = calculateMonthSummary(new Date('2026-08-10'), txs);
    expect(augSummary.totalMonthIncome).toBe(1000);
    expect(augSummary.totalMonthExpense).toBe(0);

    const sepSummary = calculateMonthSummary(new Date('2026-09-10'), txs);
    expect(sepSummary.totalMonthIncome).toBe(0);
    expect(sepSummary.totalMonthExpense).toBe(200);

    // Test projectFixedEntriesForMonth instead of calculateMonthSummary for fixed
    const { monthFixedExpenses } = projectFixedEntriesForMonth(fixed, new Date('2026-09-10'));
    expect(monthFixedExpenses).toBe(150);

    // Test with a full ISO string (what the buggy UI generated)
    const fixedISO: FixedEntry[] = [
      { accountId: 1, type: 'Expense', amount: 50, name: 'Spotify', day: 5, startDate: '2026-08-17T18:32:10.482Z' }
    ];
    const { monthFixedExpenses: augISOExp } = projectFixedEntriesForMonth(fixedISO, new Date('2026-08-10'));
    expect(augISOExp).toBe(50); // Spotify started in Aug
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
    // Base: 1000 - 100 (Expense) = 900. Plus 500 (Salary) = 1400.
    // Wait, the projection base calculation changed to just baseBalance + projIncome - projExpense.
    expect(projections[0].projectedBalance).toBe(1400);

    // Proj 2: Oct 2026
    // Prev: 1400 + 500 (Salary) - 0 = 1900
    expect(projections[1].projectedBalance).toBe(1900);
  });

  it('calculates category breakdown correctly', () => {
    const txs: Transaction[] = [
      { accountId: 1, type: 'Expense', amount: 100, date: '2026-08-10', category: 'Lazer', description: '' },
      { accountId: 1, type: 'Expense', amount: 300, date: '2026-08-11', category: 'Mercado', description: '' },
      { accountId: 1, type: 'Expense', amount: 100, date: '2026-08-12', category: 'Lazer', description: '' },
      { accountId: 1, type: 'Income', amount: 500, date: '2026-08-13', category: 'Salário', description: '' }, // Should be ignored
      { accountId: 1, type: 'Expense', amount: 50, date: '2026-09-10', category: 'Mercado', description: '' } // Wrong month, ignored
    ];

    const breakdown = calculateCategoryBreakdown(txs, new Date('2026-08-15'));
    
    expect(breakdown).toHaveLength(2);
    // Mercado: 300 (60%)
    // Lazer: 200 (40%)
    expect(breakdown[0].category).toBe('Mercado');
    expect(breakdown[0].amount).toBe(300);
    expect(breakdown[0].percentage).toBe(60);

    expect(breakdown[1].category).toBe('Lazer');
    expect(breakdown[1].amount).toBe(200);
    expect(breakdown[1].percentage).toBe(40);
  });
});
