#!/bin/bash
mkdir -p /home/woibot/workspace
chown -R woibot:woibot /home/woibot 2>/dev/null || true
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf

