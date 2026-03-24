import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "kids-spending-tracker-v1";

const KIDS = ["Grayson", "Riley"];

const EMOJI_CATEGORIES = [
  { label: "🍔 Food", value: "Rations" },
  { label: "🎮 Entertainment", value: "Artifacts" },
  { label: "👕 Clothing", value: "Scavenged" },
  { label: "📚 Education", value: "Broadcasts" },
  { label: "🚗 Transport", value: "Transit" },
  { label: "📦 Other", value: "Unknown" },
];

const CATEGORY_COLORS = {
  Rations: "#f97316",
  Artifacts: "#8b5cf6",
  Scavenged: "#ec4899",
  Broadcasts: "#06b6d4",
  Transit: "#10b981",
  Unknown: "#94a3b8",
};

const defaultKidData = (name) => ({
  name,
  balance: 0,
  transactions: [],
});

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const savedNames = parsed?.kids?.map(k => k.name) || [];
    const match = KIDS.every((name, i) => savedNames[i] === name) && savedNames.length === KIDS.length;
    return match ? parsed : null;
  } catch {
    return null;
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function formatCurrency(n) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function App() {
  const saved = loadState();
  const [kids, setKids] = useState(
    saved?.kids ||
      KIDS.map((n, i) => ({ ...defaultKidData(n), id: i }))
  );
  const [kidNames, setKidNames] = useState(
    saved?.kidNames || KIDS
  );
  const [activeKid, setActiveKid] = useState(0);
  const [view, setView] = useState("dashboard"); // dashboard | history | add | fund | setup
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState("Unknown");
  const [fundAmount, setFundAmount] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [toast, setToast] = useState(null);
  const amountRef = useRef();

  useEffect(() => {
    saveState({ kids, kidNames });
  }, [kids, kidNames]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const kid = kids[activeKid];

  function showToast(msg, type = "success") {
    setToast({ msg, type });
  }

  function handleAddFunds() {
    const val = parseFloat(fundAmount);
    if (isNaN(val) || val <= 0) return;
    setKids((prev) =>
      prev.map((k, i) =>
        i === activeKid
          ? {
              ...k,
              balance: k.balance + val,
              transactions: [
                {
                  id: Date.now(),
                  type: "credit",
                  amount: val,
                  note: "Money added",
                  category: "Credit",
                  ts: Date.now(),
                },
                ...k.transactions,
              ],
            }
          : k
      )
    );
    setFundAmount("");
    setView("dashboard");
    showToast(`${formatCurrency(val)} added!`);
  }

  function handleSpend() {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;
    if (val > kid.balance) {
      showToast("Insufficient balance!", "error");
      return;
    }
    setKids((prev) =>
      prev.map((k, i) =>
        i === activeKid
          ? {
              ...k,
              balance: k.balance - val,
              transactions: [
                {
                  id: Date.now(),
                  type: "debit",
                  amount: val,
                  note: note || "No description",
                  category,
                  ts: Date.now(),
                },
                ...k.transactions,
              ],
            }
          : k
      )
    );
    setAmount("");
    setNote("");
    setCategory("Other");
    setView("dashboard");
    showToast(`${formatCurrency(val)} traded away`);
  }

  function handleRename() {
    const name = tempName.trim();
    if (!name) return;
    setKids((prev) =>
      prev.map((k, i) => (i === activeKid ? { ...k, name } : k))
    );
    setKidNames((prev) =>
      prev.map((n, i) => (i === activeKid ? name : n))
    );
    setEditingName(false);
  }

  function handleDeleteTransaction(txId) {
    const tx = kid.transactions.find((t) => t.id === txId);
    if (!tx) return;
    setKids((prev) =>
      prev.map((k, i) =>
        i === activeKid
          ? {
              ...k,
              balance:
                k.balance +
                (tx.type === "debit" ? tx.amount : -tx.amount),
              transactions: k.transactions.filter((t) => t.id !== txId),
            }
          : k
      )
    );
    showToast("Transmission erased");
  }

  function handleReset() {
    if (!confirm(`Reset all data for ${kid.name}?`)) return;
    setKids((prev) =>
      prev.map((k, i) =>
        i === activeKid ? { ...defaultKidData(k.name), id: i } : k
      )
    );
    setView("dashboard");
    showToast("Account reset");
  }

  const pctSpent =
    kid.transactions.length > 0
      ? (() => {
          const funded = kid.transactions
            .filter((t) => t.type === "credit")
            .reduce((a, t) => a + t.amount, 0);
          if (funded === 0) return 0;
          const spent = funded - kid.balance;
          return Math.min(100, Math.max(0, (spent / funded) * 100));
        })()
      : 0;

  const categoryTotals = kid.transactions
    .filter((t) => t.type === "debit")
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

  return (
    <div style={styles.root}>
      {/* Background blobs */}
      <div style={styles.blob1} />
      <div style={styles.blob2} />

      {/* Toast */}
      {toast && (
        <div
          style={{
            ...styles.toast,
            background: toast.type === "error" ? "#ef4444" : "#10b981",
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div>
            <div style={styles.logoMark}>📒</div>
          </div>
          <h1 style={styles.title}>Ledger</h1>
          <div style={styles.headerRight} />
        </div>

        {/* Kid tabs */}
        <div style={styles.tabs}>
          {kids.map((k, i) => (
            <button
              key={k.id}
              style={{
                ...styles.tab,
                ...(i === activeKid ? styles.tabActive : {}),
              }}
              onClick={() => {
                setActiveKid(i);
                setView("dashboard");
              }}
            >
              <span style={styles.tabAvatar}>
                {["🦁", "🦋"][i]}
              </span>
              <span style={styles.tabName}>{k.name}</span>
              <span
                style={{
                  ...styles.tabBadge,
                  background:
                    k.balance <= 0 ? "#ef4444" : "rgba(16,185,129,0.2)",
                  color: k.balance <= 0 ? "#fff" : "#10b981",
                }}
              >
                {formatCurrency(k.balance)}
              </span>
            </button>
          ))}
        </div>
      </header>

      {/* Main */}
      <main style={styles.main}>
        {/* ── DASHBOARD ── */}
        {view === "dashboard" && (
          <div style={styles.fadeIn}>
            {/* Balance card */}
            <div style={styles.balanceCard}>
              <div style={styles.balanceTop}>
                <div>
                  {editingName ? (
                    <div style={styles.renameRow}>
                      <input
                        style={styles.renameInput}
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleRename()
                        }
                        autoFocus
                      />
                      <button style={styles.renameBtn} onClick={handleRename}>
                        ✓
                      </button>
                      <button
                        style={styles.renameBtnCancel}
                        onClick={() => setEditingName(false)}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div style={styles.kidNameRow}>
                      <span style={styles.kidNameDisplay}>{kid.name}</span>
                      <button
                        style={styles.editNameBtn}
                        onClick={() => {
                          setTempName(kid.name);
                          setEditingName(true);
                        }}
                        title="Rename"
                      >
                        ✏️
                      </button>
                    </div>
                  )}
                  <div style={styles.balanceLabel}>Balance</div>
                </div>
                <div style={styles.balanceAmount}>
                  {formatCurrency(kid.balance)}
                </div>
              </div>

              {/* Progress bar */}
              <div style={styles.progressWrap}>
                <div style={styles.progressTrack}>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${pctSpent}%`,
                      background:
                        pctSpent > 80
                          ? "#ef4444"
                          : pctSpent > 50
                          ? "#f97316"
                          : "#10b981",
                    }}
                  />
                </div>
                <span style={styles.progressLabel}>
                  {pctSpent.toFixed(0)}% consumed
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div style={styles.actionRow}>
              <button
                style={{ ...styles.actionBtn, ...styles.actionBtnGreen }}
                onClick={() => setView("fund")}
              >
                <span style={styles.actionIcon}>+</span>
                Add Money
              </button>
              <button
                style={{ ...styles.actionBtn, ...styles.actionBtnRed }}
                onClick={() => setView("add")}
              >
                <span style={styles.actionIcon}>−</span>
                Deduct Money
              </button>
              <button
                style={{ ...styles.actionBtn, ...styles.actionBtnBlue }}
                onClick={() => setView("history")}
              >
                <span style={styles.actionIcon}>≡</span>
                History
              </button>
            </div>

            {/* Category breakdown */}
            {Object.keys(categoryTotals).length > 0 && (
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Spending Breakdown</h3>
                {Object.entries(categoryTotals)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, total]) => {
                    const allSpent = Object.values(categoryTotals).reduce(
                      (a, v) => a + v,
                      0
                    );
                    const pct = (total / allSpent) * 100;
                    return (
                      <div key={cat} style={styles.catRow}>
                        <div style={styles.catLabel}>
                          <span
                            style={{
                              ...styles.catDot,
                              background:
                                CATEGORY_COLORS[cat] || "#94a3b8",
                            }}
                          />
                          {cat}
                        </div>
                        <div style={styles.catBar}>
                          <div
                            style={{
                              ...styles.catBarFill,
                              width: `${pct}%`,
                              background:
                                CATEGORY_COLORS[cat] || "#94a3b8",
                            }}
                          />
                        </div>
                        <div style={styles.catAmount}>
                          {formatCurrency(total)}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Recent transactions */}
            {kid.transactions.length > 0 && (
              <div style={styles.card}>
                <div style={styles.cardTitleRow}>
                  <h3 style={styles.cardTitle}>Recent</h3>
                  <button
                    style={styles.seeAllBtn}
                    onClick={() => setView("history")}
                  >
                    See history →
                  </button>
                </div>
                {kid.transactions.slice(0, 3).map((tx) => (
                  <TxRow key={tx.id} tx={tx} />
                ))}
              </div>
            )}

            {kid.transactions.length === 0 && (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>💰</div>
                <div style={styles.emptyText}>No transactions logged</div>
                <div style={styles.emptySubtext}>
                  Add money to get started
                </div>
              </div>
            )}

            <button style={styles.resetBtn} onClick={handleReset}>
              Reset Account
            </button>
          </div>
        )}

        {/* ── ADD FUNDS ── */}
        {view === "fund" && (
          <div style={styles.fadeIn}>
            <div style={styles.formCard}>
              <button style={styles.backBtn} onClick={() => setView("dashboard")}>
                ← Back
              </button>
              <h2 style={styles.formTitle}>Add Money</h2>
              <p style={styles.formSub}>
                Adding to <strong>{kid.name}</strong>'s balance
              </p>
              <label style={styles.label}>Amount</label>
              <div style={styles.amountInputWrap}>
                <span style={styles.currencySymbol}>$</span>
                <input
                  ref={amountRef}
                  style={styles.amountInput}
                  type="number"
                  placeholder="0.00"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddFunds()}
                  autoFocus
                  min="0"
                  step="0.01"
                />
              </div>
              <div style={styles.quickAmounts}>
                {[5, 10, 20, 50].map((v) => (
                  <button
                    key={v}
                    style={styles.quickBtn}
                    onClick={() => setFundAmount(String(v))}
                  >
                    ${v}
                  </button>
                ))}
              </div>
              <button style={styles.submitBtnGreen} onClick={handleAddFunds}>
                Add Money
              </button>
            </div>
          </div>
        )}

        {/* ── SPEND ── */}
        {view === "add" && (
          <div style={styles.fadeIn}>
            <div style={styles.formCard}>
              <button style={styles.backBtn} onClick={() => setView("dashboard")}>
                ← Back
              </button>
              <h2 style={styles.formTitle}>Deduct Money</h2>
              <p style={styles.formSub}>
                Balance: <strong>{formatCurrency(kid.balance)}</strong>
              </p>

              <label style={styles.label}>Amount</label>
              <div style={styles.amountInputWrap}>
                <span style={styles.currencySymbol}>$</span>
                <input
                  style={styles.amountInput}
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoFocus
                  min="0"
                  step="0.01"
                />
              </div>

              <label style={styles.label}>Category</label>
              <div style={styles.categoryGrid}>
                {EMOJI_CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    style={{
                      ...styles.catChip,
                      ...(category === c.value ? styles.catChipActive : {}),
                      borderColor:
                        category === c.value
                          ? CATEGORY_COLORS[c.value]
                          : "transparent",
                    }}
                    onClick={() => setCategory(c.value)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <label style={styles.label}>Note (optional)</label>
              <input
                style={styles.textInput}
                type="text"
                placeholder="What was this for?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSpend()}
              />

              <button style={styles.submitBtnRed} onClick={handleSpend}>
                Deduct Money
              </button>
            </div>
          </div>
        )}

        {/* ── HISTORY ── */}
        {view === "history" && (
          <div style={styles.fadeIn}>
            <div style={styles.card}>
              <div style={styles.cardTitleRow}>
                <button style={styles.backBtn} onClick={() => setView("dashboard")}>
                  ← Back
                </button>
                <h2 style={styles.formTitle}>{kid.name}'s History</h2>
              </div>
              {kid.transactions.length === 0 && (
                <div style={styles.emptyState}>
                  <div style={styles.emptyText}>No transactions</div>
                </div>
              )}
              {kid.transactions.map((tx) => (
                <TxRow
                  key={tx.id}
                  tx={tx}
                  onDelete={() => handleDeleteTransaction(tx.id)}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function TxRow({ tx, onDelete }) {
  const isCredit = tx.type === "credit";
  return (
    <div style={styles.txRow}>
      <div
        style={{
          ...styles.txIcon,
          background: isCredit
            ? "rgba(16,185,129,0.15)"
            : `${CATEGORY_COLORS[tx.category] || "#94a3b8"}22`,
          color: isCredit
            ? "#10b981"
            : CATEGORY_COLORS[tx.category] || "#94a3b8",
        }}
      >
        {isCredit ? "↑" : "↓"}
      </div>
      <div style={styles.txMeta}>
        <div style={styles.txNote}>{tx.note}</div>
        <div style={styles.txDate}>{formatDate(tx.ts)}</div>
      </div>
      <div style={styles.txRight}>
        <div
          style={{
            ...styles.txAmount,
            color: isCredit ? "#10b981" : "#f87171",
          }}
        >
          {isCredit ? "+" : "−"}
          {formatCurrency(tx.amount)}
        </div>
        {onDelete && (
          <button style={styles.deleteTxBtn} onClick={onDelete} title="Undo">
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh",
    background: "#0f1117",
    color: "#e2e8f0",
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    position: "relative",
    overflowX: "hidden",
    paddingBottom: 60,
  },
  blob1: {
    position: "fixed",
    top: -100,
    right: -100,
    width: 400,
    height: 400,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)",
    pointerEvents: "none",
    zIndex: 0,
  },
  blob2: {
    position: "fixed",
    bottom: -100,
    left: -100,
    width: 500,
    height: 500,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)",
    pointerEvents: "none",
    zIndex: 0,
  },
  toast: {
    position: "fixed",
    top: 16,
    left: "50%",
    transform: "translateX(-50%)",
    padding: "10px 24px",
    borderRadius: 100,
    fontSize: 14,
    fontWeight: 600,
    color: "#fff",
    zIndex: 1000,
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
    animation: "fadeIn 0.2s ease",
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    background: "rgba(15,17,23,0.9)",
    backdropFilter: "blur(20px)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    paddingBottom: 0,
  },
  headerInner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px 8px",
  },
  logoMark: {
    fontSize: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: "-0.5px",
    margin: 0,
    background: "linear-gradient(135deg, #e2e8f0, #94a3b8)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  headerRight: { width: 32 },
  tabs: {
    display: "flex",
    gap: 4,
    padding: "0 12px 0",
    overflowX: "auto",
  },
  tab: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 12px",
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "#64748b",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    whiteSpace: "nowrap",
    transition: "all 0.2s",
    borderRadius: "8px 8px 0 0",
  },
  tabActive: {
    color: "#e2e8f0",
    borderBottomColor: "#10b981",
    background: "rgba(16,185,129,0.06)",
  },
  tabAvatar: { fontSize: 16 },
  tabName: { fontSize: 13 },
  tabBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 7px",
    borderRadius: 100,
  },
  main: {
    maxWidth: 480,
    margin: "0 auto",
    padding: "20px 16px",
    position: "relative",
    zIndex: 1,
  },
  fadeIn: {
    animation: "fadeIn 0.25s ease",
  },
  balanceCard: {
    background: "linear-gradient(135deg, #1a1f2e 0%, #161b27 100%)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: "24px 24px 20px",
    marginBottom: 16,
    boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
  },
  balanceTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  kidNameRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  kidNameDisplay: {
    fontSize: 18,
    fontWeight: 700,
    color: "#e2e8f0",
  },
  editNameBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    opacity: 0.5,
    padding: 0,
  },
  renameRow: {
    display: "flex",
    gap: 4,
    marginBottom: 4,
  },
  renameInput: {
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(16,185,129,0.5)",
    borderRadius: 8,
    color: "#e2e8f0",
    padding: "4px 10px",
    fontSize: 15,
    fontWeight: 700,
    outline: "none",
    width: 120,
  },
  renameBtn: {
    background: "#10b981",
    border: "none",
    borderRadius: 8,
    color: "#fff",
    cursor: "pointer",
    padding: "4px 10px",
    fontWeight: 700,
  },
  renameBtnCancel: {
    background: "rgba(255,255,255,0.1)",
    border: "none",
    borderRadius: 8,
    color: "#94a3b8",
    cursor: "pointer",
    padding: "4px 10px",
  },
  balanceLabel: {
    fontSize: 12,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 600,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 800,
    letterSpacing: "-1px",
    color: "#e2e8f0",
    lineHeight: 1,
  },
  progressWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    background: "rgba(255,255,255,0.06)",
    borderRadius: 100,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 100,
    transition: "width 0.5s cubic-bezier(0.34,1.56,0.64,1)",
  },
  progressLabel: {
    fontSize: 11,
    color: "#475569",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  actionRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 10,
    marginBottom: 16,
  },
  actionBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    padding: "16px 8px",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 16,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    transition: "all 0.15s",
    background: "rgba(255,255,255,0.03)",
    color: "#e2e8f0",
  },
  actionBtnGreen: {
    borderColor: "rgba(16,185,129,0.3)",
    color: "#10b981",
  },
  actionBtnRed: {
    borderColor: "rgba(239,68,68,0.3)",
    color: "#f87171",
  },
  actionBtnBlue: {
    borderColor: "rgba(99,102,241,0.3)",
    color: "#818cf8",
  },
  actionIcon: {
    fontSize: 22,
    fontWeight: 300,
    lineHeight: 1,
  },
  card: {
    background: "#161b27",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 20,
    padding: "20px",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#475569",
    margin: "0 0 16px",
  },
  cardTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  seeAllBtn: {
    background: "none",
    border: "none",
    color: "#10b981",
    fontSize: 13,
    cursor: "pointer",
    fontWeight: 600,
  },
  catRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  catLabel: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    color: "#94a3b8",
    width: 100,
    flexShrink: 0,
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
  },
  catBar: {
    flex: 1,
    height: 5,
    background: "rgba(255,255,255,0.06)",
    borderRadius: 100,
    overflow: "hidden",
  },
  catBarFill: {
    height: "100%",
    borderRadius: 100,
  },
  catAmount: {
    fontSize: 12,
    fontWeight: 700,
    color: "#94a3b8",
    width: 60,
    textAlign: "right",
  },
  txRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 0",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    fontWeight: 700,
    flexShrink: 0,
  },
  txMeta: { flex: 1, minWidth: 0 },
  txNote: {
    fontSize: 14,
    fontWeight: 600,
    color: "#e2e8f0",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  txDate: {
    fontSize: 11,
    color: "#475569",
    marginTop: 2,
  },
  txRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 4,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  deleteTxBtn: {
    background: "none",
    border: "none",
    color: "#ef4444",
    cursor: "pointer",
    fontSize: 11,
    opacity: 0.5,
    padding: 0,
    transition: "opacity 0.15s",
  },
  emptyState: {
    textAlign: "center",
    padding: "40px 20px",
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: {
    fontSize: 16,
    fontWeight: 600,
    color: "#475569",
    marginBottom: 4,
  },
  emptySubtext: { fontSize: 13, color: "#334155" },
  resetBtn: {
    display: "block",
    margin: "8px auto 0",
    background: "none",
    border: "1px solid rgba(239,68,68,0.2)",
    borderRadius: 100,
    color: "#ef4444",
    opacity: 0.5,
    fontSize: 12,
    fontWeight: 600,
    padding: "8px 20px",
    cursor: "pointer",
  },
  formCard: {
    background: "#161b27",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 20,
    padding: 24,
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#475569",
    fontSize: 13,
    cursor: "pointer",
    padding: 0,
    marginBottom: 16,
    fontWeight: 600,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: 800,
    margin: "0 0 4px",
    letterSpacing: "-0.5px",
  },
  formSub: {
    fontSize: 13,
    color: "#475569",
    marginBottom: 24,
    margin: "0 0 24px",
  },
  label: {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "#475569",
    marginBottom: 8,
    marginTop: 16,
  },
  amountInputWrap: {
    display: "flex",
    alignItems: "center",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 14,
    overflow: "hidden",
  },
  currencySymbol: {
    padding: "0 12px",
    fontSize: 22,
    color: "#475569",
    fontWeight: 700,
  },
  amountInput: {
    flex: 1,
    background: "none",
    border: "none",
    color: "#e2e8f0",
    fontSize: 28,
    fontWeight: 800,
    padding: "14px 16px 14px 0",
    outline: "none",
    letterSpacing: "-0.5px",
  },
  quickAmounts: {
    display: "flex",
    gap: 8,
    marginTop: 12,
    flexWrap: "wrap",
  },
  quickBtn: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 100,
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: 600,
    padding: "6px 16px",
    cursor: "pointer",
  },
  categoryGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 8,
  },
  catChip: {
    background: "rgba(255,255,255,0.04)",
    border: "1.5px solid transparent",
    borderRadius: 10,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 600,
    padding: "10px 4px",
    cursor: "pointer",
    transition: "all 0.15s",
  },
  catChipActive: {
    background: "rgba(255,255,255,0.08)",
    color: "#e2e8f0",
  },
  textInput: {
    width: "100%",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    color: "#e2e8f0",
    fontSize: 15,
    padding: "14px 16px",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
    marginTop: 4,
  },
  submitBtnGreen: {
    display: "block",
    width: "100%",
    marginTop: 24,
    background: "linear-gradient(135deg, #10b981, #059669)",
    border: "none",
    borderRadius: 14,
    color: "#fff",
    fontSize: 16,
    fontWeight: 700,
    padding: "16px",
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(16,185,129,0.3)",
  },
  submitBtnRed: {
    display: "block",
    width: "100%",
    marginTop: 24,
    background: "linear-gradient(135deg, #ef4444, #dc2626)",
    border: "none",
    borderRadius: 14,
    color: "#fff",
    fontSize: 16,
    fontWeight: 700,
    padding: "16px",
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(239,68,68,0.3)",
  },
};
