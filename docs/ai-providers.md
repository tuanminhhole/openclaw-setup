# AI Provider Configuration Guide

This guide covers all supported AI providers in OpenClaw. Use it to choose the right provider based on your budget, technical requirements, and privacy needs.

---

## 📊 Provider Comparison

| Provider | Cost | API Key Required | Privacy | Best For |
| --- | --- | --- | --- | --- |
| **9Router** | 🆓 Free | ❌ OAuth login | Cloud | Beginners. Zero config. Auto-routing. |
| **Google Gemini** | 🆓 Free tier | ✅ Yes | Cloud | High quality. Generous free limits. |
| **Anthropic Claude** | 💰 Paid | ✅ Yes | Cloud | Best reasoning & writing quality. |
| **OpenAI / Codex** | 💰 Paid | ✅ Yes | Cloud | Code generation. Broad ecosystem. |
| **OpenRouter** | 🆓/💰 Mixed | ✅ Yes | Cloud | Access multiple providers with one key. |
| **Ollama (Local)** | 🏠 Free | ❌ No key | **Local** | Maximum privacy. Offline capable. |

---

## 🔀 9Router — Recommended for Beginners

9Router is an **open-source AI proxy** that runs on your machine and automatically routes AI requests to the best available free model. Instead of managing API keys, you log in once via OAuth.

**Why choose 9Router:**
- No API key required — authenticate once via OAuth (GitHub, Google, etc.)
- Auto-routes to free models (iFlow, Qwen, Gemini) with smart fallback
- Supports 40+ providers and 100+ models
- Works on **all platforms: Windows, macOS, Linux, VPS**
- Free forever — open source

**Option A — Native install (works on all OS including Windows):**
```bash
npm install -g 9router
9router
```
The 9Router dashboard opens at `http://localhost:20128`. Log in and connect a free provider.

**Option B — Docker sidecar (automatic when using OpenClaw Docker mode):**
When you select 9Router in the Setup Wizard and choose Docker mode, the generated `docker-compose.yml` automatically includes 9Router as a sidecar container. No separate installation needed.

**Using 9Router with OpenClaw:**
Whether you installed 9Router natively or via Docker, configure OpenClaw to use it:
- API endpoint: `http://localhost:20128/v1`
- API key: copy from the 9Router dashboard
- Model: select any model showing as available in the dashboard

> [!TIP]
> Start with the free combo: Gemini CLI (180K free/month) + iFlow models (unlimited free) = $0/month cost.

---

## 🧠 Google Gemini

Google Gemini offers the most generous free tier available, making it the best API-key-based option for personal bots.

**Available models:** Gemini 2.5 Flash, Gemini 2.5 Pro, Gemini 3.0 Flash

**How to get your API key:**
1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click **Create API Key**
4. Copy the key into the Setup Wizard when prompted

**Free tier limits:** ~15 requests/min, ~1 million tokens/day (as of 2025). Sufficient for personal use.

---

## 🤖 Anthropic Claude

Claude is considered the top-performing model for complex reasoning, long-form content, and instruction-following.

**Available models:** Claude Sonnet 4, Claude Opus 4, Claude Haiku 3.5

**How to get your API key:**
1. Go to [Anthropic Console](https://console.anthropic.com/settings/keys)
2. Create an account and add billing information
3. Generate an API key and paste it into the Setup Wizard

> [!WARNING]  
> Anthropic Claude requires a paid account to obtain an API key. There is no permanent free tier.

---

## 🤖 OpenAI / Codex

Best choice if you need GPT-4o for broad tasks or Codex Mini for code-heavy workflows.

**Available models:** GPT-4o, GPT-4o Mini, o3, Codex Mini

**How to get your API key:**
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create an account and add a payment method (minimum $5 credit)
3. Create an API key and paste it into the Setup Wizard

---

## 🌐 OpenRouter

OpenRouter aggregates hundreds of models (including free ones) under a single API key. Useful if you want to switch between providers without re-running the Setup Wizard.

**How to get your API key:**
1. Go to [OpenRouter.ai](https://openrouter.ai/keys)
2. Create an account (free)
3. Generate an API key. Some models on OpenRouter have free usage limits.
4. Paste the key into the Setup Wizard

> [!TIP]
> OpenRouter includes access to free versions of many open-source models. Check the model list filtered by `Price: Free` on their website.

---

## 🏠 Ollama — Local AI (No API Key)

Ollama runs AI models directly on your machine or server. No data leaves your infrastructure. Ideal for privacy-sensitive deployments.

**Supported local models:** Gemma 4, Llama 3, Qwen 2.5, Phi-3, Mistral, and more.

### Docker Mode (Recommended)
If you run OpenClaw with Docker and select Ollama, the Setup Wizard automatically:
- Adds an `ollama` sidecar service to your `docker-compose.yml`
- Configures the internal URL as `http://ollama:11434`
- Sets `OLLAMA_KEEP_ALIVE=24h` to keep the model in memory
- Pulls your chosen model on first `docker compose up`

You do **not** need to install Ollama separately.

### Native Mode
If running without Docker, you must install Ollama manually:
1. Go to [ollama.com](https://ollama.com) and download the installer for your OS
2. After installation, pull your desired model:
   ```bash
   ollama pull gemma4
   ```
3. Ensure Ollama is running before starting the bot. OpenClaw will connect to `http://localhost:11434`.

### Choosing a Gemma 4 Variant
See the [Hardware & RAM Guide](hardware-guide.md) for detailed recommendations.

| Model | Min RAM | Recommended Use |
| --- | --- | --- |
| `gemma4:e2b` | 4 GB | Very lightweight. Budget VPS. |
| `gemma4:e4b` | 8 GB | Standard laptops and basic VPS. |
| `gemma4` (Base) | 16 GB | Recommended. Good quality output. |
| `gemma4:26b` | 32 GB+ | High-end workstations with GPU. |
