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

- **v2** presents Loka as an exchange for cash-flow assets settled in AIUSD. Compute credit is the first asset class: loan markets and the Compute Credit Vault (CCV), with order books, two vaults, a unified portfolio, an issuer entry and a transparency page.
- **v1** presents single-loan GPU equipment financing: investors subscribe to individual loans through escrow, and borrowers complete six release conditions recorded on-chain.

Shared images, video and logos are in `assets/`.
