# Monad MCP Server

This project provides an MCP server that can be used to interact with the Monad testnet. The server supports several main features to check MON balance, other token balances, transaction details, gas price, latest block, and multiple balances on the Monad testnet network.

## Supported Features

- **get-mon-balance**: Check MON balance for a Monad testnet address.
- **get-token-balance**: Check a specific ERC-20 token balance for a Monad testnet address.
- **get-transaction-details**: Get transaction details by transaction hash.
- **get-gas-price**: Get the current gas price on the Monad testnet.
- **get-latest-block**: Get the latest block information on the Monad testnet.
- **get-multiple-balances**: Check balances for multiple addresses at once.

## Prerequisites

- Node.js (v16 or newer)
- `npm` or `yarn`
- Claude Desktop (for MCP Client integration)

## Installation

1. Clone this repository:

```shell
git clone https://github.com/Semutireng22/mcp-monad.git
cd mcp-monad
```

2. Install dependencies:

```shell
npm install
```

## Configuration and Usage

### MCP Server Initialization

In the `src/index.ts` file, the server is initialized with the list of supported features:

```ts
const server = new McpServer({
  name: "monad-testnet",
  version: "0.0.1",
  capabilities: [
    "get-mon-balance",
    "get-token-balance",
    "get-transaction-details",
    "get-gas-price",
    "get-latest-block",
    "get-multiple-balances"
  ]
});
```

### Example Implementation of a Feature

For example, for the MON balance check feature:

```ts
server.tool(
  "get-mon-balance",
  "Get MON balance for an address on Monad testnet",
  {
    address: z.string().describe("Monad testnet address to check balance for"),
  },
  async ({ address }) => {
    try {
      const balance = await publicClient.getBalance({
        address: address as `0x${string}`,
      });
      return {
        content: [
          {
            type: "text",
            text: `Balance for ${address}: ${formatUnits(balance, 18)} MON`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve balance for address: ${address}. Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);
```

### Running the Server

First build the project:

```shell
npm run build
```

Run the MCP server:

```shell
node build/index.js
```

### Integration with Claude Desktop

1. Open "Claude Desktop".
2. Go to Settings > Developer.
3. Edit `claude_desktop_config.json` and add the following configuration:

```json
{
  "mcpServers": {
    ...
    "monad-mcp": {
      "command": "node",
      "args": [
        "/<path-to-project>/build/index.js"
      ]
    }
  }
}
```

4. Restart "Claude Desktop".

## Reference Sources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/introduction)
- [Monad Documentation](https://docs.monad.xyz/)
- [Viem Documentation](https://viem.sh/)


## Example MCP Prompt Usage

For example, to check MON balance for a specific address, you can send a request like this:

**Prompt:**
```
check MON 0xa2e57a3A7744eA20B5E2848817e9D66C6cb9f765
```

**Output yang diharapkan:**
```
Balance for 0xa2e57a3A7744eA20B5E2848817e9D66C6cb9f765: 123.456 MON
```

Output akan menampilkan saldo MON untuk alamat yang diminta. Jika terjadi error, output akan berisi pesan error yang sesuai.

