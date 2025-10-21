import { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import { AUCTION_ADDRESS, SEPOLIA_CHAIN_ID, TOKEN_ADDRESS } from "../config";
// import auctionAbi from "@/lib/abis/dutchauction.json";
// import tokenAbi from "@/lib/abis/hashthreetoken.json";
import auctionAbi from '../lib/abis/dutchauction.json'
import tokenAbi from '../lib/abis/erc20.json'
// import { AUCTION_ADDRESS, TOKEN_ADDRESS, SEPOLIA_CHAIN_ID } from "@/lib/config";

type AuctionState = {
  // headline metrics
  currentPrice?: string;           // ETH
  timeRemaining?: number;          // seconds
  startPrice?: string;             // ETH
  reservePrice?: string;           // ETH
  totalTokens?: string;            // token units (formatted with decimals)
  tokenSymbol?: string;
  tokenDecimals: number;
  auctionEnded: boolean;
  clearingPrice?: string;          // ETH

  // user metrics
  myBid?: string;                  // ETH
  myTokenBal?: string;             // tokens

  // derived
  tokensAtAuction?: string;        // token balance currently at auction addr
  tokensSold?: string;             // totalTokens - tokensAtAuction
  soldPct?: number;                // %
};

export function useAuction() {
  const [state, setState] = useState<AuctionState>({
    tokenDecimals: 18,
    auctionEnded: false,
  });

  // Provider/signer + contracts (ethers v6)
  const getContracts = useCallback(async () => {
    if (!(window as any).ethereum) throw new Error("MetaMask not detected");
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    // do NOT request accounts here; read-calls should not force connect
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) {
      // still allow read via provider injected by MetaMask, but warn upstream
    }
    let signer: ethers.Signer | null = null;
    try {
      signer = await provider.getSigner();
      // if not connected yet, this may throw; we’ll treat as read-only
    } catch {
      signer = null;
    }
    const runner = signer ?? provider;
    const auction = new ethers.Contract(AUCTION_ADDRESS, auctionAbi, runner);
    const token = new ethers.Contract(TOKEN_ADDRESS, tokenAbi, runner);
    return { provider, signer, auction, token };
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const { signer, auction, token } = await getContracts();
      // fetch account (optional)
      let userAddr: string | null = null;
      try {
        userAddr = signer ? await signer.getAddress() : null;
      } catch {
        userAddr = null;
      }

      // Parallel reads
      const [
        currentPriceBN,
        // prefer getTimeRemaining() if contract has it; otherwise compute from timestamps
        timeRemMaybe,
        startPriceBN,
        reservePriceBN,
        totalTokensBN,
        auctionEnded,
        clearingPriceBN,
        tokenSymbol,
        tokenDecimals,
        auctionTokenBalBN,
        myBidBN,
        myTokenBalBN,
      ] = await Promise.all([
        auction.getCurrentPrice(),
        // if missing, this call will throw; we’ll catch below and compute
        auction.getTimeRemaining?.().catch(() => null),
        auction.startPrice(),
        auction.reservePrice(),
        auction.totalTokens(),
        auction.auctionEnded(),
        auction.clearingPrice().catch(() => 0n), // might be 0 until end
        token.symbol(),
        token.decimals(),
        token.balanceOf(AUCTION_ADDRESS),
        userAddr ? auction.bids(userAddr) : Promise.resolve(0n),
        userAddr ? token.balanceOf(userAddr) : Promise.resolve(0n),
      ]);

      // time remaining: fallback compute if method not available
      let timeRemaining: number | undefined = undefined;
      if (timeRemMaybe !== null) {
        timeRemaining = Number(timeRemMaybe);
      } else {
        // fallback: startTime + DURATION - now
        const [startTimeBN, durationBN] = await Promise.all([
          auction.startTime(),
          auction.AUCTION_DURATION?.().catch(() => 20 * 60), // 20 mins fallback
        ]);
        const now = Math.floor(Date.now() / 1000);
        const endTs =
          Number(startTimeBN) + (typeof durationBN === "bigint" ? Number(durationBN) : Number(durationBN));
        timeRemaining = Math.max(0, endTs - now);
      }

      // formatters
      const dec = Number(tokenDecimals);
      const fmtEth = (x: bigint | number) => ethers.formatEther(x);
      const fmtTok = (x: bigint | number) => ethers.formatUnits(x, dec);

      const currentPrice = fmtEth(currentPriceBN);
      const startPrice = fmtEth(startPriceBN);
      const reservePrice = fmtEth(reservePriceBN);
      const totalTokens = fmtTok(totalTokensBN);
      const clearingPrice = clearingPriceBN ? fmtEth(clearingPriceBN) : undefined;
      const tokensAtAuction = fmtTok(auctionTokenBalBN);
      const tokensSoldNum = Number(totalTokens) - Number(tokensAtAuction);
      const tokensSold = tokensSoldNum >= 0 ? tokensSoldNum.toString() : "0";
      const soldPct =
        Number(totalTokens) > 0 ? Math.min(100, Math.max(0, (tokensSoldNum / Number(totalTokens)) * 100)) : 0;

      const myBid = myBidBN ? fmtEth(myBidBN) : undefined;
      const myTokenBal = myTokenBalBN ? fmtTok(myTokenBalBN) : undefined;

      setState({
        currentPrice,
        timeRemaining,
        startPrice,
        reservePrice,
        totalTokens,
        clearingPrice,
        tokenSymbol,
        tokenDecimals: dec,
        myBid,
        myTokenBal,
        auctionEnded,
        tokensAtAuction,
        tokensSold,
        soldPct,
      });
    } catch (err) {
      console.error("refreshStatus error:", err);
    }
  }, [getContracts]);

  // write: place bid
  const placeBid = useCallback(async (ethAmount: string) => {
    if (!(window as any).ethereum) throw new Error("MetaMask not detected");
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const auction = new ethers.Contract(AUCTION_ADDRESS, auctionAbi, signer);
    const tx = await auction.bid({ value: ethers.parseEther(ethAmount) });
    await tx.wait();
    await refreshStatus();
  }, [refreshStatus]);

  // write: claim tokens
  const claimTokens = useCallback(async () => {
    if (!(window as any).ethereum) throw new Error("MetaMask not detected");
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const auction = new ethers.Contract(AUCTION_ADDRESS, auctionAbi, signer);
    const tx = await auction.claimTokens();
    await tx.wait();
    await refreshStatus();
  }, [refreshStatus]);

  // write: refund (if available in your contract as `refund()` or `requestRefund()`)
  const requestRefund = useCallback(async () => {
    if (!(window as any).ethereum) throw new Error("MetaMask not detected");
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const auction = new ethers.Contract(AUCTION_ADDRESS, auctionAbi, signer);
    const fn = (auction.refund ?? auction.requestRefund).bind(auction); // support either name
    const tx = await fn();
    await tx.wait();
    await refreshStatus();
  }, [refreshStatus]);

  // initial load
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return {
    // state
    ...state,
    // actions
    placeBid,
    claimTokens,
    requestRefund,
    refreshStatus,
  };
}
