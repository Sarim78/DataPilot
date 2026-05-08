# Datapilot 🚀

> **🏆 Built as a hackathon project**

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
| Agent | Gemini + Google Cloud Agent Builder |
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
| `GOOGLE_API_KEY` | [Google AI Studio](https://aistudio.google.com/) |
| `GOOGLE_CLOUD_PROJECT` | [Google Cloud Console](https://console.cloud.google.com/) |
| `MONGODB_URI` | [MongoDB Atlas](https://www.mongodb.com/atlas) - free M0 tier works |

### How to stay on the free tier:

- **Google Cloud** - new accounts get $300 in free credits. Set a billing alert at $5-$10 so you are never surprised
- **Gemini API** - use `gemini-1.5-flash` (free tier) not Pro or Ultra
- **MongoDB** - use the M0 free cluster (512MB, no credit card required)
- **Vercel + Railway** - both have free tiers sufficient for a demo

> **Never commit your `.env` file to GitHub.** It is already listed in `.gitignore`. Double-check before pushing.

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- A MongoDB Atlas account (free)
- A Google Cloud account (free $300 credits for new accounts)

### Backend

```bash
cd backend
pip install -r requirements.txt
cp ../.env.example ../.env   # fill in your keys
python main.py
```

### Seed demo data

```bash
cd data
python seed.py
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
├── README.md
├── agent/
│   ├── agent.yaml
│   ├── tools.yaml
│   └── prompts/
│       └── system.txt
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── config.py
│   ├── db/
│   │   ├── mongo.py
│   │   └── models.py
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
    ├── architecture.png
    └── demo-script.md
```

---

## Hackathon

This project was built for the [Google Cloud Rapid Agent Hackathon](https://rapid-agent.devpost.com/) hosted on Devpost.

- **Track**: MongoDB
- **Theme**: Building Agents for Real-World Challenges

---

## License

MIT License - see [LICENSE](./LICENSE) for details.
