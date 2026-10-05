# FinLit Co-Pilot: Pause & Plan

A live portfolio exit co-pilot for Zerodha investors, built for the E-Cell IIT Guwahati x StepSmart FinLit Ventures case competition.

When an investor is about to pull most of their money out of the market, or when serious news hits a stock they own, FinLit Co-Pilot alerts their phone and opens a 30-second "Pause & Plan" screen that answers four questions with their own data:

1. **Why is this happening?** Live Moneycontrol and ET Markets headlines, classified as noise, material or structural.
2. **Does this exit fit my plan?** Checked against the rules the investor set on a calm day.
3. **What will it cost?** Exit load and capital gains tax under FY 2026-27 rules, lot by lot, with loss set-off.
4. **What if I'm wrong?** A 12-month what-if for every option, with a slider.

Then the investor decides. The order opens in Zerodha for their own confirmation. FinLit never places or blocks an order.

**Pitch line:** we wake you up for a fraud, not for a Fed meeting.

---

## What is live and what is simulated

| Part | Status |
|---|---|
| Zerodha login and holdings (stocks, ETFs, mutual funds) | Live, via Kite Connect |
| Holding prices | Live, refreshed every 60 seconds during market hours |
| Nifty 50 and India VIX | Live from Zerodha with the data plan, otherwise a public delayed feed |
| News (Moneycontrol, ET Markets, optional Marketaux) | Live, polled every 5 minutes in market hours |
| News classification | Live with Claude API, or transparent keyword rules without a key |
| Phone alerts and alarms (ntfy, Pushover, browser) | Live |
| Tax and exit-load engine | Live, unit tested against verified numbers |
| Order handoff | Live: prefilled Zerodha basket for stocks, Coin link for funds |
| Crash Replay (4 June 2024) | Replays a real crash through the live alert engine; the minute path is reconstructed from the official open, low and close |
| Alarm drill | Uses a clearly labelled fictional company to demonstrate a company-specific alarm |
| Demo portfolios (Rohan, Meera) | Static, for judges who cannot link a Zerodha account |

---

## The three alert tiers

| Tier | Fires when | Phone behaviour |
|---|---|---|
| Info | Portfolio or Nifty down 2% today | Normal notification |
| Priority | Portfolio down 4%, India VIX 22 or above, negative news on a holding | High-priority notification |
| Alarm | Structural news (fraud, regulatory action, default, downgrade, auditor or CEO exit) on a holding that is 10% or more of the portfolio; or a floor the user set | Rings through silent mode and repeats until opened |

A market-wide fall alone never rings the alarm. That is when panic selling destroys the most value, so it gets a calm, specific alert with context instead.

---

## Deploy: GitHub, then Render (free plan)

1. **Create a GitHub repository** and upload all the files from this folder. Every file sits at the top level with no subfolders, so GitHub's "choose your files" button works: select all files and commit.
2. **Create the Render service.** In Render, choose New, then Blueprint, and pick your repository. Render reads `render.yaml`. (Or choose New, Web Service, and set Build Command `npm run build`, Start Command `npm start`, Instance type Free.)
3. **Set environment variables** in Render (see `.env.example`). The minimum for a working demo is:
   - `APP_BASE_URL` = your Render URL, for example `https://finlit-copilot.onrender.com`
   - `APP_PASSCODE` = any passcode (protects the live Zerodha view and alert settings)
   - `NTFY_TOPIC` = a hard-to-guess topic name, for example `finlit-dinesh-7q4k2`
4. **Deploy.** First build takes 3 to 5 minutes. Open the URL. The Rohan demo portfolio loads straight away.

### Connect Zerodha (live mode)

1. Go to developers.kite.trade, sign in, and create an app. The free Personal type gives holdings and orders. The Connect type (Rs 500 a month) adds live market data; if you buy it, set `KITE_MARKET_DATA=true`.
2. Set the app's **Redirect URL** to `https://<your-app>.onrender.com/api/kite/callback`.
3. Copy the API key and secret into Render as `KITE_API_KEY` and `KITE_API_SECRET`, then redeploy.
4. In the app, switch the portfolio menu to **My Zerodha**, enter your passcode, and tap **Log in with Zerodha**.
5. Optional: in Settings, upload your Zerodha Console tradebook CSV so holding periods (and so short-term versus long-term tax) are exact.

Zerodha logins expire every morning. The app sends a "Start today's watch" notification at 8:45 AM on trading days.

### Set up the phone alarm

**Android (free):** install the ntfy app, subscribe to your `NTFY_TOPIC`, then in that topic's notification settings allow it to override Do Not Disturb and choose an alarm sound for max priority.

**iPhone:** a normal finance app cannot get Apple's permission to ring through the mute switch. Use Pushover: create an application at pushover.net to get `PUSHOVER_APP_TOKEN`, put your user key in Settings (or `PUSHOVER_USER_KEY`), and enable Critical Alerts in the Pushover app.

In the app, open **Settings**, save, and press **Send test alarm**.

### Optional keys

- `ANTHROPIC_API_KEY`: Claude classifies each headline as noise, material or structural with a one-line reason. Without it, keyword rules are used and labelled as such.
- `MARKETAUX_TOKEN`: adds ticker-tagged news with sentiment scores.

---

## Run locally

```bash
npm run build      # installs packages and builds the web app into dist
npm test           # tax and planner tests (6 checks against verified numbers)
npm start          # http://localhost:8080
```

---

## Demo script (about 2 minutes 30 seconds)

1. **Problem (15 s).** Investors sell in panic, and every app tells them what happened after the fact.
2. **Connect (20 s).** Show Settings: Zerodha connected, Send test alarm rings the phone.
3. **Replay the crash (40 s).** On Rohan's dashboard press Replay the crash. Calm info and priority alerts arrive; no alarm. Open the plan: market-wide, 90% equity versus his 80% limit, rebalance at Rs 0. "In a crash, tax is not your big cost. Timing is."
4. **Alarm drill (35 s).** Press Alarm drill. The phone rings as an alarm. The plan changes: this news is company-specific, so reducing that one stock fits his own limit. Exiting everything is still one tap away.
5. **Same crash, different person (20 s).** Switch to Meera. She needs Rs 4 lakh for her wedding. Withdraw or exit, then "I need the money": Rs 4 lakh withdrawn tax-smart for Rs 1,450, the rest stays invested.
6. **Close (20 s).** Alerts page: informed decisions, time to acknowledge, decision log with 30-day review.

---

## Prototype limitations (for the deck)

This is a working prototype on free infrastructure. Each limit below has a direct fix when scaled.

| Limitation in the prototype | Why | Production fix |
|---|---|---|
| The server sleeps after about 15 minutes with no visitors, so live alerts can be missed while it is asleep | Render free plan | Paid always-on instance (a few dollars a month) or a dedicated worker |
| Saved settings, alerts and the Zerodha session reset when the server restarts or redeploys | Free plan has no persistent disk | Managed Postgres |
| One Zerodha account per deployment; judges cannot link their own accounts | Kite Personal apps are tied to the developer's account | Zerodha partnership for multi-user access, or smallcase Gateway or Account Aggregator |
| Holding periods are estimated unless a tradebook is uploaded | Zerodha's API gives average price, not purchase dates | Depository statements via Account Aggregator |
| Mutual fund exit loads are estimated at 1% within 12 months | Scheme-level exit load data is not in the API | Scheme master data feed |
| Index levels may be delayed without the Rs 500 data plan | Free plan has no market data | Kite Connect data plan or exchange-licensed feed |
| News arrives within about 5 minutes, not instantly; public RSS feeds can be empty or slow | Free sources and polling | Licensed real-time news API with push |
| NSE holidays are not modelled; tax excludes cess and surcharge | Prototype scope | Exchange calendar and full tax tables |
| iPhone alarms need the Pushover app | Apple reserves Critical Alerts for health and safety apps | Native app with Time Sensitive notifications, plus Pushover-style partner |
| Replay minute path is reconstructed from official open, low and close | Historical minute data needs the data plan | Kite historical candles |

---

## Compliance design

- Decision support, not advice: the verdict cites the user's own data and rules, and says so on every screen.
- No order is ever placed by the server. Orders open in Zerodha for the user's own login and confirmation, which keeps the app outside SEBI's 2026 rules for server-placed API orders.
- Exit everything is always visible and one tap away. No countdowns or guilt copy.
- Conflict of interest disclosed: FinLit earns the same whether the user stays or exits.
- Data: Zerodha token encrypted at rest, a Delete my data button, only headlines and links stored from news sources.

---

## Project structure

All files sit at the top level so the repository uploads cleanly through GitHub's web page.

| Files | Role |
|---|---|
| `index.js` | Backend entry: API routes, background watch loop, serves the web app |
| `kite.js` | Zerodha login, holdings and fund sync, quotes |
| `news.js`, `classifier.js` | Moneycontrol and ET Markets RSS, Marketaux, Claude classifier with rule fallback |
| `rules.js`, `notify.js` | Three-tier alert engine; ntfy, Pushover and in-app delivery |
| `tax.js`, `planner.js`, `tax.test.js` | FY 2026-27 tax engine, Pause & Plan options, acceptance tests |
| `replay.js`, `demo.js` | 4 June 2024 crash replay, alarm drill, demo portfolios |
| `store.js`, `config.js`, `util.js`, `market.js`, `tradebook.js` | State, settings, helpers, index data, tradebook import |
| `App.jsx`, `main.jsx`, `lib.js`, `index.css` and the other `.jsx` files | React frontend |
| `index.html`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `icon.svg`, `manifest.webmanifest` | Frontend build and app icon |
| `render.yaml`, `env.example` | Render blueprint and the list of settings |
