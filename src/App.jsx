import { useState, useEffect, useMemo } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import { useAuth } from "./contexts/AuthContext";
import { useFirestoreSync } from "./hooks/useFirestoreSync";
import LoginButton from "./components/LoginButton";

// ── デフォルトデータ ──────────────────────────────
const DEFAULT_INCOME_CATS = ["給与", "副業", "ボーナス", "その他収入"];
const DEFAULT_EXPENSE_CATS = ["食費", "交際費", "服・ファッション", "交通費", "住居費", "医療費", "娯楽", "日用品", "その他支出"];
const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316", "#84cc16"];
const ACCOUNT_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899"];
const STORAGE_KEY = "savings_v3";

const fmt = n => `¥${Math.round(n).toLocaleString()}`;
const iStyle = { color: "#000", width: "100%", padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, boxSizing: "border-box", background: "#f8fafc" };
const card = { background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px #0001", marginBottom: 14 };

function initData() {
  try { const r = localStorage.getItem(STORAGE_KEY); if (r) return JSON.parse(r); } catch { }
  return {
    accounts: [
      { id: 1, name: "銀行口座", initial: 0 },
      { id: 2, name: "給料口座", initial: 0 },
    ],
    txList: [],
    customIncome: [],
    customExpense: [],
  };
}

// ── メインコンポーネント ──────────────────────────
export default function App() {
  const { user } = useAuth();
  const [d, setD] = useState(initData);
  const syncStatus = useFirestoreSync(d, setD);
  const [tab, setTab] = useState("dashboard");

  useFirestoreSync(d, setD);

  // 入力フォーム
  const [fType, setFType] = useState("expense");  // income | expense | transfer
  const [fDate, setFDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fAcct, setFAcct] = useState("");          // 収入・支出の口座
  const [fFrom, setFFrom] = useState("");          // 振替元
  const [fTo, setFTo] = useState("");          // 振替先
  const [fCat, setFCat] = useState("");
  const [fAmt, setFAmt] = useState("");
  const [fMemo, setFMemo] = useState("");

  // カテゴリ管理
  const [showCatMgr, setShowCatMgr] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [newCatType, setNewCatType] = useState("expense");

  // 口座管理
  const [showAcctMgr, setShowAcctMgr] = useState(false);
  const [newAcctName, setNewAcctName] = useState("");
  const [newAcctInit, setNewAcctInit] = useState("0");

  // グラフ絞り込み
  const [chartAcct, setChartAcct] = useState("all");

  // 履歴フィルター
  const [fMonth, setFMonth] = useState("");
  const [fFType, setFFType] = useState("all");
  const [fFAcct, setFFAcct] = useState("all");

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch { } }, [d]);

  // カテゴリリスト
  const incomeCats = useMemo(() => [...DEFAULT_INCOME_CATS, ...(d.customIncome || [])], [d.customIncome]);
  const expenseCats = useMemo(() => [...DEFAULT_EXPENSE_CATS, ...(d.customExpense || [])], [d.customExpense]);

  // フォームの初期カテゴリ補正
  useEffect(() => {
    setFCat(fType === "income" ? incomeCats[0] : fType === "expense" ? expenseCats[0] : "");
  }, [fType]);
  useEffect(() => {
    if (d.accounts.length > 0 && !fAcct) setFAcct(d.accounts[0].id);
  }, [d.accounts]);
  useEffect(() => {
    if (d.accounts.length >= 2) { setFFrom(d.accounts[0].id); setFTo(d.accounts[1].id); }
  }, [d.accounts]);

  // 口座ごとの残高計算
  const accountBalances = useMemo(() => {
    const map = {};
    d.accounts.forEach(a => { map[a.id] = a.initial || 0; });
    (d.txList || []).forEach(t => {
      if (t.type === "income") { map[t.acct] = (map[t.acct] || 0) + t.amount; }
      if (t.type === "expense") { map[t.acct] = (map[t.acct] || 0) - t.amount; }
      if (t.type === "transfer") {
        map[t.from] = (map[t.from] || 0) - t.amount;
        map[t.to] = (map[t.to] || 0) + t.amount;
      }
    });
    return map;
  }, [d]);

  const totalBalance = useMemo(() =>
    d.accounts.reduce((s, a) => s + (accountBalances[a.id] || 0), 0), [d.accounts, accountBalances]);

  // 月別収支
  const monthlyData = useMemo(() => {
    const map = {};
    (d.txList || []).filter(t => t.type !== "transfer" && (chartAcct === "all" || String(t.acct) === String(chartAcct))).forEach(t => {
      const m = t.date.slice(0, 7);
      if (!map[m]) map[m] = { month: m, income: 0, expense: 0 };
      t.type === "income" ? map[m].income += t.amount : map[m].expense += t.amount;
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).map(m => ({ ...m, label: m.month.replace("-", "/") }));
  }, [d.txList, chartAcct]);

  // 口座別残高推移
  const balanceHistory = useMemo(() => {
    const accts = chartAcct === "all" ? d.accounts : d.accounts.filter(a => String(a.id) === String(chartAcct));
    const initMap = {};
    accts.forEach(a => { initMap[a.id] = a.initial || 0; });
    const sorted = [...(d.txList || [])].sort((a, b) => a.date.localeCompare(b.date));
    const points = [{ label: "開始", ...Object.fromEntries(accts.map(a => [a.name, initMap[a.id]])) }];
    const cur = { ...initMap };
    sorted.forEach(t => {
      if (t.type === "income") cur[t.acct] = (cur[t.acct] || 0) + t.amount;
      if (t.type === "expense") cur[t.acct] = (cur[t.acct] || 0) - t.amount;
      if (t.type === "transfer") { cur[t.from] = (cur[t.from] || 0) - t.amount; cur[t.to] = (cur[t.to] || 0) + t.amount; }
      const relevant = accts.some(a => t.acct === a.id || t.from === a.id || t.to === a.id);
      if (relevant) points.push({ label: t.date.slice(5), ...Object.fromEntries(accts.map(a => [a.name, cur[a.id] || 0])) });
    });
    return points;
  }, [d, chartAcct]);

  // カテゴリ内訳 期間フィルター
  const [catFrom, setCatFrom] = useState("");
  const [catTo, setCatTo] = useState("");

  const categoryData = useMemo(() => {
    const map = {};
    (d.txList || []).filter(t => {
      if (t.type !== "expense") return false;
      if (catFrom && t.date < catFrom) return false;
      if (catTo && t.date > catTo) return false;
      return true;
    }).forEach(t => { map[t.cat] = (map[t.cat] || 0) + t.amount; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [d.txList, catFrom, catTo]);

  // 履歴フィルター
  const filteredTx = useMemo(() => {
    return [...(d.txList || [])].sort((a, b) => b.date.localeCompare(a.date)).filter(t => {
      if (fMonth && !t.date.startsWith(fMonth)) return false;
      if (fFType !== "all" && t.type !== fFType) return false;
      if (fFAcct !== "all") {
        if (t.type === "transfer" && String(t.from) !== fFAcct && String(t.to) !== fFAcct) return false;
        if (t.type !== "transfer" && String(t.acct) !== fFAcct) return false;
      }
      return true;
    });
  }, [d.txList, fMonth, fFType, fFAcct]);

  // ── 操作 ───────────────────────────────────────
  const addTx = () => {
    const amt = parseFloat(fAmt);
    if (!amt || amt <= 0) return;
    let tx = { id: Date.now(), date: fDate, type: fType, amount: amt, memo: fMemo };
    if (fType === "transfer") { tx.from = Number(fFrom); tx.to = Number(fTo); }
    else { tx.acct = Number(fAcct); tx.cat = fCat; }
    setD(p => ({ ...p, txList: [...(p.txList || []), tx] }));
    setFAmt(""); setFMemo("");
  };

  const delTx = id => setD(p => ({ ...p, txList: (p.txList || []).filter(t => t.id !== id) }));

  const addAccount = () => {
    const name = newAcctName.trim();
    if (!name) return;
    const id = Date.now();
    setD(p => ({ ...p, accounts: [...p.accounts, { id, name, initial: parseFloat(newAcctInit) || 0 }] }));
    setNewAcctName(""); setNewAcctInit("0");
  };

  const delAccount = id => {
    setD(p => ({ ...p, accounts: p.accounts.filter(a => a.id !== id), txList: (p.txList || []).filter(t => t.acct !== id && t.from !== id && t.to !== id) }));
  };

  const updateInitial = (id, val) => {
    setD(p => ({ ...p, accounts: p.accounts.map(a => a.id === id ? { ...a, initial: parseFloat(val) || 0 } : a) }));
  };

  const addCat = () => {
    const name = newCat.trim(); if (!name) return;
    const key = newCatType === "income" ? "customIncome" : "customExpense";
    const list = newCatType === "income" ? incomeCats : expenseCats;
    if (list.includes(name)) return;
    setD(p => ({ ...p, [key]: [...(p[key] || []), name] }));
    setNewCat("");
  };
  const delCat = (name, type) => {
    const key = type === "income" ? "customIncome" : "customExpense";
    setD(p => ({ ...p, [key]: (p[key] || []).filter(c => c !== name) }));
  };

  const acctName = id => (d.accounts.find(a => a.id === id) || {}).name || "不明";

  // ── UI ────────────────────────────────────────
  const tabs = [
    { id: "dashboard", label: "📊 ダッシュボード" },
    { id: "input", label: "➕ 入力" },
    { id: "history", label: "📋 履歴" },
    { id: "settings", label: "⚙️ 設定" },
  ];

  const thisM = new Date().toISOString().slice(0, 7);
  const mIncome = (d.txList || []).filter(t => t.date.startsWith(thisM) && t.type === "income").reduce((s, t) => s + t.amount, 0);
  const mExpense = (d.txList || []).filter(t => t.date.startsWith(thisM) && t.type === "expense").reduce((s, t) => s + t.amount, 0);

  return (
    <div style={{ fontFamily: "sans-serif", background: "#f1f5f9", minHeight: "100vh", color: "#1e293b" }}>

      {/* ヘッダー */}
<div style={{
  background: "linear-gradient(135deg,#6366f1,#818cf8)",
  color: "#fff",
  padding: "20px",           // 余白を少し広げてバランス調整
  display: "flex",
  flexDirection: "column",    // 縦並びにすることで、狭い画面でも重ならない
  alignItems: "center",       // すべての要素を水平方向の中央に配置
  textAlign: "center",        // テキストを中央揃えに
  gap: "12px"                 // 金額とボタンの間の距離を詰めて配置
}}>
  {/* 中央：タイトルと金額 */}
  <div>
    <div style={{ fontSize: 16, fontWeight: 700, opacity: 0.9 }}>
      💰シンプル家計簿
      {/* 保存ステータスの表示 */}
          {syncStatus && (
            <span style={{ 
              fontSize: 10, 
              fontWeight: 400, 
              marginLeft: 10, 
              padding: "2px 6px", 
              background: "rgba(255,255,255,0.2)", 
              borderRadius: 4,
              color: syncStatus.type === 'error' ? '#ffcfcf' : '#fff'
            }}>
              {syncStatus.msg}
            </span>
          )}
    </div>
    <div style={{ fontSize: 32, fontWeight: 800, marginTop: 2 }}>{fmt(totalBalance)}</div>
    <div style={{ fontSize: 11, opacity: 0.7, marginTop: 5}}>総合計残高</div>
  </div>

  {/* 下部：ログインボタン（中央に配置される） */}
  <div style={{ flexShrink: 0 }}>
    <LoginButton />
  </div>
</div>

      {/* タブ */}
      <div style={{ display: "flex", background: "#fff", borderBottom: "1px solid #e2e8f0", overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, minWidth: 80, padding: "11px 4px", border: "none", background: "none", cursor: "pointer",
            fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? "#6366f1" : "#64748b",
            borderBottom: tab === t.id ? "2px solid #6366f1" : "2px solid transparent", fontSize: 12, whiteSpace: "nowrap"
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: 14, maxWidth: 700, margin: "0 auto" }}>

        {/* ── ダッシュボード ── */}
        {tab === "dashboard" && <>

          {/* 口座残高カード */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 10, marginBottom: 14 }}>
            {d.accounts.map((a, i) => (
              <div key={a.id} style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 1px 4px #0001", borderTop: `3px solid ${ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]}` }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{a.name}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: accountBalances[a.id] >= 0 ? "#1e293b" : "#ef4444" }}>{fmt(accountBalances[a.id] || 0)}</div>
              </div>
            ))}
          </div>

          {/* 今月サマリー */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            {[{ label: "今月の収入", value: mIncome, color: "#10b981" }, { label: "今月の支出", value: mExpense, color: "#ef4444" }].map(s => (
              <div key={s.label} style={{ ...card, marginBottom: 0 }}>
                <div style={{ fontSize: 11, color: "#64748b" }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{fmt(s.value)}</div>
              </div>
            ))}
          </div>

          {/* 口座絞り込み */}
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {[{ id: "all", name: "すべて" }, ...d.accounts].map((a, i) => (
              <button key={a.id} onClick={() => setChartAcct(String(a.id))} style={{
                padding: "5px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: String(chartAcct) === String(a.id) ? (i === 0 ? "#6366f1" : ACCOUNT_COLORS[(i - 1) % ACCOUNT_COLORS.length]) : "#e2e8f0",
                color: String(chartAcct) === String(a.id) ? "#fff" : "#64748b"
              }}>{a.name}</button>
            ))}
          </div>

          {/* 残高推移 */}
          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>残高推移</div>
            {balanceHistory.length > 1 ? (
              <ResponsiveContainer width="100%" height={190}>
                <LineChart data={balanceHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `¥${(v / 10000).toFixed(0)}万`} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Legend />
                  {(chartAcct === "all" ? d.accounts : d.accounts.filter(a => String(a.id) === String(chartAcct))).map((a, i) => (
                    <Line key={a.id} type="monotone" dataKey={a.name} stroke={ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </div>

          {/* 月別収支 */}
          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>月別収支</div>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthlyData}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `¥${(v / 10000).toFixed(0)}万`} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Legend />
                  <Bar dataKey="income" name="収入" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="支出" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </div>

          {/* カテゴリ内訳 */}
          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>支出カテゴリ内訳</div>
            {/* 期間指定 */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
              <input type="date" value={catFrom} onChange={e => setCatFrom(e.target.value)}
                style={{ ...iStyle, flex: 1, minWidth: 120, fontSize: 12, padding: "6px 8px" }} />
              <span style={{ color: "#94a3b8", fontSize: 12 }}>〜</span>
              <input type="date" value={catTo} onChange={e => setCatTo(e.target.value)}
                style={{ ...iStyle, flex: 1, minWidth: 120, fontSize: 12, padding: "6px 8px" }} />
              {(catFrom || catTo) && (
                <button onClick={() => { setCatFrom(""); setCatTo(""); }} style={{ padding: "5px 10px", background: "#f1f5f9", border: "none", borderRadius: 7, cursor: "pointer", color: "#64748b", fontSize: 11, whiteSpace: "nowrap" }}>
                  リセット
                </button>
              )}
            </div>
            {categoryData.length > 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <PieChart width={150} height={150}>
                  <Pie data={categoryData} cx={70} cy={70} innerRadius={42} outerRadius={65} dataKey="value">
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => fmt(v)} />
                </PieChart>
                <div style={{ flex: 1 }}>
                  {categoryData.map((c, i) => (
                    <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                      <div style={{ width: 9, height: 9, borderRadius: "50%", background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 11 }}>{c.name}</div>
                      <div style={{ fontSize: 11, fontWeight: 600 }}>{fmt(c.value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : <Empty />}
          </div>
        </>}

        {/* ── 入力 ── */}
        {tab === "input" && (
          <div style={{ ...card }}>
            <div style={{ fontWeight: 700, marginBottom: 14 }}>取引を入力</div>

            {/* タイプ選択 */}
            <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 8, padding: 4, marginBottom: 14 }}>
              {[["expense", "支出"], ["income", "収入"], ["transfer", "振替"]].map(([v, l]) => (
                <button key={v} onClick={() => setFType(v)} style={{
                  flex: 1, padding: "7px 0", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13,
                  background: fType === v ? (v === "income" ? "#10b981" : v === "transfer" ? "#f59e0b" : "#6366f1") : "transparent",
                  color: fType === v ? "#fff" : "#64748b"
                }}>{l}</button>
              ))}
            </div>

            {/* 日付 */}
            <Field label="日付"><input type="date" value={fDate} onChange={e => setFDate(e.target.value)} style={iStyle} /></Field>

            {/* 振替 or 収支 */}
            {fType === "transfer" ? <>
              <Field label="振替元">
                <select value={fFrom} onChange={e => setFFrom(e.target.value)} style={iStyle}>
                  {d.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
              <Field label="振替先">
                <select value={fTo} onChange={e => setFTo(e.target.value)} style={iStyle}>
                  {d.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
            </> : <>
              <Field label="口座">
                <select value={fAcct} onChange={e => setFAcct(e.target.value)} style={iStyle}>
                  {d.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
              <Field label="カテゴリ">
                <select value={fCat} onChange={e => setFCat(e.target.value)} style={iStyle}>
                  {(fType === "income" ? incomeCats : expenseCats).map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
            </>}

            <Field label="金額（円）"><input type="number" placeholder="0" value={fAmt} onChange={e => setFAmt(e.target.value)} style={iStyle} /></Field>
            <Field label="メモ"><input type="text" placeholder="任意" value={fMemo} onChange={e => setFMemo(e.target.value)} style={iStyle} /></Field>

            <button onClick={addTx} style={{ width: "100%", padding: "12px 0", background: fType === "income" ? "#10b981" : fType === "transfer" ? "#f59e0b" : "#6366f1", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer", marginTop: 6 }}>
              追加する
            </button>

            {/* カテゴリ管理 */}
            <button onClick={() => setShowCatMgr(v => !v)} style={{ width: "100%", marginTop: 10, padding: "8px 0", background: "none", border: "1px dashed #cbd5e1", borderRadius: 10, color: "#64748b", cursor: "pointer", fontSize: 12 }}>
              {showCatMgr ? "▲ カテゴリ管理を閉じる" : "⚙️ カテゴリを追加・管理する"}
            </button>
            {showCatMgr && (
              <div style={{ marginTop: 10, background: "#f8fafc", borderRadius: 10, padding: 12, border: "1px solid #e2e8f0" }}>
                <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>カテゴリ管理</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <select value={newCatType} onChange={e => setNewCatType(e.target.value)} style={{ ...iStyle, width: 70, flex: "none" }}>
                    <option value="expense">支出</option>
                    <option value="income">収入</option>
                  </select>
                  <input value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => e.key === "Enter" && addCat()} placeholder="カテゴリ名" style={{ ...iStyle, flex: 1 }} />
                  <button onClick={addCat} style={{ padding: "8px 12px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 16 }}>＋</button>
                </div>
                {["expense", "income"].map(tp => {
                  const list = tp === "income" ? (d.customIncome || []) : (d.customExpense || []);
                  if (!list.length) return null;
                  return <div key={tp} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 5 }}>{tp === "income" ? "収入" : "支出"}（追加済み）</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {list.map(c => (
                        <span key={c} style={{ display: "flex", alignItems: "center", gap: 4, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 20, padding: "3px 10px", fontSize: 12 }}>
                          {c}<button onClick={() => delCat(c, tp)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 11, padding: 0 }}>✕</button>
                        </span>
                      ))}
                    </div>
                  </div>;
                })}
                <div style={{ fontSize: 10, color: "#94a3b8" }}>※ デフォルトカテゴリは削除できません</div>
              </div>
            )}
          </div>
        )}

        {/* ── 履歴 ── */}
        {tab === "history" && <>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <input type="month" value={fMonth} onChange={e => setFMonth(e.target.value)} style={{ ...iStyle, flex: 1, minWidth: 120 }} />
            <select value={fFType} onChange={e => setFFType(e.target.value)} style={{ ...iStyle, flex: 1, minWidth: 100 }}>
              <option value="all">すべて</option>
              <option value="income">収入</option>
              <option value="expense">支出</option>
              <option value="transfer">振替</option>
            </select>
            <select value={fFAcct} onChange={e => setFFAcct(e.target.value)} style={{ ...iStyle, flex: 1, minWidth: 100 }}>
              <option value="all">全口座</option>
              {d.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          {filteredTx.length === 0
            ? <div style={{ textAlign: "center", color: "#94a3b8", padding: "40px 0" }}>取引がありません</div>
            : filteredTx.map(t => {
              const isTransfer = t.type === "transfer";
              return (
                <div key={t.id} style={{ background: "#fff", borderRadius: 10, padding: "11px 14px", marginBottom: 8, boxShadow: "0 1px 3px #0001", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: isTransfer ? "#fef3c7" : t.type === "income" ? "#d1fae5" : "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
                    {isTransfer ? "🔄" : t.type === "income" ? "📈" : "📉"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {isTransfer ? `${acctName(t.from)} → ${acctName(t.to)}` : `${t.cat} ／ ${acctName(t.acct)}`}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{t.date}{t.memo ? ` · ${t.memo}` : ""}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: isTransfer ? "#f59e0b" : t.type === "income" ? "#10b981" : "#ef4444", fontSize: 14 }}>
                    {isTransfer ? "" : t.type === "income" ? "+" : "-"}{fmt(t.amount)}
                  </div>
                  <button onClick={() => delTx(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", fontSize: 15, padding: 4 }}>✕</button>
                </div>
              );
            })
          }
        </>}

        {/* ── 設定 ── */}
        {tab === "settings" && (
          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 14 }}>口座の管理</div>

            {/* 口座一覧 */}
            {d.accounts.map((a, i) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "10px 12px", background: "#f8fafc", borderRadius: 10, borderLeft: `4px solid ${ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]}` }}>
                <div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{a.name}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>初期残高</div>
                <input type="number" defaultValue={a.initial || 0} onBlur={e => updateInitial(a.id, e.target.value)}
                  style={{ width: 100, padding: "5px 8px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, textAlign: "right" }} />
                <button onClick={() => delAccount(a.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", fontSize: 16, padding: 4 }}>✕</button>
              </div>
            ))}

            {/* 口座追加 */}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input value={newAcctName} onChange={e => setNewAcctName(e.target.value)} onKeyDown={e => e.key === "Enter" && addAccount()} placeholder="口座名（例：現金）" style={{ ...iStyle, flex: 2 }} />
              <input type="number" value={newAcctInit} onChange={e => setNewAcctInit(e.target.value)} placeholder="初期残高" style={{ ...iStyle, flex: 1 }} />
              <button onClick={addAccount} style={{ padding: "8px 14px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>＋</button>
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>※ 口座を削除するとその口座の取引もすべて削除されます</div>
          </div>
        )}

      </div>
      {/* ── フッター ── */}
      <footer style={{
        textAlign: "center",
        padding: "30px 10px 40px", // 下に少し余裕を持たせる
        fontSize: 11,
        color: "#fff",
        backgroundColor: "#333",
        opacity: 0.6,              // 小さく控えめにする
        fontFamily: "sans-serif"
      }}>
        copyright: Shunichiro Sakamoto (2026)
      </footer>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

function Empty() {
  return <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: "28px 0" }}>データを入力すると表示されます</div>;
}