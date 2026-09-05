"""
Command line entry point for the bio-inspired subsystem.

    python -m app.bio.cli train        evolve all five optimizers and persist them
    python -m app.bio.cli status       show what is currently trained and active
    python -m app.bio.cli report       print the last training report
"""
from __future__ import annotations

import argparse
import json
import logging
import sys


def _bootstrap():
    from app.db.session import SessionLocal
    from app.models.note import ClinicalNote
    from app.models.patient import Patient
    from app.services.vector_store import vector_store

    db = SessionLocal()
    for p in db.query(Patient).all():
        notes = db.query(ClinicalNote).filter(ClinicalNote.patient_id == p.id).all()
        vector_store.index_patient_notes(p.id, notes)
    return db


def _fmt(title: str, block: dict) -> str:
    if "error" in block:
        return f"  {title:<26} SKIPPED — {block['error']}"
    base = block.get("baseline") or {}
    opt = block.get("optimized") or {}
    imp = block.get("improvement_pct") or block.get("improvement") or {}
    lines = [f"  {title:<26} ({block.get('seconds', 0)}s)"]

    # Single-model blocks (the immune system) report one metric set, not a
    # baseline/optimized pair.
    if not base and not opt and block.get("metrics"):
        for k, v in block["metrics"].items():
            lines.append(f"      {k:<24} {v:>10}")
        return chr(10).join(lines)

    for key in sorted(set(list(base.keys()) + list(opt.keys()))):
        b, o = base.get(key), opt.get(key)
        if isinstance(b, (int, float)) and isinstance(o, (int, float)) and b != o:
            lines.append(f"      {key:<24} {b:>10} -> {o:<10}")
    for k, v in imp.items():
        lines.append(f"      {k:<24} {v:+}" + ("%" if "pct" in k else ""))
    return "\n".join(lines)


def main(argv=None) -> int:
    logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser(prog="neuroswarm-bio")
    parser.add_argument("command", choices=["train", "status", "report"])
    parser.add_argument("--generations", type=int, default=40)
    parser.add_argument("--optimizer", default="ga", choices=["ga", "pso"])
    parser.add_argument("--no-compare", action="store_true",
                        help="skip the GA-vs-PSO head-to-head")
    args = parser.parse_args(argv)

    from app.core.preflight import check as preflight_check
    preflight_check()

    from app.bio.registry import bio_registry

    if args.command == "status":
        bio_registry.load_all()
        print(json.dumps(bio_registry.status(), indent=2))
        return 0

    if args.command == "report":
        bio_registry.load_all()
        print(json.dumps(bio_registry.report, indent=2))
        return 0

    from app.bio.trainer import train_all

    print("Loading vector indices...")
    db = _bootstrap()
    try:
        print(f"Evolving optimizers ({args.generations} generations)...\n")
        report = train_all(
            db,
            ranking_optimizer=args.optimizer,
            generations=args.generations,
            compare_optimizers=not args.no_compare,
        )
    finally:
        db.close()

    print("\n" + "=" * 74)
    print("  NeuroSwarm — bio-inspired training report")
    print("=" * 74)
    print(_fmt("1. Retrieval ranking", report.get("ranking", {})))
    if "selected" in report.get("ranking", {}):
        print(f"      winner                   {report['ranking']['selected']}")
    print(_fmt("2. Task prioritization", report.get("tasks", {})))
    print(_fmt("3. Immune anomaly detection", report.get("immune", {})))
    print(_fmt("4. Embedding compression", report.get("compression", {})))
    print(_fmt("5. Ant colony routing", report.get("routing", {})))
    print("=" * 74)
    return 0


if __name__ == "__main__":
    sys.exit(main())
