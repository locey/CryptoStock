// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

struct GetPriceParams {
    string symbol; //股票代码
    bytes[] updateData; //预言机更新数据
}

struct PriceResult {
    uint256 price; // 主要价格
    uint256 minPrice; // 最小价格
    uint256 maxPrice; // 最大价格
    uint256 publishTime; // 发布时间
    bool success; // 操作是否成功
    string errorMessage; // 错误信息（如果有）
}

interface IPriceOracleV2 {
    function getPrice(
        GetPriceParams calldata params
    ) external view virtual returns (PriceResult memory);
}
