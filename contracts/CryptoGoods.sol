//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CryptoGoods is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;

    Counters.Counter private _currentTokenIds;

    enum MarketStatus {
        NONE,
        PRESALE,
        SALE,
        GIVEAWAY
    }

    uint256[] private _mintableTokenIds;
    mapping(address => uint8) private _whiteList;
    mapping(MarketStatus => uint256) private _marketPrices;

    MarketStatus public currentMarketStatus;
    uint256 public currentPrice;

    uint256 public constant MAX_TOTAL_SUPPLY = 3333;
    uint256 public constant MAX_PRESALE_SUPPLY = 1250;
    uint256 public constant MAX_SALE_SUPPLY = 1833;

    string public constant BASE_URI =
        "https://opensea-creatures-api.herokuapp.com/api/creature/";

    constructor(MarketStatus[] memory statuses, uint256[] memory prices)
        ERC721("CryptoGoods NFT", "CG")
    {
        require(
            statuses.length == prices.length,
            "Ensure price list are correct"
        );
        require(statuses.length == 3, "Prices should be set");
        _currentTokenIds.increment();
        for (uint8 i = 0; i < statuses.length; i++) {
            _marketPrices[statuses[i]] = prices[i];
        }
        currentMarketStatus = MarketStatus.NONE;
    }

    function setCurrentMarketStatus(MarketStatus marketStatus)
        external
        onlyOwner
    {
        _setCurrentMarketWithPrice(marketStatus, 0);
    }

    /**
     * @dev set current nft market status (whitelist, presale, sale)
     * owner can manually change status
     */
    function setCurrentMarketWithPrice(MarketStatus marketStatus, uint256 price)
        external
        onlyOwner
    {
        _setCurrentMarketWithPrice(marketStatus, price);
    }

    function setWhiteList(address[] calldata addresses, uint8 numAllowedToMint)
        external
        onlyOwner
    {
        for (uint256 i = 0; i < addresses.length; i++) {
            _whiteList[addresses[i]] = numAllowedToMint;
        }
    }

    function getOwnerPresaleAvailableToken() public view returns (uint256) {
        return _whiteList[msg.sender];
    }

    function totalSupply() public view returns (uint256) {
        return _currentTokenIds.current() - 1;
    }

    /**
     * @dev mint at sale, giveaway status
     */
    function mint() public payable {
        require(
            currentMarketStatus != MarketStatus.NONE,
            "Market is not opened yet"
        );
        if (currentMarketStatus == MarketStatus.PRESALE) {
            mintAtPresale(1);
        } else {
            require(currentPrice <= msg.value, "Ether is not enough");
            _mintTo(msg.sender);
        }
    }

    /**
     * @dev mint to the whitelist accounts at presale
     */
    function mintAtPresale(uint8 numberOfTokens) public payable {
        require(
            currentMarketStatus == MarketStatus.PRESALE,
            "Market is not presale"
        );
        require(_whiteList[msg.sender] > 0, "You are not allowed");
        require(
            _whiteList[msg.sender] >= numberOfTokens,
            "Exceed max whitelist available"
        );

        uint256 ts = totalSupply();
        require(
            ts + numberOfTokens <= MAX_PRESALE_SUPPLY,
            "Purchase would exeed max tokens"
        );
        require(
            currentPrice * numberOfTokens <= msg.value,
            "Ether is not enough"
        );
        for (uint8 i = 0; i < numberOfTokens; i++) {
            uint256 tokenId = _mintTo(msg.sender);
            _setTokenURI(tokenId, string(abi.encodePacked(BASE_URI, tokenId)));
        }
        _whiteList[msg.sender] -= numberOfTokens;
    }

    function withdraw() public onlyOwner returns (bool) {
        uint256 balance = address(this).balance;
        if (payable(msg.sender).send(balance)) {
            return true;
        } else {
            return false;
        }
    }

    function _setCurrentMarketWithPrice(
        MarketStatus marketStatus,
        uint256 price
    ) internal {
        currentMarketStatus = marketStatus;
        if (price > 0) {
            currentPrice = price;
        } else {
            currentPrice = _marketPrices[marketStatus];
        }
    }

    function _mintTo(address to) internal returns (uint256) {
        uint256 newTokenId = _currentTokenIds.current();
        _currentTokenIds.increment();
        _safeMint(to, newTokenId);
        _stateTransition();
        return newTokenId;
    }

    function _stateTransition() internal {
        uint256 ts = totalSupply();
        if (
            currentMarketStatus == MarketStatus.PRESALE &&
            ts >= MAX_PRESALE_SUPPLY
        ) {
            currentMarketStatus = MarketStatus.SALE;
            _setCurrentMarketWithPrice(
                currentMarketStatus,
                _marketPrices[currentMarketStatus]
            );
        }
        if (
            currentMarketStatus == MarketStatus.SALE &&
            ts >= MAX_PRESALE_SUPPLY + MAX_SALE_SUPPLY
        ) {
            currentMarketStatus = MarketStatus.GIVEAWAY;
            _setCurrentMarketWithPrice(
                currentMarketStatus,
                _marketPrices[currentMarketStatus]
            );
        }
    }
}
