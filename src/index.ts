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
import { ERC20_ABI, COINFLIP_ABI, APRMON_ABI } from "./abis";

// Muat file .env dari direktori proyek
const envPath: string = path.resolve(__dirname, "..", ".env");
if (!fs.existsSync(envPath)) {
    console.error(`File ${envPath} does not exist.`);
    console.error(`Please create ${envPath} with: PRIVATE_KEY=0x... (64 hexadecimal characters starting with 0x).`);
    console.error(`Current working directory: ${process.cwd()}`);
    console.error(`Expected .env in project root directory, one level above: ${__dirname}`);
    throw new Error(`File ${envPath} does not exist`);
}
dotenv.config({ path: envPath });

// Validasi private key
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

// Validasi file abis.js
const abisPath: string = path.resolve(__dirname, "abis.js");
if (!fs.existsSync(abisPath)) {
    console.error(`File ${abisPath} does not exist.`);
    console.error(`Please create ${abisPath} with ERC20_ABI, COINFLIP_ABI, and APRMON_ABI definitions.`);
    console.error(`Expected abis.js in: ${__dirname}`);
    throw new Error(`File ${abisPath} does not exist`);
}

// Konfigurasi RPC dengan FallbackProvider
const rpcUrls: string[] = [
    monadTestnet.rpcUrls.default.http[0],
];
const providers: ethers.providers.JsonRpcProvider[] = rpcUrls.map(url => new ethers.providers.JsonRpcProvider(url));
const provider: ethers.providers.FallbackProvider = new ethers.providers.FallbackProvider(providers, 1);
const wallet: ethers.Wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Create a public client
const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(),
});

// Update server capabilities
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
        "get-coinflip-history",
        "stake-aprmon",
        "unstake-aprmon",
        "claim-aprmon",
        "get-aprmon-balance",
        "get-aprmon-rate",
        "get-aprmon-requests"
    ]
});

// Tool untuk mendapatkan saldo MON
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

// Tool untuk mendapatkan saldo token
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

// Tool untuk detail transaksi
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
                    // Jika decoding gagal, gunakan detail transfer native
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

// Tool untuk harga gas
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

// Tool untuk blok terbaru
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

// Tool untuk saldo multiple token
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

// Tool untuk mengirim MON
server.tool(
    "send-mon",
    "Send MON tokens to a specified address on Monad testnet",
    {
        toAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, { message: "Invalid Ethereum address" }).describe("Recipient address"),
        amount: z.string().regex(/^\d+(\.\d+)?$/, { message: "Invalid amount, must be a positive number" }).describe("Amount of MON to send"),
    },
    async ({ toAddress, amount }: { toAddress: string; amount: string }) => {
        try {
            const amountWei: ethers.BigNumber = ethers.utils.parseEther(amount);
            const balance: ethers.BigNumber = await provider.getBalance(wallet.address);
            if (balance.lt(amountWei)) {
                throw new Error("Insufficient MON balance");
            }

            const gasLimit: ethers.BigNumber = await provider.estimateGas({
                to: toAddress,
                value: amountWei,
            });
            const bufferedGasLimit: ethers.BigNumber = gasLimit.mul(120).div(100);

            const tx: ethers.providers.TransactionResponse = await wallet.sendTransaction({
                to: toAddress,
                value: amountWei,
                gasLimit: bufferedGasLimit,
                gasPrice: await provider.getGasPrice(),
            });

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
            const code: string = await provider.getCode(tokenContract);
            if (code === "0x") {
                throw new Error("Invalid token contract: no code found");
            }

            const contract: ethers.Contract = new ethers.Contract(tokenContract, ERC20_ABI, wallet);
            const [decimals, symbol]: [number, string] = await Promise.all([
                contract.decimals(),
                contract.symbol()
            ]);

            const amountWei: ethers.BigNumber = ethers.utils.parseUnits(amount, decimals);
            const balance: ethers.BigNumber = await contract.balanceOf(wallet.address);
            if (balance.lt(amountWei)) {
                throw new Error(`Insufficient ${symbol} balance`);
            }

            const gasLimit: ethers.BigNumber = await contract.estimateGas.transfer(toAddress, amountWei);
            const bufferedGasLimit: ethers.BigNumber = gasLimit.mul(120).div(100);

            const tx: ethers.ContractTransaction = await contract.transfer(toAddress, amountWei, {
                gasLimit: bufferedGasLimit,
                gasPrice: await provider.getGasPrice(),
            });

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
            const amountWei: ethers.BigNumber = ethers.utils.parseEther(amount);
            const minBet: ethers.BigNumber = ethers.utils.parseEther("0.01");
            if (amountWei.lt(minBet)) {
                throw new Error("Bet must be at least 0.01 MON");
            }

            const balance: ethers.BigNumber = await provider.getBalance(wallet.address);
            if (balance.lt(amountWei)) {
                throw new Error("Insufficient MON balance for bet and gas");
            }

            const contract: ethers.Contract = new ethers.Contract(
                "0x664e248c39cd70Fa333E9b2544beEd6A7a2De09b",
                COINFLIP_ABI,
                wallet
            );

            const totalPool: ethers.BigNumber = await contract.getTotalBalance();
            const requiredPool: ethers.BigNumber = amountWei.mul(2);
            if (totalPool.lt(requiredPool)) {
                throw new Error("Insufficient contract pool to pay potential winnings");
            }

            const choiceEnum: number = choice.toLowerCase() === "head" ? 0 : 1;
            const gasLimit: ethers.BigNumber = await contract.estimateGas.flipCoin(choiceEnum, {
                value: amountWei,
            });
            const bufferedGasLimit: ethers.BigNumber = gasLimit.mul(120).div(100);

            const tx: ethers.ContractTransaction = await contract.flipCoin(choiceEnum, {
                value: amountWei,
                gasLimit: bufferedGasLimit,
                gasPrice: await provider.getGasPrice(),
            });

            const receipt: ethers.ContractReceipt = await tx.wait();
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

// Tool untuk melihat riwayat Coinflip
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
            const playerAddress: string = address || wallet.address;
            const contract: ethers.Contract = new ethers.Contract(
                "0x664e248c39cd70Fa333E9b2544beEd6A7a2De09b",
                COINFLIP_ABI,
                provider
            );

            const latestBlock = await provider.getBlockNumber();
            const fromBlock = Math.max(0, latestBlock - 1000);

            const filter = {
                address: "0x664e248c39cd70Fa333E9b2544beEd6A7a2De09b",
                topics: [
                    contract.interface.getEventTopic("FlipResult"),
                    ethers.utils.hexZeroPad(playerAddress, 32),
                ],
                fromBlock: fromBlock,
                toBlock: "latest"
            };
            const logs = await provider.getLogs(filter);

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

            const totalWins: number = games.filter(g => g.won).length;
            const totalLosses: number = games.length - totalWins;
            const totalWinnings: number = games
                .filter(g => g.won)
                .reduce((sum, g) => sum + parseFloat(g.amount), 0);
            const totalBets: number = games
                .reduce((sum, g) => sum + parseFloat(g.bet), 0);
            const profit: number = totalWinnings - totalBets;

            const historyText: string = games.length > 0
                ? games.map((g, i) => 
                    `- Game ${i + 1}: Chose ${g.choice}, Result: ${g.result}, ${g.won ? `Won: ${g.amount} MON` : `Lost, Bet: ${g.bet} MON`}`
                ).join('\n')
                : "No games found in the recent block range.";

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

// Tool untuk stake aprMON
server.tool(
    "stake-aprmon",
    "Stake MON to receive aprMON tokens on Monad testnet",
    {
        amount: z.string()
            .regex(/^\d+(\.\d+)?$/, { message: "Invalid amount, must be a positive number" })
            .describe("Amount of MON to stake (e.g., 1.0)"),
        receiver: z.string().regex(/^0x[a-fA-F0-9]{40}$/, { message: "Invalid Ethereum address" })
            .optional()
            .describe("Address to receive aprMON tokens (defaults to your wallet address)")
    },
    async ({ amount, receiver }: { amount: string; receiver?: string }) => {
        try {
            const amountWei: ethers.BigNumber = ethers.utils.parseEther(amount);
            const balance: ethers.BigNumber = await provider.getBalance(wallet.address);
            if (balance.lt(amountWei)) {
                throw new Error("Insufficient MON balance for staking and gas");
            }

            const contract: ethers.Contract = new ethers.Contract(
                "0xb2f82D0f38dc453D596Ad40A37799446Cc89274A",
                APRMON_ABI,
                wallet
            );

            const receiverAddress: string = receiver || wallet.address;
            const gasLimit: ethers.BigNumber = await contract.estimateGas.deposit(amountWei, receiverAddress, {
                value: amountWei
            });
            const bufferedGasLimit: ethers.BigNumber = gasLimit.mul(120).div(100);

            const tx: ethers.ContractTransaction = await contract.deposit(amountWei, receiverAddress, {
                value: amountWei,
                gasLimit: bufferedGasLimit,
                gasPrice: await provider.getGasPrice(),
            });

            const receipt: ethers.ContractReceipt = await tx.wait();
            let sharesReceived: string = "0";
            for (const log of receipt.logs) {
                try {
                    const parsedLog = contract.interface.parseLog(log);
                    if (parsedLog.name === "Deposit") {
                        sharesReceived = ethers.utils.formatEther(parsedLog.args.shares);
                        break;
                    }
                } catch (e) {
                    // Lanjutkan jika log bukan Deposit
                }
            }

            return {
                content: [
                    {
                        type: "text",
                        text: `Successfully staked ${amount} MON. Received ${sharesReceived} aprMON.\nTransaction Hash: ${receipt.transactionHash}`,
                    },
                ],
            };
        } catch (error: unknown) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to stake aprMON. Error: ${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
            };
        }
    }
);

// Tool untuk unstake aprMON
server.tool(
    "unstake-aprmon",
    "Request withdrawal of aprMON tokens on Monad testnet",
    {
        amount: z.string()
            .regex(/^\d+(\.\d+)?$/, { message: "Invalid amount, must be a positive number" })
            .describe("Amount of aprMON to withdraw (e.g., 1.0)"),
        controller: z.string().regex(/^0x[a-fA-F0-9]{40}$/, { message: "Invalid Ethereum address" })
            .optional()
            .describe("Address to control the withdrawal (defaults to your wallet address)")
    },
    async ({ amount, controller }: { amount: string; controller?: string }) => {
        try {
            const amountWei: ethers.BigNumber = ethers.utils.parseEther(amount);
            const contract: ethers.Contract = new ethers.Contract(
                "0xb2f82D0f38dc453D596Ad40A37799446Cc89274A",
                APRMON_ABI,
                wallet
            );

            const balance: ethers.BigNumber = await contract.balanceOf(wallet.address);
            if (balance.lt(amountWei)) {
                throw new Error("Insufficient aprMON balance");
            }

            const controllerAddress: string = controller || wallet.address;
            const gasLimit: ethers.BigNumber = await contract.estimateGas.requestRedeem(
                amountWei,
                controllerAddress,
                wallet.address
            );
            const bufferedGasLimit: ethers.BigNumber = gasLimit.mul(120).div(100);

            const tx: ethers.ContractTransaction = await contract.requestRedeem(
                amountWei,
                controllerAddress,
                wallet.address,
                {
                    gasLimit: bufferedGasLimit,
                    gasPrice: await provider.getGasPrice(),
                }
            );

            const receipt: ethers.ContractReceipt = await tx.wait();
            let requestId: string = "0";
            for (const log of receipt.logs) {
                try {
                    const parsedLog = contract.interface.parseLog(log);
                    if (parsedLog.name === "RedeemRequest") {
                        requestId = parsedLog.args.requestId.toString();
                        break;
                    }
                } catch (e) {
                    // Lanjutkan jika log bukan RedeemRequest
                }
            }

            return {
                content: [
                    {
                        type: "text",
                        text: `Unstake request submitted successfully.\n` +
                              `Request ID: ${requestId}\n` +
                              `Transaction Hash: ${receipt.transactionHash}\n` +
                              `Wait 10 minutes to claim with 'claim aprmon' using the Request ID above.`
                    },
                ],
            };
        } catch (error: unknown) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to request unstake aprMON. Error: ${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
            };
        }
    }
);

// Tool untuk klaim aprMON
server.tool(
    "claim-aprmon",
    "Claim MON tokens from a specific aprMON withdrawal request on Monad testnet",
    {
        requestId: z.number().int().min(1, { message: "Request ID must be a positive integer" })
            .describe("Request ID of the withdrawal to claim"),
        receiver: z.string().regex(/^0x[a-fA-F0-9]{40}$/, { message: "Invalid Ethereum address" })
            .optional()
            .describe("Address to receive MON tokens (defaults to your wallet address)")
    },
    async ({ requestId, receiver }: { requestId: number; receiver?: string }) => {
        try {
            const contract: ethers.Contract = new ethers.Contract(
                "0xb2f82D0f38dc453D596Ad40A37799446Cc89274A",
                APRMON_ABI,
                wallet
            );

            // Periksa apakah permintaan masih tertunda
            const shares: ethers.BigNumber = await contract.pendingRedeemRequest(requestId, wallet.address);
            if (shares.eq(0)) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `No pending aprMON redeem request found for Request ID ${requestId}. It may have been claimed or does not exist.`,
                        },
                    ],
                };
            }

            const receiverAddress: string = receiver || wallet.address;
            const gasLimit: ethers.BigNumber = await contract.estimateGas.redeem(requestId, receiverAddress);
            const bufferedGasLimit: ethers.BigNumber = gasLimit.mul(120).div(100);

            const tx: ethers.ContractTransaction = await contract.redeem(requestId, receiverAddress, {
                gasLimit: bufferedGasLimit,
                gasPrice: await provider.getGasPrice(),
            });

            const receipt: ethers.ContractReceipt = await tx.wait();
            let assetsClaimed: string = "0";
            let fee: string = "0";
            for (const log of receipt.logs) {
                try {
                    const parsedLog = contract.interface.parseLog(log);
                    if (parsedLog.name === "Redeem") {
                        assetsClaimed = ethers.utils.formatEther(parsedLog.args.assets);
                        fee = ethers.utils.formatEther(parsedLog.args.fee);
                        break;
                    }
                } catch (e) {
                    // Lanjutkan jika log bukan Redeem
                }
            }

            return {
                content: [
                    {
                        type: "text",
                        text: `Successfully claimed ${assetsClaimed} MON for Request ID ${requestId}.\n` +
                              `Fee: ${fee} MON\n` +
                              `Transaction Hash: ${receipt.transactionHash}`
                    },
                ],
            };
        } catch (error: unknown) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to claim aprMON for Request ID ${requestId}. ` +
                              `Error: ${error instanceof Error ? error.message : String(error)}`
                    },
                ],
            };
        }
    }
);

// Tool untuk mendapatkan saldo aprMON
server.tool(
    "get-aprmon-balance",
    "Get aprMON balance for an address on Monad testnet",
    {
        address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, { message: "Invalid Ethereum address" })
            .optional()
            .describe("Address to check aprMON balance for (defaults to your wallet address)")
    },
    async ({ address }: { address?: string }) => {
        try {
            const checkAddress: string = address || wallet.address;
            const contract = getContract({
                address: "0xb2f82D0f38dc453D596Ad40A37799446Cc89274A" as `0x${string}`,
                abi: APRMON_ABI,
                client: publicClient,
            });

            const balance = await contract.read.balanceOf([checkAddress as `0x${string}`]);
            const assets = await contract.read.convertToAssets([balance]);

            const balanceMon: string = formatUnits(balance, 18);
            const assetsMon: string = formatUnits(assets, 18);

            return {
                content: [
                    {
                        type: "text",
                        text: `Your aprMON balance: ${balanceMon} aprMON (worth ${assetsMon} MON)`,
                    },
                ],
            };
        } catch (error: unknown) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to retrieve aprMON balance. Error: ${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
            };
        }
    }
);

// Tool untuk mendapatkan rasio pertukaran aprMON
server.tool(
    "get-aprmon-rate",
    "Get the current aprMON/MON exchange rate on Monad testnet",
    {
        amount: z.string()
            .regex(/^\d+(\.\d+)?$/, { message: "Invalid amount, must be a positive number" })
            .optional()
            .describe("Amount to calculate rate for (default is 1)")
    },
    async ({ amount = "1" }: { amount?: string }) => {
        try {
            const amountWei: ethers.BigNumber = ethers.utils.parseEther(amount);
            const amountBigInt: bigint = BigInt(amountWei.toString());
            const contract = getContract({
                address: "0xb2f82D0f38dc453D596Ad40A37799446Cc89274A" as `0x${string}`,
                abi: APRMON_ABI,
                client: publicClient,
            });

            const assets = await contract.read.convertToAssets([amountBigInt]);
            const shares = await contract.read.convertToShares([amountBigInt]);

            const assetsMon: string = formatUnits(assets, 18);
            const sharesMon: string = formatUnits(shares, 18);

            return {
                content: [
                    {
                        type: "text",
                        text: `Current aprMON rate: ${amount} aprMON = ${assetsMon} MON, ${amount} MON = ${sharesMon} aprMON`,
                    },
                ],
            };
        } catch (error: unknown) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to retrieve aprMON rate. Error: ${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
            };
        }
    }
);

// Tool untuk mendapatkan daftar permintaan redeem aprMON
server.tool(
    "get-aprmon-requests",
    "Get list of pending aprMON redeem requests for an address on Monad testnet",
    {
        address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, { message: "Invalid Ethereum address" })
            .optional()
            .describe("Address to check redeem requests for (defaults to your wallet address)"),
        limit: z.number().int().min(1).max(100).optional().default(50)
            .describe("Maximum number of requests to retrieve (1-100, default 50)")
    },
    async ({ address, limit }: { address?: string; limit?: number }) => {
        try {
            const checkAddress: string = address || wallet.address;
            const contract: ethers.Contract = new ethers.Contract(
                "0xb2f82D0f38dc453D596Ad40A37799446Cc89274A",
                APRMON_ABI,
                provider
            );

            // Ambil blok terbaru dan tetapkan rentang untuk getLogs
            const latestBlock = await provider.getBlockNumber();
            const fromBlock = Math.max(0, latestBlock - 1000);

            // Ambil event RedeemRequest
            const filter = {
                address: "0xb2f82D0f38dc453D596Ad40A37799446Cc89274A",
                topics: [
                    contract.interface.getEventTopic("RedeemRequest"),
                    null,
                    ethers.utils.hexZeroPad(checkAddress, 32),
                ],
                fromBlock: fromBlock,
                toBlock: "latest"
            };
            const logs = await provider.getLogs(filter);

            // Filter permintaan yang masih tertunda
            const pendingRequests: { requestId: number; shares: string; created: string }[] = [];
            for (const log of logs.slice(0, limit)) {
                try {
                    const parsedLog = contract.interface.parseLog(log);
                    if (parsedLog.name === "RedeemRequest") {
                        const requestId = Number(parsedLog.args.requestId);
                        const shares: ethers.BigNumber = await contract.pendingRedeemRequest(requestId, checkAddress);
                        if (!shares.eq(0)) {
                            const block = await provider.getBlock(log.blockNumber);
                            const timestamp = new Date(block.timestamp * 1000).toLocaleString();
                            pendingRequests.push({
                                requestId,
                                shares: ethers.utils.formatEther(shares),
                                created: timestamp,
                            });
                        }
                    }
                } catch (e) {
                    // Lanjutkan jika log tidak valid
                }
            }

            const requestText: string = pendingRequests.length > 0
                ? pendingRequests
                    .map(r => `- Request ID: ${r.requestId}, Amount: ${r.shares} aprMON, Created: ${r.created}`)
                    .join('\n')
                : "No pending redeem requests found in the recent block range.";

            return {
                content: [
                    {
                        type: "text",
                        text: `Pending aprMON redeem requests for ${checkAddress}:\n${requestText}\nTotal: ${pendingRequests.length} requests`,
                    },
                ],
            };
        } catch (error: unknown) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to retrieve aprMON redeem requests. Error: ${error instanceof Error ? error.message : String(error)}`,
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
    console.error(`Loaded abis from: ${abisPath}`);
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