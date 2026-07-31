export interface Expense {
  id: string;
  date: string;
  amount: number;
  category: string;
  description: string;
  accountId?: string;
}

export interface Account {
  id: string;
  name: string;
  balance: number;
}

export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  paid: boolean;
}

export interface VariableExpense {
  id: string;
  name: string;
  amount: number;
  paid: boolean;
  note?: string;
}

export interface RecoveryItem {
  id: string;
  name: string;
  amount: number;
  note?: string;
  recovered: boolean;
}

export interface MonthlyDataEntry {
  income: number;
  fixed: FixedExpense[];
  varExp: VariableExpense[];
  recover: RecoveryItem[];
}

export interface MonthlyData {
  [month: string]: MonthlyDataEntry;
}

export interface Settings {
  syncKey: string;
  firebaseConfig: string;
}

export interface Category {
  name: string;
  color: string;
}
