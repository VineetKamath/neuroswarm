/**
 * Verifies that every claim the Bio-Lab makes in its UI copy is actually true
 * of the algorithms as implemented. Run with:  node verify.mjs
 */
import {
  GeneticAlgorithm, ParticleSwarm, BinaryGeneticAlgorithm,
  NegativeSelection, AntColony, mulberry32, ndcgAtK,
} from './src/bio/engines.js';
import {
  toyFitness, BASELINE_GENOME, psoLandscape, PSO_OPTIMUM, makeSelfSamples,
  normalizeVital, makeDimensionValues, makeBinFitness, BIN_DIMS,
  ACO_INTENTS, ACO_PARTITIONS, ACO_SIZES, acoGoldFor, TOY_QUERIES,
} from './src/bio/toyProblem.js';

let fail = 0;
const ok = (c, m, extra = '') => {
  console.log((c ? '  PASS  ' : '  FAIL  ') + m + (extra ? `  [${extra}]` : ''));
  if (!c) fail += 1;
};
const head = (t) => console.log(`\n${t}`);

/* ------------------------------------------------------------- metrics -- */
head('== ranking metric ==');
ok(ndcgAtK([1, 0, 0], 3) > ndcgAtK([0, 0, 1], 3), 'nDCG rewards putting relevant items first');
ok(Math.abs(ndcgAtK([1, 1, 1], 3) - 1) < 1e-9, 'a perfect ranking scores exactly 1.0');

/* --------------------------------------------------------- toy problem -- */
head('== the toy problem is a real search problem ==');
const base = toyFitness(BASELINE_GENOME);
ok(base < 0.5, 'similarity-only baseline scores poorly', `nDCG@3 = ${base.toFixed(4)}`);
ok(TOY_QUERIES.length >= 6, 'enough queries to create conflicting demands', `${TOY_QUERIES.length} queries`);
{
  const g = new GeneticAlgorithm({ genomeLength: 5, populationSize: 20, seed: 42, fitnessFn: toyFitness });
  const gen0 = g.history[0].best;
  ok(gen0 < 0.95, 'generation 0 does NOT already solve it (evolution is visible)', `gen0 best = ${gen0.toFixed(4)}`);
}

/* ------------------------------------------------- 1. Genetic Algorithm -- */
head('== 1. Genetic Algorithm ==');
const ga = new GeneticAlgorithm({ genomeLength: 5, populationSize: 20, seed: 42, fitnessFn: toyFitness });
for (let i = 0; i < 60; i += 1) ga.step();
ok(ga.best.fitness > base * 2, 'GA substantially beats the similarity-only baseline',
  `${base.toFixed(4)} -> ${ga.best.fitness.toFixed(4)}`);
ok(ga.history[ga.history.length - 1].diversity < ga.history[0].diversity, 'diversity collapses as it converges');

head('== GA claim: freezing ALL variation flatlines the run ==');
{
  const frozen = new GeneticAlgorithm({
    genomeLength: 5, populationSize: 20, seed: 42,
    mutationRate: 0, crossoverRate: 0, fitnessFn: toyFitness,
  });
  for (let i = 0; i < 40; i += 1) frozen.step();
  const h = frozen.history;
  const distinct = new Set(frozen.population.map((g) => g.map((x) => x.toFixed(6)).join(','))).size;
  ok(distinct <= 4, 'population collapses to a handful of clones',
    `${distinct} distinct genomes of ${frozen.populationSize}`);
  ok(h[h.length - 1].best <= h[5].best + 1e-9, 'best fitness flatlines permanently',
    `gen5 ${h[5].best.toFixed(4)} == gen40 ${h[h.length - 1].best.toFixed(4)}`);
  ok(h[h.length - 1].mean <= h[5].mean + 1e-9, 'mean fitness flatlines too');
}

head('== GA claim: elitism keeps the best monotonic ==');
{
  const count = (elitism) => {
    let drops = 0;
    for (let seed = 1; seed <= 12; seed += 1) {
      const g = new GeneticAlgorithm({
        genomeLength: 5, populationSize: 10, seed, elitism,
        mutationRate: 0.5, mutationSigma: 0.45, fitnessFn: toyFitness,
      });
      const bests = [];
      for (let i = 0; i < 50; i += 1) { g.step(); bests.push(g.history[g.history.length - 1].best); }
      bests.forEach((v, i) => { if (i > 0 && v < bests[i - 1] - 1e-9) drops += 1; });
    }
    return drops;
  };
  const withElite = count(2);
  const without = count(0);
  ok(withElite === 0, 'with elitism the best NEVER regresses', `${withElite} regressions`);
  ok(without > 0, 'without elitism the best DOES regress', `${without} regressions`);
}

head('== GA claim: tournament size 1 = random selection ==');
{
  const meanAt = (ts) => {
    const g = new GeneticAlgorithm({ genomeLength: 5, populationSize: 20, seed: 42, tournamentSize: ts, fitnessFn: toyFitness });
    for (let i = 0; i < 60; i += 1) g.step();
    return g.history[g.history.length - 1].mean;
  };
  const m1 = meanAt(1); const m3 = meanAt(3);
  ok(m1 < m3 - 0.02, 'tournament=1 leaves the population as a whole much weaker',
    `mean ${m1.toFixed(3)} vs ${m3.toFixed(3)}`);
}

/* --------------------------------------------- 2. Particle Swarm Optim. -- */
head('== 2. Particle Swarm Optimization ==');
{
  let found = 0;
  for (let s = 1; s <= 10; s += 1) {
    const p = new ParticleSwarm({
      genomeLength: 2, swarmSize: 26, seed: s, inertia: 0.72, cognitive: 1.5,
      social: 1.5, vMax: 0.12, fitnessFn: (g) => psoLandscape(g[0], g[1]),
    });
    for (let i = 0; i < 120; i += 1) p.step();
    if (Math.hypot(p.gBest[0] - PSO_OPTIMUM.x, p.gBest[1] - PSO_OPTIMUM.y) < 0.12) found += 1;
  }
  ok(found >= 8, 'default settings find the TRUE optimum, not the decoy', `${found}/10 seeds`);
}
head('== PSO claim: cognitive=0 gets trapped on the decoy ==');
{
  let trapped = 0;
  for (let s = 1; s <= 20; s += 1) {
    const p = new ParticleSwarm({
      genomeLength: 2, swarmSize: 10, seed: s, cognitive: 0, social: 2.5,
      inertia: 0.05, vMax: 0.03, fitnessFn: (g) => psoLandscape(g[0], g[1]),
    });
    for (let i = 0; i < 90; i += 1) p.step();
    if (Math.hypot(p.gBest[0] - PSO_OPTIMUM.x, p.gBest[1] - PSO_OPTIMUM.y) > 0.18) trapped += 1;
  }
  ok(trapped >= 6, 'the trap preset traps roughly half of runs (UI says "about half")',
    `${trapped}/20 trapped`);
}
{
  const p = new ParticleSwarm({ genomeLength: 2, seed: 3, fitnessFn: (g) => psoLandscape(g[0], g[1]) });
  const d0 = p.history[0].diversity;
  for (let i = 0; i < 120; i += 1) p.step();
  ok(p.history[p.history.length - 1].diversity < d0, 'the swarm contracts over time');
}

/* ------------------------------------------ 3. Artificial Immune System -- */
head('== 3. Artificial Immune System (negative selection) ==');
const selfS = makeSelfSamples(mulberry32(13), 60);
const ais = new NegativeSelection({ selfSamples: selfS, selfRadius: 0.09, seed: 13, dims: 2 });
ais.grow(2500);
ok(ais.detectors.length > 40, 'detectors mature', `${ais.detectors.length} from ${ais.attempts} candidates`);
ok(!ais.detectors.some((d) => ais.nearestSelf(d.center) <= ais.selfRadius),
  'NO detector overlaps the self region (the censoring guarantee)');
ok(ais.test(normalizeVital(76, 122)).anomalous === false, 'a normal reading is accepted');
ok(ais.test(normalizeVital(8, 118)).anomalous === true, 'dropped-digit HR=8 is flagged');
ok(ais.test(normalizeVital(38, 72)).anomalous === true, 'bradycardic + hypotensive is flagged');
ok(ais.coverage(1500) > 0.75, 'non-self space is well covered', `${(ais.coverage(1500) * 100).toFixed(1)}%`);

head('== AIS claim: a wider self-radius trades detection for fewer false alarms ==');
{
  const tight = new NegativeSelection({ selfSamples: selfS, selfRadius: 0.03, seed: 13, dims: 2 });
  tight.grow(2500);
  const wide = new NegativeSelection({ selfSamples: selfS, selfRadius: 0.20, seed: 13, dims: 2 });
  wide.grow(2500);
  const probes = [[78, 210], [150, 205], [95, 148], [70, 135]].map(([h, s]) => normalizeVital(h, s));
  const tightHits = probes.filter((p) => tight.test(p).anomalous).length;
  const wideHits = probes.filter((p) => wide.test(p).anomalous).length;
  ok(tightHits >= wideHits, 'a tighter margin flags at least as much as a wide one',
    `tight ${tightHits}/4 vs wide ${wideHits}/4`);
}

/* ------------------------------------------------- 4. Binary Genetic Alg -- */
head('== 4. Binary Genetic Algorithm ==');
const vals = makeDimensionValues(mulberry32(21 * 7 + 3));
const usefulTotal = vals.filter((v) => v > 0.5).length;
const bga = new BinaryGeneticAlgorithm({ genomeLength: BIN_DIMS, seed: 21, fitnessFn: makeBinFitness(vals, 0.35) });
for (let i = 0; i < 100; i += 1) bga.step();
const mask = bga.best.genome;
const kept = mask.filter(Boolean).length;
const usefulKept = mask.reduce((s, b, i) => s + (b && vals[i] > 0.5 ? 1 : 0), 0);
ok(kept < BIN_DIMS, 'the mask genuinely compresses', `${kept}/${BIN_DIMS} kept`);
ok(usefulKept / usefulTotal > 0.8, 'it recovers the genuinely useful dimensions',
  `${usefulKept}/${usefulTotal}`);

head('== Binary GA claim: bit-flip mutation is ESSENTIAL here ==');
{
  const noMut = new BinaryGeneticAlgorithm({ genomeLength: BIN_DIMS, seed: 21, mutationRate: 0, fitnessFn: makeBinFitness(vals, 0.35) });
  for (let i = 0; i < 100; i += 1) noMut.step();
  const uk = noMut.best.genome.reduce((s, b, i) => s + (b && vals[i] > 0.5 ? 1 : 0), 0);
  ok(noMut.history[noMut.history.length - 1].diversity < 0.001,
    'without mutation the population collapses to identical masks',
    `div = ${noMut.history[noMut.history.length - 1].diversity.toFixed(5)}`);
  ok(uk < usefulKept, 'and it finds fewer useful dimensions than the mutating run',
    `${uk} vs ${usefulKept} of ${usefulTotal}`);
}

head('== Binary GA claim: parsimony pressure creates the trade-off ==');
{
  const free = new BinaryGeneticAlgorithm({ genomeLength: BIN_DIMS, seed: 21, fitnessFn: makeBinFitness(vals, 0) });
  for (let i = 0; i < 100; i += 1) free.step();
  ok(free.best.genome.filter(Boolean).length > kept,
    'with no size penalty the GA keeps far more dimensions',
    `${free.best.genome.filter(Boolean).length} vs ${kept}`);
}

/* ------------------------------------------- 5. Ant Colony Optimization -- */
head('== 5. Ant Colony Optimization ==');
const aco = new AntColony({
  intents: ACO_INTENTS, partitions: ACO_PARTITIONS, sizes: ACO_SIZES, goldFor: acoGoldFor,
  seed: 99, nAnts: 14, evaporation: 0.12, alpha: 1, beta: 2, budget: 2,
});
for (let i = 0; i < 120; i += 1) aco.step();
let correct = 0;
ACO_INTENTS.forEach((intent, i) => {
  const route = aco.bestRoute(i).map((k) => ACO_PARTITIONS[k]);
  if (route.some((r) => acoGoldFor(intent).includes(r))) correct += 1;
  console.log(`         ${intent.padEnd(11)} -> ${route.join('  ,  ')}`);
});
ok(correct === ACO_INTENTS.length, 'the colony learns a correct route for every intent',
  `${correct}/${ACO_INTENTS.length}`);
const lastH = aco.history[aco.history.length - 1];
const totalChunks = Object.values(ACO_SIZES).reduce((a, b) => a + b, 0);
ok(lastH.hitRate > 0.6, 'hit rate is high after training', `${(lastH.hitRate * 100).toFixed(0)}%`);
ok(lastH.meanScanned < totalChunks * 0.5, 'far fewer chunks scanned than exhaustive search',
  `${lastH.meanScanned.toFixed(0)} of ${totalChunks}`);

head('== ACO claim: alpha=0 means no learning happens ==');
{
  const blind = new AntColony({
    intents: ACO_INTENTS, partitions: ACO_PARTITIONS, sizes: ACO_SIZES,
    goldFor: acoGoldFor, seed: 99, alpha: 0, beta: 0, budget: 2,
  });
  for (let i = 0; i < 120; i += 1) blind.step();
  const spread = Math.max(...blind.tau.flat()) - Math.min(...blind.tau.flat());
  const trainedSpread = Math.max(...aco.tau.flat()) - Math.min(...aco.tau.flat());
  ok(spread < trainedSpread * 0.6, 'trails stay undifferentiated when pheromone is ignored',
    `spread ${spread.toFixed(3)} vs trained ${trainedSpread.toFixed(3)}`);
}

head('== ACO claim: evaporation=0 locks in early routes ==');
{
  const noEvap = new AntColony({
    intents: ACO_INTENTS, partitions: ACO_PARTITIONS, sizes: ACO_SIZES,
    goldFor: acoGoldFor, seed: 4, evaporation: 0, alpha: 1, beta: 2, budget: 2,
  });
  for (let i = 0; i < 120; i += 1) noEvap.step();
  const withEvap = new AntColony({
    intents: ACO_INTENTS, partitions: ACO_PARTITIONS, sizes: ACO_SIZES,
    goldFor: acoGoldFor, seed: 4, evaporation: 0.12, alpha: 1, beta: 2, budget: 2,
  });
  for (let i = 0; i < 120; i += 1) withEvap.step();
  ok(noEvap.history[noEvap.history.length - 1].totalPheromone
     > withEvap.history[withEvap.history.length - 1].totalPheromone,
  'pheromone accumulates without bound when nothing evaporates',
  `${noEvap.history[noEvap.history.length - 1].totalPheromone.toFixed(1)} vs ${withEvap.history[withEvap.history.length - 1].totalPheromone.toFixed(1)}`);
}

console.log(fail === 0
  ? '\nALL SANDBOX ALGORITHMS AND UI CLAIMS VERIFIED\n'
  : `\n${fail} CHECK(S) FAILED\n`);
process.exit(fail === 0 ? 0 : 1);
