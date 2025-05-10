use anchor_lang::prelude::*;

use anchor_spl::token_interface::Mint;


use crate::state::{Orderbook, Order, Side};
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct CreateOrder<'info> {
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

pub fn handle_create_order(context: Context<CreateOrder>, side: u8, price: u64, amount: u64) -> Result<()> {
    let order_book = &mut context.accounts.order_book;
    let user = &context.accounts.user;
    let clock = Clock::get()?;
    
    // Validate inputs
    if amount == 0 {
        return err!(ErrorCode::InvalidOrderAmount);
    }
    
    if price == 0 {
        return err!(ErrorCode::InvalidOrderPrice);
    }

    let side_enum = match side {
        0 => Side::Buy,
        1 => Side::Sell,
        _ => return err!(ErrorCode::InvalidOrderSide),
    };
    
    // Create the new order
    let order_id = order_book.next_order_id();
    msg!("Creating new order with ID: {}", order_id);
    
    let new_order = Order {
        id: order_id,
        owner: user.key(),
        side: side_enum,
        price,
        original_amount: amount,
        remaining_amount: amount,
        created_at: clock.unix_timestamp,
    };
    
    // Transfer tokens to the vault based on order side
    match side_enum {
        Side::Buy => {
            // For buy orders, transfer quote tokens (e.g., USDC)
            let quote_amount = price.checked_mul(amount)
                .ok_or(ErrorCode::CalculationFailure)?;

            if order_book.buys.len() >= Orderbook::MAX_ORDERS {
                return err!(ErrorCode::OrderbookFull);
            }
            order_book.subtract_balance(&user.key(), 0, quote_amount)?;
            msg!("Added buy order {} to orderbook at price {}", order_id, price);
            order_book.buys.push(new_order);
        },
        Side::Sell => {
            if order_book.sells.len() >= Orderbook::MAX_ORDERS {
                return err!(ErrorCode::OrderbookFull);
            }
            order_book.subtract_balance(&user.key(), amount, 0)?;
            msg!("Added sell order {} to orderbook at price {}", order_id, price);
            order_book.sells.push(new_order);
        }
    }
    
    Ok(())
}