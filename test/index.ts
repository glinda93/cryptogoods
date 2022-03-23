import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
// eslint-disable-next-line node/no-missing-import
import { randomInt } from "../helpers/random";

describe("CryptoGoods", function () {
  enum MarketStatus {
    NONE,
    PRESALE,
    SALE,
    GIVEAWAY,
  }

  // const MAX_TOTAL_SUPPLY = 3333;
  const MAX_PRESALE_SUPPLY = 1250;
  // const MAX_SALE_SUPPLY = 1833;

  let CryptoGoodsToken: Contract;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;

  let whiteList1: SignerWithAddress;
  let whiteList2: SignerWithAddress;
  let addrs: SignerWithAddress[];

  const NUM_WHITELIST_AVAILABLE_TOKEN = 100;
  const presalePrice = BigNumber.from("10000000000000000");
  const salePrice = BigNumber.from("20000000000000000");
  const giveawayPrice = BigNumber.from("5000000000000000");

  const initializeContract = async () => {
    await CryptoGoodsToken.setWhiteList(
      [whiteList1.address, whiteList2.address],
      NUM_WHITELIST_AVAILABLE_TOKEN
    );
  };

  const contractDeploy = async () => {
    const CryptoGoodsFactory = await ethers.getContractFactory("CryptoGoods");
    [owner, addr1, whiteList1, whiteList2, ...addrs] =
      await ethers.getSigners();

    CryptoGoodsToken = await CryptoGoodsFactory.deploy(
      [MarketStatus.PRESALE, MarketStatus.SALE, MarketStatus.GIVEAWAY],
      [presalePrice, salePrice, giveawayPrice]
    );
    await CryptoGoodsToken.deployed();
  };

  beforeEach(async function () {
    await contractDeploy();
  });

  describe("when deployed first", function () {
    it("should set the right owner", async function () {
      expect(await CryptoGoodsToken.owner()).to.equal(owner.address);
    });
    it("should be none status at first", async function () {
      const status = await CryptoGoodsToken.currentMarketStatus();
      expect(status).to.equal(MarketStatus.NONE);
    });
    it("should prevent mint when the market is not opened", async function () {
      await expect(CryptoGoodsToken.connect(addr1).mint()).to.be.revertedWith(
        "Market is not opened yet"
      );
    });
    it("should prevent presale mint when the market is not opened", async function () {
      await expect(
        CryptoGoodsToken.connect(addr1).mintAtPresale(1)
      ).to.be.revertedWith("Market is not presale");
    });

    it("should allow owner to set market status", async function () {
      await initializeContract();
      await CryptoGoodsToken.setCurrentMarketStatus(MarketStatus.PRESALE);
      expect(await CryptoGoodsToken.currentPrice()).to.be.equal(presalePrice);

      await CryptoGoodsToken.setCurrentMarketStatus(MarketStatus.SALE);
      expect(await CryptoGoodsToken.currentPrice()).to.be.equal(salePrice);

      await CryptoGoodsToken.setCurrentMarketStatus(MarketStatus.GIVEAWAY);
      expect(await CryptoGoodsToken.currentPrice()).to.be.equal(giveawayPrice);

      await expect(
        CryptoGoodsToken.connect(addr1).setCurrentMarketStatus(
          MarketStatus.PRESALE
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("when the market is not opened", function () {
    it("should prevent normal user from setting whitelist", async function () {
      expect(await CryptoGoodsToken.currentMarketStatus()).to.be.equal(
        MarketStatus.NONE
      );
      await expect(
        CryptoGoodsToken.connect(addr1).setWhiteList(
          [whiteList1.address, whiteList2.address],
          NUM_WHITELIST_AVAILABLE_TOKEN
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("should get available token number after the owner set the whitelist", async function () {
      await CryptoGoodsToken.connect(owner).setWhiteList(
        [whiteList1.address, whiteList2.address],
        NUM_WHITELIST_AVAILABLE_TOKEN
      );
      const availableToken = await CryptoGoodsToken.connect(
        whiteList1
      ).getOwnerPresaleAvailableToken();
      expect(availableToken).to.be.equal(NUM_WHITELIST_AVAILABLE_TOKEN);
    });
  });

  describe("when the market is in presale status", function () {
    beforeEach(async function () {
      await initializeContract();
      await CryptoGoodsToken.setCurrentMarketStatus(MarketStatus.PRESALE);
    });
    it("should prevent those who are not in whitelist from minting", async function () {
      expect(await CryptoGoodsToken.currentMarketStatus()).to.be.equal(
        MarketStatus.PRESALE
      );
      await expect(CryptoGoodsToken.connect(addr1).mint()).to.be.revertedWith(
        "You are not allowed"
      );
      await expect(
        CryptoGoodsToken.connect(addr1).mintAtPresale(5)
      ).to.be.revertedWith("You are not allowed");
    });
    it("should be minted at presale price", async function () {
      await expect(
        CryptoGoodsToken.connect(whiteList1).mintAtPresale(5, {
          value: presalePrice.sub(1),
        })
      ).to.be.revertedWith("Ether is not enough");
      const initialCgToken = await CryptoGoodsToken.balanceOf(
        whiteList1.address
      );
      const numberToMint = randomInt(1, NUM_WHITELIST_AVAILABLE_TOKEN - 1);
      await CryptoGoodsToken.connect(whiteList1).mintAtPresale(numberToMint, {
        value: presalePrice.mul(numberToMint),
      });
      let finalCgToken = await CryptoGoodsToken.balanceOf(whiteList1.address);

      expect(finalCgToken - initialCgToken).to.be.equal(numberToMint);
      await CryptoGoodsToken.connect(whiteList1).mint({ value: presalePrice });
      finalCgToken = await CryptoGoodsToken.balanceOf(whiteList1.address);
      expect(finalCgToken - initialCgToken).to.be.equal(numberToMint + 1);
    });
    it("should not exceed maximum available token", async function () {
      let numberToMint = NUM_WHITELIST_AVAILABLE_TOKEN + 1;
      await expect(
        CryptoGoodsToken.connect(whiteList1).mintAtPresale(numberToMint, {
          value: presalePrice.mul(numberToMint),
        })
      ).to.be.revertedWith("Exceed max whitelist available");

      numberToMint = randomInt(1, NUM_WHITELIST_AVAILABLE_TOKEN - 1);

      await CryptoGoodsToken.connect(whiteList1).mintAtPresale(numberToMint, {
        value: presalePrice.mul(numberToMint),
      });
      const balance = await CryptoGoodsToken.balanceOf(whiteList1.address);
      expect(balance).to.be.equals(numberToMint);

      const availableToken = await CryptoGoodsToken.connect(
        whiteList1
      ).getOwnerPresaleAvailableToken();
      expect(balance.add(availableToken)).to.be.equals(
        NUM_WHITELIST_AVAILABLE_TOKEN
      );

      numberToMint = NUM_WHITELIST_AVAILABLE_TOKEN - numberToMint + 1;
      await expect(
        CryptoGoodsToken.connect(whiteList1).mintAtPresale(numberToMint)
      ).to.be.revertedWith("Exceed max whitelist available");
    });

    it("should not exceed presale total supply", async function () {
      if (addrs.length * NUM_WHITELIST_AVAILABLE_TOKEN <= MAX_PRESALE_SUPPLY) {
        expect(false).to.be.equal(
          true,
          "Not enough addresses to fill presale amount"
        );
      }
      await CryptoGoodsToken.setWhiteList(
        addrs.map((addr) => addr.address),
        NUM_WHITELIST_AVAILABLE_TOKEN
      );
      let amount = 0;
      for (let i = 0; i < addrs.length; i++) {
        const tx = CryptoGoodsToken.connect(addrs[i]).mintAtPresale(
          NUM_WHITELIST_AVAILABLE_TOKEN,
          {
            value: presalePrice.mul(NUM_WHITELIST_AVAILABLE_TOKEN),
          }
        );
        amount += NUM_WHITELIST_AVAILABLE_TOKEN;
        if (amount > MAX_PRESALE_SUPPLY) {
          await expect(tx).to.be.revertedWith(
            "Purchase would exceed max tokens"
          );
          const totalSupply = await CryptoGoodsToken.totalSupply();
          const redunAmount = MAX_PRESALE_SUPPLY - totalSupply;
          await CryptoGoodsToken.connect(addrs[i]).mintAtPresale(redunAmount, {
            value: presalePrice.mul(redunAmount),
          });
          expect(await CryptoGoodsToken.currentMarketStatus()).to.be.equal(
            MarketStatus.SALE
          );
          break;
        } else {
          await tx;
        }
      }
    });
  });
  describe("when the market is in sale", function () {
    beforeEach(async function () {
      await initializeContract();
      await CryptoGoodsToken.setCurrentMarketStatus(MarketStatus.SALE);
    });
    it("should prevent users from minting at presale price", async function () {
      await expect(
        CryptoGoodsToken.connect(whiteList1).mintAtPresale(1, {
          value: presalePrice,
        })
      ).to.be.revertedWith("Market is not presale");
      await expect(
        CryptoGoodsToken.connect(addr1).mintAtPresale(1, {
          value: presalePrice,
        })
      ).to.be.revertedWith("Market is not presale");
      await expect(
        CryptoGoodsToken.connect(addr1).mint({
          value: presalePrice,
        })
      ).to.be.revertedWith("Ether is not enough");
    });
    it("should prevent users from minting at giveaway price", async function () {
      await expect(
        CryptoGoodsToken.connect(addr1).mint({
          value: giveawayPrice,
        })
      ).to.be.revertedWith("Ether is not enough");
    });
    it("should allow users to mint at sale price", async function () {
      const initialCgToken = await CryptoGoodsToken.balanceOf(addr1.address);
      await CryptoGoodsToken.connect(addr1).mint({ value: salePrice });
      const finalCgToken = await CryptoGoodsToken.balanceOf(addr1.address);
      expect(finalCgToken.sub(initialCgToken)).to.be.equal(1);
    });
    // TODO: stress test (mint 1833 test to test state transitio)
    // it("should be changed into giveaway status", async function() {
    // });
  });
});
