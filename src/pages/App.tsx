import { useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import { ethers } from "ethers";
import { useAuction } from "../hooks/useAuction";
import { SEPOLIA_CHAIN_ID } from "../config";
import LinearProgress from '@mui/material/LinearProgress';

export default function App() {
  const {
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
    withdrawFunds       
  } = useAuction();

  const [account, setAccount] = useState<string | null>(null);
  const [networkOk, setNetworkOk] = useState<boolean>(false);
  const [amount, setAmount] = useState("");

  const disabled = !account || !networkOk;

  // Check if connected account is the seller
  const isSeller = !!(account && seller && account.toLowerCase() === seller.toLowerCase());

  const [computedRemaining, setComputedRemaining] = useState<number>(0);
  const [loadingAction, setLoadingAction] = useState(false);

  useEffect(() => {
    if (!startTime || !auctionDuration) return;
    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      const rem = Math.max(0, startTime + auctionDuration - now);
      setComputedRemaining(rem);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime, auctionDuration]);

  // Live ticking countdown
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // 🦊 Connect wallet
  async function connectWallet() {
    if (!(window as any).ethereum)
      return toast.error("Please install MetaMask to continue.");
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();
      setAccount(accounts[0] || null);
      if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) await switchToSepolia();
      else {
        setNetworkOk(true);
        toast.success("🦊 Wallet connected");
        setTimeout(() => refreshStatus(), 500);
      }
      refreshStatus();
    } catch {
      toast.error("Failed to connect wallet.");
    }
  }

  // 🌐 Switch to Sepolia
  async function switchToSepolia() {
    const ethereum = (window as any).ethereum;
    if (!ethereum) return toast.error("MetaMask not detected.");
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }],
      });
      setNetworkOk(true);
      toast.success("🌐 Switched to Sepolia");
    } catch (err: any) {
      if (err.code === 4902) {
        try {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0xaa36a7",
                chainName: "Sepolia Test Network",
                nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://1rpc.io/sepolia"],
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          });
          setNetworkOk(true);
          toast.success("✅ Sepolia network added!");
          setTimeout(() => refreshStatus(), 500);
        } catch {
          toast.error("Failed to add Sepolia network.");
        }
      } else {
        toast.error("Please switch to Sepolia Testnet manually.");
      }
    }
  }

  // Detect wallet/network changes
  useEffect(() => {
    if (!(window as any).ethereum) return;
    const eth = (window as any).ethereum;

    const handleAcc = async (accounts: string[]) => {
      setAccount(accounts[0] || null);
      if (accounts.length > 0) {
        try {
          await refreshStatus();
        } catch (err) {
          console.warn("Failed to refresh after account change:", err);
        }
      }
    };

    const handleChain = async (chainId: string) => {
      const ok = parseInt(chainId, 16) === SEPOLIA_CHAIN_ID;
      setNetworkOk(ok);
      if (ok && account) {
        try {
          await refreshStatus();
        } catch (err) {
          console.warn("Failed to refresh after chain switch:", err);
        }
      }
    };

    eth.on("accountsChanged", handleAcc);
    eth.on("chainChanged", handleChain);

    return () => {
      eth.removeListener("accountsChanged", handleAcc);
      eth.removeListener("chainChanged", handleChain);
    };
  }, [account, refreshStatus]);

  // 🧭 On page load, check if already connected
  useEffect(() => {
    async function checkConnection() {
      if (!(window as any).ethereum) return;
      try {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const accounts = await provider.send("eth_accounts", []);
        const network = await provider.getNetwork();
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          const correctNetwork = Number(network.chainId) === SEPOLIA_CHAIN_ID;
          setNetworkOk(correctNetwork);
          if (correctNetwork) setTimeout(() => refreshStatus(), 500);
        }
      } catch (err) {
        console.warn("Wallet not connected:", err);
      }
    }
    checkConnection();
  }, []);

  // Helper formatters
  const fmtEth = (v?: string) => (v ? `${Number(v).toFixed(4)} ETH` : "—");
  const fmtTok = (v?: string) =>
    v ? `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${tokenSymbol ?? ""}` : "—";

  // 🔔 Show toast when trying to interact while not connected
  const guardAction = async (fn: () => Promise<any>, label: string) => {
    if (!account) return toast.error("Please connect your wallet first 🦊");
    if (!networkOk) return toast.error("Please switch to Sepolia Testnet 🌐");
    try {
      setLoadingAction(true);
      await fn();
      setLoadingAction(false);
      toast.success(`${label} successful ✅`);
      refreshStatus();
    } catch (e: any) {
      setLoadingAction(false);
      toast.error(e?.reason || e?.message || `${label} failed ❌`);
    }
  };

  return (
    <div>
      <Toaster position="top-right" />
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 18px" }}>
        <h1 style={{ margin: "8px 0 12px 0", fontSize: 26 }}>Dutch Auction</h1>
        <p style={{ opacity: 0.8, marginTop: 0, fontSize: 14 }}>
          A 20-minute descending-price sale. Connect on Sepolia and place a bid
          with ETH. Everyone settles at the clearing price.
        </p>

        {/* ---- Wallet Connection Section ---- */}
        {!account ? (
          <button onClick={connectWallet} style={btnStyle}>
            🦊 Connect Wallet
          </button>
        ) : (
          <div
            style={{
              marginTop: 10,
              fontSize: 13,
              opacity: 0.85,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap"
            }}
          >
            <span>Connected:</span>
            <span
              style={{
                fontFamily: "monospace",
                background: "#0e1621",
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid #2a3341",
              }}
            >
              {account.slice(0, 8)}...{account.slice(-6)}
            </span>
            {isSeller && (
              <span
                style={{
                  color: "#f59e0b",
                  fontWeight: 600,
                  fontSize: 12,
                  background: "#451a03",
                  border: "1px solid #78350f",
                  borderRadius: 6,
                  padding: "2px 6px",
                }}
              >
                👑 Admin
              </span>
            )}
            {networkOk ? (
              <span
                style={{
                  color: "#22c55e",
                  fontWeight: 600,
                  fontSize: 12,
                  background: "#052e16",
                  border: "1px solid #14532d",
                  borderRadius: 6,
                  padding: "2px 6px",
                }}
              >
                ✅ Sepolia Connected
              </span>
            ) : (
              <button
                onClick={switchToSepolia}
                style={{
                  background: "#b91c1c",
                  border: "1px solid #ef4444",
                  borderRadius: 6,
                  padding: "4px 8px",
                  color: "white",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                ⚠️ Switch to Sepolia
              </button>
            )}
          </div>
        )}

        {!networkOk && account && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 8,
              background: "#331f1f",
              border: "1px solid #ff4d4f",
              color: "#ffccc7",
            }}
          >
            ⚠️ Please switch your wallet network to{" "}
            <strong>Sepolia Testnet</strong>.
          </div>
        )}

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 14,
            marginTop: 16,
          }}
        >
          <Card title="Current Price" value={fmtEth(currentPrice)} />
          <Card
            title="Time Remaining"
            value={
              auctionEnded
                ? "Ended"
                : computedRemaining > 0
                  ? `${Math.floor(computedRemaining / 60)}m ${computedRemaining % 60}s`
                  : "Ended"
            }
          />
          <Card title="Start / Reserve" value={`${fmtEth(startPrice)} → ${fmtEth(reservePrice)}`} />
          <Card title="Total Tokens" value={fmtTok(totalTokens)} />
          <Card title="Sold (approx)" value={soldPct !== undefined ? `${soldPct.toFixed(1)}%` : "—"} />
          <Card title="My Bid" value={fmtEth(myBid)} />
          <Card title="Ended?" value={auctionEnded ? "Yes" : "No"} />
          <Card title="Clearing Price" value={fmtEth(clearingPrice)} />
          <Card title="My Token Bal" value={fmtTok(myTokenBal)} />
        </section>

        {/* ===== Actions Row ===== */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>

          {/* Buyer UI (non-admin) */}
          {!isSeller && (
            <>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="ETH amount"
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "#0e1621",
                  border: "1px solid #2a3341",
                  color: "#e6edf3",
                  minWidth: 150,
                  opacity: disabled ? 0.5 : 1,
                  cursor: disabled ? "not-allowed" : "text",
                }}
                disabled={disabled}
              />

              <button
                disabled={disabled || auctionEnded || !started || loadingAction}
                onClick={() => guardAction(() => placeBid(amount), "Bid")}
                style={(disabled || auctionEnded || !started || loadingAction) ? btnStyleDisabled : btnStyle}
              >
                Place Bid
              </button>

              <button
                disabled={disabled || !auctionEnded || loadingAction}
                onClick={() => guardAction(claimTokens, "Claim")}
                style={(disabled || !auctionEnded || loadingAction) ? btnStyleDisabled : btnStyle}
              >
                Claim Tokens
              </button>
            </>
          )}

          {/* Admin UI (seller only) */}
          {isSeller && (
            <>
              <button
                disabled={disabled || started || loadingAction}
                onClick={() => guardAction(startAuction, "Auction started")}
                style={(disabled || started || loadingAction) ? btnStyleDisabled : btnStyle}
              >
                🟢 Start Auction
              </button>

              <button
                disabled={disabled || auctionEnded || (computedRemaining > 0) || loadingAction}
                onClick={() => guardAction(endAuction, "Auction ended")}
                style={(disabled || auctionEnded || computedRemaining > 0 || loadingAction) ? btnStyleDisabled : btnStyle}
                title={computedRemaining > 0 ? "Can only end after 20 minutes or when sold out" : "End auction and set clearing price"}
              >
                🛑 End Auction
              </button>

              {/*Burn & Withdraw — enabled only after auction ends */}
              <button
                disabled={disabled || !auctionEnded || loadingAction}
                onClick={() => guardAction(burnUnsoldTokens, "Burned unsold tokens")}
                style={(disabled || !auctionEnded || loadingAction) ? btnStyleDisabled : btnStyle}
                title="Burn remaining sale tokens held by the auction contract"
              >
                🔥 Burn Unsold Tokens
              </button>

              <button
                disabled={disabled || !auctionEnded || loadingAction}
                onClick={() => guardAction(withdrawFunds, "Withdrew ETH")}
                style={(disabled || !auctionEnded || loadingAction) ? btnStyleDisabled : btnStyle}
                title="Withdraw the ETH raised to the seller wallet"
              >
                💸 Withdraw ETH
              </button>
            </>
          )}
        </div>

        {
          loadingAction && <LinearProgress sx={{ marginTop: 1 }} />
        }

        <div style={{ marginTop: 24, fontSize: 13, opacity: 0.75 }}>
          <p>
            Etherscan:{" "}
            <a
              href="https://sepolia.etherscan.io/address/0x47f8f48Fc99DEfc2A3D3655Aea02DE678030742e#code"
              target="_blank"
              rel="noopener noreferrer"
            >
              Auction
            </a>{" "}
            •{" "}
            <a
              href="https://sepolia.etherscan.io/address/0x61df7fFF1F7c9e0F66c733E4B119b6C1FE7B0a74#code"
              target="_blank"
              rel="noopener noreferrer"
            >
              Token
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ padding: 14, border: "1px solid #1f2630", borderRadius: 14, background: "#0e1621" }}>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 18 }}>{value}</div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  background: "#0b5cff",
  border: "1px solid #4169e1",
  color: "white",
  cursor: "pointer",
  opacity: 1,
};

const btnStyleDisabled: React.CSSProperties = {
  ...btnStyle,
  opacity: 0.5,
  background: "#243042",
  border: "1px solid #2a3341",
  cursor: "not-allowed",
};
