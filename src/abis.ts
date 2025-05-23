export const ERC20_ABI = [
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
    },
    {
        inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" }
        ],
        name: "approve",
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" }
        ],
        name: "allowance",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    }
] as const;

export const COINFLIP_ABI = [
    {
        inputs: [{ internalType: "enum CoinflipGame.Choice", name: "_choice", type: "uint8" }],
        name: "flipCoin",
        outputs: [],
        stateMutability: "payable",
        type: "function"
    },
    {
        inputs: [],
        name: "getTotalBalance",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, internalType: "address", name: "player", type: "address" },
            { indexed: false, internalType: "enum CoinflipGame.Choice", name: "playerChoice", type: "uint8" },
            { indexed: false, internalType: "bool", name: "result", type: "bool" },
            { indexed: false, internalType: "bool", name: "won", type: "bool" },
            { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
            { indexed: false, internalType: "uint256", name: "bet", type: "uint256" },
            { indexed: false, internalType: "bytes32", name: "requestId", type: "bytes32" }
        ],
        name: "FlipResult",
        type: "event"
    }
] as const;

export const APRMON_ABI = [
    {
        type: "function",
        name: "deposit",
        inputs: [
            { name: "assets", type: "uint256", internalType: "uint256" },
            { name: "receiver", type: "address", internalType: "address" }
        ],
        outputs: [{ name: "shares", type: "uint256", internalType: "uint256" }],
        stateMutability: "payable"
    },
    {
        type: "function",
        name: "requestRedeem",
        inputs: [
            { name: "shares", type: "uint256", internalType: "uint256" },
            { name: "controller", type: "address", internalType: "address" },
            { name: "owner", type: "address", internalType: "address" }
        ],
        outputs: [{ name: "requestId", type: "uint256", internalType: "uint256" }],
        stateMutability: "nonpayable"
    },
    {
        type: "function",
        name: "redeem",
        inputs: [
            { name: "requestId", type: "uint256", internalType: "uint256" },
            { name: "receiver", type: "address", internalType: "address" }
        ],
        outputs: [],
        stateMutability: "nonpayable"
    },
    {
        type: "function",
        name: "balanceOf",
        inputs: [{ name: "account", type: "address", internalType: "address" }],
        outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
        stateMutability: "view"
    },
    {
        type: "function",
        name: "convertToAssets",
        inputs: [{ name: "shares", type: "uint256", internalType: "uint256" }],
        outputs: [{ name: "assets", type: "uint256", internalType: "uint256" }],
        stateMutability: "view"
    },
    {
        type: "function",
        name: "convertToShares",
        inputs: [{ name: "assets", type: "uint256", internalType: "uint256" }],
        outputs: [{ name: "shares", type: "uint256", internalType: "uint256" }],
        stateMutability: "view"
    },
    {
        type: "function",
        name: "withdrawalFee",
        inputs: [],
        outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
        stateMutability: "view"
    },
    {
        type: "function",
        name: "pendingRedeemRequest",
        inputs: [
            { name: "requestId", type: "uint256", internalType: "uint256" },
            { name: "controller", type: "address", internalType: "address" }
        ],
        outputs: [{ name: "shares", type: "uint256", internalType: "uint256" }],
        stateMutability: "view"
    },
    {
        type: "event",
        name: "Deposit",
        inputs: [
            { name: "sender", type: "address", indexed: true, internalType: "address" },
            { name: "owner", type: "address", indexed: true, internalType: "address" },
            { name: "assets", type: "uint256", indexed: false, internalType: "uint256" },
            { name: "shares", type: "uint256", indexed: false, internalType: "uint256" }
        ],
        anonymous: false
    },
    {
        type: "event",
        name: "RedeemRequest",
        inputs: [
            { name: "controller", type: "address", indexed: true, internalType: "address" },
            { name: "owner", type: "address", indexed: true, internalType: "address" },
            { name: "requestId", type: "uint256", indexed: true, internalType: "uint256" },
            { name: "sender", type: "address", indexed: false, internalType: "address" },
            { name: "shares", type: "uint256", indexed: false, internalType: "uint256" },
            { name: "assets", type: "uint256", indexed: false, internalType: "uint256" }
        ],
        anonymous: false
    },
    {
        type: "event",
        name: "Redeem",
        inputs: [
            { name: "controller", type: "address", indexed: true, internalType: "address" },
            { name: "receiver", type: "address", indexed: true, internalType: "address" },
            { name: "requestId", type: "uint256", indexed: true, internalType: "uint256" },
            { name: "shares", type: "uint256", indexed: false, internalType: "uint256" },
            { name: "assets", type: "uint256", indexed: false, internalType: "uint256" },
            { name: "fee", type: "uint256", indexed: false, internalType: "uint256" }
        ],
        anonymous: false
    }
] as const;

export const UNISWAP_ROUTER_ABI = [
    {
        inputs: [
            { internalType: "uint256", name: "amountIn", type: "uint256" },
            { internalType: "uint256", name: "amountOutMin", type: "uint256" },
            { internalType: "address[]", name: "path", type: "address[]" },
            { internalType: "address", name: "to", type: "address" },
            { internalType: "uint256", name: "deadline", type: "uint256" }
        ],
        name: "swapExactTokensForTokens",
        outputs: [{ internalType: "uint256[]", name: "amounts", type: "uint256[]" }],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [
            { internalType: "uint256", name: "amountOutMin", type: "uint256" },
            { internalType: "address[]", name: "path", type: "address[]" },
            { internalType: "address", name: "to", type: "address" },
            { internalType: "uint256", name: "deadline", type: "uint256" }
        ],
        name: "swapExactETHForTokens",
        outputs: [{ internalType: "uint256[]", name: "amounts", type: "uint256[]" }],
        stateMutability: "payable",
        type: "function"
    },
    {
        inputs: [
            { internalType: "uint256", name: "amountIn", type: "uint256" },
            { internalType: "uint256", name: "amountOutMin", type: "uint256" },
            { internalType: "address[]", name: "path", type: "address[]" },
            { internalType: "address", name: "to", type: "address" },
            { internalType: "uint256", name: "deadline", type: "uint256" }
        ],
        name: "swapExactTokensForETH",
        outputs: [{ internalType: "uint256[]", name: "amounts", type: "uint256[]" }],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [
            { internalType: "uint256", name: "amountIn", type: "uint256" },
            { internalType: "address[]", name: "path", type: "address[]" }
        ],
        name: "getAmountsOut",
        outputs: [{ internalType: "uint256[]", name: "amounts", type: "uint256[]" }],
        stateMutability: "view",
        type: "function"
    }
] as const;

export const UNISWAP_FACTORY_ABI = [
    {
        inputs: [
            { internalType: "address", name: "tokenA", type: "address" },
            { internalType: "address", name: "tokenB", type: "address" }
        ],
        name: "getPair",
        outputs: [{ internalType: "address", name: "pair", type: "address" }],
        stateMutability: "view",
        type: "function"
    }
] as const;

export const UNISWAP_PAIR_ABI = [
    {
        inputs: [],
        name: "getReserves",
        outputs: [
            { internalType: "uint112", name: "_reserve0", type: "uint112" },
            { internalType: "uint112", name: "_reserve1", type: "uint112" },
            { internalType: "uint32", name: "_blockTimestampLast", type: "uint32" }
        ],
        stateMutability: "view",
        type: "function"
    }
] as const;

export const WMON_ABI = [
    {
        inputs: [],
        name: "deposit",
        outputs: [],
        stateMutability: "payable",
        type: "function"
    },
    {
        inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
        name: "withdraw",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    }
] as const;