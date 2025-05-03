pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("A8RhaeMu9ci18X6mWi6Fa8jcpD5Rk1qR36Wj4waYPJuE");

#[program]
pub mod clob {
    use super::*;

    pub fn initialize_orderbook(ctx: Context<InitializeOrderbook>) -> Result<()> {
        initialize_orderbook::init_orderbook(ctx)
    }

    pub fn create_order(ctx: Context<CreateOrder>, side: u8, price: u64, amount: u64) -> Result<()> {
        create_order::handle_create_order(ctx, side, price, amount)
    }

    pub fn withdraw_funds(ctx: Context<WithdrawFundsAccountConstraints>, base_amount: u64, quote_amount: u64) -> Result<()> {
        withdraw_funds::handle_withdraw_funds(ctx, base_amount, quote_amount)
    }

}
