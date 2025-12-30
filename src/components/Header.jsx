import { useState } from 'react';
import { motion } from 'framer-motion';
import { Wallet, Menu, X, Shield, Zap, Droplets } from 'lucide-react';

export default function Header({ wallet, onConnectWallet, onRequestFaucet, networkStatus }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-left">
          <motion.div 
            className="logo"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="logo-icon">
              <Shield size={24} />
            </div>
            <span className="logo-text">Soko Tabiri</span>
            <span className="logo-badge">ZEC</span>
          </motion.div>
        </div>

        <nav className="nav-desktop">
          <a href="#markets" className="nav-link active">Markets</a>
          <a href="#portfolio" className="nav-link">Portfolio</a>
          <a href="#leaderboard" className="nav-link">Leaderboard</a>
          <a href="#learn" className="nav-link">Learn</a>
        </nav>

        <div className="header-right">
          {wallet.connected ? (
            <motion.div 
              className="wallet-connected"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <div className="wallet-balance">
                <Zap size={16} className="zec-icon" />
                <span>{wallet.balance.toFixed(4)} ZEC</span>
              </div>
              <div className="wallet-address" title={wallet.shieldedAddress}>
                {wallet.address.slice(0, 8)}...
              </div>
              <motion.button 
                className="faucet-btn"
                onClick={onRequestFaucet}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Get testnet ZEC"
              >
                <Droplets size={16} />
              </motion.button>
            </motion.div>
          ) : (
            <motion.button 
              className="connect-btn"
              onClick={onConnectWallet}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Wallet size={18} />
              <span>Connect Zcash</span>
            </motion.button>
          )}

          <button 
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <motion.nav 
          className="nav-mobile"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <a href="#markets" className="nav-link active">Markets</a>
          <a href="#portfolio" className="nav-link">Portfolio</a>
          <a href="#leaderboard" className="nav-link">Leaderboard</a>
          <a href="#learn" className="nav-link">Learn</a>
        </motion.nav>
      )}

      <style>{`
        .header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(13, 13, 13, 0.85);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border-color);
        }

        .header-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 1rem 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 2rem;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          text-decoration: none;
          color: var(--text-primary);
        }

        .logo-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, var(--zcash-gold), var(--zcash-gold-light));
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--kenyan-black);
        }

        .logo-text {
          font-family: 'Playfair Display', serif;
          font-size: 1.5rem;
          font-weight: 700;
          background: linear-gradient(135deg, var(--text-primary), var(--zcash-gold));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .logo-badge {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          background: var(--zcash-gold);
          color: var(--kenyan-black);
          border-radius: 4px;
          letter-spacing: 0.05em;
        }

        .nav-desktop {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .nav-link {
          padding: 0.6rem 1rem;
          color: var(--text-secondary);
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 500;
          border-radius: 8px;
          transition: all 0.2s ease;
        }

        .nav-link:hover {
          color: var(--text-primary);
          background: var(--bg-elevated);
        }

        .nav-link.active {
          color: var(--zcash-gold);
          background: rgba(244, 183, 40, 0.1);
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .connect-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          background: linear-gradient(135deg, var(--zcash-gold), var(--zcash-gold-light));
          color: var(--kenyan-black);
          border: none;
          border-radius: 10px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .connect-btn:hover {
          box-shadow: 0 4px 20px rgba(244, 183, 40, 0.3);
        }

        .wallet-connected {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 0.75rem;
          background: var(--bg-elevated);
          border: 1px solid var(--border-accent);
          border-radius: 12px;
        }

        .wallet-balance {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-weight: 600;
          color: var(--zcash-gold);
        }

        .zec-icon {
          color: var(--zcash-gold);
        }

        .wallet-address {
          font-size: 0.8rem;
          color: var(--text-muted);
          font-family: monospace;
          padding: 0.25rem 0.5rem;
          background: var(--bg-secondary);
          border-radius: 4px;
        }

        .faucet-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 8px;
          color: #3b82f6;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .faucet-btn:hover {
          background: rgba(59, 130, 246, 0.2);
        }

        .mobile-menu-btn {
          display: none;
          background: none;
          border: none;
          color: var(--text-primary);
          cursor: pointer;
          padding: 0.5rem;
        }

        .nav-mobile {
          display: none;
          flex-direction: column;
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--border-color);
        }

        @media (max-width: 768px) {
          .nav-desktop {
            display: none;
          }

          .mobile-menu-btn {
            display: block;
          }

          .nav-mobile {
            display: flex;
          }

          .wallet-connected {
            flex-wrap: wrap;
            gap: 0.5rem;
            padding: 0.5rem;
          }

          .wallet-address {
            font-size: 0.7rem;
          }
        }
      `}</style>
    </header>
  );
}
