# NeuroSwarm: Bio-Inspired Optimization for Real-Time Clinical Intelligence

A role-secured hospital care-coordination and electronic-health-record platform whose
retrieval, triage and data-quality decisions are tuned by **bio-inspired metaheuristics**
rather than hand-written rules.

**There is no language model anywhere in this system.** Clinical answers are assembled
verbatim from the clinician's own notes. That is a deliberate design choice, and it is
what makes the rest of the project measurable, see [Why no LLM](#why-there-is-no-llm).

---

## The five optimizers

| # | Decision point | Algorithm | Baseline → Optimized (held-out) |
|---|---|---|---|
| 1 | Search result ranking | Genetic Algorithm + Particle Swarm | nDCG@5 **0.6925 → 0.9174** (+32.47%) |
| 2 | Care-task prioritization | Genetic Algorithm | Expert agreement **0.8061 → 0.9434** (+17.04%) |
| 3 | Vitals anomaly detection | Artificial Immune System (negative selection) | **90.3%** detection at **0.9%** false alarms (F1 0.942) |
| 4 | Embedding compression | Binary Genetic Algorithm | **384 → 142** dims, 63.02% less memory (accuracy: see note) |
| 5 | Multi-source query routing | Ant Colony Optimization | **82.39%** fewer chunks scanned, 0.9079 hit rate |

Every figure above is measured on a **held-out test split** the optimizer never trained on,
against the exact baseline it replaced. Reproduce them all with `python -m app.bio.cli train`.

---

### 1. Search result ranking: GA / PSO

**Plugs into:** between the FAISS candidate pool and the clinician's result list.

The baseline ranked on a single signal: embedding cosine similarity. A clinically good
result also depends on how recent the note is, whether the exact clinical terms appear
verbatim, and whether the SOAP section actually answers the question asked.

The optimizer evolves a 14-gene genome, six signal weights, a recency half-life, a length
pivot, and six note-type priors. **Why bio-inspired:** nDCG is a rank metric, flat almost
everywhere, so there is no gradient to descend; and a 14-dimensional continuous box with
interacting parameters is intractable for grid search. Both GA and PSO are trained and
raced against each other; the winner is deployed.

*Fitness:* `0.6·nDCG@5 + 0.25·Recall@5 + 0.15·MRR`

### 2. Care-task prioritization: GA

**Plugs into:** the nurse task queue and ward dashboard ordering.

The baseline was a fixed SQL sort: `ORDER BY due_time ASC, priority DESC`. That cannot
express what a charge nurse does constantly, an overdue MEDIUM medication on a CRITICAL
patient outranks a not-yet-due HIGH hygiene task.

**Why bio-inspired:** clinicians state *pairwise preferences* far more readily than a
scoring formula, and pairwise agreement is a discontinuous step function of the weights.
A GA optimizes it directly where calculus cannot.

*Fitness:* `0.6·pairwise agreement + 0.25·Kendall τ + 0.15·top-1 accuracy`

### 3. Vitals anomaly detection: Artificial Immune System

**Plugs into:** a checkpoint on vital signs before they are trusted for alerts.

In the thymus, immature T-cells are exposed to the body's own proteins; any that bind
"self" are destroyed, so the survivors react only to what the body has never seen. Here
"self" is the manifold of normal vital-sign vectors, and V-detector style variable-radius
detectors are censored against it.

**Why bio-inspired:** a supervised classifier needs labeled examples of every error type,
which nobody has. Negative selection trains on **normal data only**, so it flags error
modes nobody listed in advance. Two kinds of error *can* be listed (out-of-range values,
and impossible pairs like diastolic ≥ systolic), so those are handled by simple rules
instead.

*Evaluated against:* six planted corruption types, digit transposition, decimal shift,
unit confusion, missing digit, impossible physiology, copy-forward, none ever shown to the model.

### 4. Embedding compression: Binary GA

**Plugs into:** between the sentence-transformer encoder and the FAISS index.

**Why bio-inspired:** selecting k of 384 dimensions is a 2³⁸⁴ combinatorial search.
Greedy forward selection gets trapped because dimensions interact, one useless alone can
be decisive alongside another. Uniform crossover recombines useful dimension groups directly.

*Fitness:* retrieval nDCG@5 in the reduced subspace, minus a parsimony penalty.

> **About the accuracy figure.** The compression benchmark holds out only ~18
> queries, so results vary a lot between seeds: repeated runs of this configuration gave
> held-out nDCG changes of −1.46%, +0.54%, +1.07% and +13.02%; the current run gives −5.79%.
> A split that small cannot separate a real change from sampling noise, so the fair
> claim is that accuracy is **about the same** (within noise), not improved. The gain that
> *is* stable across every seed is the 63.02% memory reduction, which follows
> deterministically from keeping 142 of 384 dimensions. The 1.45× scan speed-up is modest
> because a per-patient index holds only ~25 vectors; it would matter more at hospital scale.

### 5. Multi-source query routing: ACO

**Plugs into:** ahead of the FAISS scan, choosing which partitions to probe.

**Scope note:** the original brief proposed routing across separate
stores (encounters / prescriptions / reports). This system has a single clinical-notes
store, so that would not have matched the real system. It *does* have a real partitioned search
space, 30 partitions of note type × SOAP section, and the colony optimizes routing
across those instead.

**Why ACO rather than a lookup table:** evaporation. A static "intent → partition" table
goes stale as documentation habits shift; pheromone decay makes the policy continuously
forget outdated routes while probabilistic exploration keeps testing alternatives.

> **Note:** narrowing the search costs recall, the hit rate is 0.9079, not 1.0.
> In production NeuroSwarm detects a weak or thin routed result and falls back to a full
> patient scan, so a miss costs one extra scan rather than a wrong answer.

---

## Why there is no LLM

The predecessor to this project called a hosted 70B model to phrase its answers. That was
removed, for four reasons that all point the same way:

1. **It cannot make things up.** Every sentence displayed is
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

**Prerequisites:** Python 3.11 (3.9-3.13 all work; **not 3.14**, torch and faiss-cpu
publish no wheels for it), Node.js 18+

### Backend

```bash
cd backend

# 1. Create and ACTIVATE the virtualenv. Everything below must run inside it,
#    if your prompt does not start with (venv), the next steps will fail.
#    Name the interpreter explicitly: a bare `python` may be 3.14, which cannot
#    install the dependencies.
py -3.11 -m venv venv             # Windows
# python3.11 -m venv venv         # macOS / Linux
venv\Scripts\activate             # Windows PowerShell / cmd
# source venv/bin/activate        # macOS / Linux

pip install -r requirements.txt

python seed.py                    # 80 patients, 1,932 chunks, labeled benchmarks
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

**Do not re-run `python -m venv venv` over an existing venv to "repair" it.** If the
interpreter differs from the one that built it, that rewrites `pyvenv.cfg` but leaves
`Lib/site-packages` alone, so every compiled extension in it becomes unimportable and
you get `No module named 'pydantic_core._pydantic_core'`. Either delete `venv/` and
rebuild it, or point it back at the original interpreter with
`py -3.11 -m venv venv --upgrade`.

`run.py` works from the repository root or from `backend/`, it puts the package on
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
app still runs, each optimizer degrades to its documented baseline rather than failing.

---

## Demo credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@neuroswarm.health` | `password123` |
| Doctor | `dr.sharma@neuroswarm.health` (Dr. Arvind Sharma) | `password123` |
| Doctor | `dr.iyer@neuroswarm.health` (Dr. Lakshmi Iyer) | `password123` |
| Doctor | `dr.faizal@neuroswarm.health` (Dr. Mohammed Faizal) | `password123` |
| Nurse | `nurse.priya@neuroswarm.health` (Priya Nair) | `password123` |
| Nurse | `nurse.arjun@neuroswarm.health` (Arjun Hegde) | `password123` |
| Nurse | `nurse.deepa@neuroswarm.health` (Deepa Kulkarni) | `password123` |

The seeded data is synthetic and India-based: 4 hand-written cases and 76 generated
patients across 11 conditions. Alongside heart failure, pneumonia, DKA, stroke, AKI and COPD,
these include dengue, pulmonary TB, STEMI, typhoid and falciparum malaria. Every note in a
patient's stay has its own day-to-day values.

The login screen has one-click role switching.

---

## The Bio-Lab page

`Sidebar → Bio-Lab` is built for presenting. It has six chapters (Overview, GA, PSO, AIS,
Binary GA, ACO). **Shift + ← / →** changes chapter, **F** toggles full-screen presentation
mode, and every chapter has a direct link (for example `#/biolab/aco`).

The Overview follows a day in the hospital (Dr. Sharma's question, Nurse Priya's vitals entry,
the ward task queue) and has a table of where each algorithm lives in the project.

Each algorithm chapter has:

1. **A one-sentence job description**, in plain words, plus *Where you'll find it* links
   that open the exact screen and name the source file.
2. **A 3D simulation** (three.js, `frontend/src/components/lab3d/`). You can drag to
   orbit and scroll to zoom. Each one runs the same operators as the Python optimizers
   (`frontend/src/bio/engines.js`):

   | Algorithm | 3D scene |
   |---|---|
   | GA | Ranking recipes as towers. Pedestal height is the score and five glowing cubes are the genes. Parents glow during selection, arcs fly from parents to children, and mutated genes flash. Dr. Sharma's search results re-rank live beside it. |
   | PSO | A terrain where height is search quality, with a decoy hill and a true peak. Birds fly with trails, a gold beacon marks the swarm's best, and arrows show momentum, own memory and the pull of the flock. |
   | AIS | A vitals space (heart rate × BP × SpO₂). A green "self" cloud is learned from normal readings. Candidate detectors appear, and the ones touching self pop (thymus deletion). Readings then fly in from the nurse's tablet and pass or set off an alarm. |
   | Binary GA | One embedding as a board of tiles over glass "meaning" pillars, next to a stack of the 24 masks in the population. Green means kept and useful, amber means kept but wasted. |
   | ACO | Anthills (question types) and food piles (note sections). Pheromone trails glow and evaporate, and ants come home carrying gold when they find the answer. |

3. **A guided story**: Next/Back steps in plain language. Each step drives the scene (camera
   moves, play, experiments) and ends with *In NeuroSwarm*, which says exactly where this
   runs.
4. **Tabs** below the scene:
   - *Try it on the real system*: live calls to the running backend. These are the real
     ranking comparison, tonight's nurse queue, the real vitals checkpoint (showing which
     layer caught the typo), a real routed search, and the live index size.
   - *Real training results*
   - *How it works*: the nature mapping, steps, equation and why this algorithm was chosen.
   - *Talking points & examiner Q&A*

Headline numbers are read live from `/api/bio/report`. Run `npm run verify:bio` to
re-check the claims the browser engines make.

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

- **Patients are kept apart by design.** FAISS indices are partitioned by `patient_id`;
  Patient A's index contains no vectors belonging to Patient B, so cross-patient leakage
  is impossible rather than filtered.
- **Refusal gate.** Below a cosine threshold the system answers *"No relevant information
  found in this patient's records"* instead of returning weak matches.
- **Structured record facts.** Allergies, latest vitals, open tasks, history and the
  profile are turned into citeable fact cards (`app/services/record_facts.py`). They are
  matched by embedding plus a keyword trigger, so questions like "any allergies?" or
  "summarize this patient" are answered from the record itself. These questions used to be
  refused, because no note repeats them.
- **RBAC** is enforced centrally through FastAPI dependency injection (Admin / Doctor / Nurse).
- **Vector indices are in-memory** and rebuilt at startup, not persisted to disk.

---

## Tests

```bash
pytest -q        # from the repository root
```

41 tests: authentication, RBAC 403/401 enforcement, patient vector isolation, the
similarity threshold, and the bio-inspired subsystem, including that each optimizer
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
