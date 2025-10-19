"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatAddress } from "@/lib/utils";

interface FormattedAddressProps {
  address: string;
  startLength?: number;
  endLength?: number;
  className?: string;
  showCopy?: boolean;
}

export function FormattedAddress({
  address,
  startLength = 6,
  endLength = 4,
  className = "",
  showCopy = true
}: FormattedAddressProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!address) {
    return <span className={className}>未连接</span>;
  }

  const displayAddress = isExpanded ? address : formatAddress(address, startLength, endLength);
  const canToggle = address.length > startLength + endLength;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const handleClick = () => {
    if (canToggle) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className={`font-mono text-xs ${canToggle ? 'cursor-pointer hover:text-blue-400 transition-colors' : ''} ${className}`}
        onClick={handleClick}
        title={isExpanded ? "点击收起" : canToggle ? "点击展开完整地址" : address}
      >
        {displayAddress}
      </span>

      {showCopy && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-gray-700"
          onClick={handleCopy}
          title="复制地址"
        >
          {copied ? (
            <Check className="w-3 h-3 text-green-400" />
          ) : (
            <Copy className="w-3 h-3 text-gray-400 hover:text-white" />
          )}
        </Button>
      )}
    </div>
  );
}