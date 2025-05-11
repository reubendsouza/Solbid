'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { WalletButton } from '../solana/solana-provider'
import { ExplorerLink } from '../cluster/cluster-ui'
import { useClobProgram } from './clob-data-access'
import { ClobInitialize, ClobOrderbookList } from './clob-ui'
import { AppHero } from '../app-hero'
import { ellipsify } from '@/lib/utils'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '../ui/button'

export default function ClobFeature() {
  const { publicKey } = useWallet()
  const { programId } = useClobProgram()
  const router = useRouter()
  const pathname = usePathname()

  if (!publicKey) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="hero py-[64px]">
          <div className="hero-content text-center">
            <WalletButton />
          </div>
        </div>
      </div>
    )
  }

  // Determine which page to show based on the pathname
  if (pathname === '/create-orderbook') {
    return (
      <div>
        <AppHero
          title="Create Orderbook"
          subtitle="Create a new orderbook by providing base and quote token mints"
        >
          <p className="mb-6">
            <ExplorerLink path={`account/${programId}`} label={ellipsify(programId.toString())} />
          </p>
          <div className="flex gap-4 mb-6">
            <Button onClick={() => router.push('/orderbooks')}>View All Orderbooks</Button>
          </div>
        </AppHero>
        <ClobInitialize />
      </div>
    )
  }

  if (pathname === '/orderbooks') {
    return (
      <div>
        <AppHero
          title="All Orderbooks"
          subtitle="View and manage all available orderbooks"
        >
          <p className="mb-6">
            <ExplorerLink path={`account/${programId}`} label={ellipsify(programId.toString())} />
          </p>
          <div className="flex gap-4 mb-6">
            <Button onClick={() => router.push('/create-orderbook')}>Create New Orderbook</Button>
          </div>
        </AppHero>
        <ClobOrderbookList />
      </div>
    )
  }

  // Default landing page
  return (
    <div>
      <AppHero
        title="Central Limit Order Book (CLOB)"
        subtitle="Create and manage orderbooks for trading tokens"
      >
        <p className="mb-6">
          <ExplorerLink path={`account/${programId}`} label={ellipsify(programId.toString())} />
        </p>
        <div className="flex gap-4">
          <Button onClick={() => router.push('/create-orderbook')}>Create New Orderbook</Button>
          <Button onClick={() => router.push('/orderbooks')} variant="outline">View All Orderbooks</Button>
        </div>
      </AppHero>
    </div>
  )
}
