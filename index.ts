import { getAddress } from "viem";

import {
  indexAirdropTransfers,
  indexAirdropWallets,
  indexSwaps,
} from "./airdrop-wallets";
import {
  BINANCE_RONIN_WALLET,
  PIXEL_AIRDROP_ORIGIN_DISTRIBUTOR,
} from "./constants.ts";
import prisma from "./data-storage/prisma.ts";

async function start() {
  await index();

  await retentionScan();
}

async function index() {
  // index airdrop distributors
  {
    await indexAirdropWallets({
      walletAddress: PIXEL_AIRDROP_ORIGIN_DISTRIBUTOR,
      fromBlock: 32158385n,
      toBlock: 36818059n,
      isDistributor: true,
    });

    console.log(`Indexed airdrop distributors.`);
  }

  // index airdrop wallets by distributors
  {
    console.log(`Indexing airdrop wallets by distributors.`);
    const LIMIT = 1000;
    const BLOCK_RANGE = 11000n;
    const distributorWallets = await prisma.airdropWallet.findMany({
      where: {
        isAirdropDistributor: true,
      },
    });
    const total = distributorWallets.length;
    for (const distributorWallet of distributorWallets) {
      await indexAirdropWallets({
        walletAddress: getAddress(distributorWallet.address),
        fromBlock: distributorWallet.blockNumber,
        toBlock: distributorWallet.blockNumber + BLOCK_RANGE,
        isDistributor: false,
        limit: +(LIMIT / total),
      });
    }

    console.log(
      `Indexed all airdrop wallets by distributors. Block range ${BLOCK_RANGE}.`,
    );
  }

  // index airdrop transfers by non-distributors
  {
    console.log(`Indexing airdrop transfers by non-distributors.`);
    const BLOCK_RANGE = 15000n;
    const wallets = await prisma.airdropWallet.findMany({
      where: {
        isAirdropDistributor: false,
      },
    });
    for (const wallet of wallets) {
      await indexAirdropTransfers({
        walletAddress: getAddress(wallet.address),
        fromBlock: wallet.blockNumber,
        toBlock: wallet.blockNumber + BLOCK_RANGE,
      });
    }

    console.log(`Indexed all airdrop transfers. Block range ${BLOCK_RANGE}.`);
  }

  // index airdrop transfers by non-distributor's airdrop recipients
  {
    console.log(`Indexing level 2 airdrop transfers.`);
    const BLOCK_RANGE = 15000n;
    const wallets = await prisma.airdropTransfer.groupBy({
      by: ["toWallet"],
      _min: {
        blockNumber: true,
      },
    });
    for (const wallet of wallets) {
      const blockNumber = wallet._min.blockNumber;
      if (blockNumber == null) {
        throw new Error(`No block number found for ${wallet}`);
      }
      await indexAirdropTransfers({
        walletAddress: getAddress(wallet.toWallet),
        fromBlock: blockNumber,
        toBlock: blockNumber + BLOCK_RANGE,
      });
    }

    console.log(`Indexed all airdrop transfers. Block range ${BLOCK_RANGE}.`);
  }

  // Index swaps
  {
    await indexSwaps();
  }
}

async function retentionScan() {
  const [airdropSoldWallets, totalAirdropWallets] = await prisma.$transaction([
    prisma.$queryRaw<{ walletAddress: string }[]>`
      SELECT at."fromWallet" AS "walletAddress"
      FROM airdrop_transfers at
             JOIN airdrop_wallets aw
                  ON at."fromWallet" = aw.address
      WHERE aw."isAirdropDistributor" = false
        AND (
        -- sold right away
        at."toWallet" = ${BINANCE_RONIN_WALLET.toLowerCase()}
          -- transfer and sold
          OR (SELECT COUNT(*)
              FROM airdrop_transfers at2
              WHERE at2."fromWallet" = "at"."toWallet"
                AND at2."toWallet" = ${BINANCE_RONIN_WALLET.toLowerCase()}) > 0
          -- sold by swap
          OR (SELECT COUNT(*) FROM swaps s WHERE s."transactionHash" = at."transactionHash") > 0
          -- transfer and sold by swap
          OR (SELECT COUNT(*)
              FROM airdrop_transfers at2
              WHERE at2."fromWallet" = "at"."toWallet"
                AND (SELECT COUNT(*) FROM swaps s WHERE s."transactionHash" = at2."transactionHash") > 0) > 0
        )
      GROUP BY at."fromWallet"`,
    prisma.airdropWallet.count({
      where: {
        isAirdropDistributor: false,
      },
    }),
  ]);
  const retentionRate =
    100 - (airdropSoldWallets.length / totalAirdropWallets) * 100;

  console.log(
    `total: ${totalAirdropWallets} | sold: ${airdropSoldWallets.length} | retention rate: ${retentionRate.toFixed(2)}%`,
  );
}

await start();
