#!/bin/bash
set -e
mkdir -p /home/woibot/workspace /home/woibot/.config
# a stale profile lock from a previous container makes chromium refuse to start
rm -f /home/woibot/.config/chromium/SingletonLock /home/woibot/.config/chromium/SingletonCookie /home/woibot/.config/chromium/SingletonSocket 2>/dev/null || true
chown -R woibot:woibot /home/woibot 2>/dev/null || true
xsetroot -solid '#1b1c22' 2>/dev/null || true
# a real arrow cursor instead of the default X cross, so pointer motion is visible in VNC
xsetroot -cursor_name left_ptr 2>/dev/null || true
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/woibot.conf
