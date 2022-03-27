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

    // Certain NFTs can mint and receive ERC20 Tokens per month
    // MUST be ascending sorted id
    uint256[] private _mintableTokenIds;

    // Mapping from whitelist address to their presale limit
    mapping(address => uint8) private _whiteList;

    // Mapping from market status to price
    mapping(MarketStatus => uint256) private _marketPrices;

    // Current Market Status (None: Not opened, Presale)
    MarketStatus public currentMarketStatus;

    // Current Mint price
    uint256 public currentPrice;

    uint256 public constant MAX_TOTAL_SUPPLY = 3333;
    uint256 public constant MAX_PRESALE_SUPPLY = 1250;
    uint256 public constant MAX_SALE_SUPPLY = 1833;

    string public constant BASE_URI =
        "https://opensea-creatures-api.herokuapp.com/api/creature/";

    /**
     * @dev Should initialize with market prices per status
     */
    constructor(
        MarketStatus[] memory statuses,
        uint256[] memory prices,
        uint256[] memory mintableTokenIds
    ) ERC721("CryptoGoods NFT", "CG") {
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
        _mintableTokenIds = mintableTokenIds;
    }

    function mintableCountOfOwner(address owner) public view returns (uint8) {
        if (balanceOf(owner) == 0) return 0;

        uint256 mintableLen = _mintableTokenIds.length;
        uint8 count = 0;
        for (uint256 i = 0; i < mintableLen; i++) {
            if (!_exists(_mintableTokenIds[i])) break;
            if (ownerOf(_mintableTokenIds[i]) == owner) {
                count++;
            }
        }
        return count;
    }

    /**
     * @dev owner can set market status manually
     */
    function setCurrentMarketStatus(MarketStatus marketStatus)
        external
        onlyOwner
    {
        _setCurrentMarketStatusWithPrice(marketStatus, 0);
    }

    /**
     * @dev set current nft market status with prices (whitelist, presale, sale)
     * owner can manually change status
     */
    function setCurrentMarketStatusWithPrice(
        MarketStatus marketStatus,
        uint256 price
    ) external onlyOwner {
        _setCurrentMarketStatusWithPrice(marketStatus, price);
    }

    /**
     * @dev owner can set whitelist addresses with limit
     */
    function setWhiteList(address[] calldata addresses, uint8 numAllowedToMint)
        external
        onlyOwner
    {
        for (uint256 i = 0; i < addresses.length; i++) {
            _whiteList[addresses[i]] = numAllowedToMint;
        }
    }

    /**
     * @dev whitelist user's current available presale limit
     * This limit is set by `setWhiteList`
     */
    function getOwnerPresaleAvailableToken() public view returns (uint256) {
        return _whiteList[_msgSender()];
    }

    /**
     * @dev current total supply
     */
    function totalSupply() public view returns (uint256) {
        return _currentTokenIds.current() - 1;
    }

    /**
     * @dev mint at sale, giveaway status
     * if market status is presale, it delegates to mintAtPresale
     * users can mint only one at a time
     */
    function mint() public payable {
        require(
            currentMarketStatus != MarketStatus.NONE,
            "Market is not opened yet"
        );
        require(totalSupply() <= MAX_TOTAL_SUPPLY, "Market cap reached");
        if (currentMarketStatus == MarketStatus.PRESALE) {
            mintAtPresale(1);
        } else {
            require(msg.value >= currentPrice, "Ether is not enough");
            _mintTo(_msgSender());
        }
    }

    /**
     * @dev mint to the whitelist accounts at presale
     * whitelist users can mint in bulk, but should not exceed their presale limit
     */
    function mintAtPresale(uint8 numberOfTokens) public payable {
        require(
            currentMarketStatus == MarketStatus.PRESALE,
            "Market is not presale"
        );
        require(_whiteList[_msgSender()] > 0, "You are not allowed");
        require(
            _whiteList[_msgSender()] >= numberOfTokens,
            "Exceed max whitelist available"
        );

        uint256 ts = totalSupply();
        require(
            ts + numberOfTokens <= MAX_PRESALE_SUPPLY,
            "Purchase would exceed max tokens"
        );
        require(
            currentPrice * numberOfTokens <= msg.value,
            "Ether is not enough"
        );
        for (uint8 i = 0; i < numberOfTokens; i++) {
            uint256 tokenId = _mintTo(_msgSender());
            _setTokenURI(tokenId, string(abi.encodePacked(BASE_URI, tokenId)));
        }
        _whiteList[_msgSender()] -= numberOfTokens;
    }

    /**
     * @dev withdraw balance from contract to me
     */
    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        // solhint-disable-next-line
        bool sent = payable(_msgSender()).send(balance);
        require(sent, "Failed to withdraw ether");
    }

    /**
     * @dev set current market status with price
     * current status and price is set by this function
     * If the price is 0, then current price is set _marketPrices, which is defined at the constructor
     */
    function _setCurrentMarketStatusWithPrice(
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

    /**
     * @dev mint
     * increase the token id tracker
     * check the market status transition
     * if the total supply reaches the presale limit, it should be changed into sale status
     * if the total supply reaches the sale limit, it should be changed into giveaway status
     */
    function _mintTo(address to) internal returns (uint256) {
        uint256 newTokenId = _currentTokenIds.current();
        _currentTokenIds.increment();
        _safeMint(to, newTokenId);
        _stateTransition();
        return newTokenId;
    }

    /**
     * @dev responsible for state transition checking
     * change the status and current price, if the transition condition is satisfied
     */
    function _stateTransition() internal {
        uint256 ts = totalSupply();
        if (
            currentMarketStatus == MarketStatus.PRESALE &&
            ts >= MAX_PRESALE_SUPPLY
        ) {
            currentMarketStatus = MarketStatus.SALE;
            _setCurrentMarketStatusWithPrice(
                currentMarketStatus,
                _marketPrices[currentMarketStatus]
            );
        }
        if (
            currentMarketStatus == MarketStatus.SALE &&
            ts >= MAX_PRESALE_SUPPLY + MAX_SALE_SUPPLY
        ) {
            currentMarketStatus = MarketStatus.GIVEAWAY;
            _setCurrentMarketStatusWithPrice(
                currentMarketStatus,
                _marketPrices[currentMarketStatus]
            );
        }
    }
}
