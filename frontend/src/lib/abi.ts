// AgentGuard'ın panelin kullandığı kısmı (okunabilir imzalar → parseAbi → JSON ABI).
import { parseAbi } from "viem";

export const guardAbi = parseAbi([
  "function owner() view returns (address)",
  "function agent() view returns (address)",
  "function perTxLimit() view returns (uint256)",
  "function totalBudget() view returns (uint256)",
  "function spent() view returns (uint256)",
  "function remainingBudget() view returns (uint256)",
  "function pendingCount() view returns (uint256)",
  "function pending(uint256) view returns (address provider, uint256 amount, bytes32 category, bytes32 purposeHash, uint8 status)",
  "function allowedProvider(address) view returns (bool)",
  "function allowedCategory(bytes32) view returns (bool)",
  "function approvePending(uint256 id)",
  "function rejectPending(uint256 id)",
  "event Settled(address indexed provider, uint256 amount, bytes32 indexed category, bytes32 indexed purposeHash)",
  "event Rejected(address indexed provider, uint256 amount, bytes32 indexed category, bytes32 indexed purposeHash, uint8 reason)",
  "event PendingCreated(uint256 indexed id, address indexed provider, uint256 amount, bytes32 category, bytes32 purposeHash)",
  "event PendingApproved(uint256 indexed id)",
  "event PendingRejected(uint256 indexed id)",
  // Hatalar: viem revert sebebini bu adlarla çözer (ör. "ExceedsBudget")
  "error NotOwner()",
  "error NotOpen(uint256 id)",
  "error ExceedsBudget()",
  "error ExceedsBalance()",
  "error TransferFailed()",
]);

export const ERROR_TEXT: Record<string, string> = {
  NotOwner: "Bağlı cüzdan owner değil",
  NotOpen: "Bu ödeme artık beklemede değil",
  ExceedsBudget: "Onaylanırsa bütçe aşılır",
  ExceedsBalance: "Kasada yeterli MON yok",
  TransferFailed: "Servise transfer başarısız",
};

// Sözleşmedeki enum sıralarıyla aynı olmalı
export const REJECT_REASONS = ["Tek işlem limiti aşıldı", "Bütçe aşıldı", "Kategori kapsam dışı", "Kasa bakiyesi yetersiz"];
export const PENDING_STATUS = ["Yok", "Bekliyor", "Onaylandı", "Reddedildi"] as const;
