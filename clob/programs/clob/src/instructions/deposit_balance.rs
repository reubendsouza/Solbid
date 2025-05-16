use anchor_lang::prelude::*;

use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::state::Orderbook;
use crate::instructions::shared::transfer_tokens;

#[derive(Accounts)]
pub struct DepositBalance<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    pub base_token_mint: InterfaceAccount<'info, Mint>,
    pub quote_token_mint: InterfaceAccount<'info, Mint>,

    #[account(mut,
        seeds = [b"orderbook", base_token_mint.key().as_ref(), quote_token_mint.key().as_ref()],
        bump = order_book.bump
    )]
    pub order_book: Account<'info, Orderbook>,

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

pub fn handle_deposit_balance(context: Context<DepositBalance>, quote_amount: u64, base_amount: u64) -> Result<()> {
    if quote_amount > 0 && context.accounts.user_quote_account.amount > 0 {
        transfer_tokens(
            &context.accounts.user_quote_account,
            &context.accounts.quote_vault,
            &quote_amount,
            &context.accounts.quote_token_mint,
            &context.accounts.user.to_account_info(),
            &context.accounts.token_program,
            None
        )?;
        context.accounts.order_book.add_balance(&context.accounts.user.key(), 0, quote_amount)?;
    }
    if base_amount > 0 && context.accounts.user_base_account.amount > 0 {
        transfer_tokens(
            &context.accounts.user_base_account,
            &context.accounts.base_vault,
            &base_amount,
            &context.accounts.base_token_mint,
            &context.accounts.user.to_account_info(),
            &context.accounts.token_program,
            None
        )?;
        context.accounts.order_book.add_balance(&context.accounts.user.key(), base_amount, 0)?;
    }
    Ok(())
}