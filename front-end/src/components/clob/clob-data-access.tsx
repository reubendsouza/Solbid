'use client'

import * as anchor from '@coral-xyz/anchor'
import { getClobProgram, getClobProgramId } from '@/lib/clob/clob-exports'
import { useConnection } from '@solana/wallet-adapter-react'
import { Cluster, PublicKey } from '@solana/web3.js'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { ClusterNetwork, SolanaCluster, useCluster } from '../cluster/cluster-data-access'
import { useAnchorProvider } from '../solana/solana-provider'
import { useTransactionToast } from '../use-transaction-toast'
import { toast } from 'sonner'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { AnchorProvider, Wallet } from '@coral-xyz/anchor'
import { Connection } from '@solana/web3.js'

export function useClobProgram() {
  const { connection } = useConnection()
  const { cluster } = useCluster();
  const transactionToast = useTransactionToast()
  const provider = useAnchorProvider()
  const programId = useMemo(() => getClobProgramId(cluster.network as Cluster), [cluster])
  const program = useMemo(() => getClobProgram(provider, programId), [provider, programId])

  const orderBooks = useQuery({
    queryKey: ['clob', 'all', { cluster }],
    queryFn: () => program.account.orderbook.all(),
  })

  const getProgramAccount = useQuery({
    queryKey: ['get-program-account', { cluster }],
    queryFn: () => connection.getParsedAccountInfo(programId),
  })

  const initializeOrderbook = useMutation({
    mutationKey: ['clob', 'initialize-orderbook', { cluster }],
    mutationFn: async ({ baseTokenMint, quoteTokenMint }: { baseTokenMint: PublicKey, quoteTokenMint: PublicKey }) => {
      try {
        // Generate a new keypair for the orderbook account
        
        return program.methods
          .initializeOrderbook()
          .accounts({
            payer: provider.publicKey,
            baseTokenMint,
            quoteTokenMint,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc()
      } catch (error) {
        console.error('Error initializing orderbook:', error)
        throw error
      }
    },
    onSuccess: (signature) => {
      transactionToast(signature)
      return orderBooks.refetch()
    },
    onError: (error) => {
      console.error('Failed to initialize orderbook:', error)
      toast.error('Failed to initialize orderbook')
    },
  })

  return {
    program,
    programId,
    orderBooks,
    getProgramAccount,
    initializeOrderbook,
  }
}

export function useClobOrderbook({ orderBookAddress }: { orderBookAddress: PublicKey }) {
  const { cluster } = useCluster();
  const magicCluster: SolanaCluster = {
    name: 'magicblock-devnet',
    endpoint: 'https://devnet.magicblock.app',
    network: ClusterNetwork.Custom,
  } as SolanaCluster;
  console.log('magicCluster: ', magicCluster);
  const transactionToast = useTransactionToast()
  const { program, orderBooks } = useClobProgram()
  const provider = useAnchorProvider()
  console.log('orderBooks: ', orderBooks);
  const orderbookQuery = useQuery({
    queryKey: ['clob', 'fetch', { cluster, orderBookAddress }],
    queryFn: () => fetchOrderbookFallback(orderBookAddress),
  })

  // Example: create an ER provider (adjust endpoint and wallet as needed)
  const ER_RPC_URL = 'https://devnet.magicblock.app'
  const ER_WS_URL = 'wss://devnet.magicblock.app'
  // You need a wallet for the ER provider. This could be the same as your base wallet, or a different one.
  const erWallet = provider.wallet // or however you manage wallets

  const erProvider = new AnchorProvider(
    new Connection(ER_RPC_URL, { wsEndpoint: ER_WS_URL }),
    erWallet
  )

  const createOrderMutation = useMutation({
    mutationKey: ['clob', 'create-order', { cluster, orderBookAddress }],
    mutationFn: async ({
      side, price, amount, baseTokenMint, quoteTokenMint, isDelegated = true
    }: {
      side: number,
      price: number,
      amount: number,
      baseTokenMint: PublicKey,
      quoteTokenMint: PublicKey,
      isDelegated: boolean,
    }) => {
      if (isDelegated) {
        // Use ER provider
        let tx = await program.methods
          .createOrder(side, new anchor.BN(price), new anchor.BN(amount))
          .accounts({
            user: erProvider.wallet.publicKey,
            baseTokenMint,
            quoteTokenMint,
            // ...other accounts as needed
          })
          .transaction();

        tx.feePayer = erProvider.wallet.publicKey;
        tx.recentBlockhash = (await erProvider.connection.getLatestBlockhash()).blockhash;
        tx = await erProvider.wallet.signTransaction(tx);
        const txHash = await erProvider.sendAndConfirm(tx, [], {
          skipPreflight: true,
          commitment: "confirmed",
        });
        return txHash;
      } else {
        // Use base layer provider
        return program.methods
          .createOrder(side, new anchor.BN(price), new anchor.BN(amount))
          .accounts({
            user: provider.publicKey,
            baseTokenMint,
            quoteTokenMint,
          })
          .rpc({
            skipPreflight: true,
          });
      }
    },
    onSuccess: (tx) => {
      transactionToast(tx)
      console.log('tx: ', tx);
      return orderbookQuery.refetch()
    },
    onError: () => toast.error('Failed to create order'),
  })

  const delegateOrderbookMutation = useMutation({
    mutationKey: ['clob', 'delegate-orderbook', { cluster, orderBookAddress }],
    mutationFn: async ({ baseTokenMint, quoteTokenMint }: 
      { baseTokenMint: PublicKey, quoteTokenMint: PublicKey }) => {
        console.log('baseTokenMint: ', baseTokenMint);
      return program.methods
        .delegate()
        .accounts({
          user: provider.publicKey,
          baseTokenMint,
          quoteTokenMint,
        })
        .rpc({
          skipPreflight: true,
        })
    },
    onSuccess: (tx) => {
      transactionToast(tx)
      return orderbookQuery.refetch()
    },
    onError: () => toast.error('Failed to delegate orderbook'),
  })

  const undelegateOrderbookMutation = useMutation({
    mutationKey: ['clob', 'undelegate-orderbook', { magicCluster, orderBookAddress }],
    mutationFn: async ({ baseTokenMint, quoteTokenMint }: 
      { baseTokenMint: PublicKey, quoteTokenMint: PublicKey }) => {
      const tx = await program.methods
        .undelegate()
        .accounts({
          user: provider.publicKey,
          baseTokenMint,
          quoteTokenMint,
        })
        .rpc({
          skipPreflight: true,
        });
        console.log('tx: ', tx);
      return tx;
    },
    onSuccess: (tx) => {
      transactionToast(tx)
      return orderbookQuery.refetch()
    },
    onError: (error) => {
      console.error('Failed to undelegate orderbook:', error)
      toast.error('Failed to undelegate orderbook')
    },
  })

  const depositBalanceMutation = useMutation({
    mutationKey: ['clob', 'deposit-balance', { cluster, orderBookAddress }],
    mutationFn: async ({ baseAmount, quoteAmount, baseTokenMint, quoteTokenMint }: 
      { baseAmount: number, quoteAmount: number, baseTokenMint: PublicKey, quoteTokenMint: PublicKey }) => {
      return program.methods
        .depositBalance(new anchor.BN(baseAmount), new anchor.BN(quoteAmount))
        .accounts({
          user: provider.publicKey,
          baseTokenMint,
          quoteTokenMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc()
    },
    onSuccess: (tx) => {
      transactionToast(tx)
      return orderbookQuery.refetch()
    },
    onError: () => toast.error('Failed to deposit balance'),
  })

  const withdrawFundsMutation = useMutation({
    mutationKey: ['clob', 'withdraw-funds', { cluster, orderBookAddress }],
    mutationFn: async ({ baseAmount, quoteAmount, baseTokenMint, quoteTokenMint }: 
      { baseAmount: number, quoteAmount: number, baseTokenMint: PublicKey, quoteTokenMint: PublicKey }) => {
      return program.methods
        .withdrawFunds(new anchor.BN(baseAmount), new anchor.BN(quoteAmount))
        .accounts({
          user: provider.publicKey,
          baseTokenMint,
          quoteTokenMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc()
    },
    onSuccess: (tx) => {
      transactionToast(tx)
      return orderbookQuery.refetch()
    },
    onError: () => toast.error('Failed to withdraw funds'),
  })

  const matchOrderMutation = useMutation({
    mutationKey: ['clob', 'match-order', { cluster, orderBookAddress }],
    mutationFn: async ({
      orderId,
      baseTokenMint,
      quoteTokenMint,
      isDelegated = true,
    }: {
      orderId: number,
      baseTokenMint: PublicKey,
      quoteTokenMint: PublicKey,
      isDelegated?: boolean,
    }) => {
      if (isDelegated) {
        // Use ER provider
        let tx = await program.methods
          .matchOrder(new anchor.BN(orderId))
          .accounts({
            user: erProvider.wallet.publicKey,
            baseTokenMint,
            quoteTokenMint,
          })
          .transaction();

        tx.feePayer = erProvider.wallet.publicKey;
        tx.recentBlockhash = (await erProvider.connection.getLatestBlockhash()).blockhash;
        tx = await erProvider.wallet.signTransaction(tx);
        const txHash = await erProvider.sendAndConfirm(tx, [], {
          skipPreflight: true,
          commitment: "confirmed",
        });
        console.log('txHash: ', txHash);
        return txHash;
      } else {
        // Use base layer provider
        return program.methods
          .matchOrder(new anchor.BN(orderId))
          .accounts({
            user: provider.publicKey,
            baseTokenMint,
            quoteTokenMint,
          })
          .rpc({
            skipPreflight: true,
          });
      }
    },
    onSuccess: (tx) => {
      transactionToast(tx)
      return orderbookQuery.refetch()
    },
    onError: () => toast.error('Failed to match order'),
  })

  return {
    orderbookQuery,
    createOrderMutation,
    depositBalanceMutation,
    withdrawFundsMutation,
    delegateOrderbookMutation,
    undelegateOrderbookMutation,
    matchOrderMutation,
  }
}

async function fetchOrderbookFallback(orderBookAddress: PublicKey) {
  // Try ER first
  try {
    const erOrderbook = await erProvider.program.account.orderbook.fetch(orderBookAddress);
    if (erOrderbook) return { orderbook: erOrderbook, source: 'er' };
  } catch (e) {
    // Ignore and try devnet
  }
  // Fallback to devnet
  try {
    const devnetOrderbook = await program.account.orderbook.fetch(orderBookAddress);
    if (devnetOrderbook) return { orderbook: devnetOrderbook, source: 'devnet' };
  } catch (e) {
    // Both failed
    throw new Error('Orderbook not found on ER or devnet');
  }
}
