// Database schema for Soko Tabiri prediction market

export const schema = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    viewing_key TEXT UNIQUE,
    transparent_address TEXT,
    shielded_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Markets table
CREATE TABLE IF NOT EXISTS markets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    yes_price REAL DEFAULT 0.5,
    no_price REAL DEFAULT 0.5,
    volume_zat INTEGER DEFAULT 0,
    liquidity_zat INTEGER DEFAULT 0,
    end_date DATETIME NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    outcome TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Positions table (user holdings)
CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    market_id TEXT NOT NULL,
    side TEXT NOT NULL CHECK(side IN ('yes', 'no')),
    shares INTEGER NOT NULL,
    avg_price REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (market_id) REFERENCES markets(id),
    UNIQUE(user_id, market_id, side)
);

-- Trades table (transaction history)
CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    market_id TEXT NOT NULL,
    side TEXT NOT NULL CHECK(side IN ('yes', 'no')),
    action TEXT NOT NULL CHECK(action IN ('buy', 'sell')),
    shares INTEGER NOT NULL,
    price REAL NOT NULL,
    amount_zat INTEGER NOT NULL,
    tx_hash TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'failed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (market_id) REFERENCES markets(id)
);

-- Deposits/Withdrawals table
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('deposit', 'withdrawal')),
    amount_zat INTEGER NOT NULL,
    tx_hash TEXT,
    from_address TEXT,
    to_address TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'failed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    confirmed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- User balances (cached for quick access)
CREATE TABLE IF NOT EXISTS balances (
    user_id TEXT PRIMARY KEY,
    available_zat INTEGER DEFAULT 0,
    locked_zat INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Market liquidity pools
CREATE TABLE IF NOT EXISTS liquidity_pools (
    market_id TEXT PRIMARY KEY,
    yes_shares INTEGER DEFAULT 0,
    no_shares INTEGER DEFAULT 0,
    constant_product INTEGER DEFAULT 0,
    FOREIGN KEY (market_id) REFERENCES markets(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_market ON positions(market_id);
CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_markets_category ON markets(category);
CREATE INDEX IF NOT EXISTS idx_markets_end_date ON markets(end_date);
`;

export const seedMarkets = `
INSERT OR IGNORE INTO markets (id, title, description, category, yes_price, no_price, volume_zat, liquidity_zat, end_date) VALUES
('mkt_001', 'Will Kenya''s inflation rate drop below 5% by March 2026?', 'Based on official CBK reports, will the annual inflation rate be below 5%?', 'Economy', 0.42, 0.58, 12500000000, 4500000000, '2026-03-31'),
('mkt_002', 'Will Harambee Stars qualify for AFCON 2026?', 'Kenya''s national football team qualification for the Africa Cup of Nations.', 'Sports', 0.35, 0.65, 8900000000, 3200000000, '2026-01-15'),
('mkt_003', 'Will M-Pesa transaction fees decrease in Q1 2026?', 'Safaricom announces reduction in mobile money transfer charges.', 'Technology', 0.28, 0.72, 15600000000, 6700000000, '2026-03-31'),
('mkt_004', 'Will Nairobi''s new BRT system launch before June 2026?', 'Official launch of the Bus Rapid Transit system in Nairobi.', 'Infrastructure', 0.51, 0.49, 7800000000, 2800000000, '2026-06-30'),
('mkt_005', 'Will the KES/USD exchange rate stay below 130 in January?', 'Kenya Shilling to US Dollar exchange rate prediction.', 'Economy', 0.62, 0.38, 23400000000, 8900000000, '2026-01-31'),
('mkt_006', 'Will Equity Bank launch a crypto trading service in 2026?', 'Any of Kenya''s major banks offering cryptocurrency trading.', 'Finance', 0.15, 0.85, 4500000000, 1800000000, '2026-12-31'),
('mkt_007', 'Will Kenya host the WRC Safari Rally in 2026?', 'World Rally Championship Safari Rally event in Kenya.', 'Sports', 0.89, 0.11, 6700000000, 2500000000, '2026-04-01'),
('mkt_008', 'Will Starlink coverage expand to all 47 counties?', 'SpaceX Starlink internet availability across Kenya.', 'Technology', 0.44, 0.56, 11200000000, 4100000000, '2026-12-31');
`;

export const seedLiquidityPools = `
INSERT OR IGNORE INTO liquidity_pools (market_id, yes_shares, no_shares, constant_product) VALUES
('mkt_001', 1000000, 1000000, 1000000000000),
('mkt_002', 1000000, 1000000, 1000000000000),
('mkt_003', 1000000, 1000000, 1000000000000),
('mkt_004', 1000000, 1000000, 1000000000000),
('mkt_005', 1000000, 1000000, 1000000000000),
('mkt_006', 1000000, 1000000, 1000000000000),
('mkt_007', 1000000, 1000000, 1000000000000),
('mkt_008', 1000000, 1000000, 1000000000000);
`;

