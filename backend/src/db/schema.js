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
    region TEXT,
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
CREATE INDEX IF NOT EXISTS idx_markets_region ON markets(region);
CREATE INDEX IF NOT EXISTS idx_markets_end_date ON markets(end_date);
`;

export const seedMarkets = `
-- AFRICA
INSERT OR IGNORE INTO markets (id, title, description, category, region, yes_price, no_price, volume_zat, liquidity_zat, end_date) VALUES
('afr_001', 'Will Nigeria''s Naira trade below ₦1,500/USD by June 2026?', 'Official CBN exchange rate for Nigerian Naira against US Dollar.', 'Africa', 'Nigeria', 0.32, 0.68, 8900000000, 3400000000, '2026-06-30'),
('afr_002', 'Will South Africa avoid Stage 6 load shedding in Q1 2026?', 'Eskom power grid stability - no Stage 6 rolling blackouts for entire quarter.', 'Africa', 'South Africa', 0.28, 0.72, 6700000000, 2800000000, '2026-03-31'),
('afr_003', 'Will Kenya''s M-Pesa process over 1 trillion KES monthly by 2026?', 'Safaricom mobile money platform monthly transaction volume milestone.', 'Africa', 'Kenya', 0.71, 0.29, 15600000000, 5200000000, '2026-12-31'),
('afr_004', 'Will Ethiopia complete the GERD dam filling by end of 2026?', 'Grand Ethiopian Renaissance Dam reaches full reservoir capacity.', 'Africa', 'Ethiopia', 0.45, 0.55, 23400000000, 8900000000, '2026-12-31'),

-- RUSSIA & CIS
('rus_001', 'Will Russia''s RUB/USD rate stay below 100 through 2026?', 'Russian Ruble exchange rate against US Dollar remains under 100.', 'Russia & CIS', 'Russia', 0.38, 0.62, 56700000000, 19800000000, '2026-12-31'),
('rus_002', 'Will Gazprom resume full gas exports to EU by 2026?', 'Gazprom pipeline gas exports to European Union return to 2021 levels.', 'Russia & CIS', 'Russia', 0.12, 0.88, 89000000000, 32000000000, '2026-12-31'),

-- CHINA
('chn_001', 'Will China''s GDP growth exceed 5% in 2026?', 'Official NBS reported annual GDP growth rate for 2026.', 'China', 'China', 0.42, 0.58, 120000000000, 45000000000, '2027-01-31'),
('chn_002', 'Will BYD outsell Tesla globally in 2026?', 'BYD total vehicle deliveries exceed Tesla worldwide deliveries.', 'China', 'China', 0.67, 0.33, 234000000000, 89000000000, '2027-01-15'),
('chn_003', 'Will Taiwan Semiconductor (TSMC) begin 2nm chip production in 2026?', 'TSMC starts mass production of 2nm process node chips.', 'China', 'Taiwan', 0.78, 0.22, 89000000000, 34500000000, '2026-12-31'),

-- JAPAN
('jpn_001', 'Will Bank of Japan raise interest rates above 0.5% in 2026?', 'BOJ policy rate increase beyond current levels.', 'Japan', 'Japan', 0.61, 0.39, 56700000000, 23400000000, '2026-12-31'),
('jpn_002', 'Will USD/JPY trade below ¥140 by mid-2026?', 'Japanese Yen strengthens against US Dollar.', 'Japan', 'Japan', 0.44, 0.56, 78900000000, 31200000000, '2026-06-30'),

-- SOUTHEAST ASIA
('sea_001', 'Will Indonesia''s new capital Nusantara open government offices in 2026?', 'Indonesian government ministries begin operations in new capital city.', 'Southeast Asia', 'Indonesia', 0.48, 0.52, 12300000000, 4500000000, '2026-12-31'),
('sea_002', 'Will Thailand legalize casino resorts in 2026?', 'Thai parliament passes entertainment complex legislation.', 'Southeast Asia', 'Thailand', 0.55, 0.45, 23400000000, 8900000000, '2026-12-31'),

-- MIDDLE EAST
('mea_001', 'Will Saudi Arabia''s NEOM city welcome first residents in 2026?', 'NEOM The Line or other zones receive permanent residents.', 'Middle East', 'Saudi Arabia', 0.25, 0.75, 45600000000, 17800000000, '2026-12-31'),

-- LATIN AMERICA
('latam_001', 'Will Argentina''s annual inflation drop below 50% in 2026?', 'INDEC reported year-over-year inflation rate.', 'Latin America', 'Argentina', 0.42, 0.58, 56700000000, 21300000000, '2026-12-31'),

-- SOUTH ASIA
('ind_001', 'Will India''s GDP surpass Japan to become world''s 4th largest in 2026?', 'India nominal GDP exceeds Japan in IMF rankings.', 'South Asia', 'India', 0.82, 0.18, 145000000000, 56700000000, '2027-01-31'),
('ind_002', 'Will Reliance Jio launch satellite internet in India by 2026?', 'Jio satellite broadband service commercially available.', 'South Asia', 'India', 0.58, 0.42, 23400000000, 8900000000, '2026-12-31');
`;

export const seedLiquidityPools = `
INSERT OR IGNORE INTO liquidity_pools (market_id, yes_shares, no_shares, constant_product) VALUES
('afr_001', 1000000, 1000000, 1000000000000),
('afr_002', 1000000, 1000000, 1000000000000),
('afr_003', 1000000, 1000000, 1000000000000),
('afr_004', 1000000, 1000000, 1000000000000),
('rus_001', 1000000, 1000000, 1000000000000),
('rus_002', 1000000, 1000000, 1000000000000),
('chn_001', 1000000, 1000000, 1000000000000),
('chn_002', 1000000, 1000000, 1000000000000),
('chn_003', 1000000, 1000000, 1000000000000),
('jpn_001', 1000000, 1000000, 1000000000000),
('jpn_002', 1000000, 1000000, 1000000000000),
('sea_001', 1000000, 1000000, 1000000000000),
('sea_002', 1000000, 1000000, 1000000000000),
('mea_001', 1000000, 1000000, 1000000000000),
('latam_001', 1000000, 1000000, 1000000000000),
('ind_001', 1000000, 1000000, 1000000000000),
('ind_002', 1000000, 1000000, 1000000000000);
`;
