// Import pustaka axios dan viem
import axios from 'axios';
import { formatUnits } from 'viem'; // Import formatUnits

// URL endpoint Alchemy API (Monad Testnet)
const alchemyUrl = 'https://monad-testnet.g.alchemy.com/v2/cf5mP0wO2bGjup-cIEF44ahqm1uDoV4D';

// Alamat yang ingin diperiksa saldo tokennya
const walletAddress = '0x374502FEDD31396e62388743645cD888C474fB2c';

// Fungsi async untuk mengambil metadata token
async function getTokenMetadata(contractAddress) {
  try {
    const response = await axios.post(alchemyUrl, {
      id: 1,
      jsonrpc: '2.0',
      method: 'alchemy_getTokenMetadata',
      params: [contractAddress]
    }, {
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json'
      }
    });
    if (response.data && response.data.result) {
      return response.data.result; // Mengembalikan { name, symbol, decimals, logo }
    }
    return null; // Kembalikan null jika metadata tidak ditemukan
  } catch (error) {
    console.error(`Error fetching metadata for ${contractAddress}:`, error.response ? error.response.data : error.message);
    return null; // Kembalikan null jika terjadi error
  }
}

// Fungsi async utama untuk mengirim permintaan dan menampilkan hasilnya
async function fetchTokenBalances() {
  console.log(`Fetching ERC20 token balances for address: ${walletAddress}...`);

  try {
    // 1. Ambil saldo token mentah
    const balanceResponse = await axios.post(alchemyUrl, {
      id: 1,
      jsonrpc: '2.0',
      method: 'alchemy_getTokenBalances',
      params: [walletAddress, 'erc20']
    }, {
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json'
      }
    });

    // Cek jika respons saldo berhasil dan ada data hasil
    if (balanceResponse.status === 200 && balanceResponse.data && balanceResponse.data.result && balanceResponse.data.result.tokenBalances) {
      const tokenBalances = balanceResponse.data.result.tokenBalances;

      console.log('\nToken Balances:');
      console.log('--------------------------------------------------');

      // 2. Ambil metadata untuk setiap token dan format hasilnya
      // Gunakan Promise.all untuk menjalankan permintaan metadata secara paralel
      const results = await Promise.all(tokenBalances.map(async (token) => {
        const metadata = await getTokenMetadata(token.contractAddress);
        const name = metadata?.name || 'Unknown Token';
        const symbol = metadata?.symbol || '???';
        const decimals = metadata?.decimals || 18; // Default ke 18 jika desimal tidak ada
        const rawBalance = BigInt(token.tokenBalance); // Konversi hex ke BigInt

        // Format saldo menggunakan formatUnits dari viem
        const formattedBalance = formatUnits(rawBalance, decimals);

        return {
          name,
          symbol,
          address: token.contractAddress,
          balance: formattedBalance
        };
      }));

      // 3. Cetak hasil yang sudah diformat
      if (results.length === 0) {
          console.log("No ERC20 tokens found for this address.");
      } else {
          console.log('Found tokens:');
          results
              .filter(tokenInfo => parseFloat(tokenInfo.balance) > 0)
              .forEach(tokenInfo => {
                  console.log(`${tokenInfo.name}: ${tokenInfo.balance} ${tokenInfo.symbol}`);
              });
      }
      console.log('--------------------------------------------------');

    } else {
      // Tangani jika ada error atau data saldo tidak sesuai format
      console.error('Error fetching token balances:', balanceResponse.data ? balanceResponse.data.error : 'Unknown error');
    }
  } catch (error) {
    // Tangani error jaringan atau error lainnya
    console.error('An error occurred:', error.response ? error.response.data : error.message);
  }
}

// Panggil fungsi untuk menjalankan skrip
fetchTokenBalances();