import { ethers } from "ethers";
import auctionAbi from "./lib/abis/dutchauction.json";
import tokenAbi from "./lib/abis/erc20.json";

export const SEPOLIA_CHAIN_ID = 11155111;
export const DEFAULT_AUCTION_ADDRESS = import.meta.env.VITE_AUCTION_ADDRESS;
export const TOKEN_FACTORY_ADDRESS = "0x75359532b4E11348A1A07E97008Ce45A2197e032";
export const DUTCH_AUCTION_FACTORY_ADDRESS = "0x8020302586C54f1039da677409106e74b5e65057";
export const AUCTION_ABI = auctionAbi;
export const TOKEN_ABI = tokenAbi;