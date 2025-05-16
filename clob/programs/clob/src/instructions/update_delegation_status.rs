use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::state::Orderbook;
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct UpdateDelegationStatus<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    pub base_token_mint: InterfaceAccount<'info, Mint>,
    pub quote_token_mint: InterfaceAccount<'info, Mint>,

    #[account(mut,
        seeds = [b"orderbook", base_token_mint.key().as_ref(), quote_token_mint.key().as_ref()],
        bump = order_book.bump
    )]
    pub order_book: Account<'info, Orderbook>,
}

pub fn handle_update_delegation_status(ctx: Context<UpdateDelegationStatus>, is_delegated: bool) -> Result<()> {
    let order_book = &mut ctx.accounts.order_book;
    
    // Ensure only the orderbook authority can update delegation status
    require!(
        order_book.authority == ctx.accounts.user.key(),
        ErrorCode::Unauthorized
    );
    
    order_book.is_delegated = is_delegated;
    Ok(())
} 