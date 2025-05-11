'use client'

import * as anchor from '@coral-xyz/anchor'
import { getClobProgram, getClobProgramId } from '@/lib/clob/clob-exports'
import { useConnection } from '@solana/wallet-adapter-react'
import { Cluster, Keypair, PublicKey } from '@solana/web3.js'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useCluster } from '../cluster/cluster-data-access'
import { useAnchorProvider } from '../solana/solana-provider'
import { useTransactionToast } from '../use-transaction-toast'
import { toast } from 'sonner'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'

export function useClobProgram() {
  const { connection } = useConnection()
  const { cluster } = useCluster()
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
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const { program, orderBooks } = useClobProgram()
  const provider = useAnchorProvider()
  console.log('orderBooks: ', orderBooks);
  const orderbookQuery = useQuery({
    queryKey: ['clob', 'fetch', { cluster, orderBookAddress }],
    queryFn: () => program.account.orderbook.fetch(orderBookAddress),
  })

  const createOrderMutation = useMutation({
    mutationKey: ['clob', 'create-order', { cluster, orderBookAddress }],
    mutationFn: async ({ side, price, amount, baseTokenMint, quoteTokenMint }: 
      { side: number, price: number, amount: number, baseTokenMint: PublicKey, quoteTokenMint: PublicKey }) => {
      return program.methods
        .createOrder(side, new anchor.BN(price), new anchor.BN(amount))
        .accounts({
          user: provider.publicKey,
          baseTokenMint,
          quoteTokenMint,
        })
        .rpc()
    },
    onSuccess: (tx) => {
      transactionToast(tx)
      return orderbookQuery.refetch()
    },
    onError: () => toast.error('Failed to create order'),
  })

  const delegateOrderbookMutation = useMutation({
    mutationKey: ['clob', 'delegate-orderbook', { cluster, orderBookAddress }],
    mutationFn: async ({ baseTokenMint, quoteTokenMint }: 
      { baseTokenMint: PublicKey, quoteTokenMint: PublicKey }) => {
      return program.methods
        .delegate()
        .accounts({
          user: provider.publicKey,
          baseTokenMint,
          quoteTokenMint,
        })
        .rpc()
    },
    onSuccess: (tx) => {
      transactionToast(tx)
      return orderbookQuery.refetch()
    },
    onError: () => toast.error('Failed to delegate orderbook'),
  })

  const undelegateOrderbookMutation = useMutation({
    mutationKey: ['clob', 'undelegate-orderbook', { cluster, orderBookAddress }],
    mutationFn: async ({ baseTokenMint, quoteTokenMint }: 
      { baseTokenMint: PublicKey, quoteTokenMint: PublicKey }) => {
      return program.methods
        .undelegate()
        .accounts({
          user: provider.publicKey,
          baseTokenMint,
          quoteTokenMint,
        })
        .rpc()
    },
    onSuccess: (tx) => {
      transactionToast(tx)
      return orderbookQuery.refetch()
    },
    onError: () => toast.error('Failed to undelegate orderbook'),
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

  return {
    orderbookQuery,
    createOrderMutation,
    depositBalanceMutation,
    withdrawFundsMutation,
    delegateOrderbookMutation,
    undelegateOrderbookMutation,
  }
}
