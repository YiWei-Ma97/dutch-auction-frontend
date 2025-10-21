
# Dutch Auction Frontend (Sepolia)

Minimal React + Vite + ethers v6 frontend that connects to the **DutchAuction** contract on Sepolia.

## Contracts
- Auction: `0x47f8f48Fc99DEfc2A3D3655Aea02DE678030742e`
- Token: `0x61df7fFF1F7c9e0F66c733E4B119b6C1FE7B0a74`

Both contracts are verified on Etherscan.

## Quick Start

```bash
npm i   # or npm i / yarn
npm run dev # http://localhost:5173
```

## What the UI shows
- Current price, time remaining, start/reserve prices, total tokens, my bid, whether ended, clearing price, my token balance.
- Actions: **Place Bid (payable)**.

## Notes
- Network required: **Sepolia (chainId 11155111)**.
- ABIs were constructed from verified sources on Etherscan.
