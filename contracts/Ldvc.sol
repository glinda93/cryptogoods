pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./CryptoGoods.sol";

contract Ldvc is ERC20 {
    address public cgNftAddress;
    uint256 public cgSalary;
    mapping(address => uint256) private _lastMintTimes;

    constructor(
        string memory name,
        string memory symbol,
        address _cgNftAddress,
        uint256 _cgSalary
    ) ERC20(name, symbol) {
        require(_cgNftAddress != address(0), "invalid token address");
        require(_cgSalary > 0, "invalid salary");
        cgNftAddress = _cgNftAddress;
        cgSalary = _cgSalary;
    }

    function claimToken() public returns (uint256) {
        CryptoGoods cgToken = CryptoGoods(cgNftAddress);
        uint8 mintableTokens = cgToken.mintableOfOwner(_msgSender());
        if (mintableTokens == 0) return 0;
        uint256 amount = cgSalary * mintableTokens;

        if (
            _lastMintTimes[_msgSender()] == 0 ||
            (_lastMintTimes[_msgSender()] > 0 &&
                block.timestamp - _lastMintTimes[_msgSender()] >= 30 days)
        ) {
            _mint(_msgSender(), amount);
            _lastMintTimes[_msgSender()] = block.timestamp;
            return amount;
        } else {
            return 0;
        }
    }
}
