// app.js
// Requires ethers v5 UMD loaded in index.html

// =======================================================
// 1. KONFIGURASI KONTRAK
// =======================================================
const CONTRACT_ADDRESS = "0x35a7f3eE9A2b5fdEE717099F9253Ae90e1248AE3";
const CONTRACT_ABI = [
  "function startFeeWei() view returns (uint256)",
  "function startGame() payable",
  "function submitScore(uint256 _score)"
];

// =======================================================
// 2. PATH AUDIO
// =======================================================
const SFX_START_SRC = 'assets/sfx_start.mp3';
const SFX_DOT_EAT_SRC = 'assets/sfx_dot_eat.mp3';
const BGM_SRC = 'assets/music_background.mp3';

// =======================================================
// 3. VARIABEL GLOBAL
// =======================================================
let provider, signer, userAddress;
let gameContract, readContract, startFeeWei;
let gameStartSound, dotEatSound, backgroundMusic;
let isGameActive = false;
let isAudioUnlocked = false;

// UI element refs (IDs used in your index.html)
const btnConnect = document.getElementById('btnConnect');
const btnPlay = document.getElementById('btnPlay');
const btnLeaderboard = document.getElementById('btnLeaderboard');
const walletAddrEl = document.getElementById('walletAddr');
const walletBalEl = document.getElementById('walletBal');
const gameFrame = document.getElementById('gameFrame');
const leaderFrame = document.getElementById('leaderFrame');
const logoPlaceholder = document.getElementById('logoPlaceholder');

// Safety: if some elements don't exist, don't throw
function $id(id){ try { return document.getElementById(id); } catch(e){return null;} }

// =======================================================
// 4. AUDIO INIT & UNLOCK (ANTI BLOKIR BROWSER)
// =======================================================
function initAudioElements(){
  if(gameStartSound && dotEatSound && backgroundMusic) return;
  try{
    gameStartSound = new Audio(SFX_START_SRC);
    dotEatSound = new Audio(SFX_DOT_EAT_SRC);
    backgroundMusic = new Audio(BGM_SRC);

    dotEatSound.volume = 0.7;
    gameStartSound.volume = 0.95;
    backgroundMusic.loop = true;
    backgroundMusic.volume = 0.35;
  }catch(e){
    console.warn("Audio init failed:", e);
  }
}

function unlockAudio(){
  if(isAudioUnlocked) return;
  initAudioElements();
  // Try a short play to unlock audio context. We pause immediately if succeed.
  if(backgroundMusic){
    backgroundMusic.play().then(()=>{
      backgroundMusic.pause();
      backgroundMusic.currentTime = 0;
      isAudioUnlocked = true;
      console.log("✅ Audio unlocked");
    }).catch((err)=>{
      // Some browsers block if no user gesture; we'll still set flag on actual user interactions
      console.warn("Audio play blocked (will retry on explicit actions):", err);
    });
  } else {
    isAudioUnlocked = true;
  }
}

// attach a gentle unlock on first user gesture anywhere
window.addEventListener('pointerdown', unlockAudio, { once: true });

// =======================================================
// 5. CONNECT WALLET (and send walletInfo to UI via postMessage)
// =======================================================
async function connectWalletAndNotify(shouldNotifyUI = true){
  unlockAudio();

  if(typeof ethers === 'undefined' || !window.ethereum){
    alert("Wallet/Ethers not found. Please open with an EVM wallet (Metamask/OKX/etc).");
    return false;
  }

  try{
    provider = new ethers.providers.Web3Provider(window.ethereum, "any");
    // Request accounts
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    userAddress = await signer.getAddress();

    // create contracts
    readContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    gameContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    // fetch balance
    const balWei = await provider.getBalance(userAddress);
    const balEth = ethers.utils.formatEther(balWei);

    // try read start fee
    try {
      startFeeWei = await readContract.startFeeWei();
    } catch(e){
      console.warn("read startFee failed, using fallback 0.01", e);
      startFeeWei = ethers.utils.parseEther("0.01");
    }

    // Update index UI elements directly if present
    if(walletAddrEl) walletAddrEl.textContent = `Wallet: ${userAddress.substring(0,6)}...${userAddress.slice(-4)}`;
    if(walletAddrEl) walletAddrEl.title = userAddress;
    if(walletBalEl) walletBalEl.textContent = `${Number(balEth).toFixed(6)} SOMI`;

    // Also send wallet info message (index may listen)
    try{
      window.postMessage({
        type: 'walletInfo',
        address: userAddress,
        balance: Number(balEth).toFixed(6)
      }, '*');
    }catch(e){console.warn("walletInfo postMessage failed", e);}

    console.log("Connected:", userAddress);
    return true;
  }catch(err){
    console.error("connectWallet error:", err);
    alert("Connect wallet failed: " + (err && err.message ? err.message : String(err)));
    return false;
  }
}

// =======================================================
// 6. PAY TO PLAY (START GAME on-chain)
// =======================================================
async function payToPlayAndStart(){
  unlockAudio();
  initAudioElements();

  if(!signer || !gameContract || !userAddress){
    alert("Please connect wallet first.");
    return false;
  }

  if(!startFeeWei){
    // try fetch again (read-only)
    try{
      startFeeWei = await readContract.startFeeWei();
    }catch(e){
      startFeeWei = ethers.utils.parseEther("0.01");
    }
  }

  const balWei = await provider.getBalance(userAddress);
  if(balWei.lt(startFeeWei)){
    alert("Insufficient native balance to pay start fee.");
    return false;
  }

  try{
    // UI hint: disable play button until tx mined (optional)
    if(btnPlay) btnPlay.disabled = true;

    const tx = await gameContract.startGame({ value: startFeeWei });
    console.log("startGame tx sent:", tx.hash);
    // Show a small notification to user (index overlay may show too)
    try{ window.postMessage({ type: 'startTxSent', txHash: tx.hash }, '*'); }catch(e){}
    await tx.wait();
    console.log("startGame tx mined");

    // Play audio now that game is unlocked
    try{
      if(backgroundMusic){ backgroundMusic.currentTime = 0; backgroundMusic.play().catch(()=>{}); }
      if(gameStartSound){ gameStartSound.currentTime = 0; gameStartSound.play().catch(()=>{}); }
    }catch(e){console.warn("audio play error", e);}

    isGameActive = true;

    // notify index & iframe
    try{ window.postMessage({ type: 'paySuccess' }, '*'); }catch(e){}
    try{
      if(gameFrame && gameFrame.contentWindow){
        gameFrame.contentWindow.postMessage({ type: 'paySuccess' }, '*');
      }
    }catch(e){console.warn("post paySuccess to iframe failed", e);}

    // show game iframe in the UI (index listens to paySuccess too but ensure here)
    if(gameFrame) gameFrame.style.display = 'block';
    if(leaderFrame) leaderFrame.style.display = 'none';
    if(logoPlaceholder) logoPlaceholder.style.display = 'none';

    // refresh top/pool info (index may display)
    try{ window.postMessage({ type:'refreshSummary' }, '*'); }catch(e){}

    return true;
  }catch(err){
    console.error("payToPlay error:", err);
    alert("Payment failed: " + (err && err.message ? err.message : String(err)));
    if(btnPlay) btnPlay.disabled = false;
    return false;
  }
}

// =======================================================
// 7. SUBMIT SCORE
// =======================================================
async function submitScoreTx(latestScore){
  if(!gameContract || !signer || !userAddress){
    alert("Connect wallet before submitting score.");
    return;
  }
  try{
    // pause music
    if(backgroundMusic){ backgroundMusic.pause(); backgroundMusic.currentTime = 0; }
    const tx = await gameContract.submitScore(latestScore);
    console.log("submitScore tx:", tx.hash);
    await tx.wait();
    alert("✅ Score submitted on-chain!");
    // optionally load leaderboard
    loadLeaderboardFrame();
  }catch(err){
    console.error("submitScore error:", err);
    alert("Failed to submit score: " + (err && err.message ? err.message : String(err)));
  }
}

// =======================================================
// 8. LOAD LEADERBOARD
// =======================================================
function loadLeaderboardFrame(){
  if(gameFrame) gameFrame.style.display = 'none';
  if(leaderFrame){
    leaderFrame.src = "leaderboard.html?ts=" + Date.now();
    leaderFrame.style.display = 'block';
  }
}

// =======================================================
// 9. MENERIMA EVENT DARI IFRAME / INDEX (postMessage)
// =======================================================
window.addEventListener('message', async (ev) => {
  const data = ev.data || {};
  if(!data || typeof data !== 'object') return;

  // If the index requested to start game (btnPlay or overlay)
  if(data.type === 'requestStartGame'){
    // If not connected, ask to connect first
    if(!signer || !userAddress){
      const ok = await connectWalletAndNotify();
      if(!ok) return;
    }
    // proceed to pay & start
    await payToPlayAndStart();
    return;
  }

  if(data.type === 'requestConnectWallet'){
    await connectWalletAndNotify();
    return;
  }

  // If iframe asks for the start fee (so it can display)
  if(data.type === 'requestStartFee'){
    try{
      if(!readContract){
        // create read-only provider if needed
        const rprov = provider || new ethers.providers.JsonRpcProvider();
        readContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, rprov);
      }
      let fee = startFeeWei;
      if(!fee){
        fee = await readContract.startFeeWei();
        startFeeWei = fee;
      }
      const feeEth = ethers.utils.formatEther(fee);
      // reply to iframe
      try{
        if(gameFrame && gameFrame.contentWindow){
          gameFrame.contentWindow.postMessage({ type: 'startFee', feeWei: fee.toString(), feeEth }, '*');
        }
      }catch(e){ console.warn("failed to reply startFee", e); }
    }catch(e){
      console.warn("requestStartFee error", e);
    }
    return;
  }

  // If index forwarded a submitScore (rare) or game iframe sends submitScore
  if(data.type === 'submitScore'){
    const score = Number(data.score || 0);
    if(isNaN(score) || score <= 0){
      console.warn("Invalid score from iframe:", data.score);
      return;
    }
    await submitScoreTx(score);
    return;
  }

  // Dot eaten sound from iframe
  if(data.type === 'dotEaten' && isGameActive){
    try{
      if(!dotEatSound) initAudioElements();
      if(dotEatSound){
        dotEatSound.currentTime = 0;
        dotEatSound.play().catch(()=> {
          // fallback create fresh
          const fresh = new Audio(SFX_DOT_EAT_SRC);
          fresh.volume = 0.7;
          fresh.play().catch(()=>{});
        });
      }
    }catch(e){ console.warn("dotEaten play failed", e); }
    return;
  }
});

// =======================================================
// 10. WIRE UP BUTTONS ON INDEX
// =======================================================
document.addEventListener('DOMContentLoaded', () => {
  // Index uses btnConnect, btnPlay, btnLeaderboard (see index.html)
  if(btnConnect) btnConnect.addEventListener('click', async (e) => {
    e.preventDefault();
    await connectWalletAndNotify();
  });

  if(btnPlay) btnPlay.addEventListener('click', async (e) => {
    e.preventDefault();
    // Instead of local start, we treat as request to start (ensures on-chain)
    // This mirrors what index does (it posts requestStartGame)
    if(!signer || !userAddress){
      const ok = await connectWalletAndNotify();
      if(!ok) return;
    }
    await payToPlayAndStart();
  });

  if(btnLeaderboard) btnLeaderboard.addEventListener('click', (e) => {
    e.preventDefault();
    loadLeaderboardFrame();
  });

  // If index has overlay Start that posts requestStartGame, it's already handled by message listener.

  // Optional: provide keyboard shortcuts for dev
  window.addEventListener('keydown', (e) => {
    if(e.key === 'p'){ // quick play dev
      if(!signer) connectWalletAndNotify();
      else payToPlayAndStart();
    }
  });

  // On load: try to initialize audio elements
  initAudioElements();
});

// =======================================================
// 11. UTILITY: send walletInfo to index if already connected (useful after hot-reload)
// =======================================================
async function notifyWalletInfoIfConnected(){
  if(!userAddress || !provider) return;
  try{
    const balWei = await provider.getBalance(userAddress);
    const balEth = ethers.utils.formatEther(balWei);
    window.postMessage({
      type: 'walletInfo',
      address: userAddress,
      balance: Number(balEth).toFixed(6)
    }, '*');
  }catch(e){ console.warn("notifyWalletInfoIfConnected failed", e); }
}

// call once in case we reloaded
notifyWalletInfoIfConnected();
