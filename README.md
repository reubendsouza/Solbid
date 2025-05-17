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

## Getting Started

To run Solbid and interact with the on-chain order book, follow these steps:

### 1. Deposit Balance

Before trading, users must deposit tokens into their account.

- Use the connected Solana wallet to deposit funds.
- This is required before placing any orders.

### 2. Delegate to the Orderbook

After depositing:

- Delegate the orderbook to the ephemeral rollups.
- This step registers your account to participate in order placement and trading on the ephemeral rollups.

### 3. Connect to the Magicblock Devnet

To create orders, you need to connect to the Magicblock Devnet.

- Use the RPC endpoint: `https://devnet.magicblock.app`
- Make sure to select the `magicblock-devnet` cluster in your configuration or application settings.

## Run the Project and the tests locally
To run the project locally, you can follow these steps:

### Smart-contract
#### 1. Change the directory to clob
```bash
cd clob
```
#### 2. Install the Local Validator

Ensure you have the ephemeral validator installed globally:

```bash
npm install -g @magicblock-labs/ephemeral-validator
```

#### 3. Start the Local Validator

Run the local validator with the appropriate environment variables:

```bash
ACCOUNTS_REMOTE=https://rpc.magicblock.app/devnet ACCOUNTS_LIFECYCLE=ephemeral ephemeral-validator
```

`ACCOUNTS_REMOTE` point to the reference RPC endpoint, and `ACCOUNTS_LIFECYCLE` should be set to `ephemeral`.

#### 4. Run the Tests with the Local Validator

Execute the tests while pointing to the local validator:

```bash
PROVIDER_ENDPOINT=http://localhost:8899 WS_ENDPOINT=ws://localhost:8900 anchor test --skip-build --skip-deploy --skip-local-validator
```

This setup ensures tests run efficiently on a local ephemeral rollup while connecting to the devnet.

### Front-end
#### 1. Change the directory to front-end
```bash
cd front-end
```
#### 2. Install the dependencies
```bash
npm install
```

#### 3. Run the project
```bash
npm run dev
```


## Current Hackathon Implementation

This hackathon version demonstrates the core functionality with the following parameters:
- Support for up to 20 concurrent users and 20 open orders per orderbook
- Focus on limit orders (market orders planned for future development)

These constraints allow for a functional proof of concept while maintaining performance during the hackathon. Future versions will scale these limitations.

