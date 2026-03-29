FROM node:22-slim

RUN apt-get update && apt-get install -y git curl socat && rm -rf /var/lib/apt/lists/*

RUN npm install -g openclaw@latest

# Browser Automation: Playwright engine (needed for native CDP)
RUN npm install -g agent-browser playwright && npx playwright install chromium --with-deps && ln -f -s /root/.cache/ms-playwright/chromium-*/chrome-linux*/chrome /usr/bin/google-chrome

WORKDIR /root/.openclaw

EXPOSE 18791

CMD sh -c "node -e \"const fs=require('fs'),p='/root/.openclaw/openclaw.json';if(fs.existsSync(p)){const c=JSON.parse(fs.readFileSync(p,'utf8'));c.tools=Object.assign({},c.tools,{profile:'full'});c.gateway=Object.assign({},c.gateway,{port:18791,bind:'0.0.0.0'});fs.writeFileSync(p,JSON.stringify(c,null,2));}\" && socat TCP-LISTEN:9222,fork,reuseaddr TCP:host.docker.internal:9222 & openclaw gateway run"