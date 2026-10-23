// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AgentGuard
/// @notice Bir yapay zekâ ajanının ödemelerini owner'ın kurallarına göre karara bağlayan kasa.
/// @dev Kural ihlalleri revert ETMEZ: işlem başarılı biter ve Rejected event'i yazılır,
///      böylece panel reddedilen denemeleri de zincirde görebilir.
contract AgentGuard {
    enum Decision {
        Settled,
        Pending,
        Rejected
    }

    enum RejectReason {
        OverPerTxLimit,
        OverBudget,
        CategoryNotAllowed,
        InsufficientBalance
    }

    enum PendingStatus {
        None,
        Open,
        Approved,
        Rejected
    }

    struct PendingPayment {
        address provider;
        uint256 amount;
        bytes32 category;
        bytes32 purposeHash;
        PendingStatus status;
    }

    // --- Roller ---
    address public owner;
    address public agent;

    // --- Kurallar ---
    uint256 public perTxLimit; // tek ödemede en fazla (wei)
    uint256 public totalBudget; // toplamda en fazla (wei)
    mapping(address => bool) public allowedProvider; // allowlist
    mapping(bytes32 => bool) public allowedCategory; // scope

    // --- Durum ---
    uint256 public spent;
    uint256 public pendingCount;
    mapping(uint256 => PendingPayment) public pending;

    // --- Event'ler ---
    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event AgentChanged(address indexed agent);
    event LimitsUpdated(uint256 perTxLimit, uint256 totalBudget);
    event ProviderAllowed(address indexed provider, bool allowed);
    event CategoryAllowed(bytes32 indexed category, bool allowed);

    event Settled(
        address indexed provider, uint256 amount, bytes32 indexed category, bytes32 indexed purposeHash
    );
    event Rejected(
        address indexed provider,
        uint256 amount,
        bytes32 indexed category,
        bytes32 indexed purposeHash,
        RejectReason reason
    );
    event PendingCreated(
        uint256 indexed id, address indexed provider, uint256 amount, bytes32 category, bytes32 purposeHash
    );
    event PendingApproved(uint256 indexed id);
    event PendingRejected(uint256 indexed id);

    // --- Hatalar ---
    error NotOwner();
    error NotAgent();
    error ZeroAddress();
    error NotOpen(uint256 id);
    error ExceedsBudget();
    error ExceedsBalance();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    constructor(address _agent, uint256 _perTxLimit, uint256 _totalBudget) {
        if (_agent == address(0)) revert ZeroAddress();
        owner = msg.sender;
        agent = _agent;
        perTxLimit = _perTxLimit;
        totalBudget = _totalBudget;
    }

    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    // ------------------------------------------------------------------
    // Owner ayarları
    // ------------------------------------------------------------------

    function setAgent(address _agent) external onlyOwner {
        if (_agent == address(0)) revert ZeroAddress();
        agent = _agent;
        emit AgentChanged(_agent);
    }

    function setLimits(uint256 _perTxLimit, uint256 _totalBudget) external onlyOwner {
        perTxLimit = _perTxLimit;
        totalBudget = _totalBudget;
        emit LimitsUpdated(_perTxLimit, _totalBudget);
    }

    function setProvider(address provider, bool allowed) external onlyOwner {
        allowedProvider[provider] = allowed;
        emit ProviderAllowed(provider, allowed);
    }

    function setCategory(bytes32 category, bool allowed) external onlyOwner {
        allowedCategory[category] = allowed;
        emit CategoryAllowed(category, allowed);
    }

    function withdraw(address payable to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount > address(this).balance) revert ExceedsBalance();
        emit Withdrawn(to, amount);
        _send(to, amount);
    }

    // ------------------------------------------------------------------
    // Ajan
    // ------------------------------------------------------------------

    /// @notice Ajan bir servise ödeme ister; sözleşme kurallara göre karar verir.
    /// @return decision Settled / Pending / Rejected
    /// @return pendingId Sadece Pending ise anlamlı (aksi halde 0)
    function requestPayment(address provider, uint256 amount, bytes32 category, bytes32 purposeHash)
        external
        onlyAgent
        returns (Decision decision, uint256 pendingId)
    {
        // 1) Limit / bütçe / kapsam / bakiye → Rejected
        (bool ok, RejectReason reason) = _check(amount, category);
        if (!ok) {
            emit Rejected(provider, amount, category, purposeHash, reason);
            return (Decision.Rejected, 0);
        }

        // 2) Tanınmayan servis → owner onayına bekletilir
        if (!allowedProvider[provider]) {
            pendingId = ++pendingCount;
            pending[pendingId] = PendingPayment(provider, amount, category, purposeHash, PendingStatus.Open);
            emit PendingCreated(pendingId, provider, amount, category, purposeHash);
            return (Decision.Pending, pendingId);
        }

        // 3) Her şey uygun → anında öde
        _settle(provider, amount, category, purposeHash);
        return (Decision.Settled, 0);
    }

    // ------------------------------------------------------------------
    // Owner onayı
    // ------------------------------------------------------------------

    function approvePending(uint256 id) external onlyOwner {
        PendingPayment storage p = pending[id];
        if (p.status != PendingStatus.Open) revert NotOpen(id);
        // Beklerken başka ödemeler yapılmış olabilir: bütçe ve bakiyeyi yeniden kontrol et.
        if (spent + p.amount > totalBudget) revert ExceedsBudget();
        if (p.amount > address(this).balance) revert ExceedsBalance();

        p.status = PendingStatus.Approved;
        allowedProvider[p.provider] = true;
        emit ProviderAllowed(p.provider, true);
        emit PendingApproved(id);
        _settle(p.provider, p.amount, p.category, p.purposeHash);
    }

    function rejectPending(uint256 id) external onlyOwner {
        PendingPayment storage p = pending[id];
        if (p.status != PendingStatus.Open) revert NotOpen(id);
        p.status = PendingStatus.Rejected;
        emit PendingRejected(id);
    }

    // ------------------------------------------------------------------
    // Yardımcılar
    // ------------------------------------------------------------------

    /// @notice Kalan bütçe (panel için kolaylık).
    function remainingBudget() external view returns (uint256) {
        return spent >= totalBudget ? 0 : totalBudget - spent;
    }

    function _check(uint256 amount, bytes32 category) internal view returns (bool, RejectReason) {
        if (amount > perTxLimit) return (false, RejectReason.OverPerTxLimit);
        if (spent + amount > totalBudget) return (false, RejectReason.OverBudget);
        if (!allowedCategory[category]) return (false, RejectReason.CategoryNotAllowed);
        if (amount > address(this).balance) return (false, RejectReason.InsufficientBalance);
        return (true, RejectReason.OverPerTxLimit); // ok=true iken reason kullanılmaz
    }

    function _settle(address provider, uint256 amount, bytes32 category, bytes32 purposeHash) internal {
        // Önce durumu güncelle, sonra para gönder (checks-effects-interactions)
        spent += amount;
        emit Settled(provider, amount, category, purposeHash);
        _send(payable(provider), amount);
    }

    function _send(address payable to, uint256 amount) internal {
        (bool success,) = to.call{value: amount}("");
        if (!success) revert TransferFailed();
    }
}
