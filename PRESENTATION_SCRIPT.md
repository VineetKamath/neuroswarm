# NeuroSwarm — 4-Person Presentation Script

**Format:** ~20 minutes total, four speakers, ~4–5 minutes each, then joint Q&A.
**Rule for everyone:** say the *number* and say *why a bio-inspired algorithm was
necessary there*. Those are the two things an examiner actually grades.

| Speaker | Owns | Slides / screen | Time |
|---|---|---|---|
| **Person 1 (you)** | Intro, the problem, why no LLM, live app demo | Login → Patient → Search | 4 min |
| **Person 2** | GA/PSO foundations, Optimizer #1 (Ranking), Optimizer #2 (Tasks) | Bio-Lab: Ranking + Tasks tabs | 5 min |
| **Person 3** | Optimizer #3 (Immune), Optimizer #4 (Compression) | Bio-Lab: Immune map + Dimension mask | 5 min |
| **Person 4** | Optimizer #5 (ACO), architecture, safety, tests, conclusion | Bio-Lab: Pheromone grid + Architecture slide | 5 min |

**Before you start:** backend running (`venv\Scripts\python.exe run.py`), frontend running
(`npm run dev`), already logged in as Dr. Chen in a second browser tab so no one watches a
login form load. Have the Bio-Lab page pre-opened on a third tab.

---

## PERSON 1 — Introduction and the working product

*Screen: title slide, then the running app.*

### Opening (45 sec)

> Good morning. Our project is **NeuroSwarm** — a hospital care-coordination and
> electronic-health-record platform. But the EHR is not the contribution. The
> contribution is this: **five decisions inside that hospital system are made by
> bio-inspired optimization algorithms instead of by rules a programmer wrote.**
>
> A doctor searching a patient's notes, a nurse's task queue ordering itself, a
> mistyped blood pressure being caught before it triggers an alert — each of those is
> a decision, and each one is tuned by a different algorithm from nature.

### The problem (1 min)

> Here is the problem we started from. A clinician at a bedside has maybe thirty
> seconds. The patient's history is dozens of unstructured notes. If they ask
> *"what antibiotic is this patient on and why"*, the system has to find that
> answer, not return twenty documents that mention antibiotics.
>
> The obvious approach is a set of hand-written rules — sort by date, sort by
> priority, flag anything outside the normal range. We built exactly that first,
> and it is our **baseline**. Every number you will hear today is measured against
> it, so nobody has to take our word for the improvement.

### The one decision that makes the project measurable (1 min)

*This is the point that separates the project from every other "medical AI" submission — deliver it slowly.*

> One deliberate choice: **there is no large language model anywhere in this system.**
> Our earlier version called a hosted 70-billion-parameter model to phrase its answers.
> We removed it, for three reasons.
>
> One — **zero hallucination becomes structural instead of aspirational.** Every
> sentence the clinician sees is quoted verbatim from a real note. There is no
> generation step that *could* invent a drug dose.
>
> Two — **retrieval quality becomes visible.** If a language model rewrites the
> output, good ranking and bad ranking produce nearly identical prose, and the
> improvement disappears. Without it, better ranking *is* the user-facing improvement.
>
> Three — **fitness becomes deterministic.** A genetic algorithm needs a stable,
> repeatable objective function. A network call with variable latency and randomly
> sampled output is a terrible thing to put inside an evolutionary loop.

### Live demo (1 min 30)

*Do these in order. Narrate what you clicked, not what the code does.*

1. **Login screen** — "Role-based: Admin, Doctor, Nurse. One click to switch roles."
2. **Log in as Dr. Chen** → patient list. "38 patients, seeded with realistic SOAP-format
   clinical notes."
3. **Open a patient** → ask a real clinical question in the search box.
   "The answer comes back **cited** — that highlighted text is the actual note it came from."
4. **Ask something the notes do not contain.** — "And this is the refusal gate. Below a
   similarity threshold it says *no relevant information found* rather than returning a
   weak match. In a clinical tool, refusing is a feature."
5. **Switch to a Nurse login** → task queue. "Same data, different role, different
   permissions — and this queue's ordering is one of our five optimizers."

### Hand-off (15 sec)

> So that is the product. Everything you just saw is being ordered, filtered and
> checked by evolved policies rather than by `ORDER BY`. **Person 2** will take the
> first two of those five algorithms.

---

## PERSON 2 — Foundations + Ranking (GA/PSO) + Task triage (GA)

*Screen: Bio-Lab → Ranking tab, then Tasks tab.*

### The toolkit in 45 seconds

> Before the applications — three algorithms do all the work, and all three are in
> `app/bio/common.py`, written from scratch, not imported from a library.
>
> **Genetic Algorithm** — a population of candidate solutions; tournament selection
> picks parents, crossover mixes them, mutation adds new variation, elitism carries
> the best one forward untouched.
> **Particle Swarm** — candidates fly through the search space, each pulled towards
> its own best-ever position and towards the swarm's best.
> **Binary GA** — the same, but each gene is one bit: on or off.

### Optimizer #1 — Search result ranking (2 min)

> **Where it sits:** between the vector search and the list the doctor reads.
>
> **The baseline** ranked on one signal — embedding cosine similarity. But a
> clinically good result also depends on how *recent* the note is, whether the exact
> clinical term appears *verbatim*, and whether the SOAP section actually answers the
> kind of question asked. A question about a plan should surface the Plan section.
>
> So we evolve a **14-gene genome**: six signal weights, a recency half-life, a
> length pivot, and six note-type priors.
>
> **Why bio-inspired — this is the important part.** The metric we care about is
> nDCG, which is a *ranking* metric. It is flat almost everywhere — nudge a weight
> slightly and the order does not change, so the score does not change. **There is no
> gradient to descend.** And a 14-dimensional continuous space with interacting
> parameters is far too large for grid search. A GA does not need a gradient; it only
> needs to be able to *compare* two candidates.
>
> We trained a GA and a PSO and **raced them against each other** — the winner is
> deployed.
>
> **Result, on a held-out test split the optimizer never saw: nDCG@5 goes from
> 0.7635 to 0.9264 — a 21.3% improvement.**

*Show: the convergence chart — best/mean/worst fitness, GA and PSO overlaid, diversity collapsing.*

### Optimizer #2 — Care-task prioritization (2 min)

> **Where it sits:** the nurse's task queue.
>
> **The baseline** was a single SQL sort: `ORDER BY due_time ASC, priority DESC`.
> That cannot express what a charge nurse does constantly — **an overdue MEDIUM
> medication on a CRITICAL patient outranks a not-yet-due HIGH hygiene task.** No
> fixed sort can represent that trade-off.
>
> **Why bio-inspired:** we could not get clinicians to write down a scoring formula —
> nobody thinks that way. But they will happily tell you, for any two tasks, **which
> one they would do first.** So our training data is *pairwise preferences*, and our
> objective is pairwise agreement — which is a **discontinuous step function** of the
> weights. It jumps when a pair flips and is flat in between. Calculus cannot touch
> that. A GA optimizes it directly.
>
> **Result: expert agreement goes from 0.6808 to 0.9212 — a 35.3% improvement**, the
> largest gain in the project.

*Show: the live A/B panel — the real ward queue ordered by the baseline on one side, the evolved policy on the other.*

> **Person 3** takes the next two.

---

## PERSON 3 — Immune anomaly detection + Embedding compression

*Screen: Bio-Lab → Immune detector map, then Dimension mask.*

### Optimizer #3 — Vitals anomaly detection, Artificial Immune System (2 min 30)

> **Where it sits:** a checkpoint on every vital-sign reading before it is trusted
> enough to raise an alert. A nurse types 180 instead of 108 — that typo should never
> reach the alerting system.
>
> **The biology, because the metaphor is doing real work here.** In the thymus,
> immature T-cells are exposed to the body's own proteins. Any T-cell that binds to
> "self" is destroyed. The ones that survive react only to things the body has
> **never seen before**. That is called **negative selection**.
>
> In our system, "self" is the manifold of **normal** seven-dimensional vital-sign
> vectors. We generate candidate detectors, censor away any that match normal
> physiology, and keep the survivors — V-detector style, with variable radius.
>
> **Why bio-inspired, and this is the strongest justification in the whole project:**
> a supervised classifier needs labeled examples of **every error type you want to
> catch**. Nobody has that — you cannot enumerate every way a human mistypes a number.
> **Negative selection trains on normal data only**, so it flags error modes that were
> never enumerated in advance. For safety work, that is exactly the property you want.
>
> We tested it against **six planted corruption types** — digit transposition, decimal
> shift, unit confusion, missing digit, impossible physiology, and copy-forward —
> **none of which the model was ever shown.**
>
> **Result: 89.3% detection at a 0% false-alarm rate. F1 of 0.9434.** The zero matters
> more than the 89 — a vitals checker that cries wolf gets switched off in a week.
>
> **One honest point about scope:** two error classes *are* enumerable — values
> outside physiological range, and impossible relationships like diastolic pressure
> above systolic. We handle those with deterministic rules, not the immune system,
> because a rule is simpler and cannot miss. That is the honest division of labour.

*Show: the detector map — detectors ringing the normal cloud without overlapping it. Plant a typo live and watch it get bound.*

### Optimizer #4 — Embedding compression, Binary GA (2 min)

> **Where it sits:** between the sentence-transformer encoder and the FAISS index.
>
> Every note chunk becomes a **384-dimensional** vector. Not all 384 dimensions earn
> their storage for *clinical* text — that encoder was trained on the general web.
>
> So: one bit per dimension, keep it or drop it. **Why bio-inspired — the search space
> is 2³⁸⁴.** That is more combinations than atoms in the observable universe, so
> exhaustive search is out. And greedy forward selection gets trapped, because
> **dimensions interact**: a dimension that looks useless alone can be decisive
> alongside another one. Uniform crossover is the right operator precisely because it
> recombines *useful groups* of dimensions rather than evaluating them one at a time.
>
> **Result: 384 dimensions down to 145 — 62.24% less memory, with accuracy preserved.**
>
> **And we want to be honest about that word "preserved."** The compression benchmark
> holds out only about 18 queries, so variance across random seeds is large — repeated
> runs gave held-out changes of −1.5%, +0.5%, +1.1% and +13%. A split that small
> **cannot separate a real accuracy gain from sampling noise**, so we claim accuracy is
> *preserved*, not improved. The result that **is** stable across every seed is the
> 62% memory reduction — that follows deterministically from keeping 145 of 384
> dimensions.

*Show: the dimension mask — all 384 dimensions, lit if they survived.*

> **Person 4** has the last algorithm and the system as a whole.

---

## PERSON 4 — ACO routing, architecture, safety, tests, conclusion

*Screen: Bio-Lab → Pheromone grid, then the architecture slide.*

### Optimizer #5 — Multi-source query routing, Ant Colony Optimization (2 min)

> **Where it sits:** ahead of the vector scan, deciding *which parts of the index to
> even look at.*
>
> Our search space is partitioned — **30 partitions**, note type crossed with SOAP
> section. A question about medication rarely needs the partition holding nursing
> hygiene observations. Ants lay pheromone on paths that lead to food; good routes get
> reinforced, and unused pheromone **evaporates**.
>
> **Why ACO instead of a simple lookup table mapping intent to partition?** One word:
> **evaporation.** A static table goes stale as documentation habits shift — a ward
> changes how it writes notes and your table silently starts routing to the wrong
> place. Pheromone decay makes the policy **continuously forget outdated routes**,
> while probabilistic exploration keeps testing alternatives. It is a routing policy
> with a built-in mechanism for being wrong gracefully.
>
> **Result: 81.16% fewer chunks scanned, at a 0.8508 hit rate.**
>
> **Two honest notes.** First: narrowing the search costs recall — that hit rate is
> 0.85, not 1.0. In production NeuroSwarm detects a weak or thin routed result and
> **falls back to a full patient scan**, so a miss costs one extra scan, never a wrong
> answer. Second, on scope: the original brief proposed routing across separate data
> stores — encounters, prescriptions, reports. This system has a single clinical-notes
> store, so that framing would have been fiction. We applied ACO to the partitioned
> search space we actually have.

*Show: the pheromone heatmap — query intent × partition, trail strength after training.*

### How it fits together (1 min)

*Show the architecture diagram.*

> A single query goes through all of it: the **ACO router** chooses partitions → **FAISS**
> searches a per-patient index → with the **evolved dimension mask** applied → the
> **GA/PSO re-ranker** reorders on six evolved signals → the **similarity gate** refuses
> rather than guesses → and the answer is assembled **verbatim and cited**. Vitals go
> through the **immune checkpoint**; the task queue through the **GA triage policy**.
>
> Each optimizer is trained **offline** and saved as a JSON artifact. Serving is a cheap
> lookup. And if nothing has been trained, **every optimizer degrades to its documented
> baseline rather than failing** — the product still works, it just works the
> un-optimized way.

### Clinical safety (45 sec)

> Three properties we designed in rather than tested for:
> **Patient isolation is structural** — FAISS indices are partitioned by patient ID, so
> Patient A's index contains no vectors belonging to Patient B. Cross-patient leakage is
> *impossible*, not *filtered*.
> **The refusal gate** — below the similarity threshold it declines to answer.
> **RBAC** is enforced centrally through FastAPI dependency injection, not sprinkled
> through endpoints.

### Evidence (45 sec)

> **41 tests** — authentication, RBAC returning 401 and 403 correctly, patient vector
> isolation, the similarity threshold, and the bio-inspired subsystem itself: that each
> optimizer converges on a known optimum, that immune detectors never overlap the
> self-region, and that ACO concentrates pheromone on the rewarding partition.
>
> The Bio-Lab page also ships a **live browser sandbox** for each algorithm — you can
> drag the mutation rate and watch convergence change in real time — and every teaching
> claim it makes is checked by an automated script. It asserts, for example, that *with
> elitism the best genome never regresses*: zero regressions across twelve seeds and
> fifty generations, versus forty without elitism. If a claim ever stops being true,
> the build fails.

### Closing (30 sec)

> To close. Five decision points in a working hospital system, each one handed to the
> algorithm whose structure actually matches the problem: **a gradient-free rank metric
> to a GA and PSO, discontinuous human preferences to a GA, unknown error modes to
> negative selection, a 2³⁸⁴ combinatorial search to a binary GA, and a routing policy
> that must forget to an ant colony.**
>
> Every number measured on a held-out split, against the baseline it replaced, with the
> weak results reported as honestly as the strong ones. Thank you — we are happy to take
> questions.

---

## Joint Q&A preparation

Agree in advance **who answers what**, so nobody talks over anyone.

| Likely question | Who | Short answer |
|---|---|---|
| "Why not just use ChatGPT / an LLM?" | **P1** | The four reasons — structural zero-hallucination, retrieval quality stays visible, deterministic fitness for the GA, and retrieval is ~99% of response time so speed work is meaningful. |
| "Isn't a GA overkill? Why not gradient descent?" | **P2** | nDCG is flat almost everywhere — no gradient exists. Pairwise agreement is a step function. Neither is differentiable. |
| "How do you know it isn't overfitting?" | **P2** | Every figure is on a held-out test split the optimizer never trained on, against the exact baseline it replaced. Reproducible with `python -m app.bio.cli train`. |
| "Where did the medical data come from?" | **P1** | Generated cohort — 38 patients, 822 indexed chunks, SOAP-format templates with labeled ground truth. No real patient data, so no privacy issue. |
| "How is the anomaly detector validated if it never sees errors?" | **P3** | It trains on normal data only, then is evaluated against six planted corruption types it was never shown. That is the whole point of negative selection. |
| "Is the compression gain real?" | **P3** | **Concede immediately** — the memory gain is deterministic and real; the accuracy claim is "preserved," not "improved," because an 18-query holdout cannot separate signal from noise. Say it before they say it. |
| "What if ACO routes to the wrong partition?" | **P4** | Weak or thin routed result → automatic fallback to a full patient scan. A miss costs one extra scan, not a wrong answer. |
| "What would you do next?" | **P4** | Hospital-scale index where the routing and compression speed-ups actually bite; larger benchmark so the compression accuracy question can be settled. |

**If you do not know an answer, say so and say what you would measure to find out.**
That reads far better than guessing.

---

## Rehearsal checklist

- [ ] Everyone can pronounce and define: nDCG, Kendall τ, negative selection, pheromone
      evaporation, elitism, tournament selection.
- [ ] P1 has run the demo clicks at least twice — including the refusal query.
- [ ] Bio-Lab is pre-loaded; nobody waits for a chart to render on stage.
- [ ] Each hand-off line is said out loud so the transitions are not awkward.
- [ ] Full run-through timed once. If you are over 20 minutes, cut from the
      architecture section (P4), **never** from the "why bio-inspired" justifications.
