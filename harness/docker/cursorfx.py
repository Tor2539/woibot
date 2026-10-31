#!/usr/bin/env python3
"""
cursorfx — visible cursor feedback for the Woibot computer-use layer.

Creates a mapped override-redirect marker window (blue core + white rim,
Codex-style) at a screen point, optionally easing the real pointer toward it
first. Mapped sub-windows are composited by the X server, so the marker shows
up BOTH in live screenshots (`import -window root`) and in VNC sessions.
(Root-window drawing is unreliable in this environment; a window is not.)

Usage: cursorfx.py X Y [move|click|scroll|type|key]
Self-terminating, cosmetic only: always exits 0 so automation never blocks.
"""
import sys
import time

SIZE = 44          # marker window size in px
DURATION = 1.4     # seconds the marker stays visible
EASE_STEPS = 10    # pointer easing steps


def ease_pointer(d, root, tx, ty):
    try:
        pos = root.query_pointer()
        cx, cy = pos.root_x, pos.root_y
        for i in range(1, EASE_STEPS + 1):
            t = i / EASE_STEPS
            nx = int(cx + (tx - cx) * t)
            ny = int(cy + (ty - cy) * t)
            root.warp_pointer(nx, ny)
            d.sync()
            time.sleep(0.014)
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
    scr = d.screen()
    root = scr.root

    # Smoothly glide the real pointer to the target (visible live in VNC).
    if mode in ("click", "move", "scroll"):
        ease_pointer(d, root, x, y)

    # Marker color by mode: blue for pointer actions, green for keyboard.
    color = 0x2B66E0 if mode in ("click", "move", "scroll") else 0x1FA35C
    half = SIZE // 2

    win = None
    try:
        win = root.create_window(
            x - half, y - half, SIZE, SIZE, 4,
            scr.root_depth, X.InputOutput, X.CopyFromParent,
            override_redirect=True,
            background_pixel=color,
            border_pixel=0xFFFFFF,
            event_mask=0,
        )
        win.map()
        d.sync()
        time.sleep(DURATION)
    except Exception:
        pass
    finally:
        try:
            if win is not None:
                win.unmap()
                win.destroy()
                d.sync()
        except Exception:
            pass
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)