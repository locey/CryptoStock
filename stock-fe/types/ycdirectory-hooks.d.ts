import { PublicClient, WalletClient } from 'viem';
import { Chain } from 'viem/chains';
import { Address } from 'viem';

/**
 * Web3 客户端 Hook
 * 提供公共客户端和钱包客户端
 */
export declare const useWeb3Clients: () => {
    publicClient: PublicClient;
    walletClient: WalletClient | null;
    getWalletClient: () => WalletClient;
    chain: Chain;
    chainId: number | undefined;
    address: Address | undefined;
    isConnected: boolean;
};

export default useWeb3Clients;