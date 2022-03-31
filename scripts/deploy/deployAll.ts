// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";
import config from "../../deploy.config.json";

enum MarketStatus {
  NONE,
  PRESALE,
  SALE,
  GIVEAWAY,
}

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy

  const {
    presalePrice,
    salePrice,
    giveawayPrice,
    mintableTokenIds,
    baseTokenUri,
    whiteList,
    whiteListAvailableTokens,
    nftMonthlyIncomeLdvc,
  } = config;
  const CryptoGoodsFactory = await ethers.getContractFactory("CryptoGoods");
  const CryptoGoodsToken = await CryptoGoodsFactory.deploy(
    [MarketStatus.PRESALE, MarketStatus.SALE, MarketStatus.GIVEAWAY],
    [presalePrice, salePrice, giveawayPrice],
    mintableTokenIds,
    baseTokenUri
  );
  await CryptoGoodsToken.deployed();

  if (whiteList.length) {
    await CryptoGoodsToken.setWhiteList(whiteList, whiteListAvailableTokens);
  }
  await CryptoGoodsToken.setCurrentMarketStatus(MarketStatus.PRESALE);

  const LdvcTokenFactory = await ethers.getContractFactory("Ldvc");
  const LdvcToken = await LdvcTokenFactory.deploy(
    "LDvc Token",
    "LDvc",
    CryptoGoodsToken.address,
    nftMonthlyIncomeLdvc
  );
  await LdvcToken.deployed();

  console.log("CryptoGoods: ", CryptoGoodsToken.address);
  console.log("LdvcToken: ", LdvcToken.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
