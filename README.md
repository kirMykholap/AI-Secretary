# 🧠 AI-Secretary

> An LLM-powered personal operating system that turns scattered tasks, notes, and thoughts across Jira, TickTick and Obsidian into a single, self-reflecting workflow.

AI-Secretary is not another "task manager with a chatbot". It is an experiment in building an AI layer on top of the **Mind Cycle** — a model of how intelligence (human *or* artificial) actually works: intention → collision with reality → reflection → new intention.

---

## ✨ Why this exists

Most productivity tools store tasks. They don't understand the *cycle* a mind goes through to get things done. I wanted a system that:

- aggregates everything I actually work with (Jira, TickTick, Obsidian) into one context,
- uses an LLM to reason about that context — estimate effort, surface bottlenecks, connect ideas,
- and treats the loop **Task → Result → Thoughts → Task** as a first-class concept, not an afterthought.

The conceptual foundation is documented in [`docs/mind_cycle_philosophy.md`](docs/mind_cycle_philosophy.md).

---

## 🔁 The Mind Cycle model

The system is built around a dynamic loop that describes the "life of intelligence":

| Phase | Meaning | What AI-Secretary does |
|-------|---------|------------------------|
| **Task** | Forming intention, focusing energy, defining scope | Aggregates & structures tasks from all sources |
| **Result** | Collision with reality — a checkpoint of state (progress, effort, outcome) | Evaluates effort vs. estimate, flags bottlenecks |
| **Thoughts** | Reflection, shift in thinking, birth of new ideas | LLM-assisted retrospection → generates next tasks |

**Core thesis:** *the mind exists only in motion.* Stopping the cycle means stagnation. AI-Secretary is designed to keep the loop honest and moving — a **co-evolution** partner, not an attention-farming assistant.

---

## 🏗️ Architecture

```
        ┌───────────┐   ┌───────────┐   ┌───────────┐
        │   Jira    │   │  TickTick │   │  Obsidian │
        └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
              │  (REST APIs / vault sync)     │
              └───────────────┼───────────────┘
                              ▼
                   ┌────────────────────┐
                   │  Ingestion Layer   │  normalize → unified task/note model
                   └─────────┬──────────┘
                             ▼
                   ┌────────────────────┐
                   │   Supabase (PG)    │  single source of truth
                   └─────────┬──────────┘
                             ▼
                   ┌────────────────────┐
                   │     LLM Engine     │  estimation • reflection • synthesis
                   └─────────┬──────────┘
                             ▼
                   ┌────────────────────┐
                   │   Mind Cycle loop  │  Task → Result → Thoughts → Task
                   └────────────────────┘
```

---

## 🚀 Features

- **Multi-source aggregation** — pulls tasks and notes from Jira, TickTick and Obsidian into one normalized model.
- **LLM-based effort estimation** — analyzes task descriptions and generates time estimates; compared against actuals over time.
- **Reflection engine** — summarizes results of a cycle and proposes the next set of tasks (the "Thoughts" phase).
- **Single source of truth** — everything persisted in Supabase / PostgreSQL.
- **Context management** — builds focused LLM context windows per cycle instead of dumping raw data.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript / Node.js |
| Storage | Supabase (PostgreSQL) |
| Integrations | Jira API, TickTick API, Obsidian vault |
| AI | LLM API integration, prompt engineering, structured output validation |
| Infra | Docker, environment-based config |

---

## 📚 Philosophy & design notes

This project deliberately explores the harder questions behind AI assistants:

- **Soft vs. deep control** — where does helpful context end and manipulation of will begin?
- **Co-evolution as the ideal** — a system that *increases* complexity when it sees the user degrading, instead of optimizing for comfort and engagement.
- **Transparency mechanisms** — the long-term vision includes verifiable honesty of the assistant's intentions (Zero-Knowledge Proof of intent) and a "right to disconnect".

Full write-up: [`docs/mind_cycle_philosophy.md`](docs/mind_cycle_philosophy.md).

---

## 🗺️ Status & roadmap

AI-Secretary is an active personal R&D project.

- [x] Multi-source task ingestion (Jira / TickTick)
- [x] Supabase data model
- [x] LLM effort estimation
- [ ] Obsidian bidirectional sync
- [ ] Reflection engine v2 (automatic next-cycle generation)
- [ ] Estimation accuracy tracking (LLM vs. classic ML baseline)

---

## 👤 Author

**Kyrylo Mykholap** — AI Engineer (LLM applications, automation & integrations).
Building AI systems that turn unstructured intent into workflows you can run, verify and maintain.

- Telegram: [@kir0d](https://t.me/kir0d)
- Email: kir.mykholap@gmail.com
