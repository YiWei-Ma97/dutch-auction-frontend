
export const SEPOLIA_CHAIN_ID = 11155111;

export const TOKEN_ADDRESS = '0x244cBC8072e2523e0a3812B0Fa2d85C52c752BDF';
export const AUCTION_ADDRESS = '0x7A0dfd970e7605e41A2Bb2181f63e1d15D435e6F';

// Optional: set VITE_RPC_URL in .env to use your own provider; otherwise Metamask provider is used.
export const FALLBACK_RPC = import.meta.env.VITE_RPC_URL || 'https://1rpc.io/sepolia';
