'use client'

import { PublicKey } from '@solana/web3.js'
import { useMemo, useState } from 'react'
import { ExplorerLink } from '../cluster/cluster-ui'
import { useClobProgram, useClobOrderbook } from './clob-data-access'
import { ellipsify } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
// import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useAnchorProvider } from '../solana/solana-provider'
import * as anchor from '@coral-xyz/anchor'
import { useRouter } from 'next/navigation'

const RadioGroup = ({ defaultValue, className, onValueChange, children }: any) => (
  <div className={className}>
    {children}
  </div>
);

const RadioGroupItem = ({ value, id }: any) => (
  <input 
    type="radio" 
    value={value} 
    id={id} 
    name="orderSide" 
    onChange={(e) => e.target.checked && e.target.value} 
    defaultChecked={value === "0"}
  />
);

export function ClobInitialize() {
  const { initializeOrderbook } = useClobProgram()
  const [baseTokenMint, setBaseTokenMint] = useState('')
  const [quoteTokenMint, setQuoteTokenMint] = useState('')

  const handleInitialize = async () => {
    try {
      const baseTokenMintPubkey = new PublicKey(baseTokenMint)
      const quoteTokenMintPubkey = new PublicKey(quoteTokenMint)
      
      await initializeOrderbook.mutateAsync({
        baseTokenMint: baseTokenMintPubkey,
        quoteTokenMint: quoteTokenMintPubkey,
      })
    } catch (error) {
      console.error('Invalid public key format', error)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Initialize Orderbook</CardTitle>
        <CardDescription>Create a new orderbook for trading tokens</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="baseTokenMint">Base Token Mint</Label>
            <Input 
              id="baseTokenMint" 
              placeholder="Enter base token mint address" 
              value={baseTokenMint}
              onChange={(e) => setBaseTokenMint(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quoteTokenMint">Quote Token Mint</Label>
            <Input 
              id="quoteTokenMint" 
              placeholder="Enter quote token mint address" 
              value={quoteTokenMint}
              onChange={(e) => setQuoteTokenMint(e.target.value)}
            />
          </div>
          <Button 
            onClick={handleInitialize} 
            disabled={initializeOrderbook.isPending || !baseTokenMint || !quoteTokenMint}
          >
            Initialize {initializeOrderbook.isPending && '...'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function ClobOrderbookList() {
  const { orderBooks, getProgramAccount } = useClobProgram()
  const router = useRouter()

  if (getProgramAccount.isLoading) {
    return <span className="loading loading-spinner loading-lg"></span>
  }
  
  if (!getProgramAccount.data?.value) {
    return (
      <div className="alert alert-info flex justify-center">
        <span>Program account not found. Make sure you have deployed the program and are on the correct cluster.</span>
      </div>
    )
  }
  
  return (
    <div className={'space-y-6'}>
      {orderBooks.isLoading ? (
        <span className="loading loading-spinner loading-lg"></span>
      ) : orderBooks.data?.length ? (
        <div className="grid md:grid-cols-2 gap-4">
          {orderBooks.data?.map((orderbook) => (
            <Card 
              key={orderbook.publicKey.toString()} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`/orderbook/${orderbook.publicKey.toString()}`)}
            >
              <CardHeader>
                <CardTitle>Orderbook</CardTitle>
                <CardDescription>
                  Address: <ExplorerLink path={`account/${orderbook.publicKey}`} label={ellipsify(orderbook.publicKey.toString())} />
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center">
          <h2 className={'text-2xl'}>No orderbooks</h2>
          No orderbooks found. Create one above to get started.
        </div>
      )}
    </div>
  )
}

export function ClobOrderbookDetail({ orderBookAddress }: { orderBookAddress: PublicKey }) {
  const { orderbookQuery, createOrderMutation, depositBalanceMutation, withdrawFundsMutation } = useClobOrderbook({
    orderBookAddress: new PublicKey(orderBookAddress),
  })
  const [side, setSide] = useState<number>(0) // 0 for buy, 1 for sell
  const [price, setPrice] = useState<string>('')
  const [amount, setAmount] = useState<string>('')
  const [depositBaseAmount, setDepositBaseAmount] = useState<string>('')
  const [depositQuoteAmount, setDepositQuoteAmount] = useState<string>('')
  const [withdrawBaseAmount, setWithdrawBaseAmount] = useState<string>('')
  const [withdrawQuoteAmount, setWithdrawQuoteAmount] = useState<string>('')

  const baseTokenMint = useMemo(() => {
    if (orderbookQuery.data) {
      // This is a placeholder - you'll need to extract the actual base token mint from your orderbook data
      return new PublicKey(orderbookQuery.data.baseAsset || '')
    }
    return null
  }, [orderbookQuery.data])

  const quoteTokenMint = useMemo(() => {
    if (orderbookQuery.data) {
      // This is a placeholder - you'll need to extract the actual quote token mint from your orderbook data
      return new PublicKey(orderbookQuery.data.quoteAsset || '')
    }
    return null
  }, [orderbookQuery.data])

  const handleCreateOrder = async () => {
    if (!baseTokenMint || !quoteTokenMint) return
    
    await createOrderMutation.mutateAsync({
      side,
      price: parseFloat(price),
      amount: parseFloat(amount),
      baseTokenMint,
      quoteTokenMint,
    })
  }

  const handleDepositBalance = async () => {
    if (!baseTokenMint || !quoteTokenMint) return
    
    await depositBalanceMutation.mutateAsync({
      baseAmount: parseFloat(depositBaseAmount),
      quoteAmount: parseFloat(depositQuoteAmount),
      baseTokenMint,
      quoteTokenMint,
    })
  }

  const handleWithdrawFunds = async () => {
    if (!baseTokenMint || !quoteTokenMint) return
    
    await withdrawFundsMutation.mutateAsync({
      baseAmount: parseFloat(withdrawBaseAmount),
      quoteAmount: parseFloat(withdrawQuoteAmount),
      baseTokenMint,
      quoteTokenMint,
    })
  }

  return orderbookQuery.isLoading ? (
    <span className="loading loading-spinner loading-lg"></span>
  ) : (
    <Card>
      <CardHeader>
        <CardTitle>Orderbook</CardTitle>
        <CardDescription>
          Address: <ExplorerLink path={`account/${orderBookAddress}`} label={ellipsify(orderBookAddress.toString())} />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Create Order Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Create Order</h3>
            <RadioGroup defaultValue="0" className="flex space-x-4" onValueChange={(value) => setSide(parseInt(value))}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="0" id="buy" />
                <Label htmlFor="buy">Buy</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="1" id="sell" />
                <Label htmlFor="sell">Sell</Label>
              </div>
            </RadioGroup>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price</Label>
                <Input 
                  id="price" 
                  placeholder="Enter price" 
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  type="number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input 
                  id="amount" 
                  placeholder="Enter amount" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  type="number"
                />
              </div>
            </div>
            <Button 
              onClick={handleCreateOrder} 
              disabled={createOrderMutation.isPending || !price || !amount}
              className="w-full"
            >
              Create Order {createOrderMutation.isPending && '...'}
            </Button>
          </div>

          {/* Deposit Balance Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Deposit Balance</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="depositBaseAmount">Base Amount</Label>
                <Input 
                  id="depositBaseAmount" 
                  placeholder="Enter base amount" 
                  value={depositBaseAmount}
                  onChange={(e) => setDepositBaseAmount(e.target.value)}
                  type="number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="depositQuoteAmount">Quote Amount</Label>
                <Input 
                  id="depositQuoteAmount" 
                  placeholder="Enter quote amount" 
                  value={depositQuoteAmount}
                  onChange={(e) => setDepositQuoteAmount(e.target.value)}
                  type="number"
                />
              </div>
            </div>
            <Button 
              onClick={handleDepositBalance} 
              disabled={depositBalanceMutation.isPending || (!depositBaseAmount && !depositQuoteAmount)}
              className="w-full"
            >
              Deposit {depositBalanceMutation.isPending && '...'}
            </Button>
          </div>

          {/* Withdraw Funds Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Withdraw Funds</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="withdrawBaseAmount">Base Amount</Label>
                <Input 
                  id="withdrawBaseAmount" 
                  placeholder="Enter base amount" 
                  value={withdrawBaseAmount}
                  onChange={(e) => setWithdrawBaseAmount(e.target.value)}
                  type="number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="withdrawQuoteAmount">Quote Amount</Label>
                <Input 
                  id="withdrawQuoteAmount" 
                  placeholder="Enter quote amount" 
                  value={withdrawQuoteAmount}
                  onChange={(e) => setWithdrawQuoteAmount(e.target.value)}
                  type="number"
                />
              </div>
            </div>
            <Button 
              onClick={handleWithdrawFunds} 
              disabled={withdrawFundsMutation.isPending || (!withdrawBaseAmount && !withdrawQuoteAmount)}
              className="w-full"
            >
              Withdraw {withdrawFundsMutation.isPending && '...'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 