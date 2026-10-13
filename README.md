# Loka

Design prototypes for Loka. Static HTML, no build step. All data in the pages is sample data.

Open `index.html` to pick a page, or serve the folder:

```bash
python3 -m http.server 8000
```

## Pages

| | Landing page | App |
|---|---|---|
| **v2 · Exchange** (current) | `v2-exchange/index.html` | `v2-exchange/app/index.html` (exchange), `v2-exchange/app/issuer/index.html` (issuer console) |

- **v2** presents Loka as an exchange for the assets that power AI, settled in AIUSD. The first listings are loans on GPUs that are installed and rented out. The landing page also links to two other Loka products, Atara (payments) and Loka World (economic simulation), from a Products menu and a section near the end. The app shows the first phase:
  - Markets in two parts: loans open for subscription, and funded loans that are repaying.
  - Subscriptions go into a per-loan escrow contract and are released only after six conditions are recorded on-chain; otherwise they are refunded.
  - Access is tiered. Anyone can see loan size, coverage, loan-to-value, repayments and the on-chain record. Yields, full terms, documents and subscriptions are for verified institutional investors. A switcher at the bottom left previews each state, or open the app with `?view=public`, `unverified`, `pending` or `verified`.
  - An issuer page explains how compute operators apply to list.
  - Trading, the vaults and the transparency page are built but hidden for this phase.

Shared images, video and logos are in `assets/`.
