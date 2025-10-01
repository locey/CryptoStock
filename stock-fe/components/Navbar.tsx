"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "./ConnectButton";

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-sm border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">CS</span>
              </div>
              <span className="text-white text-xl font-semibold font-chinese">
                币股交易
              </span>
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="/"
              className="text-gray-300 hover:text-white transition-colors text-sm font-medium font-chinese"
            >
              首页
            </Link>
            <Link
              href="/pool"
              className="text-gray-300 hover:text-white transition-colors text-sm font-medium font-chinese"
            >
              币股池
            </Link>
            <Link
              href="/trade"
              className="text-gray-300 hover:text-white transition-colors text-sm font-medium font-chinese"
            >
              交易
            </Link>
            <Link
              href="/portfolio"
              className="text-gray-300 hover:text-white transition-colors text-sm font-medium font-chinese"
            >
              投资组合
            </Link>
          </div>

          {/* Connect Button */}
          <div className="flex items-center">
            <ConnectButton />
          </div>
        </div>
      </div>
    </nav>
  );
}