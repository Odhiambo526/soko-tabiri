import { motion } from 'framer-motion';
import { TrendingUp, Users, Clock, Zap } from 'lucide-react';

export default function MarketCard({ market, onSelect, index }) {
  const formatCurrency = (amount) => {
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toString();
  };

  const daysRemaining = () => {
    const end = new Date(market.endDate);
    const now = new Date();
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const getCategoryColor = (category) => {
    const colors = {
      Economy: '#f4b728',
      Sports: '#22c55e',
      Technology: '#3b82f6',
      Finance: '#8b5cf6',
      Infrastructure: '#ec4899',
    };
    return colors[category] || '#6b7280';
  };

  return (
    <motion.div
      className="market-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -4 }}
      onClick={() => onSelect(market)}
    >
      <div className="card-header">
        <span 
          className="category-badge"
          style={{ 
            background: `${getCategoryColor(market.category)}15`,
            color: getCategoryColor(market.category),
            borderColor: `${getCategoryColor(market.category)}30`
          }}
        >
          {market.category}
        </span>
        {market.trending && (
          <span className="trending-badge">
            <TrendingUp size={12} />
            Trending
          </span>
        )}
      </div>

      <h3 className="card-title">{market.title}</h3>
      
      <p className="card-description">{market.description}</p>

      <div className="price-section">
        <div className="price-bar">
          <div 
            className="yes-fill" 
            style={{ width: `${market.yesPrice * 100}%` }}
          />
        </div>
        <div className="price-labels">
          <div className="price-item yes">
            <span className="price-label">Yes</span>
            <span className="price-value">{(market.yesPrice * 100).toFixed(0)}¢</span>
          </div>
          <div className="price-item no">
            <span className="price-label">No</span>
            <span className="price-value">{(market.noPrice * 100).toFixed(0)}¢</span>
          </div>
        </div>
      </div>

      <div className="card-footer">
        <div className="stat">
          <Zap size={14} />
          <span>{formatCurrency(market.volume)} ZEC</span>
        </div>
        <div className="stat">
          <Users size={14} />
          <span>{market.participants}</span>
        </div>
        <div className="stat">
          <Clock size={14} />
          <span>{daysRemaining()}d left</span>
        </div>
      </div>

      <style>{`
        .market-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 1.5rem;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .market-card:hover {
          border-color: var(--zcash-gold);
          box-shadow: 0 8px 32px rgba(244, 183, 40, 0.1);
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }

        .category-badge {
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.35rem 0.75rem;
          border-radius: 20px;
          border: 1px solid;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .trending-badge {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.7rem;
          font-weight: 600;
          padding: 0.3rem 0.6rem;
          background: rgba(34, 197, 94, 0.1);
          color: var(--yes-green);
          border-radius: 20px;
        }

        .card-title {
          font-size: 1.1rem;
          font-weight: 600;
          line-height: 1.4;
          color: var(--text-primary);
        }

        .card-description {
          font-size: 0.85rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .price-section {
          margin-top: auto;
        }

        .price-bar {
          height: 8px;
          background: var(--no-red);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 0.75rem;
        }

        .yes-fill {
          height: 100%;
          background: var(--yes-green);
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .price-labels {
          display: flex;
          justify-content: space-between;
        }

        .price-item {
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
        }

        .price-item.no {
          text-align: right;
        }

        .price-label {
          font-size: 0.75rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .price-value {
          font-size: 1.25rem;
          font-weight: 700;
        }

        .price-item.yes .price-value {
          color: var(--yes-green);
        }

        .price-item.no .price-value {
          color: var(--no-red);
        }

        .card-footer {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border-color);
        }

        .stat {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .stat svg {
          color: var(--text-muted);
        }
      `}</style>
    </motion.div>
  );
}

