import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CryptoStock - Decentralized Stock Trading",
  description: "Trade real stocks as ERC20 tokens on the blockchain with real-time price feeds",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}