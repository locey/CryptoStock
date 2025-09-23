// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./OracleAggregator.sol";

contract StockTokenV2 is
    Initializable,
    ERC20Upgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    OracleAggregator public oracleAggregator;
    IERC20 public usdtToken;
    string public stockSymbol;
    uint256 public minTradeAmount;
    uint256 public maxSlippage;
    uint256 public tradeFeeRate;
    address public feeReceiver;

    // V2新增变量
    string public upgradeNote;

    // V2新增函数
    function setUpgradeNote(string memory note) external onlyOwner {
        upgradeNote = note;
    }

    function getUpgradeNote() external view returns (string memory) {
        return upgradeNote;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address _oracleAggregator,
        address _usdtToken
    ) public initializer {
        __ERC20_init(name, symbol);
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        oracleAggregator = OracleAggregator(_oracleAggregator);
        usdtToken = IERC20(_usdtToken);
        stockSymbol = symbol;
        _mint(msg.sender, initialSupply);
        minTradeAmount = 1e6;
        maxSlippage = 300;
        tradeFeeRate = 30;
        feeReceiver = msg.sender;
        upgradeNote = "";
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
