import { before, describe, test, it } from "node:test";
import assert from "node:assert";
import * as programClient from "../dist/js-client";
import { connect, Connection, SOL, TOKEN_EXTENSIONS_PROGRAM } from "solana-kite";

// For debugging. You could delete these, but then someone else will have to recreate them and then they'll be annoyed with you.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const stringify = (object: any) => JSON.stringify(object, null, 2);

import { lamports, type KeyPairSigner, type Address } from "@solana/kit";

const FIVE_SOL = lamports(5n * SOL);

// System program errors
// Reference: https://github.com/solana-labs/solana/blob/master/sdk/program/src/system_instruction.rs#L59
enum SystemError {
  // Account already in use
  AlreadyInUse = 0,
}

// SPL Token program errors
// Reference: https://github.com/solana-program/token-2022/blob/main/program/src/error.rs#L11-L13
enum SplTokenError {
  InsufficientFunds = 1,
}

// Anchor framework errors (2000-2999 range)
// Reference: https://github.com/coral-xyz/anchor/blob/master/lang/src/error.rs#L72-L74
enum AnchorError {
  ConstraintHasOne = 2001,
  ConstraintSeeds = 2006,
  AccountAlreadyInitialized = 2001,
  AccountNotInitialized = 3012,
}

const getRandomBigInt = () => {
  return BigInt(Math.floor(Math.random() * 1_000_000_000_000_000_000));
};

// Add an enum for CLOB program errors
enum ErrorCode {
  InvalidOrderAmount = 6000,
  InvalidOrderPrice = 6001,
  CalculationFailure = 6002,
  InsufficientFunds = 6003,
  OrderNotFound = 6004,
  OrderbookFull = 6005,
  InvalidOrderSide = 6006,
  InsufficientBalance = 6010,
}

// Helper function to check for specific program errors
function assertProgramError(error: Error, expectedCode: SystemError | SplTokenError | AnchorError | ErrorCode) {
  // Check for both custom program error format and token program error format
  const isCustomProgramError = error.message.includes(`custom program error: #${expectedCode}`);
  const isTokenProgramError = expectedCode === SplTokenError.InsufficientFunds && 
                             error.message.includes("insufficient funds");
  
  assert(
    isCustomProgramError || isTokenProgramError,
    `Expected error code ${expectedCode} but got: ${error.message}`,
  );
}

async function initializeOrderbook(params: {
  connection: Connection;
  user: KeyPairSigner;
  tokenMintA: Address;
  tokenMintB: Address;
}) {
  const {
    connection,
    user,
    tokenMintA,
    tokenMintB,
  } = params;

  // Get the orderbook PDA
  const orderbookPDAAndBump = await connection.getPDAAndBump(
    programClient.CLOB_PROGRAM_ADDRESS, 
    ["orderbook", tokenMintA, tokenMintB]
  );
  const orderbook = orderbookPDAAndBump.pda;
  
  // Get the vault addresses
  const baseVault = await connection.getTokenAccountAddress(orderbook, tokenMintA, true);
  const quoteVault = await connection.getTokenAccountAddress(orderbook, tokenMintB, true);

  const initializeOrderbookInstruction = await programClient.getInitializeOrderbookInstructionAsync({
    payer: user,
    baseTokenMint: tokenMintA,
    quoteTokenMint: tokenMintB,
    baseVault,
    quoteVault,
    orderBook: orderbook,
    tokenProgram: TOKEN_EXTENSIONS_PROGRAM,
  });

  const signature = await connection.sendTransactionFromInstructions({
    feePayer: user,
    instructions: [initializeOrderbookInstruction],
  });

  return { orderbook, baseVault, quoteVault, signature };
}

describe("CLOB", () => {
  let connection: Connection;
  let user: KeyPairSigner;
  let alice: KeyPairSigner;
  let bob: KeyPairSigner;
  let tokenMintA: Address; // Base token
  let tokenMintB: Address; // Quote token
  let aliceTokenAccountA: Address;
  let bobTokenAccountA: Address;
  let aliceTokenAccountB: Address;
  let bobTokenAccountB: Address;
  let orderbook: Address;
  let baseVault: Address;
  let quoteVault: Address;

  const tokenDecimals = 9;

  // Both tokens have 9 decimals, so we can use this to convert between major and minor units
  const TOKEN = 10n ** BigInt(tokenDecimals);

  // Alice is going to make a few offers in these tests, so we give her 10 tokens
  const aliceInitialTokenAAmount = 10n * TOKEN;
  const aliceInitialTokenBAmount = 10n * TOKEN;
  // Bob has tokens of both A and B
  const bobInitialTokenAAmount = 10n * TOKEN;
  const bobInitialTokenBAmount = 10n * TOKEN;

  before(async () => {
    connection = await connect();

    // 'user' will be the account we use to create the token mints
    [user, alice, bob] = await connection.createWallets(3, { airdropAmount:  FIVE_SOL });

    // Create two token mints - the factories that create token A, and token B
    tokenMintA = await connection.createTokenMint({
      mintAuthority: user,
      decimals: tokenDecimals,
      name: "Token A",
      symbol: "TOKEN_A",
      uri: "https://example.com/token-a",
      additionalMetadata: {
        keyOne: "valueOne",
        keyTwo: "valueTwo",
      },
    });

    tokenMintB = await connection.createTokenMint({
      mintAuthority: user,
      decimals: tokenDecimals,
      name: "Token B",
      symbol: "TOKEN_B",
      uri: "https://example.com/token-b",
      additionalMetadata: {
        keyOne: "valueOne",
        keyTwo: "valueTwo",
      },
    });

    // Mint tokens to alice and bob
    await connection.mintTokens(tokenMintA, user, aliceInitialTokenAAmount, alice.address);
    await connection.mintTokens(tokenMintA, user, bobInitialTokenAAmount, bob.address);
    await connection.mintTokens(tokenMintB, user, aliceInitialTokenBAmount, alice.address);
    await connection.mintTokens(tokenMintB, user, bobInitialTokenBAmount, bob.address);

    // Get the token accounts for alice and bob
    aliceTokenAccountA = await connection.getTokenAccountAddress(alice.address, tokenMintA, true);
    bobTokenAccountA = await connection.getTokenAccountAddress(bob.address, tokenMintA, true);
    aliceTokenAccountB = await connection.getTokenAccountAddress(alice.address, tokenMintB, true);
    bobTokenAccountB = await connection.getTokenAccountAddress(bob.address, tokenMintB, true);
  
  });

  describe("initializeOrderbook", () => {
    test("successfully initializes an orderbook", async () => {
      const { orderbook, baseVault, quoteVault, signature } = await initializeOrderbook({
        connection,
        user,
        tokenMintA,
        tokenMintB,
      });

      assert(signature);
      assert(orderbook);
      assert(baseVault);
      assert(quoteVault);
    });
  });

  describe("createOrder", () => {
    let orderbook: Address;
    let baseVault: Address;
    let quoteVault: Address;

    before(async () => {
      const result = await initializeOrderbook({
        connection,
        user,
        tokenMintA,
        tokenMintB,
      });

      orderbook = result.orderbook;
      baseVault = result.baseVault;
      quoteVault = result.quoteVault;
    });

    test("successfully creates a buy order", async () => {
      const price = 1n;
      const quantity = 2n * TOKEN;
      // Side 0 = Buy
      const createOrderInstruction = await programClient.getCreateOrderInstructionAsync({
        user: alice,
        baseTokenMint: tokenMintA,
        quoteTokenMint: tokenMintB,
        orderBook: orderbook,
        userBaseAccount: aliceTokenAccountA,
        userQuoteAccount: aliceTokenAccountB,
        baseVault,
        quoteVault,
        side: 0,
        price: price,
        amount: quantity,
        tokenProgram: TOKEN_EXTENSIONS_PROGRAM,
      });
      const signature = await connection.sendTransactionFromInstructions({
        feePayer: alice,
        instructions: [createOrderInstruction],
      });
      // Verify tokens were transferred to the vault
      const quoteVaultBalance = await connection.getTokenAccountBalance({
        tokenAccount: quoteVault,
        mint: tokenMintB,
        useTokenExtensions: true,
      });
      // For a buy order, price * quantity tokens should be in the quote vault
      const expectedAmount = price * quantity;
      assert.equal(quoteVaultBalance.amount.toString(), expectedAmount.toString());
    });

    test("successfully creates a sell order", async () => {
      const price = 1n * TOKEN;
      const quantity = 2n * TOKEN;
      
      // Side 1 = Sell
      const createOrderInstruction = await programClient.getCreateOrderInstructionAsync({
        user: bob,
        baseTokenMint: tokenMintA,
        quoteTokenMint: tokenMintB,
        orderBook: orderbook,
        userBaseAccount: bobTokenAccountA,
        userQuoteAccount: bobTokenAccountB,
        baseVault,
        quoteVault,
        side: 1,
        price,
        amount: quantity,
        tokenProgram: TOKEN_EXTENSIONS_PROGRAM,
      });

      const signature = await connection.sendTransactionFromInstructions({
        feePayer: bob,
        instructions: [createOrderInstruction],
      });

      // Verify tokens were transferred to the vault
      const baseVaultBalance = await connection.getTokenAccountBalance({
        tokenAccount: baseVault,
        mint: tokenMintA,
        useTokenExtensions: true,
      });
      
      // For a sell order, quantity tokens should be in the base vault
      const vaultAmount = typeof baseVaultBalance.amount === 'string' 
        ? BigInt(baseVaultBalance.amount) 
        : BigInt(baseVaultBalance.amount.toString());
      assert(vaultAmount >= quantity);
    });

    test("fails when creating an order with zero price", async () => {
      const price = 0n;
      const quantity = 1n * TOKEN;
      
      try {
        const createOrderInstruction = await programClient.getCreateOrderInstructionAsync({
          user: alice,
          baseTokenMint: tokenMintA,
          quoteTokenMint: tokenMintB,
          orderBook: orderbook,
          userBaseAccount: aliceTokenAccountA,
          userQuoteAccount: aliceTokenAccountB,
          baseVault,
          quoteVault,
          side: 0,
          price,
          amount: quantity,
          tokenProgram: TOKEN_EXTENSIONS_PROGRAM,
        });

        await connection.sendTransactionFromInstructions({
          feePayer: alice,
          instructions: [createOrderInstruction],
        });
        assert.fail("Expected the order creation to fail but it succeeded");
      } catch (thrownObject) {
        const error = thrownObject as Error;
        assertProgramError(error, ErrorCode.InvalidOrderPrice);
      }
    });

    test("fails when creating an order with zero quantity", async () => {
      const price = 1n * TOKEN;
      const quantity = 0n;
      
      try {
        const createOrderInstruction = await programClient.getCreateOrderInstructionAsync({
          user: alice,
          baseTokenMint: tokenMintA,
          quoteTokenMint: tokenMintB,
          orderBook: orderbook,
          userBaseAccount: aliceTokenAccountA,
          userQuoteAccount: aliceTokenAccountB,
          baseVault,
          quoteVault,
          side: 0,
          price,
          amount: quantity,
          tokenProgram: TOKEN_EXTENSIONS_PROGRAM,
        });

        await connection.sendTransactionFromInstructions({
          feePayer: alice,
          instructions: [createOrderInstruction],
        });
        assert.fail("Expected the order creation to fail but it succeeded");
      } catch (thrownObject) {
        const error = thrownObject as Error;
        assertProgramError(error, ErrorCode.InvalidOrderAmount);
      }
    });

    test("fails when creating an order with insufficient funds", async () => {
      const price = 1000n;
      const quantity = 1000n * TOKEN;
      
      try {
        const createOrderInstruction = await programClient.getCreateOrderInstructionAsync({
          user: alice,
          baseTokenMint: tokenMintA,
          quoteTokenMint: tokenMintB,
          orderBook: orderbook,
          userBaseAccount: aliceTokenAccountA,
          userQuoteAccount: aliceTokenAccountB,
          baseVault,
          quoteVault,
          side: 0,
          price,
          amount: quantity,
          tokenProgram: TOKEN_EXTENSIONS_PROGRAM,
        });

        await connection.sendTransactionFromInstructions({
          feePayer: alice,
          instructions: [createOrderInstruction],
        });
        assert.fail("Expected the order creation to fail but it succeeded");
      } catch (thrownObject) {
        const error = thrownObject as Error;
        assertProgramError(error, SplTokenError.InsufficientFunds);
      }
    });
  });

  describe("matchOrder", () => {
    let orderbook: Address;
    let baseVault: Address;
    let quoteVault: Address;
    let buyOrderId: bigint;
    let sellOrderId: bigint;

    before(async () => {
      const result = await initializeOrderbook({
        connection,
        user,
        tokenMintA,
        tokenMintB,
      });

      orderbook = result.orderbook;
      baseVault = result.baseVault;
      quoteVault = result.quoteVault;

      // Create a buy order from Alice
      const buyPrice = 2n;
      const buyQuantity = 3n * TOKEN;
      
      const createBuyOrderInstruction = await programClient.getCreateOrderInstructionAsync({
        user: alice,
        baseTokenMint: tokenMintA,
        quoteTokenMint: tokenMintB,
        orderBook: orderbook,
        userBaseAccount: aliceTokenAccountA,
        userQuoteAccount: aliceTokenAccountB,
        baseVault,
        quoteVault,
        side: 0, // Buy
        price: buyPrice,
        amount: buyQuantity,
        tokenProgram: TOKEN_EXTENSIONS_PROGRAM,
      });

      const createBuyOrderSignature = await connection.sendTransactionFromInstructions({
        feePayer: alice,
        instructions: [createBuyOrderInstruction],
      });

      const createBuyOrderLogs = await connection.getLogs(createBuyOrderSignature);
      console.log("createBuyOrderLogs: ", createBuyOrderLogs);

      // Create a sell order from Bob
      const sellPrice = 1n;
      const sellQuantity = 2n * TOKEN;
      
      const createSellOrderInstruction = await programClient.getCreateOrderInstructionAsync({
        user: bob,
        baseTokenMint: tokenMintA,
        quoteTokenMint: tokenMintB,
        orderBook: orderbook,
        userBaseAccount: bobTokenAccountA,
        userQuoteAccount: bobTokenAccountB,
        baseVault,
        quoteVault,
        side: 1, // Sell
        price: sellPrice,
        amount: sellQuantity,
        tokenProgram: TOKEN_EXTENSIONS_PROGRAM,
      });
      const createSellOrderSignature = await connection.sendTransactionFromInstructions({
        feePayer: bob,
        instructions: [createSellOrderInstruction],
      });
      const createSellOrderLogs = await connection.getLogs(createSellOrderSignature);
      console.log("createSellOrderLogs: ", createSellOrderLogs);

      // Get the order IDs (assuming they are 0 and 1 since these are the first orders)
      buyOrderId = 0n;
      sellOrderId = 1n;
    });

    test("successfully matches a buy order", async () => {
      // Get initial balances
      const aliceBaseBalanceBefore = await connection.getTokenAccountBalance({
        tokenAccount: aliceTokenAccountA,
        mint: tokenMintA,
        useTokenExtensions: true,
      });
      console.log("aliceBaseBalanceBefore: ", aliceBaseBalanceBefore.amount.toString());

      const aliceQuoteBalanceBefore = await connection.getTokenAccountBalance({
        tokenAccount: aliceTokenAccountB,
        mint: tokenMintB,
        useTokenExtensions: true,
      });
      console.log("aliceQuoteBalanceBefore: ", aliceQuoteBalanceBefore.amount.toString());

      // Match Alice's buy order
      const matchOrderInstruction = await programClient.getMatchOrderInstructionAsync({
        user: alice,
        baseTokenMint: tokenMintA,
        quoteTokenMint: tokenMintB,
        orderBook: orderbook,
        userBaseAccount: aliceTokenAccountA,
        userQuoteAccount: aliceTokenAccountB,
        baseVault,
        quoteVault,
        orderId: buyOrderId,
        tokenProgram: TOKEN_EXTENSIONS_PROGRAM,
      });

      const matchOrderSignature = await connection.sendTransactionFromInstructions({
        feePayer: alice,
        instructions: [matchOrderInstruction],
      });

      const matchOrderLogs = await connection.getLogs(matchOrderSignature);
      console.log("matchOrderLogs: ", matchOrderLogs);

      // Check Alice's base token balance increased
      const aliceBaseBalanceAfter = await connection.getTokenAccountBalance({
        tokenAccount: aliceTokenAccountA,
        mint: tokenMintA,
        useTokenExtensions: true,
      });

      console.log("aliceBaseBalanceAfter: ", aliceBaseBalanceAfter.amount.toString());

      const aliceQuoteBalanceAfter = await connection.getTokenAccountBalance({
        tokenAccount: aliceTokenAccountB,
        mint: tokenMintB,
        useTokenExtensions: true,
      });
      console.log("aliceQuoteBalanceAfter: ", aliceQuoteBalanceAfter.amount.toString());

      // Alice should have received 2 TOKEN of base tokens (the sell quantity)
      const expectedIncrease = 2n * TOKEN;
      const actualIncrease = BigInt(aliceBaseBalanceAfter.amount.toString()) - 
                            BigInt(aliceBaseBalanceBefore.amount.toString());
      
      assert.equal(actualIncrease.toString(), expectedIncrease.toString(), 
        "Alice's base token balance should have increased by the matched amount");
    });

    test("successfully matches a sell order", async () => {
      // Get initial balances
      const bobQuoteBalanceBefore = await connection.getTokenAccountBalance({
        tokenAccount: bobTokenAccountB,
        mint: tokenMintB,
        useTokenExtensions: true,
      });

      console.log("bobQuoteBalanceBefore: ", bobQuoteBalanceBefore.amount.toString());

      // Match Bob's sell order
      const matchOrderInstruction = await programClient.getMatchOrderInstructionAsync({
        user: bob,
        baseTokenMint: tokenMintA,
        quoteTokenMint: tokenMintB,
        orderBook: orderbook,
        userBaseAccount: bobTokenAccountA,
        userQuoteAccount: bobTokenAccountB,
        baseVault,
        quoteVault,
        orderId: sellOrderId,
        tokenProgram: TOKEN_EXTENSIONS_PROGRAM,
      });

      console.log('here1')

      const matchOrderSignature = await connection.sendTransactionFromInstructions({
        feePayer: bob,
        instructions: [matchOrderInstruction],
      });

      console.log('here2')

      const matchOrderLogs = await connection.getLogs(matchOrderSignature);
      console.log("matchOrderLogs: ", matchOrderLogs);

      // Check Bob's quote token balance increased
      const bobQuoteBalanceAfter = await connection.getTokenAccountBalance({
        tokenAccount: bobTokenAccountB,
        mint: tokenMintB,
        useTokenExtensions: true,
      });

      // Bob should have received 2 TOKEN * 2 TOKEN (quantity * price) of quote tokens
      const expectedIncrease = 2n * TOKEN * 2n;
      const actualIncrease = BigInt(bobQuoteBalanceAfter.amount.toString()) - 
                            BigInt(bobQuoteBalanceBefore.amount.toString());

      console.log("expectedIncrease: ", expectedIncrease.toString());
      console.log("actualIncrease: ", actualIncrease.toString());
      
      assert.equal(actualIncrease.toString(), expectedIncrease.toString(), 
        "Bob's quote token balance should have increased by the matched amount * price");
    });
  });

  describe("withdrawFunds", () => {
    let orderbook: Address;
    let baseVault: Address;
    let quoteVault: Address;

    before(async () => {
      const result = await initializeOrderbook({
        connection,
        user,
        tokenMintA,
        tokenMintB,
      });

      orderbook = result.orderbook;
      baseVault = result.baseVault;
      quoteVault = result.quoteVault;

      // Create and match orders to generate balances in the orderbook
      // Alice creates a buy order
      const buyPrice = 2n;
      const buyQuantity = 3n * TOKEN;
      
      const createBuyOrderInstruction = await programClient.getCreateOrderInstructionAsync({
        user: alice,
        baseTokenMint: tokenMintA,
        quoteTokenMint: tokenMintB,
        orderBook: orderbook,
        userBaseAccount: aliceTokenAccountA,
        userQuoteAccount: aliceTokenAccountB,
        baseVault,
        quoteVault,
        side: 0, // Buy
        price: buyPrice,
        amount: buyQuantity,
        tokenProgram: TOKEN_EXTENSIONS_PROGRAM,
      });

      await connection.sendTransactionFromInstructions({
        feePayer: alice,
        instructions: [createBuyOrderInstruction],
      });

      // Bob creates a sell order that will partially match Alice's
      const sellPrice = 2n;
      const sellQuantity = 1n * TOKEN;
      
      const createSellOrderInstruction = await programClient.getCreateOrderInstructionAsync({
        user: bob,
        baseTokenMint: tokenMintA,
        quoteTokenMint: tokenMintB,
        orderBook: orderbook,
        userBaseAccount: bobTokenAccountA,
        userQuoteAccount: bobTokenAccountB,
        baseVault,
        quoteVault,
        side: 1, // Sell
        price: sellPrice,
        amount: sellQuantity,
        tokenProgram: TOKEN_EXTENSIONS_PROGRAM,
      });

      await connection.sendTransactionFromInstructions({
        feePayer: bob,
        instructions: [createSellOrderInstruction],
      });

    });

    test("successfully withdraws base tokens", async () => {
    // Match Bob's sell order to generate a user balance for Alice
     const matchOrderInstruction = await programClient.getMatchOrderInstructionAsync({
      user: bob,
      baseTokenMint: tokenMintA,
      quoteTokenMint: tokenMintB,
      orderBook: orderbook,
      userBaseAccount: bobTokenAccountA,
      userQuoteAccount: bobTokenAccountB,
      baseVault,
      quoteVault,
      orderId: 1n, // Bob's order ID
      tokenProgram: TOKEN_EXTENSIONS_PROGRAM,
    });

    await connection.sendTransactionFromInstructions({
      feePayer: bob,
      instructions: [matchOrderInstruction],
    });
    
      const aliceBaseBalanceBefore = await connection.getTokenAccountBalance({
        tokenAccount: aliceTokenAccountA,
        mint: tokenMintA,
        useTokenExtensions: true,
      });

      // alice withdraws her base tokens
      const withdrawAmount = 1n * TOKEN; // The amount Bob should have from the matched order
      
      const withdrawFundsInstruction = await programClient.getWithdrawFundsInstructionAsync({
        user: alice,
        baseTokenMint: tokenMintA,
        quoteTokenMint: tokenMintB,
        orderBook: orderbook,
        userBaseAccount: aliceTokenAccountA,
        userQuoteAccount: aliceTokenAccountB,
        baseVault,
        quoteVault,
        baseAmount: withdrawAmount,
        quoteAmount: 0n,
        tokenProgram: TOKEN_EXTENSIONS_PROGRAM,
      });

      await connection.sendTransactionFromInstructions({
        feePayer: alice,
        instructions: [withdrawFundsInstruction],
      });

      const aliceBaseBalanceAfter = await connection.getTokenAccountBalance({
        tokenAccount: aliceTokenAccountA,
        mint: tokenMintA,
        useTokenExtensions: true,
      });
      
      const actualIncrease = BigInt(aliceBaseBalanceAfter.amount.toString()) - 
                            BigInt(aliceBaseBalanceBefore.amount.toString());
      
      assert.equal(actualIncrease.toString(), withdrawAmount.toString(), 
        "Alice's base token balance should have increased by the withdrawn amount");
    });

    test("successfully withdraws quote tokens", async () => {

      //match alice's buy order to generate a user balance for bob
      const matchOrderInstruction = await programClient.getMatchOrderInstructionAsync({
        user: alice,
        baseTokenMint: tokenMintA,
        quoteTokenMint: tokenMintB,
        orderBook: orderbook,
        userBaseAccount: aliceTokenAccountA,
        userQuoteAccount: aliceTokenAccountB,
        baseVault,
        quoteVault,
        orderId: 0n, // Alice's order ID
        tokenProgram: TOKEN_EXTENSIONS_PROGRAM,
      });

      const matchOrderSignature = await connection.sendTransactionFromInstructions({
        feePayer: alice,
        instructions: [matchOrderInstruction],
      });

      const matchOrderLogs = await connection.getLogs(matchOrderSignature);
      console.log("matchOrderLogs: ", matchOrderLogs);
      

      // Get Bob's initial quote token balance
      const bobQuoteBalanceBefore = await connection.getTokenAccountBalance({
        tokenAccount: bobTokenAccountB,
        mint: tokenMintB,
        useTokenExtensions: true,
      });
      console.log("bobQuoteBalanceBefore: ", bobQuoteBalanceBefore.amount.toString());

      // bob withdraws his quote tokens
      const withdrawAmount = 2n * TOKEN; // The amount Alice should have from the matched order
      
      const withdrawFundsInstruction = await programClient.getWithdrawFundsInstructionAsync({
        user: bob,
        baseTokenMint: tokenMintA,
        quoteTokenMint: tokenMintB,
        orderBook: orderbook,
        userBaseAccount: bobTokenAccountA,
        userQuoteAccount: bobTokenAccountB,
        baseVault,
        quoteVault,
        baseAmount: 0n,
        quoteAmount: withdrawAmount,
        tokenProgram: TOKEN_EXTENSIONS_PROGRAM,
      });

      await connection.sendTransactionFromInstructions({
        feePayer: bob,
        instructions: [withdrawFundsInstruction],
      });

      // Check Alice's base token balance increased
      const bobQuoteBalanceAfter = await connection.getTokenAccountBalance({
        tokenAccount: bobTokenAccountB,
        mint: tokenMintB,
        useTokenExtensions: true,
      });

      const actualIncrease = BigInt(bobQuoteBalanceAfter.amount.toString()) - 
                            BigInt(bobQuoteBalanceBefore.amount.toString());
      
      assert.equal(actualIncrease.toString(), withdrawAmount.toString(), 
        "Bob's quote token balance should have increased by the withdrawn amount");
    });

    test("fails when withdrawing more than available balance", async () => {

        //match alice's buy order to generate a user balance for bob
      const matchOrderInstruction = await programClient.getMatchOrderInstructionAsync({
        user: alice,
        baseTokenMint: tokenMintA,
        quoteTokenMint: tokenMintB,
        orderBook: orderbook,
        userBaseAccount: aliceTokenAccountA,
        userQuoteAccount: aliceTokenAccountB,
        baseVault,
        quoteVault,
        orderId: 0n, // Alice's order ID
        tokenProgram: TOKEN_EXTENSIONS_PROGRAM,
      });

      const matchOrderSignature = await connection.sendTransactionFromInstructions({
        feePayer: alice,
        instructions: [matchOrderInstruction],
      });

      const matchOrderLogs = await connection.getLogs(matchOrderSignature);
      console.log("matchOrderLogs: ", matchOrderLogs);
      // Try to withdraw more than Bob has
      const excessiveAmount = 1000n;
      
      try {
        const withdrawFundsInstruction = await programClient.getWithdrawFundsInstructionAsync({
          user: bob,
          baseTokenMint: tokenMintA,
          quoteTokenMint: tokenMintB,
          orderBook: orderbook,
          userBaseAccount: bobTokenAccountA,
          userQuoteAccount: bobTokenAccountB,
          baseVault,
          quoteVault,
          baseAmount: excessiveAmount,
          quoteAmount: 0n,
          tokenProgram: TOKEN_EXTENSIONS_PROGRAM,
        });

        await connection.sendTransactionFromInstructions({
          feePayer: bob,
          instructions: [withdrawFundsInstruction],
        });
        assert.fail("Expected the withdrawal to fail but it succeeded");
      } catch (thrownObject) {
        const error = thrownObject as Error;
        assertProgramError(error, ErrorCode.InsufficientBalance);
      }
    });
  });

});
