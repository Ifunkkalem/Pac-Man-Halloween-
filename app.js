// app.js (Controller Script untuk index.html)

// Pastikan Ethers.js dimuat di index.html sebelum script ini.

// ---------------- CONFIG ----------------
const CONTRACT_ADDRESS = "0x35a7f3eE9A2b5fdEE717099F9253Ae90e1248AE3";
const CONTRACT_ABI = [
  "function startFeeWei() view returns (uint256)",
  "function startGame() payable",
  "function submitScore(uint256 _score)",
  // ABI KRITIS UNTUK MEMBACA DATA JACKPOT/TOP SCORE
  "function getTop10() view returns (address[] topPlayers, uint256[] scores)" // Kita pakai getTop10 untuk Top Score
];

const SOMNIA_RPC_URL = "https://somnia-rpc.publicnode.com";
const SOMNIA_CHAIN_ID = '0x13a7'; // 5031 in hex
const SOMNIA_NETWORK_CONFIG = {
    chainId: SOMNIA_CHAIN_ID,
    chainName: 'Somnia Mainnet',
    nativeCurrency: { name: 'SOMI', symbol: 'SOMI', decimals: 18 },
    rpcUrls: [SOMNIA_RPC_URL],
    blockExplorerUrls: ['https://explorer.somnia.network']
};

// ---------------- STATE ----------------
let provider = null;
let signer = null;
let userAddress = null;
let readContract = null;
let gameContract = null;
let startFeeWei = null;

// ---------------- HELPERS ----------------
function info(msg) { console.log("[APP.JS INFO]", msg); }
function sendWalletInfo() {
    if (!provider || !userAddress) return;
    provider.getBalance(userAddress).then(balWei => {
        window.postMessage({
            type: "walletInfo",
            address: userAddress,
            balance: Number(ethers.utils.formatEther(balWei)).toFixed(6)
        }, "*");
    }).catch(e => console.warn("Balance fetch failed", e));
}

// ---------------- LOAD SUMMARY DATA (JACKPOT & TOP SCORE) ----------------
async function loadSummaryData() {
  let tempReadContract;
  try {
    const tempProvider = new ethers.providers.JsonRpcProvider(SOMNIA_RPC_URL);
    tempReadContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, tempProvider);
    
    // 1. Ambil Top Score (Melalui getTop10)
    const [topPlayers, scores] = await tempReadContract.getTop10();
    const topScore = (scores.length > 0 && scores[0]) ? scores[0].toString() : '0';
    
    // 2. Ambil Jackpot (Pool Value = Balance Kontrak)
    const poolWei = await tempProvider.getBalance(CONTRACT_ADDRESS);
    const poolEth = Number(ethers.utils.formatEther(poolWei)).toFixed(6);
    
    // 3. Kirim data ke index.html (Wrapper)
    window.postMessage({ 
        type: "updateSummary", // Gunakan nama event ini di index.html jika perlu
        jackpot: poolEth,
        topScore: topScore
    }, "*");

  } catch (err) {
    console.error("Failed to load Jackpot/TopScore from contract:", err);
    window.postMessage({ type: "updateSummary", jackpot: "0.000000", topScore: 0 }, "*");
  }
}

// ---------------- WALLET & CONTRACT ----------------
async function switchNetwork(provider) {
    // Implementasi switchNetwork yang stabil
    // (Kode ini harus sudah ada di app.js yang kita kembangkan sebelumnya)
    try {
        const { chainId } = await provider.getNetwork();
        if (chainId.toString() === '5031') return true; 

        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: SOMNIA_CHAIN_ID }],
        });
        await new Promise(resolve => setTimeout(resolve, 500));
        return true;
    } catch (e) {
        if (e.code === 4902) { 
             await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [SOMNIA_NETWORK_CONFIG],
            });
             await new Promise(resolve => setTimeout(resolve, 500));
             return true;
        }
        alert("Failed to switch to Somnia network. Please switch manually.");
        return false;
    }
}

async function connectWallet() {
  if (!window.ethereum) {
    alert("No wallet provider found (MetaMask / WalletConnect).");
    return false;
  }
  try {
    provider = new ethers.providers.Web3Provider(window.ethereum, "any"); 
    await provider.send("eth_requestAccounts", []);
    
    const networkSwitched = await switchNetwork(provider);
    if (!networkSwitched) return false;
    
    // Re-initialize setelah network switch
    provider = new ethers.providers.Web3Provider(window.ethereum, "any"); 
    signer = provider.getSigner();
    userAddress = await signer.getAddress();
    
    readContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    gameContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    try {
      startFeeWei = await readContract.startFeeWei();
    } catch (e) {
      startFeeWei = ethers.utils.parseEther("0.01");
      console.warn("failed read startFeeWei:", e);
    }
    
    sendWalletInfo();
    loadSummaryData(); // Muat ulang data Jackpot/Top Score setelah terhubung

    return true;
  } catch (err) {
    console.error("connectWallet error", err);
    if (err.code !== 4001) {
        alert("Connect failed: " + (err && err.message ? err.message : String(err)));
    }
    return false;
  }
}

async function payToPlay() {
  if (!signer || !gameContract || !userAddress) {
    alert("Please connect wallet first.");
    await connectWallet(); // Coba picu koneksi jika belum ada
    if (!signer) return false;
  }

  const networkOk = await switchNetwork(provider);
  if (!networkOk) return false;
  
  if (!startFeeWei) {
    try { startFeeWei = await readContract.startFeeWei(); } catch(e){ startFeeWei = ethers.utils.parseEther("0.01"); }
  }
  
  try {
    const bal = await provider.getBalance(userAddress);
    if (bal.lt(startFeeWei)) {
      alert("Insufficient balance to pay start fee. Need " + ethers.utils.formatEther(startFeeWei) + " SOMI.");
      return false;
    }

    const tx = await gameContract.startGame({ value: startFeeWei });
    info("startGame tx sent: " + tx.hash);

    // Kirim sinyal ke index.html untuk menampilkan 'Waiting for Tx' jika perlu
    window.postMessage({ type: "startTxSent", txHash: tx.hash }, "*"); 

    alert("Transaction sent. Waiting for confirmation...");
    await tx.wait();
    
    info("Payment confirmed — game started on-chain.");

    // Kirim sinyal sukses ke index.html/iframe
    window.postMessage({ type: "paySuccess" }, "*");
    
    loadSummaryData(); 
    sendWalletInfo(); // Refresh balance
    
    return true;
  } catch (err) {
    console.error("payToPlay failed", err);
    if (err.code !== 4001) {
        alert("Payment failed: " + (err && err.message ? err.message : String(err)));
    }
    // Kirim sinyal untuk kembali ke logo jika transaksi gagal
    window.postMessage({ type: "forceShowLogo" }, "*");
    return false;
  }
}

async function submitScoreTx(score) {
  if (!gameContract || !signer || !userAddress) {
    alert("Please connect wallet before submitting score.");
    return;
  }
  if (!score || isNaN(Number(score)) || Number(score) <= 0) {
    alert("Invalid score.");
    return;
  }

  try {
    const tx = await gameContract.submitScore(Number(score));
    info("submitScore tx sent: " + tx.hash);
    alert("Score submission sent. Waiting for confirmation...");
    await tx.wait();
    alert("Score submitted on-chain ✅");
    
    // Refresh data Jackpot/Top Score setelah submit
    loadSummaryData(); 
    
    // Trigger Leaderboard untuk refresh (index.html akan handle navigasi)
    window.postMessage({ type: "showLeaderboard" }, "*");
    
  } catch (err) {
    console.error("submitScore error", err);
    if (err.code !== 4001) {
        alert("Submit score failed: " + (err && err.message ? err.message : String(err)));
    }
  }
}

// ---------------- MESSAGE HANDLER DARI index.html & IFRAME ----------------
window.addEventListener("message", async (ev) => {
  const data = ev.data || {};
  if (!data || typeof data !== "object") return;
  
  if (data.type === 'requestGameStatus') {
      // Merespons permintaan status dari iframe (pacman_xmas.html)
window.postMessage({ 
          type: 'gameStatusResponse', 
          // Menggunakan 'signer' sebagai proxy: jika signer ada, anggap sudah siap bermain.
          allowLocalPlay: !!signer 
      }, ev.origin);
    return;
  }
  
  if (data.type === "submitScore") {
    // Diterima dari pacman_xmas.html
    await submitScoreTx(data.score);
    return;
  }

  if (data.type === "requestConnectWallet") {
    // Diterima dari btnConnect di index.html
    await connectWallet();
    return;
  }

  if (data.type === "requestStartGame") {
    // Diterima dari btnPlay/overlayStart di index.html
    if (!signer) {
      const ok = await connectWallet();
      if (!ok) return;
    }
    await payToPlay();
    return;
  }
});

// ---------------- DOM READY: Initial Load ----------------
document.addEventListener("DOMContentLoaded", () => {
    // Muat data Jackpot/Top Score segera
    loadSummaryData(); 
    
    // Cek koneksi awal (best effort)
    (async ()=> {
      if (window.ethereum) {
        try {
          const tempProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
          const accounts = await tempProvider.listAccounts();
          if (accounts && accounts.length > 0) {
            await connectWallet(); 
          }
        } catch(e){ console.warn("Autoconnect check failed", e); }
      }
    })();
});

