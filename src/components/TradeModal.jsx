import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, TrendingUp, TrendingDown, AlertCircle, Shield, Loader } from 'lucide-react';
import api from '../services/api';

export default function TradeModal({ market, onClose, wallet = {}, onTrade }) {
  const [side, setSide] = useState('yes');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [trading, setTrading] = useState(false);
  const [error, setError] = useState(null);

  // Safely get wallet properties with defaults
  const safeWallet = {
    connected: wallet?.connected || false,
    balance: typeof wallet?.balance === 'number' ? wallet.balance : 0,
  };

  // Fetch quote when amount changes
  useEffect(() => {
    const fetchQuote = async () => {
      if (!amount || parseFloat(amount) <= 0) {
        setQuote(null);
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        const data = await api.getQuote(market.id, side, parseFloat(amount));
        // Handle nested quote structure from API
        const quoteData = data.quote?.quote || data.quote;
        
        // Parse values from API
        const parsedShares = parseInt(quoteData.shares) || 0;
        const amountZec = parseFloat(amount);
        const avgPricePerShare = parseFloat(quoteData.avgPrice) || 0;
        
        // Each share pays 1 ZEC if the prediction is correct
        // But shares are scaled, so we need to calculate properly
        // Max payout = shares (if each share = 1 unit of value)
        // The API returns shares in internal units, we need to convert
        
        // Calculate based on the actual price paid
        // If you pay X ZEC at price P, you get X/P shares
        // If correct, each share pays 1 ZEC, so payout = X/P ZEC
        const effectivePrice = side === 'yes' ? (market?.yesPrice || 0.5) : (market?.noPrice || 0.5);
        const estimatedShares = amountZec / effectivePrice;
        const maxPayoutZec = estimatedShares; // Each share pays 1 ZEC if correct
        const profitZec = maxPayoutZec - amountZec;
        const roiPercent = amountZec > 0 ? (profitZec / amountZec) * 100 : 0;
        
        setQuote({
          shares: parsedShares,
          avgPrice: avgPricePerShare,
          newYesPrice: parseFloat(quoteData.newYesPrice) || 0,
          newNoPrice: parseFloat(quoteData.newNoPrice) || 0,
          fee: parseFloat(quoteData.fee) / 100000000 || 0,
          maxPayout: maxPayoutZec,
          potentialProfit: profitZec,
          roi: roiPercent.toFixed(2),
        });
      } catch (err) {
        console.error('Quote error:', err);
        setError('Failed to get quote');
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchQuote, 300);
    return () => clearTimeout(debounce);
  }, [amount, side, market.id]);

  const handleAmountChange = (value) => {
    setAmount(value);
    setError(null);
  };

  const handleTrade = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    
    setTrading(true);
    setError(null);

    try {
      await onTrade(market.id, side, parseFloat(amount));
      alert(`Trade successful!\n\nBought ${quote?.shares || 0} ${side.toUpperCase()} shares`);
    } catch (err) {
      setError(err.message || 'Trade failed');
    } finally {
      setTrading(false);
    }
  };

  const currentPrice = side === 'yes' ? (market?.yesPrice || 0) : (market?.noPrice || 0);
  const walletBalance = safeWallet.balance;
  const insufficientBalance = parseFloat(amount || 0) > walletBalance;

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="modal-content"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>

          <div className="modal-header">
            <span className="category-tag">{market?.category || 'Market'}</span>
            <h2>{market?.title || 'Trade'}</h2>
          </div>

          <div className="side-selector">
            <button
              className={`side-btn yes ${side === 'yes' ? 'active' : ''}`}
              onClick={() => setSide('yes')}
            >
              <TrendingUp size={20} />
              <div className="side-info">
                <span className="side-label">Yes</span>
                <span className="side-price">{((market?.yesPrice || 0) * 100).toFixed(0)}¢</span>
              </div>
            </button>
            <button
              className={`side-btn no ${side === 'no' ? 'active' : ''}`}
              onClick={() => setSide('no')}
            >
              <TrendingDown size={20} />
              <div className="side-info">
                <span className="side-label">No</span>
                <span className="side-price">{((market?.noPrice || 0) * 100).toFixed(0)}¢</span>
              </div>
            </button>
          </div>

          <div className="input-section">
            <label>Amount (ZEC)</label>
            <div className="input-wrapper">
              <Zap size={18} className="input-icon" />
              <input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                step="0.01"
                min="0"
              />
              <button 
                className="max-btn"
                onClick={() => handleAmountChange(walletBalance.toString())}
              >
                MAX
              </button>
            </div>
            <div className="balance-info">
              Balance: <span className={insufficientBalance ? 'error' : ''}>{walletBalance.toFixed(4)} ZEC</span>
            </div>
          </div>

          {loading && (
            <div className="loading-quote">
              <Loader size={16} className="spinner" />
              <span>Getting quote...</span>
            </div>
          )}

          {quote && !loading && (
            <div className="trade-summary">
              <div className="summary-row">
                <span>Shares</span>
                <span className="value">{quote.shares}</span>
              </div>
              <div className="summary-row">
                <span>Avg Price</span>
                <span className="value">{((quote.avgPrice || 0) * 100).toFixed(2)}¢ per share</span>
              </div>
              <div className="summary-row highlight">
                <span>Max Payout (if correct)</span>
                <span className="value payout">{(quote.maxPayout || 0).toFixed(4)} ZEC</span>
              </div>
              <div className="summary-row">
                <span>Potential Profit</span>
                <span className="value profit">+{(quote.potentialProfit || 0).toFixed(4)} ZEC ({quote.roi || 0}%)</span>
              </div>
              <div className="summary-row">
                <span>New Market Price</span>
                <span className="value">
                  Yes: {((quote.newYesPrice || 0) * 100).toFixed(0)}¢ / No: {((quote.newNoPrice || 0) * 100).toFixed(0)}¢
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="error-message">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="privacy-notice">
            <Shield size={16} />
            <span>Shielded transaction via Zcash - your trade is private</span>
          </div>

          <motion.button
            className={`trade-btn ${side}`}
            onClick={handleTrade}
            disabled={!amount || parseFloat(amount) <= 0 || insufficientBalance || trading || !safeWallet.connected}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            {trading ? (
              <>
                <Loader size={18} className="spinner" />
                Processing...
              </>
            ) : !safeWallet.connected ? (
              'Connect Wallet First'
            ) : (
              `Buy ${side === 'yes' ? 'Yes' : 'No'} - ${amount || '0'} ZEC`
            )}
          </motion.button>

          <p className="disclaimer">
            <AlertCircle size={14} />
            Prediction markets involve risk. Only trade what you can afford to lose.
          </p>
        </motion.div>
      </motion.div>

      <style>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          z-index: 1000;
        }

        .modal-content {
          position: relative;
          width: 100%;
          max-width: 480px;
          max-height: 90vh;
          overflow-y: auto;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          padding: 2rem;
        }

        .close-btn {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: var(--bg-elevated);
          border: none;
          border-radius: 8px;
          padding: 0.5rem;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .close-btn:hover {
          color: var(--text-primary);
          background: var(--border-accent);
        }

        .modal-header {
          margin-bottom: 1.5rem;
        }

        .category-tag {
          display: inline-block;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.3rem 0.75rem;
          background: rgba(244, 183, 40, 0.1);
          color: var(--zcash-gold);
          border-radius: 20px;
          margin-bottom: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .modal-header h2 {
          font-size: 1.25rem;
          line-height: 1.4;
          color: var(--text-primary);
        }

        .side-selector {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .side-btn {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: var(--bg-card);
          border: 2px solid var(--border-color);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .side-btn.yes:hover,
        .side-btn.yes.active {
          border-color: var(--yes-green);
          background: rgba(34, 197, 94, 0.1);
        }

        .side-btn.yes.active {
          box-shadow: 0 0 20px rgba(34, 197, 94, 0.2);
        }

        .side-btn.yes svg {
          color: var(--yes-green);
        }

        .side-btn.no:hover,
        .side-btn.no.active {
          border-color: var(--no-red);
          background: rgba(239, 68, 68, 0.1);
        }

        .side-btn.no.active {
          box-shadow: 0 0 20px rgba(239, 68, 68, 0.2);
        }

        .side-btn.no svg {
          color: var(--no-red);
        }

        .side-info {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .side-label {
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .side-price {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .input-section {
          margin-bottom: 1.5rem;
        }

        .input-section label {
          display: block;
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin-bottom: 0.5rem;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 1rem;
          color: var(--zcash-gold);
        }

        .input-wrapper input {
          width: 100%;
          padding: 1rem 1rem 1rem 3rem;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          color: var(--text-primary);
          font-size: 1.1rem;
          font-weight: 600;
          transition: all 0.2s ease;
        }

        .input-wrapper input:focus {
          outline: none;
          border-color: var(--zcash-gold);
          box-shadow: 0 0 0 3px rgba(244, 183, 40, 0.1);
        }

        .input-wrapper input::placeholder {
          color: var(--text-muted);
        }

        .max-btn {
          position: absolute;
          right: 0.75rem;
          padding: 0.4rem 0.75rem;
          background: var(--bg-elevated);
          border: 1px solid var(--border-accent);
          border-radius: 6px;
          color: var(--zcash-gold);
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .max-btn:hover {
          background: var(--zcash-gold);
          color: var(--kenyan-black);
        }

        .balance-info {
          margin-top: 0.5rem;
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .balance-info span {
          color: var(--zcash-gold);
          font-weight: 600;
        }

        .balance-info span.error {
          color: var(--no-red);
        }

        .loading-quote {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 1rem;
          color: var(--text-muted);
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .trade-summary {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 1rem;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0;
          font-size: 0.9rem;
          color: var(--text-secondary);
        }

        .summary-row .value {
          color: var(--text-primary);
          font-weight: 500;
        }

        .summary-row.highlight {
          border-top: 1px solid var(--border-color);
          margin-top: 0.5rem;
          padding-top: 1rem;
        }

        .summary-row .payout {
          color: var(--zcash-gold);
          font-weight: 700;
          font-size: 1rem;
        }

        .summary-row .profit {
          color: var(--yes-green);
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          margin-bottom: 1rem;
          font-size: 0.85rem;
          color: var(--no-red);
        }

        .privacy-notice {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: rgba(244, 183, 40, 0.05);
          border: 1px solid rgba(244, 183, 40, 0.2);
          border-radius: 8px;
          margin-bottom: 1rem;
          font-size: 0.8rem;
          color: var(--zcash-gold);
        }

        .trade-btn {
          width: 100%;
          padding: 1rem;
          border: none;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .trade-btn.yes {
          background: var(--yes-green);
          color: white;
        }

        .trade-btn.yes:hover:not(:disabled) {
          box-shadow: 0 4px 20px rgba(34, 197, 94, 0.4);
        }

        .trade-btn.no {
          background: var(--no-red);
          color: white;
        }

        .trade-btn.no:hover:not(:disabled) {
          box-shadow: 0 4px 20px rgba(239, 68, 68, 0.4);
        }

        .trade-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .disclaimer {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 1rem;
          font-size: 0.75rem;
          color: var(--text-muted);
          text-align: center;
          justify-content: center;
        }
      `}</style>
    </AnimatePresence>
  );
}
