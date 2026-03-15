# EconCascade

[![Deploy to GitHub Pages](https://github.com/YOUR_GITHUB_USERNAME/econcascade/actions/workflows/deploy.yml/badge.svg)](https://github.com/YOUR_GITHUB_USERNAME/econcascade/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![No dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)
![Vanilla JS](https://img.shields.io/badge/built%20with-vanilla%20JS-yellow)

**The free, interactive economics study tool for AP Macro, AP Micro, and EconBowl prep.**

[**→ Live Site**](https://YOUR_GITHUB_USERNAME.github.io/econcascade) · [Report a Bug](https://github.com/YOUR_GITHUB_USERNAME/econcascade/issues) · [Request a Feature](https://github.com/YOUR_GITHUB_USERNAME/econcascade/issues)

---

## What it does

EconCascade has two parts:

### 1. Cascade Map
Trigger any of **62 economic shocks** and watch the effect ripple through **26 interconnected variables** in real time — with animated color-coded nodes and directional arrows. Hover any lit node to get a context-aware explanation of *exactly why* it rose, fell, or became ambiguous given the current shock.

**Shock categories:**
- Monetary policy (Fed buys/sells bonds, reserve req., discount rate, QE/QT)
- Fiscal policy (tax cuts/hikes, govt spending, subsidies, min wage)
- Aggregate supply shocks (oil, tech, labor supply, capital, disasters)
- Aggregate demand shocks (confidence, wealth effect, housing boom/bust, gaps)
- Trade & exchange rate (tariffs, quotas, dollar strength, capital flows)
- Labor & microeconomics (unions, automation, monopoly, externalities, price controls)

### 2. Graph Lab
**15 interactive economics graphs** where every equilibrium is solved algebraically. Click a shock button and watch curves animate smoothly to the new intersection. Includes:

| Graph | Key concepts |
|-------|-------------|
| AD-AS | Inflationary/recessionary gaps, self-correction |
| Supply & Demand | CS/PS shading, DWL, per-unit tax, price controls |
| Loanable Funds | Real interest rate, crowding out |
| Money Market | Nominal rate, Fed policy transmission |
| Phillips Curve | SRPC/LRPC, NAIRU, stagflation |
| PPC | Opportunity cost, efficiency, growth |
| Labor Market | MRP, min wage, unemployment |
| Cost Curves | MC=MR, shutdown, break-even |
| Monopoly | DWL, socially optimal, fair return |
| Monopolistic Competition | LR zero profit, excess capacity |
| Foreign Exchange | Dollar appreciation/depreciation |
| Investment Demand | Rate-investment link |
| Externality | MSB/MSC, Pigouvian correction |
| Lorenz Curve | Gini coefficient, income inequality |
| Tariff & Trade | DWL triangles G+J, revenue, free trade |

---

## Quick start (local development)

No build step required. It's a single-page static site.

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/econcascade.git
cd econcascade
# Open in browser — any of these work:
open index.html
python3 -m http.server 8080
npx serve .
```

---

## Deploy to GitHub Pages

1. Fork or clone this repo
2. Go to **Settings → Pages**
3. Set **Source** to `Deploy from a branch`
4. Set **Branch** to `main`, folder to `/ (root)`
5. Save — your site will be live at `https://YOUR_GITHUB_USERNAME.github.io/econcascade`

The repo also includes a **GitHub Actions workflow** (`.github/workflows/deploy.yml`) that auto-deploys on every push to `main`.

---

## Project structure

```
econcascade/
├── index.html              # Main HTML — structure only
├── assets/
│   ├── style.css           # All CSS — dark theme, component styles
│   └── app.js              # All JavaScript — cascade engine + graph lab
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Pages auto-deploy
├── README.md
├── LICENSE                 # MIT
├── CONTRIBUTING.md
└── .gitignore
```

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Esc` | Reset cascade map |
| `R` | Reset current graph |

---

## Tech stack

- **Vanilla HTML/CSS/JS** — zero dependencies, zero build step
- **Canvas API** — cascade map and all 15 graphs rendered in `<canvas>`
- **RequestAnimationFrame** — smooth lerp animation (k = 0.18/frame)
- **Algebraic equilibria** — every intersection solved mathematically, not approximated

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). PRs welcome for:
- Additional shock events
- New graph types
- Bug fixes
- Mobile UX improvements

---

## License

MIT — see [LICENSE](LICENSE). Free to use, share, and modify.
