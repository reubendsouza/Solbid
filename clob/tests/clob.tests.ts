import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Clob } from "../target/types/clob";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMint, TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import {
  GetCommitmentSignature,
} from "@magicblock-labs/ephemeral-rollups-sdk";

const SEED_ORDERBOOK = "orderbook"; // Use the correct seed for your orderbook PDA

describe("clob", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const providerEphemeralRollup = new anchor.AnchorProvider(
    new anchor.web3.Connection(
      process.env.PROVIDER_ENDPOINT || "https://devnet.magicblock.app/",
      {
        wsEndpoint: process.env.WS_ENDPOINT || "wss://devnet.magicblock.app/",
      }
    ),
    anchor.Wallet.local()
  );
  console.log("Base Layer Connection: ", provider.connection.rpcEndpoint);
  console.log("Ephemeral Rollup Connection: ", providerEphemeralRollup.connection.rpcEndpoint);
  console.log(`Current SOL Public Key: ${anchor.Wallet.local().publicKey}`);

  before(async function () {
    this.timeout(10000); // Increase timeout to 10 seconds
    console.log('Checking account balance...');
    try {
      const balance = await provider.connection.getBalance(anchor.Wallet.local().publicKey);
      console.log('Current balance is', balance / LAMPORTS_PER_SOL, ' SOL','\n');
    } catch (error) {
      console.error('Failed to get balance:', error);
      // Continue with tests even if balance check fails
    }
  });

  const program = anchor.workspace.Clob as Program<Clob>;

  // Example: Derive the orderbook PDA (update seeds as needed)
  let orderbookPda: anchor.web3.PublicKey;
  let baseTokenMint: anchor.web3.PublicKey;
  let quoteTokenMint: anchor.web3.PublicKey;
  let user: anchor.web3.Keypair;

  before(async () => {
    // Generate test accounts and mints as needed
    user = anchor.web3.Keypair.generate();

    // Generate keypairs for the mints
    const baseTokenMintKeypair = anchor.web3.Keypair.generate();
    const quoteTokenMintKeypair = anchor.web3.Keypair.generate();

    // Create the mints on-chain
    baseTokenMint = await createMint(
      provider.connection,
      provider.wallet.payer, // payer
      provider.wallet.publicKey, // mint authority
      null, // freeze authority (optional)
      9, // decimals
      baseTokenMintKeypair, // mint keypair

    );

    quoteTokenMint = await createMint(
      provider.connection,
      provider.wallet.payer,
      provider.wallet.publicKey,
      null,
      9,
      quoteTokenMintKeypair,

    );

    console.log("Base Token Mint: ", baseTokenMint.toString());
    console.log("Quote Token Mint: ", quoteTokenMint.toString()); 

    // Derive the orderbook PDA (update seeds as per your program)
    [orderbookPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(SEED_ORDERBOOK),
        baseTokenMint.toBuffer(),
        quoteTokenMint.toBuffer(),
      ],
      program.programId
    );
    console.log("Orderbook PDA: ", orderbookPda.toString());

    // Create or get the user's base token account
    const userBaseAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      baseTokenMint,
      user.publicKey
    );

    // Create or get the user's quote token account
    const userQuoteAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      quoteTokenMint,
      user.publicKey
    );

    // Mint tokens to user base account
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      baseTokenMint,
      userBaseAccount.address, // destination
      provider.wallet.payer, // authority
      1_000_000_000 // amount, adjust as needed
    );

    // Mint tokens to user quote account
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      quoteTokenMint,
      userQuoteAccount.address, // destination
      provider.wallet.payer, // authority
      1_000_000_000 // amount, adjust as needed
    );
  });

  it("Initialize orderbook", async () => {
    // Derive the base and quote vault ATAs for the orderbook PDA
    const baseVault = anchor.utils.token.associatedAddress({
      mint: baseTokenMint,
      owner: orderbookPda,
    });
    const quoteVault = anchor.utils.token.associatedAddress({
      mint: quoteTokenMint,
      owner: orderbookPda,
    });
    console.log("Base Vault: ", baseVault.toString());
    console.log("Quote Vault: ", quoteVault.toString());
    console.log("Payer: ", provider.wallet.publicKey.toString());
    console.log("associatedTokenProgram: ", anchor.utils.token.ASSOCIATED_PROGRAM_ID.toString());
    console.log("tokenProgram: ", TOKEN_PROGRAM_ID.toString());
    console.log("systemProgram: ", anchor.web3.SystemProgram.programId.toString());
    const tx = await program.methods
      .initializeOrderbook()
      .accounts({
        payer: provider.wallet.publicKey,
        baseTokenMint,
        quoteTokenMint,
        // @ts-ignore
        baseVault,
        // @ts-ignore
        quoteVault,
        // @ts-ignore
        orderBook: orderbookPda,
         // @ts-ignore
         associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        // @ts-ignore
        tokenProgram: TOKEN_PROGRAM_ID,
        // @ts-ignore
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc({skipPreflight: true});
    console.log("Initialize orderbook tx:", tx);
  });

  it("Deposit balance", async () => {
    const quoteAmount = new anchor.BN(1000);
    const baseAmount = new anchor.BN(500);

    const userBaseAccount = anchor.utils.token.associatedAddress({
      mint: baseTokenMint,
      owner: user.publicKey,
    });
    const userQuoteAccount = anchor.utils.token.associatedAddress({
      mint: quoteTokenMint,
      owner: user.publicKey,
    });
    const baseVault = anchor.utils.token.associatedAddress({
      mint: baseTokenMint,
      owner: orderbookPda,
    });
    const quoteVault = anchor.utils.token.associatedAddress({
      mint: quoteTokenMint,
      owner: orderbookPda,
    });

    console.log("--------------------------------");
    console.log("quoteAmount: ", quoteAmount.toString());
    console.log("baseAmount: ", baseAmount.toString());

    console.log("User: ", user.publicKey.toString());
    console.log("Base Token Mint: ", baseTokenMint.toString());
    console.log("Quote Token Mint: ", quoteTokenMint.toString());

    console.log("Orderbook PDA: ", orderbookPda.toString());
    console.log("User Base Account: ", userBaseAccount.toString());
    console.log("User Quote Account: ", userQuoteAccount.toString());
    console.log("Base Vault: ", baseVault.toString());
    console.log("Quote Vault: ", quoteVault.toString());  

    const tx = await program.methods
      .depositBalance(quoteAmount, baseAmount)
      .accounts({
        user: user.publicKey,
        baseTokenMint,
        quoteTokenMint,
         // @ts-ignore
        orderBook: orderbookPda,
        // @ts-ignore
        userBaseAccount,
        // @ts-ignore
        userQuoteAccount,
        // @ts-ignore
        baseVault,
        // @ts-ignore
        quoteVault,
        // @ts-ignore
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();
    console.log("Deposit balance tx:", tx);
  });

  it("Create order on Solana", async () => {
    const start = Date.now();
    const side = 0; // 0 = buy, 1 = sell
    const price = new anchor.BN(10);
    const amount = new anchor.BN(100);
    
    console.log("--------------------------------");
    console.log("side: ", side);
    console.log("price: ", price.toString());
    console.log("amount: ", amount.toString());
    console.log("user: ", user.publicKey.toString());
    console.log("baseTokenMint: ", baseTokenMint.toString());
    console.log("quoteTokenMint: ", quoteTokenMint.toString());
    console.log("orderbookPda: ", orderbookPda.toString());
    console.log("--------------------------------");
    const txHash = await program.methods
      .createOrder(side, price, amount)
      .accounts({
        user: user.publicKey,
        baseTokenMint,
        quoteTokenMint,
        // @ts-ignore
        orderBook: orderbookPda,
        // @ts-ignore
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();
    const duration = Date.now() - start;
    console.log(`${duration}ms (Base Layer) Create Order txHash: ${txHash}`);
  });
  
  it("Delegate orderbook to ER", async () => {
    const start = Date.now();
    let tx = await program.methods
      .delegate()
      .accounts({
        user: provider.wallet.publicKey,
        baseTokenMint: baseTokenMint,
        quoteTokenMint: quoteTokenMint,
        // @ts-ignore
        orderBook: orderbookPda,
      })
      .transaction();
    tx.feePayer = provider.wallet.publicKey;
    tx.recentBlockhash = (
      await provider.connection.getLatestBlockhash()
    ).blockhash;
    tx = await providerEphemeralRollup.wallet.signTransaction(tx);
    const txHash = await provider.sendAndConfirm(tx, [], {
      skipPreflight: true,
      commitment: "confirmed",
    });
    const duration = Date.now() - start;
    console.log(`${duration}ms (Base Layer) Delegate txHash: ${txHash}`);
  });
  
  it("Create order on ER", async () => {
    const start = Date.now();
    const side = 1; // 0 = buy, 1 = sell
    const price = new anchor.BN(12);
    const amount = new anchor.BN(50);
  
    console.log("--------------------------------");
    console.log("Create order on ER");
    console.log("side: ", side);
    console.log("price: ", price.toString());
    console.log("amount: ", amount.toString());
    console.log("user: ", user.publicKey.toString());
    console.log("baseTokenMint: ", baseTokenMint.toString());
    console.log("quoteTokenMint: ", quoteTokenMint.toString());
    console.log("--------------------------------");
    let tx = await program.methods
      .createOrder(side, price, amount)
      .accounts({
        // Fill in required accounts for create_order
        // e.g. user, baseTokenMint, quoteTokenMint, orderbook, systemProgram, etc.
        user: user.publicKey,
        baseTokenMint,
        quoteTokenMint,
        // @ts-ignore
        orderBook: orderbookPda,
        // @ts-ignore
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .transaction();
    tx.feePayer = providerEphemeralRollup.wallet.publicKey;
    tx.recentBlockhash = (
      await providerEphemeralRollup.connection.getLatestBlockhash()
    ).blockhash;
    // tx.partialSign(user);
    tx = await providerEphemeralRollup.wallet.signTransaction(tx);
    const txHash = await providerEphemeralRollup.sendAndConfirm(tx,  [user], {
      skipPreflight: true,
      commitment: "confirmed",
    });
    const duration = Date.now() - start;
    console.log(`${duration}ms (ER) Create Order txHash: ${txHash}`);
  });

  it("Match order", async () => {
    const orderId = new anchor.BN(0); // Use a valid order ID

    const tx = await program.methods
      .matchOrder(orderId)
      .accounts({
        // Fill in the required accounts for match_order
        // e.g. user, orderbook, etc.
      })
      .signers([user])
      .rpc();
    console.log("Match order tx:", tx);
  });

  it("Withdraw funds", async () => {
    const baseAmount = new anchor.BN(50);
    const quoteAmount = new anchor.BN(20);

    const tx = await program.methods
      .withdrawFunds(baseAmount, quoteAmount)
      .accounts({
        // Fill in the required accounts for withdraw_funds
        // e.g. user, orderbook, etc.
      })
      .signers([user])
      .rpc();
    console.log("Withdraw funds tx:", tx);
  });

  it("Undelegate orderbook from ER", async () => {
    const tx = await program.methods
      .undelegate()
      .accounts({
        // Fill in the required accounts for undelegate
        // e.g. user, orderbook, etc.
      })
      .signers([user])
      .rpc();
    console.log("Undelegate tx:", tx);
  });
});
