use anchor_lang::prelude::*;

use crate::error::ErrorCode;

#[account]
#[derive(InitSpace)]
pub struct Orderbook {
    pub base_asset: Pubkey,
    pub quote_asset: Pubkey,
    pub base_vault: Pubkey,
    pub quote_vault: Pubkey,
    pub base_decimals: u8,
    pub quote_decimals: u8,
    #[max_len(10, Order)]
    pub buys: Vec<Order>,
    #[max_len(10, Order)]
    pub sells: Vec<Order>,
    pub authority: Pubkey,
    pub order_counter: u64,
    #[max_len(20, UserBalance)]
    pub user_balances: Vec<UserBalance>,
    pub bump: u8,
    pub is_delegated: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace)]
pub struct UserBalance {
    pub owner: Pubkey,
    pub base_amount: u64,
    pub quote_amount: u64,
}

impl Orderbook {
    pub const MAX_ORDERS: usize = 100;

    pub fn next_order_id(&mut self) -> u64 {
        let id = self.order_counter;
        self.order_counter += 1;
        id
    }

    pub fn add_balance(&mut self, owner: &Pubkey, base_amount: u64, quote_amount: u64) -> Result<()> {

        for balance in &mut self.user_balances {
            if balance.owner == *owner {
                if base_amount > 0 {
                    balance.base_amount = balance.base_amount
                        .checked_add(base_amount)
                        .ok_or(error!(ErrorCode::CalculationFailure))?;
                }
                
                if quote_amount > 0 {
                    balance.quote_amount = balance.quote_amount
                        .checked_add(quote_amount)
                        .ok_or(error!(ErrorCode::CalculationFailure))?;
                }
                
                return Ok(());
            }
        }
        
        // User not found, add new entry if either amount is greater than 0
        if base_amount > 0 || quote_amount > 0 {
            require!(self.user_balances.len() < 20, ErrorCode::TooManyUsers);
            
            self.user_balances.push(UserBalance {
                owner: *owner,
                base_amount,
                quote_amount,
            });
        }
        
        Ok(())
    }
    
    // Get a user's balance
    pub fn get_balance(&self, owner: &Pubkey) -> (u64, u64) {
        for balance in &self.user_balances {
            if balance.owner == *owner {
                return (balance.base_amount, balance.quote_amount);
            }
        }
        (0, 0)
    }
    
    // Subtract from a user's balance
    pub fn subtract_balance(&mut self, owner: &Pubkey, base_amount: u64, quote_amount: u64) -> Result<()> {
        for (i, balance) in self.user_balances.iter_mut().enumerate() {
            if balance.owner == *owner {
                if base_amount > 0 {
                    require!(
                        balance.base_amount >= base_amount,
                        ErrorCode::InsufficientBalance
                    );
                    
                    balance.base_amount = balance.base_amount
                        .checked_sub(base_amount)
                        .ok_or(error!(ErrorCode::CalculationFailure))?;
                }
                
                if quote_amount > 0 {
                    require!(
                        balance.quote_amount >= quote_amount,
                        ErrorCode::InsufficientBalance
                    );
                    
                    balance.quote_amount = balance.quote_amount
                        .checked_sub(quote_amount)
                        .ok_or(error!(ErrorCode::CalculationFailure))?;
                }
                
                // Remove the entry if both balances are zero
                if balance.base_amount == 0 && balance.quote_amount == 0 {
                    self.user_balances.remove(i);
                }
                
                return Ok(());
            }
        }
        
        err!(ErrorCode::UserNotFound)
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