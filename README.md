# NeuroSwarm — Bio-Inspired Optimization for Real-Time Clinical Intelligence

A role-secured hospital care-coordination and electronic-health-record platform whose
retrieval, triage and data-quality decisions are tuned by **bio-inspired metaheuristics**
rather than hand-written rules.

**There is no language model anywhere in this system.** Clinical answers are assembled
verbatim from the clinician's own notes. That is a deliberate design choice, and it is
what makes the rest of the project measurable — see [Why no LLM](#why-there-is-no-llm).

---

## The five optimizers

| # | Decision point | Algorithm | Baseline → Optimized (held-out) |
|---|---|---|---|
| 1 | Search result ranking | Genetic Algorithm + Particle Swarm | nDCG@5 **0.6987 → 0.9228** (+32.07%) |
| 2 | Care-task prioritization | Genetic Algorithm | Expert agreement **0.6808 → 0.9212** (+35.31%) |
| 3 | Vitals anomaly detection | Artificial Immune System (negative selection) | **89.3%** detection at **0%** false alarms (F1 0.9434) |
| 4 | Embedding compression | Binary Genetic Algorithm | **384 → 146** dims, 61.98% less memory, accuracy break-even |
| 5 | Multi-source query routing | Ant Colony Optimization | **81.16%** fewer chunks scanned, 0.8508 hit rate |

Every figure above is measured on a **held-out test split** the optimizer never trained on,
against the exact baseline it replaced. Reproduce them all with `python -m app.bio.cli train`.

---

### 1. Search result ranking — GA / PSO

**Plugs into:** between the FAISS candidate pool and the clinician's result list.

The baseline ranked on a single signal: embedding cosine similarity. A clinically good
result also depends on how recent the note is, whether the exact clinical terms appear
verbatim, and whether the SOAP section actually answers the question asked.

The optimizer evolves a 14-gene genome — six signal weights, a recency half-life, a length
pivot, and six note-type priors. **Why bio-inspired:** nDCG is a rank metric, flat almost
everywhere, so there is no gradient to descend; and a 14-dimensional continuous box with
interacting parameters is intractable for grid search. Both GA and PSO are trained and
raced against each other; the winner is deployed.

*Fitness:* `0.6·nDCG@5 + 0.25·Recall@5 + 0.15·MRR`

### 2. Care-task prioritization — GA

**Plugs into:** the nurse task queue and ward dashboard ordering.

The baseline was a fixed SQL sort: `ORDER BY due_time ASC, priority DESC`. That cannot
express what a charge nurse does constantly — an overdue MEDIUM medication on a CRITICAL
patient outranks a not-yet-due HIGH hygiene task.

**Why bio-inspired:** clinicians state *pairwise preferences* far more readily than a
scoring formula, and pairwise agreement is a discontinuous step function of the weights.
A GA optimizes it directly where calculus cannot.

*Fitness:* `0.6·pairwise agreement + 0.25·Kendall τ + 0.15·top-1 accuracy`

### 3. Vitals anomaly detection — Artificial Immune System

**Plugs into:** a checkpoint on vital signs before they are trusted for alerts.

In the thymus, immature T-cells are exposed to the body's own proteins; any that bind
"self" are destroyed, so the survivors react only to what the body has never seen. Here
"self" is the manifold of normal vital-sign vectors, and V-detector style variable-radius
detectors are censored against it.

**Why bio-inspired:** a supervised classifier needs labeled examples of every error type,
which nobody has. Negative selection trains on **normal data only**, so it flags error
modes never enumerated in advance — the defining strength of the metaphor for safety work.
Two error classes that *are* enumerable (out-of-range values, and impossible relationships
like diastolic ≥ systolic) are handled by deterministic rules instead, which is the honest
division of labour.

*Evaluated against:* six planted corruption types — digit transposition, decimal shift,
unit confusion, missing digit, impossible physiology, copy-forward — none ever shown to the model.

### 4. Embedding compression — Binary GA

**Plugs into:** between the sentence-transformer encoder and the FAISS index.

**Why bio-inspired:** selecting k of 384 dimensions is a 2³⁸⁴ combinatorial search.
Greedy forward selection gets trapped because dimensions interact — one useless alone can
be decisive alongside another. Uniform crossover recombines useful dimension groups directly.

*Fitness:* retrieval nDCG@5 in the reduced subspace, minus a parsimony penalty.

> **Honest note.** On this run the evolved 146-dimension subspace scored
> +1.07% held-out nDCG — a wash, not a real accuracy gain — while saving
> 61.98% of memory per vector at a 1.19x faster scan. Different seeds land between
> roughly -2% and +1% on accuracy, so treat this as break-even, not free improvement. The
> speedup is modest because a per-patient index holds only ~20 vectors; the memory saving
> is the durable win, and it is what the Bio-Lab reports.

### 5. Multi-source query routing — ACO

**Plugs into:** ahead of the FAISS scan, choosing which partitions to probe.

**Scoping note, stated plainly:** the original brief proposed routing across separate
stores (encounters / prescriptions / reports). This system has a single clinical-notes
store, so that framing would have been fiction. It *does* have a real partitioned search
space — 30 partitions of note type × SOAP section — and the colony optimizes routing
across those instead.

**Why ACO rather than a lookup table:** evaporation. A static "intent → partition" table
goes stale as documentation habits shift; pheromone decay makes the policy continuously
forget outdated routes while probabilistic exploration keeps testing alternatives.

> **Honest note:** narrowing the search costs recall — the hit rate is 0.8508, not 1.0.
> In production NeuroSwarm detects a weak or thin routed result and falls back to a full
> patient scan, so a miss costs one extra scan rather than a wrong answer.

---

## Why there is no LLM

The predecessor to this project called a hosted 70B model to phrase its answers. That was
removed, for four reasons that all point the same way:

1. **Zero hallucination becomes structural, not aspirational.** Every sentence displayed is
   quoted from a real note. There is no generation step that *could* invent a dose.
2. **Retrieval quality becomes visible.** When a language model rewrites the output, a
   better-ranked result and a worse-ranked one produce nearly identical prose. Without it,
   the ranking improvement is the user-facing improvement.
3. **Fitness becomes deterministic.** A GA needs a stable, repeatable objective. A network
   call with variable latency and sampled output is a poor thing to put inside an
   evolutionary loop.
4. **The speed work becomes meaningful.** Retrieval is ~99% of response time here. Under an
   LLM, a 1.5× faster vector scan would be a rounding error behind a 1-second generation call.

---

## Quickstart

**Prerequisites:** Python 3.11+, Node.js 18+

### Backend

```bash
cd backend

# 1. Create and ACTIVATE the virtualenv. Everything below must run inside it —
#    if your prompt does not start with (venv), the next steps will fail.
python -m venv venv
venv\Scripts\activate             # Windows PowerShell / cmd
# source venv/bin/activate        # macOS / Linux

pip install -r requirements.txt

python seed.py                    # 38 patients, 822 chunks, labeled benchmarks
python -m app.bio.cli train       # evolve all five optimizers (~2 min)
python run.py                     # http://127.0.0.1:8000
```

**If the venv already exists you still have to activate it in every new terminal.**
Skipping activation runs your system Python, which does not have the dependencies
installed. Each entry point detects this and prints the exact command to fix it
instead of a traceback. To bypass activation entirely, call the interpreter directly:

```bash
venv\Scripts\python.exe seed.py
venv\Scripts\python.exe -m app.bio.cli train
venv\Scripts\python.exe run.py
```

`run.py` works from the repository root or from `backend/` — it puts the package on
`sys.path` itself, and the database path is resolved relative to the package rather than
the working directory.

### Frontend

```bash
cd frontend
npm install
npm run dev                       # http://localhost:5173
```

### Bio-inspired CLI

```bash
python -m app.bio.cli train --generations 60   # evolve and persist
python -m app.bio.cli status                   # what is trained and live
python -m app.bio.cli report                   # last full training report
```

Training artifacts are written to `backend/data/bio/`. If nothing has been trained, the
app still runs — each optimizer degrades to its documented baseline rather than failing.

---

## Demo credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@neuroswarm.health` | `password123` |
| Doctor | `dr.chen@neuroswarm.health` | `password123` |
| Doctor | `dr.patel@neuroswarm.health` | `password123` |
| Nurse | `nurse.sarah@neuroswarm.health` | `password123` |
| Nurse | `nurse.james@neuroswarm.health` | `password123` |

The login screen has one-click role switching.

---

## The Bio-Lab page

`Sidebar → Bio-Lab` is a live, interactive demonstration of all five algorithms:

- **Convergence charts** replaying each evolutionary run — best/mean/worst fitness with
  population diversity collapsing as the run converges, GA and PSO overlaid.
- **Particle swarm animation** replaying the recorded trajectory: particles scatter at
  high inertia, then contract onto the global best.
- **Immune detector map** — a projection of the 7-D vitals space showing detectors ringing
  the normal cloud without overlapping it. Plant a typo and watch it get bound in real time.
- **Pheromone heatmap** — query intent × partition trail strength after training.
- **Dimension mask** — all 384 embedding dimensions, lit if they survived selection.
- **Live A/B panels** — run a real query or the real ward queue through both the baseline
  and the evolved policy, side by side.

---

## Architecture

```
Query
  │
  ├─▶ ACO router          which partitions to probe   (app/bio/routing.py)
  ├─▶ FAISS search        per-patient isolated index  (app/services/vector_store.py)
  │     └─ evolved dimension mask applied             (app/bio/compression.py)
  ├─▶ GA/PSO re-ranking   six evolved signals         (app/bio/ranking.py)
  ├─▶ Similarity gate     refuse rather than guess
  └─▶ Extractive answer   verbatim, cited             (app/services/rag_service.py)

Vitals intake ─▶ AIS negative selection checkpoint    (app/bio/immune.py)
Task queue    ─▶ GA triage policy                     (app/bio/tasks.py)
```

**Clinical safety properties**

- **Patient isolation is structural.** FAISS indices are partitioned by `patient_id`;
  Patient A's index contains no vectors belonging to Patient B, so cross-patient leakage
  is impossible rather than filtered.
- **Refusal gate.** Below a cosine threshold the system answers *"No relevant information
  found in this patient's records"* instead of returning weak matches.
- **RBAC** is enforced centrally through FastAPI dependency injection (Admin / Doctor / Nurse).
- **Vector indices are in-memory** and rebuilt at startup — not persisted to disk.

---

## Tests

```bash
pytest -q        # from the repository root
```

41 tests: authentication, RBAC 403/401 enforcement, patient vector isolation, the
similarity threshold, and the bio-inspired subsystem — including that each optimizer
actually converges on a known optimum, that immune detectors never overlap the self-region,
and that ACO concentrates pheromone on the rewarding partition.

---

## Project layout

```
backend/
  app/bio/           the five optimizers + trainer, registry and CLI
    common.py        GA, Binary GA and PSO implementations
    ranking.py       #1  features.py  signal extraction
    tasks.py         #2  immune.py    #3
    compression.py   #4  routing.py   #5
    corpus.py        clinical templates + error injection
    seeding.py       cohort generation and benchmark labeling
    trainer.py       orchestration with held-out evaluation
  app/api/bio.py     Bio-Lab API
  data/bio/          trained artifacts
  data/benchmarks/   labeled ground truth
frontend/
  src/pages/BioLabPage.jsx
  src/components/bio/    visualizations
```
