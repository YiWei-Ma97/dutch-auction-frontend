import { ethers } from "ethers";
import auctionAbi from "./lib/abis/dutchauction.json";
import tokenAbi from "./lib/abis/erc20.json";

export const SEPOLIA_CHAIN_ID = 11155111;
export const DEFAULT_AUCTION_ADDRESS = import.meta.env.VITE_AUCTION_ADDRESS;
export const TOKEN_FACTORY_ADDRESS = "0xee8862588047D829125a89Ebf2DBA4e68A04a4BD";
export const DUTCH_AUCTION_FACTORY_ADDRESS = "0x64A1D380B148b6605D87cb4472b695952aAE5E31";
export const AUCTION_ABI = auctionAbi;
export const TOKEN_ABI = tokenAbi;