// Here we export some useful types and functions for interacting with the Anchor program.
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { Cluster, PublicKey } from '@solana/web3.js'
import ClobIDL from './target/idl/clob.json'
import type { Clob } from './target/types/clob'

// Re-export the generated IDL and type
export { Clob, ClobIDL }

// The programId is imported from the program IDL.
export const CLOB_PROGRAM_ID = new PublicKey(ClobIDL.address)

// This is a helper function to get the Counter Anchor program.
export function getClobProgram(provider: AnchorProvider, address?: PublicKey): Program<Clob> {
  return new Program({ ...ClobIDL, address: address ? address.toBase58() : ClobIDL.address } as Clob, provider)
}

// This is a helper function to get the program ID for the Counter program depending on the cluster.
export function getClobProgramId(cluster: Cluster) {
  switch (cluster) {
    case 'devnet':
    case 'testnet':
    case 'mainnet-beta':
    default:
      return CLOB_PROGRAM_ID
  }
}
