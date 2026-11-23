/*
 * Explanations shown in the Bio-Lab. Numbers are not written
 * here; the page reads them from the live training report.
 */

export const CHAPTERS = [
  { key: 'overview', short: 'Overview', name: 'Five algorithms, one hospital', color: '#15897f' },
  { key: 'ga', short: 'GA', name: 'Genetic Algorithm', family: 'Evolutionary computation', color: '#7c6cf2' },
  { key: 'pso', short: 'PSO', name: 'Particle Swarm Optimization', family: 'Swarm intelligence', color: '#22b8e0' },
  { key: 'ais', short: 'AIS', name: 'Artificial Immune System', family: 'Immune computing', color: '#f0527a' },
  { key: 'bga', short: 'Binary GA', name: 'Binary Genetic Algorithm', family: 'Evolutionary computation', color: '#2fbf71' },
  { key: 'aco', short: 'ACO', name: 'Ant Colony Optimization', family: 'Swarm intelligence', color: '#f5a524' },
];

export const CONTENT = {
  overview: {
    tagline: 'NeuroSwarm is a hospital records system. Five of its everyday decisions are tuned by algorithms that copy nature, not by rules we typed in by hand.',
  },

  ga: {
    nature: 'Evolution. Individuals that suit their environment survive and pass on their genes. Children mix genes from both parents, and the odd random mutation adds something new.',
    mapping: [
      ['Chromosome', 'A set of weights (similarity, recency, exact words, ...)'],
      ['Fitness', 'Ranking quality (nDCG) on questions with known answers'],
      ['Natural selection', 'Tournament: best of 3 picked at random'],
      ['Reproduction', 'BLX-alpha crossover blends two parents'],
      ['Mutation', 'A small random nudge to one gene'],
    ],
    steps: [
      ['Evaluate', 'Rank the test questions with each chromosome and score how well it did.'],
      ['Select', 'Pick 3 at random and keep the best as a parent. Good genes spread, weak ones still get a chance.'],
      ['Crossover', 'Each child gene is drawn from a range around both parents\' values (BLX-alpha).'],
      ['Mutate', 'Each gene has a small chance of a random nudge. This is the only source of new values.'],
      ['Next generation', 'The best 2 are copied over unchanged (elitism), so the best score never drops. Children fill the rest.'],
    ],
    equation: 'child_i ~ U( min_i - a*d_i , max_i + a*d_i ),   d_i = |p1_i - p2_i|,   a = 0.5',
    why: 'Ranking quality only changes when two results swap places, so it has no slope to follow. A GA only needs a score, not a slope.',
  },

  pso: {
    nature: 'A flock of birds looking for food. Each bird remembers the best spot it has found and can see the best spot the flock has found. It flies somewhere between the two.',
    mapping: [
      ['Bird (particle)', 'One set of ranking weights'],
      ['Position', 'The weight values'],
      ['Own best (pbest)', 'Best weights this bird has tried'],
      ['Flock best (gbest)', 'Best weights any bird has found'],
      ['Food', 'Ranking quality (fitness)'],
    ],
    steps: [
      ['Evaluate', 'Each bird measures how good its current spot is.'],
      ['Remember', 'If it beats its own record it updates pbest. The best of all becomes gbest.'],
      ['Steer', 'New velocity = some old momentum + a pull to its own best + a pull to the flock best.'],
      ['Move', 'Position = position + velocity. Repeat until the flock settles.'],
    ],
    equation: 'v = w*v + c1*r1*(pbest - x) + c2*r2*(gbest - x)        x = x + v',
    why: 'It solves the same no-gradient problem as the GA, but shares information through the flock best instead of crossover. It often settles faster, so we train both and keep the winner.',
  },

  ais: {
    nature: 'In the thymus, new T-cells are tested against the body\'s own cells. Any that attack the body are destroyed. The survivors only react to things that are not part of the body.',
    mapping: [
      ['Self', 'Normal vital-sign readings'],
      ['New T-cell', 'A random candidate detector'],
      ['Thymus', 'Destroy candidates that touch normal data'],
      ['Mature T-cell', 'A detector guarding abnormal space'],
      ['Foreign body', 'A new reading that a detector reacts to'],
    ],
    steps: [
      ['Learn self', 'Collect normal readings only. No examples of mistakes are needed.'],
      ['Propose', 'Create random candidate detectors across the whole space.'],
      ['Censor', 'Destroy any candidate that overlaps normal data (negative selection).'],
      ['Mature', 'Survivors grow until they just touch normal data, covering the empty space.'],
      ['Monitor', 'If a new reading falls inside any detector, flag it.'],
    ],
    equation: 'detector radius r = distance(c, nearest normal) - r_self        flag x if |x - c_d| <= r_d for any detector d',
    why: 'Nobody has labelled examples of every possible typo. Negative selection learns from normal data only, so it can catch kinds of error nobody listed in advance.',
  },

  bga: {
    nature: 'The same evolution as the GA, but each gene is an on/off switch: keep this number or drop it.',
    mapping: [
      ['Gene', 'One embedding number: keep or drop'],
      ['Chromosome', 'A 384-bit mask of which numbers survive'],
      ['Fitness', 'Search quality, plus a bonus for keeping fewer numbers'],
      ['Crossover', 'Uniform: each bit copied from a random parent'],
      ['Mutation', 'Flip a bit now and then'],
    ],
    steps: [
      ['Evaluate', 'Search using only the kept numbers. Reward good results and reward keeping fewer numbers.'],
      ['Select', 'Tournament selection, same as the GA.'],
      ['Uniform crossover', 'For every bit, a coin flip decides which parent it comes from.'],
      ['Bit-flip mutation', 'Flip a few bits. Without this, a number once dropped can never come back.'],
      ['Next generation', 'The best masks carry over. The mask with the best balance wins.'],
    ],
    equation: 'fitness(mask) = nDCG(kept numbers) + lambda * savings(mask)        possible masks = 2^384',
    why: 'There are 2^384 possible masks. Picking numbers one at a time gets stuck, because some numbers only help in combination. Crossover can combine useful groups.',
  },

  aco: {
    nature: 'Ants find short paths to food by leaving pheromone. Paths that work get more pheromone. Unused paths fade, so the colony adapts when the food moves.',
    mapping: [
      ['Anthill', 'A type of question (medication, lab, symptom, ...)'],
      ['Food', 'The note section that holds the answer'],
      ['Ant', 'One practice question choosing where to search'],
      ['Pheromone', 'Learned preference: question type to section'],
      ['Evaporation', 'Old preferences fade unless they keep working'],
    ],
    steps: [
      ['Choose', 'Each ant picks sections with probability based on trail strength (alpha) and how cheap the section is (beta).'],
      ['Search', 'If the answer is in a chosen section, the ant succeeded.'],
      ['Deposit', 'Successful ants add pheromone. More if they found it early and scanned less.'],
      ['Evaporate', 'Every trail shrinks a little. Only routes that keep working stay strong.'],
    ],
    equation: 'P(i to j) = tau_ij^alpha * eta_ij^beta / sum_k( tau_ik^alpha * eta_ik^beta )        tau = (1 - rho)*tau + deposit',
    why: 'A fixed lookup table goes out of date when people change how they write notes. Evaporation lets the colony drop routes that stopped working, while random choices keep testing new ones.',
  },
};
