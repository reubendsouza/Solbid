# Solbid

## Overview

Solbid is a high-performance on-chain central limit order book (CLOB) built on Solana. It leverages ephemeral rollups to achieve unprecedented speed for on-chain trading.

## What is Solbid?

Solbid provides a fully on-chain trading experience with the speed and efficiency typically only found in centralized exchanges:

- Place limit orders for various trading pairs (market orders coming soon)
- View real-time order book depth and market activity
- Trade with minimal latency and low transaction costs
- Benefit from transparent, verifiable trade execution

## Ephemeral Rollups: The Speed Advantage

Traditional on-chain trading suffers from high latency and costs. Solbid overcomes these limitations by implementing ephemeral rollups:

- **How it works**: Orders are batched and processed off-chain in milliseconds, then settled on-chain during commits.
- **Speed improvement**: Trade execution time reduced from seconds to under 50ms
- **Cost efficiency**: Multiple trades consolidated into fewer on-chain transactions
- **Security maintained**: All operations remain verifiable and secure through the Solana blockchain

## Key Features

- Real-time order book updates and trade execution
- Support for multiple trading pairs
- Transparent fee structure
- User-friendly trading interface