// game.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, addDoc, collection, doc, getDoc, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ethers } from "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.umd.min.js";

setLogLevel('Debug');

// ====================================================================
// DOM ELEMENTS
// ====================================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('scoreDisplay');
const playerDisplay = document.getElementById('playerDisplay');
const startBtn = document.getElementById('startBtn');

let db = null;
let auth = null;
let firebaseReady = false;
let profileLoaded = false;

let playerProfile = { userId: null, displayName: null, walletAddress: null };
let gameScore = 0;
let gameRunning = false;

const TILE_SIZE = 40;
const GAME_MAP = [
    [1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,0,1,1,0,0,1],
    [1,0,1,0,0,0,1,0,0,1],
    [1,0,0,0,1,1,1,0,0,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1]
];

canvas.width = GAME_MAP[0].length * TILE_SIZE;
canvas.height = GAME_MAP.length * TILE_SIZE;

let pacman = { x: 50, y: 50, radius: 10, color: 'yellow', dx: 0, dy: 0, speed: 5 };

// ====================================================================
// FIREBASE & PROFILE
// ====================================================================

const appId = typeof __app_id !== 'undefined' ? __app_id : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const rawFirebaseConfig = typeof __firebase_config !== 'undefined' ? __firebase_config : null;

function formatWallet(address) {
    if (!address) return 'N/A';
    return `${address.substring(0,6)}...${address.slice(-4)}`;
}

async function fetchPlayerProfile(uid) {
    if (!db || !uid || !appId) return;
    const docRef = doc(db, 'artifacts', appId, 'users', uid, 'config', 'profile');
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            playerProfile.userId = uid;
            playerProfile.displayName = data.displayName || 'Anon Player';
            playerProfile.walletAddress = data.wallet || null;
        } else {
            playerProfile.userId = uid;
            playerProfile.displayName = 'Anon Player';
            playerProfile.walletAddress = null;
        }
    } catch (e) {
        console.error("Gagal memuat profil:", e);
    } finally {
        profileLoaded = true;
        updateHeaderDisplay();
        showStartScreen();
    }
}

async function initializeFirebase() {
    try {
        if (!rawFirebaseConfig || !appId) throw new Error("Firebase config not available.");
        const firebaseConfig = JSON.parse(rawFirebaseConfig);

        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        if (initialAuthToken) await signInWithCustomToken(auth, initialAuthToken);
        else await signInAnonymously(auth);

        onAuthStateChanged(auth, (user) => {
            if (user) {
                firebaseReady = true;
                fetchPlayerProfile(user.uid);
            }
        });
    } catch (err) {
        console.error("Firebase Init Error:", err);
        db = null;
        showStartScreen();
    }
}

// ====================================================================
// GAME FUNCTIONS
// ====================================================================

function drawMap() {
    ctx.fillStyle = '#000080';
    for (let y=0; y<GAME_MAP.length; y++) {
        for (let x=0; x<GAME_MAP[y].length; x++) {
            if (GAME_MAP[y][x]===1) ctx.fillRect(x*TILE_SIZE, y*TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
    }
}

function drawPacman() {
    ctx.beginPath();
    ctx.arc(pacman.x, pacman.y, pacman.radius, 0.2*Math.PI, 1.8*Math.PI);
    ctx.lineTo(pacman.x, pacman.y);
    ctx.closePath();
    ctx.fillStyle = pacman.color;
    ctx.fill();
}

function updateScore(points) {
    gameScore += points;
    scoreDisplay.textContent = `Score: ${gameScore}`;
}

function isWall(px, py) {
    const tx = Math.floor(px / TILE_SIZE);
    const ty = Math.floor(py / TILE_SIZE);
    return ty>=0 && ty<GAME_MAP.length && tx>=0 && tx<GAME_MAP[0].length && GAME_MAP[ty][tx]===1;
}

function isCollidingWithWall(x, y) {
    return [
        isWall(x-pacman.radius, y-pacman.radius),
        isWall(x+pacman.radius, y-pacman.radius),
        isWall(x-pacman.radius, y+pacman.radius),
        isWall(x+pacman.radius, y+pacman.radius)
    ].some(c => c);
}

function movePacman() {
    const nextX = pacman.x + pacman.dx;
    const nextY = pacman.y + pacman.dy;
    if (!isCollidingWithWall(nextX, nextY)) {
        pacman.x = nextX;
        pacman.y = nextY;
    } else {
        pacman.dx = 0;
        pacman.dy = 0;
    }
    if ((pacman.dx!==0 || pacman.dy!==0) && Math.floor(Date.now()/20)%20===0) updateScore(1);
}

function gameLoop() {
    if (!gameRunning) return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    drawMap();
    movePacman();
    drawPacman();
    if (gameScore>=100) { gameOver(); return; }
    requestAnimationFrame(gameLoop);
}

function resetGame() {
    gameScore = 0;
    scoreDisplay.textContent='Score: 0';
    pacman = { x:50, y:50, radius:10, color:'yellow', dx:0, dy:0, speed:5 };
    document.getElementById('txOverlay').classList.add('hidden');
    document.getElementById('gameOverOverlay').classList.add('hidden');
    startBtn.textContent='START GAME (Bayar 0.01 SOMI)';
    startBtn.disabled=false;
    drawMap();
    drawPacman();
}

function updateHeaderDisplay() {
    playerDisplay.innerHTML = `
        Player: ${playerProfile.displayName || 'Loading...'} <br>
        Wallet: <span style="font-size:0.8em;color:#c77dff;">${formatWallet(playerProfile.walletAddress)}</span>
    `;
}

function showStartScreen() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    drawMap();
    drawPacman();
    ctx.fillStyle='rgba(0,0,0,0.8)';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#ff8c00';
    ctx.font='24px Inter';
    ctx.textAlign='center';

    let message='Menghubungkan ke Database...';
    let canStart=false;

    if (db===null) message='ERROR KRITIS: Koneksi Database GAGAL.';
    else if (!profileLoaded) message='Memuat Profil Pemain dari Firestore...';
    else if (!playerProfile.walletAddress || !playerProfile.displayName) {
        message='Profil TIDAK Lengkap. Harap hubungkan Wallet & Isi Nama di Menu Utama.';
    } else {
        message='Click START untuk Bayar dan Main!';
        canStart=true;
    }

    ctx.fillText(message, canvas.width/2, canvas.height/2);
    startBtn.disabled=!canStart;
    if (!canStart && db!==null && profileLoaded) {
        startBtn.textContent='Kembali ke Menu (Profil Belum Lengkap)';
        startBtn.onclick=()=>window.location.href='index.html';
    }
}

// ====================================================================
// WEB3 TRANSACTION
// ====================================================================

const TARGET_ADDRESS='0x5ac99e984638792e33959A1d258aC00bA8810D32';
const PAYMENT_AMOUNT_ETH='0.0001';

async function startTransactionAndGame() {
    if (!playerProfile.walletAddress) return;

    startBtn.disabled=true;
    document.getElementById('txOverlay').classList.remove('hidden');
    document.getElementById('txStatusTitle').textContent="Memproses Transaksi...";
    document.getElementById('txStatusMessage').textContent=`Mengirim ${PAYMENT_AMOUNT_ETH} SOMI ke ${formatWallet(TARGET_ADDRESS)}...`;

    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const tx = { to: TARGET_ADDRESS, value: ethers.parseEther(PAYMENT_AMOUNT_ETH) };
        const txResponse = await signer.sendTransaction(tx);

        document.getElementById('txStatusTitle').textContent="Transaksi Dikirim";
        document.getElementById('txStatusMessage').textContent=`Menunggu konfirmasi blok... Hash: ${txResponse.hash.substring(0,10)}...`;

        await txResponse.wait();

        document.getElementById('txStatusTitle').textContent="TRANSAKSI BERHASIL!";
        document.getElementById('txStatusMessage').textContent="Pembayaran dikonfirmasi. Selamat bermain!";
        
        setTimeout(()=>{ document.getElementById('txOverlay').classList.add('hidden'); gameRunning=true; gameLoop(); }, 1000);

    } catch(err) {
        console.error("Transaksi GAGAL:", err);
        document.getElementById('txStatusTitle').textContent="Transaksi Gagal";
        document.getElementById('txStatusMessage').textContent="Transaksi dibatalkan atau terjadi kegagalan jaringan.";
        document.getElementById('closeTxOverlay').classList.remove('hidden');
        startBtn.disabled=false;
    }
}

// ====================================================================
// GAME OVER & SAVE SCORE
// ====================================================================

async function saveScoreToLeaderboard(score) {
    const saveStatusEl = document.getElementById('saveStatusMessage');

    if (!db || !playerProfile.walletAddress || !playerProfile.displayName || !appId) {
        saveStatusEl.style.color='red';
        saveStatusEl.textContent="CRITICAL: Database Global TIDAK SIAP. Skor TIDAK tersimpan.";
        return;
    }

    const scoreData = { walletAddress: playerProfile.walletAddress, displayName: playerProfile.displayName, score, timestamp:new Date().toISOString() };

    try {
        const leaderboardRef = collection(db, 'artifacts', appId, 'public', 'data', 'leaderboard');
        await addDoc(leaderboardRef, scoreData);
        saveStatusEl.style.color='#2ecc71';
        saveStatusEl.textContent="Skor berhasil disimpan ke Leaderboard Global!";
    } catch(e) {
        console.error("Gagal menyimpan skor:", e);
        saveStatusEl.style.color='red';
        saveStatusEl.textContent="CRITICAL: Gagal menyimpan skor ke Database Global.";
    }
}

async function gameOver() {
    gameRunning=false;
    document.getElementById('finalScore').textContent=gameScore;
    document.getElementById('gameOverOverlay').classList.remove('hidden');
    await saveScoreToLeaderboard(gameScore);

    document.getElementById('playAgainBtn').onclick=()=>{
        document.getElementById('gameOverOverlay').classList.add('hidden');
        resetGame(); showStartScreen();
    };
}

// ====================================================================
// EVENT LISTENERS
// ====================================================================

function setupEventListeners() {
    startBtn.addEventListener('click', startTransactionAndGame);

    document.addEventListener('keydown', (e)=>{
        if (!gameRunning) return;
        switch(e.key){
            case 'ArrowUp': pacman.dx=0; pacman.dy=-pacman.speed; break;
            case 'ArrowDown': pacman.dx=0; pacman.dy=pacman.speed; break;
            case 'ArrowLeft': pacman.dx=-pacman.speed; pacman.dy=0; break;
            case 'ArrowRight': pacman.dx=pacman.speed; pacman.dy=0; break;
        }
    });

    ['up','down','left','right'].forEach(dir=>{
        const btn=document.getElementById(dir+'Btn');
        btn.addEventListener('touchstart',(e)=>{ e.preventDefault();
            if(dir==='up'){ pacman.dx=0; pacman.dy=-pacman.speed; }
            if(dir==='down'){ pacman.dx=0; pacman.dy=pacman.speed; }
            if(dir==='left'){ pacman.dx=-pacman.speed; pacman.dy=0; }
            if(dir==='right'){ pacman.dx=pacman.speed; pacman.dy=0; }
        });
    });

    document.querySelectorAll('.control-btn').forEach(btn=>{
        btn.addEventListener('touchend',(e)=>{ e.preventDefault(); pacman.dx=0; pacman.dy=0; });
    });
}

function closeOverlay(id) { document.getElementById(id).classList.add('hidden'); }

window.onload = async function() {
    await initializeFirebase();
    setupEventListeners();
    resetGame();
    updateHeaderDisplay();
    showStartScreen();
};
