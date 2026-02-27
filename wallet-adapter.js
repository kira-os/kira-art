/**
 * Kira Art Wallet Adapter
 * Phase 4.2: Phantom/Solflare Integration
 * 
 * Replaces the wallet input field with proper wallet adapter
 */

import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';

// Network configuration
const NETWORK = WalletAdapterNetwork.Devnet; // Switch to Mainnet for production
const RPC_ENDPOINT = 'https://api.devnet.solana.com';

// Supported wallets
const WALLETS = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter()
];

/**
 * Wallet Connection Component
 * Provides "Connect Wallet" button and displays connected wallet info
 */
export function WalletConnect({ onWalletConnected }) {
  const { publicKey, connected, connecting, disconnect } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    if (connected && publicKey) {
      // Fetch wallet balance
      connection.getBalance(publicKey).then(lamports => {
        setBalance(lamports / 1e9); // Convert to SOL
      });
      
      // Notify parent component
      if (onWalletConnected) {
        onWalletConnected(publicKey.toString());
      }
    }
  }, [connected, publicKey, connection, onWalletConnected]);

  if (connected && publicKey) {
    return (
      <div className="wallet-connected">
        <span className="wallet-address">
          {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
        </span>
        <span className="wallet-balance">
          {balance !== null ? `${balance.toFixed(4)} SOL` : 'Loading...'}
        </span>
        <button onClick={disconnect} className="disconnect-btn">
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <WalletMultiButton className="connect-wallet-btn">
      {connecting ? 'Connecting...' : 'Connect Wallet'}
    </WalletMultiButton>
  );
}

/**
 * Wallet Provider Wrapper
 * Wraps the app with Solana wallet context
 */
export function WalletContextProvider({ children }) {
  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      <WalletProvider wallets={WALLETS} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}

/**
 * Mint Button Component
 * Shows mint preview and triggers mint flow
 */
export function MintButton({ artworkData, traits, onMintComplete }) {
  const { publicKey, connected } = useWallet();
  const [isMinting, setIsMinting] = useState(false);
  const [mintStatus, setMintStatus] = useState(null);

  const handleMint = async () => {
    if (!connected || !publicKey) {
      setMintStatus({ error: 'Please connect your wallet first' });
      return;
    }

    setIsMinting(true);
    setMintStatus({ message: 'Preparing artwork...' });

    try {
      // Import mint function
      const { mintGenerativeNFT } = await import('./mint.js');
      
      setMintStatus({ message: 'Uploading to Arweave...' });
      
      const result = await mintGenerativeNFT({
        imageData: artworkData,
        walletAddress: publicKey.toString(),
        traits
      });

      if (result.success) {
        setMintStatus({ 
          success: true, 
          message: `Minted! View on Solscan: ${result.mintAddress}` 
        });
        if (onMintComplete) onMintComplete(result);
      } else {
        setMintStatus({ error: result.error });
      }
    } catch (error) {
      setMintStatus({ error: error.message });
    } finally {
      setIsMinting(false);
    }
  };

  if (!connected) {
    return (
      <div className="mint-prompt">
        <p>Connect your wallet to mint this artwork</p>
      </div>
    );
  }

  return (
    <div className="mint-section">
      <button 
        onClick={handleMint} 
        disabled={isMinting}
        className={`mint-btn ${isMinting ? 'minting' : ''}`}
      >
        {isMinting ? 'Minting...' : 'Mint NFT'}
      </button>
      
      {mintStatus && (
        <div className={`mint-status ${mintStatus.error ? 'error' : ''} ${mintStatus.success ? 'success' : ''}`}>
          {mintStatus.message || mintStatus.error}
        </div>
      )}
    </div>
  );
}

export default { WalletConnect, WalletContextProvider, MintButton };
