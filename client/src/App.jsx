import React, { useState, useEffect, useMemo, useCallback } from "react";
import Login from "./Login.jsx";
import CalendarGrid from "./CalendarGrid.jsx";

const COLORS = ["#3f6b5c", "#a8763e", "#5a6b8c", "#9c5b6e", "#6b7d3f", "#7d5b9c"];

function colorFor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

function fmtDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysBetween(start, end) {
  const a = new Date(start + "T00:00:00");
  const b = new Date(end + "T00:00:00");
  return Math.round((b - a) / 86400000) + 1;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const TYPES = {
  annual: { label: "Annual leave", dot: "#3f6b5c" },
  sick: { label: "Sick leave", dot: "#a8763e" },
  other: { label: "Other", dot: "#7d5b9c" },
};

export default function App() {
  const [sessionChecked, setSessionChecked] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [authed, setAuthed] = useState(false);

  const [entries, setEntries] = useState([]);
  const [allowance, setAllowance] = useState(25);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("grid"); // "grid" | "table"
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [name, setName] = useState("");
  const [start, setStart] = useState(todayISO());
  const [end, setEnd] = useState(todayISO());
  const [type, setType] = useState("annual");
  const [note, setNote] = useState("");

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }, []);

  // check session on load
  useEffect(() => {
    fetch("/api/session", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setNeedsPassword(data.needsPassword);
        setAuthed(data.authed);
        setSessionChecked(true);
      })
      .catch(() => {
        setNeedsPassword(false);
        setAuthed(true);
        setSessionChecked(true);
      });
  }, []);

  const loadState = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { credentials: "include" });
      if (res.status === 401) {
        setAuthed(false);
        setLoaded(true);
        return;
      }
      const data = await res.json();
      setEntries(data.entries || []);
      setAllowance(data.allowance ?? 25);
    } catch {
      showToast("Couldn't reach the server. Is it running?");
    }
    setLoaded(true);
  }, [showToast]);

  useEffect(() => {
    if (authed) loadState();
  }, [authed, loadState]);

  function resetForm() {
    setName("");
    setStart(todayISO());
    setEnd(todayISO());
    setType("annual");
    setNote("");
    setError("");
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim()) return setError("Add a name before saving.");
    if (end < start) return setError("End date can't be before the start date.");
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), start, end, type, note }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      setEntries((prev) => [...prev, data]);
      resetForm();
      setShowForm(false);
      showToast("Time off saved.");
    } catch {
      setError("Couldn't reach the server.");
    }
  }

  async function handleDelete(id) {
    const prev = entries;
    setEntries(entries.filter((e) => e.id !== id));
    try {
      const res = await fetch(`/api/entries/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error();
      showToast("Entry removed.");
    } catch {
      setEntries(prev);
      showToast("Couldn't remove that entry. Try again.");
    }
  }

  async function handleAllowanceChange(val) {
    setAllowance(val);
    try {
      await fetch("/api/allowance", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowance: val }),
      });
    } catch {
      showToast("Couldn't save the new allowance.");
    }
  }

  const people = useMemo(() => {
    const set = new Set(entries.map((e) => e.name));
    return [...set].sort();
  }, [entries]);

  const summaries = useMemo(() => {
    const map = {};
    entries.forEach((e) => {
      if (!map[e.name]) map[e.name] = { annual: 0, sick: 0, other: 0 };
      map[e.name][e.type] += daysBetween(e.start, e.end);
    });
    return map;
  }, [entries]);

  const sortedEntries = useMemo(() => {
    return entries
      .filter((e) => filter === "all" || e.name === filter)
      .slice()
      .sort((a, b) => (a.start < b.start ? 1 : -1));
  }, [entries, filter]);

  const today = todayISO();
  const onHolidayNow = useMemo(
    () => entries.filter((e) => e.start <= today && e.end >= today),
    [entries, today]
  );

  const upNext = useMemo(() => {
    return entries
      .filter((e) => e.start > today)
      .sort((a, b) => (a.start > b.start ? 1 : -1))
      .slice(0, 3);
  }, [entries, today]);

  if (!sessionChecked) {
    return <div className="loading-wrap">Loading…</div>;
  }

  if (needsPassword && !authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  if (!loaded) {
    return <div className="loading-wrap">Loading the team calendar…</div>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <div className="eyebrow">Team time off</div>
          <h1>Out of Office</h1>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setShowForm((s) => !s);
            setError("");
          }}
        >
          {showForm ? "Cancel" : "+ Log time off"}
        </button>
      </header>

      {showForm && (
        <form onSubmit={handleAdd} className="form-card">
          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="name">Name</label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Who's taking time off?"
                list="team-names"
              />
              <datalist id="team-names">
                {people.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="type">Type</label>
              <select id="type" value={type} onChange={(e) => setType(e.target.value)}>
                {Object.entries(TYPES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="start">Start date</label>
              <input id="start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="end">End date</label>
              <input id="end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="note">Note (optional)</label>
            <input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. covering on-call to Priya"
            />
          </div>
          {error && <div className="error-text">{error}</div>}
          <div className="form-actions">
            <span className="day-count">
              {end >= start ? `${daysBetween(start, end)} day${daysBetween(start, end) === 1 ? "" : "s"}` : ""}
            </span>
            <button type="submit" className="btn-primary">
              Save
            </button>
          </div>
        </form>
      )}

      <section className="status-row">
        <div className="status-card">
          <div className="status-label">Out today</div>
          {onHolidayNow.length === 0 ? (
            <div className="status-empty">Everyone's in.</div>
          ) : (
            <div className="chip-row">
              {onHolidayNow.map((e) => (
                <span className="chip" key={e.id} style={{ borderColor: colorFor(e.name) }}>
                  <span className="dot" style={{ background: colorFor(e.name) }} />
                  {e.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="status-card">
          <div className="status-label">Coming up</div>
          {upNext.length === 0 ? (
            <div className="status-empty">Nothing scheduled yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {upNext.map((e) => (
                <div className="up-next-row" key={e.id}>
                  <span className="dot" style={{ background: colorFor(e.name) }} />
                  <strong>{e.name}</strong>
                  <span className="muted">
                    {fmtDate(e.start)}
                    {e.end !== e.start ? ` – ${fmtDate(e.end)}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {people.length > 0 && (
        <section className="section">
          <div className="section-head-row">
            <h2>Team balances</h2>
            <label className="allowance-label">
              Annual allowance
              <input
                type="number"
                min="0"
                className="allowance-input"
                value={allowance}
                onChange={(e) => handleAllowanceChange(Number(e.target.value) || 0)}
              />
              days
            </label>
          </div>
          <div className="balance-grid">
            {people.map((p) => {
              const s = summaries[p] || { annual: 0, sick: 0, other: 0 };
              const remaining = allowance - s.annual;
              const pct = Math.min(100, Math.max(0, (s.annual / allowance) * 100));
              return (
                <div key={p} className="balance-card">
                  <div className="balance-head">
                    <span className="avatar" style={{ background: colorFor(p) }}>
                      {p.charAt(0).toUpperCase()}
                    </span>
                    <span>{p}</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${pct}%`, background: colorFor(p) }} />
                  </div>
                  <div className="balance-foot">
                    <span>
                      <strong>{remaining}</strong> of {allowance} days left
                    </span>
                    {s.sick > 0 && (
                      <span className="sick-note">
                        {s.sick} sick day{s.sick === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head-row">
          <h2>All time off</h2>
          <div className="section-head-actions">
            <div className="view-toggle">
              <button
                className={view === "grid" ? "toggle-btn active" : "toggle-btn"}
                onClick={() => setView("grid")}
              >
                Calendar
              </button>
              <button
                className={view === "table" ? "toggle-btn active" : "toggle-btn"}
                onClick={() => setView("table")}
              >
                List
              </button>
            </div>
            {view === "table" && people.length > 0 && (
              <select className="filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">Everyone</option>
                {people.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {view === "grid" ? (
          <CalendarGrid entries={entries} people={people} monthsAhead={3} />
        ) : sortedEntries.length === 0 ? (
          <div className="empty-state">
            <div className="emoji">🌴</div>
            <div className="title">No time off logged yet</div>
            <div className="subtitle">Use "Log time off" above to add the first entry.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="entries-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Days</th>
                  <th>Note</th>
                  <th aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <div className="table-name-cell">
                        <span className="avatar avatar-sm" style={{ background: colorFor(e.name) }}>
                          {e.name.charAt(0).toUpperCase()}
                        </span>
                        <strong>{e.name}</strong>
                      </div>
                    </td>
                    <td>
                      <span className="type-tag" style={{ color: TYPES[e.type].dot }}>
                        <span className="dot" style={{ background: TYPES[e.type].dot }} />
                        {TYPES[e.type].label}
                      </span>
                    </td>
                    <td>{fmtDate(e.start)}</td>
                    <td>{fmtDate(e.end)}</td>
                    <td>{daysBetween(e.start, e.end)}</td>
                    <td className="table-note-cell">{e.note || "—"}</td>
                    <td>
                      <button
                        className="delete-btn"
                        onClick={() => handleDelete(e.id)}
                        aria-label={`Remove ${e.name}'s entry`}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
