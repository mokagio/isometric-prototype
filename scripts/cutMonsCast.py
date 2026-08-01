"""Re-cut public/mons/mons.png into a clean grid: 4 frames across, 35 mons down.

The pack's own sheet is 7x5 mons repeated down the page once per animation
frame, on a grid that is 30 wide but 31.2 tall — not a whole number, so nothing
can index it by multiplication. The cell edges are recovered from the gaps
between content instead, and each mon is re-laid on its own cell, centred and
standing on a fixed baseline, so one anchor serves all 35.
"""
import subprocess, struct, zlib

SRC = "public/mons/mons.png"
DST = "public/mons/monsCast.png"
W, H = 210, 624
FRAMES, ROWS, COLS = 4, 5, 7
MONS = ROWS * COLS
BLOCK = H // FRAMES  # 156
CELL_W, CELL_H = 32, 32
BASELINE = 31  # feet line within the cell

raw = subprocess.run(
    ["magick", SRC, "-depth", "8", "rgba:-"], capture_output=True, check=True
).stdout
px = lambda x, y: tuple(raw[(y * W + x) * 4 : (y * W + x) * 4 + 4])
opaque = lambda x, y: raw[(y * W + x) * 4 + 3] > 0


def bands(hit, n):
    out, start = [], None
    for i in range(n):
        if hit(i):
            start = i if start is None else start
        elif start is not None:
            out.append((start, i - 1))
            start = None
    return out + ([(start, n - 1)] if start is not None else [])


def cells(bs, end):
    """Cell boundaries: the midpoint of each gap between content bands."""
    cuts = [0] + [(bs[i][1] + bs[i + 1][0] + 1) // 2 for i in range(len(bs) - 1)] + [end]
    return list(zip(cuts, cuts[1:]))


col_cells = cells(bands(lambda x: any(opaque(x, y) for y in range(H)), W), W)
# Rows are found inside one frame block; every block repeats the same layout.
row_cells = cells(bands(lambda y: any(opaque(x, y) for x in range(W)), BLOCK), BLOCK)
assert (len(col_cells), len(row_cells)) == (COLS, ROWS), (col_cells, row_cells)


def bbox(x0, x1, y0, y1):
    """Content box within a cell, in coordinates relative to (x0, y0)."""
    hits = [(x, y) for y in range(y0, y1) for x in range(x0, x1) if opaque(x, y)]
    xs = [x - x0 for x, _ in hits]
    ys = [y - y0 for _, y in hits]
    return min(xs), max(xs), min(ys), max(ys)


out = [[(0, 0, 0, 0)] * (CELL_W * FRAMES) for _ in range(CELL_H * MONS)]
widest = tallest = 0
for r, (ry0, ry1) in enumerate(row_cells):
    for c, (cx0, cx1) in enumerate(col_cells):
        mon = r * COLS + c
        # One box across all four frames, so the bob survives the re-cut: each
        # frame keeps its own place inside a box that does not move.
        boxes = [bbox(cx0, cx1, f * BLOCK + ry0, f * BLOCK + ry1) for f in range(FRAMES)]
        bx0, bx1 = min(b[0] for b in boxes), max(b[1] for b in boxes)
        by0, by1 = min(b[2] for b in boxes), max(b[3] for b in boxes)
        widest = max(widest, bx1 - bx0 + 1)
        tallest = max(tallest, by1 - by0 + 1)
        dx = CELL_W // 2 - (bx0 + bx1 + 1) // 2
        dy = BASELINE - by1
        for f in range(FRAMES):
            for y in range(ry1 - ry0):
                for x in range(cx1 - cx0):
                    p = px(cx0 + x, f * BLOCK + ry0 + y)
                    if p[3] == 0:
                        continue
                    out[mon * CELL_H + y + dy][f * CELL_W + x + dx] = p

print(f"widest {widest}, tallest {tallest} (cell {CELL_W}x{CELL_H}, baseline {BASELINE})")
assert widest <= CELL_W and tallest <= BASELINE + 1, "a mon does not fit its cell"

OW, OH = CELL_W * FRAMES, CELL_H * MONS
body = b"".join(b"\x00" + b"".join(struct.pack("4B", *p) for p in row) for row in out)
chunk = lambda tag, d: struct.pack(">I", len(d)) + tag + d + struct.pack(">I", zlib.crc32(tag + d))
open(DST, "wb").write(
    b"\x89PNG\r\n\x1a\n"
    + chunk(b"IHDR", struct.pack(">IIBBBBB", OW, OH, 8, 6, 0, 0, 0))
    + chunk(b"IDAT", zlib.compress(body, 9))
    + chunk(b"IEND", b"")
)
print(f"wrote {DST} {OW}x{OH}")
