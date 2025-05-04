use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use ephemeral_rollups_sdk::anchor::commit;
use ephemeral_rollups_sdk::ephem::commit_and_undelegate_accounts;

use crate::state::Orderbook;

#[commit]
#[derive(Accounts)]
pub struct UndelegateOrderbook<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    pub base_token_mint: InterfaceAccount<'info, Mint>,
    pub quote_token_mint: InterfaceAccount<'info, Mint>,

    #[account(mut, seeds = [b"orderbook", base_token_mint.key().as_ref(), quote_token_mint.key().as_ref()], bump)]
    pub order_book: Account<'info, Orderbook>,
}

pub fn handle_undelegate(ctx: Context<UndelegateOrderbook>) -> Result<()> {
    commit_and_undelegate_accounts(
        &ctx.accounts.user,
        vec![&ctx.accounts.order_book.to_account_info()],
        &ctx.accounts.magic_context,
        &ctx.accounts.magic_program,
    )?;
    Ok(())
}
