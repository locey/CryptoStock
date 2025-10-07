const { WrapperBuilder } = require("@redstone-finance/evm-connector");

describe("StocksExample", function () {
  let contract;
  let address;

  beforeEach(async () => {
    // Deploy contract
    const StocksExample = await ethers.getContractFactory("StockExample");
    contract = await StocksExample.deploy();
    await contract.waitForDeployment();
    address = await contract.getAddress();
    console.log("Contract deployed to:", address);
  });

  it("Get TSLA price securely", async function () {
    // Wrapping the contract
    console.log("contract function", contract.functions);

    //通过部署地址获取
    const wrappedContract = WrapperBuilder.wrap(contract).usingDataService({
      dataPackagesIds: ["TSLA"],
    });

    // Interact with the contract (getting oracle value securely)
    const tslaPriceFromContract = await wrappedContract.getLatestTslaPrice();
    console.log({ tslaPriceFromContract });
  });

});