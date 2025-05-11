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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'

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

// Helper to format numbers
const formatNum = (n: number | string, decimals = 2) => {
  const num = Number(n)
  if (isNaN(num)) return ''
  return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function OrderbookTable({ orderbook }: { orderbook: any }) {
  // Extract and sort orders
  const bids = [...(orderbook?.buys || [])].sort((a, b) => Number(b.price) - Number(a.price))
  const asks = [...(orderbook?.sells || [])].sort((a, b) => Number(a.price) - Number(b.price))
  const maxRows = Math.max(bids.length, asks.length)

  // Find mid price
  const bestBid = bids[0]?.price
  const bestAsk = asks[0]?.price
  const mid = bestBid && bestAsk ? (Number(bestBid) + Number(bestAsk)) / 2 : null

  return (
    <div className="bg-black rounded-lg p-4 w-full">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400">
            <th>Amount</th>
            <th>Bid</th>
            <th>Ask</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: maxRows }).map((_, i) => {
            const bid = bids[i]
            const ask = asks[i]
            const isMid = mid && bid?.price === bestBid && ask?.price === bestAsk
            return (
              <tr key={i} className={isMid ? 'font-bold text-yellow-300' : ''}>
                <td className="text-green-400">{bid ? formatNum(bid.remainingAmount) : ''}</td>
                <td className="text-green-400">{bid ? formatNum(bid.price) : ''}</td>
                <td className="text-red-400">{ask ? formatNum(ask.price) : ''}</td>
                <td className="text-red-400">{ask ? formatNum(ask.remainingAmount) : ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

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
  const { orderbookQuery, createOrderMutation, depositBalanceMutation, withdrawFundsMutation, matchOrderMutation } = useClobOrderbook({
    orderBookAddress: new PublicKey(orderBookAddress),
  })
  const [side, setSide] = useState<number>(0) // 0 for buy, 1 for sell
  const [price, setPrice] = useState<string>('')
  const [amount, setAmount] = useState<string>('')
  const [depositBaseAmount, setDepositBaseAmount] = useState<string>('')
  const [depositQuoteAmount, setDepositQuoteAmount] = useState<string>('')
  const [withdrawBaseAmount, setWithdrawBaseAmount] = useState<string>('')
  const [withdrawQuoteAmount, setWithdrawQuoteAmount] = useState<string>('')
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [modalTab, setModalTab] = useState<'deposit' | 'withdraw'>('deposit')
  const provider = useAnchorProvider()

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

    // After order is created, try to find the new order and match it
    // Wait for orderbookQuery to refetch (it is refetched on createOrderMutation success)
    setTimeout(() => {
      const orders = side === 0 ? orderbookQuery.data?.buys : orderbookQuery.data?.sells
      if (!orders) return
      // Find the latest order by the current user
      const myOrders = orders.filter((o: any) => o.owner === provider.publicKey?.toString())
      if (myOrders.length === 0) return
      // Assume the latest order is the one just created
      const latestOrder = myOrders.reduce((a: any, b: any) => (a.timestamp > b.timestamp ? a : b))
      if (latestOrder && latestOrder.id) {
        matchOrderMutation.mutateAsync({
          orderId: latestOrder.id,
          baseTokenMint,
          quoteTokenMint,
        })
      }
    }, 1000) // Wait 1s for orderbookQuery to update (tweak as needed)
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
    <>
      <div className="w-full flex flex-col items-center mb-4">
        <div className="text-lg text-gray-300">
          Trading Pair:
          <span className="ml-2 font-bold text-white">
            {baseTokenMint ? ellipsify(baseTokenMint.toString()) : '...'} / {quoteTokenMint ? ellipsify(quoteTokenMint.toString()) : '...'}
          </span>
        </div>
      </div>
      <div className="flex gap-8">
        {/* Left: Orderbook Table */}
        <div className="flex-1">
          <OrderbookTable orderbook={orderbookQuery.data} />
        </div>

        {/* Right: Order Form */}
        <div className="w-[350px] bg-[#18181b] rounded-lg p-6 flex flex-col gap-4">
          {/* Limit/Market Toggle */}
          <div className="flex gap-2 mb-2">
            <Button variant="secondary" className="flex-1">Limit</Button>
            <Button variant="ghost" className="flex-1 cursor-not-allowed opacity-70" disabled>
              Market
              <span className="ml-1 text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full">Soon</span>
            </Button>
          </div>
          {/* Buy/Sell Toggle */}
          <div className="flex gap-2 mb-2">
            <Button 
              className={`flex-1 ${side === 0 ? 'bg-green-500 text-white' : ''}`}
              onClick={() => setSide(0)}
            >Buy</Button>
            <Button 
              className={`flex-1 border border-red-500 ${side === 1 ? 'bg-red-500 text-white' : ''}`}
              onClick={() => setSide(1)}
            >Sell</Button>
          </div>
          {/* Price Input */}
          <div>
            <Label>{side === 0 ? 'Buy Price' : 'Sell Price'} / Limit Price</Label>
            <Input 
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="0.00"
              type="number"
              className="mt-1"
            />
          </div>
          {/* Amount Input */}
          <div>
            <Label>Amount <span className="float-right"></span></Label>
            <Input 
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              type="number"
            />
          </div>
          {/* You Pay/Receive */}
          <div>
            <Label>{side === 0 ? 'You Pay' : 'You Receive'}</Label>
            <Input 
              value={amount ? (Number(amount) * Number(price) || 0) : ''}
              readOnly
              placeholder="0.00"
            />
          </div>
          {/* Buy/Sell Button */}
          <Button 
            onClick={handleCreateOrder}
            disabled={createOrderMutation.isPending || !price || !amount}
            className={`w-full ${side === 0 ? 'bg-green-500' : 'bg-red-500'}`}
          >
            {side === 0 ? 'Buy' : 'Sell'}
          </Button>
          {/* Deposit Funds Button */}
          <Button 
            variant="outline"
            className="w-full"
            onClick={() => { setShowDepositModal(true); setModalTab('deposit') }}
          >
            Deposit Funds
          </Button>
        </div>

        {/* Deposit/Withdraw Modal */}
        <Dialog open={showDepositModal} onOpenChange={setShowDepositModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                <div className="flex gap-4">
                  <button 
                    className={modalTab === 'deposit' ? 'font-bold' : ''}
                    onClick={() => setModalTab('deposit')}
                  >Deposit</button>
                  <button 
                    className={modalTab === 'withdraw' ? 'font-bold' : ''}
                    onClick={() => setModalTab('withdraw')}
                  >Withdraw</button>
                </div>
              </DialogTitle>
            </DialogHeader>
            {modalTab === 'deposit' ? (
              <div className="space-y-4">
                <Label>Base Amount</Label>
                <Input 
                  value={depositBaseAmount}
                  onChange={e => setDepositBaseAmount(e.target.value)}
                  type="number"
                />
                <Label>Quote Amount</Label>
                <Input 
                  value={depositQuoteAmount}
                  onChange={e => setDepositQuoteAmount(e.target.value)}
                  type="number"
                />
                <Button 
                  onClick={handleDepositBalance}
                  disabled={depositBalanceMutation.isPending || (!depositBaseAmount && !depositQuoteAmount)}
                  className="w-full"
                >Deposit</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Label>Base Amount</Label>
                <Input 
                  value={withdrawBaseAmount}
                  onChange={e => setWithdrawBaseAmount(e.target.value)}
                  type="number"
                />
                <Label>Quote Amount</Label>
                <Input 
                  value={withdrawQuoteAmount}
                  onChange={e => setWithdrawQuoteAmount(e.target.value)}
                  type="number"
                />
                <Button 
                  onClick={handleWithdrawFunds}
                  disabled={withdrawFundsMutation.isPending || (!withdrawBaseAmount && !withdrawQuoteAmount)}
                  className="w-full"
                >Withdraw</Button>
              </div>
            )}
            <DialogClose asChild>
              <Button variant="ghost" className="w-full mt-2">Close</Button>
            </DialogClose>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
} 