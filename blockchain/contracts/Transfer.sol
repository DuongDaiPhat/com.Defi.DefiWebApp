pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Transfer {

    ERC20 public token;

    event TransferSuccess(
        address indexed from,
        address indexed to,
        uint256 amount
    );

    event TransferHistory(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );

    constructor(address _tokenAddress) {
        token = ERC20(_tokenAddress);
    }

    function transferToken(address to, uint256 amount) external {
        bool success = token.transferFrom(
            msg.sender,
            to,
            amount
        );

        require(success, "Transfer failed");

        emit TransferSuccess(msg.sender, to, amount);
        emit TransferHistory(msg.sender, to, amount, block.timestamp);
    }


}
