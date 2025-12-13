// app.js (KODE STABIL ASLI ANDA + PERBAIKAN JACKPOT/LEADERBOARD)

// ---------------- CONFIG ----------------
const CONTRACT_ADDRESS = "0x35a7f3eE9A2b5fdEE717099F9253Ae90e1248AE3";
const CONTRACT_ABI = [
  "function startFeeWei() view returns (uint256)",
  "function startGame() payable",
  "function submitScore(uint256 _score)",
  // 🔥 ABI KRITIS UNTUK MEMBACA DATA JACKPOT/TOP SCORE
  "function getJackpot() view returns (uint256)",
  "function getTopScore() view returns (uint256)" 
];

// Somnia Network Configuration (Chain ID 5031)
const SOMNIA_CHAIN_ID = '0x13a7'; // 5031 in hex
const SOMNIA_NETWORK_CONFIG = {
    chainId: SOMNIA_CHAIN_ID,
    chainName: 'Somnia Mainnet',
    nativeCurrency: { name: 'SOMI', symbol: 'SOMI', decimals: 18 },
    rpcUrls: ['https://somnia-rpc.publicnode.com'],
    blockExplorerUrls: ['https://explorer.somnia.network']
};

// audio paths (relative to index.html)
const SFX_START_SRC = "assets/sfx_start.mp3";
const SFX_DOT_EAT_SRC = "assets/sfx_dot_eat.mp3";
const BGM_SRC = "assets/music_background.mp3"; 

// ---------------- STATE ----------------
let provider = null;
let signer = null;
let userAddress = null;
let readContract = null;
let gameContract = null;
let startFeeWei = null;

let backgroundMusic = null;
let sfxStart = null;
let sfxDot = null;
let audioUnlocked = false;
let isGameActive = false; 

// ---------------- HELPERS ----------------
const $ = (id) => document.getElementById(id);
const safeText = (id, txt) => { const el = $(id); if(el) el.textContent = txt; };

function initAudio() {
  if (sfxStart && sfxDot) return;
  try { sfxStart = new Audio(SFX_START_SRC); sfxStart.volume = 0.95; } catch(e){ sfxStart = null; }
  try { sfxDot = new Audio(SFX_DOT_EAT_SRC); sfxDot.volume = 0.8; } catch(e){ sfxDot = null; }
}

async function loadBackgroundMusic() {
    return new Promise((resolve) => {
        if (backgroundMusic && backgroundMusic.readyState >= 3) return resolve();
        
        try {
            backgroundMusic = new Audio(BGM_SRC);
            backgroundMusic.loop = true;
            backgroundMusic.volume = 0.35;
            
            backgroundMusic.addEventListener('canplaythrough', () => {
                resolve();
            }, { once: true });
            
            setTimeout(() => {
                if (!backgroundMusic || backgroundMusic.readyState < 3) {
                    resolve();
                }
            }, 10000); 
            
        } catch (e) { 
            backgroundMusic = null;
            resolve();
        }
    });
}

function unlockAudioOnGesture() {
  if (audioUnlocked) return;
  initAudio();
  
  const tryPlay = () => {
    if (sfxStart) {
        sfxStart.volume = 0; 
        sfxStart.play().then(() => {
            sfxStart.volume = 0.95; 
            audioUnlocked = true;
            window.removeEventListener('pointerdown', tryPlay);
        }).catch(() => {
             audioUnlocked = true;
             window.removeEventListener('pointerdown', tryPlay);
        });
    } else {
        audioUnlocked = true;
        window.removeEventListener('pointerdown', tryPlay);
    }
  };
  window.addEventListener('pointerdown', tryPlay, { once: true });
}

function playDotSound() {
  try {
    if (!audioUnlocked) initAudio();
    if (sfxDot) {
      const inst = sfxDot.cloneNode();
      inst.volume = sfxDot.volume;
      inst.play().catch(()=>{});
    }
  } catch (e) { console.warn("dot sound failed", e); }
}

function startBackgroundMusic() {
  try {
    if (backgroundMusic) {
      backgroundMusic.currentTime = 0; 
      backgroundMusic.volume = 0.35; 
      backgroundMusic.play().catch((e)=>{ console.error("Final BGM play failed:", e); }); 
    }
  } catch (e) { console.warn("bgm start failed", e); }
}

function playStartSfx() {
  try {
    if (sfxStart) { sfxStart.currentTime = 0; sfxStart.play().catch(()=>{}); }
  } catch (e) { console.warn("start sfx failed", e); }
}


// ---------------- LOAD SUMMARY DATA (BARU) ----------------
async function loadSummaryData() {
  if (!readContract) {
    // Jika belum ada koneksi, coba inisialisasi readContract secara minimal
    if (window.ethereum) {
        try {
            const tempProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
            readContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, tempProvider);
        } catch (e) {
            console.warn("Could not init temporary readContract:", e);
        }
    }
    if (!readContract) return;
  }
  
  try {
    const jackpotWei = await readContract.getJackpot();
    const jackpot = Number(ethers.utils.formatEther(jackpotWei)).toFixed(6);
    
    const topScore = await readContract.getTopScore();
    
    // Kirim data ke index.html (Wrapper) untuk ditampilkan
    window.postMessage({ 
        type: "updateSummary", 
        jackpot: jackpot,
        topScore: Number(topScore)
    }, "*");

  } catch (err) {
    console.error("Failed to load Jackpot/TopScore from contract:", err);
    // Kirim nilai default jika ada error baca
    window.postMessage({ 
        type: "updateSummary", 
        jackpot: "0.000000",
        topScore: 0
    }, "*");
  }
}

// ---------------- WALLET & CONTRACT ----------------
async function switchNetwork(provider) {
    const { chainId } = await provider.getNetwork();
    if (chainId.toString() !== '5031') {
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: SOMNIA_CHAIN_ID }],
            });
            await new Promise(resolve => setTimeout(resolve, 500));
            return true;
        } catch (switchError) {
            if (switchError.code === 4902) { 
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [SOMNIA_NETWORK_CONFIG],
                    });
                    await new Promise(resolve => setTimeout(resolve, 500));
                    return true;
                } catch (addError) {
                    alert("Failed to add Somnia network. Please add it manually.");
                    return false;
                }
            } else {
                 alert("Failed to switch to Somnia network. Please switch manually.");
                 return false;
            }
        }
    }
    return true;
}

async function connectWallet() {
  initAudio();
  unlockAudioOnGesture();

  if (!window.ethereum) {
    alert("No wallet provider found (MetaMask / WalletConnect).");
    return false;
  }
  try {
    provider = new ethers.providers.Web3Provider(window.ethereum, "any"); 
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    userAddress = await signer.getAddress();
    
    const networkSwitched = await switchNetwork(provider);
    if (!networkSwitched) return false;
    
    // Re-initialize after potential network switch
    provider = new ethers.providers.Web3Provider(window.ethereum, "any"); 
    signer = provider.getSigner();
    
    readContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    gameContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    
    safeText("walletAddr", "Wallet: " + userAddress.substring(0,6) + "..." + userAddress.slice(-4));
    
    try {
      // Data wallet/balance
      const balWei = await provider.getBalance(userAddress);
      window.postMessage({ 
          type: "walletInfo", 
          address: userAddress, 
          balance: Number(ethers.utils.formatEther(balWei)).toFixed(6)
      }, "*"); 
    } catch(e){ console.warn("balance fetch failed", e); }

    try {
      startFeeWei = await readContract.startFeeWei();
    } catch (e) {
      startFeeWei = ethers.utils.parseEther("0.01");
      console.warn("failed read startFeeWei:", e);
    }
    
    // 🔥 PANGGIL: Muat data Jackpot/Top Score setelah koneksi sukses
    await loadSummaryData(); 

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
  initAudio();
  unlockAudioOnGesture();

  if (!signer || !gameContract || !userAddress) {
    alert("Please connect wallet first.");
    return false;
  }

  const networkOk = await switchNetwork(provider);
  if (!networkOk) return false;
  
  if (!startFeeWei) {
    try { startFeeWei = await readContract.startFeeWei(); } catch(e){ startFeeWei = ethers.utils.parseEther("0.01"); }
  }
  
  await loadBackgroundMusic(); 

  try {
    const bal = await provider.getBalance(userAddress);
    if (bal.lt(startFeeWei)) {
      alert("Insufficient balance to pay start fee. Need " + ethers.utils.formatEther(startFeeWei) + " SOMI.");
      return false;
    }

    const tx = await gameContract.startGame({ value: startFeeWei });
    console.log("startGame tx:", tx.hash);
    try { window.postMessage({ type: "startTxSent", txHash: tx.hash }, "*"); } catch(e){}

    alert("Transaction sent. Waiting for confirmation...");
    await tx.wait();

    isGameActive = true;
    
    playStartSfx(); 
    startBackgroundMusic();
    
    const gameFrame = $("gameFrame");
    try { 
      // Kirim paySuccess ke index.html dan iframe game
      window.postMessage({ type: "paySuccess" }, "*");
      
      if (gameFrame && gameFrame.contentWindow) {
         gameFrame.contentWindow.postMessage({ type: "paySuccess" }, "*");
      }
    } catch(e){ console.warn("postMessage paySuccess failed", e); }

    // 🔥 PANGGIL: Refresh data Jackpot/Top Score setelah bayar
    await loadSummaryData(); 

    return true;
  } catch (err) {
    console.error("payToPlay failed", err);
    if (err.code !== 4001) {
        alert("Payment failed: " + (err && err.message ? err.message : String(err)));
    }
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
    if (backgroundMusic) { backgroundMusic.pause(); backgroundMusic.currentTime = 0; }
    const tx = await gameContract.submitScore(Number(score));
    console.log("submitScore tx:", tx.hash);
    alert("Score submission sent. Waiting for confirmation...");
    await tx.wait();
    alert("Score submitted on-chain ✅");
    
    // Refresh data Jackpot/Top Score setelah submit score
    await loadSummaryData(); 
    
    // Trigger Leaderboard untuk refresh
    window.postMessage({ type: "showLeaderboard" }, "*");
    
  } catch (err) {
    console.error("submitScore error", err);
    if (err.code !== 4001) {
        alert("Submit score failed: " + (err && err.message ? err.message : String(err)));
    }
  }
}

// ---------------- MESSAGE HANDLER ----------------
window.addEventListener("message", async (ev) => {
  const data = ev.data || {};
  if (!data || typeof data !== "object") return;

  if (data.type === "dotEaten") {
    if (isGameActive) playDotSound();
    return;
  }

  if (data.type === "submitScore") {
    await submitScoreTx(data.score);
    return;
  }
  
  if (data.type === "requestConnectWallet") {
    await connectWallet();
    return;
  }

  if (data.type === "requestStartGame") {
    if (!signer) {
      const ok = await connectWallet();
      if (!ok) return;
    }
    await payToPlay();
    return;
  }
});

// ---------------- DOM READY: wire UI ----------------
document.addEventListener("DOMContentLoaded", () => {
  initAudio();
  unlockAudioOnGesture();

  const btnConnect = $("connectWalletBtn");
  const btnPlay = $("playBtn");
  const btnLeaderboard = $("leaderboardBtn");

  if (btnConnect) btnConnect.addEventListener("click", async () => {
    await connectWallet();
  });

  if (btnPlay) btnPlay.addEventListener("click", async () => {
    if (!signer) {
      const ok = await connectWallet();
      if (!ok) return;
    }
    await payToPlay();
  });

  if (btnLeaderboard) btnLeaderboard.addEventListener("click", async () => {
    // Trigger Leaderboard di index.html
    window.postMessage({ type: "showLeaderboard" }, "*");
  });

  // Check connection status on load (best effort)
  (async ()=> {
    if (window.ethereum) {
      try {
        const tempProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
        const accounts = await tempProvider.listAccounts();
        if (accounts && accounts.length > 0) {
          await connectWallet(); 
        }
      } catch(e){ /* ignore failures on auto-check */ }
    }
    
    // 🔥 PANGGIL: Muat data Jackpot/Top Score saat startup
    await loadSummaryData(); 
  })();
});
  
