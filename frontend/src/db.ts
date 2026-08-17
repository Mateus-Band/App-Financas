import 'dexie-export-import';
import Dexie, { type Table } from 'dexie';

export interface Account {
  id?: number;
  name: string;
  balance: number;
  balanceAsOf?: string;
  updatedAt?: string;
}

export interface Transaction {
  id?: number;
  date: string; // ISO String (e.g., '2026-08-14')
  type: 'Income' | 'Expense' | 'Debt';
  category: string;
  description: string;
  amount: number;
  accountId: number;
  paymentMethod?: 'Pix' | 'Crédito' | 'Débito' | 'Dinheiro';
  isInstallment?: boolean;
  installmentCount?: number;
  currentInstallment?: number;
  installmentGroupId?: string;
  personName?: string; // For debts
  updatedAt?: string;
}

export interface Debt {
  id?: number;
  personName: string;
  type: 'Lent' | 'Borrowed' | 'Received' | 'Paid';
  amount: number;
  description: string;
  date: string;
  accountId: number;
  updatedAt?: string;
}

export interface FixedEntry {
  id?: number;
  type: 'Income' | 'Expense';
  name: string;
  amount: number;
  day: number;
  accountId: number;
  startDate?: string;
  updatedAt?: string;
}

export class FinanceDatabase extends Dexie {
  accounts!: Table<Account, number>;
  transactions!: Table<Transaction, number>;
  debts!: Table<Debt, number>;
  fixedEntries!: Table<FixedEntry, number>;

  constructor() {
    super('FinanceDB');
    this.version(1).stores({
      accounts: '++id, name',
      transactions: '++id, date, type, accountId, paymentMethod, installmentGroupId',
      debts: '++id, personName, type, date',
      fixedEntries: '++id, type, day'
    });
    
    this.version(2).stores({
      accounts: '++id, name',
      transactions: '++id, date, type, accountId, paymentMethod, installmentGroupId',
      debts: '++id, personName, type, date',
      fixedEntries: '++id, type, day'
    }).upgrade(tx => {
      const now = new Date().toISOString();
      return Promise.all([
        tx.table('accounts').toCollection().modify(account => {
          account.updatedAt = now;
        }),
        tx.table('transactions').toCollection().modify(transaction => {
          transaction.updatedAt = now;
        }),
        tx.table('debts').toCollection().modify(debt => {
          debt.updatedAt = now;
        }),
        tx.table('fixedEntries').toCollection().modify(entry => {
          entry.updatedAt = now;
          entry.startDate = '2000-01-01'; // Padrão antigo para não sumir
        })
      ]);
    });

    this.version(3).stores({
      accounts: '++id, name',
      transactions: '++id, date, type, accountId, paymentMethod, installmentGroupId',
      debts: '++id, personName, type, date',
      fixedEntries: '++id, type, day'
    }).upgrade(tx => {
      return tx.table('accounts').toCollection().modify(account => {
        account.balanceAsOf = '2000-01-01';
      });
    });
  }
}

export const db = new FinanceDatabase();
