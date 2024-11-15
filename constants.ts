import { erc20Abi, getAbiItem, getAddress, toEventSelector } from "viem";

import { katanaPairAbi } from "./abis";

export const PIXEL_RONIN_CONTRACT_ADDRESS = getAddress(
  "0x7eae20d11ef8c779433eb24503def900b9d28ad7",
);

export const ERC20_TRANSFER_EVENT = getAbiItem({
  abi: erc20Abi,
  name: "Transfer",
});

export const KATANA_SWAP_EVENT = getAbiItem({
  abi: katanaPairAbi,
  name: "Swap",
});

export const ERC20_TRANSFER_SIGNATURE = toEventSelector(ERC20_TRANSFER_EVENT);

export const PIXEL_AIRDROP_MINT_RECEIVER = getAddress(
  "0xC0bd6B8B4cfeE139fb1B85f9bEc9971083a36083",
);
export const PIXEL_AIRDROP_ORIGIN_DISTRIBUTOR = getAddress(
  "0x17dD916c3a3Cc2Fe92DaC0152C9Aa46D066e9fAa",
);

export const BINANCE_RONIN_WALLET = getAddress(
  "0xb32e9a84ae0b55b8ab715e4ac793a61b277bafa3",
);

export const PIXEL_WRAPPED_RONIN_PAIR_ADDRESS = getAddress(
  "0xb30b54b9a36188d33eeb34b29eaa38d12511e997",
);

export const KATANA_ROUTER_DEX = getAddress(
  "0x7D0556D55ca1a92708681e2e231733EBd922597D",
);

// Mint transaction: 0x73f5f9b5ed8b3629b381308919d76d3808268dd34f6acb9e3ed4fd282aa492b8
