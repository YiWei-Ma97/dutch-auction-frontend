
export const SEPOLIA_CHAIN_ID = 11155111;

export const TOKEN_ADDRESS = '0x61df7fFF1F7c9e0F66c733E4B119b6C1FE7B0a74';
export const AUCTION_ADDRESS = '0xBac87183dae6cd9BC17cdE9C66DFE1351b603323';

// Optional: set VITE_RPC_URL in .env to use your own provider; otherwise Metamask provider is used.
export const FALLBACK_RPC = import.meta.env.VITE_RPC_URL || 'https://1rpc.io/sepolia';
