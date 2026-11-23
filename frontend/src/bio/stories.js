/*
 * Guided stories for the 3D Bio-Lab, written to be read out loud.
 * Each step's `action` puts the scene in a known state (several actions can be
 * joined with "|"), so Back and Next always show what the text describes.
 */

export const PLAIN = {
  ga: {
    job: 'decides which note a doctor sees first, and which task a nurse does first.',
    where: [
      { label: 'Patient chart: assistant answers', route: 'patients/1', file: 'backend/app/bio/ranking.py' },
      { label: 'Care Tasks: queue order', route: 'tasks', file: 'backend/app/bio/tasks.py' },
    ],
  },
  pso: {
    job: 'looks for the same search settings as the GA, but in a different way. We run both and keep the winner.',
    where: [
      { label: 'Patient chart: assistant answers', route: 'patients/1', file: 'backend/app/bio/ranking.py (train_ranking)' },
    ],
  },
  ais: {
    job: 'checks every vital-sign entry and flags likely typos before anyone acts on them.',
    where: [
      { label: 'Patient chart: Record vitals', route: 'patients/1', file: 'backend/app/bio/immune.py' },
      { label: 'Dashboard: Data-entry alerts', route: 'dashboard', file: 'backend/app/api/bio.py (/anomalies)' },
    ],
  },
  bga: {
    job: 'makes the search index smaller by keeping only the numbers that carry meaning.',
    where: [
      { label: 'Staff & System: vector dimensions', route: 'staff', file: 'backend/app/bio/compression.py' },
      { label: 'Every assistant search', route: 'patients/1', file: 'backend/app/services/vector_store.py' },
    ],
  },
  aco: {
    job: 'learns which part of the notes to search first for each type of question, so most notes never need to be scanned.',
    where: [
      { label: 'Patient chart: assistant (ACO badge on each answer)', route: 'patients/1', file: 'backend/app/bio/routing.py' },
    ],
  },
};

export const STORIES = {
  ga: [
    { tag: 'The problem', title: 'Dr. Sharma asks a question', action: 'reset|cam:wide',
      text: 'Dr. Sharma asks about Kamala: "What diuretic and dose was prescribed?" Six parts of her notes match. The old search sorted them by how similar the words were, so a general admission summary came first and the actual order came third.',
      look: 'the card on the right. Generation 0 still ranks the answer low.' },
    { tag: 'The idea', title: 'One recipe = one chromosome', action: 'reset|cam:tower',
      text: 'To rank notes we use five clues: similarity, how recent the note is, exact words, the right section, and length. A recipe says how much to trust each clue. Each DNA strand here is one recipe. Its five coloured rungs are its five genes. A longer, brighter rung means that clue is trusted more.',
      project: 'In the real system a recipe has 14 genes: 6 clue weights plus a few extra settings.' },
    { tag: 'Fitness', title: 'Higher pedestal = better recipe', action: 'reset|cam:wide',
      text: 'We test every recipe on questions where we already know the right note. The better it ranks that note, the higher its pedestal. They are sorted from fittest on the left to weakest on the right. Right now they are all close to the old system, so they are all low.' },
    { tag: 'Selection', title: 'The fittest become parents', action: 'reset|cam:wide|play:slow',
      text: 'Pick three recipes at random and keep the best one as a parent. Do it again for the second parent. Watch the pedestals glow at the start of each generation: the bright ones were picked often. Strong recipes spread, but weak ones still get a small chance.',
      look: 'the caption at the bottom says which phase you are watching.' },
    { tag: 'Crossover and mutation', title: 'Children mix two parents', action: 'cam:wide|play:slow',
      text: 'The arcs join two parents to a child. Each of the child\'s genes is a mix of the parents\' values. Now and then one gene gets a small random change, and its rung flashes white. That random change is the only way something new enters the population.' },
    { tag: 'Evolution', title: 'The right answer moves to #1', action: 'cam:wide|play:normal',
      text: 'Over the generations the pedestals rise, and the best recipe learns to trust "right section" and "exact words" more. On the right, "IV Furosemide 80mg BID" moves to the top of Dr. Sharma\'s results.',
      look: 'the best recipe bars on the right and the score at the top left.' },
    { tag: 'Experiment', title: 'Turn off crossover and mutation', action: 'cam:wide|preset:No mutation',
      text: 'With no crossover and no mutation the GA can only copy what it already has. It improves for a moment, then stops. This is why reproduction and mutation matter.' },
    { tag: 'In NeuroSwarm', title: 'Where this runs for real', action: 'cam:wide|preset:Balanced',
      text: 'The real GA ran for 40 generations on 270 labelled clinical questions and was then tested on 116 questions it had never seen. The same algorithm, with different genes, also learned how charge nurses order the task queue.',
      project: 'Every answer in the patient chart assistant is ranked by the evolved recipe. The Care Tasks queue is ordered by the evolved triage policy. Try both in the panel below.' },
  ],

  pso: [
    { tag: 'The problem', title: 'Same goal, different method', action: 'reset|cam:wide',
      text: 'PSO is also looking for the best search settings. Instead of breeding recipes, it sends a flock of birds over all the possible settings. In NeuroSwarm we train both and keep the one that does better.' },
    { tag: 'The landscape', title: 'Every spot is one choice of settings', action: 'reset|cam:low',
      text: 'Imagine only two settings: weight on recency and weight on exact words. Every spot on this ground is one combination. The height is how good search would be with it. We want the highest point, but we cannot see the map. We can only test one spot at a time.',
      look: 'the wide decoy hill and the narrower true peak.' },
    { tag: 'The flock', title: 'Birds start in random places', action: 'reset|cam:wide',
      text: 'Each bird is one guess. The flock starts scattered. The white bird is the one we will follow.' },
    { tag: 'Memory', title: 'Every bird remembers its best spot', action: 'reset|cam:wide|play:slow',
      text: 'The small rings show the best spot each bird has found so far. The gold beacon shows the best spot the whole flock has found. Every bird can see the beacon.' },
    { tag: 'The rule', title: 'Three pulls decide the next move', action: 'cam:low|play:slow',
      text: 'Look at the arrows on the white bird. Grey means keep going the same way. Blue pulls it back to its own best spot. Gold pulls it towards the flock\'s best spot. Add them up and you get its next move.',
      look: 'the three arrows on the white bird.' },
    { tag: 'Convergence', title: 'The flock finds the true peak', action: 'cam:wide|play:normal',
      text: 'Some birds explore the decoy and some explore the real peak. Once one of them finds the higher peak, the beacon moves there and the rest follow.' },
    { tag: 'Experiment', title: 'Only follow the leader', action: 'cam:wide|preset:Herd',
      text: 'Now each bird ignores its own memory and only follows the flock. They all rush to the first good spot, the decoy, and get stuck there. This is called premature convergence.' },
    { tag: 'In NeuroSwarm', title: 'A race against the GA', action: 'cam:wide|preset:Balanced',
      text: 'The real problem has 14 settings, so it cannot be drawn, but the flock works the same way. GA and PSO were trained on the same 270 questions, and the winner on unseen questions was deployed.',
      project: 'The training report records which one won. The assistant uses that recipe. See the race chart under "Real training results".' },
  ],

  ais: [
    { tag: 'The problem', title: 'Nurse Priya types 180 instead of 81', action: 'reset|cam:wide',
      text: 'At the end of a long shift, Nurse Priya records a heart rate of 180 instead of 81. One typo like this can start a false emergency, or hide a real one. We cannot list every possible typo in advance.' },
    { tag: 'Self', title: 'First, learn what normal looks like', action: 'reset|cam:self',
      text: 'Each green dot is one set of normal readings from our ward: heart rate, blood pressure and oxygen. Together they are "self". We only need normal data. We never need examples of mistakes.' },
    { tag: 'Random detectors', title: 'Make detector cells at random', action: 'reset|cam:wide|train:slow',
      text: 'The body makes T-cells with random shapes. We do the same. A new detector cell appears somewhere in the space.' },
    { tag: 'The thymus', title: 'Destroy any cell that attacks self', action: 'cam:self|train:slow',
      text: 'If a new cell lands too close to the green normal cloud, it is destroyed and bursts red. The body does the same thing in the thymus, so that immune cells never attack your own body.',
      look: 'cells near the green cloud turning red and bursting.' },
    { tag: 'Mature detectors', title: 'Survivors cover everything abnormal', action: 'cam:wide|train:fast',
      text: 'Cells that survive become detectors. Each one guards a bubble of space around it. Soon the bubbles cover the space around the green cloud, so anything that is not normal falls inside one.' },
    { tag: 'Monitoring', title: 'The typo arrives', action: 'cam:front|inject:1',
      text: 'Priya\'s entry flies in from her tablet: heart rate 180. It lands inside a detector\'s bubble. That detector lights up, and the entry is flagged as a likely typo before anyone acts on it.' },
    { tag: 'Monitoring', title: 'A normal reading passes', action: 'cam:front|inject:0',
      text: 'A normal reading lands inside the green cloud. No detector reacts, so it is accepted quietly. Press Play to send a mix of normal readings and typos.' },
    { tag: 'In NeuroSwarm', title: 'Every vitals entry is checked', action: 'cam:wide|stream',
      text: 'The real model works with all 7 vital signs. It was trained on normal readings only and then tested on 6 kinds of planted typos it had never seen.',
      project: 'When a nurse records vitals, the chart shows "accepted" or "flagged", and flagged entries appear under Dashboard, Data-entry alerts. One limit: a typo that lands on a value that is still realistic, like a BP of 212 on a ward with stroke patients, can get through. That is why simple range rules run alongside it. Try the real check below.' },
  ],

  bga: [
    { tag: 'The problem', title: 'Search stores every note as numbers', action: 'reset|cam:wide',
      text: 'To search by meaning, every chunk of a note is turned into 384 numbers, called an embedding. The card at the top is one chunk of Kamala\'s notes. With thousands of chunks, that is a lot of memory, and every search has to compare all of them.' },
    { tag: 'The insight', title: 'Not every number carries meaning', action: 'reset|cam:board',
      text: 'This board is that chunk shrunk to 64 numbers so it fits on screen. The glass pillars show how much meaning each number really carries. Many are almost empty. They mostly add noise and use memory.' },
    { tag: 'The chromosome', title: 'A mask: keep or drop each number', action: 'reset|cam:wide',
      text: 'Each gene is a switch: 1 keeps that number, 0 drops it. The whole chromosome is a mask over all the numbers. Raised tiles are kept. Green means kept and useful. Amber means kept but useless.' },
    { tag: 'The population', title: '24 masks compete', action: 'reset|cam:stack',
      text: 'The stack on the left is the whole population, with the best mask on top. A mask scores well if it keeps the meaningful numbers and drops the rest.' },
    { tag: 'Evolution', title: 'Coin flips and bit flips', action: 'cam:wide|play:normal',
      text: 'Two good masks make a child by flipping a coin for every tile. A few tiles then switch at random. Watch the amber tiles disappear and the green ones line up with the tall pillars.',
      look: 'the stack turning into clean green columns.' },
    { tag: 'Experiment', title: 'Turn mutation off', action: 'cam:wide|preset:Mutation off',
      text: 'Without mutation, once every mask has dropped a useful number, nothing can switch it back on. The population gets stuck before it finds all the meaningful numbers. Watch the diversity number fall.' },
    { tag: 'In NeuroSwarm', title: '384 numbers down to about 140', action: 'cam:wide|preset:Balanced',
      text: 'The real Binary GA kept about 140 of the 384 numbers. Every stored vector became about 63% smaller and searches got faster. Search quality stayed about the same, within the noise of a small test set.',
      project: 'The mask is applied inside the vector store to every note and every question. Staff & System shows "142 of 384".' },
  ],

  aco: [
    { tag: 'The problem', title: 'Where should the search look first?', action: 'reset|cam:wide',
      text: 'Each patient\'s notes are split into sections: plan, labs, symptoms, assessment and so on, across several note types. That makes 30 sections. Searching all of them for every question wastes time.' },
    { tag: 'The colony', title: 'Anthills and paper piles', action: 'reset|cam:wide',
      text: 'Each anthill is a type of question: medication, lab, symptom or diagnosis. Each pile of paper is one section of the notes. A bigger pile has more text to scan. A coloured dot above a pile means that question type\'s answer is really there.' },
    { tag: 'Exploring', title: 'At first the ants guess', action: 'reset|cam:hills|play:slow',
      text: 'Each ant is one practice question. It picks two sections to check. There are no trails yet, so the choices are almost random.',
      look: 'the coloured dot on each ant\'s back shows which anthill it came from.' },
    { tag: 'Pheromone', title: 'Success leaves a trail', action: 'cam:wide|play:slow',
      text: 'Ants that find the answer carry it home in gold and leave pheromone on their path. They leave more if they found it quickly. Later ants prefer the stronger trails.' },
    { tag: 'Evaporation', title: 'Old trails fade', action: 'cam:top|play:slow',
      text: 'After every round, all trails fade a little. Only paths that keep working stay bright. This is how the colony forgets old habits when things change.' },
    { tag: 'Learned', title: 'Each question finds its section', action: 'cam:wide|play:normal',
      text: 'After a few dozen rounds, medication questions go straight to the plan sections and lab questions to the results sections, and only a small part of the notes is scanned.',
      look: 'the route table: all ticks green.' },
    { tag: 'Experiment', title: 'Ants that ignore the trails', action: 'cam:wide|preset:α = 0',
      text: 'With alpha set to 0, ants ignore pheromone completely. Trails still get laid, but no ant follows them, so the colony never learns.' },
    { tag: 'In NeuroSwarm', title: 'Searching 5 of 30 sections', action: 'cam:wide|preset:Balanced',
      text: 'The real colony learned routes for 9 question types over 30 sections. A typical search now scans about 82% fewer chunks. If the routed search looks weak, NeuroSwarm falls back to a full scan, so a miss costs a little time and never gives a wrong answer.',
      project: 'Every answer in the patient chart assistant shows an "ACO" badge with the sections it searched. Try a live question below.' },
  ],
};
