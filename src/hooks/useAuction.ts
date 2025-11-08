import { useState, useEffect, useCallback } from "react";
import { ethers, BrowserProvider, Contract, formatEther, parseEther } from "ethers";
import { AUCTION_ABI, TOKEN_ABI } from "../config"; 

export const useAuction = (auctionAddress: string | null, provider: BrowserProvider | null) => {
  // Auction state
  const [currentPrice, setCurrentPrice] = useState<string>();
  const [timeRemaining, setTimeRemaining] = useState<number>();
  const [startPrice, setStartPrice] = useState<string>();
  const [reservePrice, setReservePrice] = useState<string>();
  const [totalTokens, setTotalTokens] = useState<string>();
  const [clearingPrice, setClearingPrice] = useState<string>();
  const [myBid, setMyBid] = useState<string>();
  const [myTokenBal, setMyTokenBal] = useState<string>();
  const [tokenSymbol, setTokenSymbol] = useState<string>();
  const [soldPct, setSoldPct] = useState<number>();
  const [auctionEnded, setAuctionEnded] = useState<boolean>(false);
  const [started, setStarted] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<number>();
  const [auctionDuration, setAuctionDuration] = useState<number>();
  const [seller, setSeller] = useState<string>();

  // Helper to create contract instances
  const getContracts = useCallback(async (withSigner = false) => {
    if (!provider || !auctionAddress) return null;
    const signer = withSigner ? await provider.getSigner() : null;
    const auction = new Contract(auctionAddress, AUCTION_ABI, withSigner ? signer : provider);
    const tokenAddress = await auction.token();
    const token = new Contract(tokenAddress, TOKEN_ABI, withSigner ? signer : provider);
    return { auction, token };
  }, [provider, auctionAddress]);


  // Refresh all auction data
  const refreshStatus = useCallback(async () => {
    const contracts = await getContracts();
    const account = (await provider?.getSigner())?.address;
    if (!contracts || !provider) return;
    const { auction, token } = contracts;

    try {
      const [
        _startPrice,
        _reservePrice,
        _totalTokens,
        _auctionEnded,
        _started,
        _startTime,
        _duration,
        _seller,
        _symbol,
      ] = await Promise.all([
        auction.startPrice(),
        auction.reservePrice(),
        auction.totalTokens(),
        auction.auctionEnded(),
        auction.started(),
        auction.startTime(),
        auction.AUCTION_DURATION(),
        auction.seller(),
        token.symbol(),
      ]);

      setStartPrice(formatEther(_startPrice));
      setReservePrice(formatEther(_reservePrice));
      setTotalTokens(formatEther(_totalTokens));
      setAuctionEnded(_auctionEnded);
      setStarted(_started);
      setStartTime(Number(_startTime));
      setAuctionDuration(Number(_duration));
      setSeller(_seller);
      setTokenSymbol(_symbol);

      // Price and time
      if (!_auctionEnded) {
        const price = await auction.getCurrentPrice();
        setCurrentPrice(formatEther(price));
      } else {
        const cPrice = await auction.clearingPrice();
        setClearingPrice(formatEther(cPrice));
      }

      // My data
      if (account) {
        setMyBid(formatEther(await auction.bids(account)));
        setMyTokenBal(formatEther(await token.balanceOf(account)));
      }

      // Sold Pct
      const sold = await auction.totalBidAmount();
      const price = _auctionEnded ? await auction.clearingPrice() : await auction.getCurrentPrice();
      if (price > 0) {
        const tokensSold = (sold * BigInt(1e18)) / price;
        setSoldPct((Number(formatEther(tokensSold)) / Number(formatEther(_totalTokens))) * 100);
      }
    } catch (err) {
      console.error("Error refreshing status:", err);
    }
  }, [getContracts, provider]);


  useEffect(() => {
    if (provider && auctionAddress) {
      refreshStatus();
      // Set up an interval for live price updates
      const id = setInterval(refreshStatus, 5000);
      return () => clearInterval(id);
    }
  }, [provider, auctionAddress, refreshStatus]);

  const placeBid = async (amount: string) => {
    const contracts = await getContracts(true); // Get with signer
    if (!contracts) throw new Error("Contracts not ready");
    const tx = await contracts.auction.bid({ value: parseEther(amount) });
    await tx.wait();
  };

  const claimTokens = async () => {
    const contracts = await getContracts(true);
    if (!contracts) throw new Error("Contracts not ready");
    const tx = await contracts.auction.claimTokens();
    await tx.wait();
  };

  const startAuction = async () => {
    const contracts = await getContracts(true);
    if (!contracts) throw new Error("Contracts not ready");
    const tx = await contracts.auction.start();
    await tx.wait();
  };

  const endAuction = async () => {
    const contracts = await getContracts(true);
    if (!contracts) throw new Error("Contracts not ready");
    const tx = await contracts.auction.endAuction();
    await tx.wait();
  };

  const burnUnsoldTokens = async () => {
    const contracts = await getContracts(true);
    if (!contracts) throw new Error("Contracts not ready");
    const tx = await contracts.auction.burnUnsoldTokens();
    await tx.wait();
  };

  const withdrawFunds = async () => {
    const contracts = await getContracts(true);
    if (!contracts) throw new Error("Contracts not ready");
    const tx = await contracts.auction.withdrawFunds();
    await tx.wait();
  };

  return {
    currentPrice,
    timeRemaining,
    startPrice,
    reservePrice,
    totalTokens,
    clearingPrice,
    myBid,
    myTokenBal,
    tokenSymbol,
    soldPct,
    auctionEnded,
    started,
    startTime,
    auctionDuration,
    seller,
    placeBid,
    claimTokens,
    refreshStatus,
    endAuction,
    startAuction,
    burnUnsoldTokens,
    withdrawFunds,
  };
};