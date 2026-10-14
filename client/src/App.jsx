import { useEffect, useState } from "react";

const API = "/api/tasks";
const FILTERS = ["all", "open", "done"];

async function request(url, options) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) throw new Error((await res.json()).error || "Request failed");
  return res.json();
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    request(filter === "all" ? API : `${API}?status=${filter}`)
      .then((data) => { setTasks(data); setError(""); })
      .catch(() => setError("Can't reach the server. Check that the backend is running on port 5000."))
      .finally(() => setLoading(false));
  }, [filter]);

  const addTask = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const task = await request(API, { method: "POST", body: JSON.stringify({ title, priority }) });
      if (filter !== "done") setTasks([task, ...tasks]);
      setTitle("");
    } catch (err) { setError(err.message); }
  };

  const toggle = async (t) => {
    const updated = await request(`${API}/${t._id}`, { method: "PATCH", body: JSON.stringify({ done: !t.done }) });
    setTasks(tasks.map((x) => (x._id === t._id ? updated : x)));
  };

  const remove = async (id) => {
    await request(`${API}/${id}`, { method: "DELETE" });
    setTasks(tasks.filter((x) => x._id !== id));
  };

  return (
    <main className="wrap">
      <h1>TaskBoard</h1>
      <p className="sub">Add what you need to do. Tick it off when it's done.</p>

      <form className="add" onSubmit={addTask}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" maxLength={120} aria-label="Task title" />
        <select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <button type="submit">Add task</button>
      </form>

      <div className="filters" role="tablist">
        {FILTERS.map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      {loading ? <p className="empty">Loading tasks…</p> : tasks.length === 0 && !error ? (
        <p className="empty">No tasks here yet. Add your first one above.</p>
      ) : (
        <ul className="list">
          {tasks.map((t) => (
            <li key={t._id} className={`p-${t.priority} ${t.done ? "done" : ""}`}>
              <input type="checkbox" checked={t.done} onChange={() => toggle(t)} aria-label={`Mark "${t.title}" as ${t.done ? "open" : "done"}`} />
              <span className="title">{t.title}</span>
              <span className="tag">{t.priority}</span>
              <button className="del" onClick={() => remove(t._id)} aria-label={`Delete "${t.title}"`}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
