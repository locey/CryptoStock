const { expect } = require("chai");
const { ethers, deployments } = require("hardhat");

describe("TokenFactory - 代币工厂合约测试", function () {
  let tokenFactory;
  let oracleAggregator;
  let stockTokenImplementation;
  let usdtToken;
  let owner, user1, user2;

  // 测试参数
  const testParams = {
    tokenName: "Test Stock Token",
    tokenSymbol: "TEST1",
    initialSupply: ethers.utils.parseEther("1000000"), // 100万代币
    
    tokenName2: "Test Stock Token 2", 
    tokenSymbol2: "TEST2",
    initialSupply2: ethers.utils.parseEther("500000"), // 50万代币
  };

  beforeEach(async function () {
    console.log("🚀 [SETUP] 初始化代币工厂测试环境...");

    [owner, user1, user2] = await ethers.getSigners();
    console.log(`📝 Owner: ${owner.address}`);
    console.log(`📝 User1: ${user1.address}`);
    console.log(`📝 User2: ${user2.address}`);

    // 使用部署脚本部署所有合约
    console.log("📄 [STEP 1] 使用部署脚本部署系统...");
    await deployments.fixture(["CryptoStockSystem"]);

    // 获取已部署的合约
    console.log("📄 [STEP 2] 获取部署的合约实例...");
    
    // 获取 USDT 代币
    const usdtDeployment = await deployments.get("MockERC20_USDT");
    usdtToken = await ethers.getContractAt("MockERC20", usdtDeployment.address);
    console.log(`✅ USDT 代币获取完成: ${usdtDeployment.address}`);

    // 获取预言机聚合器
    const oracleDeployment = await deployments.get("OracleAggregator");
    oracleAggregator = await ethers.getContractAt("OracleAggregator", oracleDeployment.address);
    console.log(`✅ 预言机聚合器获取完成: ${oracleDeployment.address}`);

    // 获取 StockToken 实现合约
    const implementationDeployment = await deployments.get("StockToken_Implementation");
    stockTokenImplementation = await ethers.getContractAt("StockToken", implementationDeployment.address);
    console.log(`✅ StockToken 实现合约获取完成: ${implementationDeployment.address}`);

    // 获取代币工厂合约
    const factoryDeployment = await deployments.get("TokenFactory");
    tokenFactory = await ethers.getContractAt("TokenFactory", factoryDeployment.address);
    console.log(`✅ 代币工厂合约获取完成: ${factoryDeployment.address}`);

    console.log("🎉 [SETUP] 测试环境初始化完成！\\n");
  });

  describe("1. 合约初始化验证", function () {
    it("应该正确设置 owner", async function () {
      expect(await tokenFactory.owner()).to.equal(owner.address);
    });

    it("应该正确设置预言机聚合器地址", async function () {
      expect(await tokenFactory.oracleAggregator()).to.equal(oracleAggregator.address);
    });

    it("应该正确设置 StockToken 实现合约地址", async function () {
      expect(await tokenFactory.stockTokenImplementation()).to.equal(stockTokenImplementation.address);
    });

    it("应该正确设置 USDT 代币地址", async function () {
      expect(await tokenFactory.usdtTokenAddress()).to.equal(usdtToken.address);
    });

    it("初始化时所有代币列表应该包含部署脚本创建的代币", async function () {
      const allTokens = await tokenFactory.getAllTokens();
      expect(allTokens).to.have.lengthOf(6); // 部署脚本创建了6个代币
    });
  });

  describe("2. 代币创建功能", function () {
    it("应该能成功创建新代币", async function () {
      const tx = await tokenFactory.createToken(
        testParams.tokenName,
        testParams.tokenSymbol,
        testParams.initialSupply
      );

      await expect(tx)
        .to.emit(tokenFactory, "TokenCreated")
        .withArgs(
          await tokenFactory.getTokenAddress(testParams.tokenSymbol),
          testParams.tokenName,
          testParams.tokenSymbol
        );
    });

    it("创建的代币应该有正确的属性", async function () {
      await tokenFactory.createToken(
        testParams.tokenName,
        testParams.tokenSymbol,
        testParams.initialSupply
      );

      const tokenAddress = await tokenFactory.getTokenAddress(testParams.tokenSymbol);
      const stockToken = await ethers.getContractAt("StockToken", tokenAddress);

      expect(await stockToken.name()).to.equal(testParams.tokenName);
      expect(await stockToken.symbol()).to.equal(testParams.tokenSymbol);
      expect(await stockToken.totalSupply()).to.equal(testParams.initialSupply);
      expect(await stockToken.owner()).to.equal(owner.address);
    });

    it("创建的代币应该将所有供应量分配给owner", async function () {
      await tokenFactory.createToken(
        testParams.tokenName,
        testParams.tokenSymbol,
        testParams.initialSupply
      );

      const tokenAddress = await tokenFactory.getTokenAddress(testParams.tokenSymbol);
      const stockToken = await ethers.getContractAt("StockToken", tokenAddress);

      // owner 应该持有所有代币（新逻辑）
      expect(await stockToken.balanceOf(owner.address)).to.equal(testParams.initialSupply);
      // 合约本身不应该直接持有代币
      expect(await stockToken.balanceOf(tokenAddress)).to.equal(0);
    });

    it("不应该允许重复的代币符号", async function () {
      // 创建第一个代币
      await tokenFactory.createToken(
        testParams.tokenName,
        testParams.tokenSymbol,
        testParams.initialSupply
      );

      // 尝试创建相同符号的代币应该失败
      await expect(
        tokenFactory.createToken(
          "Another Token",
          testParams.tokenSymbol, // 相同符号
          testParams.initialSupply
        )
      ).to.be.revertedWith("Token already exists");
    });

    it("只有 owner 可以创建代币", async function () {
      await expect(
        tokenFactory.connect(user1).createToken(
          testParams.tokenName,
          testParams.tokenSymbol,
          testParams.initialSupply
        )
      ).to.be.revertedWithCustomError(tokenFactory, "OwnableUnauthorizedAccount");
    });

    it("应该能创建多个不同的代币", async function () {
      // 创建第一个代币
      await tokenFactory.createToken(
        testParams.tokenName,
        testParams.tokenSymbol,
        testParams.initialSupply
      );

      // 创建第二个代币
      await tokenFactory.createToken(
        testParams.tokenName2,
        testParams.tokenSymbol2,
        testParams.initialSupply2
      );

      // 验证两个代币都存在且不同
      const token1Address = await tokenFactory.getTokenAddress(testParams.tokenSymbol);
      const token2Address = await tokenFactory.getTokenAddress(testParams.tokenSymbol2);

      expect(token1Address).to.not.equal(ethers.ZeroAddress);
      expect(token2Address).to.not.equal(ethers.ZeroAddress);
      expect(token1Address).to.not.equal(token2Address);
    });
  });

  describe("3. 代币地址查询", function () {
    beforeEach(async function () {
      // 创建测试代币
      await tokenFactory.createToken(
        testParams.tokenName,
        testParams.tokenSymbol,
        testParams.initialSupply
      );
    });

    it("应该能正确查询存在的代币地址", async function () {
      const tokenAddress = await tokenFactory.getTokenAddress(testParams.tokenSymbol);
      expect(tokenAddress).to.not.equal(ethers.constants.AddressZero);
    });

    it("查询不存在的代币应该返回零地址", async function () {
      const tokenAddress = await tokenFactory.getTokenAddress("NONEXISTENT");
      expect(tokenAddress).to.equal(ethers.constants.AddressZero);
    });

    it("代币符号查询应该区分大小写", async function () {
      const upperCase = await tokenFactory.getTokenAddress("AAPL");
      const lowerCase = await tokenFactory.getTokenAddress("aapl");
      
      expect(upperCase).to.not.equal(ethers.constants.AddressZero);
      expect(lowerCase).to.equal(ethers.constants.AddressZero);
    });
  });

  describe("4. 所有代币列表查询", function () {
    it("初始状态下应该返回已部署的代币列表", async function () {
      const allTokens = await tokenFactory.getAllTokens();
      expect(allTokens).to.have.lengthOf(6); // 部署脚本创建了6个代币
    });

    it("创建代币后应该正确更新列表", async function () {
      const initialTokens = await tokenFactory.getAllTokens();
      const initialCount = initialTokens.length;
      
      await tokenFactory.createToken(
        testParams.tokenName,
        testParams.tokenSymbol,
        testParams.initialSupply
      );

      const allTokens = await tokenFactory.getAllTokens();
      expect(allTokens).to.have.lengthOf(initialCount + 1);
      expect(allTokens).to.include(await tokenFactory.getTokenAddress(testParams.tokenSymbol));
    });

    it("创建多个代币后应该包含所有代币", async function () {
      const initialTokens = await tokenFactory.getAllTokens();
      const initialCount = initialTokens.length;
      
      // 创建第一个代币
      await tokenFactory.createToken(
        testParams.tokenName,
        testParams.tokenSymbol,
        testParams.initialSupply
      );

      // 创建第二个代币
      await tokenFactory.createToken(
        testParams.tokenName2,
        testParams.tokenSymbol2,
        testParams.initialSupply2
      );

      const allTokens = await tokenFactory.getAllTokens();
      expect(allTokens).to.have.lengthOf(initialCount + 2);
      
      const token1Address = await tokenFactory.getTokenAddress(testParams.tokenSymbol);
      const token2Address = await tokenFactory.getTokenAddress(testParams.tokenSymbol2);
      
      expect(allTokens).to.include(token1Address);
      expect(allTokens).to.include(token2Address);
    });
  });

  describe("5. 预言机地址更新", function () {
    let newOracleAggregator;

    beforeEach(async function () {
      // 部署新的预言机合约用于测试更新
      const mockPythAddress = "0x4305FB66699C3B2702D4d05CF36551390A4c69C6";
      const OracleAggregator = await ethers.getContractFactory("OracleAggregator");
      
      // 使用代理模式部署
      const ERC1967Proxy = await ethers.getContractFactory("ERC1967Proxy");
      const implementation = await OracleAggregator.deploy();
      await implementation.deployed();
      
      const initData = OracleAggregator.interface.encodeFunctionData("initialize", [mockPythAddress]);
      const proxy = await ERC1967Proxy.deploy(implementation.address, initData);
      await proxy.deployed();
      
      newOracleAggregator = OracleAggregator.attach(proxy.address);
    });

    it("owner 应该能更新预言机地址", async function () {
      const newAddress = newOracleAggregator.address;
      
      await expect(tokenFactory.setOracleAggregator(newAddress))
        .to.emit(tokenFactory, "OracleUpdated")
        .withArgs(newAddress);

      expect(await tokenFactory.oracleAggregator()).to.equal(newAddress);
    });

    it("非 owner 不应该能更新预言机地址", async function () {
      const newAddress = newOracleAggregator.address;
      
      await expect(
        tokenFactory.connect(user1).setOracleAggregator(newAddress)
      ).to.be.revertedWithCustomError(tokenFactory, "OwnableUnauthorizedAccount");
    });

    it("不应该允许设置零地址", async function () {
      await expect(
        tokenFactory.setOracleAggregator(ethers.constants.AddressZero)
      ).to.be.revertedWith("Invalid oracle address");
    });
  });

  describe("6. USDT 代币地址管理", function () {
    let newUSDTToken;

    beforeEach(async function () {
      // 部署新的 USDT 代币用于测试更新
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      newUSDTToken = await MockERC20.deploy("New USDT", "USDT2", 18);
      await newUSDTToken.deployed();
    });

    it("owner 应该能更新 USDT 代币地址", async function () {
      const newAddress = newUSDTToken.address;
      
      await tokenFactory.setUSDTTokenAddress(newAddress);
      expect(await tokenFactory.usdtTokenAddress()).to.equal(newAddress);
    });

    it("非 owner 不应该能更新 USDT 代币地址", async function () {
      const newAddress = newUSDTToken.address;
      
      await expect(
        tokenFactory.connect(user1).setUSDTTokenAddress(newAddress)
      ).to.be.revertedWithCustomError(tokenFactory, "OwnableUnauthorizedAccount");
    });

    it("不应该允许设置零地址", async function () {
      await expect(
        tokenFactory.setUSDTTokenAddress(ethers.constants.AddressZero)
      ).to.be.revertedWith("Invalid USDT token address");
    });
  });

  describe("7. StockToken 实现合约管理", function () {
    let newStockTokenImplementation;

    beforeEach(async function () {
      // 部署新的 StockToken 实现合约
      const StockToken = await ethers.getContractFactory("StockToken");
      newStockTokenImplementation = await StockToken.deploy();
      await newStockTokenImplementation.deployed();
    });

    it("owner 应该能更新 StockToken 实现合约地址", async function () {
      const newAddress = newStockTokenImplementation.address;
      
      await expect(tokenFactory.setStockTokenImplementation(newAddress))
        .to.emit(tokenFactory, "ImplementationUpdated")
        .withArgs(newAddress);

      expect(await tokenFactory.stockTokenImplementation()).to.equal(newAddress);
    });

    it("非 owner 不应该能更新实现合约地址", async function () {
      const newAddress = newStockTokenImplementation.address;
      
      await expect(
        tokenFactory.connect(user1).setStockTokenImplementation(newAddress)
      ).to.be.revertedWithCustomError(tokenFactory, "OwnableUnauthorizedAccount");
    });

    it("不应该允许设置零地址", async function () {
      await expect(
        tokenFactory.setStockTokenImplementation(ethers.constants.AddressZero)
      ).to.be.revertedWith("Invalid implementation address");
    });
  });

  describe("8. 边界条件和错误处理", function () {
    it("初始供应量为0应该失败", async function () {
      await expect(
        tokenFactory.createToken(
          "Zero Supply Token",
          "ZERO",
          0
        )
      ).to.be.revertedWith("Initial supply must be greater than 0");
    });

    it("空字符串代币名称应该失败", async function () {
      await expect(
        tokenFactory.createToken(
          "",
          "EMPTY",
          testParams.initialSupply
        )
      ).to.be.revertedWith("Token name cannot be empty");
    });

    it("空字符串代币符号应该失败", async function () {
      await expect(
        tokenFactory.createToken(
          "Empty Symbol Token",
          "",
          testParams.initialSupply
        )
      ).to.be.revertedWith("Token symbol cannot be empty");
    });

    it("超大初始供应量应该成功创建", async function () {
      const largeSupply = ethers.utils.parseEther("1000000000"); // 10亿代币
      
      await expect(
        tokenFactory.createToken(
          "Large Supply Token",
          "LARGE",
          largeSupply
        )
      ).to.not.be.reverted;
    });

    it("最小有效值应该成功创建代币", async function () {
      const minSupply = 1; // 最小供应量
      
      await expect(
        tokenFactory.createToken(
          "Min Supply Token",
          "MIN",
          minSupply
        )
      ).to.not.be.reverted;
    });

    it("单字符名称和符号应该成功创建", async function () {
      await expect(
        tokenFactory.createToken(
          "A",
          "B",
          testParams.initialSupply
        )
      ).to.not.be.reverted;
    });
  });

  describe("9. 输入验证测试", function () {
    it("应该拒绝空名称", async function () {
      await expect(
        tokenFactory.createToken(
          "",
          "VALID",
          testParams.initialSupply
        )
      ).to.be.revertedWith("Token name cannot be empty");
    });

    it("应该拒绝空符号", async function () {
      await expect(
        tokenFactory.createToken(
          "Valid Name",
          "",
          testParams.initialSupply
        )
      ).to.be.revertedWith("Token symbol cannot be empty");
    });

    it("应该拒绝零供应量", async function () {
      await expect(
        tokenFactory.createToken(
          "Valid Name",
          "VALID",
          0
        )
      ).to.be.revertedWith("Initial supply must be greater than 0");
    });

    it("应该拒绝同时为空的名称和符号", async function () {
      await expect(
        tokenFactory.createToken(
          "",
          "",
          testParams.initialSupply
        )
      ).to.be.revertedWith("Token name cannot be empty");
    });

    it("应该拒绝所有参数都无效的情况", async function () {
      await expect(
        tokenFactory.createToken(
          "",
          "",
          0
        )
      ).to.be.revertedWith("Token name cannot be empty");
    });

    it("应该接受最小有效参数", async function () {
      await expect(
        tokenFactory.createToken(
          "A", // 最短有效名称
          "B", // 最短有效符号
          1   // 最小有效供应量
        )
      ).to.not.be.reverted;
    });
  });
});