-- Soko Tabiri - Initial Database Schema
-- Privacy-Preserving Prediction Markets on Zcash
--
-- ASSUMPTION: Postgres 15 (LTS) - not specified in repo
-- Migration: 001_init.sql

-- =============================================================================
-- SCHEMA MIGRATIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Record this migration
INSERT INTO schema_migrations (version) VALUES ('001_init')
ON CONFLICT (version) DO NOTHING;

-- =============================================================================
-- USERS TABLE
-- Ephemeral mapping only - no PII stored
-- Privacy: Users identified by viewing_key hash, not personal data
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- viewing_key_hash: SHA256 of user's viewing key (not the key itself)
    viewing_key_hash VARCHAR(64) UNIQUE NOT NULL,
    -- Addresses are derived, not stored directly for privacy
    -- These are placeholder references, actual addresses derived at runtime
    shielded_address_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    -- Privacy flag: if true, user has completed KYC for t-address flows
    kyc_verified BOOLEAN DEFAULT FALSE,
    kyc_verified_at TIMESTAMPTZ
);

CREATE INDEX idx_users_viewing_key_hash ON users(viewing_key_hash);
CREATE INDEX idx_users_last_active ON users(last_active_at);

COMMENT ON TABLE users IS 'Ephemeral user mapping. No PII stored. viewing_key_hash is SHA256 of viewing key.';
COMMENT ON COLUMN users.kyc_verified IS 'Required for t-address/deshield flows. Default shielded-only.';

-- =============================================================================
-- MARKETS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS markets (
    id VARCHAR(64) PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category VARCHAR(64) NOT NULL,
    region VARCHAR(64),
    -- Resolution source metadata (for oracle)
    resolution_source TEXT,
    resolution_source_url TEXT,
    -- Pricing (updated by engine)
    yes_price DECIMAL(10, 8) DEFAULT 0.5,
    no_price DECIMAL(10, 8) DEFAULT 0.5,
    -- Volume and liquidity in zatoshi (1 ZEC = 100,000,000 zat)
    volume_zat BIGINT DEFAULT 0,
    liquidity_zat BIGINT DEFAULT 0,
    -- Lifecycle
    created_at TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    outcome VARCHAR(8) CHECK (outcome IN ('yes', 'no', 'invalid')),
    -- Creator (optional, for market creation rewards)
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_markets_category ON markets(category);
CREATE INDEX idx_markets_region ON markets(region);
CREATE INDEX idx_markets_end_date ON markets(end_date);
CREATE INDEX idx_markets_resolved ON markets(resolved);

COMMENT ON TABLE markets IS 'Prediction markets with AMM pricing.';
COMMENT ON COLUMN markets.resolution_source IS 'EXAMPLE SOURCE - verify before use. E.g., "Reuters", "Official Government API"';

-- =============================================================================
-- ORDERS TABLE (for limit orderbook)
-- =============================================================================

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    market_id VARCHAR(64) NOT NULL REFERENCES markets(id),
    side VARCHAR(8) NOT NULL CHECK (side IN ('yes', 'no')),
    order_type VARCHAR(16) NOT NULL CHECK (order_type IN ('limit', 'market')),
    direction VARCHAR(8) NOT NULL CHECK (direction IN ('buy', 'sell')),
    -- Price in decimal (0.01 to 0.99 for prediction markets)
    price DECIMAL(10, 8),
    -- Quantity in shares
    quantity BIGINT NOT NULL,
    filled_quantity BIGINT DEFAULT 0,
    -- Amount in zatoshi
    amount_zat BIGINT NOT NULL,
    -- Status
    status VARCHAR(16) DEFAULT 'open' CHECK (status IN ('open', 'partial', 'filled', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    filled_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_market ON orders(market_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_market_side_price ON orders(market_id, side, price) WHERE status IN ('open', 'partial');

COMMENT ON TABLE orders IS 'Limit orders for orderbook matching. AMM is primary, orderbook is optional.';

-- =============================================================================
-- FILLS TABLE (matched orders and AMM trades)
-- =============================================================================

CREATE TABLE IF NOT EXISTS fills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Order reference (NULL for AMM trades)
    order_id UUID REFERENCES orders(id),
    -- Counterparty order (NULL for AMM trades)
    counter_order_id UUID REFERENCES orders(id),
    user_id UUID NOT NULL REFERENCES users(id),
    market_id VARCHAR(64) NOT NULL REFERENCES markets(id),
    side VARCHAR(8) NOT NULL CHECK (side IN ('yes', 'no')),
    direction VARCHAR(8) NOT NULL CHECK (direction IN ('buy', 'sell')),
    -- Fill details
    price DECIMAL(10, 8) NOT NULL,
    quantity BIGINT NOT NULL,
    amount_zat BIGINT NOT NULL,
    -- Fee in zatoshi
    fee_zat BIGINT DEFAULT 0,
    -- Source: 'amm' or 'orderbook'
    source VARCHAR(16) NOT NULL CHECK (source IN ('amm', 'orderbook')),
    -- Settlement job reference
    settlement_job_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fills_user ON fills(user_id);
CREATE INDEX idx_fills_market ON fills(market_id);
CREATE INDEX idx_fills_order ON fills(order_id);
CREATE INDEX idx_fills_settlement_job ON fills(settlement_job_id);

COMMENT ON TABLE fills IS 'Executed trades from AMM or orderbook matching.';

-- =============================================================================
-- STAKES TABLE (for oracle reporters)
-- =============================================================================

CREATE TABLE IF NOT EXISTS stakes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    -- Stake type: 'reporter' for oracle reporters, 'liquidity' for LP
    stake_type VARCHAR(16) NOT NULL CHECK (stake_type IN ('reporter', 'liquidity')),
    -- Amount in zatoshi
    amount_zat BIGINT NOT NULL,
    -- Status
    status VARCHAR(16) DEFAULT 'active' CHECK (status IN ('active', 'locked', 'slashed', 'withdrawn')),
    -- Lock reason (e.g., 'dispute_pending')
    lock_reason TEXT,
    locked_at TIMESTAMPTZ,
    -- Slash details
    slashed_amount_zat BIGINT DEFAULT 0,
    slashed_at TIMESTAMPTZ,
    slash_reason TEXT,
    -- Withdrawal
    withdrawn_at TIMESTAMPTZ,
    withdrawal_tx_hash VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stakes_user ON stakes(user_id);
CREATE INDEX idx_stakes_type ON stakes(stake_type);
CREATE INDEX idx_stakes_status ON stakes(status);

COMMENT ON TABLE stakes IS 'Bonded stakes for oracle reporters and liquidity providers.';

-- =============================================================================
-- ORACLE ATTESTATIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS oracle_attestations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id VARCHAR(64) NOT NULL REFERENCES markets(id),
    reporter_id UUID NOT NULL REFERENCES users(id),
    -- Attested outcome
    outcome VARCHAR(8) NOT NULL CHECK (outcome IN ('yes', 'no', 'invalid')),
    -- Signature and metadata
    signature TEXT NOT NULL,
    signature_algorithm VARCHAR(32) DEFAULT 'ed25519',
    -- Source metadata (for verification)
    source_name TEXT,
    source_url TEXT,
    source_timestamp TIMESTAMPTZ,
    -- Evidence (e.g., screenshot hash, API response hash)
    evidence_hash VARCHAR(128),
    -- Status
    status VARCHAR(16) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'disputed', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    disputed_at TIMESTAMPTZ
);

CREATE INDEX idx_attestations_market ON oracle_attestations(market_id);
CREATE INDEX idx_attestations_reporter ON oracle_attestations(reporter_id);
CREATE INDEX idx_attestations_status ON oracle_attestations(status);

COMMENT ON TABLE oracle_attestations IS 'Signed attestations from oracle reporters.';
COMMENT ON COLUMN oracle_attestations.source_url IS 'EXAMPLE SOURCE - verify before use.';

-- =============================================================================
-- DISPUTES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attestation_id UUID NOT NULL REFERENCES oracle_attestations(id),
    market_id VARCHAR(64) NOT NULL REFERENCES markets(id),
    -- Disputer
    disputer_id UUID NOT NULL REFERENCES users(id),
    disputer_stake_id UUID REFERENCES stakes(id),
    -- Disputed outcome (what the disputer claims is correct)
    disputed_outcome VARCHAR(8) NOT NULL CHECK (disputed_outcome IN ('yes', 'no', 'invalid')),
    -- Reason and evidence
    reason TEXT NOT NULL,
    evidence_hash VARCHAR(128),
    evidence_url TEXT,
    -- Dispute window
    dispute_window_start TIMESTAMPTZ DEFAULT NOW(),
    dispute_window_end TIMESTAMPTZ NOT NULL,
    -- Resolution
    status VARCHAR(16) DEFAULT 'open' CHECK (status IN ('open', 'resolved_for_reporter', 'resolved_for_disputer', 'escalated')),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    resolution_notes TEXT,
    -- Stake slashing results
    reporter_slashed BOOLEAN DEFAULT FALSE,
    disputer_slashed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_disputes_attestation ON disputes(attestation_id);
CREATE INDEX idx_disputes_market ON disputes(market_id);
CREATE INDEX idx_disputes_status ON disputes(status);
CREATE INDEX idx_disputes_window_end ON disputes(dispute_window_end) WHERE status = 'open';

COMMENT ON TABLE disputes IS 'Dispute records for contested oracle attestations.';

-- =============================================================================
-- SETTLEMENT JOBS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS settlement_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Job type
    job_type VARCHAR(32) NOT NULL CHECK (job_type IN (
        'trade_settlement',
        'payout',
        'stake_deposit',
        'stake_withdrawal',
        'slash'
    )),
    -- References
    fill_id UUID REFERENCES fills(id),
    stake_id UUID REFERENCES stakes(id),
    market_id VARCHAR(64) REFERENCES markets(id),
    user_id UUID REFERENCES users(id),
    -- Amount in zatoshi
    amount_zat BIGINT NOT NULL,
    -- Privacy: Transaction type (shielded by default)
    tx_type VARCHAR(16) DEFAULT 'shielded' CHECK (tx_type IN ('shielded', 'transparent', 'deshield')),
    -- Address references (NOT actual addresses - derived at runtime via KMS)
    from_address_index INTEGER,
    to_address_index INTEGER,
    -- Status
    status VARCHAR(16) DEFAULT 'pending' CHECK (status IN (
        'pending',
        'processing',
        'submitted',
        'confirmed',
        'failed',
        'cancelled'
    )),
    -- Transaction details (after submission)
    tx_hash VARCHAR(128),
    block_height BIGINT,
    confirmations INTEGER DEFAULT 0,
    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processing_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ
);

CREATE INDEX idx_settlement_jobs_status ON settlement_jobs(status);
CREATE INDEX idx_settlement_jobs_type ON settlement_jobs(job_type);
CREATE INDEX idx_settlement_jobs_user ON settlement_jobs(user_id);
CREATE INDEX idx_settlement_jobs_pending ON settlement_jobs(created_at) WHERE status = 'pending';

COMMENT ON TABLE settlement_jobs IS 'Settlement queue for Zcash transactions. Processed by settlement service.';
COMMENT ON COLUMN settlement_jobs.tx_type IS 'Default shielded. Transparent/deshield requires ALLOW_DESHIELD + DESHIELD_KYC flags.';

-- =============================================================================
-- LIQUIDITY POOLS TABLE (AMM state)
-- =============================================================================

CREATE TABLE IF NOT EXISTS liquidity_pools (
    market_id VARCHAR(64) PRIMARY KEY REFERENCES markets(id),
    yes_shares BIGINT DEFAULT 1000000,
    no_shares BIGINT DEFAULT 1000000,
    constant_product BIGINT DEFAULT 1000000000000,
    -- Fee configuration (basis points, 100 = 1%)
    fee_bps INTEGER DEFAULT 30,
    -- LP token tracking
    total_lp_tokens BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE liquidity_pools IS 'AMM pool state for each market. Uses constant product formula (x*y=k).';

-- =============================================================================
-- BALANCES TABLE (cached user balances)
-- =============================================================================

CREATE TABLE IF NOT EXISTS balances (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    available_zat BIGINT DEFAULT 0,
    locked_zat BIGINT DEFAULT 0,
    -- Pending deposits/withdrawals
    pending_deposit_zat BIGINT DEFAULT 0,
    pending_withdrawal_zat BIGINT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE balances IS 'Cached balances for quick access. Source of truth is on-chain.';

-- =============================================================================
-- POSITIONS TABLE (user holdings)
-- =============================================================================

CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    market_id VARCHAR(64) NOT NULL REFERENCES markets(id),
    side VARCHAR(8) NOT NULL CHECK (side IN ('yes', 'no')),
    shares BIGINT NOT NULL DEFAULT 0,
    avg_price DECIMAL(10, 8) NOT NULL,
    -- Cost basis for P&L calculation
    cost_basis_zat BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, market_id, side)
);

CREATE INDEX idx_positions_user ON positions(user_id);
CREATE INDEX idx_positions_market ON positions(market_id);

COMMENT ON TABLE positions IS 'User share holdings per market.';

-- =============================================================================
-- SEED DATA: Initial Markets
-- Migrated from existing SQLite schema
-- =============================================================================

-- Insert markets (same as existing schema)
INSERT INTO markets (id, title, description, category, region, yes_price, no_price, volume_zat, liquidity_zat, end_date, resolution_source) VALUES
-- AFRICA
('afr_001', 'Will Nigeria''s Naira trade below ₦1,500/USD by June 2026?', 'Official CBN exchange rate for Nigerian Naira against US Dollar.', 'Africa', 'Nigeria', 0.32, 0.68, 8900000000, 3400000000, '2026-06-30', 'EXAMPLE SOURCE: CBN Official Rate - verify before use'),
('afr_002', 'Will South Africa avoid Stage 6 load shedding in Q1 2026?', 'Eskom power grid stability - no Stage 6 rolling blackouts for entire quarter.', 'Africa', 'South Africa', 0.28, 0.72, 6700000000, 2800000000, '2026-03-31', 'EXAMPLE SOURCE: Eskom Load Shedding Schedule - verify before use'),
('afr_003', 'Will Kenya''s M-Pesa process over 1 trillion KES monthly by 2026?', 'Safaricom mobile money platform monthly transaction volume milestone.', 'Africa', 'Kenya', 0.71, 0.29, 15600000000, 5200000000, '2026-12-31', 'EXAMPLE SOURCE: Safaricom Annual Report - verify before use'),
('afr_004', 'Will Ethiopia complete the GERD dam filling by end of 2026?', 'Grand Ethiopian Renaissance Dam reaches full reservoir capacity.', 'Africa', 'Ethiopia', 0.45, 0.55, 23400000000, 8900000000, '2026-12-31', 'EXAMPLE SOURCE: Ethiopian Government Statement - verify before use'),
-- RUSSIA & CIS
('rus_001', 'Will Russia''s RUB/USD rate stay below 100 through 2026?', 'Russian Ruble exchange rate against US Dollar remains under 100.', 'Russia & CIS', 'Russia', 0.38, 0.62, 56700000000, 19800000000, '2026-12-31', 'EXAMPLE SOURCE: Moscow Exchange - verify before use'),
('rus_002', 'Will Gazprom resume full gas exports to EU by 2026?', 'Gazprom pipeline gas exports to European Union return to 2021 levels.', 'Russia & CIS', 'Russia', 0.12, 0.88, 89000000000, 32000000000, '2026-12-31', 'EXAMPLE SOURCE: Gazprom Reports - verify before use'),
-- CHINA
('chn_001', 'Will China''s GDP growth exceed 5% in 2026?', 'Official NBS reported annual GDP growth rate for 2026.', 'China', 'China', 0.42, 0.58, 120000000000, 45000000000, '2027-01-31', 'EXAMPLE SOURCE: NBS China - verify before use'),
('chn_002', 'Will BYD outsell Tesla globally in 2026?', 'BYD total vehicle deliveries exceed Tesla worldwide deliveries.', 'China', 'China', 0.67, 0.33, 234000000000, 89000000000, '2027-01-15', 'EXAMPLE SOURCE: Company Reports - verify before use'),
('chn_003', 'Will Taiwan Semiconductor (TSMC) begin 2nm chip production in 2026?', 'TSMC starts mass production of 2nm process node chips.', 'China', 'Taiwan', 0.78, 0.22, 89000000000, 34500000000, '2026-12-31', 'EXAMPLE SOURCE: TSMC Announcements - verify before use'),
-- JAPAN
('jpn_001', 'Will Bank of Japan raise interest rates above 0.5% in 2026?', 'BOJ policy rate increase beyond current levels.', 'Japan', 'Japan', 0.61, 0.39, 56700000000, 23400000000, '2026-12-31', 'EXAMPLE SOURCE: BOJ Policy Statements - verify before use'),
('jpn_002', 'Will USD/JPY trade below ¥140 by mid-2026?', 'Japanese Yen strengthens against US Dollar.', 'Japan', 'Japan', 0.44, 0.56, 78900000000, 31200000000, '2026-06-30', 'EXAMPLE SOURCE: Forex Markets - verify before use'),
-- SOUTHEAST ASIA
('sea_001', 'Will Indonesia''s new capital Nusantara open government offices in 2026?', 'Indonesian government ministries begin operations in new capital city.', 'Southeast Asia', 'Indonesia', 0.48, 0.52, 12300000000, 4500000000, '2026-12-31', 'EXAMPLE SOURCE: Indonesian Government - verify before use'),
('sea_002', 'Will Thailand legalize casino resorts in 2026?', 'Thai parliament passes entertainment complex legislation.', 'Southeast Asia', 'Thailand', 0.55, 0.45, 23400000000, 8900000000, '2026-12-31', 'EXAMPLE SOURCE: Thai Parliament Records - verify before use'),
-- MIDDLE EAST
('mea_001', 'Will Saudi Arabia''s NEOM city welcome first residents in 2026?', 'NEOM The Line or other zones receive permanent residents.', 'Middle East', 'Saudi Arabia', 0.25, 0.75, 45600000000, 17800000000, '2026-12-31', 'EXAMPLE SOURCE: NEOM Official - verify before use'),
-- LATIN AMERICA
('latam_001', 'Will Argentina''s annual inflation drop below 50% in 2026?', 'INDEC reported year-over-year inflation rate.', 'Latin America', 'Argentina', 0.42, 0.58, 56700000000, 21300000000, '2026-12-31', 'EXAMPLE SOURCE: INDEC Argentina - verify before use'),
-- SOUTH ASIA
('ind_001', 'Will India''s GDP surpass Japan to become world''s 4th largest in 2026?', 'India nominal GDP exceeds Japan in IMF rankings.', 'South Asia', 'India', 0.82, 0.18, 145000000000, 56700000000, '2027-01-31', 'EXAMPLE SOURCE: IMF World Economic Outlook - verify before use'),
('ind_002', 'Will Reliance Jio launch satellite internet in India by 2026?', 'Jio satellite broadband service commercially available.', 'South Asia', 'India', 0.58, 0.42, 23400000000, 8900000000, '2026-12-31', 'EXAMPLE SOURCE: Reliance Announcements - verify before use')
ON CONFLICT (id) DO NOTHING;

-- Initialize liquidity pools for all markets
INSERT INTO liquidity_pools (market_id, yes_shares, no_shares, constant_product)
SELECT id, 1000000, 1000000, 1000000000000 FROM markets
ON CONFLICT (market_id) DO NOTHING;

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stakes_updated_at BEFORE UPDATE ON stakes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_liquidity_pools_updated_at BEFORE UPDATE ON liquidity_pools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_balances_updated_at BEFORE UPDATE ON balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON positions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- GRANTS (for application user)
-- =============================================================================

-- TODO: In production, create a separate application user with limited privileges
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO soko_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO soko_app;

