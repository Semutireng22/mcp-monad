import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { 
    createPublicClient, 
    formatUnits, 
    http, 
    getContract, 
    decodeEventLog, 
    formatEther
} from "viem";
import { monadTestnet } from "viem/chains";

// Add ERC20 ABI for token balance checking
const ERC20_ABI = [
    {
        inputs: [{ name: "account", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "decimals",
        outputs: [{ name: "", type: "uint8" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "symbol",
        outputs: [{ name: "", type: "string" }],
        stateMutability: "view",
        type: "function",
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, name: "from", type: "address" },
            { indexed: true, name: "to", type: "address" },
            { indexed: false, name: "value", type: "uint256" }
        ],
        name: "Transfer",
        type: "event"
    }
] as const;

// Create a public client to interact with the Monad testnet
const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(),
});

// Update server capabilities
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

// Define the MON balance tool
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
                        text: `Failed to retrieve balance for address: ${address}. Error: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            };
        }
    }
);

// Add new tool for token balance checking
server.tool(
    "get-token-balance",
    "Get token balance for an address from a specific token contract",
    {
        address: z.string().describe("Address to check balance for"),
        tokenContract: z.string().describe("Token contract address"),
    },
    async ({ address, tokenContract }) => {
        try {
            const contract = getContract({
                address: tokenContract as `0x${string}`,
                abi: ERC20_ABI,
                client: publicClient,
            });

            const [balance, decimals, symbol] = await Promise.all([
                contract.read.balanceOf([address as `0x${string}`]) as Promise<bigint>,
                contract.read.decimals() as Promise<number>,
                contract.read.symbol() as Promise<string>,
            ]);

            return {
                content: [
                    {
                        type: "text",
                        text: `Token balance for ${address}: ${formatUnits(balance, decimals)} ${symbol}`,
                    },
                ],
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to retrieve token balance. Error: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            };
        }
    }
);

// Add transaction details tool
server.tool(
    "get-transaction-details",
    "Get detailed information about a transaction",
    {
        hash: z.string().describe("Transaction hash to check"),
    },
    async ({ hash }) => {
        try {
            const tx = await publicClient.getTransaction({ hash: hash as `0x${string}` });
            const receipt = await publicClient.getTransactionReceipt({ hash: hash as `0x${string}` });
            const block = await publicClient.getBlock({ blockHash: receipt.blockHash });
            
            let transactionType = "Native MON Transfer";
            let from = tx.from;
            let to = tx.to;
            let value = tx.value;
            let tokenSymbol = "MON";
            let decimals = 18;

            // Check if this is a token transfer
            if (receipt.logs.length > 0) {
                try {
                    const log = receipt.logs[0];
                    const decoded = decodeEventLog({
                        abi: ERC20_ABI,
                        data: log.data,
                        topics: log.topics,
                    });

                    if (decoded.eventName === "Transfer") {
                        const contract = getContract({
                            address: log.address,
                            abi: ERC20_ABI,
                            client: publicClient,
                        });

                        const [symbol, tokenDecimals] = await Promise.all([
                            contract.read.symbol() as Promise<string>,
                            contract.read.decimals() as Promise<number>,
                        ]);

                        transactionType = "Token Transfer";
                        from = decoded.args.from;
                        to = decoded.args.to;
                        value = decoded.args.value;
                        tokenSymbol = symbol;
                        decimals = tokenDecimals;
                    }
                } catch (e) {
                    // If decoding fails, stick with native transfer details
                }
            }

            const timestamp = new Date(Number(block.timestamp) * 1000);
            const formattedValue = transactionType === "Native MON Transfer" 
                ? formatEther(value)
                : formatUnits(value, decimals);

            return {
                content: [
                    {
                        type: "text",
                        text: `Transaction Details:
Type: ${transactionType}
From: ${from}
To: ${to}
Amount: ${formattedValue} ${tokenSymbol}
Date: ${timestamp.toLocaleString()}
Status: ${receipt.status === "success" ? "Success" : "Failed"}
Block: ${receipt.blockNumber}
Gas Used: ${receipt.gasUsed} wei`
                    },
                ],
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to retrieve transaction details. Error: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    },
                ],
            };
        }
    }
);

// Add gas price tool
server.tool(
    "get-gas-price",
    "Get current gas price on Monad testnet",
    {},
    async () => {
        try {
            const gasPrice = await publicClient.getGasPrice();
            return {
                content: [{
                    type: "text",
                    text: `Current Gas Price: ${formatUnits(gasPrice, 9)} Gwei`,
                }],
            };
        } catch (error) {
            return {
                content: [{ 
                    type: "text", 
                    text: `Failed to get gas price. Error: ${error instanceof Error ? error.message : String(error)}` 
                }],
            };
        }
    }
);

// Add latest block info tool
server.tool(
    "get-latest-block",
    "Get information about the latest block on Monad testnet",
    {},
    async () => {
        try {
            const block = await publicClient.getBlock();
            const timestamp = new Date(Number(block.timestamp) * 1000);

            return {
                content: [{
                    type: "text",
                    text: `Latest Block Information:
Block Number: ${block.number}
Timestamp: ${timestamp.toLocaleString()}
Hash: ${block.hash}
Parent Hash: ${block.parentHash}
Transactions Count: ${block.transactions.length}
Gas Used: ${formatUnits(block.gasUsed, 9)} Gwei
Gas Limit: ${formatUnits(block.gasLimit, 9)} Gwei`
                }],
            };
        } catch (error) {
            return {
                content: [{ 
                    type: "text", 
                    text: `Failed to get latest block info. Error: ${error instanceof Error ? error.message : String(error)}` 
                }],
            };
        }
    }
);

// Add multiple token balances tool
server.tool(
    "get-multiple-balances",
    "Get balances for multiple tokens at once",
    {
        address: z.string().describe("Address to check balances for"),
        tokenContracts: z.array(z.string()).describe("Array of token contract addresses"),
    },
    async ({ address, tokenContracts }) => {
        try {
            const balances = await Promise.all(
                tokenContracts.map(async (tokenContract) => {
                    const contract = getContract({
                        address: tokenContract as `0x${string}`,
                        abi: ERC20_ABI,
                        client: publicClient,
                    });

                    const [balance, symbol, decimals] = await Promise.all([
                        contract.read.balanceOf([address as `0x${string}`]) as Promise<bigint>,
                        contract.read.symbol() as Promise<string>,
                        contract.read.decimals() as Promise<number>,
                    ]);

                    return {
                        symbol,
                        balance: formatUnits(balance, decimals),
                        contract: tokenContract
                    };
                })
            );

            const balanceText = balances
                .map(b => `${b.symbol}: ${b.balance} (${b.contract})`)
                .join('\n');

            return {
                content: [{
                    type: "text",
                    text: `Token Balances for ${address}:\n${balanceText}`,
                }],
            };
        } catch (error) {
            return {
                content: [{ 
                    type: "text", 
                    text: `Failed to get multiple token balances. Error: ${error instanceof Error ? error.message : String(error)}` 
                }],
            };
        }
    }
);



/**
 * Main function to start the MCP server
 * Uses stdio for communication with LLM clients
 */
async function main() {
    // Create a transport layer using standard input/output
    const transport = new StdioServerTransport();
    
    // Connect the server to the transport
    await server.connect(transport);
    
    console.error("Monad testnet MCP Server running on stdio");
}

// Start the server and handle any fatal errors
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});