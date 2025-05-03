use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::state::{Orderbook, Side};
use crate::instructions::shared::transfer_tokens;
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct MatchOrder<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    pub base_token_mint: InterfaceAccount<'info, Mint>,
    pub quote_token_mint: InterfaceAccount<'info, Mint>,

    #[account(init_if_needed,
        payer = user,
        associated_token::mint = base_token_mint,
        associated_token::authority = user,
        associated_token::token_program = token_program,
        )]
    pub user_base_account: InterfaceAccount<'info, TokenAccount>,

    #[account(init_if_needed,
        payer = user,
        associated_token::mint = quote_token_mint,
        associated_token::authority = user,
        associated_token::token_program = token_program,
        )]
    pub user_quote_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut,
        seeds = [b"orderbook", base_token_mint.key().as_ref(), quote_token_mint.key().as_ref()],
        bump = order_book.bump
    )]
    pub order_book: Account<'info, Orderbook>,
    
    #[account(mut,
        associated_token::mint = base_token_mint,
        associated_token::authority = order_book,
        associated_token::token_program = token_program,
        )]
    pub base_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(mut,
        associated_token::mint = quote_token_mint,
        associated_token::authority = order_book,
        associated_token::token_program = token_program,
        )]
    pub quote_vault: InterfaceAccount<'info, TokenAccount>,
    
    
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub struct MatchingResult {
    pub filled_amount: u64,
    pub remaining_amount: u64,
}

pub fn handle_match_order(
    context: Context<MatchOrder>,
    order_id: u64,
) -> Result<()> {
    let order_book = &mut context.accounts.order_book;
    let user = &context.accounts.user;
    
    // Find the order by ID
    let mut order_index = None;
    let mut order_side = None;
    
    // Add debug logging to help identify the issue
    msg!("Searching for order ID: {}", order_id);
    msg!("Number of buys: {}", order_book.buys.len());
    msg!("Number of sells: {}", order_book.sells.len());
    
    // Search in buys
    for (i, bid) in order_book.buys.iter().enumerate() {
        msg!("Bid ID: {}", bid.id);
        if bid.id == order_id {
            if bid.owner != user.key() {
                return err!(ErrorCode::NotOrderOwner);
            }
            order_index = Some(i);
            order_side = Some(Side::Buy);
            break;
        }
    }
    
    // If not found in buys, search in sells
    if order_index.is_none() {
        for (i, ask) in order_book.sells.iter().enumerate() {
            msg!("Ask ID: {}", ask.id);
            if ask.id == order_id {
                if ask.owner != user.key() {
                    return err!(ErrorCode::NotOrderOwner);
                }
                order_index = Some(i);
                order_side = Some(Side::Sell);
                break;
            }
        }
    }
    
    // Return error if order not found
    let (order_index, order_side) = match (order_index, order_side) {
        (Some(idx), Some(side)) => (idx, side),
        _ => {
            msg!("Order not found with ID: {}", order_id);
            return err!(ErrorCode::OrderNotFound);
        }
    };
    
    // Get the order
    let mut order = match order_side {
        Side::Buy => order_book.buys.remove(order_index),
        Side::Sell => order_book.sells.remove(order_index),
    };

    // Before the match statement, get the account info and bump
    let order_book_info = order_book.to_account_info();
    let order_book_bump = order_book.bump;

    // Match the order - Inline implementation instead of separate function
    let mut filled_amount: u64 = 0;
    let mut remaining_amount: u64 = order.remaining_amount;

    // Prepare PDA signer seeds
    let base_mint_key = context.accounts.base_token_mint.key();
    let quote_mint_key = context.accounts.quote_token_mint.key();
    let account_seeds = [
        b"orderbook",
        base_mint_key.as_ref(),
        quote_mint_key.as_ref(),
        &[order_book_bump],
    ];
    let signers_seeds = Some(&account_seeds[..]);

    match order.side {
        Side::Buy => {
            // For buy orders, match against sells (sell orders)
            // Sort sells by price (lowest first)
            order_book.sells.sort_by(|a, b| a.price.cmp(&b.price));
            
            let mut i = 0;
            while i < order_book.sells.len() && remaining_amount > 0 {
                let ask = &mut order_book.sells[i];
                
                // Check if the buy price is >= the ask price
                if order.price >= ask.price {
                    // Calculate the matched amount
                    let match_amount = remaining_amount.min(ask.remaining_amount);
                    
                    if match_amount > 0 {

                        let ask_owner = ask.owner;

                        // Update the order amounts
                        ask.remaining_amount = ask.remaining_amount.checked_sub(match_amount)
                            .ok_or(ErrorCode::CalculationFailure)?;
                        remaining_amount = remaining_amount.checked_sub(match_amount)
                            .ok_or(ErrorCode::CalculationFailure)?;
                        filled_amount = filled_amount.checked_add(match_amount)
                            .ok_or(ErrorCode::CalculationFailure)?;
                        
                        // Transfer base tokens from vault to buyer
                        transfer_tokens(
                            &context.accounts.base_vault,
                            &context.accounts.user_base_account,
                            &match_amount,
                            &context.accounts.base_token_mint,
                            &order_book_info,
                            &context.accounts.token_program,
                            signers_seeds,
                        )?;
                        
                        // Calculate quote amount to transfer to seller
                        let quote_amount = match_amount.checked_mul(ask.price)
                            .ok_or(ErrorCode::CalculationFailure)?;
                            
                    
                         // Transfer quote tokens from buyer (taker) to vault
                        transfer_tokens(
                            &context.accounts.user_quote_account,
                            &context.accounts.quote_vault,
                            &quote_amount,
                            &context.accounts.quote_token_mint,
                            &context.accounts.user.to_account_info(),
                            &context.accounts.token_program,
                            None,
                        )?;

                        // Remove filled orders
                        if ask.remaining_amount == 0 {
                            order_book.sells.remove(i);
                            // Don't increment i since we removed an element
                            continue;
                        }

                        // Instead of direct transfer, update the seller's balance
                        order_book.add_balance(ask_owner, 0, quote_amount)?;
                    }
                } else {
                    // No more matching orders (price too high)
                    break;
                }
                
                i += 1;
            }
        },
        Side::Sell => {
            // For sell orders, match against buys (buy orders)
            // Sort buys by price (highest first)
            order_book.buys.sort_by(|a, b| b.price.cmp(&a.price));
            
            let mut i = 0;
            while i < order_book.buys.len() && remaining_amount > 0 {
                let bid = &mut order_book.buys[i];
                
                // Check if the sell price is <= the bid price
                if order.price <= bid.price {
                    // Calculate the matched amount
                    let match_amount = remaining_amount.min(bid.remaining_amount);
                    
                    if match_amount > 0 {
                        let bid_owner = bid.owner;
                        // Update the order amounts
                        bid.remaining_amount = bid.remaining_amount.checked_sub(match_amount)
                            .ok_or(ErrorCode::CalculationFailure)?;
                        remaining_amount = remaining_amount.checked_sub(match_amount)
                            .ok_or(ErrorCode::CalculationFailure)?;
                        filled_amount = filled_amount.checked_add(match_amount)
                            .ok_or(ErrorCode::CalculationFailure)?;
                        
                        // Calculate quote amount to transfer to seller
                        let quote_amount = match_amount.checked_mul(bid.price)
                            .ok_or(ErrorCode::CalculationFailure)?;

                        // Transfer quote tokens from vault to seller
                        transfer_tokens(
                            &context.accounts.quote_vault,
                            &context.accounts.user_quote_account,
                            &quote_amount,
                            &context.accounts.quote_token_mint,
                            &order_book_info,
                            &context.accounts.token_program,
                            signers_seeds,
                        )?;
                        
                        // Transfer base tokens from seller (taker) to vault
                        transfer_tokens(
                            &context.accounts.user_base_account,
                            &context.accounts.base_vault,
                            &match_amount,
                            &context.accounts.base_token_mint,
                            &context.accounts.user.to_account_info(),
                            &context.accounts.token_program,
                            None,
                        )?;


                        // Remove filled orders
                        if bid.remaining_amount == 0 {
                            order_book.buys.remove(i);
                            // Don't increment i since we removed an element
                            continue;
                        }

                        order_book.add_balance(bid_owner, match_amount, 0)?;
                    }
                } else {
                    // No more matching orders (price too low)
                    break;
                }
                
                i += 1;
            }
        }
    }
    
    order.remaining_amount = remaining_amount;
    
    // If the order wasn't fully filled, add it back to the orderbook
    if remaining_amount > 0 {
        match order_side {
            Side::Buy => {
                if order_book.buys.len() >= Orderbook::MAX_ORDERS {
                    return err!(ErrorCode::OrderbookFull);
                }
                order_book.buys.push(order);
            },
            Side::Sell => {
                if order_book.sells.len() >= Orderbook::MAX_ORDERS {
                    return err!(ErrorCode::OrderbookFull);
                }
                order_book.sells.push(order);
            }
        }
    }
    
    // Log the orderbook state after matching
    msg!("Orderbook state after matching:");
    msg!("Number of buys: {}", order_book.buys.len());
    for (i, bid) in order_book.buys.iter().enumerate() {
        msg!("Bid #{}: ID: {}, Price: {}, Remaining: {}, Owner: {}", 
            i, bid.id, bid.price, bid.remaining_amount, bid.owner);
    }
    
    msg!("Number of sells: {}", order_book.sells.len());
    for (i, ask) in order_book.sells.iter().enumerate() {
        msg!("Ask #{}: ID: {}, Price: {}, Remaining: {}, Owner: {}", 
            i, ask.id, ask.price, ask.remaining_amount, ask.owner);
    }
    
    Ok(())
}