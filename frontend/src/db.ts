import 'dexie-export-import';
import Dexie, { type Table } from 'dexie';

export interface Account {
  id?: number;
  name: string;
  balance: number;
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
}

export interface Debt {
  id?: number;
  personName: string;
  type: 'Lent' | 'Borrowed' | 'Received' | 'Paid';
  amount: number;
  description: string;
  date: string;
  accountId: number;
}

export interface FixedEntry {
  id?: number;
  type: 'Income' | 'Expense';
  name: string;
  amount: number;
  day: number;
  accountId: number;
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
  }
}

export const db = new FinanceDatabase();
