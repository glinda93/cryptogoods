import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";

describe("Ldvc", function () {
  enum MarketStatus {
    NONE,
    PRESALE,
    SALE,
    GIVEAWAY,
  }

  // const MAX_TOTAL_SUPPLY = 3333;
  //   const MAX_PRESALE_SUPPLY = 1250;
  // const MAX_SALE_SUPPLY = 1833;

  let CryptoGoodsToken: Contract;
  let LdvcToken: Contract;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  const presalePrice = BigNumber.from("10000000000000000");
  const salePrice = BigNumber.from("20000000000000000");
  const giveawayPrice = BigNumber.from("5000000000000000");

  const mintableTokenIds = [1, 2, 3];

  const LdvcTokenName = "Ldvc Token";
  const LdvcTokenSymbol = "LDVC";
  const monthlyIncome = 30;

  const contractDeploy = async () => {
    const CryptoGoodsFactory = await ethers.getContractFactory("CryptoGoods");
    const LdvcTokenFactory = await ethers.getContractFactory("Ldvc");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    [owner, addr1, addr2] = await ethers.getSigners();

    CryptoGoodsToken = await CryptoGoodsFactory.deploy(
      [MarketStatus.PRESALE, MarketStatus.SALE, MarketStatus.GIVEAWAY],
      [presalePrice, salePrice, giveawayPrice],
      mintableTokenIds
    );
    await CryptoGoodsToken.deployed();

    LdvcToken = await LdvcTokenFactory.deploy(
      LdvcTokenName,
      LdvcTokenSymbol,
      CryptoGoodsToken.address,
      monthlyIncome
    );
    await LdvcToken.deployed();
  };

  beforeEach(async function () {
    await contractDeploy();
  });
  describe("when Ldvc is deployed", function () {
    beforeEach(async function () {
      await CryptoGoodsToken.setCurrentMarketStatus(MarketStatus.SALE);
    });
    it("should provide name and symbol", async function () {
      expect(await LdvcToken.name()).to.be.equal(LdvcTokenName);
      expect(await LdvcToken.symbol()).to.be.equal(LdvcTokenSymbol);
    });
    it("should allow claim ldvc at first for mintable token owners", async function () {
      await CryptoGoodsToken.connect(addr1).mint({ value: salePrice });
      expect(await CryptoGoodsToken.balanceOf(addr1.address)).to.be.equal(1);
      expect(
        await CryptoGoodsToken.mintableCountOfOwner(addr1.address)
      ).to.be.equal(1);

      await LdvcToken.connect(addr1).claimToken();
      expect(await LdvcToken.balanceOf(addr1.address)).to.be.equal(
        monthlyIncome * 1
      );
    });
    it("should give salary propotional for the mintable token they have", async function () {
      await CryptoGoodsToken.connect(addr1).mint({ value: salePrice });
      await CryptoGoodsToken.connect(addr1).mint({ value: salePrice });
      expect(
        await CryptoGoodsToken.mintableCountOfOwner(addr1.address)
      ).to.be.equal(2);

      await LdvcToken.connect(addr1).claimToken();
      expect(await LdvcToken.balanceOf(addr1.address)).to.be.equal(
        monthlyIncome * 2
      );
    });
    it("should prevent salary for non-mintable token owner", async function () {
      // currently mintable tokens are only 3 and addr1 minted all these tokens
      await CryptoGoodsToken.connect(addr1).mint({ value: salePrice });
      await CryptoGoodsToken.connect(addr1).mint({ value: salePrice });
      await CryptoGoodsToken.connect(addr1).mint({ value: salePrice });

      // addr2 minted non-mintable nft
      await CryptoGoodsToken.connect(addr2).mint({ value: salePrice });
      await LdvcToken.connect(addr2).claimToken();
      expect(await LdvcToken.balanceOf(addr2.address)).to.be.equal(0);
    });
    it("should prevent salary airdrop again before a month", async function () {
      // currently mintable tokens are only 3 and addr1 minted all these tokens
      await CryptoGoodsToken.connect(addr1).mint({ value: salePrice });

      // first mint salary token
      await LdvcToken.connect(addr1).claimToken();

      // prevent airdrop before a month
      await LdvcToken.connect(addr1).claimToken();
      expect(await LdvcToken.balanceOf(addr1.address)).to.be.equal(
        monthlyIncome * 1
      );
    });

    it("should allow salary airdrop again after a month(30 days)", async function () {
      // currently mintable tokens are only 3 and addr1 minted all these tokens
      await CryptoGoodsToken.connect(addr1).mint({ value: salePrice });

      // first mint salary token
      await LdvcToken.connect(addr1).claimToken();

      await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
      // allow mint after a month
      await LdvcToken.connect(addr1).claimToken();

      expect(await LdvcToken.balanceOf(addr1.address)).to.be.equal(
        monthlyIncome * 2
      );
    });
  });
});
