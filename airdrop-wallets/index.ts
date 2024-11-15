import type { Prisma } from "@prisma/client";
import { decodeEventLog, erc20Abi, type Hash } from "viem";

import {
  ERC20_TRANSFER_EVENT,
  ERC20_TRANSFER_SIGNATURE,
  KATANA_ROUTER_DEX,
  KATANA_SWAP_EVENT,
  PIXEL_RONIN_CONTRACT_ADDRESS,
  PIXEL_WRAPPED_RONIN_PAIR_ADDRESS,
} from "../constants.ts";
import prisma from "../data-storage/prisma.ts";
import rpcRequest from "../rpc-request.ts";

export async function indexAirdropWallets(args: {
  walletAddress: Hash;
  fromBlock: bigint;
  toBlock: bigint;
  isDistributor: boolean;
  limit?: number;
}) {
  const { walletAddress, fromBlock, toBlock, isDistributor, limit = 0 } = args;

  console.log(
    `[${walletAddress}] Indexing airdrop wallets (isDistributor: ${isDistributor})`,
  );

  const publicClient = await rpcRequest.getPublicClient();

  const filter = await publicClient.createEventFilter({
    address: PIXEL_RONIN_CONTRACT_ADDRESS,
    event: ERC20_TRANSFER_EVENT,
    args: {
      from: walletAddress,
    },
    fromBlock,
    toBlock,
  });

  const filteredLogs = await publicClient.getFilterLogs({ filter });

  console.log(`[${walletAddress}] Found ${filteredLogs.length} logs`);

  const airdropWalletInputs: Prisma.AirdropWalletCreateManyInput[] = [];
  const airdropWalletAddresses = new Set<string>();

  filteredLogs.forEach((log) => {
    if (limit !== 0 && airdropWalletAddresses.size >= limit) {
      return;
    }
    const [signature, ...logTopics] = log.topics;
    if (signature !== ERC20_TRANSFER_SIGNATURE) {
      throw new Error(`[${walletAddress}] Invalid signature`);
    }
    const decodedTopics = decodeEventLog({
      abi: erc20Abi,
      eventName: "Transfer",
      data: log.data,
      topics: [signature, ...logTopics],
    });

    const airdropWalletAddress = decodedTopics.args.to.toLowerCase();
    airdropWalletAddresses.add(airdropWalletAddress);

    // add airdrop wallets
    airdropWalletInputs.push({
      address: airdropWalletAddress,
      sender: decodedTopics.args.from.toLowerCase(),
      amount: decodedTopics.args.value.toString(),

      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash.toLowerCase(),
      transactionIndex: log.transactionIndex,
      logIndex: log.logIndex,

      isAirdropDistributor: isDistributor,
    });
  });

  // store into the database
  const airdropWalletResult = await prisma.airdropWallet.createMany({
    data: airdropWalletInputs,
    skipDuplicates: true,
  });

  console.log(
    `[${walletAddress}] Created airdrop wallets: ${airdropWalletResult.count}`,
  );
}

export async function indexAirdropTransfers(args: {
  walletAddress: Hash;
  fromBlock: bigint;
  toBlock: bigint;
}) {
  const { walletAddress, fromBlock, toBlock } = args;

  console.log(`[${walletAddress}] Indexing airdrop transfers`);

  const publicClient = await rpcRequest.getPublicClient();

  const filter = await publicClient.createEventFilter({
    address: PIXEL_RONIN_CONTRACT_ADDRESS,
    event: ERC20_TRANSFER_EVENT,
    args: {
      from: walletAddress,
    },
    fromBlock,
    toBlock,
  });

  const filteredLogs = await publicClient.getFilterLogs({ filter });

  console.log(`[${walletAddress}] Found ${filteredLogs.length} logs`);

  const airdropTransferInputs: Prisma.AirdropTransferCreateManyInput[] = [];
  const transactionHashes = new Set<string>();

  filteredLogs.forEach((log) => {
    const [signature, ...logTopics] = log.topics;
    if (signature !== ERC20_TRANSFER_SIGNATURE) {
      throw new Error(`[${walletAddress}] Invalid signature`);
    }
    const decodedTopics = decodeEventLog({
      abi: erc20Abi,
      eventName: "Transfer",
      data: log.data,
      topics: [signature, ...logTopics],
    });

    // add airdrop transfers
    airdropTransferInputs.push({
      hash: `${log.blockNumber}-${log.transactionIndex}-${log.logIndex}`,
      fromWallet: decodedTopics.args.from.toLowerCase(),
      toWallet: decodedTopics.args.to.toLowerCase(),
      amount: decodedTopics.args.value.toString(),

      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash.toLowerCase(),
      transactionIndex: log.transactionIndex,
      logIndex: log.logIndex,
    });

    // add transaction hashes
    transactionHashes.add(log.transactionHash.toLowerCase());
  });

  // store into the database
  const [airdropTransferDeletedResult, airdropTransferResult] =
    await prisma.$transaction([
      prisma.airdropTransfer.deleteMany({
        where: {
          transactionHash: {
            in: [...transactionHashes],
          },
        },
      }),
      prisma.airdropTransfer.createMany({
        data: airdropTransferInputs,
      }),
    ]);

  console.log(
    `[${walletAddress}] Deleted airdrop transfers: ${airdropTransferDeletedResult.count}`,
  );
  console.log(
    `[${walletAddress}] Created airdrop transfers: ${airdropTransferResult.count}`,
  );
}

export async function indexSwaps() {
  console.log(`Indexing swaps`);

  const BLOCK_RANGE = 30000n;
  const publicClient = await rpcRequest.getPublicClient();
  const firstPixelDistributeBlock = await prisma.airdropTransfer
    .findFirst({
      where: {
        toWallet: PIXEL_WRAPPED_RONIN_PAIR_ADDRESS.toLowerCase(),
      },
      orderBy: {
        blockNumber: "asc",
      },
      select: {
        blockNumber: true,
      },
    })
    .then((r) => {
      if (r == null) {
        throw new Error(`No first pixel distribute block found`);
      }

      return r.blockNumber;
    });
  const fromBlock = firstPixelDistributeBlock;
  const toBlock = firstPixelDistributeBlock + BLOCK_RANGE;
  const filter = await publicClient.createEventFilter({
    address: PIXEL_WRAPPED_RONIN_PAIR_ADDRESS,
    event: KATANA_SWAP_EVENT,
    args: {
      _sender: KATANA_ROUTER_DEX,
      _to: KATANA_ROUTER_DEX,
    },
    fromBlock,
    toBlock,
  });
  const filteredLogs = await publicClient.getFilterLogs({ filter });

  console.log(`indexSwaps Found ${filteredLogs.length} logs`);

  const [swapDeletedResult, swapResult] = await prisma.$transaction([
    prisma.swap.deleteMany({
      where: {
        blockNumber: {
          gte: fromBlock,
          lte: toBlock,
        },
      },
    }),
    prisma.swap.createMany({
      data: filteredLogs.map((log) => ({
        hash: `${log.blockNumber}-${log.transactionIndex}-${log.logIndex}`,

        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash.toLowerCase(),
        transactionIndex: log.transactionIndex,
        logIndex: log.logIndex,
      })),
    }),
  ]);

  console.log(
    `swap deleted: ${swapDeletedResult.count} | swap created: ${swapResult.count}`,
  );
}
