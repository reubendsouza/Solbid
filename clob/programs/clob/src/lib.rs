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
        initialize_orderbook::handler(ctx)
    }

}
