import { http, createConfig } from "wagmi";
import { mainnet, polygon, arbitrum } from "wagmi/chains";

export const config = createConfig({
  chains: [mainnet, polygon, arbitrum],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [arbitrum.id]: http(),
  },
});