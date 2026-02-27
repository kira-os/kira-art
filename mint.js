/**
 * Kira Art NFT Minting Module
 * Phase 4: Metaplex Integration
 * 
 * Uses Metaplex Umi for NFT minting with Arweave/Irys storage
 */

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { irysUploader } from '@metaplex-foundation/umi-uploader-irys';
import { generateSigner, percentAmount, sol } from '@metaplex-foundation/umi';
import { createNft, mplCore } from '@metaplex-foundation/mpl-core';

// Initialize Umi with devnet endpoint
const umi = createUmi('https://api.devnet.solana.com')
  .use(mplTokenMetadata())
  .use(mplCore())
  .use(irysUploader());

/**
 * Mint an NFT from generative artwork
 * @param {Object} params - Mint parameters
 * @param {string} params.imageData - Base64 or blob of the PNG image
 * @param {string} params.walletAddress - Creator wallet address
 * @param {Object} params.traits - Art traits derived from walletToParams()
 * @returns {Promise<Object>} Mint result with signature and mint address
 */
export async function mintGenerativeNFT({ imageData, walletAddress, traits }) {
  try {
    // 1. Upload image to Arweave via Irys
    console.log('Uploading image to Arweave...');
    const imageUri = await umi.uploader.upload([imageData]);
    console.log('Image uploaded:', imageUri);

    // 2. Generate metadata JSON
    const metadata = {
      name: `Kira Art #${Date.now()}`,
      description: `Generative art seeded from Solana on-chain data. Created by Kira.`,
      image: imageUri[0],
      attributes: Object.entries(traits).map(([trait_type, value]) => ({
        trait_type,
        value: String(value)
      })),
      properties: {
        category: 'image',
        creators: [{
          address: walletAddress,
          share: 100
        }]
      }
    };

    // 3. Upload metadata
    console.log('Uploading metadata...');
    const metadataUri = await umi.uploader.uploadJson(metadata);
    console.log('Metadata uploaded:', metadataUri);

    // 4. Create NFT
    console.log('Minting NFT...');
    const mintSigner = generateSigner(umi);
    
    const result = await createNft(umi, {
      mint: mintSigner,
      name: metadata.name,
      uri: metadataUri,
      sellerFeeBasisPoints: percentAmount(5.5), // 5.5% royalty
      creators: [
        {
          address: umi.identity.publicKey,
          verified: true,
          share: 100
        }
      ]
    }).sendAndConfirm(umi);

    return {
      success: true,
      signature: result.signature,
      mintAddress: mintSigner.publicKey.toString(),
      metadataUri,
      imageUri: imageUri[0]
    };

  } catch (error) {
    console.error('Mint failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test mint on devnet
 * Requires wallet adapter to be connected
 */
export async function testMint() {
  console.log('Testing mint on devnet...');
  
  // This would be called from the UI after wallet connection
  // For now, just return the function signature
  return {
    status: 'ready',
    network: 'devnet',
    note: 'Call mintGenerativeNFT() with wallet connected'
  };
}

export default { mintGenerativeNFT, testMint };
