/**
 * Browser-side implementations of the five optimizers.
 *
 * These mirror the Python operators in `backend/app/bio/` exactly — same
 * selection, same crossover, same mutation, same pheromone update. They exist
 * so the Bio-Lab can run an algorithm *live* while you drag a slider, and so
 * every intermediate step (which parents were picked, where crossover cut,
 * which genes mutated) can be shown rather than described.
 *
 * Every engine is STEPPABLE: call `.step()` for one generation. That is what
 * lets the UI pause, single-step and rewind, which is the whole point of a
 * teaching tool.
 */

/* --------------------------------------------------------------- helpers -- */
export function mulberry32(seed) {
  // Small deterministic PRNG so a given seed always replays identically.
  let a = seed >>> 0;
  return function rand() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

function gauss(rand, sigma) {
  // Box–Muller
  const u = Math.max(1e-9, rand());
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma;
}

export function mean(xs) {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}

export function diversity(pop) {
  if (pop.length < 2) return 0;
  const d = pop[0].length;
  let total = 0;
  for (let j = 0; j < d; j += 1) {
    const col = pop.map((p) => p[j]);
    const m = mean(col);
    total += Math.sqrt(mean(col.map((x) => (x - m) ** 2)));
  }
  return total / d;
}

/* ------------------------------------------------------- ranking metrics -- */
export function ndcgAtK(rels, k) {
  const dcg = (arr) => arr.reduce((s, r, i) => s + r / Math.log2(i + 2), 0);
  const top = rels.slice(0, k);
  const ideal = [...rels].sort((a, b) => b - a).slice(0, k);
  const idcg = dcg(ideal);
  return idcg > 0 ? dcg(top) / idcg : 0;
}

/* ==========================================================================
   1. GENETIC ALGORITHM  (real-valued, elitist, tournament + BLX-α + creep)
   ========================================================================== */
export class GeneticAlgorithm {
  constructor({
    genomeLength, populationSize = 24, crossoverRate = 0.85, mutationRate = 0.15,
    mutationSigma = 0.18, elitism = 2, tournamentSize = 3, seed = 42, fitnessFn,
  }) {
    Object.assign(this, {
      genomeLength, populationSize, crossoverRate, mutationRate,
      mutationSigma, elitism, tournamentSize, fitnessFn,
    });
    this.rand = mulberry32(seed);
    this.generation = 0;
    this.history = [];
    this.lastEvents = [];
    this.population = Array.from({ length: populationSize }, () =>
      Array.from({ length: genomeLength }, () => this.rand()));
    this.fitness = this.population.map(fitnessFn);
    this.record();
  }

  setParams(p) { Object.assign(this, p); }

  get bestIndex() {
    let bi = 0;
    for (let i = 1; i < this.fitness.length; i += 1) if (this.fitness[i] > this.fitness[bi]) bi = i;
    return bi;
  }

  get best() { return { genome: this.population[this.bestIndex], fitness: this.fitness[this.bestIndex] }; }

  record() {
    const sorted = [...this.fitness].sort((a, b) => b - a);
    this.history.push({
      generation: this.generation,
      best: sorted[0],
      mean: mean(this.fitness),
      worst: sorted[sorted.length - 1],
      diversity: diversity(this.population),
    });
  }

  /** Tournament selection: sample k at random, the fittest wins. */
  tournament() {
    const picks = [];
    for (let i = 0; i < this.tournamentSize; i += 1) {
      picks.push(Math.floor(this.rand() * this.populationSize));
    }
    let win = picks[0];
    picks.forEach((p) => { if (this.fitness[p] > this.fitness[win]) win = p; });
    return { index: win, contenders: picks };
  }

  /** BLX-α blend crossover: children sampled from an interval spanning both parents. */
  crossover(a, b) {
    if (this.rand() > this.crossoverRate) return { c1: [...a], c2: [...b], happened: false };
    const alpha = 0.5;
    const c1 = []; const c2 = [];
    for (let i = 0; i < a.length; i += 1) {
      const lo = Math.min(a[i], b[i]);
      const hi = Math.max(a[i], b[i]);
      const span = (hi - lo) * alpha;
      c1.push(clamp01(lo - span + this.rand() * (hi - lo + 2 * span)));
      c2.push(clamp01(lo - span + this.rand() * (hi - lo + 2 * span)));
    }
    return { c1, c2, happened: true };
  }

  /** Gaussian creep mutation on each gene independently. */
  mutate(genome) {
    const out = []; const mutated = [];
    genome.forEach((g, i) => {
      if (this.rand() < this.mutationRate) {
        out.push(clamp01(g + gauss(this.rand, this.mutationSigma)));
        mutated.push(i);
      } else out.push(g);
    });
    return { genome: out, mutated };
  }

  step() {
    const order = this.population
      .map((_, i) => i)
      .sort((x, y) => this.fitness[y] - this.fitness[x]);

    const events = [];
    // Elitism: the strongest genomes survive untouched, so the best solution
    // found so far can never be lost to an unlucky crossover.
    const next = order.slice(0, this.elitism).map((i) => {
      events.push({ type: 'elite', from: i });
      return [...this.population[i]];
    });

    while (next.length < this.populationSize) {
      const p1 = this.tournament();
      const p2 = this.tournament();
      const { c1, c2, happened } = this.crossover(this.population[p1.index], this.population[p2.index]);
      const m1 = this.mutate(c1);
      events.push({
        type: 'offspring', parents: [p1.index, p2.index],
        contenders: [p1.contenders, p2.contenders],
        crossed: happened, mutated: m1.mutated,
      });
      next.push(m1.genome);
      if (next.length < this.populationSize) {
        const m2 = this.mutate(c2);
        next.push(m2.genome);
      }
    }

    this.population = next;
    this.fitness = next.map(this.fitnessFn);
    this.generation += 1;
    this.lastEvents = events;
    this.record();
    return this;
  }
}

/* ==========================================================================
   2. PARTICLE SWARM OPTIMIZATION  (gbest, linearly decaying inertia)
   ========================================================================== */
export class ParticleSwarm {
  constructor({
    genomeLength, swarmSize = 26, inertia = 0.72, cognitive = 1.5, social = 1.5,
    vMax = 0.12, seed = 7, fitnessFn,
  }) {
    Object.assign(this, { genomeLength, swarmSize, inertia, cognitive, social, vMax, fitnessFn });
    this.rand = mulberry32(seed);
    this.iteration = 0;
    this.history = [];
    this.positions = Array.from({ length: swarmSize }, () =>
      Array.from({ length: genomeLength }, () => this.rand()));
    this.velocities = Array.from({ length: swarmSize }, () =>
      Array.from({ length: genomeLength }, () => (this.rand() - 0.5) * 0.06));
    this.pBest = this.positions.map((p) => [...p]);
    this.pBestFit = this.positions.map(fitnessFn);
    this.gBest = [...this.pBest[this.argmax(this.pBestFit)]];
    this.gBestFit = Math.max(...this.pBestFit);
    this.record();
  }

  argmax(a) { let b = 0; for (let i = 1; i < a.length; i += 1) if (a[i] > a[b]) b = i; return b; }

  setParams(p) { Object.assign(this, p); }

  record() {
    this.history.push({
      generation: this.iteration,
      best: this.gBestFit,
      mean: mean(this.pBestFit),
      worst: Math.min(...this.pBestFit),
      diversity: diversity(this.positions),
    });
  }

  step() {
    for (let i = 0; i < this.swarmSize; i += 1) {
      for (let j = 0; j < this.genomeLength; j += 1) {
        const r1 = this.rand();
        const r2 = this.rand();
        // v = w·v  +  c1·r1·(pbest − x)  +  c2·r2·(gbest − x)
        //     ↑ momentum   ↑ own memory       ↑ social pull
        let v = this.inertia * this.velocities[i][j]
          + this.cognitive * r1 * (this.pBest[i][j] - this.positions[i][j])
          + this.social * r2 * (this.gBest[j] - this.positions[i][j]);
        v = Math.max(-this.vMax, Math.min(this.vMax, v));
        this.velocities[i][j] = v;
        this.positions[i][j] = clamp01(this.positions[i][j] + v);
      }
      const f = this.fitnessFn(this.positions[i]);
      if (f > this.pBestFit[i]) { this.pBestFit[i] = f; this.pBest[i] = [...this.positions[i]]; }
      if (f > this.gBestFit) { this.gBestFit = f; this.gBest = [...this.positions[i]]; }
    }
    this.iteration += 1;
    this.record();
    return this;
  }
}

/* ==========================================================================
   3. ARTIFICIAL IMMUNE SYSTEM  (real-valued negative selection, V-detector)
   ========================================================================== */
export class NegativeSelection {
  constructor({ selfSamples = [], selfRadius = 0.09, seed = 13, dims = 2 }) {
    this.selfSamples = selfSamples;
    this.selfRadius = selfRadius;
    this.dims = dims;
    this.rand = mulberry32(seed);
    this.detectors = [];
    this.rejected = [];      // candidates killed during censoring — the teaching moment
    this.attempts = 0;
  }

  setSelf(samples) { this.selfSamples = samples; this.detectors = []; this.rejected = []; this.attempts = 0; }
  setRadius(r) { this.selfRadius = r; this.detectors = []; this.rejected = []; this.attempts = 0; }

  nearestSelf(point) {
    let best = Infinity;
    this.selfSamples.forEach((s) => {
      let d = 0;
      for (let i = 0; i < this.dims; i += 1) d += (s[i] - point[i]) ** 2;
      d = Math.sqrt(d);
      if (d < best) best = d;
    });
    return best;
  }

  /**
   * One censoring round: propose a random candidate detector.
   * If it binds "self" it is destroyed (apoptosis) — exactly what happens to
   * self-reactive T-cells in the thymus. Survivors grow a radius that stops
   * just short of the self region.
   */
  proposeOne() {
    this.attempts += 1;
    const c = Array.from({ length: this.dims }, () => this.rand());
    const dSelf = this.selfSamples.length ? this.nearestSelf(c) : 1;

    if (dSelf <= this.selfRadius) {
      this.rejected.push({ center: c, reason: 'bound self — destroyed' });
      if (this.rejected.length > 60) this.rejected.shift();
      return { accepted: false, center: c };
    }
    // Redundancy check keeps coverage spreading instead of stacking.
    const covered = this.detectors.some((d) => {
      let dist = 0;
      for (let i = 0; i < this.dims; i += 1) dist += (d.center[i] - c[i]) ** 2;
      return Math.sqrt(dist) < d.radius * 0.62;
    });
    if (covered) {
      this.rejected.push({ center: c, reason: 'already covered' });
      if (this.rejected.length > 60) this.rejected.shift();
      return { accepted: false, center: c };
    }

    const det = { center: c, radius: dSelf - this.selfRadius };
    this.detectors.push(det);
    return { accepted: true, ...det };
  }

  grow(n = 1) {
    const results = [];
    for (let i = 0; i < n; i += 1) results.push(this.proposeOne());
    return results;
  }

  /** Does any matured detector bind this point? */
  test(point) {
    for (const d of this.detectors) {
      let dist = 0;
      for (let i = 0; i < this.dims; i += 1) dist += (d.center[i] - point[i]) ** 2;
      if (Math.sqrt(dist) <= d.radius) {
        return { anomalous: true, detector: d, distance: Math.sqrt(dist) };
      }
    }
    return { anomalous: false, detector: null, distance: this.nearestSelf(point) };
  }

  /** Monte-Carlo estimate of how much non-self space is covered. */
  coverage(probes = 900) {
    if (!this.detectors.length) return 0;
    const r = mulberry32(99);
    let nonself = 0; let covered = 0;
    for (let i = 0; i < probes; i += 1) {
      const p = Array.from({ length: this.dims }, () => r());
      if (this.selfSamples.length && this.nearestSelf(p) <= this.selfRadius) continue;
      nonself += 1;
      if (this.test(p).anomalous) covered += 1;
    }
    return nonself ? covered / nonself : 0;
  }
}

/* ==========================================================================
   4. BINARY GENETIC ALGORITHM  (dimension subset selection, uniform crossover)
   ========================================================================== */
export class BinaryGeneticAlgorithm {
  constructor({
    genomeLength, populationSize = 24, crossoverRate = 0.8, mutationRate = 0.03,
    elitism = 2, tournamentSize = 3, initDensity = 0.45, seed = 21, fitnessFn,
  }) {
    Object.assign(this, {
      genomeLength, populationSize, crossoverRate, mutationRate,
      elitism, tournamentSize, fitnessFn,
    });
    this.rand = mulberry32(seed);
    this.generation = 0;
    this.history = [];
    this.population = Array.from({ length: populationSize }, () =>
      Array.from({ length: genomeLength }, () => this.rand() < initDensity));
    this.fitness = this.population.map(fitnessFn);
    this.record();
  }

  setParams(p) { Object.assign(this, p); }

  get bestIndex() {
    let bi = 0;
    for (let i = 1; i < this.fitness.length; i += 1) if (this.fitness[i] > this.fitness[bi]) bi = i;
    return bi;
  }

  get best() { return { genome: this.population[this.bestIndex], fitness: this.fitness[this.bestIndex] }; }

  record() {
    const sorted = [...this.fitness].sort((a, b) => b - a);
    this.history.push({
      generation: this.generation,
      best: sorted[0],
      mean: mean(this.fitness),
      worst: sorted[sorted.length - 1],
      diversity: diversity(this.population.map((p) => p.map((b) => (b ? 1 : 0)))),
    });
  }

  tournament() {
    let win = Math.floor(this.rand() * this.populationSize);
    for (let i = 1; i < this.tournamentSize; i += 1) {
      const c = Math.floor(this.rand() * this.populationSize);
      if (this.fitness[c] > this.fitness[win]) win = c;
    }
    return win;
  }

  step() {
    const order = this.population.map((_, i) => i).sort((x, y) => this.fitness[y] - this.fitness[x]);
    const next = order.slice(0, this.elitism).map((i) => [...this.population[i]]);

    while (next.length < this.populationSize) {
      const a = this.population[this.tournament()];
      const b = this.population[this.tournament()];
      let c1; let c2;
      if (this.rand() > this.crossoverRate) { c1 = [...a]; c2 = [...b]; } else {
        // Uniform crossover mixes dimensions freely — this is what lets the GA
        // recombine useful *groups* of dimensions rather than contiguous blocks.
        c1 = []; c2 = [];
        for (let i = 0; i < a.length; i += 1) {
          if (this.rand() < 0.5) { c1.push(a[i]); c2.push(b[i]); } else { c1.push(b[i]); c2.push(a[i]); }
        }
      }
      [c1, c2].forEach((child) => {
        if (next.length >= this.populationSize) return;
        const m = child.map((bit) => (this.rand() < this.mutationRate ? !bit : bit));
        if (!m.some(Boolean)) m[Math.floor(this.rand() * m.length)] = true;
        next.push(m);
      });
    }

    this.population = next;
    this.fitness = next.map(this.fitnessFn);
    this.generation += 1;
    this.record();
    return this;
  }
}

/* ==========================================================================
   5. ANT COLONY OPTIMIZATION  (pheromone over intent → partition edges)
   ========================================================================== */
export class AntColony {
  constructor({
    intents, partitions, goldFor, sizes, nAnts = 14, evaporation = 0.12,
    alpha = 1, beta = 2, q = 1, budget = 2, seed = 99, initial = 0.25,
  }) {
    Object.assign(this, {
      intents, partitions, goldFor, sizes, nAnts, evaporation, alpha, beta, q, budget,
    });
    this.rand = mulberry32(seed);
    this.iteration = 0;
    this.history = [];
    this.tau = intents.map(() => partitions.map(() => initial));
    // Heuristic prior η — a weak, uniform starting bias so ants are not blind.
    this.eta = intents.map(() => partitions.map(() => 1 / partitions.length));
    this.lastWalks = [];
  }

  setParams(p) { Object.assign(this, p); }

  reset(initial = 0.25) {
    this.tau = this.intents.map(() => this.partitions.map(() => initial));
    this.iteration = 0; this.history = []; this.lastWalks = [];
  }

  desire(i) {
    return this.partitions.map((_, p) =>
      (this.tau[i][p] ** this.alpha) * ((this.eta[i][p] + 1e-9) ** this.beta));
  }

  /** One ant walks: pick `budget` partitions, roulette-weighted by τ^α · η^β. */
  walk(i) {
    const desire = this.desire(i);
    const avail = this.partitions.map((_, k) => k);
    const route = [];
    for (let s = 0; s < Math.min(this.budget, avail.length); s += 1) {
      const weights = avail.map((k) => desire[k]);
      const total = weights.reduce((x, y) => x + y, 0);
      let pick = avail.length - 1;
      if (total > 0) {
        let r = this.rand() * total; let acc = 0;
        for (let k = 0; k < weights.length; k += 1) {
          acc += weights[k];
          if (acc >= r) { pick = k; break; }
        }
      }
      route.push(avail[pick]);
      avail.splice(pick, 1);
    }
    return route;
  }

  step() {
    const deposits = this.intents.map(() => this.partitions.map(() => 0));
    const walks = [];
    let hits = 0;
    const totalChunks = Object.values(this.sizes).reduce((a, b) => a + b, 0) || 1;

    for (let a = 0; a < this.nAnts; a += 1) {
      const i = Math.floor(this.rand() * this.intents.length);
      const route = this.walk(i);
      const gold = this.goldFor(this.intents[i]);
      const foundAt = route.findIndex((p) => gold.includes(this.partitions[p]));
      const scanned = route.reduce((s, p) => s + (this.sizes[this.partitions[p]] || 0), 0);

      let quality = 0;
      if (foundAt >= 0) {
        hits += 1;
        // Reward = found it, weighted by how early and how cheaply.
        quality = (1 / (foundAt + 1)) * (1 - 0.5 * (scanned / totalChunks));
        route.forEach((p, r) => { deposits[i][p] += (this.q * quality) / (r + 1); });
      }
      walks.push({ intent: i, route, foundAt, quality, scanned });
    }

    // Evaporate first, then deposit. Evaporation is what lets the colony
    // FORGET a route that stopped paying off — the reason this beats a
    // static lookup table as documentation habits drift.
    for (let i = 0; i < this.intents.length; i += 1) {
      for (let p = 0; p < this.partitions.length; p += 1) {
        this.tau[i][p] = Math.max(0.02, Math.min(6,
          this.tau[i][p] * (1 - this.evaporation) + deposits[i][p] / this.nAnts));
      }
    }

    this.iteration += 1;
    this.lastWalks = walks;
    this.history.push({
      generation: this.iteration,
      hitRate: hits / this.nAnts,
      meanScanned: mean(walks.map((w) => w.scanned)),
      totalPheromone: this.tau.flat().reduce((a, b) => a + b, 0),
    });
    return this;
  }

  /** Greedy route the trained colony would actually serve. */
  bestRoute(intentIdx) {
    const d = this.desire(intentIdx);
    return d.map((v, k) => [v, k]).sort((a, b) => b[0] - a[0])
      .slice(0, this.budget).map(([, k]) => k);
  }
}
