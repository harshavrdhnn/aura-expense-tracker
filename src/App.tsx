import React, { useState, useEffect, useRef, useMemo } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/database';
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
const inr = (n: number) => "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
function parseFirebaseConfig(raw: string): any {
  if (!raw) return null;
  let str = raw.trim();
  str = str.replace(/^(const|var|let)\s+\w+\s*=\s*/, "");
  str = str.replace(/;$/, "").trim();
  try {
    return JSON.parse(str);
  } catch (_) {}
  try {
    const result = new Function("return " + str)();
    if (result && typeof result === "object") return result;
  } catch (_) {}
  return null;
}

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
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-sheet">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-800 font-bold text-lg">{title}</h3>
          <button className="icon-btn text-slate-500 hover:text-indigo-600 transition-colors" onClick={onClose}>
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
      <span className="input-prefix">₹</span>
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
              <span className="input-prefix text-xs">₹</span>
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
      showToast("Amount is too large (max ₹9,99,99,999).", "error");
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
        <div className="flex flex-col gap-2">
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
                    <button className="text-slate-500 hover:text-indigo-600 p-1" onClick={() => startEdit(e)}>
                      <SvgIcon name="pencil" size={14} />
                    </button>
                    <button className="text-slate-500 hover:text-red-500 p-1" onClick={() => deleteExpense(e)}>
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
      <button className="fab" onClick={() => {
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
      }}>+</button>

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
        <p className="text-white/70 text-[10px] font-semibold uppercase tracking-wider">Projected Balance</p>
        <p className={`text-3xl font-extrabold my-0.5 ${isNetLow ? "text-rose-200" : "text-white"}`}>{inr(netPosition)}</p>
        
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
                <span className="text-slate-800 font-bold text-sm">₹</span>
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
                  <div className="flex gap-2 w-full">
                    <input
                      value={editAV.name}
                      onChange={e => setEditAV(v => ({ ...v, name: e.target.value }))}
                      placeholder="Account Name"
                      className="input-field flex-1"
                    />
                    <div className="relative w-28">
                      <span className="input-prefix text-xs">₹</span>
                      <input
                        type="number"
                        value={editAV.balance}
                        onChange={e => setEditAV(v => ({ ...v, balance: e.target.value }))}
                        className="input-field pl-5 w-full"
                      />
                    </div>
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
                    <div>
                      <p className="text-slate-400 text-[10px] font-semibold">{a.name}</p>
                      <p className={`text-base font-bold ${a.balance < 0 ? 'text-rose-500' : 'text-slate-800'}`}>{inr(a.balance)}</p>
                    </div>
                    <button onClick={() => { setEditAId(a.id); setEditAV({ name: a.name, balance: String(a.balance) }); }} className="text-slate-500 hover:text-indigo-600 p-1">
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
}

const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onClose, onSave, onGenerateShareLink, shareLinkState }) => {
  const [syncKey, setSyncKey] = useState(settings.syncKey || "");
  const [firebaseConfig, setFirebaseConfig] = useState(settings.firebaseConfig || "");
  const [copyText, setCopyText] = useState("Copy");

  const handleSave = () => {
    onSave({ syncKey: syncKey.trim(), firebaseConfig: firebaseConfig.trim() });
  };

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
          <h3 className="text-slate-800 font-bold text-lg">Sync & Cloud Settings</h3>
          <button className="icon-btn text-slate-500 hover:text-indigo-600 transition-colors" onClick={onClose}>
            <SvgIcon name="x" size={20} />
          </button>
        </div>
        
        <Field label="Sync Passcode (Sync Key)">
          <input
            type="text"
            placeholder="e.g. my-private-passcode"
            value={syncKey}
            onChange={e => setSyncKey(e.target.value)}
            className="input-field"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Devices with this same passcode will synchronize your expenses in real time.
          </p>
        </Field>

        <Field label="Firebase Realtime DB Config JSON">
          <textarea
            placeholder='e.g. { "apiKey": "...", "databaseURL": "...", "projectId": "..." }'
            value={firebaseConfig}
            onChange={e => setFirebaseConfig(e.target.value)}
            rows={4}
            className="input-field font-mono text-xs resize-y"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Paste the configuration object from your Firebase Console. Ensure Realtime Database rules allow read/writes.
          </p>
        </Field>

        <div className="border-t border-slate-200 pt-4 mt-4 mb-4">
          <label className="label font-semibold">Invite & Sync Other Devices</label>
          <p className="text-[11px] text-slate-400 mb-2.5">
            Generate a shareable link to load this settings configuration on another device.
          </p>
          <button
            type="button"
            className="btn-secondary flex items-center justify-center gap-1.5 py-2 px-3 w-auto"
            onClick={() => onGenerateShareLink({ syncKey, firebaseConfig })}
            disabled={shareLinkState.loading}
          >
            <SvgIcon name="share" size={14} />
            {shareLinkState.loading ? "Generating..." : "Generate Invite Link"}
          </button>
          {shareLinkState.link && (
            <div className="mt-3">
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
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                ✅ Send this link to other devices to connect them to this sync key.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2.5 mt-3">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save Settings</button>
        </div>
      </div>
    </div>
  );
};

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]         = useState("expenses");
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
  const [month, setMonth]     = useState(() => lsGet("selected_month_v2", "2026-07"));

  useEffect(() => {
    lsSet("selected_month_v2", month);
  }, [month]);

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

  // Sync status state
  const [syncStatus, setSyncStatus] = useState<"offline" | "connecting" | "synced" | "syncing" | "error">("offline");
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);

  const lastRemoteData = useRef("");
  const firebaseSyncRef = useRef<firebase.database.Reference | null>(null);
  const firebaseDbRef = useRef<firebase.database.Database | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const triggerGlow = (id: string) => {
    setNewlyAddedId(id);
    setTimeout(() => setNewlyAddedId(null), 1800);
  };

  // Get active month's data, pre-populating if missing
  const activeMonthData = useMemo<MonthlyDataEntry>(() => {
    if (monthlyData[month]) {
      return monthlyData[month];
    }
    
    // Fallback search for closest past month's configuration
    const sortedMonths = Object.keys(monthlyData).sort();
    const prevMonths = sortedMonths.filter(m => m < month);
    let templateIncome = DEF_INCOME;
    let templateFixed = DEF_FIXED;
    
    if (prevMonths.length > 0) {
      const closestPrevMonth = prevMonths[prevMonths.length - 1];
      const prevData = monthlyData[closestPrevMonth];
      templateIncome = prevData.income;
      // Copy fixed template, but reset "paid" status to false for the new month
      templateFixed = prevData.fixed.map(f => ({ ...f, paid: false }));
    } else {
      templateFixed = DEF_FIXED.map(f => ({ ...f, paid: false }));
    }

    return {
      income: templateIncome,
      fixed: templateFixed,
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
  };

  const setMonthFixed = (newFixed: FixedExpense[] | ((prev: FixedExpense[]) => FixedExpense[])) => {
    setMonthlyData(prev => {
      const currentList = prev[month]?.fixed || activeMonthData.fixed;
      const updatedList = typeof newFixed === 'function' ? newFixed(currentList) : newFixed;
      return {
        ...prev,
        [month]: {
          ...activeMonthData,
          fixed: updatedList
        }
      };
    });
  };

  const setMonthVarExp = (newVar: VariableExpense[] | ((prev: VariableExpense[]) => VariableExpense[])) => {
    setMonthlyData(prev => {
      const currentList = prev[month]?.varExp || activeMonthData.varExp;
      const updatedList = typeof newVar === 'function' ? newVar(currentList) : newVar;
      return {
        ...prev,
        [month]: {
          ...activeMonthData,
          varExp: updatedList
        }
      };
    });
  };

  const setMonthRecover = (newRecover: RecoveryItem[] | ((prev: RecoveryItem[]) => RecoveryItem[])) => {
    setMonthlyData(prev => {
      const currentList = prev[month]?.recover || activeMonthData.recover;
      const updatedList = typeof newRecover === 'function' ? newRecover(currentList) : newRecover;
      return {
        ...prev,
        [month]: {
          ...activeMonthData,
          recover: updatedList
        }
      };
    });
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
    const configStr = settings.firebaseConfig;
    const syncKey = settings.syncKey;

    if (firebaseSyncRef.current) {
      firebaseSyncRef.current.off();
      firebaseSyncRef.current = null;
    }
    firebaseDbRef.current = null;

    if (!configStr) {
      setSyncStatus("offline");
      return;
    }

    try {
      const config = parseFirebaseConfig(configStr);
      if (!config) {
        setSyncStatus("error");
        showToast("Invalid Firebase configuration format.", "error");
        return;
      }
      if (!config.databaseURL) {
        setSyncStatus("error");
        showToast("Firebase Config: Missing 'databaseURL'.", "error");
        return;
      }

      setSyncStatus("connecting");

      const initApp = () => {
        let app;
        if (firebase.apps.length > 0) {
          app = firebase.app();
        } else {
          app = firebase.initializeApp(config);
        }

        const db = firebase.database(app);
        firebaseDbRef.current = db;

        const resolvedKey = syncKey || (config.projectId ? config.projectId : "default");
        const ref = db.ref(`aura_expense_tracker/${resolvedKey}`);
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
      };

      if (firebase.apps.length > 0) {
        firebase.app().delete().then(initApp).catch(initApp);
      } else {
        initApp();
      }

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
  }, [settings]);

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
    <div id="root">
      {/* Custom Toast Banner */}
      {toast && (
        <div 
          className="toast-banner"
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

      {/* Sticky Global Top Header (shared month selector and settings) */}
      <header className="sticky top-0 bg-gradient-to-r from-indigo-600 to-indigo-800 text-white px-4 py-4 rounded-b-2xl shadow-md z-30 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SvgIcon name="wallet" size={18} />
            <h1 className="text-base font-bold">AuraSpend</h1>
          </div>
          <button onClick={handleOpenSettings} className="relative p-1 text-white hover:opacity-85 transition-opacity">
            <SvgIcon name="settings" size={18} />
            <span className={`absolute top-0 right-0 w-2 h-2 rounded-full border-1.5 border-indigo-600 ${
              syncStatus === 'synced' ? 'bg-emerald-400' :
              syncStatus === 'syncing' ? 'bg-blue-400' :
              syncStatus === 'connecting' ? 'bg-amber-400' :
              syncStatus === 'error' ? 'bg-rose-400' : 'bg-slate-400'
            }`} />
          </button>
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

      {/* Sync Settings Modal */}
      {showSettings && (
        <SettingsModal 
          settings={settings} 
          onClose={() => setShowSettings(false)} 
          onSave={handleSaveSettings} 
          onGenerateShareLink={handleGenerateShareLink} 
          shareLinkState={shareLinkState} 
        />
      )}
    </div>
  );
}
