"""
NeuroSwarm bio-inspired optimization subsystem.

Five nature-derived optimizers tune decision points inside the clinical
retrieval and care-coordination pipeline:

    ranking.py      Genetic Algorithm + Particle Swarm  -> retrieval re-ranking weights
    tasks.py        Genetic Algorithm                   -> care-task prioritization policy
    immune.py       Artificial Immune System            -> vitals anomaly / data-error detection
    compression.py  Genetic Algorithm (binary)          -> embedding dimension selection
    routing.py      Ant Colony Optimization             -> multi-source retrieval routing

Every optimizer is deterministic given a seed, trains against a labeled
benchmark, and records a full convergence history so the improvement can be
demonstrated rather than asserted.
"""
