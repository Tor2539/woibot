FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY=:99

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl wget git jq unzip procps \
    python3 python3-pip \
    chromium xvfb x11vnc fluxbox novnc websockify supervisor x11-xserver-utils xdotool \
    xterm leafpad pcmanfm \
    ffmpeg libreoffice libreoffice-writer libreoffice-calc libreoffice-impress poppler-utils \
    tesseract-ocr tesseract-ocr-tha tesseract-ocr-eng imagemagick \
    python3-openpyxl python3-pandas python3-pip python3-xlib \
    fonts-noto-core fonts-noto-cjk fonts-thai-tlwg \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && npm i -g pnpm@9 opencode-ai \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 -s /bin/bash woibot \
    && mkdir -p /home/woibot/workspace /home/woibot/.config \
    && chown -R woibot:woibot /home/woibot

COPY supervisord.conf /etc/supervisor/conf.d/woibot.conf
COPY start.html /opt/start.html
COPY cursorfx.py /opt/cursorfx.py
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /home/woibot/workspace
EXPOSE 5900 6080 9222
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
