import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import CategoryFilter from './components/CategoryFilter';
import MarketCard from './components/MarketCard';
import TradeModal from './components/TradeModal';
import Portfolio from './components/Portfolio';
import api from './services/api';
import { markets as fallbackMarkets, categories as fallbackCategories, userPortfolio as fallbackPortfolio } from './data/markets';
import './App.css';

function App() {
  const [wallet, setWallet] = useState({
    connected: false,
    userId: null,
    address: '',
    shieldedAddress: '',
    viewingKey: '',
    balance: 0,
  });

  const [markets, setMarkets] = useState(fallbackMarkets);
  const [categories] = useState(fallbackCategories);
  const [portfolio, setPortfolio] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [networkStatus, setNetworkStatus] = useState(null);

  // Fetch markets on load and category change
  useEffect(() => {
    fetchMarkets();
  }, [activeCategory]);

  // Fetch portfolio when wallet connects
  useEffect(() => {
    if (wallet.connected && wallet.userId) {
      fetchPortfolio();
    }
  }, [wallet.connected, wallet.userId]);

  // Check network status on load
  useEffect(() => {
    checkNetworkStatus();
  }, []);

  const fetchMarkets = async () => {
    try {
      setLoading(true);
      const data = await api.getMarkets(activeCategory);
      if (data.markets && data.markets.length > 0) {
        setMarkets(data.markets);
      } else {
        setMarkets(fallbackMarkets);
      }
    } catch (error) {
      console.error('Failed to fetch markets:', error);
      setMarkets(fallbackMarkets);
    } finally {
      setLoading(false);
    }
  };

  const fetchPortfolio = async () => {
    try {
      const [positionsData, balanceData] = await Promise.all([
        api.getPositions(wallet.userId),
        api.getBalance(wallet.userId),
      ]);

      setPortfolio({
        balance: balanceData.balance.available,
        positions: positionsData.positions,
        totalValue: positionsData.summary.totalValue,
        pnl: positionsData.summary.pnl,
        pnlPercent: parseFloat(positionsData.summary.pnlPercent),
      });

      setWallet(prev => ({
        ...prev,
        balance: balanceData.balance.available,
      }));
    } catch (error) {
      console.error('Failed to fetch portfolio:', error);
      setPortfolio(fallbackPortfolio);
    }
  };

  const checkNetworkStatus = async () => {
    try {
      const status = await api.getNetworkStatus();
      setNetworkStatus(status);
    } catch (error) {
      console.error('Failed to check network status:', error);
    }
  };

  const handleConnectWallet = async () => {
    try {
      // Get saved key or generate a new one for demo
      let viewingKey = localStorage.getItem('soko_viewing_key');
      if (!viewingKey) {
        // Generate a random viewing key for demo purposes
        viewingKey = 'demo_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('soko_viewing_key', viewingKey);
      }
      
      const data = await api.connectWallet(viewingKey);

      if (data.success) {
        setWallet({
          connected: true,
          userId: data.user.id,
          address: data.user.transparentAddress || `t1${data.user.id.slice(0, 8)}`,
          shieldedAddress: data.user.shieldedAddress || `zs1${data.user.id.slice(0, 8)}`,
          viewingKey: data.user.viewingKey || viewingKey,
          balance: data.balance?.available || 0,
        });
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      // Try again with a fresh viewing key
      try {
        const newKey = 'demo_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('soko_viewing_key', newKey);
        const data = await api.connectWallet(newKey);
        if (data.success) {
          setWallet({
            connected: true,
            userId: data.user.id,
            address: data.user.transparentAddress || `t1${data.user.id.slice(0, 8)}`,
            shieldedAddress: data.user.shieldedAddress || `zs1${data.user.id.slice(0, 8)}`,
            viewingKey: newKey,
            balance: data.balance?.available || 0,
          });
          return;
        }
      } catch (retryError) {
        console.error('Retry failed:', retryError);
      }
      // Final fallback - alert user
      alert('Failed to connect wallet. Please check if the backend is running.');
    }
  };

  const handleRequestFaucet = async () => {
    if (!wallet.userId) return;

    try {
      const result = await api.requestFaucet(wallet.userId, 5.0);
      if (result.success) {
        // Handle both response formats
        const newBalance = result.newBalance ?? result.balance?.available ?? (wallet.balance + (result.credited || 10));
        setWallet(prev => ({
          ...prev,
          balance: newBalance,
        }));
        alert(`Credited ${result.credited || 10} testnet ZEC!\nTx: ${result.txHash || 'demo'}`);
        fetchPortfolio();
      }
    } catch (error) {
      console.error('Faucet request failed:', error);
      // Demo mode fallback
      setWallet(prev => ({
        ...prev,
        balance: (prev.balance || 0) + 5.0,
      }));
      alert('Demo mode: Credited 5 ZEC');
    }
  };

  const handleTrade = async (marketId, side, amountZec) => {
    if (!wallet.userId) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      const result = await api.executeTrade(marketId, wallet.userId, side, amountZec);
      if (result.success) {
        fetchMarkets();
        fetchPortfolio();
        setSelectedMarket(null);
        return result;
      }
    } catch (error) {
      console.error('Trade failed:', error);
      throw error;
    }
  };

  const filteredMarkets = useMemo(() => {
    if (activeCategory === 'all') return markets;
    return markets.filter(
      (m) => m.category === activeCategory
    );
  }, [activeCategory, markets]);

  const trendingMarkets = markets.filter((m) => m.trending).slice(0, 4);

  return (
    <div className="app">
      <Header 
        wallet={wallet} 
        onConnectWallet={handleConnectWallet}
        onRequestFaucet={handleRequestFaucet}
        networkStatus={networkStatus}
      />
      
      <HeroSection />

      <main className="main-content">
        <div className="container">
          {/* Network Status Banner */}
          {networkStatus && (
            <div className={`network-banner ${networkStatus.zcash?.connected ? 'connected' : 'offline'}`}>
              <span className="status-dot" />
              <span>
                {networkStatus.zcash?.connected 
                  ? `Connected to Zcash ${networkStatus.zcash.network} (Block #${networkStatus.zcash.blockHeight})`
                  : 'Demo Mode - Connect backend for live trading'
                }
              </span>
            </div>
          )}

          {/* Trending Section */}
          {trendingMarkets.length > 0 && (
            <section className="section trending-section">
              <div className="section-header">
                <h2>🔥 Trending Markets</h2>
                <p>Most active predictions across emerging markets</p>
              </div>
              <div className="markets-grid trending">
                {trendingMarkets.map((market, index) => (
                  <MarketCard
                    key={market.id}
                    market={market}
                    index={index}
                    onSelect={setSelectedMarket}
                  />
                ))}
              </div>
            </section>
          )}

          {/* All Markets Section */}
          <section className="section" id="markets">
            <div className="section-header">
              <h2>Global Markets</h2>
              <p>Trade on events in Africa, Asia, Middle East, Latin America & more</p>
            </div>

            <CategoryFilter
              categories={categories}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
            />

            {loading ? (
              <div className="loading-state">
                <div className="spinner" />
                <p>Loading markets...</p>
              </div>
            ) : filteredMarkets.length > 0 ? (
              <div className="markets-grid">
                {filteredMarkets.map((market, index) => (
                  <MarketCard
                    key={market.id}
                    market={market}
                    index={index}
                    onSelect={setSelectedMarket}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No markets found in this category.</p>
              </div>
            )}
          </section>

          {/* Portfolio Section */}
          {wallet.connected && portfolio && (
            <section className="section" id="portfolio">
              <Portfolio portfolio={portfolio} markets={markets} />
            </section>
          )}
        </div>
      </main>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span className="footer-logo">Soko Tabiri</span>
            <p>Private prediction markets for emerging economies</p>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <h4>Regions</h4>
              <a href="#markets">Africa</a>
              <a href="#markets">China & East Asia</a>
              <a href="#markets">Russia & CIS</a>
              <a href="#markets">Middle East</a>
            </div>
            <div className="footer-col">
              <h4>Resources</h4>
              <a href="https://zcash.readthedocs.io/" target="_blank" rel="noopener noreferrer">Zcash Docs</a>
              <a href="https://faucet.testnet.z.cash/" target="_blank" rel="noopener noreferrer">Testnet Faucet</a>
              <a href="#api">API</a>
            </div>
            <div className="footer-col">
              <h4>Legal</h4>
              <a href="#terms">Terms</a>
              <a href="#privacy">Privacy</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>Built with Zcash 🛡️ • Global Markets, Zero Exposure</p>
        </div>
      </footer>

      <AnimatePresence>
        {selectedMarket && (
          <TradeModal
            market={selectedMarket}
            wallet={wallet}
            onClose={() => setSelectedMarket(null)}
            onTrade={handleTrade}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
