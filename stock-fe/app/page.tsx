export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="pink_container">
        <div className="tag">Blockchain Trading</div>
        <h1 className="heading">
          Trade Real Stocks as Crypto Tokens
        </h1>
        <p className="sub-heading">
          Experience the future of stock trading with decentralized finance technology.
          Real-time prices, zero KYC, and full ownership of your assets.
        </p>

        <div className="search-form">
          <input
            type="text"
            placeholder="Search stocks (AAPL, TSLA, GOOGL...)"
            className="search-input"
          />
          <button className="search-btn">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      </section>

      {/* Featured Stocks Section */}
      <section className="section_container">
        <h2 className="text-30-bold text-center mb-10">Popular Stock Tokens</h2>

        <div className="stock-grid">
          {/* Apple Stock Card */}
          <div className="crypto-card">
            <div className="flex-between mb-4">
              <div>
                <h3 className="text-24-black">Apple Inc.</h3>
                <p className="text-16-medium text-gray-600">AAPL</p>
              </div>
              <div className="text-right">
                <p className="crypto-price">$175.43</p>
                <p className="crypto-change crypto-change-positive">+2.34%</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="trade-button flex-1">Buy</button>
              <button className="trade-button flex-1 bg-secondary text-black">Sell</button>
            </div>
          </div>

          {/* Tesla Stock Card */}
          <div className="crypto-card">
            <div className="flex-between mb-4">
              <div>
                <h3 className="text-24-black">Tesla Inc.</h3>
                <p className="text-16-medium text-gray-600">TSLA</p>
              </div>
              <div className="text-right">
                <p className="crypto-price">$248.50</p>
                <p className="crypto-change crypto-change-negative">-1.23%</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="trade-button flex-1">Buy</button>
              <button className="trade-button flex-1 bg-secondary text-black">Sell</button>
            </div>
          </div>

          {/* Google Stock Card */}
          <div className="crypto-card">
            <div className="flex-between mb-4">
              <div>
                <h3 className="text-24-black">Alphabet Inc.</h3>
                <p className="text-16-medium text-gray-600">GOOGL</p>
              </div>
              <div className="text-right">
                <p className="crypto-price">$138.21</p>
                <p className="crypto-change crypto-change-positive">+0.87%</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="trade-button flex-1">Buy</button>
              <button className="trade-button flex-1 bg-secondary text-black">Sell</button>
            </div>
          </div>

          {/* Microsoft Stock Card */}
          <div className="crypto-card">
            <div className="flex-between mb-4">
              <div>
                <h3 className="text-24-black">Microsoft Corp.</h3>
                <p className="text-16-medium text-gray-600">MSFT</p>
              </div>
              <div className="text-right">
                <p className="crypto-price">$378.91</p>
                <p className="crypto-change crypto-change-positive">+1.45%</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="trade-button flex-1">Buy</button>
              <button className="trade-button flex-1 bg-secondary text-black">Sell</button>
            </div>
          </div>

          {/* Amazon Stock Card */}
          <div className="crypto-card">
            <div className="flex-between mb-4">
              <div>
                <h3 className="text-24-black">Amazon.com Inc.</h3>
                <p className="text-16-medium text-gray-600">AMZN</p>
              </div>
              <div className="text-right">
                <p className="crypto-price">$127.74</p>
                <p className="crypto-change crypto-change-negative">-0.92%</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="trade-button flex-1">Buy</button>
              <button className="trade-button flex-1 bg-secondary text-black">Sell</button>
            </div>
          </div>

          {/* NVIDIA Stock Card */}
          <div className="crypto-card">
            <div className="flex-between mb-4">
              <div>
                <h3 className="text-24-black">NVIDIA Corp.</h3>
                <p className="text-16-medium text-gray-600">NVDA</p>
              </div>
              <div className="text-right">
                <p className="crypto-price">$459.89</p>
                <p className="crypto-change crypto-change-positive">+3.21%</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="trade-button flex-1">Buy</button>
              <button className="trade-button flex-1 bg-secondary text-black">Sell</button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="section_container bg-primary/5">
        <h2 className="text-30-bold text-center mb-10">Why CryptoStock?</h2>

        <div className="card_grid">
          <div className="crypto-card">
            <h3 className="text-24-black mb-3">Real-Time Prices</h3>
            <p className="text-16-medium text-gray-600">
              Powered by Pyth Network oracle for accurate, real-time stock price feeds
            </p>
          </div>

          <div className="crypto-card">
            <h3 className="text-24-black mb-3">Zero KYC Required</h3>
            <p className="text-16-medium text-gray-600">
              Trade anonymously without identity verification procedures
            </p>
          </div>

          <div className="crypto-card">
            <h3 className="text-24-black mb-3">Full Ownership</h3>
            <p className="text-16-medium text-gray-600">
              Your tokens are truly yours - held in your personal wallet
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}