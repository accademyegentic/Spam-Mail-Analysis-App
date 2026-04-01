# MailPulse Analytics v2

A privacy-first email volume analyzer. Import your email logs (Excel/CSV) or connect directly via IMAP to visualize message frequency, detect promotional and spam patterns, and mark emails as read — all from a clean local dashboard.

## Features

- **IMAP Live Fetch** — Connect multiple accounts over TLS (port 993) to pull emails directly from Gmail, Outlook, GMX, WEB.DE, Yahoo, and more
- **File Import** — Upload Excel/CSV logs (auto-detects Date, Subject, Sender, Folder columns)
- **Spam & Promo Detection** — Folder-aware heuristics with German/English keyword support
- **Mark as Read** — Select individual emails or mark all at once; syncs back to the IMAP server for live accounts
- **Date Range Filtering** — Client-side filtering with quick 7d / 30d / 90d presets
- **Analysis Insights** — Local deterministic summary: spam ratio, most targeted account, top sender domains
- **Multi-account** — Side-by-side volume comparison across all accounts

> **Note:** The hosted GitHub Pages version supports file import and analysis only. IMAP fetch and mark-as-read require running the app locally (the Express backend is not deployed to static hosting).

## Run Locally

**Prerequisites:** Node.js 20+

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to GitHub Pages

Push to `main` — the GitHub Actions workflow (`.github/workflows/deploy.yml`) builds the Vite frontend and deploys it to the `gh-pages` branch automatically. No secrets required.

The workflow injects `VITE_BASE_PATH=/<repo-name>/` at build time so all assets resolve correctly under `https://username.github.io/<repo-name>/`.

## Tech Stack

- React 19 + TypeScript
- Vite 6
- Tailwind CSS
- Recharts
- ImapFlow (IMAP backend)
- XLSX (file parsing)
- Lucide React (icons)
