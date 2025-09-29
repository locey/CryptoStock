# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CryptoStock is a decentralized stock tokenization system built on Ethereum blockchain technology. The project consists of multiple components that work together to provide real-time stock token trading capabilities.

### Architecture Components

1. **CryptoStockContract/** - Solidity smart contracts using Hardhat framework
2. **StockCoinEnd/** - Go backend API service with Gin framework
3. **StockCoinBase/** - Shared Go utilities and common libraries
4. **StockCoinSync/** - Go service for data synchronization
5. **StockFE/** - Frontend application (currently empty)

## Smart Contract Development (CryptoStockContract/)

### Key Commands
```bash
# Install dependencies
npm install

# Compile contracts
npm run compile

# Run tests (local network)
npm test

# Run tests on specific network
npm test -- --network sepolia

# Run specific test file
npx hardhat test test/01-token-factory.test.js

# Deploy to local network
npm run deploy:defi:local

# Deploy to Sepolia testnet
npm run deploy:defi:sepolia
npm run deploy:full:sepolia

# Extract ABI after deployment
npm run extract-abi

# Generate test coverage
npm run coverage

# Start local Hardhat node
npm run node
```

### Contract Architecture
- **TokenFactory**: UUPS proxy contract for creating and managing stock tokens
- **StockToken**: ERC20 implementation for individual stock tokens with trading functionality
- **OracleAggregator**: Pyth Network integration for real-time price feeds
- **MockERC20**: Test USDT token (6 decimals)
- **MockPyth**: Mock oracle for local testing

### Configuration
- Environment variables in `.env` file
- Network configurations in `hardhat.config.js`
- Deployment scripts in `deploy/` and `scripts/` directories

### Testing
- 5 comprehensive test suites covering all functionality
- Supports both local (Hardhat) and Sepolia test networks
- Test files located in `test/` directory
- Uses Chai for assertions and Hardhat for testing framework

## Go Backend Services

### StockCoinEnd (API Service)
Main API service built with Gin framework that provides REST endpoints for the stock token system.

#### Commands
```bash
# Build and run
go run main.go -conf ./config/config.toml

# Build binary
go build -o stock-coin-end main.go
```

#### Key Features
- RESTful API endpoints
- Real-time stock data polling (every 2 minutes)
- Contract integration through go-ethereum
- Configuration management through TOML files
- Service initialization with background workers

### StockCoinBase (Shared Library)
Common utilities and shared code used across Go services.

#### Key Components
- Chain utilities for blockchain interactions
- HTTP client with retry mechanisms
- Logging infrastructure
- Error handling and error codes
- Data models and types

### StockCoinSync (Data Sync Service)
Service for synchronizing data between blockchain and database.

#### Commands
```bash
# Run sync service
go run main.go

# Build binary
go build -o stock-coin-sync main.go
```

## Configuration Management

### Environment Setup
1. Copy `.env.example` to `.env` for smart contract development
2. Configure TOML files for Go services
3. Set up database connections in configuration files

### Network Configuration
- **Local Development**: Uses Hardhat local network with mock contracts
- **Sepolia Testnet**: Uses real Pyth Network oracle contracts
- **Mainnet**: Production deployment (not configured in current setup)

## Development Workflow

### Smart Contract Development
1. Write contracts in `contracts/` directory
2. Create/update tests in `test/` directory
3. Run `npm test` to verify functionality
4. Use `npm run coverage` for test coverage reports
5. Deploy using appropriate deploy script

### Go Service Development
1. Modify service code in respective directories
2. Update shared utilities in `StockCoinBase/`
3. Test services locally with proper configuration
4. Build and deploy as needed

### Code Standards
- **Solidity**: Follow OpenZeppelin patterns, use 0.8.22 compiler version
- **Go**: Follow standard Go conventions, use go-zero framework patterns
- **JavaScript**: Use ES6+ syntax for testing and deployment scripts

## Common Development Tasks

### Adding New Stock Tokens
1. Update OracleAggregator with new Pyth feed IDs
2. Modify deployment scripts to include new tokens
3. Update test cases to cover new tokens
4. Update Go service configurations

### Contract Upgrades
1. Use OpenZeppelin UUPS proxy pattern
2. Test upgrade functionality in test suite
3. Follow upgrade verification procedures
4. Update deployment scripts accordingly

### API Integration
1. StockCoinEnd provides REST endpoints for frontend integration
2. Contract ABIs are extracted to `abi/` directory after deployment
3. Use go-ethereum for blockchain interactions in Go services

## Dependencies and Technologies

### Smart Contracts
- Solidity 0.8.22
- Hardhat development framework
- OpenZeppelin contracts (upgradeable)
- Pyth Network oracle integration
- Ethers.js v6

### Go Services
- Go 1.24.5
- Gin web framework
- go-ethereum for blockchain interactions
- GORM for database operations
- go-zero framework patterns
- Zap logging
- Viper configuration management

### Testing
- Hardhat test environment
- Chai assertions
- Sepolia testnet for integration testing
- Mock contracts for local development

## Security Considerations

- All contracts use OpenZeppelin security patterns
- UUPS proxy pattern for safe upgrades
- Reentrancy protection implemented
- Price validation mechanisms in oracle contracts
- Proper access controls and ownership patterns
- Comprehensive testing coverage for critical paths