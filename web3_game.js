/* web3_game.js */
// File ini menangani semua interaksi on-chain untuk halaman game dan Custom Modal.

// --- KONFIGURASI SOMNIA & KONTRAK ---
const LEADERBOARD_CONTRACT_ADDRESS = "0xD76b767102f2610b0C97FEE84873c1fAA4c7C365";
const START_FEE_WEI = "10000000000000000"; // 0.01 SOMI dalam Wei
const MAX_SCORE = 3000; 

// ABI (Hanya fungsi yang dibutuhkan di sini)
const LEADERBOARD_ABI = [
    "function startGame() payable",
    "function submitScore(uint256 score)",
    "function maxScore() view returns (uint256)",
];

// --- VARIABEL WEB3 ---
let WALLET_ADDRESS = null;
let provider = null;
let signer = null;
let leaderboardContract = null;
let gameIsReady = false; 

// --- FUNGSI CUSTOM MODAL (PENGGANTI alert() & confirm()) ---

/**
 * Menampilkan Modal Kustom yang tidak akan mem-freeze UI.
 * @param {string} title - Judul modal.
 * @param {string} message - Pesan yang akan ditampilkan.
 */
function showModal(title, message) {
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalMessage').innerText = message;
    document.getElementById('customModal').style.display = 'flex';
}

/**
 * Menampilkan Modal Konfirmasi Kustom (Menggantikan confirm()).
 * CATATAN: Karena tidak bisa menggunakan Promise/Async di sini, kita gunakan
 * confirm() bawaan hanya untuk transaksi kritis. Untuk pesan biasa, gunakan showModal.
 */


// --- FUNGSI UTAMA WEB3 ---

/**
 * Inisiasi Web3 saat halaman game dimuat.
 */
async function initWeb3() {
    if (!window.ethereum || typeof ethers === 'undefined') {
        showModal("Web3 Error", "Ethers.js atau MetaMask tidak terdeteksi. Tidak dapat berinteraksi on-chain.");
        document.getElementById("startOnchainBtn").disabled = true;
        document.getElementById("playerName").innerText = "Web3 Error";
        return;
    }

    try {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        WALLET_ADDRESS = await signer.getAddress();
        
        leaderboardContract = new ethers.Contract(LEADERBOARD_CONTRACT_ADDRESS, LEADERBOARD_ABI, signer);
        gameIsReady = true;

        const playerName = localStorage.getItem(`name_${WALLET_ADDRESS}`) || "Player";
        document.getElementById("playerName").innerText = playerName;

        document.getElementById("startOnchainBtn").disabled = false;
        document.getElementById("startOnchainBtn").innerText = "START GAME (0.01 SOMI)";


    } catch (error) {
        console.error("Inisialisasi Web3 Gagal:", error);
        showModal("Koneksi Gagal", "Gagal terhubung ke Somnia. Pastikan Anda sudah login di MetaMask.");
        document.getElementById("playerName").innerText = "Not Logged In";
    }
}


/**
 * Transaksi untuk memulai game (Membayar 0.01 SOMI).
 */
async function startOnchain() {
    if (!gameIsReady) {
        showModal("Web3 Error", "Koneksi Web3 belum siap. Silakan refresh halaman.");
        return;
    }
    
    if (typeof running !== 'undefined' && running) {
        showModal("Game Active", "Game sudah berjalan!");
        return;
    }

    // Menggunakan confirm bawaan untuk konfirmasi transaksi kritis
    if (!confirm(`Memulai game membutuhkan biaya 0.01 SOMI. Lanjutkan?`)) return;

    try {
        const startBtn = document.getElementById("startOnchainBtn");
        startBtn.disabled = true;
        startBtn.innerText = "Sending TX...";

        const tx = await leaderboardContract.startGame({
            value: START_FEE_WEI,
        });

        showModal("Transaksi Terkirim", "Transaksi startGame terkirim. Mohon tunggu konfirmasi...");
        await tx.wait();
        
        // Panggil fungsi startGameLoop() dari game_logic.js setelah sukses
        if (typeof startGameLoop === 'function') {
            startGameLoop(); 
            showModal("Game Started!", "Selamat bermain! Gunakan tombol panah untuk bergerak.");
        } else {
             showModal("System Error", "Transaksi sukses, namun startGameLoop() tidak ditemukan.");
        }

    } catch (error) {
        console.error("Transaksi startGame Gagal:", error);
        showModal("Transaksi Gagal", "Pembayaran 0.01 SOMI gagal. Cek saldo SOMI dan konsol.");
        
        const startBtn = document.getElementById("startOnchainBtn");
        startBtn.disabled = false;
        startBtn.innerText = "START GAME (0.01 SOMI)";
    }
}


/**
 * Transaksi untuk mengirim skor akhir ke kontrak.
 * Dipanggil secara otomatis oleh endGame() di game_logic.js.
 * @param {number} finalScore - Skor akhir game.
 */
async function submitFinalScore(finalScore) {
    if (!gameIsReady) {
        showModal("Web3 Error", "Koneksi Web3 belum siap. Skor tidak dapat dikirim.");
        return;
    }
    
    // Cap skor (Capping)
    if (finalScore > MAX_SCORE) finalScore = MAX_SCORE;

    // Menggunakan confirm bawaan untuk konfirmasi transaksi kritis
    if (!confirm(`Skor akhir yang akan dicatat: ${finalScore}. Kirim ke Leaderboard SOMNIA?`)) return;

    try {
        const submitBtn = document.getElementById("submitScoreBtn");
        submitBtn.disabled = true;
        submitBtn.innerText = "Submitting Score...";

        const tx = await leaderboardContract.submitScore(finalScore);
        showModal("Transaksi Skor", `Transaksi skor ${finalScore} terkirim. Menunggu konfirmasi...`);
        
        await tx.wait();
        showModal("Skor Tercatat", `Skor ${finalScore} berhasil dicatat di SOMNIA!`);
        
    } catch (error) {
        console.error("Gagal mencatat skor:", error);
        showModal("Submit Gagal", "Gagal mencatat skor. Cek konsol dan saldo gas.");
    } finally {
        const submitBtn = document.getElementById("submitScoreBtn");
        submitBtn.disabled = false;
        submitBtn.innerText = "SUBMIT SCORE (Auto)";
    }
}

// Inisiasi Web3 saat skrip dimuat
window.onload = initWeb3;
