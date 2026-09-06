"""
Vector flowcharts for the NeuroSwarm Bio-Inspired Algorithms report.

Everything is drawn with ReportLab primitives so the diagrams stay crisp at any
zoom and embed as vectors rather than bitmaps.
"""
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon, Circle, Ellipse, PolyLine
from reportlab.lib.colors import HexColor, white, Color
from reportlab.lib.units import mm

# Palette — one accent per algorithm family, used consistently across every figure.
INK = HexColor("#0B1220")
GREY = HexColor("#64748B")
LINE = HexColor("#94A3B8")
GA = HexColor("#4F46E5")      # Genetic Algorithm      — indigo
PSO = HexColor("#0891B2")     # Particle Swarm         — cyan
AIS = HexColor("#E11D48")     # Artificial Immune Sys  — rose
BIN = HexColor("#059669")     # Binary GA              — emerald
ACO = HexColor("#D97706")     # Ant Colony             — amber
SLATE = HexColor("#475569")
BG_GA = HexColor("#EEF2FF")
BG_PSO = HexColor("#ECFEFF")
BG_AIS = HexColor("#FFF1F2")
BG_BIN = HexColor("#ECFDF5")
BG_ACO = HexColor("#FFFBEB")
BG_GREY = HexColor("#F1F5F9")


def _wrap(text, width):
    """Naive word wrap to a character budget per line."""
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if len(trial) <= width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def box(d, x, y, w, h, text, fill, stroke, fontsize=7.2, bold=True, radius=3,
        text_color=None, char_width=None, leading=None):
    d.add(Rect(x, y, w, h, fillColor=fill, strokeColor=stroke, strokeWidth=0.9, rx=radius, ry=radius))
    cw = char_width or max(6, int(w / (fontsize * 0.52)))
    lines = _wrap(text, cw)
    lead = leading or (fontsize + 1.6)
    total = len(lines) * lead
    ty = y + h / 2 + total / 2 - lead + 2.2
    font = "Times-Bold" if bold else "Times-Roman"
    for ln in lines:
        d.add(String(x + w / 2, ty, ln, fontName=font, fontSize=fontsize,
                     fillColor=text_color or INK, textAnchor="middle"))
        ty -= lead
    return d


def label(d, x, y, text, size=6.6, color=None, anchor="middle", bold=False):
    d.add(String(x, y, text, fontName="Times-Bold" if bold else "Times-Roman",
                 fontSize=size, fillColor=color or GREY, textAnchor=anchor))


def arrow(d, x1, y1, x2, y2, color=None, width=0.9, head=4.0, dash=None):
    c = color or SLATE
    ln = Line(x1, y1, x2, y2, strokeColor=c, strokeWidth=width)
    if dash:
        ln.strokeDashArray = dash
    d.add(ln)
    import math
    ang = math.atan2(y2 - y1, x2 - x1)
    for sgn in (1, -1):
        a = ang + sgn * 2.65
        d.add(Line(x2, y2, x2 + head * math.cos(a), y2 + head * math.sin(a),
                   strokeColor=c, strokeWidth=width))


def elbow(d, x1, y1, x2, y2, color=None, width=0.9, via_y=None):
    """Right-angled connector: across, down/up, then into the target."""
    c = color or SLATE
    vy = via_y if via_y is not None else (y1 + y2) / 2
    d.add(PolyLine([x1, y1, x1, vy, x2, vy], strokeColor=c, strokeWidth=width))
    arrow(d, x2, vy, x2, y2, color=c, width=width)


def diamond(d, cx, cy, w, h, text, fill, stroke, fontsize=6.6):
    d.add(Polygon([cx, cy + h / 2, cx + w / 2, cy, cx, cy - h / 2, cx - w / 2, cy],
                  fillColor=fill, strokeColor=stroke, strokeWidth=0.9))
    lines = _wrap(text, max(8, int(w / (fontsize * 0.62))))
    ty = cy + (len(lines) - 1) * (fontsize + 1) / 2
    for ln in lines:
        d.add(String(cx, ty - 2, ln, fontName="Times-Bold", fontSize=fontsize,
                     fillColor=INK, textAnchor="middle"))
        ty -= fontsize + 1


def band(d, x, y, w, h, title, color, bg):
    """A labelled phase container."""
    d.add(Rect(x, y, w, h, fillColor=bg, strokeColor=color, strokeWidth=0.7,
               rx=4, ry=4, strokeDashArray=[3, 2]))
    d.add(String(x + 6, y + h - 9.5, title, fontName="Times-Bold", fontSize=6.6,
                 fillColor=color, textAnchor="start"))


# ==========================================================================
# Fig 4.1 — Overall system architecture (where each algorithm plugs in)
# ==========================================================================
def fig_architecture(width=470, height=310):
    d = Drawing(width, height)
    W = width

    band(d, 4, 236, W - 8, 66, "PRESENTATION LAYER  (React + Vite)", SLATE, BG_GREY)
    box(d, 16, 250, 96, 34, "Doctor / Nurse Dashboard", white, SLATE, 6.9)
    box(d, 124, 250, 96, 34, "Clinical Retrieval Drawer", white, SLATE, 6.9)
    box(d, 232, 250, 96, 34, "Care Task Board", white, SLATE, 6.9)
    box(d, 340, 250, 114, 34, "Bio-Lab (5 interactive sandboxes)", BG_GA, GA, 6.9)

    band(d, 4, 176, W - 8, 52, "API LAYER  (FastAPI + JWT role-based access control)", SLATE, BG_GREY)
    box(d, 16, 186, 100, 28, "/api/rag/query", white, SLATE, 6.9, bold=False)
    box(d, 128, 186, 100, 28, "/api/tasks", white, SLATE, 6.9, bold=False)
    box(d, 240, 186, 100, 28, "/api/vitals", white, SLATE, 6.9, bold=False)
    box(d, 352, 186, 102, 28, "/api/bio/*", BG_GA, GA, 6.9, bold=False)

    band(d, 4, 78, W - 8, 90, "BIO-INSPIRED OPTIMIZATION LAYER", GA, HexColor("#FAFAFF"))
    box(d, 14, 92, 84, 58, "1 - ACO Router   intent to partition", BG_ACO, ACO, 6.8)
    box(d, 104, 92, 84, 58, "2 - FAISS Search   evolved subspace", BG_BIN, BIN, 6.8)
    box(d, 194, 92, 84, 58, "3 - GA / PSO Re-rank   six signals", BG_GA, GA, 6.8)
    box(d, 284, 92, 78, 58, "4 - GA Triage   task ordering", BG_GA, GA, 6.8)
    box(d, 368, 92, 86, 58, "5 - AIS Checkpoint   vitals screening", BG_AIS, AIS, 6.8)

    band(d, 4, 6, W - 8, 62, "DATA LAYER", SLATE, BG_GREY)
    box(d, 16, 16, 104, 34, "SQLite / PostgreSQL 38 patients", white, SLATE, 6.6, bold=False)
    box(d, 132, 16, 104, 34, "FAISS per-patient indices 822 chunks", white, SLATE, 6.6, bold=False)
    box(d, 248, 16, 100, 34, "Benchmarks 181 labelled queries", white, SLATE, 6.6, bold=False)
    box(d, 360, 16, 94, 34, "Trained artifacts data/bio/*.json", white, SLATE, 6.6, bold=False)

    for x in (64, 176, 290, 404):
        arrow(d, x, 250, x, 216, LINE, 0.8)
    for x in (66, 178, 290, 403):
        arrow(d, x, 186, x, 152, LINE, 0.8)
    for x in (60, 175, 300, 405):
        arrow(d, x, 92, x, 52, LINE, 0.8)
    return d


# ==========================================================================
# Fig 4.2 — Query pipeline: the five stages a clinical question passes through
# ==========================================================================
def fig_pipeline(width=470, height=250):
    d = Drawing(width, height)
    y = 176
    box(d, 8, y, 74, 40, "Clinical question", white, SLATE, 7.0)
    box(d, 96, y, 78, 40, "1  ACO routing pick partitions", BG_ACO, ACO, 6.8)
    box(d, 188, y, 78, 40, "2  FAISS search candidate pool k=20", BG_BIN, BIN, 6.8)
    box(d, 280, y, 78, 40, "3  GA/PSO re-rank six signals", BG_GA, GA, 6.8)
    diamond(d, 412, y + 20, 92, 46, "4  similarity >= 0.30 ?", HexColor("#FEF3C7"), HexColor("#B45309"), 6.6)

    for x1, x2 in ((82, 96), (174, 188), (266, 280), (358, 366)):
        arrow(d, x1, y + 20, x2, y + 20)

    # refusal branch
    box(d, 300, 96, 150, 32, "REFUSE - \"No relevant information found in this patient's records\"",
        HexColor("#FEE2E2"), HexColor("#B91C1C"), 6.5)
    arrow(d, 412, y - 3, 412, 128, HexColor("#B91C1C"))
    label(d, 424, 146, "no", 6.4, HexColor("#B91C1C"), "start", True)

    # accept branch
    box(d, 96, 96, 176, 32, "5  Extractive answer - sentences quoted verbatim, with citations",
        HexColor("#DCFCE7"), HexColor("#15803D"), 6.5)
    d.add(PolyLine([366, y + 20, 284, y + 20, 284, 128], strokeColor=HexColor("#15803D"), strokeWidth=0.9))
    arrow(d, 284, 128, 272, 112, HexColor("#15803D"))
    label(d, 300, y + 26, "yes", 6.4, HexColor("#15803D"), "middle", True)

    # fallback loop
    d.add(PolyLine([227, y, 227, 150, 135, 150, 135, y], strokeColor=ACO,
                   strokeWidth=0.8, strokeDashArray=[3, 2]))
    arrow(d, 135, 150, 135, y, ACO, 0.8)
    label(d, 181, 141, "fallback: routed pool too thin -> full patient scan", 6.2, ACO)

    box(d, 96, 30, 176, 34, "Answer + source citations returned to clinician", white, SLATE, 7.0)
    arrow(d, 184, 96, 184, 64, HexColor("#15803D"))

    label(d, 8, 12, "No language model is invoked at any stage of this pipeline.",
          6.6, INK, "start", True)
    return d


# ==========================================================================
# Fig 5.1 — Genetic Algorithm flowchart
# ==========================================================================
def fig_ga(width=470, height=330):
    d = Drawing(width, height)
    cx = 118
    box(d, cx - 52, 288, 104, 28, "START", BG_GREY, SLATE, 7.4)
    box(d, cx - 62, 244, 124, 32, "Initialise population P of N random genomes in [0,1]^14",
        BG_GA, GA, 6.8)
    box(d, cx - 62, 202, 124, 30, "Evaluate fitness f(g) for every genome", white, SLATE, 6.9)
    diamond(d, cx, 168, 132, 40, "generation < G ?", HexColor("#FEF3C7"), HexColor("#B45309"), 6.7)
    box(d, cx - 62, 108, 124, 30, "ELITISM copy top-E genomes unchanged", BG_GA, GA, 6.8)
    box(d, cx - 62, 66, 124, 30, "SELECTION tournament of size k", BG_GA, GA, 6.8)
    box(d, cx - 62, 24, 124, 30, "CROSSOVER BLX-alpha blend", BG_GA, GA, 6.8)

    right = 330
    box(d, right - 62, 24, 124, 30, "MUTATION Gaussian creep, rate p", BG_GA, GA, 6.8)
    box(d, right - 62, 66, 124, 30, "Replace P with new generation", white, SLATE, 6.9)
    box(d, right - 62, 244, 124, 32, "RETURN best genome = evolved weight vector",
        HexColor("#DCFCE7"), HexColor("#15803D"), 6.9)

    arrow(d, cx, 288, cx, 276)
    arrow(d, cx, 244, cx, 232)
    arrow(d, cx, 202, cx, 188)
    arrow(d, cx, 148, cx, 138)
    label(d, cx + 12, 143, "yes", 6.3, HexColor("#B45309"), "start", True)
    arrow(d, cx, 108, cx, 96)
    arrow(d, cx, 66, cx, 54)
    arrow(d, cx + 62, 39, right - 62, 39)
    arrow(d, right, 54, right, 96)
    d.add(PolyLine([right, 96, right, 152, cx + 66, 152], strokeColor=SLATE, strokeWidth=0.9))
    arrow(d, cx + 66, 152, cx + 66, 168)
    label(d, 244, 156, "next generation", 6.3, GREY)

    arrow(d, cx + 66, 168, right - 62, 168)
    d.add(PolyLine([right - 62, 168, right, 168, right, 244], strokeColor=HexColor("#15803D"),
                   strokeWidth=0.9))
    arrow(d, right, 232, right, 244, HexColor("#15803D"))
    label(d, 300, 176, "no - budget exhausted", 6.3, HexColor("#15803D"))
    return d


# ==========================================================================
# Fig 5.2 — Particle Swarm Optimization flowchart
# ==========================================================================
def fig_pso(width=470, height=300):
    d = Drawing(width, height)
    cx = 116
    box(d, cx - 56, 258, 112, 26, "START", BG_GREY, SLATE, 7.4)
    box(d, cx - 66, 214, 132, 32, "Initialise positions x and velocities v at random", BG_PSO, PSO, 6.8)
    box(d, cx - 66, 174, 132, 30, "Evaluate f(x); set pbest and gbest", white, SLATE, 6.8)
    diamond(d, cx, 140, 130, 38, "iteration < T ?", HexColor("#FEF3C7"), HexColor("#B45309"), 6.7)
    box(d, cx - 66, 78, 132, 42,
        "VELOCITY UPDATE v = w.v + c1.r1.(pbest - x) + c2.r2.(gbest - x)", BG_PSO, PSO, 6.6)
    box(d, cx - 66, 34, 132, 30, "Clamp |v| <= vmax; move x = x + v", BG_PSO, PSO, 6.8)

    right = 336
    box(d, right - 66, 34, 132, 30, "Evaluate f(x) at the new position", white, SLATE, 6.8)
    box(d, right - 66, 78, 132, 42, "Update pbest (personal) and gbest (swarm) if improved",
        BG_PSO, PSO, 6.7)
    box(d, right - 66, 214, 132, 32, "RETURN gbest = evolved weight vector",
        HexColor("#DCFCE7"), HexColor("#15803D"), 6.9)

    arrow(d, cx, 258, cx, 246)
    arrow(d, cx, 214, cx, 204)
    arrow(d, cx, 174, cx, 159)
    arrow(d, cx, 121, cx, 120)
    label(d, cx + 12, 118, "yes", 6.3, HexColor("#B45309"), "start", True)
    arrow(d, cx, 78, cx, 64)
    arrow(d, cx + 66, 49, right - 66, 49)
    arrow(d, right, 64, right, 78)
    d.add(PolyLine([right, 120, right, 150, cx + 65, 150], strokeColor=SLATE, strokeWidth=0.9))
    arrow(d, cx + 65, 150, cx + 65, 140)
    label(d, 250, 156, "next iteration", 6.3, GREY)

    arrow(d, cx + 65, 140, right - 66, 140)
    d.add(PolyLine([right - 66, 140, right, 140, right, 214], strokeColor=HexColor("#15803D"),
                   strokeWidth=0.9))
    arrow(d, right, 202, right, 214, HexColor("#15803D"))
    label(d, 300, 148, "no", 6.3, HexColor("#15803D"))

    label(d, 8, 14, "w = inertia (momentum)   c1 = cognitive pull (own memory)   "
                    "c2 = social pull (swarm best)   r1, r2 ~ U(0,1)", 6.4, INK, "start")
    return d


# ==========================================================================
# Fig 5.3 — Artificial Immune System: negative selection
# ==========================================================================
def fig_ais(width=470, height=330):
    """Vertical flow with both loop-backs routed outside the body of the
    diagram, so no connector crosses another."""
    d = Drawing(width, height)
    L = 118          # left column centre
    R = 350          # right column centre

    box(d, L - 62, 288, 124, 28, "Collect SELF set: normal vitals only", BG_AIS, AIS, 6.9)
    box(d, L - 62, 248, 124, 28, "Normalise each reading to [0,1]^7", white, SLATE, 6.9)
    box(d, L - 62, 196, 124, 32, "Generate random candidate detector c", BG_AIS, AIS, 6.8)
    diamond(d, L, 152, 142, 46, "dist(c, nearest self) <= r_self ?",
            HexColor("#FEF3C7"), HexColor("#B45309"), 6.4)
    box(d, L - 62, 74, 124, 32, "DESTROY c - it binds self (apoptosis)",
        HexColor("#FEE2E2"), HexColor("#B91C1C"), 6.7)

    box(d, R - 66, 138, 132, 34, "MATURE c: radius = dist - r_self; add to repertoire",
        HexColor("#DCFCE7"), HexColor("#15803D"), 6.7)
    diamond(d, R, 88, 132, 40, "|detectors| < D ?", HexColor("#FEF3C7"), HexColor("#B45309"), 6.6)
    box(d, R - 66, 16, 132, 32, "DEPLOY repertoire to the vitals checkpoint", BG_AIS, AIS, 6.8)

    # main downward spine
    arrow(d, L, 288, L, 276)
    arrow(d, L, 248, L, 228)
    arrow(d, L, 196, L, 175)
    arrow(d, L, 129, L, 106)
    label(d, L + 10, 114, "yes", 6.3, HexColor("#B91C1C"), "start", True)

    # branch to maturation
    arrow(d, L + 71, 152, R - 66, 152, HexColor("#15803D"))
    label(d, 236, 164, "no - reacts to nothing normal", 6.2, HexColor("#15803D"))

    arrow(d, R, 138, R, 108)
    arrow(d, R, 68, R, 48)
    label(d, R + 10, 56, "no - repertoire full", 6.2, GREY, "start")

    # loop-back 1: destroyed candidate, routed down the far left margin
    d.add(PolyLine([L - 62, 90, 34, 90, 34, 212], strokeColor=HexColor("#B91C1C"),
                   strokeWidth=0.9, strokeDashArray=[3, 2]))
    arrow(d, 34, 212, L - 62, 212, HexColor("#B91C1C"))
    label(d, 40, 218, "resample", 6.2, HexColor("#B91C1C"), "start")

    # loop-back 2: keep growing, routed above the decision node
    d.add(PolyLine([R - 66, 88, 240, 88, 240, 212, L + 62, 212], strokeColor=SLATE,
                   strokeWidth=0.9, strokeDashArray=[3, 2]))
    arrow(d, 240, 212, L + 62, 212, SLATE)
    label(d, 244, 95, "grow more", 6.2, GREY, "start")

    label(d, 8, 6, "Training never sees a single error example. Any later reading that falls "
                   "inside a matured detector is reported as non-self.", 6.4, INK, "start", True)
    return d


# ==========================================================================
# Fig 5.4 — Binary GA for embedding dimension selection
# ==========================================================================
def fig_binga(width=470, height=250):
    d = Drawing(width, height)
    box(d, 8, 196, 96, 36, "384-dim Sentence-BERT embeddings", white, SLATE, 6.8)
    box(d, 120, 196, 96, 36, "Binary genome: 384 bits, 1 = keep dimension", BG_BIN, BIN, 6.7)
    box(d, 232, 196, 100, 36, "Uniform crossover + bit-flip mutation", BG_BIN, BIN, 6.7)
    box(d, 348, 196, 108, 36, "Evaluate masked retrieval nDCG@5", white, SLATE, 6.8)

    box(d, 232, 128, 224, 34,
        "FITNESS  =  nDCG@5(kept dims)  -  lambda x (dims kept / 384)",
        HexColor("#F0FDF4"), BIN, 7.0)
    box(d, 8, 128, 208, 34, "accuracy term keeps retrieval usable   |   "
                            "parsimony term forces compression", BG_GREY, SLATE, 6.5, bold=False)

    box(d, 120, 58, 110, 38, "Best mask: 141 of 384 dims retained", HexColor("#DCFCE7"),
        HexColor("#15803D"), 6.9)
    box(d, 250, 58, 110, 38, "Rebuild every FAISS index in the evolved subspace",
        BG_BIN, BIN, 6.8)
    box(d, 380, 58, 82, 38, "62% smaller vectors", HexColor("#DCFCE7"), HexColor("#15803D"), 6.9)

    for x1, x2 in ((104, 120), (216, 232), (332, 348)):
        arrow(d, x1, 214, x2, 214)
    arrow(d, 402, 196, 402, 162)
    d.add(PolyLine([344, 145, 300, 145, 300, 190], strokeColor=SLATE, strokeWidth=0.9,
                   strokeDashArray=[3, 2]))
    arrow(d, 300, 190, 300, 196, SLATE)
    label(d, 306, 172, "next generation", 6.2, GREY, "start")
    arrow(d, 232, 145, 216, 145)
    arrow(d, 175, 128, 175, 96)
    arrow(d, 230, 77, 250, 77)
    arrow(d, 360, 77, 380, 77)

    label(d, 8, 22, "Renormalising inside the reduced subspace is essential - without it the inner "
                    "product is no longer a cosine and the similarity threshold breaks.",
          6.4, INK, "start")
    return d


# ==========================================================================
# Fig 5.5 — Ant Colony Optimization routing
# ==========================================================================
def fig_aco(width=470, height=300):
    d = Drawing(width, height)
    intents = ["medication", "lab", "symptom", "diagnosis"]
    parts = ["PROGRESS :: Plan", "PROGRESS :: Objective", "ADMISSION :: Plan",
             "ADMISSION :: Subjective", "SOAP :: Assessment"]
    gold = {0: 0, 1: 1, 2: 3, 3: 4}

    lx, rx = 20, 300
    top = 250
    for i, it in enumerate(intents):
        y = top - i * 44
        box(d, lx, y, 84, 26, it, BG_ACO, ACO, 6.8)
    for j, p in enumerate(parts):
        y = top + 12 - j * 40
        is_gold = j in gold.values()
        box(d, rx, y, 150, 24, p,
            HexColor("#ECFDF5") if is_gold else BG_GREY,
            HexColor("#15803D") if is_gold else LINE, 6.5, bold=is_gold)

    import random
    rng = random.Random(4)
    for i in range(len(intents)):
        y1 = top - i * 44 + 13
        for j in range(len(parts)):
            y2 = top + 12 - j * 40 + 12
            strong = gold.get(i) == j
            w = 2.6 if strong else 0.35 + rng.random() * 0.35
            col = ACO if strong else LINE
            ln = Line(lx + 84, y1, rx, y2, strokeColor=col, strokeWidth=w)
            if not strong:
                ln.strokeDashArray = [2, 3]
            d.add(ln)

    label(d, 62, top + 34, "QUERY INTENT", 6.6, ACO, "middle", True)
    label(d, 375, top + 46, "SEARCHABLE PARTITIONS  (note type x SOAP section)",
          6.6, SLATE, "middle", True)
    label(d, 192, top + 34, "pheromone tau", 6.4, ACO, "middle", True)

    box(d, 20, 44, 210, 40,
        "tau <- (1 - rho) . tau    [ evaporation ]", BG_ACO, ACO, 6.8)
    box(d, 244, 44, 206, 40,
        "tau <- tau + Q . quality / rank    [ deposit ]",
        HexColor("#F0FDF4"), HexColor("#15803D"), 6.8)
    box(d, 20, 6, 430, 28,
        "P(partition p | intent i)  proportional to  tau(i,p)^alpha  x  eta(i,p)^beta",
        BG_GREY, SLATE, 7.2)

    label(d, 128, 96, "thick amber = trail the colony reinforced", 6.3, ACO, "middle")
    return d


# ==========================================================================
# Fig 6.1 — Training and evaluation methodology
# ==========================================================================
def fig_methodology(width=470, height=250):
    d = Drawing(width, height)
    box(d, 8, 196, 92, 40, "Seeded clinical corpus 38 patients / 822 chunks", white, SLATE, 6.7)
    box(d, 116, 196, 92, 40, "Labelled ground truth generated during seeding", BG_GREY, SLATE, 6.7)
    box(d, 224, 196, 100, 40, "Chunk-level graded relevance by SOAP section", BG_GA, GA, 6.7)
    box(d, 340, 196, 116, 40, "70 / 30 train-test split (held out, never trained on)",
        HexColor("#FEF3C7"), HexColor("#B45309"), 6.7)

    for x1, x2 in ((100, 116), (208, 224), (324, 340)):
        arrow(d, x1, 216, x2, 216)

    box(d, 60, 116, 150, 44, "TRAIN SPLIT evolve the optimizer (GA and PSO raced head to head)",
        BG_GA, GA, 6.8)
    box(d, 254, 116, 150, 44, "TEST SPLIT measure baseline vs evolved - reported numbers",
        HexColor("#DCFCE7"), HexColor("#15803D"), 6.8)
    arrow(d, 398, 196, 330, 160, HexColor("#B45309"))
    arrow(d, 398, 196, 135, 160, HexColor("#B45309"))

    box(d, 60, 46, 150, 40, "Persist artifact to data/bio/*.json", white, SLATE, 6.8)
    box(d, 254, 46, 150, 40, "Report improvement % against the exact replaced baseline",
        white, SLATE, 6.8)
    arrow(d, 135, 116, 135, 86)
    arrow(d, 329, 116, 329, 86)
    arrow(d, 210, 66, 254, 66)

    label(d, 8, 20, "Relevance is graded at CHUNK level, not note level. An earlier note-level "
                    "scheme leaked: the optimizer could score a", 6.4, INK, "start")
    label(d, 8, 10, "perfect nDCG by learning \"rank ADMISSION notes first\" while driving the "
                    "similarity weight to zero.", 6.4, INK, "start")
    return d


# ==========================================================================
# Fig 3.1 — Bio-Lab interactive sandbox loop
# ==========================================================================
def fig_sandbox(width=470, height=190):
    d = Drawing(width, height)
    box(d, 10, 128, 92, 40, "Student moves a parameter slider", BG_GA, GA, 6.9)
    box(d, 122, 128, 92, 40, "Engine re-runs in the browser (JavaScript)", white, SLATE, 6.8)
    box(d, 234, 128, 92, 40, "One generation steps; operators logged", white, SLATE, 6.8)
    box(d, 346, 128, 110, 40, "Charts, population table and canvas redraw", BG_GA, GA, 6.9)

    for x1, x2 in ((102, 122), (214, 234), (326, 346)):
        arrow(d, x1, 148, x2, 148)
    d.add(PolyLine([401, 128, 401, 104, 56, 104, 56, 128], strokeColor=GA,
                   strokeWidth=0.9, strokeDashArray=[3, 2]))
    arrow(d, 56, 110, 56, 128, GA)
    label(d, 228, 96, "immediate visual feedback - no server round trip", 6.4, GA)

    box(d, 10, 30, 214, 46, "\"Break it on purpose\" presets e.g. mutation = 0, elitism = 0, "
                            "alpha = 0", HexColor("#FEF3C7"), HexColor("#B45309"), 6.7)
    box(d, 242, 30, 214, 46, "verify.mjs asserts all 33 claims - a false claim fails the build",
        HexColor("#DCFCE7"), HexColor("#15803D"), 6.7)
    arrow(d, 224, 53, 242, 53)
    return d
