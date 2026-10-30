#!/bin/bash
set -e
mkdir -p /home/woibot/workspace /home/woibot/.config
chown -R woibot:woibot /home/woibot 2>/dev/null || true
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/woibot.conf
