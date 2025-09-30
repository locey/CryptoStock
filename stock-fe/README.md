# CryptoStock Frontend

Next.js frontend application for the CryptoStock decentralized stock trading platform.

## Features

- **Real-time Stock Trading**: Trade real stocks as ERC20 tokens on the blockchain
- **Live Price Feeds**: Powered by Pyth Network oracle for accurate pricing
- **Modern UI**: Built with Next.js, Tailwind CSS, and shadcn/ui components
- **Web3 Integration**: RainbowKit for wallet connectivity
- **Responsive Design**: Mobile-first responsive layout

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Radix UI + shadcn/ui
- **Web3**: RainbowKit, Wagmi, Ethers.js
- **State Management**: Zustand
- **Data Fetching**: TanStack Query, SWR
- **TypeScript**: Full TypeScript support
- **Validation**: Zod

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, or pnpm

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd CryptoStock/stock-fe
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Start the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Development Scripts

```bash
# Development server with Turbopack
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run ESLint
npm run lint
```

## Project Structure

```
stock-fe/
├── app/                    # Next.js App Router
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
├── lib/                   # Utility functions
├── hooks/                 # Custom React hooks
├── types/                 # TypeScript type definitions
├── utils/                 # Additional utilities
└── public/                # Static assets
```

## Configuration

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# Blockchain Configuration
NEXT_PUBLIC_NETWORK_ID=11155111  # Sepolia testnet
NEXT_PUBLIC_RPC_URL=https://rpc.sepolia.org

# WalletConnect Project ID (for RainbowKit)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:9000
```

### Blockchain Integration

The app is configured to work with:
- **Sepolia Testnet**: For development and testing
- **Smart Contracts**: CryptoStock contract system
- **Price Oracle**: Pyth Network for real-time stock prices

## Available Scripts

### Development
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build optimized production bundle
- `npm run start` - Start production server
- `npm run lint` - Run ESLint for code quality

### Testing
- `npm run test` - Run test suite (when implemented)
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

## Deployment

### Vercel (Recommended)
1. Push your code to a Git repository
2. Connect your repository to Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy automatically on every push

### Other Platforms
The project can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue in the repository or contact the development team.