import { formatEther } from "viem";

/** 20000000000000000n → "0.02 MON" */
export const mon = (wei: bigint, digits = 4) => `${Number(formatEther(wei)).toFixed(digits).replace(/\.?0+$/, "")} MON`;

export const clock = (seconds?: number) =>
  seconds ? new Date(seconds * 1000).toLocaleTimeString("tr-TR") : "—";
