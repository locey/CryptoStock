"use client";

import { EnhancedConnectButton } from "yc-sdk-ui";

export function ConnectButton() {
  return (
    <EnhancedConnectButton
      showBalance={true}
      showChainSwitcher={true}
      size="md"
      variant="primary"
      onConnect={(result) => {
        if (result.success) {
          console.log("钱包连接成功:", result);
        } else {
          console.error("钱包连接失败:", result.error);
        }
      }}
      onDisconnect={() => {
        console.log("钱包已断开连接");
      }}
      className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium text-sm font-chinese"
    />
  );
}
