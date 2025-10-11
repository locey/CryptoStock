// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IPriceOracle.sol";

contract PriceAggregator {
    struct OracleInfo {
        OracleType oracleType;
        address oracleAddress;
        uint256 weight; // 权重，用于加权平均
    }
    
    OracleInfo[] public oracles; // 预言机列表
    uint256 public totalWeight;  // 所有预言机的总权重
    
    // 添加预言机（支持未来扩展）
    function addOracle(OracleType _type, address _address, uint256 _weight) external {
        oracles.push(OracleInfo({
            oracleType: _type,
            oracleAddress: _address,
            weight: _weight
        }));
        totalWeight += _weight;
    }
    
    // 移除预言机（简化，只支持移除最后一个）
    function removeLastOracle() external {
        require(oracles.length > 0, "No oracles");
        totalWeight -= oracles[oracles.length - 1].weight;
        oracles.pop();
    }

    // 获取加权平均价格
    function getAggregatedPrice(
        string memory symbol, 
        bytes[][] calldata updateDataArray  // 每个预言机对应一个 bytes[] 数组
    ) external payable returns (uint256) {
        require(oracles.length > 0, "No oracles");
        require(updateDataArray.length == oracles.length, "Update data count mismatch");
        
        uint256 totalPrice = 0;
        uint256 totalWeightSum = 0;

        for (uint i = 0; i < oracles.length; i++) {
            // 构造参数，使用对应预言机的更新数据
            OperationParams memory params = OperationParams({
                symbol: symbol,
                updateData: updateDataArray[i]  // 使用对应索引的更新数据
            });
            
            // 直接获取价格（内部会自动更新）
            try IPriceFeed(oracles[i].oracleAddress).getPrice{value: msg.value / oracles.length}(params) returns (OperationResult memory result) {
                if (result.success && result.price > 0) {
                    totalPrice += result.price * oracles[i].weight;
                    totalWeightSum += oracles[i].weight;
                }
            } catch {
                // 获取价格失败时跳过该预言机
                continue;
            }
        }
        
        require(totalWeightSum > 0, "No valid prices");
        return totalPrice / totalWeightSum; // 返回加权平均价格
    }
}