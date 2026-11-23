/**
 * A miniature version of the real ranking problem, small enough to watch.
 *
 * These are hand-built candidate pools for three clinical questions. Each
 * candidate carries the same five signals the production reranker uses, and a
 * graded relevance label. Fitness is nDCG@3 averaged over the three queries,
 * the same metric the Python GA optimizes, just at a scale where you can see
 * every row on screen.
 *
 * The pools are constructed so that *similarity alone cannot win*: the highest
 * cosine score is a distractor in every query. That is exactly the failure the
 * production optimizer was built to fix, reproduced in miniature.
 */
import { ndcgAtK } from './engines.js';

export const SIGNALS = [
  { key: 'similarity', label: 'Embedding similarity', hint: 'Cosine from Sentence-BERT, the only signal the baseline had' },
  { key: 'recency', label: 'Recency', hint: 'How recent the note is' },
  { key: 'lexical', label: 'Exact word match', hint: 'Exact drug names / organisms the embedding blurs' },
  { key: 'section', label: 'SOAP section match', hint: 'Does this section answer this kind of question?' },
  { key: 'length', label: 'Chunk length fit', hint: 'Informative length; penalises stubs and rambles' },
];

export const TOY_QUERIES = [
  {
    question: 'What diuretic and dose was prescribed?',
    intent: 'medication',
    candidates: [
      { id: 'a1', label: 'Narrative, admission summary', section: 'Narrative', note: 'Admission',
        similarity: 0.93, recency: 0.20, lexical: 0.25, section_: 0.15, length: 0.55, rel: 0.0,
        text: 'Patient admitted overnight with breathlessness and leg swelling.' },
      { id: 'a2', label: 'Plan & Orders, today', section: 'Plan & Orders', note: 'Progress',
        similarity: 0.74, recency: 0.95, lexical: 0.90, section_: 1.00, length: 0.80, rel: 1.0,
        text: 'IV Furosemide 80mg BID. Fluid restriction 1.5L/day.' },
      { id: 'a3', label: 'Plan & Orders, 5 days ago', section: 'Plan & Orders', note: 'Admission',
        similarity: 0.71, recency: 0.30, lexical: 0.85, section_: 1.00, length: 0.78, rel: 0.6,
        text: 'Start Furosemide 40mg daily, review response in 48 hours.' },
      { id: 'a4', label: 'Assessment, diagnosis', section: 'Assessment', note: 'Progress',
        similarity: 0.80, recency: 0.90, lexical: 0.20, section_: 0.45, length: 0.62, rel: 0.0,
        text: 'Decompensated heart failure, volume overloaded.' },
      { id: 'a5', label: 'Subjective, symptoms', section: 'Subjective', note: 'Progress',
        similarity: 0.66, recency: 0.88, lexical: 0.05, section_: 0.15, length: 0.40, rel: 0.0,
        text: 'Reports sleeping on three pillows, worse at night.' },
      { id: 'a6', label: 'Objective, labs', section: 'Objective', note: 'Progress',
        similarity: 0.69, recency: 0.92, lexical: 0.15, section_: 0.30, length: 0.85, rel: 0.0,
        text: 'NT-proBNP 4200 pg/mL, creatinine 1.4 mg/dL.' },
    ],
  },
  {
    question: 'What organism grew in the sputum culture?',
    intent: 'lab',
    candidates: [
      { id: 'b1', label: 'Assessment, pneumonia', section: 'Assessment', note: 'Progress',
        similarity: 0.91, recency: 0.85, lexical: 0.30, section_: 0.50, length: 0.58, rel: 0.0,
        text: 'Community-acquired pneumonia, CURB-65 score 2.' },
      { id: 'b2', label: 'Objective, microbiology', section: 'Objective', note: 'Progress',
        similarity: 0.78, recency: 0.94, lexical: 0.95, section_: 1.00, length: 0.82, rel: 1.0,
        text: 'Sputum culture: Streptococcus pneumoniae, pan-sensitive.' },
      { id: 'b3', label: 'Objective, earlier labs', section: 'Objective', note: 'Admission',
        similarity: 0.72, recency: 0.25, lexical: 0.60, section_: 1.00, length: 0.75, rel: 0.6,
        text: 'Sputum sent for culture. WBC 18.2, CRP 210.' },
      { id: 'b4', label: 'Plan, antibiotics', section: 'Plan & Orders', note: 'Progress',
        similarity: 0.83, recency: 0.90, lexical: 0.35, section_: 0.30, length: 0.70, rel: 0.0,
        text: 'IV Ceftriaxone 2g daily plus oral Azithromycin.' },
      { id: 'b5', label: 'Narrative, handover', section: 'Narrative', note: 'Progress',
        similarity: 0.86, recency: 0.60, lexical: 0.20, section_: 0.15, length: 0.45, rel: 0.0,
        text: 'Improving on antibiotics, oxygen weaned overnight.' },
      { id: 'b6', label: 'Chief complaint', section: 'Chief Complaint', note: 'Admission',
        similarity: 0.70, recency: 0.22, lexical: 0.10, section_: 0.15, length: 0.30, rel: 0.0,
        text: 'Productive cough and fever for four days.' },
    ],
  },
  {
    question: 'What symptoms did the patient describe on admission?',
    intent: 'symptom',
    candidates: [
      { id: 'c1', label: 'Objective, vitals', section: 'Objective', note: 'Admission',
        similarity: 0.88, recency: 0.28, lexical: 0.25, section_: 0.25, length: 0.80, rel: 0.0,
        text: 'BP 118/72, HR 96, SpO2 91% on room air.' },
      { id: 'c2', label: 'Subjective, history', section: 'Subjective', note: 'Admission',
        similarity: 0.76, recency: 0.26, lexical: 0.85, section_: 1.00, length: 0.76, rel: 1.0,
        text: 'Describes breathlessness on exertion, orthopnea and ankle swelling for five days.' },
      { id: 'c3', label: 'Chief complaint', section: 'Chief Complaint', note: 'Admission',
        similarity: 0.73, recency: 0.26, lexical: 0.70, section_: 0.90, length: 0.35, rel: 0.6,
        text: 'Progressive dyspnea and leg swelling.' },
      { id: 'c4', label: 'Plan, orders', section: 'Plan & Orders', note: 'Progress',
        similarity: 0.79, recency: 0.93, lexical: 0.10, section_: 0.15, length: 0.72, rel: 0.0,
        text: 'Daily weights, strict intake/output charting.' },
      { id: 'c5', label: 'Assessment', section: 'Assessment', note: 'Progress',
        similarity: 0.81, recency: 0.90, lexical: 0.20, section_: 0.40, length: 0.60, rel: 0.0,
        text: 'Heart failure with reduced ejection fraction.' },
      { id: 'c6', label: 'Narrative, social', section: 'Narrative', note: 'Admission',
        similarity: 0.68, recency: 0.24, lexical: 0.15, section_: 0.15, length: 0.50, rel: 0.0,
        text: 'Lives alone, independent with activities of daily living.' },
    ],
  },

  {
    question: 'What was the ejection fraction at baseline?',
    intent: 'history',
    teaches: 'Rewards an OLD note - punishes a naive high recency weight.',
    candidates: [
      { id: 'd1', label: 'Objective - baseline echo', section: 'Objective', note: 'Admission',
        similarity: 0.75, recency: 0.12, lexical: 0.92, section_: 1.00, length: 0.72, rel: 1.0,
        text: 'Baseline echocardiogram: ejection fraction 32%, moderate MR.' },
      { id: 'd2', label: 'Objective - today', section: 'Objective', note: 'Progress',
        similarity: 0.84, recency: 0.97, lexical: 0.30, section_: 1.00, length: 0.66, rel: 0.0,
        text: 'Repeat troponin negative, potassium 4.1.' },
      { id: 'd3', label: 'Assessment - today', section: 'Assessment', note: 'Progress',
        similarity: 0.88, recency: 0.95, lexical: 0.25, section_: 0.42, length: 0.58, rel: 0.0,
        text: 'Clinically improving, euvolemic on examination.' },
      { id: 'd4', label: 'Chief complaint', section: 'Chief Complaint', note: 'Admission',
        similarity: 0.70, recency: 0.14, lexical: 0.35, section_: 0.55, length: 0.30, rel: 0.6,
        text: 'Known cardiomyopathy with reduced ejection fraction.' },
      { id: 'd5', label: 'Plan - today', section: 'Plan & Orders', note: 'Progress',
        similarity: 0.79, recency: 0.96, lexical: 0.18, section_: 0.32, length: 0.70, rel: 0.0,
        text: 'Continue current regimen, repeat echo in six weeks.' },
      { id: 'd6', label: 'Narrative - handover', section: 'Narrative', note: 'Progress',
        similarity: 0.86, recency: 0.90, lexical: 0.20, section_: 0.15, length: 0.48, rel: 0.0,
        text: 'Stable overnight, no acute events.' },
    ],
  },
  {
    question: 'Is the patient allergic to penicillin?',
    intent: 'history',
    teaches: 'A very SHORT chunk is correct - punishes an over-tuned length preference.',
    candidates: [
      { id: 'e1', label: 'Subjective - allergy line', section: 'Subjective', note: 'Admission',
        similarity: 0.80, recency: 0.22, lexical: 0.95, section_: 1.00, length: 0.18, rel: 1.0,
        text: 'Allergies: penicillin - rash.' },
      { id: 'e2', label: 'Plan - antibiotics', section: 'Plan & Orders', note: 'Progress',
        similarity: 0.87, recency: 0.93, lexical: 0.55, section_: 0.35, length: 0.88, rel: 0.0,
        text: 'Ceftriaxone chosen over amoxicillin given documented sensitivity history.' },
      { id: 'e3', label: 'Narrative - long summary', section: 'Narrative', note: 'Admission',
        similarity: 0.83, recency: 0.24, lexical: 0.40, section_: 0.15, length: 0.95, rel: 0.0,
        text: 'Lengthy background covering prior admissions, social history and medication review.' },
      { id: 'e4', label: 'Assessment', section: 'Assessment', note: 'Progress',
        similarity: 0.76, recency: 0.92, lexical: 0.20, section_: 0.40, length: 0.60, rel: 0.0,
        text: 'Community-acquired pneumonia responding to therapy.' },
      { id: 'e5', label: 'Chief complaint', section: 'Chief Complaint', note: 'Admission',
        similarity: 0.72, recency: 0.23, lexical: 0.30, section_: 0.62, length: 0.26, rel: 0.6,
        text: 'Presented with fever; known drug sensitivity.' },
      { id: 'e6', label: 'Objective - labs', section: 'Objective', note: 'Progress',
        similarity: 0.78, recency: 0.94, lexical: 0.15, section_: 0.30, length: 0.82, rel: 0.0,
        text: 'WBC 12.4, CRP 88, renal function stable.' },
    ],
  },
  {
    question: 'What is the plan for discharge?',
    intent: 'plan',
    teaches: 'A lexical distractor repeats the query words without answering it.',
    candidates: [
      { id: 'f1', label: 'Plan - discharge planning', section: 'Plan & Orders', note: 'Progress',
        similarity: 0.77, recency: 0.96, lexical: 0.80, section_: 1.00, length: 0.74, rel: 1.0,
        text: 'Discharge home tomorrow with district nurse follow-up and a seven-day medication supply.' },
      { id: 'f2', label: 'Subjective - patient asked', section: 'Subjective', note: 'Progress',
        similarity: 0.89, recency: 0.94, lexical: 0.90, section_: 0.15, length: 0.44, rel: 0.0,
        text: 'Patient repeatedly asks about the plan for discharge and when they can go home.' },
      { id: 'f3', label: 'Plan - earlier', section: 'Plan & Orders', note: 'Admission',
        similarity: 0.70, recency: 0.20, lexical: 0.60, section_: 1.00, length: 0.68, rel: 0.6,
        text: 'Anticipate discharge once oxygen requirement resolves.' },
      { id: 'f4', label: 'Assessment', section: 'Assessment', note: 'Progress',
        similarity: 0.82, recency: 0.93, lexical: 0.25, section_: 0.48, length: 0.56, rel: 0.0,
        text: 'Resolving heart failure exacerbation.' },
      { id: 'f5', label: 'Narrative', section: 'Narrative', note: 'Progress',
        similarity: 0.85, recency: 0.88, lexical: 0.35, section_: 0.15, length: 0.52, rel: 0.0,
        text: 'Family updated at the bedside this afternoon.' },
      { id: 'f6', label: 'Objective - vitals', section: 'Objective', note: 'Progress',
        similarity: 0.74, recency: 0.97, lexical: 0.10, section_: 0.28, length: 0.80, rel: 0.0,
        text: 'Saturations 96% on room air, afebrile.' },
    ],
  },
];

/** Weighted blend, exactly mirroring RankingWeights.score_only() in Python. */
export function scoreCandidate(genome, c) {
  const [wSim, wRec, wLex, wSec, wLen] = genome;
  const total = wSim + wRec + wLex + wSec + wLen || 1;
  return (
    wSim * c.similarity + wRec * c.recency + wLex * c.lexical
    + wSec * c.section_ + wLen * c.length
  ) / total;
}

export function rankQuery(genome, query) {
  return [...query.candidates]
    .map((c) => ({ ...c, score: scoreCandidate(genome, c) }))
    .sort((a, b) => b.score - a.score);
}

/** Mean nDCG@3 across all six queries, the sandbox fitness function.
 *  The queries deliberately pull against each other: one rewards an old
 *  note, one rewards a very short chunk, one contains a lexical distractor.
 *  No single weight vector wins by luck, so the population has to search. */
export function toyFitness(genome) {
  let total = 0;
  TOY_QUERIES.forEach((q) => {
    const ranked = rankQuery(genome, q);
    total += ndcgAtK(ranked.map((c) => c.rel), 3);
  });
  return total / TOY_QUERIES.length;
}

/** The pre-optimization system: similarity only. */
export const BASELINE_GENOME = [1, 0, 0, 0, 0];

/* ---------------------------------------------------------- PSO landscape --
   A 2-D fitness surface with one broad local optimum and one narrower global
   optimum. Watching a swarm get trapped in the local peak when the social pull
   is too strong is the clearest possible demonstration of what the inertia and
   cognitive terms are actually for.                                          */
export function psoLandscape(x, y) {
  const g = (cx, cy, s, h) => h * Math.exp(-(((x - cx) ** 2 + (y - cy) ** 2) / (2 * s * s)));
  return g(0.30, 0.68, 0.16, 0.62)     // broad decoy peak - easy to find, lower
       + g(0.76, 0.26, 0.115, 1.0)      // narrower true optimum - the real target
       + g(0.55, 0.55, 0.30, 0.20);     // gentle ridge connecting them
}

export const PSO_OPTIMUM = { x: 0.76, y: 0.26 };
export const PSO_DECOY = { x: 0.30, y: 0.68 };

/* --------------------------------------------------- AIS synthetic vitals --
   Normal readings on two axes (heart rate x systolic BP), normalized to the
   unit square using the same bounds as the production model.                 */
export const AIS_BOUNDS = {
  heart_rate: [20, 220],
  bp_systolic: [50, 260],
};

export function normalizeVital(hr, sys) {
  return [
    (hr - AIS_BOUNDS.heart_rate[0]) / (AIS_BOUNDS.heart_rate[1] - AIS_BOUNDS.heart_rate[0]),
    (sys - AIS_BOUNDS.bp_systolic[0]) / (AIS_BOUNDS.bp_systolic[1] - AIS_BOUNDS.bp_systolic[0]),
  ];
}

export function denormalizeVital([x, y]) {
  return {
    heart_rate: Math.round(x * (AIS_BOUNDS.heart_rate[1] - AIS_BOUNDS.heart_rate[0]) + AIS_BOUNDS.heart_rate[0]),
    bp_systolic: Math.round(y * (AIS_BOUNDS.bp_systolic[1] - AIS_BOUNDS.bp_systolic[0]) + AIS_BOUNDS.bp_systolic[0]),
  };
}

export function makeSelfSamples(rand, n = 60) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    // Two normal clusters: resting adults, and a mildly tachycardic/hypertensive
    // ward population. Real "self" is rarely a single blob.
    const cluster = rand() < 0.62;
    const hr = cluster ? 62 + rand() * 26 : 88 + rand() * 26;
    const sys = cluster ? 108 + rand() * 26 : 132 + rand() * 30;
    out.push(normalizeVital(hr, sys));
  }
  return out;
}

export const AIS_PRESETS = [
  { name: 'Normal adult', hr: 76, sys: 122, note: 'Should sit inside the self region.' },
  { name: 'Digit transposition (120→210)', hr: 78, sys: 210, note: 'Plausible number, wrong patient context.' },
  { name: 'Dropped digit (98→8)', hr: 8, sys: 118, note: 'Individually impossible heart rate.' },
  { name: 'Bradycardic + hypotensive', hr: 38, sys: 72, note: 'Far from anything the model saw as normal.' },
  { name: 'Tachycardic + hypertensive', hr: 150, sys: 205, note: 'Real but rare, a genuine edge case.' },
];

/* ------------------------------------------------------- ACO toy topology --
   Four query intents routing over eight partitions. Gold partitions mirror the
   real clinical structure: medication questions live in Plan & Orders, lab
   questions in Objective, and so on.                                         */
export const ACO_INTENTS = ['medication', 'lab', 'symptom', 'diagnosis'];

export const ACO_PARTITIONS = [
  'Progress :: Plan',
  'Progress :: Objective',
  'Progress :: Assessment',
  'Progress :: Subjective',
  'Admission :: Plan',
  'Admission :: Objective',
  'Admission :: Subjective',
  'Admission :: Narrative',
];

export const ACO_SIZES = {
  'Progress :: Plan': 42, 'Progress :: Objective': 55, 'Progress :: Assessment': 38,
  'Progress :: Subjective': 30, 'Admission :: Plan': 26, 'Admission :: Objective': 34,
  'Admission :: Subjective': 22, 'Admission :: Narrative': 48,
};

const ACO_GOLD = {
  medication: ['Progress :: Plan', 'Admission :: Plan'],
  lab: ['Progress :: Objective', 'Admission :: Objective'],
  symptom: ['Progress :: Subjective', 'Admission :: Subjective'],
  diagnosis: ['Progress :: Assessment'],
};

export const acoGoldFor = (intent) => ACO_GOLD[intent] || [];

/* ------------------------------------ Binary GA toy dimension-selection --- */
export const BIN_DIMS = 64;

/**
 * Each "dimension" has a hidden usefulness. Fitness rewards keeping useful
 * dimensions and applies a parsimony penalty for keeping too many, the same
 * two-term objective as the production compression GA.
 */
export function makeDimensionValues(rand) {
  return Array.from({ length: BIN_DIMS }, () => {
    const useful = rand() < 0.34;
    return useful ? 0.55 + rand() * 0.45 : rand() * 0.22;
  });
}

export function makeBinFitness(values, parsimony, targetRetention = 0.35) {
  return (mask) => {
    let kept = 0; let signal = 0;
    mask.forEach((b, i) => { if (b) { kept += 1; signal += values[i]; } });
    if (kept < 3) return -1;
    const accuracy = signal / (values.reduce((a, b) => a + b, 0) || 1);
    const retention = kept / mask.length;
    const savings = Math.max(0, Math.min(1, (1 - retention) / (1 - targetRetention)));
    return accuracy + parsimony * savings;
  };
}
