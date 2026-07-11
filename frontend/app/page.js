"use client";

import { useMemo, useState } from "react";

const farmers = [
  {
    id: "F-2048",
    name: "Aline Mukamana",
    cooperative: "Twitezimbere Maize Cooperative",
    district: "Musanze",
    crop: "Maize",
    upi: "UPI-RWA-034-6621",
    phone: "+250 788 104 221",
    land: "1.6 ha",
    season: "2026 A",
    avatar: "AM",
    transactions: [
      { date: "2026-06-22", type: "Buyer payment", amount: 420000, status: "Paid on time" },
      { date: "2026-05-19", type: "Input loan", amount: -120000, status: "Repaid early" },
      { date: "2026-04-05", type: "Co-op savings", amount: 35000, status: "Consistent" },
      { date: "2026-02-15", type: "Insurance premium", amount: -18000, status: "Covered" },
      { date: "2026-01-08", type: "Buyer payment", amount: 310000, status: "Paid on time" },
    ],
    signals: {
      repayment: 97,
      income: 84,
      consistency: 91,
      insurance: 78,
      market: 88,
    },
  },
  {
    id: "F-1182",
    name: "Jean Claude Niyonzima",
    cooperative: "Kayonza Horticulture Union",
    district: "Kayonza",
    crop: "Tomatoes",
    upi: "UPI-RWA-018-4410",
    phone: "+250 782 884 019",
    land: "0.9 ha",
    season: "2026 B",
    avatar: "JN",
    transactions: [
      { date: "2026-06-29", type: "Aggregation sale", amount: 180000, status: "Paid on time" },
      { date: "2026-05-13", type: "Input loan", amount: -90000, status: "Partial repayment" },
      { date: "2026-04-28", type: "Mobile money sale", amount: 74000, status: "Verified" },
      { date: "2026-03-04", type: "Co-op savings", amount: 12000, status: "Irregular" },
    ],
    signals: {
      repayment: 68,
      income: 62,
      consistency: 58,
      insurance: 45,
      market: 71,
    },
  },
  {
    id: "F-3310",
    name: "Vestine Uwase",
    cooperative: "Nyagatare Dairy Network",
    district: "Nyagatare",
    crop: "Dairy",
    upi: "UPI-RWA-051-7820",
    phone: "+250 789 441 736",
    land: "2.4 ha",
    season: "Rolling",
    avatar: "VU",
    transactions: [
      { date: "2026-07-01", type: "Milk delivery", amount: 98000, status: "Verified" },
      { date: "2026-06-24", type: "Milk delivery", amount: 104000, status: "Verified" },
      { date: "2026-05-30", type: "Equipment loan", amount: -260000, status: "Repaid on time" },
      { date: "2026-04-30", type: "Insurance premium", amount: -22000, status: "Covered" },
      { date: "2026-03-30", type: "Co-op savings", amount: 45000, status: "Consistent" },
    ],
    signals: {
      repayment: 92,
      income: 93,
      consistency: 88,
      insurance: 82,
      market: 76,
    },
  },
];

const weights = {
  repayment: 0.34,
  income: 0.23,
  consistency: 0.18,
  insurance: 0.13,
  market: 0.12,
};

function calculateScore(signals) {
  const weighted = Object.entries(weights).reduce(
    (sum, [key, weight]) => sum + signals[key] * weight,
    0
  );
  return Math.round(300 + weighted * 5.5);
}

function getBand(score) {
  if (score >= 760) return { label: "Excellent", tone: "excellent", decision: "Eligible for larger seasonal loans" };
  if (score >= 680) return { label: "Strong", tone: "strong", decision: "Eligible for standard input credit" };
  if (score >= 600) return { label: "Watch", tone: "watch", decision: "Offer smaller loan with co-op guarantee" };
  return { label: "Build", tone: "build", decision: "Start with savings plan and insurance bundle" };
}

function formatCurrency(value) {
  const sign = value < 0 ? "-" : "";
  return `${sign}RWF ${Math.abs(value).toLocaleString("en-US")}`;
}

export default function Home() {
  const [mode, setMode] = useState("login");
  const [isAuthed, setIsAuthed] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(farmers[0].id);

  const selectedFarmer = farmers.find((farmer) => farmer.id === selectedId) || farmers[0];
  const score = calculateScore(selectedFarmer.signals);
  const band = getBand(score);

  const filteredFarmers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return farmers;
    return farmers.filter((farmer) =>
      [farmer.name, farmer.id, farmer.cooperative, farmer.district, farmer.crop, farmer.upi]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [query]);

  function handleSubmit(event) {
    event.preventDefault();
    setIsAuthed(true);
  }

  if (!isAuthed) {
    return (
      <main className="auth-shell">
        <section className="auth-visual">
          <nav className="brand-row" aria-label="Product">
            <span className="brand-mark">U</span>
            <span>Umuhinzi Score</span>
          </nav>
          <div className="hero-copy">
            <p className="eyebrow">Agri-finance prototype</p>
            <h1>Credit decisions built around real farmer activity.</h1>
            <p>
              Search a farmer, review verified transactions, and translate repayment,
              market, insurance, and savings signals into a clear lending score.
            </p>
          </div>
          <div className="impact-strip" aria-label="Hackathon context">
            <span>Smallholder-first</span>
            <span>Co-op ready</span>
            <span>Rwanda agriculture</span>
          </div>
        </section>

        <section className="auth-panel" aria-label="Authentication">
          <div className="mode-toggle">
            <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
              Login
            </button>
            <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
              Register
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div>
              <p className="eyebrow">{mode === "login" ? "Welcome back" : "Create an account"}</p>
              <h2>{mode === "login" ? "Access farmer scoring" : "Join the credit desk"}</h2>
            </div>

            {mode === "register" && (
              <label>
                Organization
                <input required placeholder="Co-op, bank, insurer, or agribusiness" />
              </label>
            )}
            <label>
              Email
              <input required type="email" placeholder="analyst@umuhinzi.rw" />
            </label>
            <label>
              Password
              <input required type="password" placeholder="Enter password" />
            </label>
            {mode === "register" && (
              <label>
                Role
                <select defaultValue="credit-officer">
                  <option value="credit-officer">Credit officer</option>
                  <option value="cooperative-admin">Cooperative admin</option>
                  <option value="insurance-partner">Insurance partner</option>
                </select>
              </label>
            )}
            <button className="primary-action" type="submit">
              {mode === "login" ? "Open dashboard" : "Create account"}
            </button>
            <p className="form-note">
              Prototype mode: use any valid email and password to continue.
            </p>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <span className="brand-mark">U</span>
          <span>Umuhinzi Score</span>
        </div>
        <div className="nav-stack" aria-label="Primary">
          <button className="nav-item active">Farmer Search</button>
          <button className="nav-item">Credit Rules</button>
          <button className="nav-item">Insurance Bundles</button>
          <button className="nav-item">Reports</button>
        </div>
        <button className="secondary-action" onClick={() => setIsAuthed(false)}>
          Sign out
        </button>
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Agri-finance desk</p>
            <h1>Farmer credit score</h1>
          </div>
          <div className="header-stat">
            <span>Dataset</span>
            <strong>Transactions + UPI + co-op history</strong>
          </div>
        </header>

        <section className="search-band">
          <label>
            Search farmer
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, farmer ID, crop, district, co-op, or UPI"
            />
          </label>
          <div className="result-list" aria-label="Search results">
            {filteredFarmers.map((farmer) => (
              <button
                key={farmer.id}
                className={farmer.id === selectedFarmer.id ? "farmer-result active" : "farmer-result"}
                onClick={() => setSelectedId(farmer.id)}
              >
                <span className="avatar">{farmer.avatar}</span>
                <span>
                  <strong>{farmer.name}</strong>
                  <small>{farmer.id} · {farmer.district} · {farmer.crop}</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="score-layout">
          <article className="score-card">
            <div className="farmer-heading">
              <span className="avatar large">{selectedFarmer.avatar}</span>
              <div>
                <h2>{selectedFarmer.name}</h2>
                <p>{selectedFarmer.cooperative}</p>
              </div>
            </div>

            <div className={`score-ring ${band.tone}`} style={{ "--score": `${((score - 300) / 550) * 100}%` }}>
              <div>
                <span>{score}</span>
                <small>{band.label}</small>
              </div>
            </div>

            <div className="decision-box">
              <span>Recommendation</span>
              <strong>{band.decision}</strong>
            </div>
          </article>

          <article className="profile-card">
            <h3>Farmer profile</h3>
            <dl className="profile-grid">
              <div><dt>UPI</dt><dd>{selectedFarmer.upi}</dd></div>
              <div><dt>Phone</dt><dd>{selectedFarmer.phone}</dd></div>
              <div><dt>Land</dt><dd>{selectedFarmer.land}</dd></div>
              <div><dt>Season</dt><dd>{selectedFarmer.season}</dd></div>
            </dl>
          </article>
        </section>

        <section className="evidence-layout">
          <article className="signals-card">
            <h3>Score drivers</h3>
            {Object.entries(selectedFarmer.signals).map(([key, value]) => (
              <div className="signal-row" key={key}>
                <div>
                  <strong>{key.replace(/^\w/, (letter) => letter.toUpperCase())}</strong>
                  <span>{Math.round(weights[key] * 100)}% weight</span>
                </div>
                <meter min="0" max="100" value={value} />
                <b>{value}</b>
              </div>
            ))}
          </article>

          <article className="transactions-card">
            <div className="section-title">
              <h3>Verified transactions</h3>
              <span>{selectedFarmer.transactions.length} records</span>
            </div>
            <div className="transaction-list">
              {selectedFarmer.transactions.map((transaction) => (
                <div className="transaction-row" key={`${transaction.date}-${transaction.type}`}>
                  <div>
                    <strong>{transaction.type}</strong>
                    <span>{transaction.date} · {transaction.status}</span>
                  </div>
                  <b className={transaction.amount < 0 ? "negative" : "positive"}>
                    {formatCurrency(transaction.amount)}
                  </b>
                </div>
              ))}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
