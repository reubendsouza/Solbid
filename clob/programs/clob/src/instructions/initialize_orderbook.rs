use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitializeOrderbook<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub base_token_mint: InterfaceAccount<'info, Mint>,
    pub quote_token_mint: InterfaceAccount<'info, Mint>,


    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeOrderbook>) -> Result<()> {
    Ok(())
}
