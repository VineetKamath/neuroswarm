/*
 * Presenter content for the Bio-Lab. Short on purpose: each chapter should take
 * about a minute to read out while the simulation runs. Numbers are not written
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
    say: [
      'All five algorithms work with a population: many guesses compete, and the good ones shape the next round.',
      'None of them needs a gradient. The things we care about, like ranking quality or agreement with nurses, jump in steps, so calculus cannot optimise them directly.',
      'Every result is compared with the simple rule it replaced, on data the algorithm never trained on.',
      'There is no language model. Every answer is quoted from the patient\'s own record, so the system cannot make up a dose.',
    ],
    qa: [
      ['Why not use deep learning?', 'Our labelled data is small, and our goals (ranking quality, agreement with nurses) have no gradient. These algorithms optimise those goals directly, and the result is a handful of weights you can read and explain.'],
      ['Are the improvements real or just on training data?', 'Every headline number comes from a test set the algorithm never saw during training, compared with the exact rule it replaced.'],
    ],
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
    say: [
      'The old search ranked notes on one thing: how similar the words were. That put a vague summary above the actual order.',
      'Each chromosome is a set of weights for our clues. Its fitness is how well it ranks questions where we already know the right answer.',
      'Watch the best score climb and the population settle on similar weights.',
      'The same GA, with different genes, learned how a charge nurse orders tasks.',
    ],
    qa: [
      ['Why not just try every combination?', '14 genes with 10 values each is 10^14 combinations. The GA found a better answer in about 2,000 tries.'],
      ['What does elitism do?', 'It copies the best individuals into the next generation unchanged, so the best score can never go down. Turn it off in the lab and you can see the best line dip.'],
    ],
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
    say: [
      'The ground is the fitness landscape: higher is better. There is a wide decoy hill and a narrow true peak.',
      'The three arrows on the white bird are the equation: momentum, own memory, and the flock.',
      'If birds only follow the flock, they crowd onto the decoy and get stuck. That is premature convergence.',
      'On the real ranking problem, PSO and the GA were raced and the winner was deployed.',
    ],
    qa: [
      ['What does the inertia w do?', 'It balances exploring and settling. A high w keeps birds moving and exploring. A low w lets them settle. We lower it from 0.9 to 0.4 during training.'],
      ['How is PSO different from a GA?', 'Nobody is selected or removed. Every bird survives and learns by following its own best and the flock best.'],
    ],
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
    say: [
      'Green dots are normal readings. New detector cells that touch them burst red, just like in the thymus.',
      'The surviving cells guard the space around normal readings without ever covering one.',
      'A typo like heart rate 180 instead of 81 lands inside a detector and gets flagged.',
      'Values that are simply impossible, like a diastolic above the systolic, are caught by plain rules. The immune system covers what rules cannot.',
    ],
    qa: [
      ['How can it catch errors it never saw?', 'It never learns errors. It learns what normal looks like and covers everything else with detectors.'],
      ['Does it flag every sick patient?', 'No. The normal set includes the real, unusual-but-genuine readings of our ward. The self radius sets how close to normal still counts as normal.'],
    ],
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
    say: [
      'Each row in the stack is a mask. A raised tile means that number is kept.',
      'The glass pillars show which numbers really carry meaning. Watch the kept tiles line up with them.',
      'Turn mutation off and the population freezes before it finds all the useful numbers.',
      'In the real system we keep about a third of the numbers: around 63% less memory, with search quality about the same.',
    ],
    qa: [
      ['Did accuracy go up or down?', 'Within noise. The test set here is small, so we say accuracy is about the same, not better. The memory saving is exact.'],
      ['Why not use PCA?', 'PCA builds new mixed numbers. The GA keeps original numbers and optimises our actual search score, not variance.'],
    ],
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
    say: [
      'Anthills are question types. Paper piles are note sections, and a bigger pile means more text to scan.',
      'Ants that find the answer walk home with gold and strengthen their trail.',
      'Set alpha to 0 and ants ignore the trails, so the colony stops learning.',
      'In the real system a search looks at 5 of 30 sections first. If that looks weak it scans everything, so a miss costs time, not a wrong answer.',
    ],
    qa: [
      ['What do alpha and beta do?', 'Alpha is how much ants trust pheromone. Beta is how much they prefer cheap, small sections. A very high beta makes ants go for small sections no matter what they learned.'],
      ['Why is the hit rate below 100%?', 'Searching fewer sections can miss. That is the trade for scanning about 80% fewer chunks, and the full-scan fallback covers the misses.'],
    ],
  },
};
