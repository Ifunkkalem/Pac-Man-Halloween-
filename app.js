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

// =======================================================
// 4. AUDIO INIT & UNLOCK (ANTI BLOKIR BROWSER)
// =======================================================
function unlockAudio() {
    if (isAudioUnlocked) return;

    gameStartSound = new Audio(SFX_START_SRC);
    dotEatSound = new Audio(SFX_DOT_EAT_SRC);
    backgroundMusic = new Audio(BGM_SRC);

    dotEatSound.volume = 0.7;
    gameStartSound.volume = 0.9;

    backgroundMusic.loop = true;
    backgroundMusic.volume = 0.35;

    backgroundMusic.play().then(()=>{
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
        isAudioUnlocked = true;
        console.log("✅ Audio unlocked");
    }).catch(()=>{});
}

window.addEventListener("pointerdown", unlockAudio, { once:true });

// =======================================================
// 5. WALLET CONNECT
// =======================================================
async function connectWallet() {
    unlockAudio();

    if (!window.ethereum) {
        alert("Wallet tidak ditemukan.");
        return;
    }

    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    userAddress = await signer.getAddress();

    document.getElementById("walletDisplay").innerText =
      userAddress.substring(0, 6) + "..." + userAddress.slice(-4);

    const balWei = await provider.getBalance(userAddress);
    document.getElementById("walletBalance").innerText =
      ethers.utils.formatEther(balWei) + " SOMI";

    readContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    gameContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    try {
        startFeeWei = await readContract.startFeeWei();
        document.getElementById("feeDisplay").innerText =
          ethers.utils.formatEther(startFeeWei);
    } catch {
        startFeeWei = ethers.utils.parseEther("0.01");
        document.getElementById("feeDisplay").innerText = "0.01 (Fallback)";
    }

    document.getElementById("playBtn").style.display = "block";
    document.getElementById("connectWalletBtn").style.display = "none";
}

// =======================================================
// 6. PAY TO PLAY (START GAME)
// =======================================================
async function payToPlay() {
    if (!gameContract || !userAddress) {
        alert("Connect wallet dulu.");
        return;
    }

    const balWei = await provider.getBalance(userAddress);
    if (balWei.lt(startFeeWei)) {
        alert("Saldo tidak cukup.");
        return;
    }

    const tx = await gameContract.startGame({ value: startFeeWei });
    await tx.wait();

    // ✅ PLAY AUDIO FINAL
    backgroundMusic.currentTime = 0;
    backgroundMusic.play().catch(()=>{});

    gameStartSound.currentTime = 0;
    gameStartSound.play().catch(()=>{});

    isGameActive = true;

    const iframe = document.getElementById("gameFrame");
    iframe.contentWindow.postMessage({ type: "paySuccess" }, "*");
    iframe.style.display = "block";
    document.getElementById("leaderboardFrame").style.display = "none";
}

// =======================================================
// 7. SUBMIT SCORE
// =======================================================
async function submitScoreTx(latestScore) {
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;

    const tx = await gameContract.submitScore(latestScore);
    await tx.wait();

    alert("✅ Score submitted!");
    loadLeaderboardFrame();
}

// =======================================================
// 8. LOAD LEADERBOARD
// =======================================================
function loadLeaderboardFrame() {
    document.getElementById("gameFrame").style.display = "none";
    const lb = document.getElementById("leaderboardFrame");
    lb.src = "leaderboard.html?ts=" + Date.now();
    lb.style.display = "block";
}

// =======================================================
// 9. MENERIMA EVENT DARI GAME (IFRAME)
// =======================================================
window.addEventListener("message", (ev) => {
    const data = ev.data || {};

    if (data.type === "submitScore") {
        submitScoreTx(data.score);
    }

    // ✅ DOT SOUND FINAL FIX
    if (data.type === "dotEaten" && isGameActive) {
        dotEatSound.currentTime = 0;
        dotEatSound.play().catch(()=>{
            const fresh = new Audio(SFX_DOT_EAT_SRC);
            fresh.volume = 0.7;
            fresh.play();
        });
    }
});

// =======================================================
// 10. MOBILE D-PAD
// =======================================================
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("connectWalletBtn").addEventListener("click", connectWallet);
    document.getElementById("playBtn").addEventListener("click", payToPlay);
    document.getElementById("leaderboardBtn").addEventListener("click", loadLeaderboardFrame);

    const gameFrame = document.getElementById("gameFrame");
    const dpad = document.getElementById("dpad-container-cross");

    function sendInput(direction) {
        if (isGameActive) {
            gameFrame.contentWindow.postMessage({
                type: "mobileInput",
                direction
            }, "*");
        }
    }

    dpad.querySelectorAll("button").forEach(btn => {
        const dir = btn.getAttribute("data-direction");

        btn.addEventListener("touchstart", () => sendInput(dir));
        btn.addEventListener("mousedown", () => sendInput(dir));
        btn.addEventListener("touchend", () => sendInput("STOP"));
        btn.addEventListener("mouseup", () => sendInput("STOP"));
    });
});
