import React, { useState, useEffect, useRef, useMemo } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/database';
import 'firebase/compat/auth';

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCs8VgAr7bQoxv5vIVrnfG5opPWa9eDkuE",
  authDomain: "auratracker-18242.firebaseapp.com",
  databaseURL: "https://auratracker-18242-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "auratracker-18242",
  storageBucket: "auratracker-18242.firebasestorage.app",
  messagingSenderId: "757820673078",
  appId: "1:757820673078:web:176d48e26e6be657d31c97"
};

if (firebase.apps.length === 0) {
  firebase.initializeApp(FIREBASE_CONFIG);
}
import type { 
  Expense, 
  Account, 
  FixedExpense, 
  VariableExpense, 
  RecoveryItem, 
  MonthlyData, 
  MonthlyDataEntry,
  Settings,
  Category
} from './types';

// ─── Constants ───────────────────────────────────────────────────────────────
const DEF_CATS: Category[] = [
  { name: "Food",       color: "#f97316" },
  { name: "Travel",     color: "#3b82f6" },
  { name: "Dineout",    color: "#ec4899" },
  { name: "Rent",       color: "#8b5cf6" },
  { name: "Utilities",  color: "#06b6d4" },
  { name: "Gold Plan",  color: "#f59e0b" },
  { name: "Education Loan", color: "#10b981" },
  { name: "Health Insurance", color: "#ef4444" },
  { name: "Life Insurance", color: "#6366f1" },
  { name: "Other",      color: "#64748b" }
];

const DEF_EXP: Expense[] = [
  { id: "p1",  date: "2026-07-01", amount: 4670,  category: "Rent",       description: "Rent Payment", accountId: "a1" },
  { id: "p2",  date: "2026-07-01", amount: 1500,  category: "Utilities",  description: "Electricity Bill", accountId: "a1" },
  { id: "p3",  date: "2026-07-05", amount: 450,   category: "Food",       description: "Lunch", accountId: "a1" },
  { id: "p4",  date: "2026-07-10", amount: 250,   category: "Travel",     description: "Taxi Ride", accountId: "a2" },
  { id: "p5",  date: "2026-07-12", amount: 1800,  category: "Dineout",    description: "Dinner with team", accountId: "a1" }
];

const DEF_ACC: Account[] = [
  { id: "a1", name: "Salary Account", balance: 144288 },
  { id: "a2", name: "Savings Account", balance: 17000 },
  { id: "a3", name: "Other Account", balance: 30000 }
];

const DEF_FIXED: FixedExpense[] = [
  { id: "f1", name: "Gold Scheme", amount: 20000, paid: false },
  { id: "f2", name: "Education Loan EMI", amount: 8000, paid: false },
  { id: "f3", name: "Rent", amount: 5000, paid: false },
  { id: "f4", name: "Health Insurance", amount: 5000, paid: true },
  { id: "f5", name: "Bills (Approx.)", amount: 5000, paid: true }
];

const DEF_VAR: VariableExpense[] = [
  { id: "v1", name: "Credit Card Bill", amount: 0, paid: false, note: "Add your bill amount" }
];

const DEF_RECOVER: RecoveryItem[] = [
  { id: "r1", name: "CH", amount: 33000, note: "July transfers (₹25k + ₹8k)", recovered: false },
  { id: "r2", name: "Friends Outing", amount: 0, note: "Amount not finalized yet", recovered: false }
];

const DEF_INCOME = 260600;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const CURRENCY_SYMBOL = "₹";
const inr = (n: number) => CURRENCY_SYMBOL + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const mapNameToCategory = (name: string) => {
  const s = name.toLowerCase();
  if (s.includes('gold')) return 'Gold Plan';
  if (s.includes('education') || s.includes('loan')) return 'Education Loan';
  if (s.includes('rent')) return 'Rent';
  if (s.includes('health')) return 'Health Insurance';
  if (s.includes('life')) return 'Life Insurance';
  return 'Other';
};
const ADMIN_KEY = "admin_hv";
const KEYS_DB_PATH = "aura_expense_tracker_keys";
const ROOT_DATA_PATH = "aura_expense_tracker";

const mk = (d: string) => d.slice(0, 7);
const fmtM = (k: string) => { 
  const [y, m] = k.split("-").map(Number); 
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" }); 
};
const shft = (k: string, d: number) => { 
  const [y, m] = k.split("-").map(Number);
  const dt = new Date(y, m - 1 + d, 1); 
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`; 
};
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

// LocalStorage helpers
function lsGet<T>(key: string, def: T): T { 
  try { 
    const v = localStorage.getItem(key); 
    return v ? JSON.parse(v) : def; 
  } catch { 
    return def; 
  } 
}
function lsSet<T>(key: string, val: T): void { 
  try { 
    localStorage.setItem(key, JSON.stringify(val)); 
  } catch {} 
}

// Firebase config parser


// ─── SVG Icons ───────────────────────────────────────────────────────────────
const icons: { [key: string]: string } = {
  wallet:    "M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z M16 3H8L6 7h12l-2-4z",
  plus:      "M12 5v14M5 12h14",
  trash:     "M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2",
  chevL:     "M15 18l-6-6 6-6",
  chevR:     "M9 18l6-6-6-6",
  x:         "M18 6L6 18M6 6l12 12",
  pencil:    "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  check:     "M20 6L9 17l-5-5",
  trending:  "M23 6l-9.5 9.5-5-5L1 18",
  dashboard: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  receipt:   "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  settings:  "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  share:     "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8 M16 6l-4-4-4 4 M12 2v13",
  copy:      "M9 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1 M20 6h-8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z",
  rotateCCW: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8 M3 3v5h5",
  lock:      "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z M7 11V7a5 5 0 0 1 10 0v4",
  key:       "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.778-7.778z M16.5 7.5L21 12m-2.25-2.25L16.5 7.5",
  plusCircle: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 8v8M8 12h8",
  eye:       "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  logOut:    "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
};

interface SvgIconProps {
  name: string;
  size?: number;
}

const SvgIcon: React.FC<SvgIconProps> = ({ name, size = 18 }) => {
  const d = icons[name];
  if (!d) return null;
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24"
      fill="none" 
      stroke="currentColor" 
      strokeWidth={2}
      strokeLinecap="round" 
      strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
    >
      <path d={d} />
    </svg>
  );
};

// ─── Mini Pie Chart ─────────────────────────────────────────────────────────
interface PieChartProps {
  data: { name: string; value: number; color: string }[];
  size?: number;
}

const PieChart: React.FC<PieChartProps> = ({ data, size = 160 }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return null;

  const cx = size / 2, cy = size / 2, r = size * 0.38, ir = size * 0.24;
  let angle = -Math.PI / 2;
  const slices = data.map(d => {
    const pct = d.value / total;
    const sweep = pct * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const xi1 = cx + ir * Math.cos(angle);
    const yi1 = cy + ir * Math.sin(angle);
    angle -= sweep;
    const xi2 = cx + ir * Math.cos(angle);
    const yi2 = cy + ir * Math.sin(angle);
    angle += sweep;
    const large = sweep > Math.PI ? 1 : 0;
    const pathD = [
      `M ${x1} ${y1}`,
      `A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
      `L ${xi1} ${yi1}`,
      `A ${ir} ${ir} 0 ${large} 0 ${xi2} ${yi2}`,
      "Z"
    ].join(" ");
    return { ...d, pathD, pct };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map(s => (
        <path key={s.name} d={s.pathD} fill={s.color} stroke="white" strokeWidth={1.5} />
      ))}
    </svg>
  );
};

// ─── UI Primitives ───────────────────────────────────────────────────────────
interface ModalProps {
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
  submitLabel?: string;
}

const Modal: React.FC<ModalProps> = ({ title, onClose, onSubmit, children, submitLabel = "Add" }) => {
  const sheetRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    // focus the first focusable element in the modal for accessibility
    const el = sheetRef.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>("button, input, select, textarea, [tabindex]:not([tabindex='-1'])");
    (first || el).focus();
  }, []);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-sheet" ref={sheetRef} tabIndex={-1}>
        <div className="flex items-center justify-between mb-4">
          <h3 id="modal-title" className="text-slate-800 font-bold text-lg">{title}</h3>
          <button aria-label="Close dialog" className="icon-btn text-slate-500 hover:text-indigo-600 transition-colors" onClick={onClose}>
            <SvgIcon name="x" size={20} />
          </button>
        </div>
        {children}
        <div className="flex gap-2.5 mt-4">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={onSubmit}>{submitLabel}</button>
        </div>
      </div>
    </div>
  );
};

interface CustomSelectProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
}

const CustomSelect: React.FC<CustomSelectProps> = ({ value, onChange, options }) => {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className="input-field appearance-none pr-8"
      >
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </div>
  );
};

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ label, children }) => {
  return (
    <div className="form-group">
      <label className="label">{label}</label>
      {children}
    </div>
  );
};

interface RupeeInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  isInvalid?: boolean;
}

const RupeeInput: React.FC<RupeeInputProps> = ({ value, onChange, placeholder = "0", isInvalid = false }) => {
  return (
    <div className="relative">
      <span className="input-prefix">{CURRENCY_SYMBOL}</span>
      <input
        type="number"
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`input-field pl-7 ${isInvalid ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200' : ''}`}
      />
    </div>
  );
};

interface PBarProps {
  done: number;
  total: number;
  color: string;
}

const PBar: React.FC<PBarProps> = ({ done, total, color }) => {
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  return (
    <div className="progress-bar">
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
};

interface SecProps {
  title: string;
  right?: React.ReactNode;
  warningMsg?: string;
  children: React.ReactNode;
}

const Sec: React.FC<SecProps> = ({ title, right, warningMsg, children }) => {
  return (
    <div className="mt-5">
      <div className="sec-header">
        <span className="sec-title">{title}</span>
        {right}
      </div>
      {warningMsg && (
        <div className="bg-rose-50 border border-rose-100 text-rose-600 rounded-xl px-3 py-2 text-xs font-medium mb-2">
          {warningMsg}
        </div>
      )}
      {children}
    </div>
  );
};

// ─── BRow ────────────────────────────────────────────────────────────────────
interface BRowProps {
  item: { id: string; name: string; amount: number; paid?: boolean; recovered?: boolean; note?: string };
  editId: string | null;
  editV: { name: string; amount: string; note?: string };
  setEditV: React.Dispatch<React.SetStateAction<{ name: string; amount: string; note?: string }>>;
  onToggle: () => void;
  onEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
  showNote?: boolean;
  newlyAddedId: string | null;
}

const BRow: React.FC<BRowProps> = ({ item, editId, editV, setEditV, onToggle, onEdit, onSave, onDelete, showNote = false, newlyAddedId }) => {
  const isE = editId === item.id;
  const isPaid = item.paid ?? item.recovered ?? false;
  const borderColor = isPaid ? "#10b981" : "#f97316";
  const isNew = item.id === newlyAddedId;

  return (
    <div className={`row-card ${isNew ? 'glow-item' : ''}`} style={{ borderLeftColor: borderColor, marginBottom: 8 }}>
      {isE ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={editV.name}
              placeholder="Name"
              onChange={e => setEditV(v => ({ ...v, name: e.target.value }))}
              className="input-field flex-1"
            />
            <div className="relative w-24">
              <span className="input-prefix text-xs">{CURRENCY_SYMBOL}</span>
              <input
                type="number"
                value={editV.amount}
                onChange={e => setEditV(v => ({ ...v, amount: e.target.value }))}
                className="input-field pl-5 w-full"
              />
            </div>
            <button 
              className="btn-primary" 
              style={{ width: '38px', padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
              onClick={onSave}
            >
              <SvgIcon name="check" size={14} />
            </button>
          </div>
          {showNote && (
            <input
              value={editV.note || ""}
              placeholder="Note (optional)"
              onChange={e => setEditV(v => ({ ...v, note: e.target.value }))}
              className="input-field"
            />
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button
              onClick={onToggle}
              className="check-circle"
              style={{ borderColor: isPaid ? "#10b981" : "#f97316", background: isPaid ? "#10b981" : "transparent" }}
            >
              {isPaid && <SvgIcon name="check" size={10} />}
            </button>
            <div className="min-w-0">
              <p className={`text-sm font-medium white-space-nowrap overflow-hidden text-ellipsis ${
                isPaid ? 'text-slate-400 line-through' : 'text-slate-800'
              }`}>
                {item.name}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px]" style={{ color: isPaid ? "#10b981" : "#f97316" }}>
                  {isPaid ? "Paid" : "Pending"}
                </span>
                {showNote && item.note && (
                  <span className="text-[11px] text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap">
                    · {item.note}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className={`text-sm font-semibold ${isPaid ? 'text-slate-400' : 'text-slate-800'}`}>
              {inr(item.amount)}
            </span>
            <button className="icon-btn" onClick={onEdit}>
              <SvgIcon name="pencil" size={13} />
            </button>
            <button className="icon-btn danger hover:text-red-500" onClick={onDelete}>
              <SvgIcon name="trash" size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── ExpTab ──────────────────────────────────────────────────────────────────
interface ExpTabProps {
  monthExp: Expense[];
  total: number;
  bycat: { name: string; value: number; color: string }[];
  setExp: React.Dispatch<React.SetStateAction<Expense[]>>;
  acc: Account[];
  setAcc: React.Dispatch<React.SetStateAction<Account[]>>;
  cats: Category[];
  setCats: React.Dispatch<React.SetStateAction<Category[]>>;
  month: string;
  newlyAddedId: string | null;
  showToast: (msg: string, type?: "success" | "error") => void;
}

const ExpTab: React.FC<ExpTabProps> = ({ 
  monthExp, 
  total, 
  bycat, 
  setExp, 
  acc,
  setAcc,
  cats,
  setCats,
  month,
  newlyAddedId, 
  showToast 
}) => {
  const getDefaultDate = (m: string) => {
    const today = new Date().toISOString().slice(0, 10);
    if (today.startsWith(m)) return today;
    return `${m}-01`;
  };

  const [show, setShow] = useState(false);
  const [form, setForm] = useState(() => ({
    amount: "",
    category: cats[0]?.name || "Other",
    description: "",
    date: getDefaultDate(month),
    accountId: acc[0]?.id || ""
  }));
  const [amountInvalid, setAmountInvalid] = useState(false);
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#3b82f6");

  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editForm, setEditForm] = useState({
    amount: "",
    category: "",
    description: "",
    date: "",
    accountId: ""
  });
  const [editAmountInvalid, setEditAmountInvalid] = useState(false);
  const [showEditAddCat, setShowEditAddCat] = useState(false);

  function startEdit(e: Expense) {
    setEditingExpense(e);
    setEditForm({
      amount: String(e.amount),
      category: e.category,
      description: e.description,
      date: e.date,
      accountId: e.accountId || ""
    });
    setEditAmountInvalid(false);
    setShowEditAddCat(false);
  }

  function saveEdit() {
    if (!editingExpense) return;
    const amt = parseFloat(editForm.amount);
    if (isNaN(amt) || amt <= 0) {
      setEditAmountInvalid(true);
      showToast("Please enter a valid amount greater than 0.", "error");
      return;
    }
    if (amt > 99999999) {
      setEditAmountInvalid(true);
      showToast("Amount is too large.", "error");
      return;
    }
    if (!editForm.date) {
      showToast("Please select a valid date.", "error");
      return;
    }
    const desc = editForm.description.trim() || editForm.category;
    if (desc.length > 50) {
      showToast("Description is too long.", "error");
      return;
    }

    setEditAmountInvalid(false);

    // Refund old
    if (editingExpense.accountId) {
      setAcc(prev => prev.map(a => a.id === editingExpense.accountId ? { ...a, balance: a.balance + editingExpense.amount } : a));
    }
    // Deduct new
    if (editForm.accountId) {
      setAcc(prev => prev.map(a => a.id === editForm.accountId ? { ...a, balance: a.balance - amt } : a));
    }

    // Update expense
    setExp(p => p.map(x => x.id === editingExpense.id ? {
      ...x,
      amount: amt,
      category: editForm.category,
      description: desc,
      date: editForm.date,
      accountId: editForm.accountId || undefined
    } : x));

    setEditingExpense(null);
    const targetM = mk(editForm.date);
    if (targetM !== month) {
      showToast(`Expense updated in ${fmtM(targetM)}!`, "success");
    } else {
      showToast("Expense updated successfully!", "success");
    }
  }

  function add() {
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) {
      setAmountInvalid(true);
      showToast("Please enter a valid amount greater than 0.", "error");
      return;
    }
    if (amt > 99999999) {
      setAmountInvalid(true);
      showToast(`Amount is too large (max ${CURRENCY_SYMBOL}9,99,99,999).`, "error");
      return;
    }
    if (!form.date) {
      showToast("Please select a valid date.", "error");
      return;
    }
    const desc = form.description.trim() || form.category;
    if (desc.length > 50) {
      showToast("Description is too long (max 50 chars).", "error");
      return;
    }

    setAmountInvalid(false);
    const newExpId = uid();
    setExp(p => [...p, { 
      id: newExpId, 
      amount: amt, 
      category: form.category, 
      description: desc, 
      date: form.date,
      accountId: form.accountId || undefined
    }]);

    // Deduct from selected account
    if (form.accountId) {
      setAcc(prev => prev.map(a => a.id === form.accountId ? { ...a, balance: a.balance - amt } : a));
    }

    setForm({ 
      amount: "", 
      category: cats[0]?.name || "Other", 
      description: "", 
      date: getDefaultDate(month),
      accountId: acc[0]?.id || ""
    });
    setShow(false);
    const targetM = mk(form.date);
    if (targetM !== month) {
      showToast(`Expense added to ${fmtM(targetM)}!`, "success");
    } else {
      showToast("Expense added successfully!", "success");
    }
  }

  function deleteExpense(e: Expense) {
    if (confirm(`Delete this expense of ${inr(e.amount)}?`)) {
      setExp(p => p.filter(x => x.id !== e.id));
      if (e.accountId) {
        setAcc(prev => prev.map(a => a.id === e.accountId ? { ...a, balance: a.balance + e.amount } : a));
      }
      showToast("Expense deleted.", "success");
    }
  }

  return (
    <div className="p-3">
      {/* Total Spent summary card */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-4 text-slate-800">
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Spent (Selected Month)</p>
        <p className="text-3xl font-extrabold my-1">{inr(total)}</p>
        <p className="text-slate-400 text-xs">{monthExp.length} transactions</p>
      </div>

      {/* Category pills */}
      {bycat.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-2 scrollbar-none">
          {bycat.map(c => (
            <div key={c.name} className="cat-pill shrink-0" style={{ background: c.color }}>
              <div>{c.name}</div>
              <div className="text-xs font-bold mt-0.5">{inr(c.value)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Pie Chart Card */}
      {bycat.length > 0 && (
        <div className="card p-3.5 mb-4">
          <p className="text-xs font-semibold text-slate-600 mb-2.5 flex items-center gap-1.5">
            <SvgIcon name="trending" size={13} /> Breakdown
          </p>
          <div className="flex items-center gap-3">
            <PieChart data={bycat} size={160} />
            <div className="flex-1 flex flex-col gap-1">
              {bycat.map(c => (
                <div key={c.name} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                  <span className="text-[10px] text-slate-500 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{c.name}</span>
                  <span className="text-[10px] font-semibold text-slate-800">{inr(c.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Transaction list */}
      <h2 className="text-xs font-semibold text-slate-600 mt-4 mb-2.5">
        Transactions ({monthExp.length})
      </h2>
      {monthExp.length === 0 ? (
        <div className="card p-6 text-center text-slate-400 text-sm">No expenses for this month.</div>
      ) : (
        <div className="flex flex-col gap-2" style={{ paddingBottom: 120 }}>
          {monthExp.map(e => {
            const cat = cats.find(c => c.name === e.category);
            const account = acc.find(a => a.id === e.accountId);
            const isNew = e.id === newlyAddedId;
            return (
              <div key={e.id} className={`card p-2.5 flex items-center justify-between ${isNew ? 'glow-item' : ''}`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cat?.color || "#999" }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 overflow-hidden text-ellipsis whitespace-nowrap">
                      {e.description || e.category}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {e.category} {account ? `· ${account.name}` : ""} · {new Date(e.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-sm font-semibold text-slate-800">{inr(e.amount)}</span>
                  <div className="flex items-center gap-0.5">
                    <button aria-label={`Edit expense ${e.description || e.category}`} className="text-slate-500 hover:text-indigo-600 p-1" onClick={() => startEdit(e)}>
                      <SvgIcon name="pencil" size={14} />
                    </button>
                    <button aria-label={`Delete expense ${e.description || e.category}`} className="text-slate-500 hover:text-red-500 p-1" onClick={() => deleteExpense(e)}>
                      <SvgIcon name="trash" size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FAB */}
      <button
        className="fab"
        aria-label="Add expense"
        onClick={() => {
        setAmountInvalid(false);
        setForm({
          amount: "",
          category: cats[0]?.name || "Other",
          description: "",
          date: getDefaultDate(month),
          accountId: acc[0]?.id || ""
        });
        setShowAddCat(false);
        setNewCatName("");
        setShow(true);
      }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (e.target as HTMLButtonElement).click(); } }}
      tabIndex={0}
      role="button"
      >
        +
      </button>

      {/* Add Expense Modal */}
      {show && (
        <Modal title="Add Expense" onClose={() => setShow(false)} onSubmit={add}>
          <Field label="Amount">
            <RupeeInput value={form.amount} onChange={v => { setAmountInvalid(false); setForm(f => ({ ...f, amount: v })); }} isInvalid={amountInvalid} />
          </Field>
          
          {showAddCat ? (
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex flex-col gap-2.5 mb-3">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">New Category</p>
              <Field label="Category Name">
                <input
                  type="text"
                  placeholder="e.g. Dineout"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  className="input-field"
                />
              </Field>
              <Field label="Color Theme">
                <div className="flex gap-2 flex-wrap mt-0.5">
                  {["#3b82f6", "#f97316", "#ec4899", "#8b5cf6", "#06b6d4", "#22c55e", "#eab308", "#ef4444", "#64748b"].map(col => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setNewCatColor(col)}
                      className="w-6 h-6 rounded-full border-2 transition-all shrink-0"
                      style={{
                        background: col,
                        borderColor: newCatColor === col ? "#6366f1" : "transparent",
                        transform: newCatColor === col ? "scale(1.1)" : "scale(1)"
                      }}
                    />
                  ))}
                </div>
              </Field>
              <div className="flex gap-2 justify-end mt-1">
                <button
                  type="button"
                  className="btn-secondary text-xs py-1 px-3"
                  onClick={() => setShowAddCat(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary text-xs py-1 px-3"
                  onClick={() => {
                    const nameVal = newCatName.trim();
                    if (!nameVal) { showToast("Category name cannot be empty.", "error"); return; }
                    if (cats.some(c => c.name.toLowerCase() === nameVal.toLowerCase())) {
                      showToast("Category already exists.", "error");
                      return;
                    }
                    const newCat = { name: nameVal, color: newCatColor };
                    setCats(prev => [...prev, newCat]);
                    setForm(f => ({ ...f, category: nameVal }));
                    setNewCatName("");
                    setShowAddCat(false);
                    showToast("Category added!", "success");
                  }}
                >
                  Create
                </button>
              </div>
            </div>
          ) : (
            <Field label="Category">
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <CustomSelect
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    options={cats.map(c => ({ value: c.name, label: c.name }))}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => { setShowAddCat(true); setNewCatColor("#3b82f6"); }}
                  className="btn-secondary px-3 py-2 text-xs shrink-0 flex items-center justify-center gap-1"
                >
                  + New
                </button>
              </div>
            </Field>
          )}

          <Field label="Paid From">
            <CustomSelect
              value={form.accountId}
              onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}
              options={[
                { value: "", label: "None (Do not deduct)" },
                ...acc.map(a => ({ value: a.id, label: a.name }))
              ]}
            />
          </Field>

          <Field label="Description">
            <input type="text" placeholder="e.g. Lunch" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-field" />
          </Field>
          <Field label="Date">
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input-field" />
          </Field>
        </Modal>
      )}

      {/* Edit Expense Modal */}
      {editingExpense && (
        <Modal title="Edit Expense" onClose={() => setEditingExpense(null)} onSubmit={saveEdit}>
          <Field label="Amount">
            <RupeeInput value={editForm.amount} onChange={v => { setEditAmountInvalid(false); setEditForm(f => ({ ...f, amount: v })); }} isInvalid={editAmountInvalid} />
          </Field>
          
          {showEditAddCat ? (
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex flex-col gap-2.5 mb-3">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">New Category</p>
              <Field label="Category Name">
                <input
                  type="text"
                  placeholder="e.g. Dineout"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  className="input-field"
                />
              </Field>
              <Field label="Color Theme">
                <div className="flex gap-2 flex-wrap mt-0.5">
                  {["#3b82f6", "#f97316", "#ec4899", "#8b5cf6", "#06b6d4", "#22c55e", "#eab308", "#ef4444", "#64748b"].map(col => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setNewCatColor(col)}
                      className="w-6 h-6 rounded-full border-2 transition-all shrink-0"
                      style={{
                        background: col,
                        borderColor: newCatColor === col ? "#6366f1" : "transparent",
                        transform: newCatColor === col ? "scale(1.1)" : "scale(1)"
                      }}
                    />
                  ))}
                </div>
              </Field>
              <div className="flex gap-2 justify-end mt-1">
                <button
                  type="button"
                  className="btn-secondary text-xs py-1 px-3"
                  onClick={() => setShowEditAddCat(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary text-xs py-1 px-3"
                  onClick={() => {
                    const nameVal = newCatName.trim();
                    if (!nameVal) { showToast("Category name cannot be empty.", "error"); return; }
                    if (cats.some(c => c.name.toLowerCase() === nameVal.toLowerCase())) {
                      showToast("Category already exists.", "error");
                      return;
                    }
                    const newCat = { name: nameVal, color: newCatColor };
                    setCats(prev => [...prev, newCat]);
                    setEditForm(f => ({ ...f, category: nameVal }));
                    setNewCatName("");
                    setShowEditAddCat(false);
                    showToast("Category added!", "success");
                  }}
                >
                  Create
                </button>
              </div>
            </div>
          ) : (
            <Field label="Category">
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <CustomSelect
                    value={editForm.category}
                    onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                    options={cats.map(c => ({ value: c.name, label: c.name }))}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => { setShowEditAddCat(true); setNewCatColor("#3b82f6"); }}
                  className="btn-secondary px-3 py-2 text-xs shrink-0 flex items-center justify-center gap-1"
                >
                  + New
                </button>
              </div>
            </Field>
          )}

          <Field label="Paid From">
            <CustomSelect
              value={editForm.accountId}
              onChange={e => setEditForm(f => ({ ...f, accountId: e.target.value }))}
              options={[
                { value: "", label: "None (Do not deduct)" },
                ...acc.map(a => ({ value: a.id, label: a.name }))
              ]}
            />
          </Field>

          <Field label="Description">
            <input type="text" placeholder="e.g. Lunch" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="input-field" />
          </Field>
          <Field label="Date">
            <input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} className="input-field" />
          </Field>
        </Modal>
      )}
    </div>
  );
};

// ─── OvTab ───────────────────────────────────────────────────────────────────
interface OvTabProps {
  acc: Account[];
  setAcc: React.Dispatch<React.SetStateAction<Account[]>>;
  activeMonthData: MonthlyDataEntry;
  setMonthIncome: (val: number) => void;
  setMonthFixed: (val: FixedExpense[] | ((p: FixedExpense[]) => FixedExpense[])) => void;
  setMonthVarExp: (val: VariableExpense[] | ((p: VariableExpense[]) => VariableExpense[])) => void;
  setMonthRecover: (val: RecoveryItem[] | ((p: RecoveryItem[]) => RecoveryItem[])) => void;
  monthlySpent: number;
  newlyAddedId: string | null;
  showToast: (msg: string, type?: "success" | "error") => void;
}

const OvTab: React.FC<OvTabProps> = ({ 
  acc, 
  setAcc, 
  activeMonthData, 
  setMonthIncome, 
  setMonthFixed, 
  setMonthVarExp, 
  setMonthRecover, 
  monthlySpent, 
  newlyAddedId, 
  showToast 
}) => {
  const { income, fixed, varExp, recover } = activeMonthData;

  const [editIncome, setEditIncome] = useState(false);
  const [incomeVal, setIncomeVal] = useState("");
  const [editAId, setEditAId] = useState<string | null>(null);
  const [editAV, setEditAV] = useState({ name: "", balance: "" });
  const [showAF, setShowAF] = useState(false); 
  const [newF, setNewF] = useState({ name: "", amount: "" });
  const [editFId, setEditFId] = useState<string | null>(null); 
  const [editFV, setEditFV] = useState({ name: "", amount: "" });
  const [showAV, setShowAV] = useState(false); 
  const [newV, setNewV] = useState({ name: "", amount: "", note: "" });
  const [editVId, setEditVId] = useState<string | null>(null); 
  const [editVV, setEditVV] = useState<{ name: string; amount: string; note?: string }>({ name: "", amount: "", note: "" });
  const [showAR, setShowAR] = useState(false); 
  const [newR, setNewR] = useState({ name: "", amount: "", note: "" });
  const [editRId, setEditRId] = useState<string | null>(null); 
  const [editRV, setEditRV] = useState<{ name: string; amount: string; note?: string }>({ name: "", amount: "", note: "" });

  const [formErrors, setFormErrors] = useState({ fixed: false, variable: false, recover: false });

  const fixedTotal = fixed.reduce((s, f) => s + f.amount, 0);
  const varTotal   = varExp.reduce((s, v) => s + v.amount, 0);
  const fixedPending = fixed.filter(f => !f.paid).reduce((s, f) => s + f.amount, 0);
  const varPending   = varExp.filter(v => !v.paid).reduce((s, v) => s + v.amount, 0);
  const allPending   = fixedPending + varPending;

  const totalBal     = acc.reduce((s, a) => s + Number(a.balance), 0);
  const toRecover    = recover.filter(r => !r.recovered).reduce((s, r) => s + r.amount, 0);
  
  // Dynamic metrics
  const netPosition  = totalBal - allPending + toRecover;

  const saved = income - monthlySpent;

  // Warning checks
  const isOverspent = saved < 0;
  const isNetLow = netPosition < 0;

  return (
    <div className="p-3 flex flex-col gap-4">
      {/* 1. Header Balance Summary Banner */}
      <div className={`rounded-2xl p-4 text-white shadow-md transition-all duration-300 ${
        isOverspent ? "bg-gradient-to-br from-rose-700 to-rose-900 shadow-rose-200" : "bg-gradient-to-br from-emerald-600 to-teal-800 shadow-emerald-200"
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-white/70 text-[10px] font-semibold uppercase tracking-wider">Current Bank Balance</p>
            <p className={`text-2xl font-bold my-0.5 ${isNetLow ? "text-rose-200" : "text-white"}`}>{inr(totalBal)}</p>

            <p className="text-white/70 text-[10px] font-semibold uppercase tracking-wider mt-2">Projected Balance</p>
            <p className={`text-3xl font-extrabold my-0.5 ${isNetLow ? "text-rose-200" : "text-white"}`}>{inr(netPosition)}</p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <button
              className="btn-secondary text-xs py-1 px-3"
              onClick={() => {
                setAcc(curr => curr.map(a => ({ ...a, balance: Number(a.balance) })));
                showToast('Overview refreshed using current account balances and overview data.', 'success');
              }}
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Math equation breakdown */}
        <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-col gap-1 text-[11px] text-white/80">
          <div className="flex items-center justify-between">
            <span>Bank Balance (3 accounts)</span>
            <span className="font-semibold">{inr(totalBal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Unpaid Fixed & Variable Bills</span>
            <span className="font-semibold text-rose-200">- {inr(allPending)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Pending Recoveries (Lent Out)</span>
            <span className="font-semibold text-yellow-200">+ {inr(toRecover)}</span>
          </div>
        </div>
      </div>

      {/* 2. Monthly Salary Credits & Cashflow Card */}
      <div className="card p-3.5 flex flex-col gap-3">
        <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 border-b border-slate-100 pb-2">
          <SvgIcon name="trending" size={13} /> Scoped Cashflow
        </p>

        {/* Salary Credit (Income) */}
        <div className="flex items-center justify-between bg-indigo-50/50 rounded-xl p-3 border border-indigo-50">
          <div>
            <p className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wider">Salary Credit (Income)</p>
            {editIncome ? (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-slate-800 font-bold text-sm">{CURRENCY_SYMBOL}</span>
                <input
                  autoFocus
                  type="number"
                  value={incomeVal}
                  onChange={e => setIncomeVal(e.target.value)}
                  className="bg-white text-slate-800 border border-slate-200 rounded-lg px-2 py-0.5 text-sm w-28 outline-none"
                />
                <button
                  onClick={() => {
                    const v = parseFloat(incomeVal);
                    if (isNaN(v) || v <= 0) {
                      showToast("Please enter a valid income amount.", "error");
                      return;
                    }
                    if (v > 99999999) {
                      showToast("Income amount too large.", "error");
                      return;
                    }
                    setMonthIncome(v);
                    setEditIncome(false);
                    showToast("Salary credits updated.", "success");
                  }}
                  className="bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-indigo-700 shrink-0"
                >
                  <SvgIcon name="check" size={12} />
                </button>
              </div>
            ) : (
              <p className="text-lg font-extrabold text-slate-800 mt-0.5">{inr(income)}</p>
            )}
          </div>
          {!editIncome && (
            <button onClick={() => { setIncomeVal(String(income)); setEditIncome(true); }} className="text-indigo-600 hover:opacity-85 p-1">
              <SvgIcon name="pencil" size={14} />
            </button>
          )}
        </div>

        {/* Dynamic Cashflow Stats Grid */}
        <div className="grid grid-cols-2 gap-2 mt-1">
          <div className="bg-slate-50 rounded-xl p-2.5">
            <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Logged Expenses (Debits)</p>
            <p className="text-sm font-bold text-slate-800 mt-1">{inr(monthlySpent)}</p>
            <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">Total spent logged on Expenses tab</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-2.5">
            <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Net Cashflow (Savings)</p>
            <p className={`text-sm font-bold mt-1 ${saved >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {saved >= 0 ? "+" + inr(saved) : "-" + inr(Math.abs(saved))}
            </p>
            <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">Salary Credit minus Logged Expenses</p>
          </div>
        </div>
      </div>

      {/* 3. Bank Balances (Salary & 2 Savings Accounts) */}
      <div className="card p-3.5 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <SvgIcon name="wallet" size={13} /> Liquid Accounts
          </p>
          <span className="text-[11px] text-slate-400 font-bold">Total: {inr(totalBal)}</span>
        </div>

        <div className="flex flex-col gap-2">
          {acc.map(a => {
            const isNew = a.id === newlyAddedId;
            return (
              <div key={a.id} className={`bg-slate-50 border border-slate-100/50 rounded-xl p-3 flex items-center justify-between ${isNew ? 'glow-item' : ''}`}>
                  {editAId === a.id ? (
                  <div className="flex gap-1.5 w-full flex-col sm:flex-row sm:items-center">
                    <input
                      value={editAV.name}
                      onChange={e => setEditAV(v => ({ ...v, name: e.target.value }))}
                      placeholder="Account Name"
                      className="input-field flex-1 min-w-0"
                    />
                    <div className="relative w-28">
                      <span className="input-prefix text-xs">{CURRENCY_SYMBOL}</span>
                      <input
                        type="number"
                        value={editAV.balance}
                        onChange={e => setEditAV(v => ({ ...v, balance: e.target.value }))}
                        className="input-field input-with-prefix w-full"
                      />
                    </div>
                    <button
                      className="btn-secondary"
                      style={{ width: '38px', padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderColor: '#cbd5e1', color: '#64748b' }}
                      onClick={() => {
                        setEditAV(v => ({ ...v, balance: "0" }));
                      }}
                      title="Reset Balance to 0"
                    >
                      <SvgIcon name="rotateCCW" size={14} />
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ width: '38px', padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderColor: '#cbd5e1', color: '#64748b' }}
                      onClick={() => {
                        setEditAId(null);
                      }}
                      title="Cancel Edit"
                    >
                      <SvgIcon name="x" size={14} />
                    </button>
                    <button
                      className="btn-primary"
                      style={{ width: '38px', padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={() => {
                        const balVal = parseFloat(editAV.balance);
                        const nameVal = editAV.name.trim();
                        if (!nameVal) { showToast("Account name cannot be empty.", "error"); return; }
                        if (isNaN(balVal)) { showToast("Invalid balance amount.", "error"); return; }
                        if (acc.some(x => x.id !== a.id && x.name.toLowerCase() === nameVal.toLowerCase())) {
                          showToast("An account with this name already exists.", "error");
                          return;
                        }
                        setAcc(p => p.map(x => x.id === a.id ? { ...x, name: nameVal, balance: balVal } : x));
                        setEditAId(null);
                        showToast("Account balance updated.", "success");
                      }}
                    >
                      <SvgIcon name="check" size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0">
                      <p className="text-slate-400 text-[10px] font-semibold truncate">{a.name}</p>
                      <p className={`text-base font-bold ${a.balance < 0 ? 'text-rose-500' : 'text-slate-800'}`}>{inr(a.balance)}</p>
                    </div>
                    <button aria-label={`Edit account ${a.name}`} onClick={() => { setEditAId(a.id); setEditAV({ name: a.name, balance: String(a.balance) }); }} className="text-slate-500 hover:text-indigo-600 p-1">
                      <SvgIcon name="pencil" size={14} />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Fixed Monthly */}
      <Sec title="📌 Fixed Monthly" right={
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-medium">{inr(fixedTotal)}/mo</span>
          <button onClick={() => { setFormErrors(e => ({ ...e, fixed: false })); setShowAF(true); }} className="w-6 h-6 rounded-full bg-indigo-600 border-none text-white cursor-pointer flex items-center justify-center hover:bg-indigo-700 transition-colors">
            <SvgIcon name="plus" size={13} />
          </button>
        </div>
      }>
        <PBar done={fixedTotal - fixedPending} total={fixedTotal} color="#10b981" />
        <div className="mt-2.5">
          {fixed.map(f => (
            <BRow
              key={f.id}
              item={f}
              editId={editFId}
              editV={editFV}
              setEditV={setEditFV}
              onToggle={() => setMonthFixed(p => p.map(x => x.id === f.id ? { ...x, paid: !x.paid } : x))}
              onEdit={() => { setEditFId(f.id); setEditFV({ name: f.name, amount: String(f.amount) }); }}
              onSave={() => {
                const amtVal = parseFloat(editFV.amount);
                const nameVal = editFV.name.trim();
                if (!nameVal) { showToast("Name cannot be empty.", "error"); return; }
                if (isNaN(amtVal) || amtVal <= 0) { showToast("Please enter a valid amount.", "error"); return; }
                setMonthFixed(p => p.map(x => x.id === f.id ? { ...x, name: nameVal, amount: amtVal } : x));
                setEditFId(null);
                showToast("Fixed item updated.", "success");
              }}
              onDelete={() => {
                if (confirm(`Remove ${f.name}?`)) {
                  setMonthFixed(p => p.filter(x => x.id !== f.id));
                  showToast("Fixed item deleted.", "success");
                }
              }}
              newlyAddedId={newlyAddedId}
            />
          ))}
        </div>
      </Sec>

      {/* Variable */}
      <Sec title="📊 Variable This Month" right={
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-medium">{inr(varTotal)} est.</span>
          <button onClick={() => { setFormErrors(e => ({ ...e, variable: false })); setShowAV(true); }} className="w-6 h-6 rounded-full bg-purple-600 border-none text-white cursor-pointer flex items-center justify-center hover:bg-purple-700 transition-colors">
            <SvgIcon name="plus" size={13} />
          </button>
        </div>
      }>
        <p className="text-[11px] text-slate-400 mb-2">Credit cards, medical, repairs, one-time bills.</p>
        <PBar done={varTotal - varPending} total={varTotal} color="#8b5cf6" />
        <div className="mt-2.5">
          {varExp.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-3 card">No variable expenses added yet.</p>
          ) : (
            varExp.map(v => (
              <BRow
                key={v.id}
                item={v}
                editId={editVId}
                editV={editVV}
                setEditV={setEditVV}
                onToggle={() => setMonthVarExp(p => p.map(x => x.id === v.id ? { ...x, paid: !x.paid } : x))}
                onEdit={() => { setEditVId(v.id); setEditVV({ name: v.name, amount: String(v.amount), note: v.note || "" }); }}
                onSave={() => {
                  const amtVal = parseFloat(editVV.amount);
                  const nameVal = editVV.name.trim();
                  if (!nameVal) { showToast("Name cannot be empty.", "error"); return; }
                  if (isNaN(amtVal) || amtVal < 0) { showToast("Please enter a valid amount.", "error"); return; }
                  setMonthVarExp(p => p.map(x => x.id === v.id ? { ...x, name: nameVal, amount: amtVal, note: editVV.note?.trim() } : x));
                  setEditVId(null);
                  showToast("Variable item updated.", "success");
                }}
                onDelete={() => {
                  if (confirm(`Remove ${v.name}?`)) {
                    setMonthVarExp(p => p.filter(x => x.id !== v.id));
                    showToast("Variable item deleted.", "success");
                  }
                }}
                showNote
                newlyAddedId={newlyAddedId}
              />
            ))
          )}
        </div>
      </Sec>

      {/* Recover */}
      <Sec title="🤝 Lent & Recoveries" right={
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-medium">{inr(toRecover)} pending</span>
          <button onClick={() => { setFormErrors(e => ({ ...e, recover: false })); setShowAR(true); }} className="w-6 h-6 rounded-full bg-amber-500 border-none text-white cursor-pointer flex items-center justify-center hover:bg-amber-600 transition-colors">
            <SvgIcon name="plus" size={13} />
          </button>
        </div>
      }>
        <p className="text-[11px] text-slate-400 mb-2">Track money lent to friends, travel splits, or debts.</p>
        <div className="mt-2.5">
          {recover.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-3 card">No recoveries tracked yet.</p>
          ) : (
            recover.map(r => (
              <BRow
                key={r.id}
                item={{ ...r, paid: r.recovered }}
                editId={editRId}
                editV={editRV}
                setEditV={setEditRV}
                onToggle={() => setMonthRecover(p => p.map(x => x.id === r.id ? { ...x, recovered: !x.recovered } : x))}
                onEdit={() => { setEditRId(r.id); setEditRV({ name: r.name, amount: String(r.amount), note: r.note || "" }); }}
                onSave={() => {
                  const amtVal = parseFloat(editRV.amount);
                  const nameVal = editRV.name.trim();
                  if (!nameVal) { showToast("Name cannot be empty.", "error"); return; }
                  if (isNaN(amtVal) || amtVal < 0) { showToast("Please enter a valid amount.", "error"); return; }
                  setMonthRecover(p => p.map(x => x.id === r.id ? { ...x, name: nameVal, amount: amtVal, note: editRV.note?.trim() } : x));
                  setEditRId(null);
                  showToast("Recovery item updated.", "success");
                }}
                onDelete={() => {
                  if (confirm(`Remove ${r.name}?`)) {
                    setMonthRecover(p => p.filter(x => x.id !== r.id));
                    showToast("Recovery item deleted.", "success");
                  }
                }}
                showNote
                newlyAddedId={newlyAddedId}
              />
            ))
          )}
        </div>
      </Sec>

      {/* Add Fixed Modal */}
      {showAF && (
        <Modal title="Add Fixed Item" onClose={() => setShowAF(false)} onSubmit={() => {
          const nameVal = newF.name.trim();
          const a = parseFloat(newF.amount);
          if (!nameVal) { setFormErrors(e => ({ ...e, fixed: true })); showToast("Name cannot be empty.", "error"); return; }
          if (isNaN(a) || a <= 0) { setFormErrors(e => ({ ...e, fixed: true })); showToast("Please enter a valid amount.", "error"); return; }
          if (a > 9999999) { setFormErrors(e => ({ ...e, fixed: true })); showToast("Amount is too large.", "error"); return; }
          setMonthFixed(p => [...p, { id: uid(), name: nameVal, amount: a, paid: false }]);
          setNewF({ name: "", amount: "" });
          setShowAF(false);
          showToast("Fixed transaction added!", "success");
        }}>
          <Field label="Name">
            <input type="text" placeholder="e.g. Rent" value={newF.name} onChange={e => { setFormErrors(e => ({ ...e, fixed: false })); setNewF(f => ({ ...f, name: e.target.value })); }} className={`input-field ${formErrors.fixed && !newF.name.trim() ? 'border-rose-400' : ''}`} />
          </Field>
          <Field label="Amount">
            <RupeeInput value={newF.amount} onChange={v => { setFormErrors(e => ({ ...e, fixed: false })); setNewF(f => ({ ...f, amount: v })); }} isInvalid={formErrors.fixed && (isNaN(parseFloat(newF.amount)) || parseFloat(newF.amount) <= 0)} />
          </Field>
        </Modal>
      )}

      {/* Add Variable Modal */}
      {showAV && (
        <Modal title="Add Variable Item" onClose={() => setShowAV(false)} onSubmit={() => {
          const nameVal = newV.name.trim();
          const a = parseFloat(newV.amount);
          if (!nameVal) { setFormErrors(e => ({ ...e, variable: true })); showToast("Name cannot be empty.", "error"); return; }
          if (isNaN(a) || a < 0) { setFormErrors(e => ({ ...e, variable: true })); showToast("Please enter a valid amount.", "error"); return; }
          if (a > 9999999) { setFormErrors(e => ({ ...e, variable: true })); showToast("Amount is too large.", "error"); return; }
          setMonthVarExp(p => [...p, { id: uid(), name: nameVal, amount: a, paid: false, note: newV.note.trim() }]);
          setNewV({ name: "", amount: "", note: "" });
          setShowAV(false);
          showToast("Variable transaction added!", "success");
        }}>
          <Field label="Name">
            <input type="text" placeholder="e.g. Credit Card Bill" value={newV.name} onChange={e => { setFormErrors(e => ({ ...e, variable: false })); setNewV(f => ({ ...f, name: e.target.value })); }} className={`input-field ${formErrors.variable && !newV.name.trim() ? 'border-rose-400' : ''}`} />
          </Field>
          <Field label="Estimated Amount">
            <RupeeInput value={newV.amount} onChange={v => { setFormErrors(e => ({ ...e, variable: false })); setNewV(f => ({ ...f, amount: v })); }} isInvalid={formErrors.variable && (isNaN(parseFloat(newV.amount)) || parseFloat(newV.amount) < 0)} />
          </Field>
          <Field label="Note (optional)">
            <input type="text" placeholder="e.g. Due on 15th" value={newV.note} onChange={e => setNewV(f => ({ ...f, note: e.target.value }))} className="input-field" />
          </Field>
        </Modal>
      )}

      {/* Add Recovery Modal */}
      {showAR && (
        <Modal title="Add Recovery" onClose={() => setShowAR(false)} onSubmit={() => {
          const nameVal = newR.name.trim();
          const a = parseFloat(newR.amount) || 0;
          if (!nameVal) { setFormErrors(e => ({ ...e, recover: true })); showToast("Name cannot be empty.", "error"); return; }
          if (a < 0) { setFormErrors(e => ({ ...e, recover: true })); showToast("Amount cannot be negative.", "error"); return; }
          if (a > 9999999) { setFormErrors(e => ({ ...e, recover: true })); showToast("Amount is too large.", "error"); return; }
          setMonthRecover(p => [...p, { id: uid(), name: nameVal, amount: a, note: newR.note.trim(), recovered: false }]);
          setNewR({ name: "", amount: "", note: "" });
          setShowAR(false);
          showToast("Recovery transaction added!", "success");
        }}>
          <Field label="Person / Name">
            <input type="text" placeholder="e.g. Rahul" value={newR.name} onChange={e => { setFormErrors(e => ({ ...e, recover: false })); setNewR(f => ({ ...f, name: e.target.value })); }} className={`input-field ${formErrors.recover && !newR.name.trim() ? 'border-rose-400' : ''}`} />
          </Field>
          <Field label="Amount (0 if TBD)">
            <RupeeInput value={newR.amount} onChange={v => { setFormErrors(e => ({ ...e, recover: false })); setNewR(f => ({ ...f, amount: v })); }} isInvalid={formErrors.recover && parseFloat(newR.amount) < 0} />
          </Field>
          <Field label="Note (optional)">
            <input type="text" placeholder="e.g. Lent for trip" value={newR.note} onChange={e => setNewR(f => ({ ...f, note: e.target.value }))} className="input-field" />
          </Field>
        </Modal>
      )}
    </div>
  );
};

// ─── Settings Modal ──────────────────────────────────────────────────────────
interface SettingsModalProps {
  settings: Settings;
  onClose: () => void;
  onSave: (newSettings: Settings) => void;
  onGenerateShareLink: (targetSettings: Settings) => void;
  shareLinkState: { loading: boolean; link: string };
  userEmail: string | null;
  onLogout: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onClose, onSave, onGenerateShareLink, shareLinkState, userEmail, onLogout }) => {
  // Suppress unused props warning
  if (false) { onSave({ syncKey: "", firebaseConfig: "" }); void userEmail; void onLogout; }
  const [syncKey] = useState(settings.syncKey || "");
  const [copyText, setCopyText] = useState("Copy");

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLinkState.link).then(() => {
      setCopyText("Copied! ✓");
      setTimeout(() => setCopyText("Copy"), 2000);
    });
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-sheet">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <SvgIcon name="share" size={18} />
            <h3 className="text-slate-800 font-bold text-lg">Invite & Share</h3>
          </div>
          <button className="icon-btn text-slate-500 hover:text-indigo-600 transition-colors" onClick={onClose}>
            <SvgIcon name="x" size={20} />
          </button>
        </div>

        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
            <SvgIcon name="key" size={14} />
          </div>
          <div>
            <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider">Your Aura Key</p>
            <p className="text-sm font-bold font-mono text-indigo-700">{syncKey || "—"}</p>
          </div>
        </div>

        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          Generate a shareable invite link. Anyone who opens it will automatically connect to your notebook — no sign-in needed for them.
        </p>

        <button
          type="button"
          className="btn-primary w-full flex items-center justify-center gap-2 py-2.5"
          onClick={() => onGenerateShareLink({ syncKey, firebaseConfig: "" })}
          disabled={shareLinkState.loading}
        >
          <SvgIcon name="share" size={15} />
          {shareLinkState.loading ? "Generating..." : "Generate Invite Link"}
        </button>

        {shareLinkState.link && (
          <div className="mt-4">
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={shareLinkState.link}
                className="input-field flex-1 text-xs bg-slate-50"
              />
              <button
                type="button"
                className="btn-primary w-auto px-4"
                onClick={handleCopy}
              >
                {copyText}
              </button>
            </div>
            <p className="text-[11px] text-emerald-600 font-semibold mt-2">
              ✅ Send this link to your roommates to instantly sync their device.
            </p>
          </div>
        )}

        <div className="flex gap-2.5 mt-5">
          <button className="btn-secondary w-full" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

interface AdminKeyRecord {
  key: string;
  createdBy: string;
  createdAt: number;
}

interface AdminStats {
  keysCount: number;
  notebooksCount: number;
  keysList: AdminKeyRecord[];
}

const ensureFirebaseAuth = async (): Promise<boolean> => {
  if (firebase.auth().currentUser) return true;
  try {
    await firebase.auth().signInAnonymously();
    return true;
  } catch (e) {
    console.warn("Anonymous Firebase auth failed:", e);
    return false;
  }
};

const resolveAuraKey = async (key: string): Promise<string | null> => {
  const raw = key.trim();
  const normalized = raw.toLowerCase();
  if (raw === ADMIN_KEY || normalized === ADMIN_KEY) return ADMIN_KEY;

  try {
    if (!(await ensureFirebaseAuth())) return null;
    const db = firebase.database();

    const exactKeySnapshot = await db.ref(`${KEYS_DB_PATH}/${raw}`).once("value");
    if (exactKeySnapshot.exists()) return raw;

    const exactDataSnapshot = await db.ref(`${ROOT_DATA_PATH}/${raw}`).once("value");
    if (exactDataSnapshot.exists()) return raw;

    if (normalized !== raw) {
      const normalizedKeySnapshot = await db.ref(`${KEYS_DB_PATH}/${normalized}`).once("value");
      if (normalizedKeySnapshot.exists()) return normalized;

      const normalizedDataSnapshot = await db.ref(`${ROOT_DATA_PATH}/${normalized}`).once("value");
      if (normalizedDataSnapshot.exists()) return normalized;
    }

    return null;
  } catch (e) {
    console.error("Failed to resolve aura key:", e);
    return null;
  }
};

const checkAuraKeyExists = async (key: string): Promise<boolean> => {
  const resolved = await resolveAuraKey(key);
  return resolved !== null;
};

const fetchAdminStats = async (): Promise<AdminStats> => {
  try {
    if (!(await ensureFirebaseAuth())) {
      throw new Error("Unable to authenticate with Firebase.");
    }

    const db = firebase.database();
    const keysSnap = await db.ref(KEYS_DB_PATH).once("value");
    const notesSnap = await db.ref(ROOT_DATA_PATH).once("value");
    const keysData = keysSnap.exists() ? keysSnap.val() : {};
    const notesData = notesSnap.exists() ? notesSnap.val() : {};

    const keysList = Object.entries(keysData).map(([key, value]) => ({
      key,
      createdBy: (value as any)?.createdBy || "admin",
      createdAt: (value as any)?.createdAt || 0
    }));

    return {
      keysCount: keysList.length,
      notebooksCount: Object.keys(notesData).length,
      keysList
    };
  } catch (e) {
    console.error("Failed to fetch admin stats:", e);
    return {
      keysCount: 0,
      notebooksCount: 0,
      keysList: []
    };
  }
};

const createAuraKeyRecord = async (key: string, createdBy = "admin") => {
  const normalized = key.trim().toLowerCase();
  if (!normalized || normalized === ADMIN_KEY) {
    throw new Error("Invalid admin key.");
  }

  if (!(await ensureFirebaseAuth())) {
    throw new Error("Unable to authenticate with Firebase. Please try again.");
  }

  const db = firebase.database();
  const keyRef = db.ref(`${KEYS_DB_PATH}/${normalized}`);
  const snapshot = await keyRef.once("value");
  if (snapshot.exists()) {
    throw new Error("This Aura Key already exists.");
  }

  await keyRef.set({ createdBy, createdAt: Date.now() });
  const notebookRef = db.ref(`${ROOT_DATA_PATH}/${normalized}`);
  const notebookSnap = await notebookRef.once("value");
  if (!notebookSnap.exists()) {
    await notebookRef.set({});
  }
  return normalized;
};

interface LoginPortalProps {
  onSuccess: (syncKey: string) => void;
  onDemo: () => void;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
}

const LoginPortal: React.FC<LoginPortalProps> = ({ onSuccess, onDemo, showToast }) => {
  const [step, setStep] = useState<"welcome" | "auth" | "key">("welcome");
  const [isCreator, setIsCreator] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(() => localStorage.getItem("aura_currentUser_v1") || null);
  
  // Auth Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Key Form State
  const [keyInput, setKeyInput] = useState("");
  const [keyFeedback, setKeyFeedback] = useState<{ text: string; type: "valid" | "invalid" | "checking" | null }>({ text: "", type: null });
  const [isKeyValid, setIsKeyValid] = useState(false);

  // Sync auth state listener
  useEffect(() => {
    const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        setUserEmail(user.email);
        localStorage.setItem("aura_currentUser_v1", user.email || "");
        if (step === "auth" && isCreator) {
          setStep("key");
        }
      } else {
        setUserEmail(null);
        localStorage.removeItem("aura_currentUser_v1");
      }
    });
    return unsubscribe;
  }, [step, isCreator]);

  // Key input checking effect (debounce)
  useEffect(() => {
    if (!keyInput) {
      setKeyFeedback({ text: "", type: null });
      setIsKeyValid(false);
      return;
    }
    const val = keyInput.trim().toLowerCase();
    if (val.length < 4) {
      setKeyFeedback({ text: "Passcode must be at least 4 characters.", type: "invalid" });
      setIsKeyValid(false);
      return;
    }

    setKeyFeedback({ text: "Checking passcode...", type: "checking" });
    const timer = setTimeout(async () => {
      try {
        const exists = await checkAuraKeyExists(val);
        if (isCreator) {
          if (exists) {
            setKeyFeedback({ text: "❌ Key is already in use. Pick a unique one.", type: "invalid" });
            setIsKeyValid(false);
          } else {
            setKeyFeedback({ text: "✅ Key is available!", type: "valid" });
            setIsKeyValid(true);
          }
        } else {
          if (exists) {
            setKeyFeedback({ text: "✅ Key found! Ready to join.", type: "valid" });
            setIsKeyValid(true);
          } else {
            setKeyFeedback({ text: "❌ Key not found. Check the code or create a new one.", type: "invalid" });
            setIsKeyValid(false);
          }
        }
      } catch (e) {
        setKeyFeedback({ text: "Connection check failed. Try again.", type: "invalid" });
        setIsKeyValid(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [keyInput, isCreator]);

  const handleGoogleSignIn = async () => {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      setAuthLoading(true);
      await firebase.auth().signInWithPopup(provider);
      showToast("Successfully authenticated with Google!", "success");
      if (isCreator) {
        setStep("key");
      }
    } catch (err: any) {
      console.error("Google authentication failed:", err);
      if (err.code === "auth/popup-blocked" || err.code === "auth/popup-closed-by-user") {
        try {
          await firebase.auth().signInWithRedirect(new firebase.auth.GoogleAuthProvider());
        } catch (e2) {
          showToast("Authentication failed.", "error");
        }
      } else {
        showToast("Google authentication failed. Please try email sign-in.", "error");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setAuthLoading(true);
    try {
      if (isSignUp) {
        await firebase.auth().createUserWithEmailAndPassword(email, password);
        showToast("Account created successfully!", "success");
      } else {
        await firebase.auth().signInWithEmailAndPassword(email, password);
        showToast("Signed in successfully!", "success");
      }
      if (isCreator) {
        setStep("key");
      }
    } catch (err: any) {
      console.error("Auth action failed:", err);
      showToast(err.message || "Authentication failed.", "error");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalKey = keyInput.trim();
    if (!finalKey || !isKeyValid) return;

    if (!isCreator) {
      const resolved = await resolveAuraKey(finalKey);
      onSuccess(resolved || finalKey);
    } else {
      onSuccess(finalKey);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-8 text-slate-100 min-h-dvh" style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 25%, #4338ca 50%, #6d28d9 75%, #7c3aed 100%)" }}>
      <div className="w-full max-w-[400px] flex flex-col gap-6">
        {step === "welcome" && (
          <div className="flex flex-col gap-6 animate-[fadeIn_0.3s_ease-out]">
            <div className="text-center flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl shadow-violet-900/60 mb-1" style={{ background: "linear-gradient(135deg, #818cf8 0%, #a78bfa 50%, #c4b5fd 100%)" }}>
                <SvgIcon name="wallet" size={36} />
              </div>
              <h2 className="text-4xl font-extrabold tracking-tight" style={{ backgroundImage: "linear-gradient(135deg, #e0e7ff 0%, #c4b5fd 50%, #f0abfc 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>X-penz</h2>
              <p className="text-[10px] mt-0.5 tracking-widest font-medium" style={{ color: "rgba(199,210,254,0.45)", fontVariant: "small-caps", letterSpacing: "0.2em" }}>by Aura Lt. <sup style={{ fontSize: "0.6em", verticalAlign: "super" }}>™</sup></p>
              <p className="text-sm max-w-[300px] text-center leading-relaxed mt-2" style={{ color: "rgba(199,210,254,0.7)" }}>Track your personal expenses, bank balances, and financial planning — simple, clean, and real-time.</p>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  setIsCreator(false);
                  setStep("key");
                }}
                className="w-full rounded-2xl p-4 flex items-center gap-4 text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: "linear-gradient(135deg, #6366f1, #818cf8)" }}>
                  <SvgIcon name="key" size={20} />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm text-white">I have an Aura Key</div>
                  <div className="text-xs text-slate-400">Join an existing roommates notebook</div>
                </div>
                <SvgIcon name="chevR" size={16} />
              </button>

              <button 
                onClick={() => {
                  setIsCreator(true);
                  if (userEmail) {
                    setStep("key");
                  } else {
                    setStep("auth");
                  }
                }}
                className="w-full rounded-2xl p-4 flex items-center gap-4 text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: "linear-gradient(135deg, #7c3aed, #a78bfa)" }}>
                  <SvgIcon name="plusCircle" size={20} />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm text-white">Sign In / Create Account</div>
                  <div className="text-xs text-slate-400">Sign in with email or create a new notebook</div>
                </div>
                <SvgIcon name="chevR" size={16} />
              </button>

              <button 
                onClick={onDemo}
                className="w-full rounded-2xl p-4 flex items-center gap-4 text-left transition-all hover:scale-[1.01] active:scale-[0.99] opacity-80 hover:opacity-100"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(8px)" }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}>
                  <SvgIcon name="eye" size={20} />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm text-white">Default Template</div>
                  <div className="text-xs text-slate-400 font-medium">Browse sample data (read-only demo)</div>
                </div>
                <SvgIcon name="chevR" size={16} />
              </button>
            </div>
          </div>
        )}

        {step === "auth" && (
          <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-3xl p-6 shadow-xl flex flex-col gap-5 animate-[fadeIn_0.3s_ease-out]">
            <div className="text-center flex flex-col items-center gap-1.5">
              <div className="w-12 h-12 rounded-xl bg-slate-700/50 flex items-center justify-center text-slate-400 mb-2">
                <SvgIcon name="lock" size={20} />
              </div>
              <h3 className="text-xl font-bold text-white">Sign In to Continue</h3>
              <p className="text-xs text-slate-400">Authenticate your session securely.</p>
            </div>

            <button 
              onClick={handleGoogleSignIn}
              disabled={authLoading}
              className="w-full bg-white text-slate-900 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-3 transition-colors hover:bg-slate-100 disabled:opacity-50"
            >
              <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/><path d="M3.964 10.707a5.416 5.416 0 0 1-.282-1.707c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.844 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/></svg>
              Sign in with Google
            </button>

            <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-widest">
              <div className="h-[1px] bg-slate-700 flex-1"></div>
              <span>or use email</span>
              <div className="h-[1px] bg-slate-700 flex-1"></div>
            </div>

            <form onSubmit={handleEmailAuthSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-semibold">Email Address</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required 
                  placeholder="name@domain.com"
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-semibold">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required 
                  placeholder="••••••••"
                  minLength={6}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button 
                type="submit" 
                disabled={authLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50 mt-1"
              >
                {isSignUp ? "Create Account" : "Sign In"}
              </button>
            </form>

            <div className="text-center text-xs text-slate-400">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button 
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-indigo-400 hover:underline font-semibold"
              >
                {isSignUp ? "Sign In" : "Create Account"}
              </button>
            </div>

            <button 
              onClick={() => setStep("welcome")}
              className="text-xs text-slate-400 hover:text-white underline self-center mt-1"
            >
              ← Back
            </button>
          </div>
        )}

        {step === "key" && (
          <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-3xl p-6 shadow-xl flex flex-col gap-5 animate-[fadeIn_0.3s_ease-out]">
            <div className="text-center flex flex-col items-center gap-1.5">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-2">
                <SvgIcon name="key" size={20} />
              </div>
              <h3 className="text-xl font-bold text-white">{isCreator ? "Create Aura Key" : "Enter Aura Key"}</h3>
              <p className="text-xs text-slate-400">{isCreator ? "Choose a unique passcode for your new notebook." : "Join an existing roommates notebook."}</p>
            </div>

            <form onSubmit={handleKeySubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400 font-semibold">Sync Passcode (Aura Key)</label>
                <input 
                  type="text" 
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                  required 
                  placeholder="e.g. flat-2b-2026"
                  className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-lg text-center font-bold tracking-wide text-white focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-500 mt-1 leading-normal text-center">
                  {isCreator 
                    ? "Your roommates will use this unique key to synchronize with your notebook."
                    : "Enter the Sync Passcode your roommate generated to link your devices."
                  }
                </p>
              </div>

              {keyFeedback.type && (
                <div 
                  className={`text-center py-2 px-3 rounded-lg text-xs font-semibold ${
                    keyFeedback.type === 'valid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    keyFeedback.type === 'checking' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {keyFeedback.text}
                </div>
              )}

              <button 
                type="submit" 
                disabled={!isKeyValid}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50 mt-1"
              >
                {isCreator ? "Create Notebook →" : "Join Notebook →"}
              </button>
            </form>

            <button 
              onClick={() => {
                if (isCreator && !userEmail) {
                  setStep("auth");
                } else {
                  setStep("welcome");
                }
              }}
              className="text-xs text-slate-400 hover:text-white underline self-center mt-1"
            >
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]         = useState("expenses");
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(() => localStorage.getItem("aura_currentUser_v1") || null);
  const [exp, setExp]         = useState<Expense[]>(() => lsGet("exp_v4", DEF_EXP));
  const [acc, setAcc]         = useState<Account[]>(() => {
    const local = lsGet<Account[] | null>("ov_acc", null);
    if (local && local.length === 3) {
      return local.map((a, idx) => {
        const parsedBalance = typeof a.balance === 'string' ? parseFloat(a.balance) : Number(a.balance);
        const balance = isNaN(parsedBalance) ? 0 : parsedBalance;
        if (a.name === `ACC ${idx + 1}` || a.name === `Acc ${idx + 1}`) {
          const newNames = ["Salary Account", "Savings Account", "Other Account"];
          return { ...a, name: newNames[idx], balance };
        }
        return { ...a, balance };
      });
    }
    return DEF_ACC;
  });
  const [cats, setCats]       = useState<Category[]>(() => {
    const local = lsGet<Category[] | null>("exp_cats_v3", null);
    if (local && local.length > 0) return local;
    return DEF_CATS;
  });
  const [month, setMonth]     = useState(() => lsGet("last_updated_month_v2", lsGet("selected_month_v2", "2026-07")));

  useEffect(() => {
    lsSet("selected_month_v2", month);
  }, [month]);

  const markMonthUpdated = (monthKey: string) => {
    lsSet("last_updated_month_v2", monthKey);
  };

  useEffect(() => {
    const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        setUserEmail(user.email);
        localStorage.setItem("aura_currentUser_v1", user.email || "");
      } else {
        setUserEmail(null);
        localStorage.removeItem("aura_currentUser_v1");
      }
    });
    return unsubscribe;
  }, []);

  // Month-specific data dictionary
  const [monthlyData, setMonthlyData] = useState<MonthlyData>((): MonthlyData => {
    const local = lsGet("monthly_data_v2", null);
    if (local) return local;

    // Migrate from old local storage structure if available
    const oldIncome = lsGet("ov_income", null);
    const oldFixed = lsGet("ov_fixed", null);
    const oldVar = lsGet("ov_var", null);
    const oldRecover = lsGet("ov_recover", null);

    if (oldIncome !== null || oldFixed !== null || oldVar !== null || oldRecover !== null) {
      return {
        "2026-07": {
          income: oldIncome !== null ? oldIncome : DEF_INCOME,
          fixed: oldFixed !== null ? oldFixed : DEF_FIXED,
          varExp: oldVar !== null ? oldVar : DEF_VAR,
          recover: oldRecover !== null ? oldRecover : DEF_RECOVER,
        }
      };
    }
    return {};
  });

  // Syncing & Firebase settings
  const [settings, setSettings] = useState<Settings>(() => lsGet("aura_settings_v1", { syncKey: "", firebaseConfig: "" }));
  const [showSettings, setShowSettings] = useState(false);
  const [shareLinkState, setShareLinkState] = useState({ loading: false, link: "" });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [adminKeyMessage, setAdminKeyMessage] = useState<{ text: string; type: "success" | "error" | null }>({ text: "", type: null });

  const isAdminMode = settings.syncKey === ADMIN_KEY;

  // Sync status state
  const [_syncStatus, setSyncStatus] = useState<"offline" | "connecting" | "synced" | "syncing" | "error">("offline");
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);

  const lastRemoteData = useRef("");
  const firebaseSyncRef = useRef<firebase.database.Reference | null>(null);
  const firebaseDbRef = useRef<firebase.database.Database | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type: type === "info" ? "success" : type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleLogout = () => {
    if (window.confirm("Sign out from your account? This will clear local data.")) {
      const clearLocal = () => {
        localStorage.removeItem("exp_v4");
        localStorage.removeItem("ov_acc");
        localStorage.removeItem("exp_cats_v3");
        localStorage.removeItem("selected_month_v2");
        localStorage.removeItem("monthly_data_v2");
        localStorage.removeItem("ov_income");
        localStorage.removeItem("ov_fixed");
        localStorage.removeItem("ov_var");
        localStorage.removeItem("ov_recover");
        localStorage.removeItem("aura_settings_v1");
        localStorage.removeItem("aura_currentUser_v1");
        window.location.hash = "";
        window.location.reload();
      };
      
      if (firebase.apps.length > 0 && firebase.auth().currentUser) {
        firebase.auth().signOut()
          .then(clearLocal)
          .catch((err) => {
            console.error("Firebase signout error:", err);
            clearLocal();
          });
      } else {
        clearLocal();
      }
    }
  };

  const triggerGlow = (id: string) => {
    setNewlyAddedId(id);
    setTimeout(() => setNewlyAddedId(null), 1800);
  };

  // Get active month's data, pre-populating if missing
  const activeMonthData = useMemo<MonthlyDataEntry>(() => {
    const raw = monthlyData[month];
    if (raw) {
      return {
        income: raw.income ?? 0,
        fixed: (raw.fixed ?? []).map(f => ({ ...(f as FixedExpense), paid: (f as any)?.paid ?? false })),
        varExp: raw.varExp ?? [],
        recover: raw.recover ?? []
      };
    }

    // Initial configuration for July 2026, all other/future months start clean
    if (month === "2026-07") {
      return {
        income: DEF_INCOME,
        fixed: DEF_FIXED.map(f => ({ ...f, paid: false })),
        varExp: [],
        recover: []
      };
    }

    return {
      income: 0,
      fixed: [],
      varExp: [],
      recover: []
    };
  }, [monthlyData, month]);

  // Setters that safely update the selected month's dictionary entry
  const setMonthIncome = (newIncome: number) => {
    setMonthlyData(prev => ({
      ...prev,
      [month]: {
        ...activeMonthData,
        income: newIncome
      }
    }));
    markMonthUpdated(month);
  };

  const syncAutoExpensesForItems = <T extends { id: string; name: string; amount: number; paid: boolean }>(
    currentList: T[],
    updatedList: T[]
  ) => {
    const today = new Date().toISOString().slice(0, 10);
    const accountId = acc[0]?.id;

    const newlyPaid = updatedList.filter(u => u.paid && (!currentList.some(c => c.id === u.id) || !currentList.find(c => c.id === u.id)?.paid));
    const toggledToUnpaidOrRemoved = currentList.filter(c => c.paid && !updatedList.some(u => u.id === c.id && u.paid));
    const updatedPaid = updatedList.filter(u => {
      const prev = currentList.find(c => c.id === u.id && c.paid);
      return !!prev && u.paid && (prev.amount !== u.amount || prev.name !== u.name);
    });

    if (newlyPaid.length === 0 && toggledToUnpaidOrRemoved.length === 0 && updatedPaid.length === 0) {
      return;
    }

    setExp(prevExp => {
      let next = [...prevExp];

      toggledToUnpaidOrRemoved.forEach(item => {
        const removed = next.filter(e => e.sourceType === 'auto' && e.sourceId === item.id);
        removed.forEach(exp => {
          if (exp.accountId) {
            setAcc(prevA => prevA.map(a => a.id === exp.accountId ? { ...a, balance: a.balance + exp.amount } : a));
          }
        });
        next = next.filter(e => !(e.sourceType === 'auto' && e.sourceId === item.id));
      });

      updatedPaid.forEach(item => {
        const index = next.findIndex(e => e.sourceType === 'auto' && e.sourceId === item.id);
        const category = mapNameToCategory(item.name);
        if (index !== -1) {
          const existing = next[index];
          const diff = item.amount - existing.amount;
          if (diff !== 0 && existing.accountId) {
            setAcc(prevA => prevA.map(a => a.id === existing.accountId ? { ...a, balance: a.balance - diff } : a));
          }
          next[index] = {
            ...existing,
            amount: item.amount,
            category,
            description: item.name
          };
        } else {
          const newE: Expense = {
            id: uid(),
            amount: item.amount,
            category,
            description: item.name,
            date: today,
            accountId: accountId || undefined,
            sourceType: 'auto',
            sourceId: item.id
          };
          next = [...next, newE];
          if (newE.accountId) {
            setAcc(prevA => prevA.map(a => a.id === newE.accountId ? { ...a, balance: a.balance - newE.amount } : a));
          }
        }
      });

      newlyPaid.forEach(item => {
        if (next.some(e => e.sourceType === 'auto' && e.sourceId === item.id)) return;
        const category = mapNameToCategory(item.name);
        const newE: Expense = {
          id: uid(),
          amount: item.amount,
          category,
          description: item.name,
          date: today,
          accountId: accountId || undefined,
          sourceType: 'auto',
          sourceId: item.id
        };
        next = [...next, newE];
        if (newE.accountId) {
          setAcc(prevA => prevA.map(a => a.id === newE.accountId ? { ...a, balance: a.balance - newE.amount } : a));
        }
      });

      return next;
    });
  };

  const setMonthFixed = (newFixed: FixedExpense[] | ((prev: FixedExpense[]) => FixedExpense[])) => {
    setMonthlyData(prev => {
      const currentList = prev[month]?.fixed || activeMonthData.fixed;
      const updatedList = typeof newFixed === 'function' ? newFixed(currentList) : newFixed;

      syncAutoExpensesForItems(currentList, updatedList);

      return {
        ...prev,
        [month]: {
          ...activeMonthData,
          fixed: updatedList
        }
      };
    });
    markMonthUpdated(month);
  };

  const setMonthVarExp = (newVar: VariableExpense[] | ((prev: VariableExpense[]) => VariableExpense[])) => {
    setMonthlyData(prev => {
      const currentList = prev[month]?.varExp || activeMonthData.varExp;
      const updatedList = typeof newVar === 'function' ? newVar(currentList) : newVar;

      syncAutoExpensesForItems(currentList, updatedList);

      return {
        ...prev,
        [month]: {
          ...activeMonthData,
          varExp: updatedList
        }
      };
    });
    markMonthUpdated(month);
  };

  const setMonthRecover = (newRecover: RecoveryItem[] | ((prev: RecoveryItem[]) => RecoveryItem[])) => {
    setMonthlyData(prev => {
      const currentList = prev[month]?.recover || activeMonthData.recover;
      const updatedList = typeof newRecover === 'function' ? newRecover(currentList) : newRecover;

      const toggledToRecovered = updatedList.filter(u => {
        const prevItem = currentList.find(x => x.id === u.id);
        return prevItem && !prevItem.recovered && u.recovered;
      });

      if (toggledToRecovered.length > 0) {
        // credit account for recovered amounts
        toggledToRecovered.forEach(item => {
          const amt = item.amount || 0;
          setAcc(prevA => prevA.map(a => a.id === (acc[0]?.id || a.id) ? { ...a, balance: a.balance + amt } : a));
        });
      }

      const toggledToUnrecovered = updatedList.filter(u => {
        const prevItem = currentList.find(x => x.id === u.id);
        return prevItem && prevItem.recovered && !u.recovered;
      });

      if (toggledToUnrecovered.length > 0) {
        toggledToUnrecovered.forEach(item => {
          const amt = item.amount || 0;
          setAcc(prevA => prevA.map(a => a.id === (acc[0]?.id || a.id) ? { ...a, balance: a.balance - amt } : a));
        });
      }

      return {
        ...prev,
        [month]: {
          ...activeMonthData,
          recover: updatedList
        }
      };
    });
    markMonthUpdated(month);
  };

  // URL Hash loading checks (load configuration shares on mount)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.startsWith("#config=")) {
      try {
        const base64Str = hash.replace("#config=", "");
        const decodedStr = atob(base64Str);
        const configObj = JSON.parse(decodedStr);
        if (configObj && configObj.settings) {
          setSettings(configObj.settings);
          lsSet("aura_settings_v1", configObj.settings);
          window.history.replaceState(null, "", window.location.pathname);
          showToast("Successfully loaded cloud sync settings!", "success");
        }
      } catch (e) {
        console.error("Failed to parse URL config sharing hash:", e);
        showToast("Invalid invite configuration hash.", "error");
      }
    }
  }, []);

  // Firebase Setup & Realtime DB Listening
  useEffect(() => {
    const syncKey = settings.syncKey;

    if (firebaseSyncRef.current) {
      firebaseSyncRef.current.off();
      firebaseSyncRef.current = null;
    }
    firebaseDbRef.current = null;

    if (!syncKey || syncKey === ADMIN_KEY) {
      setSyncStatus("offline");
      return;
    }

    try {
      setSyncStatus("connecting");

      const app = firebase.app();
      const db = firebase.database(app);
      firebaseDbRef.current = db;

      const ref = db.ref(`aura_expense_tracker/${syncKey}`);
      firebaseSyncRef.current = ref;

      showToast("⚡ Cloud Sync Active!", "success");
      setSyncStatus("synced");

      ref.on("value", snapshot => {
        const data = snapshot.val();
        if (data) {
          const dataStr = JSON.stringify(data);
          if (dataStr !== lastRemoteData.current) {
            lastRemoteData.current = dataStr;
            
            if (data.exp) setExp(data.exp);
            if (data.acc) {
              const cleanedAcc = data.acc.map((a: any) => ({
                ...a,
                balance: Number(a.balance) || 0
              }));
              setAcc(cleanedAcc);
            }
            if (data.monthlyData) setMonthlyData(data.monthlyData);
            if (data.cats) setCats(data.cats);
            
            setSyncStatus("synced");
            showToast("Cloud sync loaded latest updates!", "success");
          }
        } else {
          // Seed cloud database
          const initialData = { exp, acc, monthlyData, cats };
          ref.set(initialData).then(() => {
            lastRemoteData.current = JSON.stringify(initialData);
            setSyncStatus("synced");
          });
        }
      }, (err: any) => {
        console.error("Firebase RTDB sync error:", err);
        setSyncStatus("error");
        showToast("Sync Error: " + err.message, "error");
      });

    } catch (e) {
      console.error("Firebase setup failed:", e);
      setSyncStatus("error");
      showToast("Firebase initialization failed.", "error");
    }

    return () => {
      if (firebaseSyncRef.current) {
        firebaseSyncRef.current.off();
      }
    };
  }, [settings.syncKey]);

  // Synchronize state changes to local storage & Firebase DB
  useEffect(() => {
    const localData = { exp, acc, monthlyData, cats };
    const localStr = JSON.stringify(localData);

    lsSet("exp_v4", exp);
    lsSet("ov_acc", acc);
    lsSet("monthly_data_v2", monthlyData);
    lsSet("exp_cats_v3", cats);

    if (firebaseDbRef.current && firebaseSyncRef.current) {
      if (localStr !== lastRemoteData.current) {
        setSyncStatus("syncing");
        firebaseSyncRef.current.set(localData).then(() => {
          lastRemoteData.current = localStr;
          setSyncStatus("synced");
        }).catch(err => {
          console.error("Failed to push changes to Firebase:", err);
          setSyncStatus("error");
        });
      }
    }
  }, [exp, acc, monthlyData, cats]);

  // Intercept and glow new items on array additions
  const prevExpLen = useRef(exp.length);
  useEffect(() => {
    if (exp.length > prevExpLen.current) {
      const added = exp[exp.length - 1];
      if (added && added.id) triggerGlow(added.id);
    }
    prevExpLen.current = exp.length;
  }, [exp]);

  const prevFixedLen = useRef(activeMonthData.fixed.length);
  useEffect(() => {
    if (activeMonthData.fixed.length > prevFixedLen.current) {
      const added = activeMonthData.fixed[activeMonthData.fixed.length - 1];
      if (added && added.id) triggerGlow(added.id);
    }
    prevFixedLen.current = activeMonthData.fixed.length;
  }, [activeMonthData.fixed]);

  const prevVarLen = useRef(activeMonthData.varExp.length);
  useEffect(() => {
    if (activeMonthData.varExp.length > prevVarLen.current) {
      const added = activeMonthData.varExp[activeMonthData.varExp.length - 1];
      if (added && added.id) triggerGlow(added.id);
    }
    prevVarLen.current = activeMonthData.varExp.length;
  }, [activeMonthData.varExp]);

  const prevRecoverLen = useRef(activeMonthData.recover.length);
  useEffect(() => {
    if (activeMonthData.recover.length > prevRecoverLen.current) {
      const added = activeMonthData.recover[activeMonthData.recover.length - 1];
      if (added && added.id) triggerGlow(added.id);
    }
    prevRecoverLen.current = activeMonthData.recover.length;
  }, [activeMonthData.recover]);

  const monthExp = useMemo(() => {
    return exp.filter(e => mk(e.date) === month).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [exp, month]);

  const total = useMemo(() => {
    return monthExp.reduce((s, e) => s + e.amount, 0);
  }, [monthExp]);

  const bycat = useMemo(() => {
    return cats.map(c => ({
      name: c.name,
      value: monthExp.filter(e => e.category === c.name).reduce((s, e) => s + e.amount, 0),
      color: c.color
    })).filter(c => c.value > 0);
  }, [monthExp, cats]);

  const handleOpenSettings = () => {
    setShareLinkState({ loading: false, link: "" });
    setShowSettings(true);
  };

  const handleSaveSettings = (newSettings: Settings) => {
    setSettings(newSettings);
    lsSet("aura_settings_v1", newSettings);
    setShowSettings(false);
    showToast("Sync settings updated!", "success");
  };

  const loadAdminStats = async () => {
    setAdminLoading(true);
    try {
      const stats = await fetchAdminStats();
      setAdminStats(stats);
    } catch (err) {
      console.error("Unable to load admin stats:", err);
      setAdminStats(null);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleCreateAuraKey = async () => {
    const rawKey = adminKeyInput.trim();
    if (!rawKey) {
      setAdminKeyMessage({ text: "Enter a valid new Aura Key.", type: "error" });
      return;
    }

    try {
      const exists = await checkAuraKeyExists(rawKey);
      if (exists) {
        setAdminKeyMessage({ text: `Aura Key "${rawKey}" already exists. Choose another.`, type: "error" });
        return;
      }

      await createAuraKeyRecord(rawKey);
      setAdminKeyMessage({ text: `Aura Key "${rawKey}" created successfully.`, type: "success" });
      setAdminKeyInput("");
      await loadAdminStats();
    } catch (err: any) {
      setAdminKeyMessage({ text: err.message || "Failed to create key.", type: "error" });
    }
  };

  const handleExitAdmin = () => {
    const newSettings = { syncKey: "", firebaseConfig: "" };
    setSettings(newSettings);
    lsSet("aura_settings_v1", newSettings);
    setAdminStats(null);
    setAdminKeyInput("");
    setAdminKeyMessage({ text: "", type: null });
  };

  useEffect(() => {
    if (isAdminMode) {
      loadAdminStats();
    } else {
      setAdminStats(null);
    }
  }, [isAdminMode]);

  const handleGenerateShareLink = async (targetSettings: Settings) => {
    setShareLinkState({ loading: true, link: "" });
    const configData = { settings: targetSettings };
    const base64Str = btoa(JSON.stringify(configData));
    const origin = window.location.origin + window.location.pathname;
    const fullUrl = `${origin}#config=${base64Str}`;

    let shortUrl: string | null = null;
    try {
      const resp = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(fullUrl)}`);
      if (resp.ok) {
        const text = await resp.text();
        if (text.startsWith("https://tinyurl.com/")) {
          shortUrl = text.trim();
        }
      }
    } catch (e) {
      console.warn("TinyURL request failed:", e);
    }

    setShareLinkState({ loading: false, link: shortUrl || fullUrl });
  };

  return (
    <div id="root" className="w-full h-full flex flex-col overflow-hidden relative">
      {/* Custom Toast Banner */}
      {toast && (
        <div 
          className="toast-banner"
          role="status"
          aria-live="polite"
          style={{
            position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
            background: toast.type === "success" ? "linear-gradient(135deg, #059669 0%, #0d9488 100%)" : "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            color: "white", padding: "10px 16px", borderRadius: 12, zIndex: 9999,
            fontSize: 12, fontWeight: 600, boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
            textAlign: "center", width: "calc(100% - 32px)", maxWidth: 300
          }}
        >
          {toast.message}
        </div>
      )}

      {isAdminMode ? (
        <div className="w-full h-full flex flex-col overflow-hidden bg-slate-950 text-white">
          <header className="sticky top-0 bg-slate-900/95 border-b border-slate-800 px-5 py-4 z-20">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-xl font-bold">X-penz Admin Dashboard</h1>
                <p className="text-sm text-slate-400 mt-1">Manage Aura Keys and view registered notebook statistics.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExitAdmin}
                  className="btn-secondary text-xs py-2 px-3"
                >
                  Exit Admin
                </button>
              </div>
            </div>
          </header>

          <main className="scroll-area p-5 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Total Registered Notebooks</p>
                <p className="text-4xl font-bold text-white mt-3">{adminLoading ? "..." : adminStats?.notebooksCount ?? 0}</p>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Aura Keys Created</p>
                <p className="text-4xl font-bold text-white mt-3">{adminLoading ? "..." : adminStats?.keysCount ?? 0}</p>
              </div>
            </div>

            <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <p className="text-sm font-semibold">Create New Aura Key</p>
                  <p className="text-xs text-slate-500">Admins can generate a new key immediately, no email required.</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex-1">
                  <label className="text-xs uppercase tracking-[0.2em] text-slate-500">New Key</label>
                  <input
                    value={adminKeyInput}
                    onChange={e => setAdminKeyInput(e.target.value)}
                    placeholder="e.g. group-4-2026"
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  onClick={handleCreateAuraKey}
                  className="btn-primary text-sm px-5 py-3"
                >
                  Create Key
                </button>
              </div>

              {adminKeyMessage.text && (
                <p className={`mt-3 text-sm ${adminKeyMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {adminKeyMessage.text}
                </p>
              )}
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <p className="text-sm font-semibold">Recent Aura Keys</p>
                  <p className="text-xs text-slate-500">Latest keys registered in the database.</p>
                </div>
                <button
                  onClick={loadAdminStats}
                  className="btn-secondary text-xs px-3 py-2"
                >
                  Refresh Stats
                </button>
              </div>

              {adminLoading ? (
                <p className="text-sm text-slate-400">Loading keys...</p>
              ) : (
                <div className="space-y-3">
                  {(adminStats?.keysList.length ?? 0) === 0 ? (
                    <p className="text-sm text-slate-400">No Aura Keys found yet.</p>
                  ) : (
                    <div className="grid gap-3">
                      {adminStats?.keysList.map(record => (
                        <div key={record.key} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="font-semibold text-white">{record.key}</p>
                              <p className="text-xs text-slate-500">Created by {record.createdBy}</p>
                            </div>
                            <p className="text-xs text-slate-400">{new Date(record.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          </main>
        </div>
      ) : !settings.syncKey && !isDemoMode ? (
        <LoginPortal 
          onSuccess={(key) => handleSaveSettings({ syncKey: key, firebaseConfig: "" })} 
          onDemo={() => setIsDemoMode(true)} 
          showToast={showToast} 
        />
      ) : (
        <div className="w-full h-full flex flex-col overflow-hidden">
          {/* Demo notice banner */}
          {isDemoMode && (
            <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-500 text-xs px-4 py-2.5 flex items-center justify-between gap-4 font-semibold shrink-0">
              <div className="flex items-center gap-2">
                <SvgIcon name="eye" size={14} />
                <span>Default Template (Read-Only Demo Mode)</span>
              </div>
              <button 
                onClick={() => {
                  setIsDemoMode(false);
                }}
                className="bg-amber-500 text-slate-900 px-2 py-1 rounded text-[10px] font-bold cursor-pointer"
              >
                + New Notebook
              </button>
            </div>
          )}

          {/* Sticky Global Top Header (shared month selector and settings) */}
          <header className="sticky top-0 bg-gradient-to-r from-indigo-600 to-indigo-800 text-white px-4 py-4 rounded-b-2xl shadow-md z-30 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SvgIcon name="wallet" size={18} />
                <div className="flex flex-col leading-none">
                  <h1 className="text-base font-bold tracking-tight">X-penz</h1>
                  <span className="text-[8px] tracking-widest opacity-50" style={{ fontVariant: "small-caps", letterSpacing: "0.15em" }}>by Aura Lt. <sup style={{ fontSize: "0.7em" }}>™</sup></span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {settings.syncKey && (
                  <div
                    title="Aura Key"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono"
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.18)" }}
                  >
                    <SvgIcon name="key" size={11} />
                    <span className="text-indigo-200 font-semibold tracking-wide">{settings.syncKey}</span>
                  </div>
                )}
                <button
                  onClick={handleOpenSettings}
                  title="Share / Invite"
                  className="flex items-center gap-1 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 transition-all px-2 py-1 rounded-lg text-xs font-semibold"
                >
                  <SvgIcon name="share" size={13} />
                  <span>Share</span>
                </button>
                <button
                  onClick={handleLogout}
                  title="Sign Out / Disconnect"
                  className="flex items-center gap-1 text-rose-300 hover:text-rose-100 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-400/30 transition-all px-2 py-1 rounded-lg text-xs font-semibold"
                >
                  <SvgIcon name="logOut" size={13} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between bg-white/10 rounded-xl px-2 py-1.5">
              <button onClick={() => setMonth(m => shft(m, -1))} className="p-1 rounded bg-white/10 hover:bg-white/20 transition-colors flex">
                <SvgIcon name="chevL" size={15} />
              </button>
              <span className="text-sm font-semibold">{fmtM(month)}</span>
              <button onClick={() => setMonth(m => shft(m, 1))} className="p-1 rounded bg-white/10 hover:bg-white/20 transition-colors flex">
                <SvgIcon name="chevR" size={15} />
              </button>
            </div>
          </header>

          <div className="scroll-area">
            {tab === "expenses" ? (
              <ExpTab 
                monthExp={monthExp} 
                total={total} 
                bycat={bycat} 
                setExp={setExp} 
                acc={acc}
                setAcc={setAcc}
                cats={cats}
                setCats={setCats}
                month={month}
                newlyAddedId={newlyAddedId} 
                showToast={showToast} 
              />
            ) : (
              <OvTab 
                acc={acc} 
                setAcc={setAcc} 
                activeMonthData={activeMonthData}
                setMonthIncome={setMonthIncome}
                setMonthFixed={setMonthFixed}
                setMonthVarExp={setMonthVarExp}
                setMonthRecover={setMonthRecover}
                monthlySpent={total} 
                newlyAddedId={newlyAddedId} 
                showToast={showToast} 
              />
            )}
          </div>

          <nav className="bottom-nav">
            {[
              { key: "expenses", label: "Expenses",  icon: "receipt"   },
              { key: "overview", label: "Overview",  icon: "dashboard" },
            ].map(({ key, label, icon }) => (
              <button 
                key={key} 
                className={`nav-btn ${tab === key ? "active" : ""}`} 
                onClick={() => setTab(key)}
              >
                <SvgIcon name={icon} size={20} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Sync Settings Modal */}
      {showSettings && (
        <SettingsModal 
          settings={settings} 
          onClose={() => setShowSettings(false)} 
          onSave={handleSaveSettings} 
          onGenerateShareLink={handleGenerateShareLink} 
          shareLinkState={shareLinkState} 
          userEmail={userEmail}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
