FROM node:22-slim

RUN apt-get update && apt-get install -y git curl socat && rm -rf /var/lib/apt/lists/*

RUN npm install -g openclaw@latest

# Install skills (ClawHub) — one at a time
# RUN openclaw skills install scheduler (Temporarily disabled due to 429 Rate Limit)

# Browser Automation: Playwright engine (needed for native CDP)
RUN npm install -g agent-browser playwright && npx playwright install chromium --with-deps && ln -f -s /root/.cache/ms-playwright/chromium-*/chrome-linux*/chrome /usr/bin/google-chrome

WORKDIR /root/.openclaw

EXPOSE 18791

CMD sh -c "openclaw plugins install @openclaw/zalouser 2>/dev/null || true && socat TCP-LISTEN:9222,fork,reuseaddr TCP:host.docker.internal:9222 & openclaw gateway run"