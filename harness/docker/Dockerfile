FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY=:99
ENV WOIBOT_HOME=/home/woibot

RUN apt-get update && apt-get install -y \
    curl wget git python3 python3-pip ffmpeg libreoffice \
    chromium-browser xvfb x11vnc fluxbox novnc \
    nodejs npm supervisor \
    && rm -rf /var/lib/apt/lists/*

# Node 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs

# Playwright
RUN npx playwright install --with-deps chromium

# Workspace
RUN useradd -m -s /bin/bash woibot && mkdir -p $WOIBOT_HOME/workspace $WOIBOT_HOME/.config
WORKDIR $WOIBOT_HOME/workspace
RUN chown -R woibot:woibot $WOIBOT_HOME

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

EXPOSE 9222 5900 6080 3000
CMD ["/usr/local/bin/start.sh"]

