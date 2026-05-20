# Datapilot 🚀

> **Built for the Google Cloud Rapid Agent Hackathon**

Datapilot is an AI-powered data pipeline monitoring agent. It watches your ETL pipelines, detects failures and anomalies, and automatically generates incident reports all powered by Gemini and Google Cloud Agent Builder with MongoDB as the data backbone.

---

## What It Does

- Monitors ETL pipeline run logs stored in MongoDB
- Uses Gemini to reason about failures and root causes
- Automatically generates incident reports when something breaks
- Provides a natural language interface to query pipeline health
- Goes beyond chat, it actually takes action

---

## Tech Stack

| Layer | Tool |
|---|---|
| Agent | Gemini 2.5 Flash + Google ADK |
| Database | MongoDB Atlas |
| Backend | Python (FastAPI) |
| Frontend | Next.js |
| Hosting | Vercel (frontend) + Railway (backend) |

---

## ⚠️ API Keys & Credentials - Read Before Running

This project requires several external services. **You must supply your own API keys and credentials.** I am not responsible for any charges incurred on your accounts.

Copy `.env.example` to `.env` and fill in your own values:

```bash
cp .env.example .env
```

### Required credentials:

| Variable | Where to get it |
|---|---|
| `GOOGLE_API_KEY` | [Google AI Studio](https://aistudio.google.com/) - use a personal Gmail account for free tier |
| `GOOGLE_CLOUD_PROJECT` | [Google Cloud Console](https://console.cloud.google.com/) |
| `MONGODB_URI` | [MongoDB Atlas](https://www.mongodb.com/atlas) - free M0 tier works |
| `GEMINI_MODEL` | Set to `gemini-2.5-flash` |

### How to stay on the free tier:

- **Google AI Studio** - sign up with a personal Gmail to get the free tier automatically
- **MongoDB** - use the M0 free cluster (512MB, no credit card required)
- **Vercel + Railway** - both have free tiers sufficient for a demo

> **Never commit your `.env` file to GitHub.** It is already listed in `.gitignore`. Double-check before pushing.

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- A MongoDB Atlas account (free)
- A Google AI Studio account (free tier)

### Backend

```bash
cd backend
pip install -r requirements.txt
cp ../.env.example ../.env   # fill in your keys
uvicorn main:app --reload
```

### Seed demo data

```bash
cd data
python seed.py
```

### Agent

```bash
pip install google-adk mcp
adk run agent
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Project Structure

```
datapilot/
├── .env.example
├── .gitignore
├── LICENSE
├── Procfile
├── README.md
├── requirements.txt
├── agent/
│   ├── agent.py
│   ├── agent.yaml
│   ├── tools.yaml
│   └── prompts/
│       └── system.txt
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── config.py
│   ├── db/
│   │   └── mongo.py
│   ├── routes/
│   │   ├── pipelines.py
│   │   └── reports.py
│   └── services/
│       ├── monitor.py
│       └── reporter.py
├── frontend/
│   └── src/
│       ├── app/
│       └── components/
├── data/
│   └── seed.py
└── docs/
    └── demo-script.md
```

---

## License

MIT License
