# Frequently Asked Questions (FAQ)

<details>
<summary><b>1. Is OpenClaw free to use?</b></summary>
<br>
Yes, the OpenClaw framework itself is 100% free and open-source (MIT License). Costs will only incur if you connect to paid AI providers (like OpenAI GPT-4o or Anthropic Claude). To run it completely free, we recommend using the integrated **9Router**, **Google Gemini** (Free tier), or running **Ollama** locally.
</details>

<details>
<summary><b>2. What is 9Router and why is it recommended?</b></summary>
<br>
9Router is an open-source AI proxy. Instead of managing complex API keys from multiple platforms, 9Router allows you to authenticate once via OAuth. It automatically routes your bot's prompts to the best available free AI models. It works seamlessly out of the box in both Native and Docker deployment modes.
</details>

<details>
<summary><b>3. When SHOULD and SHOULD NOT I use Docker?</b></summary>
<br>

*   **RECOMMENDED to use Docker (Windows/macOS):** Provides perfect isolation and avoids dependency conflicts. Ideal if you aren't familiar with terminal usage and want a pre-packaged environment easily managed via Docker Desktop.
*   **NOT RECOMMENDED to use Docker (Ubuntu/VPS):** If you are deploying on a cheap VPS (e.g. 1GB-2GB RAM) or a personal Ubuntu machine, installing natively (Native mode) managed by `PM2` is the superior method. Native mode saves up to 15% RAM that would otherwise be eaten up by virtualization overhead. OpenClaw is inherently secure, so adding Docker overhead on small servers is unnecessary.

</details>

<details>
<summary><b>4. My bot is unresponsive, what should I do?</b></summary>
<br>
Troubleshooting depends on your deployment mode:

**If running Docker Mode:**
1. Open your Terminal/PowerShell in your bot's setup folder.
2. Check container status: `docker compose ps`
3. Check error logs: `docker compose logs -f`
4. Soft restart the bot: `docker compose restart`

**If running Native Mode (via PM2):**
1. Check process status: `pm2 status`
2. View error logs: `pm2 logs openclaw-bot`
3. Restart process: `pm2 restart openclaw-bot`

*Tip: If you're using 9Router, ensure it's successfully running and authenticated at http://localhost:20128/dashboard.*
</details>

<details>
<summary><b>5. Does the bot stay online 24/7?</b></summary>
<br>
Both guided setups are configured for resilient automation:
*   **With Docker:** Uses the `restart: unless-stopped` directive. The bot resurrects automatically on system reboots or crashes.
*   **With Native (PM2):** The generated CLI command runs `pm2 save` automatically to lock your context into the Linux daemon. (Don't forget to execute `pm2 startup` if prompted by the CLI).
*Note: If you run it on your personal laptop, shutting down the OS turns off the bot. Install it on a VPS for true 24/7 uptime.*
</details>

<details>
<summary><b>6. How can I change my AI Model after the initial setup?</b></summary>
<br>
Simply re-run the command `npx create-openclaw-bot` inside your existing bot directory. The wizard will walk you through the options again and safely overwrite your gateway configuration file without deleting your bot's history or local skills.
</details>

<details>
<summary><b>7. Docker setup throws a missing plugin error, how to fix?</b></summary>
<br>
If you are on Linux (Ubuntu/Debian) and receive an error mentioning `unknown shorthand flag`, your server is running the legacy Docker V1 engine. OpenClaw requires Docker Compose V2.
Fix this by running the package manager command: `sudo apt-get install docker-compose-plugin`
</details>
