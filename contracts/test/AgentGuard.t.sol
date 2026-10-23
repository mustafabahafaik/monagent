// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentGuard} from "../src/AgentGuard.sol";

/// @dev Para kabul etmeyen servis: transfer hatası yolunu test etmek için.
contract RejectingProvider {
    receive() external payable {
        revert("no thanks");
    }
}

contract AgentGuardTest is Test {
    AgentGuard guard;

    address owner = makeAddr("owner");
    address agent = makeAddr("agent");
    address weatherApi = makeAddr("weatherApi"); // allowlist'te
    address unknownApi = makeAddr("unknownApi"); // allowlist'te değil
    address stranger = makeAddr("stranger");

    bytes32 constant DATA = keccak256("data");
    bytes32 constant GAMBLING = keccak256("gambling");
    bytes32 constant PURPOSE = keccak256("req-1");

    uint256 constant PER_TX = 0.01 ether;
    uint256 constant BUDGET = 0.05 ether;

    // Event'leri test içinde tekrar tanımlıyoruz ki expectEmit ile karşılaştırabilelim
    event Settled(address indexed provider, uint256 amount, bytes32 indexed category, bytes32 indexed purposeHash);
    event Rejected(
        address indexed provider,
        uint256 amount,
        bytes32 indexed category,
        bytes32 indexed purposeHash,
        AgentGuard.RejectReason reason
    );
    event PendingCreated(
        uint256 indexed id, address indexed provider, uint256 amount, bytes32 category, bytes32 purposeHash
    );
    event PendingApproved(uint256 indexed id);
    event PendingRejected(uint256 indexed id);

    function setUp() public {
        vm.startPrank(owner);
        guard = new AgentGuard(agent, PER_TX, BUDGET);
        guard.setProvider(weatherApi, true);
        guard.setCategory(DATA, true);
        vm.stopPrank();

        vm.deal(owner, 1 ether);
        vm.prank(owner);
        (bool ok,) = address(guard).call{value: 0.1 ether}("");
        assertTrue(ok);
    }

    // Kısa yol: ajan olarak ödeme iste
    function _request(address provider, uint256 amount, bytes32 category)
        internal
        returns (AgentGuard.Decision, uint256)
    {
        vm.prank(agent);
        return guard.requestPayment(provider, amount, category, PURPOSE);
    }

    // ------------------------------------------------------------------
    // Settled yolu
    // ------------------------------------------------------------------

    function test_Settled_PaysAllowedProvider() public {
        vm.expectEmit(address(guard));
        emit Settled(weatherApi, 0.01 ether, DATA, PURPOSE);

        (AgentGuard.Decision d,) = _request(weatherApi, 0.01 ether, DATA);

        assertEq(uint256(d), uint256(AgentGuard.Decision.Settled));
        assertEq(weatherApi.balance, 0.01 ether);
        assertEq(guard.spent(), 0.01 ether);
        assertEq(address(guard).balance, 0.09 ether);
        assertEq(guard.remainingBudget(), 0.04 ether);
    }

    function test_Settled_RevertsIfProviderRefusesMoney() public {
        RejectingProvider bad = new RejectingProvider();
        vm.prank(owner);
        guard.setProvider(address(bad), true);

        vm.prank(agent);
        vm.expectRevert(AgentGuard.TransferFailed.selector);
        guard.requestPayment(address(bad), 0.01 ether, DATA, PURPOSE);
        assertEq(guard.spent(), 0); // revert olunca spent de geri alınır
    }

    // ------------------------------------------------------------------
    // Rejected yolları
    // ------------------------------------------------------------------

    function test_Rejected_OverPerTxLimit() public {
        vm.expectEmit(address(guard));
        emit Rejected(weatherApi, 0.02 ether, DATA, PURPOSE, AgentGuard.RejectReason.OverPerTxLimit);

        (AgentGuard.Decision d,) = _request(weatherApi, 0.02 ether, DATA);

        assertEq(uint256(d), uint256(AgentGuard.Decision.Rejected));
        assertEq(weatherApi.balance, 0);
        assertEq(guard.spent(), 0);
    }

    function test_Rejected_OverBudget() public {
        for (uint256 i = 0; i < 5; i++) {
            _request(weatherApi, 0.01 ether, DATA); // 5 x 0.01 = bütçe doldu
        }
        assertEq(guard.spent(), BUDGET);

        vm.expectEmit(address(guard));
        emit Rejected(weatherApi, 0.001 ether, DATA, PURPOSE, AgentGuard.RejectReason.OverBudget);
        (AgentGuard.Decision d,) = _request(weatherApi, 0.001 ether, DATA);

        assertEq(uint256(d), uint256(AgentGuard.Decision.Rejected));
        assertEq(guard.spent(), BUDGET);
    }

    function test_Rejected_CategoryNotAllowed() public {
        vm.expectEmit(address(guard));
        emit Rejected(weatherApi, 0.01 ether, GAMBLING, PURPOSE, AgentGuard.RejectReason.CategoryNotAllowed);

        (AgentGuard.Decision d,) = _request(weatherApi, 0.01 ether, GAMBLING);

        assertEq(uint256(d), uint256(AgentGuard.Decision.Rejected));
        assertEq(weatherApi.balance, 0);
    }

    function test_Rejected_InsufficientBalance() public {
        vm.prank(owner);
        guard.withdraw(payable(owner), 0.095 ether); // kasada 0.005 kaldı

        vm.expectEmit(address(guard));
        emit Rejected(weatherApi, 0.01 ether, DATA, PURPOSE, AgentGuard.RejectReason.InsufficientBalance);
        (AgentGuard.Decision d,) = _request(weatherApi, 0.01 ether, DATA);

        assertEq(uint256(d), uint256(AgentGuard.Decision.Rejected));
    }

    function test_Rejected_ChecksBeforeAllowlist() public {
        // Tanınmayan servis + limit aşımı: önce kurallar, Pending'e düşmez
        (AgentGuard.Decision d,) = _request(unknownApi, 0.02 ether, DATA);
        assertEq(uint256(d), uint256(AgentGuard.Decision.Rejected));
        assertEq(guard.pendingCount(), 0);
    }

    // ------------------------------------------------------------------
    // Pending yolu
    // ------------------------------------------------------------------

    function test_Pending_UnknownProviderCreatesPending() public {
        vm.expectEmit(address(guard));
        emit PendingCreated(1, unknownApi, 0.01 ether, DATA, PURPOSE);

        (AgentGuard.Decision d, uint256 id) = _request(unknownApi, 0.01 ether, DATA);

        assertEq(uint256(d), uint256(AgentGuard.Decision.Pending));
        assertEq(id, 1);
        assertEq(unknownApi.balance, 0);
        assertEq(guard.spent(), 0);

        (address provider, uint256 amount,,, AgentGuard.PendingStatus status) = guard.pending(1);
        assertEq(provider, unknownApi);
        assertEq(amount, 0.01 ether);
        assertEq(uint256(status), uint256(AgentGuard.PendingStatus.Open));
    }

    function test_ApprovePending_PaysAndAllowlists() public {
        (, uint256 id) = _request(unknownApi, 0.01 ether, DATA);

        vm.expectEmit(address(guard));
        emit PendingApproved(id);
        vm.expectEmit(address(guard));
        emit Settled(unknownApi, 0.01 ether, DATA, PURPOSE);

        vm.prank(owner);
        guard.approvePending(id);

        assertEq(unknownApi.balance, 0.01 ether);
        assertEq(guard.spent(), 0.01 ether);
        assertTrue(guard.allowedProvider(unknownApi));

        // Artık allowlist'te: bir sonraki ödeme anında geçer
        (AgentGuard.Decision d,) = _request(unknownApi, 0.01 ether, DATA);
        assertEq(uint256(d), uint256(AgentGuard.Decision.Settled));
    }

    function test_RejectPending_NoPayment() public {
        (, uint256 id) = _request(unknownApi, 0.01 ether, DATA);

        vm.expectEmit(address(guard));
        emit PendingRejected(id);
        vm.prank(owner);
        guard.rejectPending(id);

        assertEq(unknownApi.balance, 0);
        assertFalse(guard.allowedProvider(unknownApi));
        (,,,, AgentGuard.PendingStatus status) = guard.pending(id);
        assertEq(uint256(status), uint256(AgentGuard.PendingStatus.Rejected));
    }

    function test_ApprovePending_CannotRunTwice() public {
        (, uint256 id) = _request(unknownApi, 0.01 ether, DATA);
        vm.startPrank(owner);
        guard.approvePending(id);
        vm.expectRevert(abi.encodeWithSelector(AgentGuard.NotOpen.selector, id));
        guard.approvePending(id);
        vm.expectRevert(abi.encodeWithSelector(AgentGuard.NotOpen.selector, id));
        guard.rejectPending(id);
        vm.stopPrank();
    }

    function test_ApprovePending_RevertsIfBudgetUsedWhileWaiting() public {
        (, uint256 id) = _request(unknownApi, 0.01 ether, DATA);
        for (uint256 i = 0; i < 5; i++) {
            _request(weatherApi, 0.01 ether, DATA); // beklerken bütçe doldu
        }
        vm.prank(owner);
        vm.expectRevert(AgentGuard.ExceedsBudget.selector);
        guard.approvePending(id);
    }

    function test_ApprovePending_RevertsIfBalanceTooLow() public {
        (, uint256 id) = _request(unknownApi, 0.01 ether, DATA);
        vm.startPrank(owner);
        guard.withdraw(payable(owner), 0.095 ether);
        vm.expectRevert(AgentGuard.ExceedsBalance.selector);
        guard.approvePending(id);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // Yetkiler
    // ------------------------------------------------------------------

    function test_OnlyAgentCanRequest() public {
        vm.prank(stranger);
        vm.expectRevert(AgentGuard.NotAgent.selector);
        guard.requestPayment(weatherApi, 0.01 ether, DATA, PURPOSE);
    }

    function test_OnlyOwnerCanChangeRules() public {
        vm.startPrank(stranger);
        vm.expectRevert(AgentGuard.NotOwner.selector);
        guard.setLimits(1 ether, 1 ether);
        vm.expectRevert(AgentGuard.NotOwner.selector);
        guard.setProvider(stranger, true);
        vm.expectRevert(AgentGuard.NotOwner.selector);
        guard.setCategory(GAMBLING, true);
        vm.expectRevert(AgentGuard.NotOwner.selector);
        guard.setAgent(stranger);
        vm.expectRevert(AgentGuard.NotOwner.selector);
        guard.withdraw(payable(stranger), 0.01 ether);
        vm.expectRevert(AgentGuard.NotOwner.selector);
        guard.approvePending(1);
        vm.expectRevert(AgentGuard.NotOwner.selector);
        guard.rejectPending(1);
        vm.stopPrank();
    }

    function test_AgentCannotApproveOwnPending() public {
        (, uint256 id) = _request(unknownApi, 0.01 ether, DATA);
        vm.prank(agent);
        vm.expectRevert(AgentGuard.NotOwner.selector);
        guard.approvePending(id);
    }

    function test_OwnerCanUpdateRules() public {
        vm.startPrank(owner);
        guard.setLimits(0.02 ether, 0.1 ether);
        guard.setCategory(GAMBLING, true);
        vm.stopPrank();

        (AgentGuard.Decision d,) = _request(weatherApi, 0.02 ether, GAMBLING);
        assertEq(uint256(d), uint256(AgentGuard.Decision.Settled));
    }

    // ------------------------------------------------------------------
    // Deposit / withdraw
    // ------------------------------------------------------------------

    function test_DepositAndWithdraw() public {
        vm.deal(stranger, 1 ether);
        vm.prank(stranger);
        (bool ok,) = address(guard).call{value: 0.2 ether}("");
        assertTrue(ok);
        assertEq(address(guard).balance, 0.3 ether);

        vm.prank(owner);
        guard.withdraw(payable(owner), 0.3 ether);
        assertEq(address(guard).balance, 0);
        assertEq(owner.balance, 1.2 ether); // 1 - 0.1 yatırılan + 0.3 çekilen
    }

    function test_WithdrawMoreThanBalanceReverts() public {
        vm.prank(owner);
        vm.expectRevert(AgentGuard.ExceedsBalance.selector);
        guard.withdraw(payable(owner), 1 ether);
    }

    function test_ConstructorRejectsZeroAgent() public {
        vm.expectRevert(AgentGuard.ZeroAddress.selector);
        new AgentGuard(address(0), PER_TX, BUDGET);
    }
}
