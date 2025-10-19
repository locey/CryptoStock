declare module '@/lib/abi/deployments-yearnv3-adapter-sepolia.json' {
  export const contracts: {
    DefiAggregator: string;
    MockERC20_USDT: string;
    MockYearnV3Vault: string;
    YearnV3Adapter: string;
    YearnV3Adapter_Implementation: string;
  };
  export const adapterRegistrations: {
    yearnv3: string;
  };
  export const network: string;
  export const chainId: string;
  export const deployer: string;
  export const timestamp: string;
  export const feeRateBps: number;
  export const basedOn: string;
  export const notes: {
    description: string;
    reusedContracts: string[];
    newContracts: string[];
  };
}

declare module '@/lib/abi/*.json' {
  const abi: any[];
  export default abi;
}