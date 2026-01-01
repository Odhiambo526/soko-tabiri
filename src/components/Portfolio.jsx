import { motion } from 'framer-motion';
import { Zap, TrendingUp, TrendingDown, PieChart } from 'lucide-react';

export default function Portfolio({ portfolio, markets }) {
  const getMarketById = (id) => markets.find(m => m.id === id);

  return (
    <motion.div
      className="portfolio"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h2>Your Portfolio</h2>

      <div className="portfolio-stats">
        <div className="stat-card balance">
          <div className="stat-icon">
            <Zap size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">ZEC Balance</span>
            <span className="stat-value">{portfolio.balance.toFixed(4)}</span>
          </div>
        </div>

        <div className="stat-card value">
          <div className="stat-icon">
            <PieChart size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Portfolio Value</span>
            <span className="stat-value">{portfolio.totalValue.toFixed(4)} ZEC</span>
          </div>
        </div>

        <div className="stat-card pnl">
          <div className="stat-icon">
            {portfolio.pnl >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
          </div>
          <div className="stat-info">
            <span className="stat-label">Total P&L</span>
            <span className={`stat-value ${portfolio.pnl >= 0 ? 'positive' : 'negative'}`}>
              {portfolio.pnl >= 0 ? '+' : ''}{portfolio.pnl.toFixed(4)} ZEC
              <span className="pnl-percent">({portfolio.pnlPercent}%)</span>
            </span>
          </div>
        </div>
      </div>

      <div className="positions-section">
        <h3>Open Positions</h3>
        {portfolio.positions && portfolio.positions.length > 0 ? (
          <div className="positions-list">
            {portfolio.positions.map((position, index) => {
              // Calculate P&L based on cost basis and current value
              const currentValue = position.currentValue || position.costBasis;
              const pnl = currentValue - position.costBasis;
              const pnlPercent = position.costBasis > 0 
                ? ((pnl / position.costBasis) * 100).toFixed(1)
                : 0;

              return (
                <motion.div
                  key={`${position.marketId}-${position.side}`}
                  className="position-card"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="position-header">
                    <span className={`side-badge ${position.side}`}>
                      {position.side.toUpperCase()}
                    </span>
                    <span className="shares">{position.shares} shares</span>
                  </div>
                  <h4 className="position-title">{position.marketTitle}</h4>
                  <div className="position-details">
                    <div className="detail">
                      <span className="label">Avg Price</span>
                      <span className="value">{((position.avgPrice || 0) * 100).toFixed(1)}¢</span>
                    </div>
                    <div className="detail">
                      <span className="label">Current</span>
                      <span className="value">{((position.currentPrice || 0) * 100).toFixed(1)}¢</span>
                    </div>
                    <div className="detail">
                      <span className="label">Cost</span>
                      <span className="value">{(position.costBasis || 0).toFixed(2)} ZEC</span>
                    </div>
                    <div className="detail">
                      <span className="label">P&L</span>
                      <span className={`value ${pnl >= 0 ? 'positive' : 'negative'}`}>
                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} ZEC ({pnlPercent}%)
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="no-positions">
            <p>No open positions yet. Start trading to build your portfolio!</p>
          </div>
        )}
      </div>

      <style>{`
        .portfolio {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          padding: 1.5rem;
        }

        .portfolio h2 {
          font-size: 1.5rem;
          margin-bottom: 1.5rem;
          color: var(--text-primary);
        }

        .portfolio-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.25rem;
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: 12px;
        }

        .stat-icon {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
        }

        .stat-card.balance .stat-icon {
          background: rgba(244, 183, 40, 0.1);
          color: var(--zcash-gold);
        }

        .stat-card.value .stat-icon {
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
        }

        .stat-card.pnl .stat-icon {
          background: rgba(34, 197, 94, 0.1);
          color: var(--yes-green);
        }

        .stat-info {
          display: flex;
          flex-direction: column;
        }

        .stat-label {
          font-size: 0.8rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .stat-value.positive {
          color: var(--yes-green);
        }

        .stat-value.negative {
          color: var(--no-red);
        }

        .pnl-percent {
          font-size: 0.9rem;
          font-weight: 500;
          margin-left: 0.25rem;
        }

        .positions-section h3 {
          font-size: 1.1rem;
          margin-bottom: 1rem;
          color: var(--text-secondary);
        }

        .positions-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .position-card {
          padding: 1.25rem;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          transition: all 0.2s ease;
        }

        .position-card:hover {
          border-color: var(--border-accent);
        }

        .position-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.75rem;
        }

        .side-badge {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 0.25rem 0.6rem;
          border-radius: 4px;
          letter-spacing: 0.05em;
        }

        .side-badge.yes {
          background: rgba(34, 197, 94, 0.1);
          color: var(--yes-green);
        }

        .side-badge.no {
          background: rgba(239, 68, 68, 0.1);
          color: var(--no-red);
        }

        .shares {
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .position-title {
          font-size: 0.95rem;
          font-weight: 500;
          color: var(--text-primary);
          margin-bottom: 1rem;
          line-height: 1.4;
        }

        .position-details {
          display: flex;
          gap: 1.5rem;
          flex-wrap: wrap;
        }

        .detail {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .detail .label {
          font-size: 0.75rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .detail .value {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .detail .value.positive {
          color: var(--yes-green);
        }

        .detail .value.negative {
          color: var(--no-red);
        }

        .no-positions {
          text-align: center;
          padding: 2rem;
          background: var(--bg-secondary);
          border: 1px dashed var(--border-color);
          border-radius: 12px;
        }

        .no-positions p {
          color: var(--text-muted);
        }
      `}</style>
    </motion.div>
  );
}
