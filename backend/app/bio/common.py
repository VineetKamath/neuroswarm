"""Shared primitives for the bio-inspired optimizers."""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Sequence, Tuple

import numpy as np


def make_rng(seed: int) -> random.Random:
    return random.Random(seed)


def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return lo if x < lo else hi if x > hi else x


def scale(gene: float, lo: float, hi: float) -> float:
    """Map a [0,1] gene onto a real parameter range."""
    return lo + clamp(gene) * (hi - lo)


# --------------------------------------------------------------------------
# Ranking quality metrics
# --------------------------------------------------------------------------
def dcg(relevances: Sequence[float]) -> float:
    return sum(rel / math.log2(i + 2) for i, rel in enumerate(relevances))


def ndcg_at_k(ranked_relevance: Sequence[float], k: int) -> float:
    """Normalized Discounted Cumulative Gain, rewards putting the truly
    relevant items *near the top*, not merely somewhere in the list."""
    top = list(ranked_relevance[:k])
    ideal = sorted(ranked_relevance, reverse=True)[:k]
    idcg = dcg(ideal)
    if idcg <= 0:
        return 0.0
    return dcg(top) / idcg


def recall_at_k(ranked_relevance: Sequence[float], k: int, total_relevant: int) -> float:
    if total_relevant <= 0:
        return 0.0
    hit = sum(1 for r in ranked_relevance[:k] if r > 0)
    return min(1.0, hit / total_relevant)


def reciprocal_rank(ranked_relevance: Sequence[float]) -> float:
    """Reciprocal rank of the first relevant item (1.0 = top hit)."""
    for i, r in enumerate(ranked_relevance):
        if r > 0:
            return 1.0 / (i + 1)
    return 0.0


def kendall_tau(order_a: Sequence, order_b: Sequence) -> float:
    """Rank correlation in [-1, 1] between two orderings of the same items."""
    n = len(order_a)
    if n < 2:
        return 1.0
    pos_b = {item: i for i, item in enumerate(order_b)}
    concordant = discordant = 0
    for i in range(n):
        for j in range(i + 1, n):
            a_i, a_j = order_a[i], order_a[j]
            if a_i not in pos_b or a_j not in pos_b:
                continue
            if pos_b[a_i] < pos_b[a_j]:
                concordant += 1
            else:
                discordant += 1
    total = concordant + discordant
    return (concordant - discordant) / total if total else 1.0


# --------------------------------------------------------------------------
# Convergence bookkeeping (drives the live visualization page)
# --------------------------------------------------------------------------
@dataclass
class GenerationRecord:
    generation: int
    best_fitness: float
    mean_fitness: float
    worst_fitness: float
    diversity: float
    best_genome: List[float] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return {
            "generation": self.generation,
            "best_fitness": round(self.best_fitness, 6),
            "mean_fitness": round(self.mean_fitness, 6),
            "worst_fitness": round(self.worst_fitness, 6),
            "diversity": round(self.diversity, 6),
        }


def population_diversity(population: Sequence[Sequence[float]]) -> float:
    """Mean per-gene spread, collapses toward 0 as the run converges."""
    arr = np.asarray(population, dtype=float)
    if arr.shape[0] < 2:
        return 0.0
    return float(np.mean(np.std(arr, axis=0)))


# --------------------------------------------------------------------------
# Real-valued Genetic Algorithm
# --------------------------------------------------------------------------
@dataclass
class GAConfig:
    genome_length: int
    population_size: int = 60
    generations: int = 40
    crossover_rate: float = 0.85
    mutation_rate: float = 0.15
    mutation_sigma: float = 0.18
    elitism: int = 2
    tournament_size: int = 3
    seed: int = 42


class GeneticAlgorithm:
    """Elitist GA with tournament selection, blend crossover (BLX-alpha) and
    Gaussian creep mutation over genes constrained to [0, 1]."""

    def __init__(self, config: GAConfig, fitness_fn: Callable[[List[float]], float]):
        self.cfg = config
        self.fitness_fn = fitness_fn
        self.rng = make_rng(config.seed)
        self.history: List[GenerationRecord] = []
        self.best_genome: List[float] = []
        self.best_fitness: float = -math.inf

    def _random_genome(self) -> List[float]:
        return [self.rng.random() for _ in range(self.cfg.genome_length)]

    def _tournament(self, pop: List[List[float]], fits: List[float]) -> List[float]:
        idxs = [self.rng.randrange(len(pop)) for _ in range(self.cfg.tournament_size)]
        best = max(idxs, key=lambda i: fits[i])
        return list(pop[best])

    def _crossover(self, a: List[float], b: List[float]) -> Tuple[List[float], List[float]]:
        if self.rng.random() > self.cfg.crossover_rate:
            return list(a), list(b)
        alpha = 0.5
        c1, c2 = [], []
        for x, y in zip(a, b):
            lo, hi = min(x, y), max(x, y)
            span = (hi - lo) * alpha
            c1.append(clamp(self.rng.uniform(lo - span, hi + span)))
            c2.append(clamp(self.rng.uniform(lo - span, hi + span)))
        return c1, c2

    def _mutate(self, genome: List[float]) -> List[float]:
        out = []
        for g in genome:
            if self.rng.random() < self.cfg.mutation_rate:
                g = clamp(g + self.rng.gauss(0.0, self.cfg.mutation_sigma))
            out.append(g)
        return out

    def run(self) -> Tuple[List[float], float]:
        pop = [self._random_genome() for _ in range(self.cfg.population_size)]

        for gen in range(self.cfg.generations):
            fits = [self.fitness_fn(ind) for ind in pop]
            order = sorted(range(len(pop)), key=lambda i: fits[i], reverse=True)

            if fits[order[0]] > self.best_fitness:
                self.best_fitness = fits[order[0]]
                self.best_genome = list(pop[order[0]])

            self.history.append(GenerationRecord(
                generation=gen,
                best_fitness=fits[order[0]],
                mean_fitness=float(np.mean(fits)),
                worst_fitness=fits[order[-1]],
                diversity=population_diversity(pop),
                best_genome=list(pop[order[0]]),
            ))

            # Elitism: carry the strongest genomes forward untouched.
            next_pop = [list(pop[i]) for i in order[: self.cfg.elitism]]
            while len(next_pop) < self.cfg.population_size:
                p1 = self._tournament(pop, fits)
                p2 = self._tournament(pop, fits)
                c1, c2 = self._crossover(p1, p2)
                next_pop.append(self._mutate(c1))
                if len(next_pop) < self.cfg.population_size:
                    next_pop.append(self._mutate(c2))
            pop = next_pop

        return self.best_genome, self.best_fitness


# --------------------------------------------------------------------------
# Binary Genetic Algorithm (feature / dimension subset selection)
# --------------------------------------------------------------------------
@dataclass
class BinaryGAConfig:
    genome_length: int
    population_size: int = 40
    generations: int = 30
    crossover_rate: float = 0.8
    mutation_rate: float = 0.02   # per-bit flip probability
    elitism: int = 2
    tournament_size: int = 3
    init_density: float = 0.35    # fraction of bits initially set
    seed: int = 42


class BinaryGeneticAlgorithm:
    """GA over bit-strings, used to evolve which embedding dimensions survive."""

    def __init__(self, config: BinaryGAConfig, fitness_fn: Callable[[np.ndarray], float]):
        self.cfg = config
        self.fitness_fn = fitness_fn
        self.rng = make_rng(config.seed)
        self.history: List[GenerationRecord] = []
        self.best_genome: np.ndarray = np.zeros(config.genome_length, dtype=bool)
        self.best_fitness: float = -math.inf

    def _random_genome(self) -> np.ndarray:
        return np.array(
            [self.rng.random() < self.cfg.init_density for _ in range(self.cfg.genome_length)],
            dtype=bool,
        )

    def _tournament(self, pop, fits) -> np.ndarray:
        idxs = [self.rng.randrange(len(pop)) for _ in range(self.cfg.tournament_size)]
        return pop[max(idxs, key=lambda i: fits[i])].copy()

    def _crossover(self, a: np.ndarray, b: np.ndarray):
        if self.rng.random() > self.cfg.crossover_rate:
            return a.copy(), b.copy()
        # Uniform crossover mixes dimensions freely rather than in contiguous blocks.
        mask = np.array([self.rng.random() < 0.5 for _ in range(len(a))], dtype=bool)
        c1 = np.where(mask, a, b)
        c2 = np.where(mask, b, a)
        return c1, c2

    def _mutate(self, g: np.ndarray) -> np.ndarray:
        flips = np.array([self.rng.random() < self.cfg.mutation_rate for _ in range(len(g))], dtype=bool)
        out = np.logical_xor(g, flips)
        if not out.any():          # never allow an empty subspace
            out[self.rng.randrange(len(out))] = True
        return out

    def run(self) -> Tuple[np.ndarray, float]:
        pop = [self._random_genome() for _ in range(self.cfg.population_size)]

        for gen in range(self.cfg.generations):
            fits = [self.fitness_fn(ind) for ind in pop]
            order = sorted(range(len(pop)), key=lambda i: fits[i], reverse=True)

            if fits[order[0]] > self.best_fitness:
                self.best_fitness = fits[order[0]]
                self.best_genome = pop[order[0]].copy()

            self.history.append(GenerationRecord(
                generation=gen,
                best_fitness=fits[order[0]],
                mean_fitness=float(np.mean(fits)),
                worst_fitness=fits[order[-1]],
                diversity=population_diversity([p.astype(float) for p in pop]),
            ))

            next_pop = [pop[i].copy() for i in order[: self.cfg.elitism]]
            while len(next_pop) < self.cfg.population_size:
                c1, c2 = self._crossover(self._tournament(pop, fits), self._tournament(pop, fits))
                next_pop.append(self._mutate(c1))
                if len(next_pop) < self.cfg.population_size:
                    next_pop.append(self._mutate(c2))
            pop = next_pop

        return self.best_genome, self.best_fitness


# --------------------------------------------------------------------------
# Particle Swarm Optimization
# --------------------------------------------------------------------------
@dataclass
class PSOConfig:
    genome_length: int
    swarm_size: int = 40
    iterations: int = 40
    inertia_start: float = 0.9
    inertia_end: float = 0.4
    cognitive: float = 1.5   # pull toward the particle's own best
    social: float = 1.5      # pull toward the swarm's best
    v_max: float = 0.25
    seed: int = 42


class ParticleSwarm:
    """Canonical gbest PSO with linearly-decaying inertia, so the swarm
    explores broadly early and exploits tightly near the end."""

    def __init__(self, config: PSOConfig, fitness_fn: Callable[[List[float]], float]):
        self.cfg = config
        self.fitness_fn = fitness_fn
        self.rng = make_rng(config.seed)
        self.history: List[GenerationRecord] = []
        self.best_genome: List[float] = []
        self.best_fitness: float = -math.inf
        self.swarm_trace: List[List[List[float]]] = []

    def run(self, trace_dims: int = 2, trace_every: int = 1) -> Tuple[List[float], float]:
        n, d = self.cfg.swarm_size, self.cfg.genome_length
        pos = [[self.rng.random() for _ in range(d)] for _ in range(n)]
        vel = [[self.rng.uniform(-0.1, 0.1) for _ in range(d)] for _ in range(n)]
        p_best = [list(p) for p in pos]
        p_best_fit = [self.fitness_fn(p) for p in pos]

        g_idx = max(range(n), key=lambda i: p_best_fit[i])
        self.best_genome = list(p_best[g_idx])
        self.best_fitness = p_best_fit[g_idx]

        for it in range(self.cfg.iterations):
            frac = it / max(1, self.cfg.iterations - 1)
            w = self.cfg.inertia_start + (self.cfg.inertia_end - self.cfg.inertia_start) * frac

            for i in range(n):
                for j in range(d):
                    r1, r2 = self.rng.random(), self.rng.random()
                    vel[i][j] = (
                        w * vel[i][j]
                        + self.cfg.cognitive * r1 * (p_best[i][j] - pos[i][j])
                        + self.cfg.social * r2 * (self.best_genome[j] - pos[i][j])
                    )
                    vel[i][j] = max(-self.cfg.v_max, min(self.cfg.v_max, vel[i][j]))
                    pos[i][j] = clamp(pos[i][j] + vel[i][j])

                fit = self.fitness_fn(pos[i])
                if fit > p_best_fit[i]:
                    p_best_fit[i] = fit
                    p_best[i] = list(pos[i])
                if fit > self.best_fitness:
                    self.best_fitness = fit
                    self.best_genome = list(pos[i])

            self.history.append(GenerationRecord(
                generation=it,
                best_fitness=self.best_fitness,
                mean_fitness=float(np.mean(p_best_fit)),
                worst_fitness=float(np.min(p_best_fit)),
                diversity=population_diversity(pos),
                best_genome=list(self.best_genome),
            ))

            # Snapshot leading dimensions so the UI can animate the swarm.
            if it % trace_every == 0:
                self.swarm_trace.append(
                    [[round(p[j], 4) for j in range(min(trace_dims, d))] for p in pos]
                )

        return self.best_genome, self.best_fitness
