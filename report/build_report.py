"""
Builds the NeuroSwarm Bio-Inspired Algorithms mini-project report as a PDF,
matching the VTU / BMSCE format of the reference report.

    python report/build_report.py
"""
import json
import pathlib
import sys

from reportlab.lib import colors
from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, Image, KeepTogether, NextPageTemplate, PageBreak,
    PageTemplate, Paragraph, Spacer, Table, TableStyle,
)

from reportlab.platypus import Flowable


class Marker(Flowable):
    """Zero-height probe: records which page it was laid out on, so the table of
    contents and the lists of figures and tables can be computed from the real
    layout instead of estimated by hand."""

    width = 0
    height = 0

    def __init__(self, kind, key, sink):
        super().__init__()
        self.kind, self.key, self.sink = kind, key, sink

    def wrap(self, aw, ah):
        return (0, 0)

    def draw(self):
        self.sink.append((self.kind, self.key, self.canv.getPageNumber()))


HERE = pathlib.Path(__file__).parent
ASSETS = HERE / "assets"
sys.path.insert(0, str(HERE))
import flowcharts as F  # noqa: E402

M = json.loads((HERE / "metrics.json").read_text(encoding="utf-8"))

MARKS = []          # populated during a build pass
PAGES = {}          # kind -> ordered list of page numbers, from the previous pass
FRONT_PAGES = [8]   # number of pages before page 1 of Chapter 1; refined per pass


def mark(story, kind, key=None):
    story.append(Marker(kind, key, MARKS))


def _page_of(kind, index, default):
    lst = PAGES.get(kind, [])
    if index < len(lst):
        return str(max(1, lst[index] - FRONT_PAGES[0]))
    return default

TITLE = "NeuroSwarm: Bio-Inspired Optimization for Real-Time Clinical Intelligence"
SHORT_TITLE = "NeuroSwarm: Bio-Inspired Optimization for Real-Time Clinical Intelligence"
SUBJECT = "BIO-INSPIRED ALGORITHMS"

TEAM = [
    ("Manoj Kumar N", "1BM23AD032"),
    ("Siddhant Patil", "1BM23AD059"),
    ("Tanmay G T", "1BM23AD063"),
    ("Vineet R Kamath", "1BM23AD069"),
]
GUIDE = "Prof. Hitha S"
GUIDE_TITLE = "Assistant Professor"
HOD = "Dr. Seemanthini K"
YEAR = "2025-2026"

ACCENT = HexColor("#7B3F00")
INK = HexColor("#0B1220")

# --------------------------------------------------------------------------
# Styles — Times New Roman throughout
# --------------------------------------------------------------------------
ss = getSampleStyleSheet()


def S(name, **kw):
    base = dict(fontName="Times-Roman", fontSize=12, leading=18, textColor=INK,
                alignment=TA_JUSTIFY, spaceAfter=8)
    base.update(kw)
    return ParagraphStyle(name, **base)


body = S("body", firstLineIndent=0)
body_i = S("body_i", firstLineIndent=18)
h1 = S("h1", fontName="Times-Bold", fontSize=17, leading=22, alignment=TA_CENTER,
       spaceBefore=6, spaceAfter=16)
chapno = S("chapno", fontName="Times-Bold", fontSize=15, leading=20, alignment=TA_LEFT,
           spaceBefore=0, spaceAfter=10)
h2 = S("h2", fontName="Times-Bold", fontSize=12.5, leading=17, alignment=TA_LEFT,
       spaceBefore=12, spaceAfter=6)
h3 = S("h3", fontName="Times-Bold", fontSize=12, leading=16, alignment=TA_LEFT,
       spaceBefore=9, spaceAfter=4)
center = S("center", alignment=TA_CENTER)
center_b = S("center_b", alignment=TA_CENTER, fontName="Times-Bold")
cap = S("cap", fontName="Times-Bold", fontSize=10.5, leading=14, alignment=TA_CENTER,
        spaceBefore=6, spaceAfter=12)
small = S("small", fontSize=10, leading=13.5)
cell = S("cell", fontSize=10.5, leading=13.5, alignment=TA_LEFT, spaceAfter=0)
cell_c = S("cell_c", fontSize=10.5, leading=13.5, alignment=TA_CENTER, spaceAfter=0)
cell_b = S("cell_b", fontSize=10.5, leading=13.5, alignment=TA_CENTER,
           fontName="Times-Bold", spaceAfter=0)
code = S("code", fontName="Courier", fontSize=8.0, leading=10.4, alignment=TA_LEFT,
         textColor=HexColor("#1E293B"), spaceAfter=0)
bullet = S("bullet", leftIndent=20, bulletIndent=8, spaceAfter=5, fontSize=11.5, leading=16.5)
toc_style = S("toc", fontSize=12.5, leading=22, alignment=TA_LEFT, spaceAfter=0)


def P(txt, st=None):
    return Paragraph(txt, st or body)


def bullets(items, st=None):
    return [Paragraph(f"•&nbsp;&nbsp;{t}", st or bullet) for t in items]


def numbered(items, st=None):
    return [Paragraph(f"<b>{i + 1}.</b>&nbsp;&nbsp;{t}", st or bullet)
            for i, t in enumerate(items)]


# --------------------------------------------------------------------------
# Page furniture: full-page border, running header and footer
# --------------------------------------------------------------------------
PW, PH = A4


def _border(c, inset=12 * mm, lw=1.4):
    c.saveState()
    c.setStrokeColor(INK)
    c.setLineWidth(lw)
    c.rect(inset, inset, PW - 2 * inset, PH - 2 * inset)
    c.restoreState()


def cover_page(c, doc):
    c.saveState()
    c.setStrokeColor(INK)
    c.setLineWidth(2.0)
    c.rect(12 * mm, 12 * mm, PW - 24 * mm, PH - 24 * mm)
    c.setLineWidth(0.8)
    c.rect(14.5 * mm, 14.5 * mm, PW - 29 * mm, PH - 29 * mm)
    c.restoreState()


def plain_page(c, doc):
    _border(c)


def content_page(c, doc):
    _border(c)
    c.saveState()
    # running header
    c.setFont("Times-Bold", 10.5)
    c.setFillColor(INK)
    c.drawRightString(PW - 20 * mm, PH - 22 * mm, "NeuroSwarm: Bio-Inspired Clinical Intelligence")
    c.setStrokeColor(ACCENT)
    c.setLineWidth(1.6)
    c.line(20 * mm, PH - 24.5 * mm, PW - 20 * mm, PH - 24.5 * mm)
    # running footer
    c.setFont("Times-Bold", 10.5)
    c.drawString(20 * mm, 17 * mm, "Dept. of AI &amp; DS, BMSCE".replace("&amp;", "&"))
    c.drawRightString(PW - 20 * mm, 17 * mm, f"Page {doc.page - doc._front_pages}")
    c.restoreState()


def roman_page(c, doc):
    _border(c)
    c.saveState()
    c.setFont("Times-Roman", 10.5)
    c.setFillColor(INK)
    n = doc.page - 2
    if n >= 1:
        c.drawCentredString(PW / 2, 17 * mm, "ivxlcdm"[0] * 0 + _roman(n))
    c.restoreState()


def _roman(n):
    vals = [(10, "x"), (9, "ix"), (5, "v"), (4, "iv"), (1, "i")]
    out = ""
    for v, s in vals:
        while n >= v:
            out += s
            n -= v
    return out


class Doc(BaseDocTemplate):
    _front_pages = 0

    def afterFlowable(self, flowable):
        pass


def build(_pass=1):
    out = HERE / ("NeuroSwarm_BioInspired_Report.pdf" if _pass == 2 else "_pass1.pdf")
    doc = Doc(str(out), pagesize=A4,
              leftMargin=22 * mm, rightMargin=20 * mm,
              topMargin=30 * mm, bottomMargin=24 * mm,
              title=TITLE, author=", ".join(n for n, _ in TEAM),
              subject=SUBJECT)

    frame = Frame(doc.leftMargin, doc.bottomMargin,
                  doc.width, doc.height, id="f")
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[frame], onPage=cover_page),
        PageTemplate(id="front", frames=[frame], onPage=roman_page),
        PageTemplate(id="content", frames=[frame], onPage=content_page),
    ])

    story = []
    front = []
    _cover(story)
    _certificate(story)
    _declaration(story)
    _acknowledgement(story)
    _abstract(story)
    _contents(story)
    _figures_tables(story)
    _chapters(story)

    doc._front_pages = FRONT_PAGES[0]
    doc.build(story)

    # Collect what the layout actually produced for the next pass.
    pages = {}
    for kind, _key, page in MARKS:
        pages.setdefault(kind, []).append(page)
    return out, pages


# ==========================================================================
# Front matter
# ==========================================================================
def _cover(story):
    story.append(Spacer(1, 6 * mm))
    story.append(P("<b>VISVESVARAYA TECHNOLOGICAL UNIVERSITY</b>",
                   S("cv1", fontName="Times-Bold", fontSize=15.5, leading=20, alignment=TA_CENTER)))
    story.append(P("&ldquo;Jnana Sangama&rdquo;, Belgaum-590018.",
                   S("cv2", fontSize=12.5, leading=16, alignment=TA_CENTER)))
    story.append(Spacer(1, 2 * mm))
    story.append(Image(str(ASSETS / "vtu_logo.png"), width=22 * mm, height=15.7 * mm,
                       hAlign="CENTER"))
    story.append(Spacer(1, 4 * mm))
    story.append(P(f"<b>{SUBJECT} MINI PROJECT REPORT</b>",
                   S("cv3", fontName="Times-Bold", fontSize=13.5, leading=18, alignment=TA_CENTER)))
    story.append(P("ON", S("cv4", fontSize=10.5, leading=14, alignment=TA_CENTER)))
    story.append(P("<b>NeuroSwarm: Bio-Inspired Optimization for<br/>Real-Time Clinical Intelligence</b>",
                   S("cv5", fontName="Times-Bold", fontSize=16.5, leading=22, alignment=TA_CENTER,
                     spaceAfter=10)))
    story.append(P("<i>Submitted in Partial fulfilment for the VI Semester, BE, "
                   "Artificial Intelligence &amp; Data Science</i>",
                   S("cv6", fontSize=10.5, leading=14, alignment=TA_CENTER, spaceAfter=12)))
    story.append(P("<b>Submitted by:</b>", center_b))

    rows = [[Paragraph(f"<b>{n}</b>", cell_c), Paragraph(f"<b>{u}</b>", cell_c)] for n, u in TEAM]
    t = Table(rows, colWidths=[52 * mm, 32 * mm], hAlign="CENTER")
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Times-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
        ("TOPPADDING", (0, 0), (-1, -1), 1.5),
    ]))
    story.append(t)
    story.append(Spacer(1, 5 * mm))
    story.append(P("<b>Under the Guidance of:</b>", center_b))
    story.append(P(f"<b>{GUIDE}</b>", S("g1", fontName="Times-Bold", fontSize=11.5,
                                        leading=15, alignment=TA_CENTER, spaceAfter=0)))
    story.append(P(f"<b>{GUIDE_TITLE}</b>", S("g2", fontName="Times-Bold", fontSize=11.5,
                                              leading=15, alignment=TA_CENTER, spaceAfter=0)))
    story.append(P("<b>Dept. of AI &amp; DS</b>", S("g3", fontName="Times-Bold", fontSize=11.5,
                                                    leading=15, alignment=TA_CENTER, spaceAfter=4)))
    story.append(Image(str(ASSETS / "bmsce_logo.png"), width=17 * mm, height=16.7 * mm,
                       hAlign="CENTER"))
    story.append(Spacer(1, 3 * mm))
    story.append(P(f"<b>{YEAR}</b>", S("yr", fontName="Times-Bold", fontSize=13,
                                       leading=17, alignment=TA_CENTER, spaceAfter=8)))
    story.append(P("<b>DEPARTMENT OF ARTIFICIAL INTELLIGENCE &amp; DATA SCIENCE</b>",
                   S("dep", fontName="Times-Bold", fontSize=12, leading=16, alignment=TA_CENTER,
                     spaceAfter=10)))
    story.append(P("<b>BMS College of Engineering</b>",
                   S("col", fontName="Times-Bold", fontSize=15, leading=19, alignment=TA_CENTER,
                     spaceAfter=2)))
    story.append(P("<b>Bull Temple Road, Basavanagudi, Bengaluru-560019</b>",
                   S("col2", fontName="Times-Bold", fontSize=11, leading=14, alignment=TA_CENTER,
                     spaceAfter=1)))
    story.append(P("(Autonomous Institute under Visvesvaraya Technological University, Belagavi "
                   "and Approved by AICTE, New Delhi, NAAC Accredited with &lsquo;A++&rsquo; Grade)",
                   S("col3", fontSize=7.6, leading=10, alignment=TA_CENTER)))
    story.append(NextPageTemplate("front"))
    story.append(PageBreak())


def _certificate(story):
    story.append(P("<b>BMS College of Engineering</b>",
                   S("c1", fontName="Times-Bold", fontSize=16, leading=20, alignment=TA_CENTER,
                     spaceAfter=2)))
    story.append(P("<b>Bull Temple Road, Basavanagudi, Bengaluru-560019</b>",
                   S("c2", fontName="Times-Bold", fontSize=11, leading=14, alignment=TA_CENTER,
                     spaceAfter=1)))
    story.append(P("(Autonomous Institute under Visvesvaraya Technological University, Belagavi "
                   "and Approved by AICTE, New Delhi, NAAC Accredited with &lsquo;A++&rsquo; Grade)",
                   S("c3", fontSize=7.6, leading=10, alignment=TA_CENTER, spaceAfter=8)))
    story.append(P("Department of Artificial Intelligence &amp; Data Science",
                   S("c4", fontSize=16, leading=20, alignment=TA_CENTER, spaceAfter=8)))
    story.append(Image(str(ASSETS / "bmsce_logo.png"), width=19 * mm, height=18.7 * mm,
                       hAlign="CENTER"))
    story.append(Spacer(1, 6 * mm))
    story.append(P("<b><u>CERTIFICATE</u></b>",
                   S("c5", fontName="Times-Bold", fontSize=17, leading=22, alignment=TA_CENTER,
                     spaceAfter=14)))

    names = ", ".join(n for n, _ in TEAM[:-1]) + " and " + TEAM[-1][0]
    story.append(P(
        f"Certified that the mini project entitled <b>&ldquo;NeuroSwarm: Bio-Inspired Optimization "
        f"for Real-Time Clinical Intelligence&rdquo;</b> carried out by {names}, bonafide students "
        f"of BMS College of Engineering in partial fulfillment for award of Bachelor of Engineering "
        f"in Artificial Intelligence and Data Science during the year {YEAR}. It is certified that "
        f"all corrections/suggestions indicated for internal assessment during the project review "
        f"have been incorporated in the report and has been deposited in the department library.",
        S("cert", fontSize=12, leading=20)))
    story.append(Spacer(1, 24 * mm))

    sig = [[Paragraph("Signature of the Guide", cell_c), Paragraph("Signature of the HOD", cell_c)],
           [Paragraph(f"<b>{GUIDE}</b>", cell_c), Paragraph(f"<b>{HOD}</b>", cell_c)],
           [Paragraph(f"{GUIDE_TITLE}, Dept. of AI &amp; DS", cell_c),
            Paragraph("Professor &amp; Head, Dept. of AI &amp; DS", cell_c)],
           [Paragraph("BMSCE, Bengaluru.", cell_c), Paragraph("BMSCE, Bengaluru.", cell_c)]]
    t = Table(sig, colWidths=[doc_w() / 2, doc_w() / 2])
    t.setStyle(TableStyle([("TOPPADDING", (0, 0), (-1, -1), 1),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 1)]))
    story.append(t)
    story.append(PageBreak())


def doc_w():
    return A4[0] - 42 * mm


def _declaration(story):
    story.append(P("<b>DECLARATION</b>", h1))
    story.append(P(
        "We the undersigned students of 6<super>th</super> semester, Department of Artificial "
        "Intelligence &amp; Data Science, BMS College of Engineering, declare that the mini project "
        "entitled <b>&ldquo;NeuroSwarm: Bio-Inspired Optimization for Real-Time Clinical "
        "Intelligence&rdquo;</b>, is a bonafide work of us and our project is neither a copy nor by "
        "any means a modification of any other engineering project.",
        S("d1", fontSize=12, leading=20, firstLineIndent=18)))
    story.append(P(
        "We also declare that this mini project was not entitled for submission to any other "
        "university in the past and shall remain the only submission made and will not be submitted "
        "by us to any other university in the future.",
        S("d2", fontSize=12, leading=20, firstLineIndent=18)))
    story.append(Spacer(1, 10 * mm))

    rows = [[Paragraph("<b>Name</b>", cell_c), Paragraph("<b>USN</b>", cell_c),
             Paragraph("<b>Signature</b>", cell_c)]]
    for n, u in TEAM:
        rows.append([Paragraph(f"<b>{n}</b>", cell), Paragraph(f"<b>{u}</b>", cell_c),
                     Paragraph("&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;", cell_c)])
    t = Table(rows, colWidths=[62 * mm, 42 * mm, 52 * mm], hAlign="CENTER")
    t.setStyle(TableStyle([("TOPPADDING", (0, 0), (-1, -1), 6),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    story.append(t)
    story.append(PageBreak())


def _acknowledgement(story):
    story.append(P("<b>ACKNOWLEDGEMENT</b>", h1))
    paras = [
        "The satisfaction and euphoria that accompany the successful completion of any task would be "
        "incomplete without the mention of the people who made it possible, whose constant guidance "
        "and encouragement crowned our effort with success.",
        "We are grateful to our institution, <b>BMS College of Engineering</b>, with its ideals and "
        "inspirations for having provided us with the facilities, which has made this project a success.",
        "We earnestly thank <b>Dr. Bheemsha, Principal, BMS College of Engineering,</b> for "
        "facilitating academic excellence in the college and providing us with the congenial "
        "environment to work in, that helped us in completing this project.",
        f"We wish to extend our profound thanks to <b>{HOD}, Prof. and Head, Department of "
        "Artificial Intelligence &amp; Data Science, BMSCE,</b> for giving us the consent to carry "
        "out this project.",
        f"We would like to express our sincere thanks to our guide <b>{GUIDE}</b>, "
        f"{GUIDE_TITLE}, Department of Artificial Intelligence &amp; Data Science, BMSCE, for able "
        "guidance and valuable advice at every stage, which helped us in the successful completion "
        "of the project.",
        "We would like to thank all the teaching and non-teaching staff for their valuable advice "
        "and support.",
        "We would like to express our sincere thanks to our parents and friends for their support.",
    ]
    for p in paras:
        story.append(P(p, S("ak", fontSize=12, leading=20, firstLineIndent=18)))
    story.append(Spacer(1, 8 * mm))
    for n, _ in TEAM:
        story.append(P(f"<b>{n}</b>", S("sg", fontName="Times-Bold", fontSize=11.5, leading=16,
                                        alignment=2, spaceAfter=0)))
    story.append(PageBreak())


def _abstract(story):
    story.append(P("<b>ABSTRACT</b>", h1))
    r, t, i, c, o = M["ranking"], M["tasks"], M["immune"], M["compression"], M["routing"]
    paras = [
        "NeuroSwarm is a role-secured hospital care-coordination and electronic health record "
        "platform in which five decision points are tuned by <b>bio-inspired metaheuristics</b> "
        "rather than by hand-written rules. The system deliberately contains <b>no Large Language "
        "Model</b>: clinical answers are assembled verbatim from the clinician's own documented "
        "notes, which makes zero-hallucination a structural property rather than a prompt "
        "instruction, and makes retrieval quality the entire user-facing product.",

        "Three algorithm families are applied. <b>Evolutionary computation</b> contributes a "
        "real-valued Genetic Algorithm that evolves a fourteen-gene retrieval ranking policy, a "
        "second Genetic Algorithm that learns a care-task triage policy from expert pairwise "
        "judgements, and a Binary Genetic Algorithm that selects which embedding dimensions survive "
        "into the vector index. <b>Swarm intelligence</b> contributes Particle Swarm Optimization, "
        "raced head-to-head against the Genetic Algorithm on the ranking problem, and Ant Colony "
        "Optimization, which learns which partitions of the record answer which class of clinical "
        "question. <b>Immune-inspired computation</b> contributes a real-valued Negative Selection "
        "Algorithm that detects documentation errors in vital signs after training on normal data alone.",

        f"Every optimizer is trained against labelled ground truth generated during corpus seeding "
        f"and evaluated on a held-out test split it never trained on. Retrieval quality rose from "
        f"nDCG@5 {r['baseline']['ndcg_at_5']} to {r['optimized']['ndcg_at_5']} "
        f"({r['improvement_pct']['ndcg_at_5']:+}%); agreement with expert triage orderings rose "
        f"from {t['baseline']['pairwise_agreement']} to {t['optimized']['pairwise_agreement']} "
        f"({t['improvement_pct']['pairwise_agreement']:+}%); the immune system detected "
        f"{i['metrics']['detection_rate'] * 100:.1f}% of planted documentation errors at a "
        f"{i['metrics']['false_alarm_rate'] * 100:.0f}% false-alarm rate; dimension selection "
        f"reduced each vector from {c['baseline']['dims_total']} to {c['optimized']['dims_kept']} "
        f"dimensions; and colony routing reduced the number of chunks scanned per query by "
        f"{o['optimized']['scan_reduction_pct']}%.",

        "The project also delivers an interactive <b>Bio-Lab</b> in which all five algorithms run "
        "live in the browser. Parameters such as mutation rate, inertia weight, self-radius and "
        "pheromone evaporation can be changed while an algorithm is running, and the effect is "
        "visible immediately. A verification script asserts all thirty-three pedagogical claims the "
        "interface makes, so a statement that ceases to be true of the implementation fails the build.",

        "The work demonstrates that population-based metaheuristics are the appropriate tool for a "
        "class of real engineering problems that gradient methods cannot address: objectives that "
        "are rank-based and therefore flat almost everywhere, search spaces that are combinatorial, "
        "and policies that must be recovered from human preferences rather than from labelled outputs.",
    ]
    for p in paras:
        story.append(P(p, S("ab", fontSize=11.5, leading=18.5)))
    story.append(PageBreak())


CONTENTS = [
    ("DECLARATION", "i"), ("ACKNOWLEDGEMENT", "ii"), ("ABSTRACT", "iii"),
    ("LIST OF FIGURES", "v"), ("LIST OF TABLES", "vi"),
]
CHAPTERS_TOC = [
    ("1", "INTRODUCTION", "1"),
    ("2", "BIO-INSPIRED ALGORITHMS: THEORY AND MOTIVATION", "5"),
    ("3", "SYSTEM REQUIREMENTS AND FEASIBILITY", "12"),
    ("4", "ANALYSIS AND DESIGN", "16"),
    ("5", "ALGORITHM DESIGN AND IMPLEMENTATION", "21"),
    ("6", "TESTING, RESULTS AND ANALYSIS", "33"),
    ("7", "CONCLUSION AND FUTURE ENHANCEMENTS", "40"),
]
FIGURES = [
    ("Figure 4.1", "Layered system architecture of NeuroSwarm", "16"),
    ("Figure 4.2", "Clinical query pipeline with the five optimizers in place", "18"),
    ("Figure 4.3", "Interactive Bio-Lab sandbox feedback loop", "20"),
    ("Figure 5.1", "Flowchart of the real-valued Genetic Algorithm", "22"),
    ("Figure 5.2", "Flowchart of Particle Swarm Optimization", "25"),
    ("Figure 5.3", "Flowchart of the Negative Selection Algorithm", "27"),
    ("Figure 5.4", "Binary Genetic Algorithm for embedding dimension selection", "29"),
    ("Figure 5.5", "Ant Colony Optimization over intent-partition edges", "31"),
    ("Figure 6.1", "Training and held-out evaluation methodology", "33"),
]
TABLES = [
    ("Table 2.1", "The five algorithms, their families and biological inspiration", "5"),
    ("Table 2.2", "Why a metaheuristic is required at each decision point", "11"),
    ("Table 3.1", "Software and library requirements", "13"),
    ("Table 3.2", "Hardware requirements", "14"),
    ("Table 5.1", "Genome layout of the ranking chromosome", "21"),
    ("Table 5.2", "Genetic Algorithm control parameters", "23"),
    ("Table 5.3", "Particle Swarm Optimization control parameters", "25"),
    ("Table 5.4", "Feature set of the care-task triage policy", "26"),
    ("Table 6.1", "Consolidated results for all five optimizers", "34"),
    ("Table 6.2", "Confusion matrix of the Artificial Immune System", "36"),
    ("Table 6.3", "Genetic Algorithm versus Particle Swarm on the ranking task", "37"),
    ("Table 7.1", "Future enhancements", "41"),
]


def _dots_table(rows, widths):
    t = Table(rows, colWidths=widths, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Times-Roman"),
        ("FONTSIZE", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
        ("ALIGN", (-1, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return t


def _contents(story):
    story.append(P("<b>CONTENTS</b>", h1))
    rows = [[Paragraph(n, toc_style), Paragraph(p, toc_style)] for n, p in CONTENTS]
    story.append(_dots_table(rows, [doc_w() - 25 * mm, 25 * mm]))
    story.append(Spacer(1, 4 * mm))
    hdr = [[Paragraph("<b>Chapters</b>", toc_style), Paragraph("<b>Page No.</b>", toc_style)]]
    rows = hdr + [[Paragraph(f"<b>{n}&nbsp;&nbsp;&nbsp;{t}</b>", toc_style),
                   Paragraph(f"<b>{_page_of('chapter', k, p)}</b>", toc_style)]
                  for k, (n, t, p) in enumerate(CHAPTERS_TOC)]
    rows.append([Paragraph("<b>REFERENCES</b>", toc_style),
                 Paragraph(f"<b>{_page_of('refs', 0, '43')}</b>", toc_style)])
    story.append(_dots_table(rows, [doc_w() - 25 * mm, 25 * mm]))
    story.append(PageBreak())


def _figures_tables(story):
    story.append(P("<b>LIST OF FIGURES</b>", h1))
    rows = [[Paragraph("<b>Figures</b>", toc_style), Paragraph("<b>Page No.</b>", toc_style)]]
    rows += [[Paragraph(f"{a}: {b}", S("f", fontSize=11.5, leading=18)),
              Paragraph(_page_of("figure", k, p), S("fp", fontSize=11.5, leading=18))]
             for k, (a, b, p) in enumerate(FIGURES)]
    story.append(_dots_table(rows, [doc_w() - 25 * mm, 25 * mm]))
    story.append(PageBreak())

    story.append(P("<b>LIST OF TABLES</b>", h1))
    rows = [[Paragraph("<b>Tables</b>", toc_style), Paragraph("<b>Page No.</b>", toc_style)]]
    rows += [[Paragraph(f"{a}: {b}", S("t", fontSize=11.5, leading=18)),
              Paragraph(_page_of("table", k, p), S("tp", fontSize=11.5, leading=18))]
             for k, (a, b, p) in enumerate(TABLES)]
    story.append(_dots_table(rows, [doc_w() - 25 * mm, 25 * mm]))
    story.append(NextPageTemplate("content"))
    story.append(PageBreak())


# --------------------------------------------------------------------------
# Table helper
# --------------------------------------------------------------------------
def data_table(header, rows, widths, caption=None, align_center=None, font=10.5):
    align_center = align_center or []
    data = [[Paragraph(f"<b>{h}</b>", cell_b) for h in header]]
    for r in rows:
        data.append([
            Paragraph(str(v), (cell_c if j in align_center else cell))
            for j, v in enumerate(r)
        ])
    t = Table(data, colWidths=widths, repeatRows=1, hAlign="CENTER")
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.8, INK),
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#E8EDF5")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    out = [t]
    if caption:
        out.append(Marker("table", caption[:24], MARKS))
        out.append(Paragraph(caption, cap))
    return out


def figure(drawing, caption):
    return KeepTogether([Spacer(1, 3 * mm), drawing,
                         Marker("figure", caption[:24], MARKS), Paragraph(caption, cap)])


def code_block(lines):
    txt = "<br/>".join(l.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                       .replace(" ", "&nbsp;") for l in lines)
    t = Table([[Paragraph(txt, code)]], colWidths=[doc_w()])
    t.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.7, HexColor("#94A3B8")),
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F8FAFC")),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
    ]))
    return KeepTogether([Spacer(1, 2 * mm), t, Spacer(1, 3 * mm)])


def chapter(story, num, title):
    story.append(P(f"CHAPTER {num}", chapno))
    story.append(P(f"<b>{title}</b>", h1))


# Chapters live in a separate module to keep this file readable.
from chapters import build_chapters  # noqa: E402


def _chapters(story):
    build_chapters(story, M, F, dict(
        P=P, S=S, chapter=chapter, h2=h2, h3=h3, body=body, bullets=bullets,
        numbered=numbered, data_table=data_table, figure=figure, code_block=code_block,
        doc_w=doc_w, cap=cap, small=small, PageBreak=PageBreak, Spacer=Spacer,
        KeepTogether=KeepTogether, mark=mark,
    ))


if __name__ == "__main__":
    # Pass 1 discovers the true page of every chapter, figure and table; pass 2
    # rebuilds with a table of contents that matches the document.
    MARKS.clear()
    tmp, pages = build(_pass=1)
    chapters = pages.get("chapter", [])
    FRONT_PAGES[0] = (chapters[0] - 1) if chapters else 8
    PAGES.clear()
    PAGES.update(pages)

    MARKS.clear()
    path, pages2 = build(_pass=2)
    try:
        tmp.unlink()
    except OSError:
        pass
    print(f"front matter pages : {FRONT_PAGES[0]}")
    print(f"chapter start pages: {[p - FRONT_PAGES[0] for p in pages2.get('chapter', [])]}")
    print(f"figures            : {len(pages2.get('figure', []))}"
          f"   tables: {len(pages2.get('table', []))}")
    print(f"PDF written: {path}  ({path.stat().st_size / 1024:.0f} KB)")
