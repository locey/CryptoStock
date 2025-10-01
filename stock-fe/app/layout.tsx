import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Providers } from "@/components/Providers";
import { Toaster } from "@/components/ui/toaster";

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
      <body className="antialiased">
        <Providers>
          <Navbar />
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}