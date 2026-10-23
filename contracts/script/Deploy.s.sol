// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {VmSafe} from "forge-std/Vm.sol";
import {AgentGuard} from "../src/AgentGuard.sol";

/// @notice AgentGuard'ı deploy eder, başlangıç kurallarını kurar, kasaya MON yatırır ve
///         adresi frontend/src/config.ts ile agent/config.js dosyalarına yazar.
/// Simülasyon: forge script script/Deploy.s.sol --rpc-url monad_testnet
/// Yayın:      forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast
/// .env: PRIVATE_KEY (owner), AGENT_ADDRESS, PROVIDER_SECURESCAN, PROVIDER_LINTBOT
contract Deploy is Script {
    // 1 birim = 0.01 MON. Testnet MON kıt olduğu için ayarlar bu birimle ölçeklenir:
    // perTx 5 birim = 0.05 MON, budget 20 birim = 0.2 MON. Tek satırla değiştirilebilir.
    uint256 constant UNIT = 0.01 ether;
    uint256 constant PER_TX_LIMIT = 5 * UNIT;
    uint256 constant TOTAL_BUDGET = 20 * UNIT;
    uint256 constant DEPOSIT = TOTAL_BUDGET; // bütçenin tamamı kasada: OverBudget demosu yapılabilsin

    string[3] internal SCOPE = ["security", "test", "lint"];

    function run() external returns (AgentGuard guard) {
        uint256 ownerKey = vm.envUint("PRIVATE_KEY");
        address agent = vm.envAddress("AGENT_ADDRESS");
        address secureScan = vm.envAddress("PROVIDER_SECURESCAN");
        address lintBot = vm.envAddress("PROVIDER_LINTBOT");
        uint256 startBlock = block.number; // panel event'leri buradan itibaren okur

        vm.startBroadcast(ownerKey);
        guard = new AgentGuard(agent, PER_TX_LIMIT, TOTAL_BUDGET);

        for (uint256 i = 0; i < SCOPE.length; i++) {
            guard.setCategory(keccak256(bytes(SCOPE[i])), true);
        }
        guard.setProvider(secureScan, true);
        guard.setProvider(lintBot, true);

        (bool ok,) = address(guard).call{value: DEPOSIT}("");
        require(ok, "deposit failed");
        vm.stopBroadcast();

        console.log("AgentGuard adresi:", address(guard));
        console.log("owner:", vm.addr(ownerKey));
        console.log("agent:", agent);

        // Simülasyonda dosyalara dokunma: sadece gerçek yayında adres kesinleşir
        if (vm.isContext(VmSafe.ForgeContext.ScriptBroadcast)) {
            _writeConfigs(address(guard), agent, secureScan, lintBot, startBlock);
            console.log("config yazildi: frontend/src/config.ts, agent/config.js");
        } else {
            console.log("simulasyon: config dosyalari yazilmadi (--broadcast ile yazilir)");
        }
    }

    function _writeConfigs(address guard, address agent, address secureScan, address lintBot, uint256 startBlock)
        internal
    {
        string memory root = string.concat(vm.projectRoot(), "/..");
        string memory body = string.concat(
            "GUARD_ADDRESS = \"",
            vm.toString(guard),
            "\";\nexport const AGENT_ADDRESS = \"",
            vm.toString(agent),
            "\";\nexport const CHAIN_ID = ",
            vm.toString(block.chainid),
            ";\nexport const RPC_URL = \"https://testnet-rpc.monad.xyz\";\nexport const DEPLOY_BLOCK = ",
            vm.toString(startBlock),
            "n;\nexport const PROVIDERS = {\n  SecureScan: \"",
            vm.toString(secureScan),
            "\",\n  LintBot: \"",
            vm.toString(lintBot),
            "\",\n};\nexport const SCOPE = [\"security\", \"test\", \"lint\"];\n"
        );
        string memory header = "// Bu dosya contracts/script/Deploy.s.sol tarafindan uretilir. Elle duzenleme.\n";

        // Klasörler repoda hazır olmalı: Foundry, var olmayan yolu fs_permissions ile eşleştiremiyor
        vm.writeFile(string.concat(root, "/frontend/src/config.ts"), string.concat(header, "export const ", body));
        vm.writeFile(string.concat(root, "/agent/config.js"), string.concat(header, "export const ", body));
    }
}
