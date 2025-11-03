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
  started: boolean;
  clearingPrice?: string;          // ETH

  // user metrics
  myBid?: string;                  // ETH
  myTokenBal?: string;             // tokens

  // derived
  tokensAtAuction?: string;        // token balance currently at auction addr
  tokensSold?: string;             // totalTokens - tokensAtAuction
  soldPct?: number;                // %

  startTime?: number;
  auctionDuration?: number;
  
  // admin
  seller?: string;                 // seller/admin address
};

export function useAuction() {
  const [state, setState] = useState<AuctionState>({
    tokenDecimals: 18,
    auctionEnded: false,
    started: false,
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
      // if not connected yet, this may throw; we'll treat as read-only
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

      // Parallel reads - First batch (basic auction info)
      const [
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
        sellerAddress,
        started,
      ] = await Promise.all([
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
        auction.seller(),
        auction.started?.().catch(() => false), // check if auction has started
      ]);

      // Second batch - getCurrentPrice (may fail if not started, so handle separately)
      const [currentPriceBN, timeRemMaybe] = await Promise.all([
        auction.getCurrentPrice().catch(() => startPriceBN), // if not started, show startPrice
        auction.getTimeRemaining?.().catch(() => null),
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

      const [startTimeBN, durationBN] = await Promise.all([
        auction.startTime(),
        auction.AUCTION_DURATION?.().catch(() => 20 * 60),
      ]);

      console.log('startTimeBN', startTimeBN)
      console.log('durationBN', durationBN)

      const startTime = Number(startTimeBN);
      const auctionDuration =
      typeof durationBN === "bigint" ? Number(durationBN) : Number(durationBN);

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
        started,
        tokensAtAuction,
        tokensSold,
        soldPct,
        startTime,
        auctionDuration,
        seller: sellerAddress,
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

  // 🛑 End the auction (seller or after time elapsed)
  const endAuction = useCallback(async () => {
    if (!(window as any).ethereum) throw new Error("MetaMask not detected");
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const auction = new ethers.Contract(AUCTION_ADDRESS, auctionAbi, signer);
    const tx = await auction.endAuction();
    await tx.wait();
    await refreshStatus();
  }, [refreshStatus]);

  // 🟢 Start the auction (seller only)
  const startAuction = useCallback(async () => {
    if (!(window as any).ethereum) throw new Error("MetaMask not detected");
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const auction = new ethers.Contract(AUCTION_ADDRESS, auctionAbi, signer);
    const tx = await auction.start();
    await tx.wait();
    await refreshStatus();
  }, [refreshStatus]);

  // initial load
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // ⏱️ Live update the current price every second while auction is running
  useEffect(() => {
    let interval: any;

    async function tickPriceAndTime() {
      try {
        const { auction } = await getContracts();

        // Read minimal on-chain data
        const [started, ended] = await Promise.all([
          auction.started?.().catch(() => true),
          auction.auctionEnded?.().catch(() => false),
        ]);

        if (!started || ended) return;

        // Fetch current price and remaining time directly from contract
        const [priceBN, timeRemBN] = await Promise.all([
          auction.getCurrentPrice(),
          auction.getTimeRemaining?.().catch(() => null),
        ]);

        const price = ethers.formatEther(priceBN);
        const timeRemaining = timeRemBN ? Number(timeRemBN) : undefined;

        // ✅ Update both together so UI stays perfectly in sync
        setState((prev) => ({
          ...prev,
          currentPrice: price,
          timeRemaining,
        }));
      } catch (err) {
        console.warn("Live price/time update error:", err);
      }
    }

    interval = setInterval(tickPriceAndTime, 1000);
    return () => clearInterval(interval);
  }, [getContracts]);

  return {
    // state
    ...state,
    // actions
    placeBid,
    claimTokens,
    requestRefund,
    refreshStatus,
    endAuction,
    startAuction
  };

}