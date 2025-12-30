# Zcash Community Grant Application

## Soko Tabiri: Privacy-Preserving Prediction Markets for Kenya

---

### **Application Name**
Soko Tabiri - Kenya's First Zcash-Powered Prediction Market

---

### **Applicant Name/Organization**
[Your Name / Organization]

---

### **Contact Email**
[Your Email]

---

### **Project Summary**
Soko Tabiri ("Market Prediction" in Swahili) is a privacy-preserving prediction market platform built on Zcash, targeting the Kenyan market. Unlike existing prediction markets (e.g., Polymarket) that operate on transparent blockchains where all bets are publicly visible, Soko Tabiri leverages Zcash's shielded transactions to protect user privacy—critical for politically and economically sensitive predictions in emerging markets.

---

### **Problem Statement**

**1. Public Prediction Markets Expose Users**
Existing platforms like Polymarket run on Polygon/Ethereum where every transaction is permanently public. Users betting on elections, economic policies, or controversial topics face:
- Social and political exposure
- Front-running by sophisticated traders
- Potential retaliation in regions with political instability

**2. African Markets Are Underserved**
No major prediction market focuses on African events. Kenyans interested in predicting outcomes for:
- Elections and political events
- Economic indicators (inflation, exchange rates)
- Sports (Harambee Stars, Safari Rally)
- Infrastructure projects

...must use platforms designed for US/EU markets with no local relevance.

**3. Financial Privacy Is Essential in Emerging Markets**
In Kenya and similar markets:
- Political betting can have social consequences
- Economic predictions may reveal business intelligence
- Users need privacy to participate honestly without fear

---

### **Proposed Solution**

Build a fully functional prediction market on Zcash that:

1. **Uses Shielded Transactions** - All trades are z-to-z transactions, hiding sender, receiver, and amounts
2. **Focuses on Kenyan/African Markets** - Locally relevant prediction categories
3. **Implements AMM Trading** - Constant Product Market Maker for liquidity
4. **Provides Mobile-First UX** - Accessible via web and mobile browsers
5. **Integrates with Zcash Wallets** - Compatible with Zashi, Ywallet, Nighthawk

---

### **Technical Approach**

| Component | Technology | Status |
|-----------|------------|--------|
| Frontend | React + Vite | ✅ Complete (MVP) |
| Backend API | Node.js + Express | ✅ Complete (MVP) |
| Database | SQLite (dev) → PostgreSQL (prod) | ✅ Complete |
| Zcash Integration | lightwalletd gRPC | ✅ Prototype |
| Market Maker | CPMM (Uniswap-style) | ✅ Complete |
| Wallet Integration | Viewing keys + z-addresses | 🔄 In Progress |

**Architecture:**
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React Frontend │────▶│  Express API    │────▶│  lightwalletd   │
│   (Mobile-first) │     │  + SQLite/PG    │     │  (Zcash node)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌─────────────────┐
                        │   AMM Engine    │
                        │   (CPMM)        │
                        └─────────────────┘
```

---

### **Milestones & Deliverables**

#### **Phase 1: Core Platform (Months 1-2)** - $15,000
- [ ] Production-ready Zcash wallet integration
- [ ] Shielded deposit/withdrawal flows
- [ ] Transaction monitoring and confirmation
- [ ] Security audit of smart contract logic
- [ ] Testnet deployment

**Deliverables:**
- Working testnet deployment
- Documentation for Zcash integration
- Open-source codebase

#### **Phase 2: Market Operations (Months 3-4)** - $10,000
- [ ] Market creation interface
- [ ] Oracle system for market resolution
- [ ] Liquidity provider incentives
- [ ] Mobile-optimized PWA
- [ ] Kenyan market curation

**Deliverables:**
- 10+ active Kenyan prediction markets
- Market resolution system
- LP rewards mechanism

#### **Phase 3: Launch & Growth (Months 5-6)** - $10,000
- [ ] Mainnet deployment
- [ ] User onboarding campaign (Kenya-focused)
- [ ] Partnerships with Kenyan crypto communities
- [ ] M-Pesa integration research (fiat on-ramp)
- [ ] Performance optimization

**Deliverables:**
- Public mainnet launch
- 100+ active users
- Community documentation

---

### **Budget Breakdown**

| Category | Amount (USD) | Details |
|----------|--------------|---------|
| Development | $20,000 | 2 developers × 6 months part-time |
| Infrastructure | $5,000 | Servers, lightwalletd node, database |
| Security Audit | $5,000 | Third-party code review |
| Community/Marketing | $3,000 | Kenya crypto community outreach |
| Contingency | $2,000 | Unexpected costs |
| **Total** | **$35,000** | |

---

### **Team**

**[Your Name]** - Project Lead
- [Your background, relevant experience]
- [GitHub profile]
- [Previous Zcash/crypto experience if any]

**[Additional team members if applicable]**

---

### **Why Zcash?**

1. **Privacy by Default** - Shielded transactions are essential for politically sensitive predictions
2. **Low Fees** - 0.0001 ZEC per transaction makes micro-betting viable
3. **Viewing Keys** - Enables selective disclosure for compliance/auditing
4. **Established Infrastructure** - lightwalletd, mobile wallets, and developer tools exist
5. **Mission Alignment** - Financial privacy is a human right, especially in emerging markets

---

### **Differentiation from Existing Solutions**

| Feature | Polymarket | Augur | Soko Tabiri |
|---------|------------|-------|-------------|
| Privacy | ❌ Public | ❌ Public | ✅ Shielded |
| African Markets | ❌ No | ❌ No | ✅ Yes |
| Low Fees | ⚠️ Variable | ❌ High | ✅ ~0.0001 ZEC |
| Mobile-First | ⚠️ Partial | ❌ No | ✅ Yes |
| Blockchain | Polygon | Ethereum | Zcash |

---

### **Success Metrics**

| Metric | 3 Months | 6 Months | 12 Months |
|--------|----------|----------|-----------|
| Active Users | 50 | 200 | 1,000 |
| Markets Created | 10 | 30 | 100 |
| Trading Volume (ZEC) | 100 | 1,000 | 10,000 |
| GitHub Stars | 25 | 100 | 500 |

---

### **Open Source Commitment**

All code will be released under MIT license:
- Frontend: React application
- Backend: Node.js API server
- Documentation: Integration guides for Zcash developers

Repository: [GitHub link to soko-tabiri]

---

### **Risks & Mitigations**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Low user adoption | Medium | Partner with Kenyan crypto communities, focus on relevant markets |
| Regulatory uncertainty | Medium | Start with non-political markets, implement viewing keys for compliance |
| Technical challenges with Zcash integration | Low | MVP already working, lightwalletd well-documented |
| Market manipulation | Medium | Implement trading limits, liquidity requirements |

---

### **Long-Term Vision**

1. **Expand to other African markets** - Nigeria, South Africa, Ghana
2. **Mobile app** - Native iOS/Android with Zcash SDK
3. **Fiat on-ramps** - M-Pesa, Airtel Money integration
4. **Decentralized governance** - Community-driven market creation and resolution

---

### **Links & Resources**

- **GitHub Repository**: [Link to repo]
- **Live Demo (Testnet)**: [Link if deployed]
- **Technical Documentation**: [Link to docs]
- **Team LinkedIn/Twitter**: [Links]

---

### **Additional Information**

This project directly advances Zcash adoption by:
1. Creating a real-world use case for shielded transactions
2. Introducing Zcash to the Kenyan/African market
3. Demonstrating Zcash's advantages over transparent chains
4. Building open-source infrastructure other developers can use

We believe prediction markets are a killer app for privacy-preserving cryptocurrencies, and Africa is an underserved market ready for innovation.

---

**Submitted by:** [Your Name]  
**Date:** [Current Date]  
**Requested Amount:** $35,000 USD (in ZEC)

---

*"Hakuna Matata, Hakuna Surveillance"* 🛡️

