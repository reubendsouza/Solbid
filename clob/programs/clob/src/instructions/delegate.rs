use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::state::Orderbook;

use ephemeral_rollups_sdk::anchor::delegate;
use ephemeral_rollups_sdk::cpi::DelegateConfig;

#[delegate]
#[derive(Accounts)]
pub struct DelegateOrderbook<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    pub base_token_mint: InterfaceAccount<'info, Mint>,
    pub quote_token_mint: InterfaceAccount<'info, Mint>,

    #[account(mut,
        del,
        seeds = [b"orderbook", base_token_mint.key().as_ref(), quote_token_mint.key().as_ref()],
        bump
    )]
    pub order_book: Account<'info, Orderbook>,//TODO: check this since doc says AccountInfo, I used Account to fix the error
}

pub fn handle_delegate(ctx: Context<DelegateOrderbook>) -> Result<()> {
    ctx.accounts.delegate_order_book(
        &ctx.accounts.user,
        &[b"orderbook", ctx.accounts.base_token_mint.key().as_ref(), ctx.accounts.quote_token_mint.key().as_ref()],
        DelegateConfig::default(),
    )?;
    Ok(())
}
