// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../Staking.sol";

contract ReentrantToken is ERC20, Ownable {
    enum Hook {
        None,
        Transfer,
        TransferFrom
    }

    uint256 public constant INITIAL_SUPPLY = 1_000_000 ether;

    address public attackTarget;
    bytes public attackData;
    Hook public attackHook;
    bool private _attacking;

    bool public attackAttempted;
    bool public attackSucceeded;
    bytes public lastRevertData;

    constructor(address initialOwner) ERC20("Reentrant Token", "RNT") Ownable(initialOwner) {
        _mint(initialOwner, INITIAL_SUPPLY);
        _mint(address(this), INITIAL_SUPPLY);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function setAttack(address target, bytes calldata data, Hook hook) external onlyOwner {
        attackTarget = target;
        attackData = data;
        attackHook = hook;
        attackAttempted = false;
        attackSucceeded = false;
        delete lastRevertData;
    }

    function clearAttack() external onlyOwner {
        attackHook = Hook.None;
        attackTarget = address(0);
        delete attackData;
    }

    function primeStake(address strategy, uint256 poolId, uint256 amount) external onlyOwner {
        _approve(address(this), strategy, amount);
        StakingStrategyController(strategy).stake(poolId, amount);
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        bool ok = super.transfer(to, value);
        _maybeAttack(Hook.Transfer);
        return ok;
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        bool ok = super.transferFrom(from, to, value);
        _maybeAttack(Hook.TransferFrom);
        return ok;
    }

    function _maybeAttack(Hook currentHook) internal {
        if (_attacking || attackHook != currentHook || attackTarget == address(0)) return;

        attackAttempted = true;
        _attacking = true;
        (bool ok, bytes memory returndata) = attackTarget.call(attackData);
        attackSucceeded = ok;
        if (!ok) {
            lastRevertData = returndata;
        }
        _attacking = false;
    }
}
