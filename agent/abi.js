// AgentGuard'ın ajan ve servislerin ihtiyaç duyduğu kısmı, okunabilir imzalarla.
// parseAbi bu satırları viem'in anladığı JSON ABI'ye çevirir.
import { parseAbi } from "viem";

export const guardAbi = parseAbi([
  "function requestPayment(address provider, uint256 amount, bytes32 category, bytes32 purposeHash) returns (uint8 decision, uint256 pendingId)",
  "function spent() view returns (uint256)",
  "function remainingBudget() view returns (uint256)",
  // Owner tarafı: demo.js sahneyi hazırlarken kullanır
  "function perTxLimit() view returns (uint256)",
  "function totalBudget() view returns (uint256)",
  "function pendingCount() view returns (uint256)",
  "function allowedProvider(address) view returns (bool)",
  "function setProvider(address provider, bool allowed)",
  "function setLimits(uint256 perTxLimit, uint256 totalBudget)",
  "function withdraw(address to, uint256 amount)",
  "function approvePending(uint256 id)",
  "event Settled(address indexed provider, uint256 amount, bytes32 indexed category, bytes32 indexed purposeHash)",
  "event Rejected(address indexed provider, uint256 amount, bytes32 indexed category, bytes32 indexed purposeHash, uint8 reason)",
  "event PendingCreated(uint256 indexed id, address indexed provider, uint256 amount, bytes32 category, bytes32 purposeHash)",
  "event PendingApproved(uint256 indexed id)",
  "event PendingRejected(uint256 indexed id)",
]);

// Sözleşmedeki enum RejectReason sırasıyla aynı olmalı
export const REJECT_REASONS = ["OverPerTxLimit", "OverBudget", "CategoryNotAllowed", "InsufficientBalance"];
