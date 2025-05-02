import { before, describe, test, it } from "node:test";
import assert from "node:assert";
import * as programClient from "../dist/js-client";
import { connect, Connection, SOL, TOKEN_EXTENSIONS_PROGRAM } from "solana-kite";

// For debugging. You could delete these, but then someone else will have to recreate them and then they'll be annoyed with you.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const log = console.log;
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

  // describe("initializeOrderbook", () => {
  //   test("successfully initializes an orderbook", async () => {
  //     const { orderbook, baseVault, quoteVault, signature } = await initializeOrderbook({
  //       connection,
  //       user,
  //       tokenMintA,
  //       tokenMintB,
  //     });

  //     assert(signature);
  //     assert(orderbook);
  //     assert(baseVault);
  //     assert(quoteVault);
  //   });
  // });

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

  // Keep the existing Escrow tests if needed or remove them if they're no longer relevant
});
