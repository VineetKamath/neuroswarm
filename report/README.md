# Bio-Inspired Algorithms — Project Report

Regenerate the PDF after any retraining so the report always matches the artifacts:

```bash
backend/venv/Scripts/python.exe report/prep_assets.py     # logos + metrics.json from data/bio/
backend/venv/Scripts/python.exe report/build_report.py    # two-pass build -> PDF
```

`build_report.py` runs twice: the first pass records the real page of every chapter,
figure and table with zero-height `Marker` flowables; the second rebuilds with a
contents list computed from that layout rather than hand-estimated.

All figures are vector drawings in `flowcharts.py`. All result numbers are read from
`backend/data/bio/training_report.json` via `metrics.json` — no figure is typed by hand.

- `extract_logos.py` — pulls the VTU and BMSCE marks out of the reference PDF
- `prep_assets.py`   — crops the logos, snapshots the current training metrics
- `flowcharts.py`    — the nine vector diagrams
- `chapters.py`      — chapter text
- `build_report.py`  — front matter, page furniture, two-pass assembly
