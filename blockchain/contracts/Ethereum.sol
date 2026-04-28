// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Ethereum is ERC20, ERC20Burnable, ERC20Permit, Ownable {
    /// @notice Hard cap — tổng cung tối đa
    uint256 public constant MAX_SUPPLY = 10_000_000 * 10 ** 18;

    /// @notice Lượng token đúc ngay khi deploy (1,000,000 SKT)
    uint256 public constant INITIAL_SUPPLY = 1_000_000 * 10 ** 18;

    event TokensMinted(address indexed to, uint256 amount);

    error ExceedsMaxSupply(uint256 requested, uint256 available);

    constructor(address _initialOwner)
        ERC20("EthereumToken", "ETK")
        ERC20Permit("EthereumToken")
        Ownable(_initialOwner)
    {
        require(_initialOwner != address(0), "Ethereum: zero owner address");
        _mint(_initialOwner, INITIAL_SUPPLY);
    }

    // ============================================================
    //  Mint — chỉ Owner
    // ============================================================

    /**
     * @notice Phát hành thêm token, không vượt hard cap.
     * @param  _to     Địa chỉ nhận token mới
     * @param  _amount Số lượng token (wei, 10^-18 SKT)
     */
    function mint(address _to, uint256 _amount) external onlyOwner {
        uint256 available = MAX_SUPPLY - totalSupply();
        if (_amount > available)
            revert ExceedsMaxSupply(_amount, available);

        _mint(_to, _amount);
        emit TokensMinted(_to, _amount);
    }

    // ============================================================
    //  View Helpers
    // ============================================================

    /// @notice Số token còn có thể mint trước khi chạm hard cap
    function remainingMintable() external view returns (uint256) {
        return MAX_SUPPLY - totalSupply();
    }

    /// @notice Thông tin token — tiện gọi từ frontend
    function tokenInfo()
        external
        view
        returns (
            string memory name_,
            string memory symbol_,
            uint8  decimals_,
            uint256 totalSupply_,
            uint256 maxSupply_
        )
    {
        return (name(), symbol(), decimals(), totalSupply(), MAX_SUPPLY);
    }
}