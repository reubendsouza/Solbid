use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Order amount must be greater than zero")]
    InvalidOrderAmount,
    
    #[msg("Order price must be greater than zero")]
    InvalidOrderPrice,
    
    #[msg("Calculation overflow or underflow")]
    CalculationFailure,
    
    #[msg("Insufficient funds for the order")]
    InsufficientFunds,
    
    #[msg("Order not found")]
    OrderNotFound,
    
    #[msg("Orderbook is full")]
    OrderbookFull,

    #[msg("Invalid order side")]
    InvalidOrderSide,

    #[msg("Not order owner")]
    NotOrderOwner,

    #[msg("Too many users with balances")]
    TooManyUsers,
    
    #[msg("User not found")]
    UserNotFound,
    
    #[msg("Insufficient balance")]
    InsufficientBalance,
}
