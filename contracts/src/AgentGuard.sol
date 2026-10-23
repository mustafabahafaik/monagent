// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AgentGuard
/// @notice Bir yapay zekâ ajanının harcamalarını kurallarla sınırlayan kasa.
contract AgentGuard {
    // --- Roller ---
    address public owner; // kuralları koyan kişi (sen)
    address public agent; // harcama yapabilen tek adres (ajan cüzdanı)

    // --- Kurallar ---
    uint256 public maxPerPayment; // tek ödemede en fazla (wei)
    uint256 public dailyBudget; // bir günde en fazla (wei)
    bool public paused; // true ise hiçbir ödeme geçmez
    mapping(address => bool) public allowed; // izinli servis adresleri

    // --- Günlük sayaç ---
    uint256 public spentToday;
    uint256 public dayStart; // bugünün başladığı zaman (saniye)

    // --- Event'ler: panel bunları dinleyecek ---
    event Deposited(address indexed from, uint256 amount);

    // --- Hatalar ---
    error NotOwner();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _agent, uint256 _maxPerPayment, uint256 _dailyBudget) {
        owner = msg.sender;
        agent = _agent;
        maxPerPayment = _maxPerPayment;
        dailyBudget = _dailyBudget;
        dayStart = block.timestamp;
    }

    /// @notice Sözleşmeye MON yatırmak için: kasa bu parayla ödeme yapar.
    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    // TODO (sen dene): setPaused(bool) — sadece owner çağırabilsin.
}
