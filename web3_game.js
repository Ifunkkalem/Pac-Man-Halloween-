/* web3_game.js */
// File ini menangani semua interaksi on-chain untuk halaman game.

// --- KONFIGURASI SOMNIA & KONTRAK (Sama seperti yang disepakati) ---
const LEADERBOARD_CONTRACT_ADDRESS = "0xD76b767102f2610b0C97FEE84873c1fAA4c7C365";
const START_FEE_WEI = "10000000000000000"; // 0.01 SOMI
const MAX_SCORE = 3000;

// ABI (Hanya fungsi yang dibutuhkan di sini)
const LEADERBOARD_ABI = [
    "function startGame() payable",
    "function submitScore(uint256 score)",
    // Jika Anda ingin mengambil nama, tambahkan di sini (jika ada kontrak Name Registry terpisah)
];

// --- VARIABEL WEB3 ---
let WALLET_ADDRESS = null;
let provider = null;
let signer = null;
let leaderboardContract = null;
let gameIsReady = false; // Status koneksi ke kontrak

// --- FUNGSI UTAMA WEB3 ---

/**
 * Inisiasi Web3 saat halaman game dimuat.
 * Diperlukan untuk memastikan koneksi ke SOMNIA.
 */
async function initWeb3() {
    if (!window.ethereum) {
        alert("MetaMask tidak terdeteksi. Tidak dapat berinteraksi on-chain.");
        document.getElementById("startOnchainBtn").disabled = true;
        return;
    }

    try {
        // Asumsi: Wallet sudah terhubung dan switch ke Somnia di index.html.
        // Kita hanya perlu inisiasi ulang provider/signer.
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        WALLET_ADDRESS = await signer.getAddress();
        
        leaderboardContract = new ethers.Contract(LEADERBOARD_CONTRACT_ADDRESS, LEADERBOARD_ABI, signer);
        gameIsReady = true;

        // Update status di UI (Opsional, tapi direkomendasikan)
        console.log(`Web3 Ready. Wallet: ${WALLET_ADDRESS}`);
        document.getElementById("startOnchainBtn").disabled = false; // Aktifkan tombol
        
        // Ambil nama dari local storage
        const playerName = localStorage.getItem(`name_${WALLET_ADDRESS}`) || "Player";
        document.getElementById("playerName").innerText = playerName;


    } catch (error) {
        console.error("Inisialisasi Web3 Gagal:", error);
        alert("Gagal terhubung ke Somnia Mainnet. Pastikan MetaMask Anda ter-switch dengan benar.");
    }
}


/**
 * Transaksi untuk memulai game (Membayar 0.01 SOMI).
 * Dipanggil oleh tombol 'START GAME'.
 */
async function startOnchain() {
    if (!gameIsReady) {
        alert("Koneksi Web3 belum siap. Silakan refresh halaman.");
        return;
    }

    if (running) {
        alert("Game sudah berjalan!");
        return;
    }

    if (!confirm(`Memulai game membutuhkan biaya 0.01 SOMI. Lanjutkan?`)) return;

    try {
        document.getElementById("startOnchainBtn").disabled = true;
        document.getElementById("startOnchainBtn").innerText = "Sending TX...";

        // Panggil fungsi startGame() di Kontrak, dan sertakan nilai 0.01 SOMI
        const tx = await leaderboardContract.startGame({
            value: START_FEE_WEI,
        });

        alert("Transaksi startGame terkirim. Mohon tunggu konfirmasi...");
        await tx.wait();
        
        alert("Pembayaran terkonfirmasi! Game dimulai.");
        
        // Mulai game lokal setelah transaksi sukses
        startGameLoop(); 

    } catch (error) {
        console.error("Transaksi startGame Gagal:", error);
        alert("Pembayaran 0.01 SOMI gagal. Cek saldo SOMI.");
        document.getElementById("startOnchainBtn").disabled = false;
        document.getElementById("startOnchainBtn").innerText = "START GAME (0.01 SOMI)";
    }
}


/**
 * Transaksi untuk mengirim skor akhir ke kontrak.
 * Dipanggil oleh endGame() di file game logic, BUKAN tombol.
 */
async function submitFinalScore(finalScore) {
    if (!gameIsReady) {
        alert("Koneksi Web3 belum siap. Skor tidak dapat dikirim.");
        return;
    }
    
    // Pastikan skor tidak melebihi batas Max Score
    if (finalScore > MAX_SCORE) finalScore = MAX_SCORE;

    if (!confirm(`Skor akhir ${finalScore}. Kirim ke Leaderboard SOMNIA? (Membutuhkan Gas Fee)`)) return;

    try {
        document.getElementById("submitScoreBtn").disabled = true;
        document.getElementById("submitScoreBtn").innerText = "Submitting Score...";

        // Panggil fungsi submitScore di kontrak
        const tx = await leaderboardContract.submitScore(finalScore);
        alert(`Transaksi skor ${finalScore} terkirim. Menunggu konfirmasi...`);
        
        await tx.wait();
        alert(`Skor ${finalScore} berhasil dicatat di SOMNIA!`);
        
    } catch (error) {
        console.error("Gagal mencatat skor:", error);
        alert("Gagal mencatat skor. Cek konsol dan saldo gas.");
    } finally {
        document.getElementById("submitScoreBtn").disabled = false;
        document.getElementById("submitScoreBtn").innerText = "SUBMIT SCORE";
    }
}

// Mulai inisiasi Web3 saat skrip dimuat
initWeb3();
