use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Orderbook {
    pub base_asset: Pubkey,
    pub quote_asset: Pubkey,
    pub base_vault: Pubkey,
    pub quote_vault: Pubkey,
    pub base_decimals: u8,
    pub quote_decimals: u8,
    pub authority: Pubkey,
    pub bump: u8,
}
