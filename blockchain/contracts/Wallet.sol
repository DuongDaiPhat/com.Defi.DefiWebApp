pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Wallet {

    ERC20 public token;

    constructor(address _tokenAddress) {
        token = ERC20(_tokenAddress);
    }

    function balanceOf(address user) external view returns (uint256) {
        return token.balanceOf(user);
    }
}
