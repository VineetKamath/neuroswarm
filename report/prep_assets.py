"""Normalize the extracted logos and dump the exact training metrics for the report."""
import json
import pathlib

from PIL import Image

HERE = pathlib.Path(__file__).parent
A = HERE / "assets"


def autocrop(path, out, pad=4):
    im = Image.open(path).convert("RGBA")
    # Treat near-white as background and crop to the actual mark.
    rgb = im.convert("RGB")
    bg = Image.new("RGB", rgb.size, (255, 255, 255))
    from PIL import ImageChops
    diff = ImageChops.difference(rgb, bg).convert("L").point(lambda p: 255 if p > 18 else 0)
    box = diff.getbbox()
    if box:
        box = (max(0, box[0] - pad), max(0, box[1] - pad),
               min(im.width, box[2] + pad), min(im.height, box[3] + pad))
        im = im.crop(box)
    im.save(out)
    print(f"{out.name}: {im.width}x{im.height}")


autocrop(A / "page1_img0_266x188.png", A / "vtu_logo.png")
autocrop(A / "page1_img1_441x174.png", A / "bmsce_logo.png")

# ---- exact metrics straight from the trained artifacts ---------------------
rep = json.load(open(HERE.parent / "backend" / "data" / "bio" / "training_report.json"))
comp_art = json.load(open(HERE.parent / "backend" / "data" / "bio" / "compression.json"))
rank_art = json.load(open(HERE.parent / "backend" / "data" / "bio" / "ranking.json"))
task_art = json.load(open(HERE.parent / "backend" / "data" / "bio" / "task_policy.json"))
imm_art = json.load(open(HERE.parent / "backend" / "data" / "bio" / "immune.json"))
rout_art = json.load(open(HERE.parent / "backend" / "data" / "bio" / "routing.json"))

metrics = {
    "trained_at": rep["trained_at"],
    "ranking_cases": rep.get("ranking_cases"),
    "ranking_split": rep.get("ranking_split"),
    "task_scenarios": rep.get("task_scenarios"),
    "task_split": rep.get("task_split"),
    "compression_split": rep.get("compression_split"),
    "routing_cases": rep.get("routing_cases"),
    "ranking": rep["ranking"],
    "tasks": rep["tasks"],
    "immune": rep["immune"],
    "compression": rep["compression"],
    "routing": rep["routing"],
    "ranking_weights": rank_art["weights"],
    "ranking_selected": rank_art["selected"],
    "ga_fitness": rank_art["comparison"]["ga"]["best_fitness"],
    "pso_fitness": rank_art["comparison"]["pso"]["best_fitness"],
    "task_policy": task_art["policy"],
    "immune_detail": {k: imm_art.get(k) for k in
                      ("train_self_count", "test_normal_count", "test_anomalous_count", "error_types")},
    "compression_improvement": comp_art["improvement"],
    "routing_config": rout_art["router"]["config"],
    "ga_history_len": len(rank_art["comparison"]["ga"]["history"]),
}
(HERE / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
print("\nmetrics.json written")
print(json.dumps({k: metrics[k] for k in
                  ("ranking", "tasks", "immune", "compression", "routing")}, indent=1)[:1800])
