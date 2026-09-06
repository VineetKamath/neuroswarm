"""Chapter content for the NeuroSwarm Bio-Inspired Algorithms report."""
from reportlab.lib.units import mm


def build_chapters(story, M, F, K):
    P, S, chapter, h2, h3 = K["P"], K["S"], K["chapter"], K["h2"], K["h3"]
    bullets, numbered = K["bullets"], K["numbered"]
    data_table, figure, code_block = K["data_table"], K["figure"], K["code_block"]
    doc_w, PageBreak, Spacer = K["doc_w"], K["PageBreak"], K["Spacer"]
    W = doc_w()

    r, t, i, c, o = M["ranking"], M["tasks"], M["immune"], M["compression"], M["routing"]
    rw, tp = M["ranking_weights"], M["task_policy"]

    # ======================================================================
    # CHAPTER 1 — INTRODUCTION
    # ======================================================================
    K['mark'](story, 'chapter'); chapter(story, 1, "INTRODUCTION")

    story.append(P("<b>1.1 Background</b>", h2))
    story.append(P(
        "A hospital generates a very large volume of clinical text every day: admission notes, "
        "progress notes, SOAP reviews, consultation notes, procedure records and discharge "
        "summaries. Although this material is stored digitally, clinicians still struggle to "
        "retrieve the right fragment at the right moment. The difficulty is not storage but "
        "<i>ranking</i>: a search returns many plausible passages and the clinically correct one "
        "must appear at the top, within seconds, at the bedside."))
    story.append(P(
        "A conventional semantic search engine ranks candidate passages by a single number, the "
        "cosine similarity between the embedding of the question and the embedding of the passage. "
        "This single signal is insufficient in a clinical setting. Whether a passage is the right "
        "answer also depends on how recent the note is, whether the exact drug name or organism "
        "appears verbatim, and whether the SOAP section being read is the section that answers "
        "that class of question at all. A question about a drug dose is answered by a "
        "<i>Plan &amp; Orders</i> section, almost never by a <i>Chief Complaint</i>."))
    story.append(P(
        "Combining several such signals requires a set of weights. Those weights cannot sensibly be "
        "chosen by hand, and — as Chapter 2 argues in detail — they cannot be learned by gradient "
        "descent either, because the quality of a ranking is measured by a rank metric that is a "
        "step function of the weights and therefore has zero gradient almost everywhere. This is "
        "precisely the regime for which population-based, nature-inspired metaheuristics were "
        "devised, and it is the motivation for the present project."))

    story.append(P("<b>1.2 Introduction to NeuroSwarm</b>", h2))
    story.append(P(
        "<b>NeuroSwarm</b> is a role-secured clinical care-coordination platform in which five "
        "distinct decision points are tuned by bio-inspired optimization. It is built on an "
        "existing, working electronic health record system, so the algorithms are not demonstrated "
        "on toy benchmarks: each one replaces a specific hand-written rule that previously ran in "
        "production, and each is measured against exactly that rule."))
    story.append(P(
        "A deliberate architectural decision underpins the whole project: <b>no Large Language "
        "Model is used anywhere in the response path</b>. Answers are assembled verbatim from "
        "sentences the clinician actually wrote. Four consequences follow, and all four matter for "
        "a study of optimization:"))
    story.extend(numbered([
        "<b>Zero hallucination becomes structural.</b> There is no generative step that could "
        "invent a dose, so correctness reduces to retrieval correctness.",
        "<b>Retrieval quality becomes visible.</b> If a language model rewrote the output, a good "
        "ranking and a poor ranking would produce nearly identical prose and the optimizer's "
        "contribution would be invisible. Without it, better ranking <i>is</i> the better product.",
        "<b>The objective becomes deterministic.</b> A Genetic Algorithm requires a stable, "
        "repeatable fitness function. A sampled network call with variable latency is unsuitable "
        "inside an evolutionary loop.",
        "<b>Efficiency work becomes meaningful.</b> Retrieval accounts for essentially all of the "
        "response time, so a faster vector scan is a real gain rather than a rounding error behind "
        "a one-second generation call.",
    ]))

    story.append(P("<b>1.3 Problem Statement</b>", h2))
    story.append(P(
        "To identify the decision points inside a working clinical information system at which a "
        "hand-written rule limits performance, to formulate each as an optimization problem whose "
        "structure defeats classical methods, to solve each with an appropriate bio-inspired "
        "algorithm drawn from the evolutionary, swarm-intelligence and immune-inspired families, "
        "and to measure the improvement honestly against a held-out test set and the exact "
        "baseline replaced."))

    story.append(P("<b>1.4 Objectives</b>", h2))
    story.extend(numbered([
        "To apply a <b>real-valued Genetic Algorithm</b> and <b>Particle Swarm Optimization</b> to "
        "evolve a multi-signal clinical retrieval ranking policy, and to compare the two on an "
        "identical objective.",
        "To apply a <b>Genetic Algorithm</b> to recover a care-task triage policy from expert "
        "pairwise preferences, which are far easier to elicit from a clinician than a formula.",
        "To apply an <b>Artificial Immune System</b> using the Negative Selection Algorithm to "
        "detect documentation errors in vital signs while training on normal data alone.",
        "To apply a <b>Binary Genetic Algorithm</b> to the combinatorial problem of selecting which "
        "embedding dimensions are retained in the vector index.",
        "To apply <b>Ant Colony Optimization</b> to learn, from query outcomes, which partitions of "
        "the clinical record answer which class of question.",
        "To build an interactive laboratory in which each algorithm can be run, paused, "
        "single-stepped and deliberately broken, so that the mechanism of each is directly "
        "observable rather than merely described.",
    ]))

    story.append(P("<b>1.5 Scope</b>", h2))
    story.append(P(
        "The project covers the design, implementation, training and evaluation of five optimizers "
        "and their integration into a live clinical application, together with the generation of a "
        "labelled benchmark corpus against which they are measured. It covers a browser-based "
        "teaching laboratory in which the same five algorithms are re-implemented so they can be "
        "manipulated interactively. It does not cover clinical validation on real patient data; the "
        "corpus is synthetic but clinically structured, and no live patient information is used."))

    story.append(P("<b>1.6 Organisation of the Report</b>", h2))
    story.append(P(
        "<b>Chapter 2</b> presents the theory of the five algorithms employed, states the operators "
        "used in each, and argues from the structure of every objective why a classical method "
        "cannot be applied. <b>Chapter 3</b> records the functional and non-functional "
        "requirements together with the software, hardware and feasibility analysis. "
        "<b>Chapter 4</b> gives the layered system architecture, the clinical query pipeline and "
        "the design of the interactive laboratory. <b>Chapter 5</b> is the algorithmic core: for "
        "each of the five optimizers it states the encoding, the fitness function, the control "
        "parameters, a flowchart and pseudocode. <b>Chapter 6</b> reports the evaluation "
        "methodology, the measured results, an ablation study isolating the contribution of each "
        "operator, and an account of a benchmark defect that was detected and corrected. "
        "<b>Chapter 7</b> concludes and identifies future work."))
    story.append(PageBreak())

    # ======================================================================
    # CHAPTER 2 — THEORY
    # ======================================================================
    K['mark'](story, 'chapter'); chapter(story, 2, "BIO-INSPIRED ALGORITHMS: THEORY AND MOTIVATION")

    story.append(P("<b>2.1 The Five Algorithms</b>", h2))
    story.append(P(
        "Five algorithms drawn from three distinct families of nature-inspired computation are "
        "employed. Using more than one family is deliberate: it demonstrates that the choice of "
        "metaheuristic follows from the structure of the problem rather than from familiarity."))
    story.extend(data_table(
        ["#", "Algorithm", "Family", "Biological Inspiration", "Applied To"],
        [
            ["1", "<b>Genetic Algorithm</b> + <b>Particle Swarm Optimization</b>",
             "Evolutionary Computation + Swarm Intelligence",
             "Darwinian natural selection; the flocking of birds and schooling of fish",
             "Clinical search-result ranking"],
            ["2", "<b>Genetic Algorithm</b>", "Evolutionary Computation",
             "Selection, crossover and mutation across successive generations",
             "Nurse care-task prioritization"],
            ["3", "<b>Artificial Immune System</b> (Negative Selection)", "Immune-Inspired Computation",
             "Maturation of T-cells in the thymus, where self-reactive cells are destroyed",
             "Vital-sign anomaly and data-error detection"],
            ["4", "<b>Binary Genetic Algorithm</b>", "Evolutionary Computation",
             "Genetic recombination of building blocks in a chromosome",
             "Embedding dimension selection"],
            ["5", "<b>Ant Colony Optimization</b>", "Swarm Intelligence",
             "Pheromone trails deposited by foraging ants",
             "Multi-source retrieval routing"],
        ],
        [10 * mm, 38 * mm, 33 * mm, 46 * mm, 38 * mm],
        "Table [2.1] The five algorithms, their families and biological inspiration",
        align_center=[0]))

    story.append(P("<b>2.2 Genetic Algorithm</b>", h2))
    story.append(P(
        "A Genetic Algorithm maintains a <i>population</i> of candidate solutions, each encoded as a "
        "<i>chromosome</i>. Each generation, candidates are evaluated by a <i>fitness function</i>, "
        "the fitter ones are selected to reproduce, pairs are recombined by <i>crossover</i>, and "
        "the offspring are perturbed by <i>mutation</i>. Over generations the population drifts "
        "toward regions of high fitness."))
    story.append(P("<b>Operators used in this project</b>", h3))
    story.extend(bullets([
        "<b>Tournament selection.</b> <i>k</i> chromosomes are drawn at random and the fittest "
        "wins the right to reproduce. The tournament size <i>k</i> controls selection pressure: "
        "<i>k</i>=1 is random drift, while large <i>k</i> is greedy and risks premature convergence.",
        "<b>BLX-&alpha; blend crossover.</b> For each gene, a child value is drawn uniformly from "
        "an interval spanning both parents and extended by &alpha; on each side. Because the "
        "interval is <i>extended</i>, this operator is itself exploratory on real-valued genomes.",
        "<b>Gaussian creep mutation.</b> Each gene is perturbed with probability <i>p</i> by a "
        "sample from N(0, &sigma;<super>2</super>), then clamped to [0, 1].",
        "<b>Elitism.</b> The top <i>E</i> chromosomes are copied into the next generation "
        "untouched. This guarantees that the best solution found so far can never be destroyed by "
        "an unlucky crossover, which makes the best-fitness curve monotonic.",
    ]))

    story.append(P("<b>2.3 Particle Swarm Optimization</b>", h2))
    story.append(P(
        "Particle Swarm Optimization models a population of <i>particles</i> flying through the "
        "search space. Each particle remembers the best position it has personally visited "
        "(<i>pbest</i>) and is also aware of the best position found by the entire swarm "
        "(<i>gbest</i>). The whole algorithm is contained in a single velocity update:"))
    story.append(code_block([
        "v  <-  w . v   +   c1 . r1 . (pbest - x)   +   c2 . r2 . (gbest - x)",
        "       ^^^^^       ^^^^^^^^^^^^^^^^^^^^        ^^^^^^^^^^^^^^^^^^^^",
        "      momentum        cognitive term              social term",
        "",
        "x  <-  x + v          with  |v| clamped to v_max,  r1, r2 ~ U(0,1)",
    ]))
    story.extend(bullets([
        "<b>w (inertia)</b> preserves momentum. A high value lets a particle coast past a mediocre "
        "peak; a low value makes it settle quickly wherever it happens to be.",
        "<b>c<sub>1</sub> (cognitive)</b> is the pull toward the particle's own memory. Setting it "
        "to zero removes individual memory and makes the swarm collapse onto the first acceptable "
        "peak it encounters.",
        "<b>c<sub>2</sub> (social)</b> is the pull toward the swarm's best. It is the mechanism by "
        "which information propagates, and the mechanism by which the swarm converges.",
    ]))

    story.append(P("<b>2.4 Artificial Immune System: Negative Selection</b>", h2))
    story.append(P(
        "In the thymus, immature T-cells are exposed to the body's own proteins. Any cell that "
        "binds to <i>self</i> is destroyed by apoptosis. The survivors, by construction, react only "
        "to patterns the body has never presented, and are released to patrol for foreign material."))
    story.append(P(
        "The Negative Selection Algorithm mirrors this exactly. A set of normal samples defines the "
        "<i>self region</i>. Random candidate detectors are generated; any candidate falling within "
        "a distance <i>r<sub>self</sub></i> of a normal sample is discarded. Survivors are retained "
        "as detectors, and any future sample falling inside a detector is reported as non-self."))
    story.append(P(
        "The decisive property, and the reason this family was chosen for data-quality checking, is "
        "that <b>training uses normal data only</b>. A supervised classifier would require labelled "
        "examples of every error type, which no hospital possesses; transcription typos, decimal "
        "slips, transposed digits and unit confusions are open-ended. Negative selection detects "
        "error modes that were never enumerated in advance."))
    story.append(P(
        "This project uses <b>variable-radius (V-detector)</b> detectors: rather than fixing one "
        "radius, each surviving detector grows until it almost touches the self region. Large "
        "detectors blanket empty space cheaply while small ones squeeze into the crevices near the "
        "normal manifold, giving better coverage for the same number of detectors."))

    story.append(P("<b>2.5 Ant Colony Optimization</b>", h2))
    story.append(P(
        "Foraging ants deposit pheromone along the paths they travel, and deposit more when the "
        "path was short and productive. Later ants choose probabilistically in proportion to trail "
        "strength, so good routes are reinforced and poor ones fade. In the algorithmic form, an "
        "ant constructs a solution by moving through a graph with probability"))
    story.append(code_block([
        "P(choose p | i)   proportional to   tau(i,p)^alpha   x   eta(i,p)^beta",
        "",
        "  tau   pheromone on edge (i,p)        alpha   weight given to learned experience",
        "  eta   heuristic desirability          beta   weight given to the prior heuristic",
        "",
        "evaporate:   tau <- (1 - rho) . tau            deposit:   tau <- tau + Q . quality / rank",
    ]))
    story.append(P(
        "<b>Evaporation is the essential mechanism</b>, and the reason Ant Colony Optimization is "
        "preferred here over a static lookup table. Without decay, the first route that happens to "
        "succeed is reinforced permanently and the policy can never adapt. With decay, a route that "
        "stops paying off is progressively forgotten while probabilistic choice keeps testing "
        "alternatives — so the routing policy tracks changes in documentation habits instead of "
        "ossifying."))

    story.append(P("<b>2.6 Why a Metaheuristic Is Necessary</b>", h2))
    story.append(P(
        "It is not sufficient to assert that a bio-inspired algorithm was used; it must be shown "
        "that classical optimization is inapplicable. The following table states, for each decision "
        "point, the structural property of the objective that rules out gradient and enumerative "
        "methods."))
    story.extend(data_table(
        ["Decision point", "Objective", "Why classical methods fail", "Algorithm chosen"],
        [
            ["Retrieval ranking",
             "nDCG@5 over labelled queries; 14 continuous parameters",
             "nDCG depends only on the <i>order</i> of results. Any small weight change that does "
             "not reorder anything leaves it exactly unchanged, so the gradient is zero almost "
             "everywhere. A 14-dimensional grid at 10 points per axis is 10<super>14</super> "
             "evaluations.",
             "GA and PSO"],
            ["Task triage",
             "Fraction of expert pairwise orderings reproduced",
             "Pairwise agreement is a counting function over strict inequalities — a step function "
             "of the weights, again with no usable derivative.",
             "GA"],
            ["Anomaly detection",
             "Detection rate at low false-alarm rate",
             "No labelled anomalies exist to fit a discriminative model against; only normal data "
             "is available.",
             "AIS (Negative Selection)"],
            ["Dimension selection",
             "Retrieval accuracy minus a parsimony penalty",
             "Choosing a subset of 384 dimensions is a search over 2<super>384</super> candidates. "
             "Greedy forward selection is trapped because dimensions interact: one that is useless "
             "alone can be decisive alongside another.",
             "Binary GA"],
            ["Query routing",
             "Probability the answering partition is probed, weighted by scan cost",
             "The policy must be learned online from outcomes and must keep adapting; a fitted "
             "table has no mechanism for forgetting.",
             "ACO"],
        ],
        [26 * mm, 34 * mm, 68 * mm, 30 * mm],
        "Table [2.2] Why a metaheuristic is required at each decision point"))
    story.append(PageBreak())

    # ======================================================================
    # CHAPTER 3 — REQUIREMENTS
    # ======================================================================
    K['mark'](story, 'chapter'); chapter(story, 3, "SYSTEM REQUIREMENTS AND FEASIBILITY")

    story.append(P("<b>3.1 Functional Requirements</b>", h2))
    story.extend(numbered([
        "The system shall evolve a retrieval ranking policy and apply it to every clinical query.",
        "The system shall evolve a triage policy and apply it to the ordering of the care-task queue.",
        "The system shall screen every vital-sign record through an immune checkpoint at the point "
        "of entry and flag suspect readings without discarding them.",
        "The system shall evolve an embedding dimension mask and rebuild all vector indices in the "
        "resulting subspace.",
        "The system shall learn a routing policy over record partitions and fall back to an "
        "exhaustive scan whenever the routed result is weak or too small.",
        "The system shall persist every trained artifact and degrade to a documented baseline when "
        "an artifact is absent, so the clinical application never fails because training has not run.",
        "The system shall expose each optimizer's convergence history for inspection.",
        "The system shall enforce role-based access control across Administrator, Doctor and Nurse.",
    ]))

    story.append(P("<b>3.2 Non-Functional Requirements</b>", h2))
    story.extend(bullets([
        "<b>Determinism.</b> Every optimizer is seeded, so a given configuration reproduces "
        "identical results — a precondition for meaningful comparison between runs.",
        "<b>Latency.</b> End-to-end query response under 100 ms on commodity hardware.",
        "<b>Honesty of measurement.</b> Every reported improvement is computed on a held-out split "
        "against the exact baseline replaced.",
        "<b>Graceful degradation.</b> An untrained system remains fully usable.",
    ]))

    story.append(P("<b>3.3 Software Requirements</b>", h2))
    story.extend(data_table(
        ["Component", "Technology", "Purpose"],
        [["Language (backend)", "Python 3.11", "Optimizers, API, data layer"],
         ["Language (frontend)", "JavaScript (ES2022), React 19", "Interface and browser-side algorithm engines"],
         ["Web framework", "FastAPI + Uvicorn", "REST API with dependency-injected RBAC"],
         ["Numerical computing", "NumPy", "Vector arithmetic in all five optimizers"],
         ["Vector search", "FAISS (faiss-cpu)", "Per-patient inner-product indices"],
         ["Embeddings", "Sentence-BERT all-MiniLM-L6-v2", "384-dimensional clinical text encoding"],
         ["ORM and database", "SQLAlchemy, SQLite / PostgreSQL", "Patients, notes, vitals, tasks"],
         ["Authentication", "python-jose (JWT), bcrypt", "Token authentication, password hashing"],
         ["Testing", "pytest", "35 backend tests"],
         ["Build tooling", "Vite, Tailwind CSS", "Frontend build and styling"]],
        [34 * mm, 52 * mm, 72 * mm],
        "Table [3.1] Software and library requirements"))

    story.append(P("<b>3.4 Hardware Requirements</b>", h2))
    story.extend(data_table(
        ["Resource", "Minimum", "Recommended"],
        [["Processor", "Intel i5 / AMD Ryzen 5", "Intel i7 / Ryzen 7"],
         ["Memory", "8 GB RAM", "16 GB RAM"],
         ["Storage", "5 GB free", "20 GB SSD"],
         ["GPU", "Not required", "Not required"],
         ["Network", "Not required after setup", "LAN for multi-user deployment"]],
        [42 * mm, 58 * mm, 58 * mm],
        "Table [3.2] Hardware requirements", align_center=[1, 2]))
    story.append(P(
        "No GPU is required at any stage. The complete training of all five optimizers takes "
        "approximately ten minutes on a standard laptop CPU, which is itself an argument for "
        "metaheuristics in resource-constrained deployments."))

    story.append(P("<b>3.5 Feasibility Analysis</b>", h2))
    story.append(P(
        "<b>Technical.</b> Every component is open-source and CPU-only. The optimizers are "
        "implemented directly from their standard formulations in roughly 1,800 lines of Python, "
        "with no dependency on an optimization framework, which keeps the algorithmic content "
        "explicit and auditable."))
    story.append(P(
        "<b>Economic.</b> There is no paid API, no proprietary model and no GPU cost. Removing the "
        "language model eliminated the only recurring per-query charge in the original system."))
    story.append(P(
        "<b>Operational.</b> The optimizers are trained offline and consulted at serving time as a "
        "cheap lookup, so the online cost of the entire bio-inspired layer is under one "
        "millisecond per query."))
    story.append(PageBreak())

    # ======================================================================
    # CHAPTER 4 — ANALYSIS AND DESIGN
    # ======================================================================
    K['mark'](story, 'chapter'); chapter(story, 4, "ANALYSIS AND DESIGN")

    story.append(P("<b>4.1 System Architecture</b>", h2))
    story.append(figure(F.fig_architecture(), "Figure [4.1] Layered system architecture of NeuroSwarm"))
    story.append(P(
        "The architecture is organised in four layers. The <b>presentation layer</b> provides the "
        "clinical dashboards and the Bio-Lab. The <b>API layer</b> exposes REST endpoints with "
        "role-based access control enforced centrally through FastAPI dependency injection. The "
        "<b>bio-inspired optimization layer</b> is the contribution of this project: five "
        "optimizers positioned at the exact points where a hand-written rule previously stood. The "
        "<b>data layer</b> holds patient records, per-patient FAISS indices, the labelled "
        "benchmarks and the persisted training artifacts."))
    story.append(P(
        "A property worth emphasising is that the optimization layer is <i>optional at runtime</i>. "
        "Each accessor returns the trained policy when one exists and the documented baseline "
        "otherwise, so an untrained deployment still functions correctly — it simply performs the "
        "way the system did before this project."))

    story.append(P("<b>4.2 Clinical Query Pipeline</b>", h2))
    story.append(figure(F.fig_pipeline(),
                        "Figure [4.2] Clinical query pipeline with the five optimizers in place"))
    story.append(P(
        "A clinical question passes through five stages. Ant Colony Optimization first selects "
        "which partitions of the record to probe. FAISS then searches those partitions in the "
        "subspace chosen by the Binary Genetic Algorithm, returning a candidate pool wider than "
        "the final result set. The evolved GA/PSO weights re-score that pool. A similarity gate "
        "then either accepts the result or refuses to answer. Finally the answer is composed by "
        "quoting the winning passages verbatim."))
    story.append(P(
        "The dashed feedback path is a safety mechanism that deserves note. Narrowing the search "
        "trades recall for speed, so whenever the routed pool comes back weak or smaller than the "
        "required result count, the system discards it and rescans the full patient index. The "
        "cost of a routing miss is therefore one extra scan, never a wrong or incomplete answer."))

    story.append(P("<b>4.3 The Interactive Bio-Lab</b>", h2))
    story.append(figure(F.fig_sandbox(), "Figure [4.3] Interactive Bio-Lab sandbox feedback loop"))
    story.append(P(
        "To make the algorithms observable rather than merely described, all five are additionally "
        "implemented in JavaScript and run inside the browser. Because there is no server round "
        "trip, a parameter can be changed while an algorithm is mid-run and the effect appears "
        "immediately. Each sandbox can be played, paused and single-stepped, and displays the "
        "operators as they fire: which chromosomes entered each tournament, whether crossover "
        "occurred, and exactly which genes mutated."))
    story.append(P(
        "Each laboratory also offers deliberately destructive presets — mutation rate zero, elitism "
        "disabled, pheromone influence &alpha; = 0 — because the fastest way to understand what an "
        "operator contributes is to remove it and observe the failure."))
    story.append(PageBreak())

    # ======================================================================
    # CHAPTER 5 — ALGORITHM DESIGN AND IMPLEMENTATION
    # ======================================================================
    K['mark'](story, 'chapter'); chapter(story, 5, "ALGORITHM DESIGN AND IMPLEMENTATION")

    # ---- 5.1 Ranking -----------------------------------------------------
    story.append(P("<b>5.1 Algorithm 1 &mdash; Retrieval Ranking (GA and PSO)</b>", h2))
    story.append(P("<b>5.1.1 Chromosome Encoding</b>", h3))
    story.append(P(
        "A chromosome is a vector of fourteen real-valued genes in [0, 1]. Six are the weights of "
        "the ranking signals, two are shape parameters decoded onto physical ranges, and six are "
        "per-note-type authority priors."))
    story.extend(data_table(
        ["Gene", "Parameter", "Decoded range", "Meaning"],
        [["0", "w<sub>similarity</sub>", "[0, 1]", "Embedding cosine — the only signal the baseline used"],
         ["1", "w<sub>recency</sub>", "[0, 1]", "Weight on exponential decay with note age"],
         ["2", "w<sub>lexical</sub>", "[0, 1]", "Verbatim clinical-term overlap"],
         ["3", "w<sub>type</sub>", "[0, 1]", "Weight on the note-type prior"],
         ["4", "w<sub>section</sub>", "[0, 1]", "SOAP section suitability for the question intent"],
         ["5", "w<sub>length</sub>", "[0, 1]", "Preference for informative passage length"],
         ["6", "half-life", "[3, 180] days", "Decay constant of the recency term"],
         ["7", "length pivot", "[80, 900] chars", "Passage length at which the length score peaks"],
         ["8&ndash;13", "type priors", "[0, 1] each", "Authority of PROGRESS, ADMISSION, DISCHARGE, "
                                                      "CONSULT, SOAP, PROCEDURE notes"]],
        [16 * mm, 34 * mm, 32 * mm, 76 * mm],
        "Table [5.1] Genome layout of the ranking chromosome", align_center=[0, 2]))

    story.append(P("<b>5.1.2 Fitness Function</b>", h3))
    story.append(P(
        "Fitness blends three retrieval metrics so that the optimizer cannot succeed by exploiting "
        "any single one. Normalized Discounted Cumulative Gain dominates because ordering is the "
        "goal; Recall ensures relevant material is not lost; Mean Reciprocal Rank rewards placing "
        "the single best passage first."))
    story.append(code_block([
        "fitness(g)  =  0.60 x nDCG@5  +  0.25 x Recall@5  +  0.15 x MRR",
        "",
        "                     rel_i                          |{relevant in top k}|",
        "DCG@k  =  sum  ---------------        Recall@k  =  ----------------------",
        "               log2(i + 1)                          |{relevant total}|",
        "",
        "nDCG@k =  DCG@k / IDCG@k                MRR      =  1 / rank(first relevant)",
    ]))

    story.append(P("<b>5.1.3 Algorithm Flow</b>", h3))
    story.append(figure(F.fig_ga(), "Figure [5.1] Flowchart of the real-valued Genetic Algorithm"))
    story.append(K["KeepTogether"]([P("<b>Pseudocode</b>", h3), code_block([
        "ALGORITHM  GeneticAlgorithm(N, G, pc, pm, sigma, E, k)",
        "  P <- N random chromosomes in [0,1]^14",
        "  evaluate f(g) for all g in P",
        "  for generation = 1 to G do",
        "      sort P by fitness, descending",
        "      P' <- first E chromosomes of P                  // elitism",
        "      while |P'| < N do",
        "          p1 <- tournament(P, k);  p2 <- tournament(P, k)",
        "          if rand() < pc then  c1, c2 <- BLX_alpha(p1, p2)",
        "          else                 c1, c2 <- copy(p1), copy(p2)",
        "          P' <- P' + mutate(c1, pm, sigma) + mutate(c2, pm, sigma)",
        "      P <- P';  evaluate f(g) for all g in P",
        "      record best, mean, worst fitness and population diversity",
        "  return argmax f(g)",
    ])]))
    story.extend(data_table(
        ["Parameter", "Symbol", "Value", "Effect if increased"],
        [["Population size", "N", "60", "Broader sampling per generation, higher cost"],
         ["Generations", "G", "40", "More refinement, diminishing returns"],
         ["Crossover rate", "p<sub>c</sub>", "0.85", "More recombination, less cloning"],
         ["Mutation rate", "p<sub>m</sub>", "0.15", "More exploration; too high becomes random search"],
         ["Mutation sigma", "&sigma;", "0.18", "Larger perturbation steps"],
         ["Elitism", "E", "2", "Stronger preservation, slower diversity loss"],
         ["Tournament size", "k", "3", "Higher selection pressure, faster convergence"]],
        [40 * mm, 18 * mm, 20 * mm, 80 * mm],
        "Table [5.2] Genetic Algorithm control parameters", align_center=[1, 2]))

    story.append(P("<b>5.1.4 Particle Swarm Optimization on the Same Objective</b>", h3))
    story.append(P(
        "The identical fourteen-dimensional objective is also optimized by Particle Swarm "
        "Optimization, and the better of the two is deployed. Running both is informative: it "
        "shows that the problem formulation, not the particular metaheuristic, is what matters, "
        "and it provides a fair comparison on identical data and an identical fitness function."))
    story.append(figure(F.fig_pso(), "Figure [5.2] Flowchart of Particle Swarm Optimization"))
    story.extend(data_table(
        ["Parameter", "Symbol", "Value", "Role"],
        [["Swarm size", "n", "60", "Number of candidate solutions in flight"],
         ["Iterations", "T", "40", "Search budget"],
         ["Inertia (start &rarr; end)", "w", "0.9 &rarr; 0.4",
          "Decays linearly so the swarm explores early and exploits late"],
         ["Cognitive coefficient", "c<sub>1</sub>", "1.5", "Attraction to the particle's own best"],
         ["Social coefficient", "c<sub>2</sub>", "1.5", "Attraction to the swarm's best"],
         ["Velocity clamp", "v<sub>max</sub>", "0.25", "Prevents divergence across the space"]],
        [42 * mm, 20 * mm, 26 * mm, 70 * mm],
        "Table [5.3] Particle Swarm Optimization control parameters", align_center=[1, 2]))

    # ---- 5.2 Tasks -------------------------------------------------------
    story.append(P("<b>5.2 Algorithm 2 &mdash; Care-Task Triage (Genetic Algorithm)</b>", h2))
    story.append(P(
        "The task queue was previously ordered by a fixed SQL sort, "
        "<font face='Courier' size='9'>ORDER BY due_time ASC, priority DESC</font>. Such a rule "
        "cannot express a judgement a charge nurse makes continuously: an overdue MEDIUM medication "
        "for a CRITICAL patient must outrank a not-yet-due HIGH hygiene task."))
    story.append(P(
        "The key methodological point is how the training signal is obtained. A clinician cannot "
        "readily state a scoring formula, but can readily state <i>preferences</i> — that this task "
        "should precede that one. The Genetic Algorithm is therefore given only orderings, and must "
        "recover a weight vector consistent with them. Fitness is the fraction of expert pairwise "
        "judgements the policy reproduces, blended with Kendall's &tau; and top-1 accuracy."))
    story.extend(data_table(
        ["Feature", "Encoding", "Clinical meaning"],
        [["Stated priority", "STAT 1.0 / HIGH 0.72 / MEDIUM 0.4 / LOW 0.12",
          "The nominal urgency recorded with the order"],
         ["Patient acuity", "CRITICAL 1.0 / ADMITTED 0.55 / STABLE 0.28",
          "How sick the patient is right now"],
         ["Overdue", "Hours past due, saturating at an evolved scale",
          "How far the task has slipped"],
         ["Time pending", "Hours since creation, normalised", "Staleness of the request"],
         ["Nurse workload", "Open tasks for the assignee, inverted",
          "Prevents one nurse's backlog dominating the ward board"],
         ["Task category", "Six evolved priors over medication, assessment, labs, vitals, "
                           "mobility, hygiene", "Learned clinical weight of the type of work"]],
        [34 * mm, 62 * mm, 60 * mm],
        "Table [5.4] Feature set of the care-task triage policy"))
    story.append(code_block([
        "fitness(policy) = 0.60 x pairwise_agreement",
        "                + 0.25 x (Kendall_tau + 1) / 2",
        "                + 0.15 x top1_accuracy",
        "",
        "pairwise_agreement = |{(a,b) : expert prefers a, and score(a) > score(b)}| / |pairs|",
    ]))

    # ---- 5.3 AIS ---------------------------------------------------------
    story.append(P("<b>5.3 Algorithm 3 &mdash; Artificial Immune System</b>", h2))
    story.append(P(
        "Each vital-sign record is a point in a seven-dimensional space of heart rate, systolic and "
        "diastolic pressure, respiratory rate, temperature, oxygen saturation and blood glucose, "
        "normalised onto the unit hypercube using physiologically recordable bounds."))
    story.append(figure(F.fig_ais(), "Figure [5.3] Flowchart of the Negative Selection Algorithm"))
    story.append(P(
        "One design decision is worth stating explicitly because it delimits the algorithm's role "
        "honestly. Two classes of error are <i>enumerable</i>: values outside the physiologically "
        "recordable range, and impossible relationships such as a diastolic pressure at or above "
        "the systolic. These are handled by deterministic rules that run before the immune "
        "checkpoint. Negative selection exists to catch error modes nobody enumerated, so a "
        "known-impossible relation is given a rule rather than left to a randomly placed detector."))
    story.append(K["KeepTogether"]([P("<b>Pseudocode</b>", h3), code_block([
        "ALGORITHM  NegativeSelection(SELF, r_self, D)",
        "  detectors <- empty",
        "  while |detectors| < D and attempts < limit do",
        "      c <- random point in [0,1]^7",
        "      d <- distance(c, nearest member of SELF)",
        "      if d <= r_self then",
        "          discard c                      // binds self: apoptosis",
        "      else if c already covered by an existing detector then",
        "          discard c                      // keeps coverage spreading",
        "      else",
        "          radius <- d - r_self           // V-detector: grow until it nearly touches self",
        "          detectors <- detectors + (c, radius)",
        "  return detectors",
        "",
        "CLASSIFY(x):   anomalous  <=>  exists detector k with distance(x, k) <= radius(k)",
    ])]))

    # ---- 5.4 Compression -------------------------------------------------
    story.append(P("<b>5.4 Algorithm 4 &mdash; Embedding Compression (Binary GA)</b>", h2))
    story.append(P(
        "The sentence encoder emits 384 dimensions per passage. Not all carry retrieval signal for "
        "this corpus. A Binary Genetic Algorithm evolves a 384-bit mask in which a set bit retains "
        "the corresponding dimension in the index."))
    story.append(figure(F.fig_binga(),
                        "Figure [5.4] Binary Genetic Algorithm for embedding dimension selection"))
    story.append(P(
        "<b>Uniform crossover</b> is used rather than single-point crossover: each child bit is "
        "taken from either parent by an independent coin flip, which recombines useful <i>groups</i> "
        "of dimensions wherever they sit in the chromosome instead of only contiguous blocks."))
    story.append(P(
        "It is on this algorithm that <b>bit-flip mutation is strictly essential</b>, and the "
        "contrast with the real-valued Genetic Algorithm of Section 5.1 is instructive. Uniform "
        "crossover can never produce a bit value that neither parent possesses at that locus, so if "
        "a dimension is switched off across the whole population it can never be recovered by "
        "recombination alone. BLX-&alpha; on real genes suffers no such restriction because it "
        "samples beyond the parent interval. Section 6.5 measures this difference."))
    story.append(code_block([
        "fitness(mask) = nDCG@5( retrieval restricted to kept dimensions )",
        "              - lambda x max(0, (1 - retention) / (1 - target_retention))",
        "",
        "  lambda = 0.35     parsimony pressure; without it the GA simply keeps everything",
        "  retention = |kept dimensions| / 384",
    ]))
    story.append(P(
        "Vectors must be <b>re-normalised inside the reduced subspace</b>. Dropping coordinates "
        "shortens every vector; without renormalisation the inner product is no longer a cosine and "
        "the similarity threshold that governs refusal would silently change meaning."))

    # ---- 5.5 ACO ---------------------------------------------------------
    story.append(P("<b>5.5 Algorithm 5 &mdash; Query Routing (Ant Colony Optimization)</b>", h2))
    story.append(P(
        "<b>Scoping note.</b> The original proposal envisaged routing across separate stores such "
        "as encounters, prescriptions and reports. This system has a single clinical-notes store, "
        "so that formulation would not have been truthful. It does, however, contain a genuine "
        "partitioned search space: every indexed passage carries a (note type &times; SOAP section) "
        "label, giving thirty addressable partitions. The colony optimizes routing across those."))
    story.append(figure(F.fig_aco(),
                        "Figure [5.5] Ant Colony Optimization over intent-partition edges"))
    story.append(K["KeepTogether"]([P("<b>Pseudocode</b>", h3), code_block([
        "ALGORITHM  AntColony(intents, partitions, ants, iterations, rho, alpha, beta, budget)",
        "  tau(i,p) <- tau_0  for all edges",
        "  for iteration = 1 to iterations do",
        "      deposits <- 0",
        "      for each of `ants` ants do",
        "          i     <- sample a query intent",
        "          route <- choose `budget` partitions, P(p) prop. to tau^alpha x eta^beta",
        "          if the gold partition appears at position r in route then",
        "              quality <- (1 / (r+1)) x (1 - 0.5 x scanned / total)",
        "              deposits(i,p) += Q x quality / (step index)",
        "      tau <- (1 - rho) x tau            // evaporate first: forgetting",
        "      tau <- tau + deposits / ants      // then reinforce",
        "      clamp tau to [tau_min, tau_max]",
        "  return tau",
    ])]))
    story.append(PageBreak())

    # ======================================================================
    # CHAPTER 6 — TESTING AND RESULTS
    # ======================================================================
    K['mark'](story, 'chapter'); chapter(story, 6, "TESTING, RESULTS AND ANALYSIS")

    story.append(P("<b>6.1 Evaluation Methodology</b>", h2))
    story.append(figure(F.fig_methodology(),
                        "Figure [6.1] Training and held-out evaluation methodology"))
    story.append(P(
        f"A clinically structured corpus of 38 patients and 822 indexed passages was generated, "
        f"together with labelled ground truth recorded at generation time rather than inferred "
        f"afterwards: {M['ranking_cases']} labelled retrieval queries, {M['task_scenarios']} "
        f"expert-ordered triage scenarios, and 252 vital-sign records of which 28 carry a planted "
        f"documentation error drawn from six corruption types. Every optimizer trains on a 70% "
        f"split and every figure reported below is measured on the remaining 30%, which the "
        f"optimizer never saw."))

    story.append(P("<b>6.2 A Methodological Error That Was Detected and Corrected</b>", h2))
    story.append(P(
        "An early version of the benchmark defined relevance at the level of the <i>note</i>: every "
        "passage belonging to the correct note was marked relevant. Training against it produced a "
        "perfect nDCG of 1.000, which was treated as a warning rather than a result."))
    story.append(P(
        "Inspection of the evolved chromosome showed why. Because the generated questions were "
        "always answered by the admission note, the Genetic Algorithm had driven "
        "w<sub>similarity</sub> to <b>0.000</b> and the ADMISSION type prior to approximately 1.0. "
        "It had discovered that it could ignore the content entirely and score perfectly by "
        "ranking one note type first — it was exploiting a leak in the label, not learning retrieval."))
    story.append(P(
        "The benchmark was rebuilt with relevance graded at <b>passage level by SOAP section</b> "
        "(1.0 for the correct section in the most recent note, 0.6 in an older note, 0 otherwise). "
        "Since every note type contains every section, no note-type prior can substitute for "
        "reading the content. The honest figures reported below come from the corrected benchmark. "
        "A second ordering defect was also corrected: dimension selection now runs <i>before</i> "
        "ranking, because it changes the vector space and would otherwise leave the ranking weights "
        "tuned against similarity values the served index no longer produces."))

    story.append(P("<b>6.3 Consolidated Results</b>", h2))
    story.extend(data_table(
        ["#", "Algorithm", "Metric", "Baseline", "Optimized", "Change"],
        [["1", "GA / PSO", "nDCG@5", f"{r['baseline']['ndcg_at_5']}",
          f"<b>{r['optimized']['ndcg_at_5']}</b>", f"<b>{r['improvement_pct']['ndcg_at_5']:+}%</b>"],
         ["", "", "nDCG@3", f"{r['baseline']['ndcg_at_3']}", f"{r['optimized']['ndcg_at_3']}",
          f"{r['improvement_pct']['ndcg_at_3']:+}%"],
         ["", "", "Recall@5", f"{r['baseline']['recall_at_5']}", f"{r['optimized']['recall_at_5']}",
          f"{r['improvement_pct']['recall_at_5']:+}%"],
         ["", "", "MRR", f"{r['baseline']['mrr']}", f"{r['optimized']['mrr']}",
          f"{r['improvement_pct']['mrr']:+}%"],
         ["2", "GA", "Pairwise agreement", f"{t['baseline']['pairwise_agreement']}",
          f"<b>{t['optimized']['pairwise_agreement']}</b>",
          f"<b>{t['improvement_pct']['pairwise_agreement']:+}%</b>"],
         ["", "", "Kendall's tau", f"{t['baseline']['kendall_tau']}", f"{t['optimized']['kendall_tau']}",
          f"{t['improvement_pct']['kendall_tau']:+}%"],
         ["", "", "Top-1 accuracy", f"{t['baseline']['top1_accuracy']}",
          f"{t['optimized']['top1_accuracy']}", f"{t['improvement_pct']['top1_accuracy']:+}%"],
         ["3", "AIS", "Detection rate", "0.000", f"<b>{i['metrics']['detection_rate']}</b>",
          "&mdash;"],
         ["", "", "False-alarm rate", "&mdash;", f"<b>{i['metrics']['false_alarm_rate']}</b>", "&mdash;"],
         ["", "", "F1 score", "&mdash;", f"{i['metrics']['f1']}", "&mdash;"],
         ["4", "Binary GA", "Dimensions kept", f"{c['baseline']['dims_total']}",
          f"<b>{c['optimized']['dims_kept']}</b>",
          f"-{100 - c['optimized']['retention_pct']:.1f}%"],
         ["", "", "Bytes per vector", f"{c['baseline']['bytes_per_vector']}",
          f"{c['optimized']['bytes_per_vector']}",
          f"-{c['improvement']['memory_saved_pct']}%"],
         ["", "", "nDCG@5", f"{c['baseline']['ndcg_at_5']}", f"{c['optimized']['ndcg_at_5']}",
          f"{c['improvement']['ndcg_delta_pct']:+}%"],
         ["5", "ACO", "Chunks scanned", f"{o['baseline']['mean_chunks_scanned']:.0f}",
          f"<b>{o['optimized']['mean_chunks_scanned']:.0f}</b>",
          f"-{o['optimized']['scan_reduction_pct']}%"],
         ["", "", "Partitions probed", f"{o['baseline']['mean_partitions_scanned']:.0f}",
          f"{o['optimized']['mean_partitions_scanned']:.0f}", "&mdash;"],
         ["", "", "Gold-partition hit rate", f"{o['baseline']['hit_rate']}",
          f"{o['optimized']['hit_rate']}", "&mdash;"]],
        [9 * mm, 24 * mm, 38 * mm, 22 * mm, 24 * mm, 22 * mm],
        "Table [6.1] Consolidated results for all five optimizers, measured on held-out data",
        align_center=[0, 3, 4, 5], font=9.5))

    story.append(P("<b>6.4 Analysis of Each Result</b>", h2))
    story.append(P("<b>6.4.1 Ranking</b>", h3))
    story.append(P(
        f"The evolved policy improves nDCG@5 by {r['improvement_pct']['ndcg_at_5']}% on queries it "
        f"never trained on. The winner on this run was the <b>{M['ranking_selected']}</b>, but only "
        f"just: best fitness {M['ga_fitness']:.4f} against {M['pso_fitness']:.4f} for Particle "
        f"Swarm Optimization is a margin below 0.1%, and the winner alternates between the two "
        f"across seeds. The useful conclusion is therefore <i>not</i> that one metaheuristic is "
        f"superior, but that both solve this fourteen-dimensional problem comparably well &mdash; "
        f"what mattered was formulating the problem so a population-based search could be applied "
        f"at all. More informative than the headline number is the shape of the evolved chromosome:"))
    story.extend(data_table(
        ["Gene", "Evolved value", "Interpretation"],
        [["w<sub>similarity</sub>", f"{rw['w_similarity']}",
          "Embedding similarity is retained as a real contributor, not discarded"],
         ["w<sub>recency</sub>", f"{rw['w_recency']}",
          f"Half-life {rw['half_life_days']} days — a mild, long-horizon preference for newer notes"],
         ["w<sub>lexical</sub>", f"{rw['w_lexical']}",
          "Verbatim overlap catches drug names and organisms that embeddings blur"],
         ["w<sub>section</sub>", f"{rw['w_section']}",
          "Section suitability contributes materially, as clinical intuition predicts"],
         ["w<sub>type</sub>", f"{rw['w_type']}",
          "Small, i.e. correctly learned to be weakly informative once the label leak was removed"],
         ["w<sub>length</sub>", f"{rw['w_length']}",
          f"Peaks near {rw['length_pivot']} characters"]],
        [30 * mm, 26 * mm, 82 * mm], None, align_center=[1]))
    story.append(P(
        "The contrast with the leaking benchmark of Section 6.2 is the strongest available evidence "
        "that the corrected benchmark is sound. There, the optimizer had driven "
        "w<sub>similarity</sub> to 0.000 and the ADMISSION type prior to 0.98. Here "
        f"w<sub>similarity</sub> is retained at {rw['w_similarity']} while the note-type weight has "
        f"fallen to {rw['w_type']} &mdash; the optimizer now reads content instead of exploiting a "
        "label artefact.", K["small"]))

    story.append(P("<b>6.4.2 Task Triage</b>", h3))
    story.append(P(
        f"Agreement with expert orderings rises from {t['baseline']['pairwise_agreement']} to "
        f"{t['optimized']['pairwise_agreement']} across {t['baseline']['scenarios']} held-out "
        f"scenarios comprising {t['baseline']['pairs']} pairwise judgements. Top-1 accuracy — "
        f"whether the single most urgent task is identified correctly — rises from "
        f"{t['baseline']['top1_accuracy']} to {t['optimized']['top1_accuracy']}. The evolved policy "
        f"places substantial weight on patient acuity ({tp['w_acuity']}) and overdue status "
        f"({tp['w_overdue']}) alongside stated priority ({tp['w_priority']}), which is exactly the "
        f"trade-off the fixed SQL sort was structurally unable to represent."))

    story.append(P("<b>6.4.3 Artificial Immune System</b>", h3))
    story.extend(data_table(
        ["", "Predicted anomalous", "Predicted normal"],
        [["<b>Actually erroneous</b>", f"TP = {i['metrics']['true_positives']}",
          f"FN = {i['metrics']['false_negatives']}"],
         ["<b>Actually normal</b>", f"FP = {i['metrics']['false_positives']}",
          f"TN = {i['metrics']['true_negatives']}"]],
        [44 * mm, 46 * mm, 46 * mm],
        "Table [6.2] Confusion matrix of the Artificial Immune System on held-out vitals",
        align_center=[1, 2]))
    story.append(P(
        f"The system detects {i['metrics']['detection_rate'] * 100:.1f}% of planted errors with "
        f"<b>zero false alarms</b> ({i['metrics']['false_positives']} of "
        f"{i['metrics']['false_positives'] + i['metrics']['true_negatives']} normal readings "
        f"flagged), giving precision {i['metrics']['precision']} and F1 {i['metrics']['f1']}. The "
        f"{i['metrics']['detectors']} matured detectors cover an estimated "
        f"{i['metrics']['coverage'] * 100:.0f}% of non-self space. Crucially, the model was trained "
        f"on {M['immune_detail']['train_self_count']} normal readings and shown <b>no error "
        f"examples whatsoever</b>, yet generalises across six distinct corruption types."))

    story.append(P("<b>6.4.4 Embedding Compression</b>", h3))
    story.append(P(
        f"The evolved mask retains {c['optimized']['dims_kept']} of "
        f"{c['baseline']['dims_total']} dimensions, a {c['optimized']['compression_ratio']}&times; "
        f"compression that removes {c['improvement']['memory_saved_pct']}% of the memory required "
        f"per vector. Held-out retrieval accuracy changed by "
        f"{c['improvement']['ndcg_delta_pct']:+}%."))
    story.append(P(
        f"<b>The accuracy figure must be read with care, and this report deliberately does not "
        f"present it as a clean gain.</b> The compression benchmark holds out only "
        f"{M['compression_split']['test']} queries, so its variance across seeds is large: repeated "
        f"runs of this same configuration produced held-out changes of &minus;1.46%, +0.54%, "
        f"+1.07% and {c['improvement']['ndcg_delta_pct']:+}%. A single run on a split this small "
        f"cannot distinguish a genuine accuracy improvement from sampling noise, and it would be "
        f"dishonest to claim compression improves retrieval on that evidence. The defensible "
        f"conclusion is that accuracy is <b>preserved</b> &mdash; the evolved mask never degraded "
        f"it materially in any run."))
    story.append(P(
        f"The gain that <i>is</i> stable across every seed is the "
        f"{c['improvement']['memory_saved_pct']}% reduction in memory per vector. It follows "
        f"deterministically from retaining {c['optimized']['dims_kept']} of "
        f"{c['baseline']['dims_total']} dimensions and is not subject to sampling variance at all. "
        f"The measured scan speed-up of {c['improvement']['search_speedup_x']}&times; is modest "
        f"because a per-patient index holds only about twenty vectors, so fixed costs dominate; "
        f"the saving would matter considerably more at hospital scale."))

    story.append(P("<b>6.4.5 Query Routing</b>", h3))
    story.append(P(
        f"The colony reduces the mean number of passages scanned per query from "
        f"{o['baseline']['mean_chunks_scanned']:.0f} to "
        f"{o['optimized']['mean_chunks_scanned']:.0f}, a reduction of "
        f"{o['optimized']['scan_reduction_pct']}%, by probing "
        f"{o['optimized']['mean_partitions_scanned']:.0f} partitions instead of "
        f"{o['baseline']['mean_partitions_scanned']:.0f}."))
    story.append(P(
        f"<b>This gain is not free and the report does not present it as such.</b> The "
        f"gold-partition hit rate is {o['optimized']['hit_rate']}, not 1.0: narrowing the search "
        f"costs recall. The production pipeline compensates with the fallback described in Section "
        f"4.2, so the cost of a miss is one additional scan rather than a wrong answer — but the "
        f"raw algorithmic trade-off is real and is reported honestly."))

    story.append(P("<b>6.5 Ablation: What Each Operator Contributes</b>", h2))
    story.append(P(
        "Because operators are easiest to understand when removed, the browser implementations were "
        "used to run controlled ablations. Each row below is an automatically verified assertion."))
    story.extend(data_table(
        ["Operator removed", "Observed effect", "Interpretation"],
        [["Mutation and crossover both disabled",
          "Population collapses to 2 distinct chromosomes of 20; best and mean fitness flatline "
          "permanently from generation 5",
          "Selection alone cannot create a solution that is not already present"],
         ["Elitism disabled (small population, high mutation)",
          "40 generations across 12 seeds show the population best getting <i>worse</i>; with "
          "elitism the count is exactly 0",
          "Elitism is what makes the best-fitness curve monotonic"],
         ["Tournament size reduced to 1",
          "Mean population fitness falls from 0.981 to 0.875",
          "Selection pressure drives the population, not just the single best individual"],
         ["Bit-flip mutation disabled (Binary GA)",
          "Diversity falls to exactly 0.000; 22 of 27 useful dimensions recovered instead of 27",
          "Uniform crossover cannot introduce a bit no parent has, so mutation is <i>essential</i> "
          "here — unlike the real-valued GA, where BLX-alpha samples beyond the parents"],
         ["Cognitive term set to zero (PSO)",
          "Swarm converges on the decoy peak in about half of runs versus roughly one in ten with "
          "balanced settings",
          "Individual memory is what allows escape from a local optimum"],
         ["Pheromone influence alpha = 0 (ACO)",
          "Trail spread stays at 0.341 against 1.385 when trained",
          "With alpha = 0 the ants ignore experience; no learning occurs at all"]],
        [40 * mm, 60 * mm, 56 * mm],
        "Table [6.3] Ablation study: the contribution of each operator"))

    story.append(P("<b>6.6 Software Testing</b>", h2))
    story.append(P(
        "Two independent suites are maintained. The backend suite of <b>35 pytest tests</b> covers "
        "authentication, role-based access enforcement, per-patient vector isolation, the refusal "
        "threshold, and the algorithmic properties of every optimizer — that each converges on a "
        "known optimum, that no immune detector ever overlaps the self region, and that the colony "
        "concentrates pheromone on the rewarding partition."))
    story.append(P(
        "The frontend suite of <b>33 assertions</b> verifies every pedagogical claim the Bio-Lab "
        "makes. This was not a formality: three claims written into the interface were found to be "
        "false and were corrected rather than published. The most instructive was the claim that "
        "disabling mutation stalls the Genetic Algorithm, which is untrue for BLX-&alpha; "
        "crossover; the genuine case is the Binary Genetic Algorithm, and the teaching material "
        "was rewritten to say so."))
    story.append(PageBreak())

    # ======================================================================
    # CHAPTER 7 — CONCLUSION
    # ======================================================================
    K['mark'](story, 'chapter'); chapter(story, 7, "CONCLUSION AND FUTURE ENHANCEMENTS")

    story.append(P("<b>7.1 Conclusion</b>", h2))
    story.append(P(
        "This project applied five bio-inspired algorithms drawn from three families — "
        "evolutionary computation, swarm intelligence and immune-inspired computation — to five "
        "decision points inside a working clinical information system. In every case the algorithm "
        "replaced a specific hand-written rule and was measured against exactly that rule on data "
        "it had never seen."))
    story.append(P(
        f"Retrieval ranking improved by {r['improvement_pct']['ndcg_at_5']}% in nDCG@5. Agreement "
        f"with expert clinical triage improved by {t['improvement_pct']['pairwise_agreement']}%. "
        f"The immune system detected {i['metrics']['detection_rate'] * 100:.1f}% of planted "
        f"documentation errors at a zero false-alarm rate, having been trained on normal data "
        f"alone. Dimension selection removed {c['improvement']['memory_saved_pct']}% of index "
        f"memory at break-even accuracy, and colony routing removed "
        f"{o['optimized']['scan_reduction_pct']}% of the scanning work at a measured and "
        f"acknowledged recall cost."))
    story.append(P(
        "The central lesson is that the choice of a metaheuristic should follow from the structure "
        "of the objective. Each problem here was selected because it defeats classical methods for "
        "a specific, statable reason: a rank metric with no gradient, a step function over "
        "preferences, an absence of negative training examples, a search over 2<super>384</super> "
        "subsets, and a policy that must keep adapting rather than converge. Nature-inspired "
        "search is not a decorative choice in any of these cases; it is the applicable one."))
    story.append(P(
        "Equally important is what the project demonstrates about evaluation. A benchmark defect "
        "that produced a perfect score was detected, diagnosed through the evolved chromosome, and "
        "corrected — and three claims in the teaching interface were found false by automated "
        "verification and rewritten. An optimizer will exploit whatever its fitness function "
        "actually rewards, which makes careful benchmark construction inseparable from the "
        "algorithmic work itself."))

    story.append(P("<b>7.2 Future Enhancements</b>", h2))
    story.extend(data_table(
        ["Enhancement", "Description"],
        [["Multi-objective optimization (NSGA-II)",
          "Replace the weighted-sum fitness with a true Pareto front over accuracy, latency and "
          "index size, so the trade-off is presented to the operator rather than fixed in advance."],
         ["Adaptive parameter control",
          "Self-adapt mutation rate and inertia from measured population diversity instead of "
          "holding them constant throughout a run."],
         ["Clonal Selection (CLONALG)",
          "Add a second immune algorithm so that detectors improve by affinity maturation rather "
          "than being generated purely at random."],
         ["Artificial Bee Colony / Firefly",
          "Extend the head-to-head comparison beyond GA and PSO on the identical ranking objective."],
         ["Online pheromone updating",
          "Update the colony from live query outcomes in production, exploiting the adaptivity that "
          "evaporation already provides."],
         ["Parallel island model",
          "Evolve several sub-populations concurrently with periodic migration to improve "
          "exploration on larger corpora."],
         ["Clinician-in-the-loop labelling",
          "Replace the elicitation rubric used for triage scenarios with preferences gathered from "
          "practising clinicians."]],
        [50 * mm, 106 * mm],
        "Table [7.1] Future enhancements"))
    story.append(PageBreak())

    # ======================================================================
    # REFERENCES
    # ======================================================================
    K["mark"](story, "refs")
    story.append(P("<b>REFERENCES</b>", K["S"]("refh", fontName="Times-Bold", fontSize=17,
                                               leading=22, alignment=1, spaceAfter=16)))
    refs = [
        "J. H. Holland, <i>Adaptation in Natural and Artificial Systems</i>. Ann Arbor, MI, USA: "
        "University of Michigan Press, 1975.",
        "D. E. Goldberg, <i>Genetic Algorithms in Search, Optimization and Machine Learning</i>. "
        "Reading, MA, USA: Addison-Wesley, 1989.",
        "J. Kennedy and R. Eberhart, &ldquo;Particle swarm optimization,&rdquo; in "
        "<i>Proc. IEEE Int. Conf. Neural Networks</i>, Perth, Australia, 1995, pp. 1942&ndash;1948.",
        "Y. Shi and R. Eberhart, &ldquo;A modified particle swarm optimizer,&rdquo; in "
        "<i>Proc. IEEE Int. Conf. Evolutionary Computation</i>, Anchorage, AK, USA, 1998, "
        "pp. 69&ndash;73.",
        "M. Dorigo, V. Maniezzo, and A. Colorni, &ldquo;Ant system: optimization by a colony of "
        "cooperating agents,&rdquo; <i>IEEE Trans. Systems, Man, and Cybernetics, Part B</i>, "
        "vol. 26, no. 1, pp. 29&ndash;41, 1996.",
        "M. Dorigo and T. St&uuml;tzle, <i>Ant Colony Optimization</i>. Cambridge, MA, USA: "
        "MIT Press, 2004.",
        "S. Forrest, A. S. Perelson, L. Allen, and R. Cherukuri, &ldquo;Self-nonself discrimination "
        "in a computer,&rdquo; in <i>Proc. IEEE Symp. Security and Privacy</i>, Oakland, CA, USA, "
        "1994, pp. 202&ndash;212.",
        "Z. Ji and D. Dasgupta, &ldquo;Real-valued negative selection algorithm with "
        "variable-sized detectors,&rdquo; in <i>Proc. Genetic and Evolutionary Computation "
        "Conf. (GECCO)</i>, 2004, pp. 287&ndash;298.",
        "L. N. de Castro and J. Timmis, <i>Artificial Immune Systems: A New Computational "
        "Intelligence Approach</i>. London, U.K.: Springer, 2002.",
        "L. J. Eshelman and J. D. Schaffer, &ldquo;Real-coded genetic algorithms and "
        "interval-schemata,&rdquo; in <i>Foundations of Genetic Algorithms 2</i>, 1993, "
        "pp. 187&ndash;202.",
        "K. Deb, A. Pratap, S. Agarwal, and T. Meyarivan, &ldquo;A fast and elitist multiobjective "
        "genetic algorithm: NSGA-II,&rdquo; <i>IEEE Trans. Evolutionary Computation</i>, vol. 6, "
        "no. 2, pp. 182&ndash;197, 2002.",
        "K. J&auml;rvelin and J. Kek&auml;l&auml;inen, &ldquo;Cumulated gain-based evaluation of IR "
        "techniques,&rdquo; <i>ACM Trans. Information Systems</i>, vol. 20, no. 4, "
        "pp. 422&ndash;446, 2002.",
        "N. Reimers and I. Gurevych, &ldquo;Sentence-BERT: Sentence embeddings using Siamese "
        "BERT-networks,&rdquo; in <i>Proc. EMNLP-IJCNLP</i>, 2019, pp. 3982&ndash;3992.",
        "J. Johnson, M. Douze, and H. J&eacute;gou, &ldquo;Billion-scale similarity search with "
        "GPUs,&rdquo; <i>IEEE Trans. Big Data</i>, vol. 7, no. 3, pp. 535&ndash;547, 2021.",
        "M. G. Kendall, &ldquo;A new measure of rank correlation,&rdquo; <i>Biometrika</i>, "
        "vol. 30, no. 1/2, pp. 81&ndash;93, 1938.",
        "X.-S. Yang, <i>Nature-Inspired Optimization Algorithms</i>. London, U.K.: Elsevier, 2014.",
    ]
    ref_style = K["S"]("ref", fontSize=11.5, leading=16, spaceAfter=9)
    for n, ref in enumerate(refs, 1):
        story.append(P(f"[{n}]&nbsp;&nbsp;{ref}", ref_style))
