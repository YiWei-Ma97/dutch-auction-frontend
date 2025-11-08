import React, { useState, useEffect } from 'react';
import { ethers, BrowserProvider, Contract } from 'ethers'; 
import { toast } from 'react-hot-toast'; 
import {
    convertEthToWei,
    decodeTransactionLogs, 
    exportTokenToMetaMask
} from '../utils';
import { 
    TOKEN_FACTORY_ADDRESS, 
    DUTCH_AUCTION_FACTORY_ADDRESS 
} from '../config';

import TokenFactoryAbi from '../lib/abis/TokenFactory.json';
import DutchAuctionFactoryAbi from '../lib/abis/DutchAuctionFactory.json';
import Erc20Abi from '../lib/abis/erc20.json';
import { type TransactionReceipt } from 'viem'; 

const formStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '14px',
    border: '1px solid #1f2630', 
    borderRadius: '14px',        
    background: '#0e1621',      
    marginBottom: '20px',       
};

const inputStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderRadius: 10,
    background: '#0e1621',      
    border: '1px solid #2a3341', 
    color: '#e6edf3',           
    fontSize: '14px',
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  background: "#0b5cff",
  border: "1px solid #4169e1",
  color: "white",
  cursor: "pointer",
  opacity: 1,
};

const warningButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: '#ffc107',
  color: 'black',
  border: '1px solid #ffc107',
};

interface CreateAuctionProps {
    provider: BrowserProvider | null;
    onAuctionCreated: (auctionAddress: string) => void; 
}

export const CreateAuction = ({ provider, onAuctionCreated }: CreateAuctionProps) => {
    
    const [formData, setFormData] = useState({
        tokenName: '',
        tokenTicker: '',
        tokenQty: '',
        startingPrice: '',
        reservePrice: '', 
    });
    
    const [derivedValues, setDerivedValues] = useState<{
        qtyWei: bigint,
        startPriceWei: bigint,
        reservePriceWei: bigint
    }>({ qtyWei: 0n, startPriceWei: 0n, reservePriceWei: 0n });

    const [tokenAddress, setTokenAddress] = useState<`0x${string}` | null>(null);
    const [auctionAddress, setAuctionAddress] = useState<`0x${string}` | null>(null);
    const [needsTokenDeploy, setNeedsTokenDeploy] = useState(false);
    const [needsApproval, setNeedsApproval] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const qtyWei = convertEthToWei(formData.tokenQty);
        const startPriceWei = convertEthToWei(formData.startingPrice);
        const reservePriceWei = convertEthToWei(formData.reservePrice);
        setDerivedValues({ qtyWei, startPriceWei, reservePriceWei });
    }, [formData]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const checkTokenExistence = async () => {
        if (!provider) {
            toast.error("Wallet not connected or client not ready."); 
            return;
        }
        if (!formData.tokenName || !formData.tokenTicker) return;
        toast.loading('Checking for existing token...'); 
        
        try {
            const tokenFactoryContract = new Contract(TOKEN_FACTORY_ADDRESS, TokenFactoryAbi.abi, provider);
            const tokenCount = (await tokenFactoryContract.tokenCount()) as bigint;

            for (let i = 0n; i < tokenCount; i++) {
                const address = (await tokenFactoryContract.tokens(i)) as `0x${string}`;
                const tokenContract = new Contract(address, Erc20Abi, provider);

                const name = (await tokenContract.name()) as string;
                const symbol = (await tokenContract.symbol()) as string;

                if (name === formData.tokenName && symbol === formData.tokenTicker) {
                    toast.success(`Token found at ${address}. Ready to create auction.`); 
                    setTokenAddress(address);
                    setNeedsTokenDeploy(false);
                    return;
                }
            }
            toast.error('Token not found. Please deploy the token first.'); 
            setNeedsTokenDeploy(true);
            setTokenAddress(null);
        } catch (error: any) {
            console.error("Error checking token existence:", error);
            toast.error(`Error: ${error.message}`); 
        }
    };

    const handleSubmit = async () => {
        setTokenAddress(null);
        setAuctionAddress(null);
        setNeedsApproval(false);
        setNeedsTokenDeploy(false);
        toast.loading("Checking token...");

        if (!provider) {
            toast.error("Please connect your wallet first."); 
            return;
        }
        setIsLoading(true);
        await checkTokenExistence(); 
        setIsLoading(false);
    };

    const handleDeployToken = async () => {
        if (!provider || !needsTokenDeploy) return;
        
        if (derivedValues.startPriceWei <= derivedValues.reservePriceWei) {
            toast.error("Starting price must be greater than reserve price."); 
            return;
        }

        toast("Deploying token... (Check MetaMask)"); 
        setIsLoading(true);

        try {
            const signer = await provider.getSigner();
            const tokenFactoryContract = new Contract(TOKEN_FACTORY_ADDRESS, TokenFactoryAbi.abi, signer);
            
            const tx = await tokenFactoryContract.deployToken(
                formData.tokenName,
                formData.tokenTicker,
                derivedValues.qtyWei
            );
            const receipt = await tx.wait(); 
            
            const logs = decodeTransactionLogs(TokenFactoryAbi.abi, receipt as unknown as TransactionReceipt);
            const tokenAdd = logs[0]?.args?.tokenAddress as `0x${string}`;
            
            if (tokenAdd) {
                toast.success(`Token deployed at ${tokenAdd}. Now deploying auction...`); 
                setTokenAddress(tokenAdd); 
                setNeedsTokenDeploy(false); 
                exportTokenToMetaMask(tokenAdd, formData.tokenTicker);
                await handleDeployAuction(tokenAdd); 
            }
        } catch (err: any) {
            toast.error(`Token deployment failed: ${err.message}`); 
            setIsLoading(false);
        }
    };

    const handleDeployAuction = async (deployedTokenAddress: `0x${string}` | null) => {
        const finalTokenAddress = tokenAddress || deployedTokenAddress;
        if (!provider || !finalTokenAddress) return;

        if (derivedValues.startPriceWei <= derivedValues.reservePriceWei) {
            toast.error("Starting price must be greater than reserve price."); 
            setIsLoading(false);
            return;
        }
        
        toast("Deploying auction... (Check MetaMask)"); 
        setIsLoading(true); 

        try {
            const signer = await provider.getSigner();
            const auctionFactoryContract = new Contract(DUTCH_AUCTION_FACTORY_ADDRESS, DutchAuctionFactoryAbi.abi, signer);

            const tx = await auctionFactoryContract.deployAuction(
                finalTokenAddress,
                derivedValues.qtyWei,
                derivedValues.startPriceWei,
                derivedValues.reservePriceWei
            );
            const receipt = await tx.wait(); 
            
            const logs = decodeTransactionLogs(DutchAuctionFactoryAbi.abi, receipt as unknown as TransactionReceipt);
            const auctionAdd = logs[0]?.args?.auctionAddress as `0x${string}`;

            if (auctionAdd) {
                toast.success(`Success! Auction deployed at ${auctionAdd}. Please click 'Approve' to continue.`); 
                setAuctionAddress(auctionAdd);
                setNeedsApproval(true);
            }
        } catch (err: any) {
             toast.error(`Auction deployment failed: ${err.message}`); 
        }
        setIsLoading(false);
    };

    const handleApprove = async () => {
        if (!provider || !tokenAddress || !auctionAddress) return;
        
        toast("Waiting for approval... (Check MetaMask)"); 
        setIsLoading(true);

        try {
            const signer = await provider.getSigner();
            const tokenContract = new Contract(tokenAddress, Erc20Abi, signer); 
            
            const tx = await tokenContract.approve(auctionAddress, derivedValues.qtyWei);
            await tx.wait(); 
            
            toast.success(`Success! Auction created and approved. Ready to start.`); 
            setNeedsApproval(false); 

            onAuctionCreated(auctionAddress); 
            
        } catch (err: any) {
            toast.error(`Token approval failed: ${err.message}`); 
        }
        setIsLoading(false);
    }

    useEffect(() => {
        if (needsTokenDeploy) {
            handleDeployToken(); 
        } else if (tokenAddress && !needsTokenDeploy) {
            handleDeployAuction(tokenAddress); 
        }
    }, [tokenAddress, needsTokenDeploy]);


    return (
        <div style={formStyle}>
            <h3 style={{marginTop: 0}}>Create New Auction</h3>
            
            <fieldset disabled={needsApproval || isLoading} style={{border: 'none', padding: 0, margin: 0, display: 'contents'}}>
                <input style={inputStyle} name="tokenName" placeholder="Token Name (e.g., MyToken)" value={formData.tokenName} onChange={handleFormChange} />
                <input style={inputStyle} name="tokenTicker" placeholder="Token Ticker (e.g., MYT)" value={formData.tokenTicker} onChange={handleFormChange} />
                <input style={inputStyle} name="tokenQty" type="number" placeholder="Token Quantity (e.g., 1000)" value={formData.tokenQty} onChange={handleFormChange} />
                <input style={inputStyle} name="startingPrice" type="number" placeholder="Starting Price (ETH)" value={formData.startingPrice} onChange={handleFormChange} />
                <input style={inputStyle} name="reservePrice" type="number" placeholder="Reserve Price (ETH)" value={formData.reservePrice} onChange={handleFormChange} />
            </fieldset>

            {!needsApproval ? (
                <button
                    style={{...buttonStyle, cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.5 : 1}}
                    onClick={handleSubmit} 
                    disabled={isLoading}
                >
                    {isLoading ? 'Processing...' : 'Create Auction'}
                </button>
            ) : (
                <button
                    style={{...warningButtonStyle, cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.5 : 1}}
                    onClick={handleApprove} 
                    disabled={isLoading}
                >
                    {isLoading ? 'Approving...' : 'Approve Tokens'}
                </button> 
            )}
        </div>
    );
};