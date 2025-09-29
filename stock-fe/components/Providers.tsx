"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { config } from "@/lib/wagmi";
import { ReactNode, useState } from "react";
import { WalletProvider } from "ycdirectory-ui";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <WalletProvider
          config={{
            appName: "CryptoStock",
            chains: [
              { id: 1, name: "Ethereum", rpcUrl: "https://eth.public-rpc.com" },
              { id: 137, name: "Polygon", rpcUrl: "https://polygon-rpc.com" },
              { id: 42161, name: "Arbitrum", rpcUrl: "https://arb1.arbitrum.io/rpc" }
            ],
            storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          }}
          autoConnect={true}
        >
          {children}
        </WalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}