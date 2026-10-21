import { createPublicClient, defineChain, http, type Address } from "viem";

export const CHOG_CONTRACT = "0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763" as const;
export const SUPPLY = 1969;

export const monad = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [process.env.MONAD_RPC || "https://rpc.monad.xyz"] } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});

export const publicClient = createPublicClient({ chain: monad, transport: http() });

const erc721 = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export async function ownerOf(tokenId: number): Promise<Address | null> {
  try {
    return await publicClient.readContract({
      address: CHOG_CONTRACT,
      abi: erc721,
      functionName: "ownerOf",
      args: [BigInt(tokenId)],
    });
  } catch {
    return null;
  }
}

/** ownerOf for every token, via Multicall3 in chunks. */
export async function allOwners(): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const ids = Array.from({ length: SUPPLY }, (_, i) => i + 1);
  for (let i = 0; i < ids.length; i += 400) {
    const chunk = ids.slice(i, i + 400);
    const res = await publicClient.multicall({
      contracts: chunk.map((id) => ({
        address: CHOG_CONTRACT,
        abi: erc721,
        functionName: "ownerOf" as const,
        args: [BigInt(id)] as const,
      })),
      allowFailure: true,
    });
    res.forEach((r, k) => {
      if (r.status === "success") out.set(chunk[k], (r.result as string).toLowerCase());
    });
  }
  return out;
}

export async function blockNumber(): Promise<bigint | null> {
  try {
    return await publicClient.getBlockNumber();
  } catch {
    return null;
  }
}
