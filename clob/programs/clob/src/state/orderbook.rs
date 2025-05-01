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
    #[max_len(100)]
    pub bids: Vec<Order>,
    #[max_len(100)]
    pub asks: Vec<Order>,
    pub authority: Pubkey,
    pub order_counter: u64,
    pub bump: u8,
}

impl Orderbook {
    pub fn next_order_id(&mut self) -> u64 {
        let id = self.order_counter;
        self.order_counter += 1;
        id
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace)]
pub struct Order {
    pub id: u64,
    pub owner: Pubkey,
    pub side: Side,
    pub price: u64,
    pub original_amount: u64,
    pub remaining_amount: u64,
    pub created_at: i64,
}


#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace)]
#[repr(u8)]
pub enum Side {
    Buy = 0,
    Sell = 1,
}