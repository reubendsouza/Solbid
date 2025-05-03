use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::state::Orderbook;

#[derive(Accounts)]
pub struct InitializeOrderbook<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub base_token_mint: InterfaceAccount<'info, Mint>,
    pub quote_token_mint: InterfaceAccount<'info, Mint>,

    #[account(init,
        payer = payer,
        associated_token::mint = base_token_mint,
        associated_token::authority = order_book,
        associated_token::token_program = token_program,
        )]
    pub base_vault: InterfaceAccount<'info, TokenAccount>,

    #[account(init,
        payer = payer,
        associated_token::mint = quote_token_mint,
        associated_token::authority = order_book,
        associated_token::token_program = token_program,
        )]
    pub quote_vault: InterfaceAccount<'info, TokenAccount>,
    
    #[account(init,
        payer = payer,
        space = 8 + Orderbook::INIT_SPACE,
        seeds = [b"orderbook",base_token_mint.key().as_ref(),quote_token_mint.key().as_ref()],
        bump)]
    pub order_book: Account<'info, Orderbook>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn init_orderbook(context: Context<InitializeOrderbook>) -> Result<()> {
    context.accounts.order_book.set_inner(Orderbook {
        base_asset: context.accounts.base_token_mint.key(),
        quote_asset: context.accounts.quote_token_mint.key(),
        base_vault: context.accounts.base_vault.key(),
        quote_vault: context.accounts.quote_vault.key(),
        base_decimals: context.accounts.base_token_mint.decimals,
        quote_decimals: context.accounts.quote_token_mint.decimals,
        buys: Vec::with_capacity(Orderbook::MAX_ORDERS),
        sells: Vec::with_capacity(Orderbook::MAX_ORDERS),
        authority: context.accounts.payer.key(),
        order_counter: 0,
        bump: context.bumps.order_book,
        user_balances: Vec::with_capacity(20),
    });
    Ok(())
}
