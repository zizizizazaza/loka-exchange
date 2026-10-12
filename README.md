# Loka

Design prototypes for Loka. Static HTML, no build step. All data in the pages is sample data.

Open `index.html` to pick a version, or serve the folder:

```bash
python3 -m http.server 8000
```

## Versions

| Version | Landing page | App |
|---|---|---|
| **v2 · Exchange** (current) | `v2-exchange/index.html` | `v2-exchange/app/index.html` (exchange), `v2-exchange/app/issuer/index.html` (issuer console) |
| v1 · Compute financing (previous) | `v1-lending/index.html` | `v1-lending/app/investor/index.html` (investor app), `v1-lending/app/borrower/index.html` (borrower console) |

- **v2** presents Loka as an exchange for cash-flow assets settled in AIUSD. Compute credit is the first asset class. The app shows the first phase:
  - Markets in two parts: loans open for subscription, and funded loans that are repaying.
  - Subscriptions go into a per-loan escrow contract and are released only after six conditions are recorded on-chain; otherwise they are refunded.
  - Access is tiered. Anyone can see loan size, coverage, loan-to-value, repayments and the on-chain record. Yields, full terms, documents and subscriptions are for verified institutional investors. A switcher at the bottom left previews each state, or open the app with `?view=public`, `unverified`, `pending` or `verified`.
  - An issuer page explains how compute operators apply to list.
  - Trading, the vaults and the transparency page are built but hidden for this phase.
- **v1** presents single-loan GPU equipment financing: investors subscribe to individual loans through escrow, and borrowers complete six release conditions recorded on-chain.

Shared images, video and logos are in `assets/`.
