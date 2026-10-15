import { useEffect, useMemo, useRef, useState } from "react";

const API = "/api/tasks";
const FILTERS = [["all", "All tasks"], ["open", "To do"], ["done", "Completed"]];
const ORDER = { high: 0, medium: 1, low: 2 };

async function request(url, options) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Request failed");
  return res.json();
}

function Ring({ pct }) {
  const r = 38, c = 2 * Math.PI * r;
  return (
    <svg className="ring" viewBox="0 0 100 100" role="img" aria-label={`${pct}% of tasks completed`}>
      <circle cx="50" cy="50" r={r} className="ring-bg" />
      <circle cx="50" cy="50" r={r} className="ring-fg" strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} />
      <text x="50" y="56" textAnchor="middle">{pct}%</text>
    </svg>
  );
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [editText, setEditText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [undo, setUndo] = useState(null);
  const undoTimer = useRef();

  useEffect(() => {
    request(API)
      .then(setTasks)
      .catch(() => setError("Can't reach the server. Start the backend (npm run dev in /server) and refresh."))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const done = tasks.filter((t) => t.done).length;
    return { all: tasks.length, done, open: tasks.length - done };
  }, [tasks]);
  const pct = counts.all ? Math.round((counts.done / counts.all) * 100) : 0;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter((t) => (filter === "all" ? true : filter === "done" ? t.done : !t.done))
      .filter((t) => t.title.toLowerCase().includes(q))
      .sort((a, b) => a.done - b.done || ORDER[a.priority] - ORDER[b.priority]);
  }, [tasks, filter, query]);

  const fail = (e) => setError(e.message || "Something went wrong. Try again.");

  const addTask = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const task = await request(API, { method: "POST", body: JSON.stringify({ title, priority }) });
      setTasks((p) => [task, ...p]);
      setTitle(""); setError("");
    } catch (err) { fail(err); }
  };

  const toggle = async (t) => {
    setTasks((p) => p.map((x) => (x._id === t._id ? { ...x, done: !x.done } : x)));
    try { await request(`${API}/${t._id}`, { method: "PATCH", body: JSON.stringify({ done: !t.done }) }); }
    catch (err) { setTasks((p) => p.map((x) => (x._id === t._id ? t : x))); fail(err); }
  };

  const saveEdit = async (t) => {
    const next = editText.trim();
    setEditing(null);
    if (!next || next === t.title) return;
    try {
      const updated = await request(`${API}/${t._id}`, { method: "PATCH", body: JSON.stringify({ title: next }) });
      setTasks((p) => p.map((x) => (x._id === t._id ? updated : x)));
    } catch (err) { fail(err); }
  };

  const setPrio = async (t, value) => {
    try {
      const updated = await request(`${API}/${t._id}`, { method: "PATCH", body: JSON.stringify({ priority: value }) });
      setTasks((p) => p.map((x) => (x._id === t._id ? updated : x)));
    } catch (err) { fail(err); }
  };

  const remove = async (t) => {
    setTasks((p) => p.filter((x) => x._id !== t._id));
    try { await request(`${API}/${t._id}`, { method: "DELETE" }); } catch (err) { fail(err); return; }
    clearTimeout(undoTimer.current);
    setUndo(t);
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
  };

  const restore = async () => {
    const t = undo;
    setUndo(null);
    try {
      const back = await request(API, { method: "POST", body: JSON.stringify({ title: t.title, priority: t.priority, done: t.done }) });
      setTasks((p) => [back, ...p]);
    } catch (err) { fail(err); }
  };

  const clearDone = async () => {
    const done = tasks.filter((t) => t.done);
    setTasks((p) => p.filter((t) => !t.done));
    await Promise.all(done.map((t) => request(`${API}/${t._id}`, { method: "DELETE" }).catch(() => {})));
  };

  return (
    <div className="app">
      <aside className="side">
        <h1>TaskBoard</h1>
        <Ring pct={pct} />
        <p className="progress-text">{counts.done} of {counts.all} tasks done</p>
        <nav aria-label="Task filters">
          {FILTERS.map(([key, label]) => (
            <button key={key} className={filter === key ? "nav on" : "nav"} aria-current={filter === key} onClick={() => setFilter(key)}>
              <span>{label}</span><b>{counts[key]}</b>
            </button>
          ))}
        </nav>
        {counts.done > 0 && <button className="ghost" onClick={clearDone}>Clear completed</button>}
      </aside>

      <main className="main">
        <form className="add" onSubmit={addTask}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task and press Enter" maxLength={120} aria-label="Task title" />
          <select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority">
            <option value="high">High priority</option>
            <option value="medium">Medium priority</option>
            <option value="low">Low priority</option>
          </select>
          <button type="submit" disabled={!title.trim()}>Add task</button>
        </form>

        <input className="search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks" aria-label="Search tasks" />

        {error && <p className="error" role="alert">{error} <button onClick={() => setError("")}>Dismiss</button></p>}

        {loading ? (
          <ul className="list" aria-busy="true">{[1, 2, 3].map((i) => <li key={i} className="skeleton" />)}</ul>
        ) : visible.length === 0 ? (
          <p className="empty">
            {query ? `No tasks match "${query}".` : filter === "done" ? "Nothing completed yet." : "You're all clear. Add a task above to get started."}
          </p>
        ) : (
          <ul className="list">
            {visible.map((t) => (
              <li key={t._id} className={t.done ? "item done" : "item"}>
                <input type="checkbox" checked={t.done} onChange={() => toggle(t)} aria-label={`Mark "${t.title}" as ${t.done ? "to do" : "done"}`} />
                {editing === t._id ? (
                  <input
                    className="edit" autoFocus value={editText} maxLength={120}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={() => saveEdit(t)}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditing(null); }}
                  />
                ) : (
                  <span className="title" onDoubleClick={() => { setEditing(t._id); setEditText(t.title); }}>{t.title}</span>
                )}
                <select className={`prio ${t.priority}`} value={t.priority} onChange={(e) => setPrio(t, e.target.value)} aria-label="Change priority">
                  <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                </select>
                <button className="icon" onClick={() => { setEditing(t._id); setEditText(t.title); }} aria-label={`Edit "${t.title}"`}>Edit</button>
                <button className="icon danger" onClick={() => remove(t)} aria-label={`Delete "${t.title}"`}>Delete</button>
              </li>
            ))}
          </ul>
        )}
        <p className="hint">Tip: double-click a task to rename it. Open tasks are sorted by priority.</p>
      </main>

      {undo && (
        <div className="toast" role="status">
          Task deleted <button onClick={restore}>Undo</button>
        </div>
      )}
    </div>
  );
}
