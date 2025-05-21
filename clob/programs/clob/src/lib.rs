pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

use ephemeral_rollups_sdk::anchor::ephemeral;


declare_id!("EBRUiZStSVz98fpJ9PsG3BTFBtETEXWsw9bPwsaUrkJF");

#[ephemeral]
#[program]
pub mod clob {
    use super::*;

    pub fn initialize_orderbook(ctx: Context<InitializeOrderbook>) -> Result<()> {
        initialize_orderbook::init_orderbook(ctx)
    }

    pub fn deposit_balance(ctx: Context<DepositBalance>, quote_amount: u64, base_amount: u64) -> Result<()> {
        deposit_balance::handle_deposit_balance(ctx, quote_amount, base_amount)
    }

    pub fn create_order(ctx: Context<CreateOrder>, side: u8, price: u64, amount: u64) -> Result<()> {
        create_order::handle_create_order(ctx, side, price, amount)
    }

    pub fn match_order(ctx: Context<MatchOrder>, order_id: u64) -> Result<()> {
        match_order::handle_match_order(ctx, order_id)
    }

    pub fn withdraw_funds(ctx: Context<WithdrawFundsAccountConstraints>, base_amount: u64, quote_amount: u64) -> Result<()> {
        withdraw_funds::handle_withdraw_funds(ctx, base_amount, quote_amount)
    }

    pub fn delegate(ctx: Context<DelegateOrderbook>) -> Result<()> {
        delegate::handle_delegate(ctx)
    }

    pub fn undelegate(ctx: Context<UndelegateOrderbook>) -> Result<()> {
        undelegate::handle_undelegate(ctx)
    }

    pub fn update_delegation_status(ctx: Context<UpdateDelegationStatus>, is_delegated: bool) -> Result<()> {
        update_delegation_status::handle_update_delegation_status(ctx, is_delegated)
    }
}
