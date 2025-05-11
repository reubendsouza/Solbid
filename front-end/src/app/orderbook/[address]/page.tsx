'use client'

import { useParams } from 'next/navigation'
import { PublicKey } from '@solana/web3.js'
import { ClobOrderbookDetail } from '@/components/clob/clob-ui'
import { AppHero } from '@/components/app-hero'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { ExplorerLink } from '@/components/cluster/cluster-ui'
import { ellipsify } from '@/lib/utils'

export default function OrderbookPage() {
  const { address } = useParams()
  const router = useRouter()
  
  if (!address || typeof address !== 'string') {
    return <div>Invalid orderbook address</div>
  }

  return (
    <div>
      <AppHero
        title="Orderbook Details"
        subtitle="Manage orders, deposits, and withdrawals"
      >
        <p className="mb-6">
          Address: <ExplorerLink path={`account/${address}`} label={ellipsify(address)} />
        </p>
        <div className="flex gap-4 mb-6">
          <Button onClick={() => router.push('/orderbooks')}>Back to All Orderbooks</Button>
        </div>
      </AppHero>
      <ClobOrderbookDetail orderBookAddress={new PublicKey(address)} />
    </div>
  )
} 