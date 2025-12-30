import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import CategoryFilter from './components/CategoryFilter';
import MarketCard from './components/MarketCard';
import TradeModal from './components/TradeModal';
import Portfolio from './components/Portfolio';
import api from './services/api';
import './App.css';

const categories = [
  { id: 'all', name: 'All Markets', icon: 'Grid' },
  { id: 'Economy', name: 'Economy', icon: 'TrendingUp' },
  { id: 'Sports', name: 'Sports', icon: 'Trophy' },
  { id: 'Technology', name: 'Technology', icon: 'Cpu' },
  { id: 'Finance', name: 'Finance', icon: 'Landmark' },
  { id: 'Infrastructure', name: 'Infrastructure', icon: 'Building2' },
];

function App() {
  const [wallet, setWallet] = useState({
    connected: false,
    userId: null,
    address: '',
    shieldedAddress: '',
    viewingKey: '',
    balance: 0,
  });

  const [markets, setMarkets] = useState([]);
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
      setMarkets(data.markets || []);
    } catch (error) {
      console.error('Failed to fetch markets:', error);
      // Use fallback data if backend is not available
      setMarkets([]);
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

      // Update wallet balance
      setWallet(prev => ({
        ...prev,
        balance: balanceData.balance.available,
      }));
    } catch (error) {
      console.error('Failed to fetch portfolio:', error);
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
      // Try to get saved viewing key from localStorage
      const savedKey = localStorage.getItem('soko_viewing_key');
      const data = await api.connectWallet(savedKey);

      if (data.success) {
        // Save viewing key for reconnection
        localStorage.setItem('soko_viewing_key', data.user.viewingKey);

        setWallet({
          connected: true,
          userId: data.user.id,
          address: data.user.transparentAddress,
          shieldedAddress: data.user.shieldedAddress,
          viewingKey: data.user.viewingKey,
          balance: data.balance.available,
        });
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      alert('Failed to connect wallet. Is the backend running?');
    }
  };

  const handleRequestFaucet = async () => {
    if (!wallet.userId) return;

    try {
      const result = await api.requestFaucet(wallet.userId, 5.0);
      if (result.success) {
        setWallet(prev => ({
          ...prev,
          balance: result.newBalance,
        }));
        alert(`Credited ${result.credited} testnet ZEC!\nTx: ${result.txHash}`);
        fetchPortfolio();
      }
    } catch (error) {
      console.error('Faucet request failed:', error);
      alert('Failed to request testnet ZEC');
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
        // Refresh data
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
      (m) => m.category.toLowerCase() === activeCategory.toLowerCase()
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
                  : 'Running in offline mode - Backend not connected to Zcash network'
                }
              </span>
            </div>
          )}

          {/* Trending Section */}
          {trendingMarkets.length > 0 && (
            <section className="section trending-section">
              <div className="section-header">
                <h2>🔥 Trending Markets</h2>
                <p>Most active predictions in Kenya right now</p>
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
              <h2>All Markets</h2>
              <p>Browse and trade on Kenyan prediction markets</p>
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
                <p>No markets found. Start the backend server to load markets.</p>
                <code>cd backend && npm run dev</code>
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
            <p>Kenya's first privacy-focused prediction market</p>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <h4>Platform</h4>
              <a href="#markets">Markets</a>
              <a href="#portfolio">Portfolio</a>
              <a href="#learn">Learn</a>
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
          <p>Built with Zcash 🛡️ • Hakuna Matata, Hakuna Surveillance</p>
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
