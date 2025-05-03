use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::state::Orderbook;
use crate::instructions::shared::transfer_tokens;
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct WithdrawFundsAccountConstraints<'info> {
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

pub fn handle_withdraw_funds(
    context: Context<WithdrawFundsAccountConstraints>,
    base_amount: u64,
    quote_amount: u64,
) -> Result<()> {
    let order_book = &mut context.accounts.order_book;
    let user = &context.accounts.user;
    
    // Check if the user has sufficient balance
    let (user_base_balance, user_quote_balance) = order_book.get_balance(&user.key());
    
    msg!("user_base_balance: {}", user_base_balance);
    msg!("user_quote_balance: {}", user_quote_balance);
    
    require!(
        user_base_balance >= base_amount && user_quote_balance >= quote_amount,
        ErrorCode::InsufficientBalance
    );
    
    // Prepare PDA signer seeds
    let base_mint_key = context.accounts.base_token_mint.key();
    let quote_mint_key = context.accounts.quote_token_mint.key();
    let account_seeds = [
        b"orderbook",
        base_mint_key.as_ref(),
        quote_mint_key.as_ref(),
        &[order_book.bump],
    ];
    let signers_seeds = Some(&account_seeds[..]);
    
    // Transfer base tokens if requested
    if base_amount > 0 {
        transfer_tokens(
            &context.accounts.base_vault,
            &context.accounts.user_base_account,
            &base_amount,
            &context.accounts.base_token_mint,
            &order_book.to_account_info(),
            &context.accounts.token_program,
            signers_seeds,
        )?;
    }
    
    // Transfer quote tokens if requested
    if quote_amount > 0 {
        transfer_tokens(
            &context.accounts.quote_vault,
            &context.accounts.user_quote_account,
            &quote_amount,
            &context.accounts.quote_token_mint,
            &order_book.to_account_info(),
            &context.accounts.token_program,
            signers_seeds,
        )?;
    }
    
    // Update the user's balance
    order_book.subtract_balance(&user.key(), base_amount, quote_amount)?;
    
    Ok(())
} 