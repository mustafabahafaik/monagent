// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AgentGuard} from "../src/AgentGuard.sol";

/// @notice AgentGuard'ı deploy eder, demo kurallarını kurar ve kasaya MON yatırır.
/// Çalıştırma: forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast
/// .env: PRIVATE_KEY (owner), AGENT_ADDRESS, PROVIDER_WEATHER
contract Deploy is Script {
    uint256 constant PER_TX_LIMIT = 0.01 ether; // "ether" = 10^18, Monad'da 1 MON demek
    uint256 constant TOTAL_BUDGET = 0.05 ether;
    uint256 constant DEPOSIT = 0.1 ether;

    function run() external returns (AgentGuard guard) {
        uint256 ownerKey = vm.envUint("PRIVATE_KEY");
        address agent = vm.envAddress("AGENT_ADDRESS");
        address weather = vm.envAddress("PROVIDER_WEATHER");

        vm.startBroadcast(ownerKey);
        guard = new AgentGuard(agent, PER_TX_LIMIT, TOTAL_BUDGET);

        // Scope: ajan sadece bu kategorilerde harcayabilir ("gambling" bilerek yok → Rejected demosu)
        guard.setCategory(keccak256("data"), true);
        guard.setCategory(keccak256("ai"), true);

        // Allowlist: sadece hava durumu servisi tanıdık (çeviri servisi Pending demosu için dışarıda)
        guard.setProvider(weather, true);

        (bool ok,) = address(guard).call{value: DEPOSIT}("");
        require(ok, "deposit failed");
        vm.stopBroadcast();

        console.log("AgentGuard adresi:", address(guard));
        console.log("owner:", vm.addr(ownerKey));
        console.log("agent:", agent);
        console.log("kasa bakiyesi (wei):", address(guard).balance);
    }
}
