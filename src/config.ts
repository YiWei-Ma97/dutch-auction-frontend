
export const SEPOLIA_CHAIN_ID = 11155111;

export const TOKEN_ADDRESS = '0x739b2218E045C38C64195Db7d37b7010bBcb81D6';
export const AUCTION_ADDRESS = '0x5b05D77E1eb6D296FFCC044AD44FF139E4363f12';

// Optional: set VITE_RPC_URL in .env to use your own provider; otherwise Metamask provider is used.
export const FALLBACK_RPC = import.meta.env.VITE_RPC_URL || 'https://1rpc.io/sepolia';
