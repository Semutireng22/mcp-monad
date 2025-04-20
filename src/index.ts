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
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Muat file .env dari direktori proyek (relatif terhadap file kode)
const envPath: string = path.resolve(__dirname, "..", ".env");
if (!fs.existsSync(envPath)) {
    console.error(`File ${envPath} does not exist.`);
    console.error(`Please create ${envPath} with: PRIVATE_KEY=0x... (64 hexadecimal characters starting with 0x).`);
    console.error(`Current working directory: ${process.cwd()}`);
    console.error(`Expected .env in project root directory, one level above: ${__dirname}`);
    throw new Error(`File ${envPath} does not exist`);
}
dotenv.config({ path: envPath });

// Validasi private key dari .env
const PRIVATE_KEY: string | undefined = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) {
    console.error(`PRIVATE_KEY is not set in ${envPath}.`);
    console.error(`Ensure ${envPath} contains: PRIVATE_KEY=0x... (64 hexadecimal characters starting with 0x).`);
    throw new Error(`PRIVATE_KEY is not set in ${envPath}`);
}
if (!/^0x[a-fA-F0-9]{64}$/.test(PRIVATE_KEY)) {
    console.error(`Invalid PRIVATE_KEY format in ${envPath}. Must be 0x followed by 64 hexadecimal characters.`);
    throw new Error("Invalid PRIVATE_KEY format");
}

// Konfigurasi RPC dengan FallbackProvider
const rpcUrls: string[] = [
    monadTestnet.rpcUrls.default.http[0],
    // Tambahkan RPC alternatif jika tersedia
    // "https://monad-testnet-alchemy-rpc-url",
];
const providers: ethers.providers.JsonRpcProvider[] = rpcUrls.map(url => new ethers.providers.JsonRpcProvider(url));
const provider: ethers.providers.FallbackProvider = new ethers.providers.FallbackProvider(providers, 1);
const wallet: ethers.Wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// ABI untuk ERC20 (digunakan di tool lain)
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
    },
    {
        inputs: [
            { name: "recipient", type: "address" },
            { name: "amount", type: "uint256" }
        ],
        name: "transfer",
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
    }
] as const;

// ABI untuk CoinflipGame
const COINFLIP_ABI = [
    {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "address", "name": "player", "type": "address" },
            { "indexed": false, "internalType": "uint256", "name": "bet", "type": "uint256" }
        ],
        "name": "BetPlaced",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "address", "name": "player", "type": "address" },
            { "indexed": false, "internalType": "enum CoinflipGame.Choice", "name": "playerChoice", "type": "uint8" },
            { "indexed": false, "internalType": "bool", "name": "result", "type": "bool" },
            { "indexed": false, "internalType": "bool", "name": "won", "type": "bool" },
            { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
            { "indexed": false, "internalType": "uint256", "name": "bet", "type": "uint256" },
            { "indexed": false, "internalType": "bytes32", "name": "requestId", "type": "bytes32" }
        ],
        "name": "FlipResult",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "address", "name": "depositor", "type": "address" },
            { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
            { "indexed": false, "internalType": "uint256", "name": "toGamePool", "type": "uint256" },
            { "indexed": false, "internalType": "uint256", "name": "toReserve", "type": "uint256" }
        ],
        "name": "FundsDeposited",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "address", "name": "owner", "type": "address" },
            { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
            { "indexed": false, "internalType": "bool", "name": "toGamePool", "type": "bool" }
        ],
        "name": "FundsMoved",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "address", "name": "recipient", "type": "address" },
            { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
        ],
        "name": "FundsWithdrawn",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "MIN_BET",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "contractBalance",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "enum CoinflipGame.Choice", "name": "_choice", "type": "uint8" }],
        "name": "flipCoin",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "fundGamePool",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "gamePool",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getContractBalance",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getTotalBalance",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }],
        "name": "moveFromGamePool",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }],
        "name": "moveToGamePool",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "withdrawAllFunds",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "stateMutability": "payable",
        "type": "receive"
    }
] as const;

// Create a public client to interact with the Monad testnet
const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(),
});

// Update server capabilities with new tools
const server: McpServer = new McpServer({
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

// Define the MON balance tool
server.tool(
    "get-mon-balance",
    "Get MON balance for an address on Monad testnet",
    {
        address: z.string().describe("Monad testnet address to check balance for"),
    },
    async ({ address }: { address: string }) => {
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
        } catch (error: unknown) {
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
    async ({ address, tokenContract }: { address: string; tokenContract: string }) => {
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
        } catch (error: unknown) {
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
    async ({ hash }: { hash: string }) => {
        try {
            const tx = await publicClient.getTransaction({ hash: hash as `0x${string}` });
            const receipt = await publicClient.getTransactionReceipt({ hash: hash as `0x${string}` });
            const block = await publicClient.getBlock({ blockHash: receipt.blockHash });
            
            let transactionType: string = "Native MON Transfer";
            let from: string = tx.from;
            let to: string | null = tx.to;
            let value: bigint = tx.value;
            let tokenSymbol: string = "MON";
            let decimals: number = 18;

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

            const timestamp: Date = new Date(Number(block.timestamp) * 1000);
            const formattedValue: string = transactionType === "Native MON Transfer" 
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
        } catch (error: unknown) {
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
            const gasPrice: bigint = await publicClient.getGasPrice();
            return {
                content: [{
                    type: "text",
                    text: `Current Gas Price: ${formatUnits(gasPrice, 9)} Gwei`,
                }],
            };
        } catch (error: unknown) {
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
            const timestamp: Date = new Date(Number(block.timestamp) * 1000);

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
        } catch (error: unknown) {
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
    async ({ address, tokenContracts }: { address: string; tokenContracts: string[] }) => {
        try {
            const balances = await Promise.all(
                tokenContracts.map(async (tokenContract: string) => {
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

            const balanceText: string = balances
                .map(b => `${b.symbol}: ${b.balance} (${b.contract})`)
                .join('\n');

            return {
                content: [{
                    type: "text",
                    text: `Token Balances for ${address}:\n${balanceText}`,
                }],
            };
        } catch (error: unknown) {
            return {
                content: [{ 
                    type: "text", 
                    text: `Failed to get multiple token balances. Error: ${error instanceof Error ? error.message : String(error)}` 
                }],
            };
        }
    }
);

// Tool untuk mengirim MON (native token)
server.tool(
    "send-mon",
    "Send MON tokens to a specified address on Monad testnet",
    {
        toAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, { message: "Invalid Ethereum address" }).describe("Recipient address"),
        amount: z.string().regex(/^\d+(\.\d+)?$/, { message: "Invalid amount, must be a positive number" }).describe("Amount of MON to send"),
    },
    async ({ toAddress, amount }: { toAddress: string; amount: string }) => {
        try {
            // Konversi amount ke wei
            const amountWei: ethers.BigNumber = ethers.utils.parseEther(amount);

            // Cek saldo MON
            const balance: ethers.BigNumber = await provider.getBalance(wallet.address);
            if (balance.lt(amountWei)) {
                throw new Error("Insufficient MON balance");
            }

            // Estimasi gas dan tambahkan buffer 20%
            const gasLimit: ethers.BigNumber = await provider.estimateGas({
                to: toAddress,
                value: amountWei,
            });
            const bufferedGasLimit: ethers.BigNumber = gasLimit.mul(120).div(100); // Buffer 20%

            // Kirim transaksi
            const tx: ethers.providers.TransactionResponse = await wallet.sendTransaction({
                to: toAddress,
                value: amountWei,
                gasLimit: bufferedGasLimit,
                gasPrice: await provider.getGasPrice(),
            });

            // Tunggu konfirmasi
            const receipt: ethers.providers.TransactionReceipt = await tx.wait();

            return {
                content: [
                    {
                        type: "text",
                        text: `Successfully sent ${amount} MON to ${receipt.to}\nTransaction Hash: ${receipt.transactionHash}\nStatus: ${receipt.status === 1 ? "Success" : "Failed"}`,
                    },
                ],
            };
        } catch (error: unknown) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to send MON. Error: ${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
            };
        }
    }
);

// Tool untuk mengirim token ERC-20
server.tool(
    "send-token",
    "Send ERC-20 tokens to a specified address from a token contract",
    {
        toAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, { message: "Invalid Ethereum address" }).describe("Recipient address"),
        tokenContract: z.string().regex(/^0x[a-fA-F0-9]{40}$/, { message: "Invalid token contract address" }).describe("Token contract address"),
        amount: z.string().regex(/^\d+(\.\d+)?$/, { message: "Invalid amount, must be a positive number" }).describe("Amount of tokens to send"),
    },
    async ({ toAddress, tokenContract, amount }: { toAddress: string; tokenContract: string; amount: string }) => {
        try {
            // Cek apakah kontrak valid
            const code: string = await provider.getCode(tokenContract);
            if (code === "0x") {
                throw new Error("Invalid token contract: no code found");
            }

            // Buat instance kontrak
            const contract: ethers.Contract = new ethers.Contract(tokenContract, ERC20_ABI, wallet);

            // Dapatkan decimals dan symbol
            const [decimals, symbol]: [number, string] = await Promise.all([
                contract.decimals(),
                contract.symbol()
            ]);

            // Konversi amount ke format yang sesuai
            const amountWei: ethers.BigNumber = ethers.utils.parseUnits(amount, decimals);

            // Cek saldo token
            const balance: ethers.BigNumber = await contract.balanceOf(wallet.address);
            if (balance.lt(amountWei)) {
                throw new Error(`Insufficient ${symbol} balance`);
            }

            // Estimasi gas dan tambahkan buffer 20%
            const gasLimit: ethers.BigNumber = await contract.estimateGas.transfer(toAddress, amountWei);
            const bufferedGasLimit: ethers.BigNumber = gasLimit.mul(120).div(100); // Buffer 20%

            // Kirim transaksi transfer
            const tx: ethers.ContractTransaction = await contract.transfer(toAddress, amountWei, {
                gasLimit: bufferedGasLimit,
                gasPrice: await provider.getGasPrice(),
            });

            // Tunggu konfirmasi
            const receipt: ethers.ContractReceipt = await tx.wait();

            return {
                content: [
                    {
                        type: "text",
                        text: `Successfully sent ${amount} ${symbol} to ${receipt.to}\nTransaction Hash: ${receipt.transactionHash}\nStatus: ${receipt.status === 1 ? "Success" : "Failed"}`,
                    },
                ],
            };
        } catch (error: unknown) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to send token. Error: ${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
            };
        }
    }
);

// Tool untuk bermain CoinflipGame
server.tool(
    "play-coinflip",
    "Play a coinflip game on Monad testnet by betting MON on Heads or Tails",
    {
        amount: z.string()
            .regex(/^\d+(\.\d+)?$/, { message: "Invalid amount, must be a positive number" })
            .describe("Amount to bet in MON (minimum 0.01 MON)"),
        choice: z.enum(["head", "tail"])
            .describe("Choose 'head' or 'tail' for the coinflip"),
    },
    async ({ amount, choice }: { amount: string; choice: "head" | "tail" }) => {
        try {
            // Konversi amount ke wei
            const amountWei: ethers.BigNumber = ethers.utils.parseEther(amount);
            const minBet: ethers.BigNumber = ethers.utils.parseEther("0.01");
            if (amountWei.lt(minBet)) {
                throw new Error("Bet must be at least 0.01 MON");
            }

            // Cek saldo dompet
            const balance: ethers.BigNumber = await provider.getBalance(wallet.address);
            if (balance.lt(amountWei)) {
                throw new Error("Insufficient MON balance for bet and gas");
            }

            // Inisialisasi kontrak CoinflipGame
            const contract: ethers.Contract = new ethers.Contract(
                "0x664e248c39cd70Fa333E9b2544beEd6A7a2De09b",
                COINFLIP_ABI,
                wallet
            );

            // Cek saldo kontrak
            const totalPool: ethers.BigNumber = await contract.getTotalBalance();
            const requiredPool: ethers.BigNumber = amountWei.mul(2);
            if (totalPool.lt(requiredPool)) {
                throw new Error("Insufficient contract pool to pay potential winnings");
            }

            // Konversi pilihan ke enum kontrak
            const choiceEnum: number = choice.toLowerCase() === "head" ? 0 : 1;

            // Estimasi gas dan tambahkan buffer 20%
            const gasLimit: ethers.BigNumber = await contract.estimateGas.flipCoin(choiceEnum, {
                value: amountWei,
            });
            const bufferedGasLimit: ethers.BigNumber = gasLimit.mul(120).div(100);

            // Kirim transaksi flipCoin
            const tx: ethers.ContractTransaction = await contract.flipCoin(choiceEnum, {
                value: amountWei,
                gasLimit: bufferedGasLimit,
                gasPrice: await provider.getGasPrice(),
            });

            // Tunggu konfirmasi
            const receipt: ethers.ContractReceipt = await tx.wait();

            // Parse event FlipResult
            let resultText: string = "Unknown result";
            for (const log of receipt.logs) {
                try {
                    const parsedLog = contract.interface.parseLog(log);
                    if (parsedLog.name === "FlipResult") {
                        const { playerChoice, result, won, amount, bet } = parsedLog.args;
                        const choiceStr: string = playerChoice === 0 ? "Head" : "Tail";
                        const resultStr: string = result ? "Head" : "Tail";
                        const betMon: string = ethers.utils.formatEther(bet);
                        if (won) {
                            const winningsMon: string = ethers.utils.formatEther(amount);
                            resultText = `You chose ${choiceStr}. Result: ${resultStr}. You won! Winnings: ${winningsMon} MON`;
                        } else {
                            resultText = `You chose ${choiceStr}. Result: ${resultStr}. You lost. Bet: ${betMon} MON`;
                        }
                        break;
                    }
                } catch (e) {
                    // Lanjutkan jika log bukan FlipResult
                }
            }

            return {
                content: [
                    {
                        type: "text",
                        text: `${resultText}\nTransaction Hash: ${receipt.transactionHash}`,
                    },
                ],
            };
        } catch (error: unknown) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to play coinflip. Error: ${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
            };
        }
    }
);

// Tool untuk melihat riwayat permainan Coinflip
server.tool(
    "get-coinflip-history",
    "Get the history of coinflip games for an address on Monad testnet",
    {
        address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, { message: "Invalid Ethereum address" })
            .optional()
            .describe("Address to check game history for (defaults to your wallet address)"),
        limit: z.number().int().min(1).max(100).optional().default(50)
            .describe("Maximum number of games to retrieve (1-100, default 50)"),
    },
    async ({ address, limit }: { address?: string; limit?: number }) => {
        try {
            // Gunakan alamat dompet jika address tidak diberikan
            const playerAddress: string = address || wallet.address;

            // Inisialisasi kontrak untuk parsing event
            const contract: ethers.Contract = new ethers.Contract(
                "0x664e248c39cd70Fa333E9b2544beEd6A7a2De09b",
                COINFLIP_ABI,
                provider
            );

            // Ambil event FlipResult untuk alamat pemain
            const filter = {
                address: "0x664e248c39cd70Fa333E9b2544beEd6A7a2De09b",
                topics: [
                    contract.interface.getEventTopic("FlipResult"),
                    ethers.utils.hexZeroPad(playerAddress, 32),
                ],
                fromBlock: 0, // Mulai dari blok awal (bisa disesuaikan untuk efisiensi)
            };
            const logs = await provider.getLogs(filter);

            // Batasi jumlah log sesuai limit
            const games = logs.slice(0, limit).map((log) => {
                const parsedLog = contract.interface.parseLog(log);
                const { playerChoice, result, won, amount, bet } = parsedLog.args;
                return {
                    choice: playerChoice === 0 ? "Head" : "Tail",
                    result: result ? "Head" : "Tail",
                    won,
                    amount: ethers.utils.formatEther(amount),
                    bet: ethers.utils.formatEther(bet),
                };
            });

            // Hitung statistik
            const totalWins: number = games.filter(g => g.won).length;
            const totalLosses: number = games.length - totalWins;
            const totalWinnings: number = games
                .filter(g => g.won)
                .reduce((sum, g) => sum + parseFloat(g.amount), 0);
            const totalBets: number = games
                .reduce((sum, g) => sum + parseFloat(g.bet), 0);
            const profit: number = totalWinnings - totalBets;

            // Format riwayat permainan
            const historyText: string = games.length > 0
                ? games.map((g, i) => 
                    `- Game ${i + 1}: Chose ${g.choice}, Result: ${g.result}, ${g.won ? `Won: ${g.amount} MON` : `Lost, Bet: ${g.bet} MON`}`
                ).join('\n')
                : "No games found.";

            return {
                content: [
                    {
                        type: "text",
                        text: `Coinflip History for ${playerAddress}:\n` +
                              `Total Wins: ${totalWins}\n` +
                              `Total Losses: ${totalLosses}\n` +
                              `Profit: ${profit.toFixed(4)} MON\n` +
                              `Games:\n${historyText}`,
                    },
                ],
            };
        } catch (error: unknown) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to retrieve coinflip history. Error: ${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
            };
        }
    }
);

/**
 * Main function to start the MCP server
 * Uses stdio for communication with LLM clients
 */
async function main(): Promise<void> {
    console.error("Starting MCP server...");
    console.error("Server process started with args:", process.argv);
    console.error("Current working directory:", process.cwd());
    console.error(`Loaded .env from: ${envPath}`);
    const transport: StdioServerTransport = new StdioServerTransport();
    console.error("Transport created");
    await server.connect(transport);
    console.error("Monad testnet MCP Server running on stdio");
}

// Start the server and handle any fatal errors
main().catch((error: unknown) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});