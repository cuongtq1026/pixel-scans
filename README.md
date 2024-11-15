# pixel-airdrops

A small project to index and analyze a list of airdrop addresses from Pixels Airdrop.

### Data indexed:
- Airdrop wallets (both distributor and receiver)
- Pixel transfers
- Katana swaps

### Sold pixel data
The sold pixel data is track by
- Pixels transferred to Binance right after receiving the airdrop.
- Pixels transferred to another wallet and then transferred to Binance.
- Pixels swapped to RON by Katana DEX.
- Pixels transferred to another wallet and then swapped to RON by Katana DEX.

### Result:
```text
Number of research wallets: 881
Number of sold wallets: 668
Retention rate: 75.82%

total: 881 | sold: 668 | retention rate: 75.82%
```

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```
