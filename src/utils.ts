import {
    ethers,
    parseEther,
    Interface,
    LogDescription,
    Provider,
    Signer
} from "ethers";
import { type TransactionReceipt, type Log } from 'viem'; 
import { TOKEN_FACTORY_ADDRESS, DUTCH_AUCTION_FACTORY_ADDRESS } from "./config";
import TokenFactoryAbi from './lib/abis/TokenFactory.json';
import DutchAuctionFactoryAbi from './lib/abis/DutchAuctionFactory.json';
import Erc20Abi from './lib/abis/erc20.json';

export const fmtEth = (wei: bigint) => {
  const s = (Number(wei) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 6 })
  return s + ' ETH'
}
export const fmtToken = (n: bigint, decimals: number) => {
  const v = Number(n) / 10 ** decimals
  return v.toLocaleString(undefined, { maximumFractionDigits: 6 })
}
export const timeLeft = (secs: number) => {
  if (secs <= 0) return '0s'
  const m = Math.floor(secs / 60), s = secs % 60
  return `${m}m ${s}s`
}

export const getContract = (address: string, abi: any, signerOrProvider: Signer | Provider) => {
    return new ethers.Contract(address, abi, signerOrProvider);
};

export const convertEthToWei = (ethAmount: string): bigint => {
    if (!ethAmount) return 0n; 
    return parseEther(ethAmount);
};

export const decodeTransactionLogs = (abi: any, receipt: TransactionReceipt): LogDescription[] => {
    const iface = new Interface(abi);
    
    const parsedLogs = receipt.logs.map((log: Log) => { 
            try {
                if (!log.topics || !log.topics[0]) {
                    return null;
                }
                
                const event = iface.getEvent(log.topics[0]); 
                if (!event) return null;

                return iface.parseLog(log);
            } catch (e) {
                return null;
            }
        });
        
    return parsedLogs.filter((log): log is LogDescription => log !== null);
};


export const exportTokenToMetaMask = async (
    tokenAddress: string,
    tokenTicker: string,
    decimals: number = 18
) => {
    const ethereum = (window as any).ethereum;
    if (!ethereum || !ethereum.request) {
        console.error("MetaMask is not installed or not available!");
        return;
    }
    try {
        await ethereum.request({
            method: 'wallet_watchAsset',
            params: {
                type: 'ERC20',
                options: {
                    address: tokenAddress,
                    symbol: tokenTicker,
                    decimals: decimals,
                },
            },
        });
    } catch (error) {
        console.error("Failed to add token to MetaMask", error);
    }
};