# Monad MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16-brightgreen)](https://nodejs.org/)

This project provides an MCP server for seamless interaction with the Monad testnet. It supports querying blockchain data (balances, transactions, gas prices, blocks) and interacting with the CoinflipGame smart contract for playing a coinflip game. The server integrates with Claude Desktop, allowing users to execute commands in natural language.

## Supported Features and How To Use

| Feature | Description | Example Command |
|---------|-------------|----------------|
| get-mon-balance | Check the MON balance for a Monad testnet address. | `check MON 0xa2e57a3A7744eA20B5E2848817e9D66C6cb9f765` |
| get-token-balance | Check the balance of a specific ERC-20 token for an address. | `check token balance for 0xa2e57a3A7744eA20B5E2848817e9D66C6cb9f765 on contract 0x1234...5678` |
| get-transaction-details | Retrieve detailed information about a transaction by its hash. | `get details for transaction 0xabcdef1234567890...` |
| get-gas-price | Get the current gas price on the Monad testnet. | `what is the current gas price` |
| get-latest-block | Fetch information about the latest block on the Monad testnet. | `show latest block info` |
| get-multiple-balances | Check balances for multiple tokens for an address. | `check multiple balances for 0xa2e57a3A7744eA20B5E2848817e9D66C6cb9f765 on contracts 0x1234...5678, 0x5678...1234` |
| send-mon | Send MON tokens to a specified address on the Monad testnet. | `send 0.1 MON to 0xb3f57a3A7744eA20B5E2848817e9D66C6cb9f765` |
| send-token | Send ERC-20 tokens to a specified address from a token contract. | `send 100 USDT to 0xb3f57a3A7744eA20B5E2848817e9D66C6cb9f765 from contract 0x1234...5678` |
| play-coinflip | Play a coinflip game by betting MON on Heads or Tails (minimum bet: 0.01 MON). | `flip 0.1 mon head` |
| get-coinflip-history | View the history of coinflip games for an address, including wins, losses, and profit. | `history flip` or `history flip 0xa2e57a3A7744eA20B5E2848817e9D66C6cb9f765` |
| stake-aprmon | Stake your MON tokens in the Apriori staking platform. | `stake 0.1 mon` to stake MON tokens. |
| unstake-aprmon | Unstake all your MON tokens from the Apriori platform. | `unstake aprmon` to unstake all your staked MON tokens. Note down the request ID, which will be used later for claiming. |
| claim-aprmon | Claim pending unstaked MON tokens. | After 10 minutes of unstaking, use `claim aprmon requestID`. Replace `requestID` with the ID obtained during the unstaking process. |
## Quick Start

```bash
# Clone the repository
git clone https://github.com/Semutireng22/mcp-monad.git
cd mcp-monad

# Install dependencies
npm install

# Create .env file (replace with your private key)
echo "PRIVATE_KEY=0xyourprivatekeyhere" > .env

# Build and run
npm run build
node build/index.js
```

## Prerequisites

- Node.js (v16 or newer)
- npm or yarn
- Claude Desktop (for MCP Client integration)
- A Monad testnet wallet with sufficient MON for transactions and gas fees (required for play-coinflip, send-mon, and send-token)
- A `.env` file with a valid `PRIVATE_KEY` for the Monad testnet wallet

## Configuration and Usage

### MCP Server Initialization

In the `src/index.ts` file, the server is initialized with the list of supported features:

```typescript
const server = new McpServer({
  name: "monad-testnet",
  version: "0.0.1",
  capabilities: [
    "get-mon-balance",
    "get-token-balance",
    "get-transaction-details",
    "get-gas-price",
    "get-latest-block",
    "get-multiple-balances",
    "send-mon",
    "send-token",
    "play-coinflip",
    "get-coinflip-history"
  ]
});
```

### Setting Up the Environment

Create a `.env` file in the project root directory (e.g., `/path/to/mcp-monad/.env`) with the following content:

```env
PRIVATE_KEY=0xyourprivatekeyhere
```

Replace `0xyourprivatekeyhere` with your Monad testnet wallet's private key (64 hexadecimal characters starting with `0x`).

Ensure the `.env` file is secure and not committed to version control. Add it to `.gitignore`:

```bash
echo .env >> .gitignore
```

### Building and Running the Server

Build the project:

```bash
npm run build
```

Run the MCP server:

```bash
node build/index.js
```

### Integration with Claude Desktop

1. Open Claude Desktop.
2. Go to `Settings > Developer`.
3. Edit `claude_desktop_config.json` (typically located in `~/.config/Claude/` or `%APPDATA%\Claude\`) and add the following configuration:

```json
{
  "mcpServers": {
    "monad-mcp": {
      "command": "node",
      "args": [
        "/path/to/mcp-monad/build/index.js"
      ],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

Replace `/path/to/mcp-monad/` with the actual path to your project directory (e.g., `E:\proyek\mcp-monad` on Windows or `/home/user/mcp-monad` on Linux).

4. Restart Claude Desktop.
5. When prompted, allow MCP access for the chat session (`Allow for This Chat`).

## Contributing

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Contact

Slamettttt  - [@caridipesbuk](https://twitter.com/caridipesbuk)

Project Link: [https://github.com/Semutireng22/mcp-monad](https://github.com/Semutireng22/mcp-monad)

## Notes

- Ensure the CoinflipGame contract (`0x664e248c39cd70Fa333E9b2544beEd6A7a2De09b`) has sufficient funds in its pool to cover potential winnings for `play-coinflip`. You can check this using a Monad testnet block explorer.
- For users on different systems, adjust the project path in `claude_desktop_config.json` accordingly.

## Troubleshooting

- **Server fails to start**: Check logs in Claude Desktop (`Settings > Developer`) or terminal for errors like "File `.env` does not exist." Ensure `.env` is in the project root with a valid `PRIVATE_KEY`.
- **Insufficient contract funds**: Verify the CoinflipGame contract balance using a block explorer. The contract owner can fund it via the `fundGamePool` function.
- **Claude commands not working**: Ensure `claude_desktop_config.json` has the correct project path and restart Claude Desktop.
- **TypeScript errors**: Run `npx tsc` to check for errors. Update dependencies with:

```bash
npm install
```

- **Use MCP Inspector for debugging**:

```bash
git clone https://github.com/modelcontextprotocol/inspector
cd inspector
npm install
npm start

