
# Dutch Auction Frontend (Sepolia)

Minimal React + Vite + ethers v6 frontend that connects to the **DutchAuction** contract on Sepolia.

## Contracts
- Auction: `0x47f8f48Fc99DEfc2A3D3655Aea02DE678030742e`
- Token: `0x61df7fFF1F7c9e0F66c733E4B119b6C1FE7B0a74`

Both contracts are verified on Etherscan.

## Quick Start

```bash
pnpm i   # or npm i / yarn
pnpm dev # http://localhost:5173
```

### Optional env
Create `.env` at project root:

```ini
VITE_RPC_URL=https://1rpc.io/sepolia
VITE_SELLER=0x... # if you want admin buttons to show; the contract itself enforces auth
```

## What the UI shows
- Current price, time remaining, start/reserve prices, total tokens, my bid, whether ended, clearing price, my token balance.
- Actions: **Place Bid (payable)**, **Claim Tokens**, **Withdraw Ether**, **Burn Unsold Tokens**, **End Auction**.

## Notes
- Network required: **Sepolia (chainId 11155111)**.
- If no wallet is installed, the UI falls back to a public Sepolia RPC (read-only).
- ABIs were constructed from verified sources on Etherscan.
