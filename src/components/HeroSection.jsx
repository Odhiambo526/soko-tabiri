import { motion } from 'framer-motion';
import { Shield, Zap, Globe, Lock } from 'lucide-react';

export default function HeroSection() {
  return (
    <section className="hero">
      <div className="hero-bg">
        <div className="gradient-orb orb-1" />
        <div className="gradient-orb orb-2" />
        <div className="gradient-orb orb-3" />
        <div className="pattern-overlay" />
      </div>

      <div className="hero-content">
        <motion.div
          className="hero-badge"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Shield size={14} />
          <span>Private Predictions on Zcash</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Global Markets,
          <br />
          <span className="highlight">Zero Exposure</span>
        </motion.h1>

        <motion.p
          className="hero-subtitle"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          Trade on Africa, China, Japan, Russia & emerging markets. 
          Shielded by Zcash—your positions stay private.
        </motion.p>

        <motion.div
          className="hero-features"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="feature">
            <Lock size={18} />
            <span>Shielded Transactions</span>
          </div>
          <div className="feature">
            <Zap size={18} />
            <span>Low Fees</span>
          </div>
          <div className="feature">
            <Globe size={18} />
            <span>Emerging Markets</span>
          </div>
        </motion.div>

        <motion.div
          className="region-tags"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <span className="region-tag">Africa</span>
          <span className="region-tag">China</span>
          <span className="region-tag">Japan</span>
          <span className="region-tag">Russia</span>
          <span className="region-tag">Southeast Asia</span>
          <span className="region-tag">Middle East</span>
          <span className="region-tag">Latin America</span>
          <span className="region-tag">South Asia</span>
        </motion.div>
      </div>

      <style>{`
        .hero {
          position: relative;
          padding: 4rem 1.5rem;
          overflow: hidden;
          border-bottom: 1px solid var(--border-color);
        }

        .hero-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .gradient-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.4;
        }

        .orb-1 {
          width: 400px;
          height: 400px;
          background: #1a5f2a;
          top: -100px;
          left: -100px;
          opacity: 0.2;
        }

        .orb-2 {
          width: 300px;
          height: 300px;
          background: var(--zcash-gold);
          top: 50%;
          right: 10%;
          transform: translateY(-50%);
          opacity: 0.15;
        }

        .orb-3 {
          width: 200px;
          height: 200px;
          background: #c41e3a;
          bottom: -50px;
          left: 30%;
          opacity: 0.15;
        }

        .pattern-overlay {
          position: absolute;
          inset: 0;
          background-image: 
            radial-gradient(circle at 1px 1px, var(--border-color) 1px, transparent 0);
          background-size: 40px 40px;
          opacity: 0.5;
        }

        .hero-content {
          position: relative;
          max-width: 800px;
          margin: 0 auto;
          text-align: center;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: rgba(244, 183, 40, 0.1);
          border: 1px solid rgba(244, 183, 40, 0.2);
          border-radius: 30px;
          color: var(--zcash-gold);
          font-size: 0.85rem;
          font-weight: 500;
          margin-bottom: 1.5rem;
        }

        .hero h1 {
          font-size: clamp(2.5rem, 6vw, 4rem);
          font-weight: 700;
          line-height: 1.1;
          margin-bottom: 1.5rem;
          color: var(--text-primary);
        }

        .hero h1 .highlight {
          background: linear-gradient(135deg, var(--zcash-gold), var(--zcash-gold-light));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-subtitle {
          font-size: 1.2rem;
          color: var(--text-secondary);
          max-width: 600px;
          margin: 0 auto 2rem;
          line-height: 1.6;
        }

        .hero-features {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2rem;
          flex-wrap: wrap;
          margin-bottom: 2rem;
        }

        .feature {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .feature svg {
          color: var(--zcash-gold);
        }

        .region-tags {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 0.5rem;
        }

        .region-tag {
          padding: 0.4rem 0.8rem;
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          font-size: 0.8rem;
          color: var(--text-secondary);
          transition: all 0.2s ease;
        }

        .region-tag:hover {
          border-color: var(--zcash-gold);
          color: var(--zcash-gold);
        }

        @media (max-width: 768px) {
          .hero {
            padding: 3rem 1rem;
          }

          .hero-features {
            gap: 1rem;
          }

          .feature {
            font-size: 0.8rem;
          }

          .region-tags {
            gap: 0.4rem;
          }

          .region-tag {
            font-size: 0.75rem;
            padding: 0.3rem 0.6rem;
          }
        }
      `}</style>
    </section>
  );
}
