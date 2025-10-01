import { http, createConfig } from "wagmi";
import { mainnet, polygon, arbitrum, localhost } from "wagmi/chains";

export const config = createConfig({
  chains: [mainnet, polygon, arbitrum, localhost],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [arbitrum.id]: http(),
    [localhost.id]: http("http://127.0.0.1:8545"),
  },
});