use anchor_lang::prelude::*;

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::state::{Orderbook, Order, Side};
use crate::instructions::shared::transfer_tokens;
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

    #[account(mut,
        associated_token::mint = base_token_mint,
        associated_token::authority = user,
        associated_token::token_program = token_program,
        )]
    pub user_base_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut,
        associated_token::mint = quote_token_mint,
        associated_token::authority = user,
        associated_token::token_program = token_program,
        )]
    pub user_quote_account: InterfaceAccount<'info, TokenAccount>,

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
    let _new_order = Order {
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

            transfer_tokens(
                &context.accounts.user_quote_account,
                &context.accounts.quote_vault,
                &quote_amount,
                &context.accounts.quote_token_mint,
                &context.accounts.user.to_account_info(),
                &context.accounts.token_program,
                None
            )?;
        },
        Side::Sell => {
            // For sell orders, transfer base tokens
            let base_amount = price.checked_mul(amount)
                .ok_or(ErrorCode::CalculationFailure)?;

            transfer_tokens(
                &context.accounts.user_base_account,
                &context.accounts.base_vault,
                &base_amount,
                &context.accounts.base_token_mint,
                &context.accounts.user.to_account_info(),
                &context.accounts.token_program,
                None
            )?;
        }
    }

    //TODO: match existing orders
    
    //TODO: f the order wasn't fully filled, add it to the orderbook
    
    Ok(())
    
}