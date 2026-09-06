"""Extract the VTU and BMSCE logos from the reference DL report PDF."""
import pathlib
import pymupdf

SRC = pathlib.Path(r"C:\Users\vrkka\Downloads\DL Report (Except Snapshots).pdf")
OUT = pathlib.Path(__file__).parent / "assets"
OUT.mkdir(parents=True, exist_ok=True)

doc = pymupdf.open(SRC)
seen = {}

for pno in (0, 1):
    page = doc[pno]
    for i, info in enumerate(page.get_images(full=True)):
        xref = info[0]
        if xref in seen:
            continue
        pix = pymupdf.Pixmap(doc, xref)
        if pix.n - pix.alpha >= 4:                 # CMYK -> RGB
            pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
        name = f"page{pno + 1}_img{i}_{pix.width}x{pix.height}.png"
        pix.save(OUT / name)
        seen[xref] = name
        print(f"page {pno + 1}: {name}  ({pix.width}x{pix.height}, n={pix.n})")

print(f"\n{len(seen)} images extracted to {OUT}")
