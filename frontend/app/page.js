"use client";

import { useEffect, useMemo, useState } from "react";

const emptyRegisterForm = {
  name: "",
  organization: "",
  role: "Credit officer",
  email: "",
  password: "",
  confirmPassword: "",
};

function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatCurrency(value) {
  const sign = value < 0 ? "-" : "";
  return `${sign}RWF ${Math.abs(value).toLocaleString("en-US")}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function getBand(score) {
  if (score >= 760) {
    return {
      label: "Excellent",
      tone: "excellent",
      decision: "Approve larger seasonal credit with bundled cover",
    };
  }
  if (score >= 680) {
    return {
      label: "Strong",
      tone: "strong",
      decision: "Approve standard input credit",
    };
  }
  if (score >= 600) {
    return {
      label: "Watch",
      tone: "watch",
      decision: "Approve smaller credit with cooperative guarantee",
    };
  }
  return {
    label: "Build",
    tone: "build",
    decision: "Start with savings plan before new credit",
  };
}

function SignalBar({ label, detail, value }) {
  return (
    <div className="signal-row">
      <div>
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
      <meter min="0" max="100" value={value} />
      <b>{value}</b>
    </div>
  );
}

function TrendBars({ trend }) {
  const maxAmount = Math.max(
    ...trend.map((month) => Math.max(month.incoming_rwf, month.outgoing_rwf)),
    1
  );

  return (
    <div className="trend-bars" aria-label="Monthly transaction trend">
      {trend.slice(-12).map((month) => (
        <div className="trend-month" key={month.month}>
          <div className="trend-stack">
            <span
              className="incoming-bar"
              style={{ height: `${Math.max((month.incoming_rwf / maxAmount) * 100, 4)}%` }}
            />
            <span
              className="outgoing-bar"
              style={{ height: `${Math.max((month.outgoing_rwf / maxAmount) * 100, 4)}%` }}
            />
          </div>
          <small>{month.month.slice(5)}</small>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [authReady, setAuthReady] = useState(false);
  const [mode, setMode] = useState("login");
  const [currentUser, setCurrentUser] = useState(null);
  const [adminCredentials, setAdminCredentials] = useState(null);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState(emptyRegisterForm);
  const [datasetSummary, setDatasetSummary] = useState(null);
  const [farmers, setFarmers] = useState([]);
  const [dataset, setDataset] = useState(null);
  const [dataStatus, setDataStatus] = useState("idle");
  const [dataError, setDataError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [transactionView, setTransactionView] = useState("all");
  const [transactionPage, setTransactionPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    let isMounted = true;

    async function boot() {
      try {
        const [sessionResponse, summaryResponse] = await Promise.all([
          globalThis.fetch("/api/auth/me", { credentials: "same-origin" }),
          globalThis.fetch("/api/dataset/summary"),
        ]);

        if (summaryResponse.ok) {
          const summary = await summaryResponse.json();
          if (isMounted) setDatasetSummary(summary);
        }

        if (sessionResponse.ok) {
          const session = await sessionResponse.json();
          if (isMounted) {
            if (session.user) setCurrentUser(session.user);
            if (session.adminCredentials) {
              setAdminCredentials(session.adminCredentials);
              setLoginForm((form) => ({
                email: form.email || session.adminCredentials.email,
                password: form.password,
              }));
            }
          }
        }
      } finally {
        if (isMounted) setAuthReady(true);
      }
    }

    boot();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    let isMounted = true;
    async function loadFarmers() {
      setDataStatus("loading");
      setDataError("");

      try {
        const response = await globalThis.fetch("/api/farmers", { credentials: "same-origin" });
        if (response.status === 401) {
          setCurrentUser(null);
          return;
        }
        if (!response.ok) throw new Error("Unable to load farmer transaction data.");
        const payload = await response.json();

        if (isMounted) {
          setDataset(payload.dataset);
          setFarmers(payload.farmers);
          setSelectedId((existingId) => existingId || payload.farmers[0]?.farmer_id || "");
          setDataStatus("ready");
        }
      } catch (error) {
        if (isMounted) {
          setDataError(error.message);
          setDataStatus("error");
        }
      }
    }

    loadFarmers();
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const filteredFarmers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return farmers;

    return farmers.filter((farmer) =>
      [
        farmer.name,
        farmer.farmer_id,
        farmer.msisdn,
        farmer.district,
        farmer.primary_activity,
        farmer.score.band,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [farmers, query]);

  const selectedFarmer =
    filteredFarmers.find((farmer) => farmer.farmer_id === selectedId) ||
    farmers.find((farmer) => farmer.farmer_id === selectedId) ||
    filteredFarmers[0];
  const selectedBand = selectedFarmer ? getBand(selectedFarmer.score.value) : null;

  const filteredTransactions = useMemo(() => {
    if (!selectedFarmer) return [];
    return selectedFarmer.transactions.filter(
      (transaction) => transactionView === "all" || transaction.direction === transactionView
    );
  }, [selectedFarmer, transactionView]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const currentPage = Math.min(transactionPage, totalPages);
  const visibleTransactions = filteredTransactions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  async function handleLogin(event) {
    event.preventDefault();
    setAuthError("");
    setAuthMessage("");

    const response = await globalThis.fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(loginForm),
    });
    const payload = await response.json();

    if (!response.ok) {
      setAuthError(payload.error || "Unable to sign in.");
      return;
    }

    setCurrentUser(payload.user);
    setAuthMessage(`Welcome back, ${payload.user.name.split(" ")[0]}.`);
  }

  async function handleRegister(event) {
    event.preventDefault();
    setAuthError("");
    setAuthMessage("");

    const response = await globalThis.fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(registerForm),
    });
    const payload = await response.json();

    if (!response.ok) {
      setAuthError(payload.error || "Unable to create account.");
      return;
    }

    setRegisterForm(emptyRegisterForm);
    setCurrentUser(payload.user);
    setMode("login");
  }

  async function handleSignOut() {
    await globalThis.fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    setCurrentUser(null);
    setFarmers([]);
    setDataset(null);
    setSelectedId("");
    setDataStatus("idle");
    setAuthMessage("Signed out.");
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setAuthError("");
    setAuthMessage("");
  }

  if (!authReady) {
    return (
      <main className="loading-shell">
        <div className="loading-mark">I</div>
        <p>Preparing credit desk</p>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className="auth-shell">
        <section className="auth-visual" aria-label="Imboni credit scoring">
          <nav className="brand-row" aria-label="Product">
            <span className="brand-mark">I</span>
            <span>Imboni</span>
          </nav>
          <div className="hero-copy">
            <p className="eyebrow"> Agri-finance</p>
            <h1>Turn MoMo history into fair farmer credit.</h1>
            <p>
              Credit scoring built for Rwanda&apos;s smallholder farmers — seasonal income patterns,
              cooperative payments, and input purchases from real mobile-money data.
            </p>
          </div>
          <div className="auth-metrics" aria-label="Dataset scope">
            <div>
              <strong>{datasetSummary?.farmerCount ?? "—"}</strong>
              <span>farmers</span>
            </div>
            <div>
              <strong>
                {datasetSummary?.transactionCount?.toLocaleString("en-US") ?? "—"}
              </strong>
              <span>MoMo records</span>
            </div>
            <div>
              <strong>{datasetSummary?.monthCount ?? "—"}</strong>
              <span>months</span>
            </div>
          </div>
        </section>

        <section className="auth-panel" aria-label="Authentication">
          <div className="mode-toggle">
            <button className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>
              Login
            </button>
            <button
              className={mode === "register" ? "active" : ""}
              onClick={() => switchMode("register")}
            >
              Register
            </button>
          </div>

          {mode === "login" ? (
            <form className="auth-form" onSubmit={handleLogin}>
              <div>
                <p className="eyebrow">Loan officer access</p>
                <h2>Open the credit desk</h2>
              </div>

              <label>
                Email
                <input
                  required
                  type="email"
                  value={loginForm.email}
                  onChange={(event) =>
                    setLoginForm((form) => ({ ...form, email: event.target.value }))
                  }
                  autoComplete="email"
                />
              </label>
              <label>
                Password
                <input
                  required
                  type="password"
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm((form) => ({ ...form, password: event.target.value }))
                  }
                  autoComplete="current-password"
                />
              </label>

              {adminCredentials && (
                <div className="demo-credentials">
                  <span>Demo admin</span>
                  <code>{adminCredentials.email}</code>
                  <code>{adminCredentials.password}</code>
                </div>
              )}

              {authError && <p className="form-alert">{authError}</p>}
              {authMessage && <p className="form-success">{authMessage}</p>}
              <button className="primary-action" type="submit">
                Sign in
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleRegister}>
              <div>
                <p className="eyebrow">New operator</p>
                <h2>Create an account</h2>
              </div>

              <label>
                Full name
                <input
                  required
                  value={registerForm.name}
                  onChange={(event) =>
                    setRegisterForm((form) => ({ ...form, name: event.target.value }))
                  }
                  autoComplete="name"
                />
              </label>
              <label>
                Organization
                <input
                  required
                  value={registerForm.organization}
                  onChange={(event) =>
                    setRegisterForm((form) => ({ ...form, organization: event.target.value }))
                  }
                  autoComplete="organization"
                />
              </label>
              <label>
                Role
                <select
                  value={registerForm.role}
                  onChange={(event) =>
                    setRegisterForm((form) => ({ ...form, role: event.target.value }))
                  }
                >
                  <option>Credit officer</option>
                  <option>Cooperative admin</option>
                  <option>Insurance partner</option>
                  <option>Loan manager</option>
                </select>
              </label>
              <label>
                Email
                <input
                  required
                  type="email"
                  value={registerForm.email}
                  onChange={(event) =>
                    setRegisterForm((form) => ({ ...form, email: event.target.value }))
                  }
                  autoComplete="email"
                />
              </label>
              <label>
                Password
                <input
                  required
                  type="password"
                  value={registerForm.password}
                  onChange={(event) =>
                    setRegisterForm((form) => ({ ...form, password: event.target.value }))
                  }
                  autoComplete="new-password"
                />
              </label>
              <label>
                Confirm password
                <input
                  required
                  type="password"
                  value={registerForm.confirmPassword}
                  onChange={(event) =>
                    setRegisterForm((form) => ({ ...form, confirmPassword: event.target.value }))
                  }
                  autoComplete="new-password"
                />
              </label>
              {authError && <p className="form-alert">{authError}</p>}
              <button className="primary-action" type="submit">
                Create account
              </button>
            </form>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <span className="brand-mark">I</span>
          <span>Imboni</span>
        </div>

        <nav className="nav-stack" aria-label="Primary">
          <button className="nav-item active">Farmer search</button>
        </nav>

        <div className="hackathon-badge">
          <span>Theme 02</span>
          <strong>Agri-finance &amp; insurance</strong>
        </div>

        <div className="operator-card">
          <span>{getInitials(currentUser.name)}</span>
          <div>
            <strong>{currentUser.name}</strong>
            <small>
              {currentUser.role} · {currentUser.organization}
            </small>
          </div>
        </div>

        <button className="secondary-action" onClick={handleSignOut}>
          Sign out
        </button>
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">MFI / SACCO credit desk</p>
            <h1>Farmer risk review</h1>
          </div>
          {dataset && (
            <div className="dataset-strip" aria-label="Dataset status">
              <div>
                <span>Source</span>
                <strong>{dataset.source}</strong>
              </div>
              <div>
                <span>Period</span>
                <strong>
                  {dataset.period.start} → {dataset.period.end}
                </strong>
              </div>
              <div>
                <span>Records</span>
                <strong>{dataset.transactionCount.toLocaleString("en-US")} MoMo txns</strong>
              </div>
            </div>
          )}
        </header>

        {dataStatus === "loading" && (
          <section className="data-state">
            <div className="loading-mark">I</div>
            <p>Loading MoMo transactions from dataset</p>
          </section>
        )}

        {dataStatus === "error" && (
          <section className="data-state error">
            <strong>Data failed to load</strong>
            <p>{dataError}</p>
          </section>
        )}

        {dataStatus === "ready" && selectedFarmer && selectedBand && (
          <>
            <section className="search-band">
              <div className="search-header">
                <label>
                  Search farmer
                  <input
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setTransactionPage(1);
                    }}
                    placeholder="Name, ID, phone, district, crop, or score band"
                  />
                </label>
                <p className="search-hint">
                  {filteredFarmers.length} of {farmers.length} farmers match
                </p>
              </div>

              {filteredFarmers.length === 0 ? (
                <div className="empty-results">
                  <strong>No farmers found</strong>
                  <p>Try a different name, phone number, or district.</p>
                </div>
              ) : (
                <div className="result-list" aria-label="Search results">
                  {filteredFarmers.map((farmer) => (
                    <button
                      key={farmer.farmer_id}
                      className={
                        farmer.farmer_id === selectedFarmer.farmer_id
                          ? "farmer-result active"
                          : "farmer-result"
                      }
                      onClick={() => {
                        setSelectedId(farmer.farmer_id);
                        setTransactionPage(1);
                      }}
                    >
                      <span className="avatar">{getInitials(farmer.name)}</span>
                      <span>
                        <strong>{farmer.name}</strong>
                        <small>
                          {farmer.farmer_id} · {farmer.district} · {farmer.primary_activity}
                        </small>
                      </span>
                      <b>{farmer.score.value}</b>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="decision-layout">
              <article className="score-panel">
                <div className="farmer-heading">
                  <span className="avatar large">{getInitials(selectedFarmer.name)}</span>
                  <div>
                    <h2>{selectedFarmer.name}</h2>
                    <p>{selectedFarmer.primary_activity}</p>
                  </div>
                </div>

                <div
                  className={`score-ring ${selectedBand.tone}`}
                  style={{ "--score": `${selectedFarmer.score.percent}%` }}
                >
                  <div>
                    <span>{selectedFarmer.score.value}</span>
                    <small>{selectedBand.label}</small>
                  </div>
                </div>

                <div className="decision-box">
                  <span>Recommendation</span>
                  <strong>{selectedBand.decision}</strong>
                  <small>{selectedFarmer.underwriting.reasons[0]}</small>
                </div>
              </article>

              <article className="profile-panel">
                <div className="section-title">
                  <h3>Farmer profile</h3>
                  <span className={`band-pill ${selectedBand.tone}`}>{selectedFarmer.score.band}</span>
                </div>
                <dl className="profile-grid">
                  <div>
                    <dt>Farmer ID</dt>
                    <dd>{selectedFarmer.farmer_id}</dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>{selectedFarmer.msisdn}</dd>
                  </div>
                  <div>
                    <dt>District</dt>
                    <dd>{selectedFarmer.district}</dd>
                  </div>
                  <div>
                    <dt>Monthly income</dt>
                    <dd>{formatCurrency(selectedFarmer.metrics.averageMonthlyIncoming)}</dd>
                  </div>
                  <div>
                    <dt>Net MoMo flow</dt>
                    <dd>{formatCurrency(selectedFarmer.metrics.netFlow)}</dd>
                  </div>
                  <div>
                    <dt>Active months</dt>
                    <dd>
                      {selectedFarmer.metrics.activeMonths} / {selectedFarmer.monthlyTrend.length}
                    </dd>
                  </div>
                </dl>
              </article>
            </section>

            <section className="bureau-panel">
              <div className="section-title">
                <h3>Credit bureau (CRB) &amp; underwriting</h3>
                <span className={`band-pill ${selectedFarmer.creditBureau.tone}`}>
                  {selectedFarmer.creditBureau.recordFound
                    ? `Band ${selectedFarmer.creditBureau.band}`
                    : "Thin file"}
                </span>
              </div>

              {selectedFarmer.creditBureau.recordFound ? (
                <dl className="profile-grid">
                  <div>
                    <dt>Bureau score</dt>
                    <dd>{selectedFarmer.creditBureau.score}</dd>
                  </div>
                  <div>
                    <dt>Active loans</dt>
                    <dd>
                      {selectedFarmer.creditBureau.activeLoans} / {selectedFarmer.creditBureau.totalLoans}
                    </dd>
                  </div>
                  <div>
                    <dt>Outstanding</dt>
                    <dd>{formatCurrency(selectedFarmer.creditBureau.outstandingRwf)}</dd>
                  </div>
                  <div>
                    <dt>Arrears status</dt>
                    <dd>{selectedFarmer.creditBureau.currentlyInArrears ? "In arrears" : "Current"}</dd>
                  </div>
                  <div>
                    <dt>Bureau inquiries (12m)</dt>
                    <dd>{selectedFarmer.creditBureau.inquiries12m}</dd>
                  </div>
                  <div>
                    <dt>Negative listing</dt>
                    <dd>{selectedFarmer.creditBureau.negativeListing ? "Yes" : "No"}</dd>
                  </div>
                </dl>
              ) : (
                <p className="search-hint">
                  No bureau record found for this farmer (thin file) — underwriting relies on the MoMo
                  behavioural score alone.
                </p>
              )}

              <div className="decision-box">
                <span>Underwriting decision</span>
                <strong>
                  {selectedFarmer.underwriting.decision === "approve"
                    ? `Approve up to ${formatCurrency(selectedFarmer.underwriting.limit_rwf)}`
                    : "Decline / refer to manual review"}
                </strong>
                <ul className="reason-list">
                  {selectedFarmer.underwriting.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="evidence-layout">
              <article className="signals-panel">
                <div className="section-title">
                  <h3>Score drivers</h3>
                  <span>Explainable · MoMo only</span>
                </div>
                {selectedFarmer.score.signals.map((signal) => (
                  <SignalBar
                    key={signal.key}
                    label={signal.label}
                    detail={signal.detail}
                    value={signal.value}
                  />
                ))}
              </article>

              <article className="trend-panel">
                <div className="section-title">
                  <h3>Monthly flow</h3>
                  <span>Incoming vs outgoing</span>
                </div>
                <TrendBars trend={selectedFarmer.monthlyTrend} />
                <div className="legend-row">
                  <span>
                    <i className="dot incoming" /> Incoming
                  </span>
                  <span>
                    <i className="dot outgoing" /> Outgoing
                  </span>
                </div>
                <div className="counterparty-list">
                  {selectedFarmer.topCounterparties.map((counterparty) => (
                    <div key={counterparty.id}>
                      <strong>{counterparty.label}</strong>
                      <span>
                        {counterparty.count} txns · {formatCurrency(counterparty.amount_rwf)}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="transactions-panel">
              <div className="section-title">
                <h3>MoMo transaction history</h3>
                <span>
                  {filteredTransactions.length} of {selectedFarmer.transactions.length} records
                </span>
              </div>

              <div className="segmented-control" aria-label="Transaction direction">
                {["all", "incoming", "outgoing"].map((view) => (
                  <button
                    key={view}
                    className={transactionView === view ? "active" : ""}
                    onClick={() => {
                      setTransactionView(view);
                      setTransactionPage(1);
                    }}
                  >
                    {view}
                  </button>
                ))}
              </div>

              <div className="transaction-table" role="table" aria-label="MoMo transactions">
                <div className="transaction-row table-head" role="row">
                  <span>Date</span>
                  <span>Direction</span>
                  <span>Counterparty</span>
                  <span>Type</span>
                  <span>Fee</span>
                  <span>Amount</span>
                </div>
                {visibleTransactions.map((transaction) => (
                  <div className="transaction-row" role="row" key={transaction.id}>
                    <span>{formatDate(transaction.date)}</span>
                    <span className={`direction-pill ${transaction.direction}`}>
                      {transaction.direction}
                    </span>
                    <span>{transaction.counterpartyLabel}</span>
                    <span>{transaction.type}</span>
                    <span>{formatCurrency(transaction.fee_rwf)}</span>
                    <strong className={transaction.signed_amount_rwf < 0 ? "negative" : "positive"}>
                      {formatCurrency(transaction.signed_amount_rwf)}
                    </strong>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    className="secondary-action"
                    disabled={currentPage <= 1}
                    onClick={() => setTransactionPage((page) => page - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    className="secondary-action"
                    disabled={currentPage >= totalPages}
                    onClick={() => setTransactionPage((page) => page + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </section>

            {dataset?.disclaimer && (
              <p className="dataset-disclaimer">{dataset.disclaimer}</p>
            )}
          </>
        )}
      </section>
    </main>
  );
}
