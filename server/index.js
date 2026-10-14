require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const Task = mongoose.model("Task", new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    done: { type: Boolean, default: false },
  },
  { timestamps: true }
));

const app = express();
app.use(cors());
app.use(express.json());

// List tasks (optional ?status=done|open)
app.get("/api/tasks", async (req, res) => {
  const { status } = req.query;
  const filter = status === "done" ? { done: true } : status === "open" ? { done: false } : {};
  res.json(await Task.find(filter).sort({ createdAt: -1 }));
});

// Create
app.post("/api/tasks", async (req, res) => {
  try {
    res.status(201).json(await Task.create(req.body));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Update (toggle done, edit title/priority)
app.patch("/api/tasks/:id", async (req, res) => {
  const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  task ? res.json(task) : res.status(404).json({ error: "Task not found" });
});

// Delete
app.delete("/api/tasks/:id", async (req, res) => {
  const task = await Task.findByIdAndDelete(req.params.id);
  task ? res.json({ ok: true }) : res.status(404).json({ error: "Task not found" });
});

mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/taskboard")
  .then(() => app.listen(process.env.PORT || 5000, () => console.log("API running on port " + (process.env.PORT || 5000))))
  .catch((err) => { console.error("MongoDB connection failed:", err.message); process.exit(1); });
