#!/usr/bin/env python3
"""
cursorfx — visible cursor feedback for the Woibot computer-use layer.

Draws a blue target marker (white rim + blue dot, Codex-style) directly into
the X root framebuffer at a given point, optionally easing the real pointer
toward it first, then restores the exact pixels underneath. Because it writes
into the framebuffer itself, the flash is visible BOTH in live screenshots
(`import -window root`) and in VNC sessions.

Usage: cursorfx.py X Y [move|click|scroll|type|key]
Self-terminating, cosmetic only: always exits 0 so automation never blocks.
"""
import sys
import time

RING = 26          # outer radius in px
DURATION = 1.7     # seconds the marker stays visible (long enough for a refresh)
EASE_STEPS = 10    # pointer easing steps


def ease_pointer(d, root, tx, ty):
    try:
        from Xlib import X
        pos = root.query_pointer()
        cx, cy = pos.root_x, pos.root_y
        for i in range(1, EASE_STEPS + 1):
            t = i / EASE_STEPS
            nx = int(cx + (tx - cx) * t)
            ny = int(cy + (ty - cy) * t)
            root.warp_pointer(nx, ny)
            d.sync()
            time.sleep(0.016)
    except Exception:
        pass


def main():
    if len(sys.argv) < 3:
        return 0
    x = int(float(sys.argv[1]))
    y = int(float(sys.argv[2]))
    mode = sys.argv[3] if len(sys.argv) > 3 else "click"

    from Xlib import display, X

    d = display.Display()
    root = d.screen().root

    # Smoothly glide the real pointer to the target (visible live in VNC).
    if mode in ("click", "move", "scroll"):
        ease_pointer(d, root, x, y)

    bw = RING * 2 + 16
    bx, by = x - bw // 2, y - bw // 2

    # Save the exact pixels we are about to cover so we can restore them.
    try:
        saved = root.get_image(bx, by, bw, bw, X.ZPixmap, 0xFFFFFFFF)
    except Exception:
        return 0

    gc = root.create_gc()

    def disc(radius, color):
        gc.change(foreground=color)
        root.fill_arc(gc, bx + bw // 2 - radius, by + bw // 2 - radius, radius * 2, radius * 2, 0, 360 * 64)

    BLUE = 0x2B66E0
    BLUE_DARK = 0x1B4AB0
    WHITE = 0xFFFFFF

    # Target marker: white rim + solid blue core + darker center point.
    disc(RING, WHITE)
    disc(RING - 3, BLUE)
    disc(4, BLUE_DARK)

    d.sync()
    time.sleep(DURATION)

    # Restore the saved framebuffer region byte-for-byte.
    try:
        root.put_image(gc, bx, by, bw, bw, 0, 24, saved.data)
        d.sync()
    except Exception:
        pass
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)