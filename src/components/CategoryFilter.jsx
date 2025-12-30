import { motion } from 'framer-motion';
import { Grid, TrendingUp, Trophy, Cpu, Landmark, Building2 } from 'lucide-react';

const iconMap = {
  Grid,
  TrendingUp,
  Trophy,
  Cpu,
  Landmark,
  Building2,
};

export default function CategoryFilter({ categories, activeCategory, onCategoryChange }) {
  return (
    <div className="category-filter">
      <div className="filter-scroll">
        {categories.map((category) => {
          const Icon = iconMap[category.icon];
          const isActive = activeCategory === category.id;
          
          return (
            <motion.button
              key={category.id}
              className={`filter-btn ${isActive ? 'active' : ''}`}
              onClick={() => onCategoryChange(category.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Icon size={18} />
              <span>{category.name}</span>
              {isActive && (
                <motion.div
                  className="active-indicator"
                  layoutId="activeCategory"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      <style>{`
        .category-filter {
          margin-bottom: 2rem;
          overflow-x: auto;
          padding-bottom: 0.5rem;
        }

        .filter-scroll {
          display: flex;
          gap: 0.75rem;
          min-width: max-content;
        }

        .filter-btn {
          position: relative;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          color: var(--text-secondary);
          font-size: 0.9rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .filter-btn:hover {
          border-color: var(--border-accent);
          color: var(--text-primary);
        }

        .filter-btn.active {
          background: rgba(244, 183, 40, 0.1);
          border-color: var(--zcash-gold);
          color: var(--zcash-gold);
        }

        .active-indicator {
          position: absolute;
          inset: -1px;
          border: 2px solid var(--zcash-gold);
          border-radius: 12px;
          pointer-events: none;
        }

        @media (max-width: 768px) {
          .filter-btn {
            padding: 0.6rem 1rem;
            font-size: 0.85rem;
          }
        }
      `}</style>
    </div>
  );
}

