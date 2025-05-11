use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::state::{Orderbook, Side};
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct MatchOrder<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    pub base_token_mint: InterfaceAccount<'info, Mint>,
    pub quote_token_mint: InterfaceAccount<'info, Mint>,

    #[account(mut,
        seeds = [b"orderbook", base_token_mint.key().as_ref(), quote_token_mint.key().as_ref()],
        bump = order_book.bump
    )]
    pub order_book: Account<'info, Orderbook>,
    
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
    
    msg!("Searching for order ID: {}", order_id);

    // Log the orderbook state before matching
    msg!("Orderbook state before matching:");
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
    
    // Log user balances in the orderbook
    msg!("User balances before matching:");
    for (i, balance) in order_book.user_balances.iter().enumerate() {
        msg!("Balance #{}: User: {}, Base: {}, Quote: {}", 
            i, balance.owner, balance.base_amount, balance.quote_amount);
    }
    
    // Find the order by ID
    let mut order_index = None;
    let mut order_side = None;

    // Search in buys
    for (i, bid) in order_book.buys.iter().enumerate() {
        msg!("Bid ID iter id: {}", bid.id);
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

    // Match the order - Inline implementation instead of separate function
    let mut filled_amount: u64 = 0;
    let mut remaining_amount: u64 = order.remaining_amount;

    match order.side {
        Side::Buy => {
            // For buy orders, match against sells (sell orders)
            // Sort sells by price (lowest first)
            order_book.sells.sort_by(|a, b| a.price.cmp(&b.price));
            
            let mut i = 0;
            while i < order_book.sells.len() && remaining_amount > 0 {
                let ask = &mut order_book.sells[i];
                let ask_owner = ask.owner;
                
                // Check if the buy price is >= the ask price
                if order.price >= ask.price {
                    // Calculate the matched amount
                    let match_amount = remaining_amount.min(ask.remaining_amount);
                    
                    if match_amount > 0 {
                        // Update the order amounts
                        ask.remaining_amount = ask.remaining_amount.checked_sub(match_amount)
                            .ok_or(ErrorCode::CalculationFailure)?;
                        remaining_amount = remaining_amount.checked_sub(match_amount)
                            .ok_or(ErrorCode::CalculationFailure)?;
                        filled_amount = filled_amount.checked_add(match_amount)
                            .ok_or(ErrorCode::CalculationFailure)?;
                        
                        // Calculate quote amount
                        let quote_amount = match_amount.checked_mul(ask.price)
                            .ok_or(ErrorCode::CalculationFailure)?;
                        
                        // Remove filled orders
                        let remaining_amount = ask.remaining_amount;

                        // Update balances in the orderbook
                        order_book.add_balance(&user.key(), match_amount, 0)?;
                        order_book.subtract_balance(&user.key(), 0, quote_amount)?;
                        order_book.add_balance(&ask_owner, 0, quote_amount)?;
                        order_book.subtract_balance(&ask_owner, match_amount, 0)?;
                        
                        if remaining_amount == 0 {
                            order_book.sells.remove(i);
                            // Don't increment i since we removed an element
                            continue;
                        }
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
                        
                        // Calculate quote amount
                        let quote_amount = match_amount.checked_mul(bid.price)
                            .ok_or(ErrorCode::CalculationFailure)?;

                        // Remove filled orders
                        let remaining_amount = bid.remaining_amount;

                        // Update balances in the orderbook
                        order_book.add_balance(&user.key(), 0, quote_amount)?;
                        order_book.subtract_balance(&user.key(), match_amount, 0)?;
                        order_book.add_balance(&bid_owner, match_amount, 0)?;
                        order_book.subtract_balance(&bid_owner, 0, quote_amount)?;

                        if remaining_amount == 0 {
                            order_book.buys.remove(i);
                            // Don't increment i since we removed an element
                            continue;
                        }
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
    
    // Log user balances after matching
    msg!("User balances after matching:");
    for (i, balance) in order_book.user_balances.iter().enumerate() {
        msg!("Balance #{}: User: {}, Base: {}, Quote: {}", 
            i, balance.owner, balance.base_amount, balance.quote_amount);
    }
    
    Ok(())
}