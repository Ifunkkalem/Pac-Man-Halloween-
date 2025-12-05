// --- FIREBASE IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    signInAnonymously, 
    signInWithCustomToken, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    collection, 
    query, 
    limit, 
    getDocs,
    serverTimestamp,
    setLogLevel
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// =========================================================================
// !!! PENTING: GANTI KONFIGURASI DI BAWAH INI DENGAN KONFIGURASI PROYEK ANDA !!!
//    Ini diperlukan saat menjalankan di luar lingkungan Canvas (mis. Vercel).
// =========================================================================
const HARDCODED_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBeHjlHJSB5R0mYJmX6h5uJ7Iwqu7zNWtA", // <--- GANTI INI
  authDomain: "somnia-hallowen.firebaseapp.com",
  projectId: "somnia-hallowen",
  storageBucket: "somnia-hallowen.appspot.com",
  messagingSenderId: "4412Y7353240",
  appId: "1:4412Y7353240:web:71343e5000d55e010c712f89",
};

const DUMMY_APP_ID = 'default-app-id';

// --- VARIABEL GLOBAL FIREBASE DAN AUTH ---
let app;
let db;
let auth;
let userId = null;
let dbStatus = "Initializing...";
let isAuthReady = false; 

// --- ELEMEN UI ---
const playerNameEl = document.getElementById('playerName');
const startButton = document.getElementById('startOnchainBtn');
const backMenuButton = document.getElementById('backMenuBtn');

// Fungsi untuk menampilkan modal kustom (disediakan di game.html)
function showModal(title, message) {
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalMessage').innerText = message;
    document.getElementById('customModal').style.display = 'flex';
}

/**
 * Inisialisasi Firebase (Memeriksa Lingkungan Canvas vs. Hardcode)
 */
async function initializeFirebase() {
    try {
        // Menggunakan Konfigurasi Canvas jika tersedia
        const firebaseConfig = typeof __firebase_config !== 'undefined' 
            ? JSON.parse(__firebase_config) 
            : HARDCODED_FIREBASE_CONFIG;
        
        // Menggunakan App ID Canvas jika tersedia
        const appId = typeof __app_id !== 'undefined' ? __app_id : DUMMY_APP_ID;

        if (!firebaseConfig || !firebaseConfig.apiKey || firebaseConfig.apiKey.includes("ANDA-HARUS-MENGGANTI-INI")) {
            throw new Error("Konfigurasi Firebase tidak valid. Harap ganti placeholder HARDCODED_FIREBASE_CONFIG.");
        }

        // Aktifkan logging debug untuk melihat status koneksi
        setLogLevel('debug');
        
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        dbStatus = "Connected to Firebase.";
        
        // 1. Setup Auth State Listener
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
                dbStatus = "User Authenticated.";
                playerNameEl.innerText = `ID: ${userId.substring(0, 8)}...`;
                isAuthReady = true; 
                startButton.disabled = false;
                startButton.innerText = "START GAME (0.01 SOMI)";
                
                // Panggil fungsi inisialisasi UI setelah auth siap (jika ada)
                // updateGameUI(); 
                console.log("Auth State Changed: User is signed in.");

            } else {
                // 2. Initial Sign-In Attempt
                try {
                    // Coba sign-in dengan token kustom jika ada (di Canvas)
                    if (typeof __initial_auth_token !== 'undefined') {
                        await signInWithCustomToken(auth, __initial_auth_token);
                    } else {
                        // Jika tidak ada token (di Vercel), sign-in Anonim
                        await signInAnonymously(auth);
                    }
                } catch (error) {
                    // Jika sign-in gagal, tetapkan status error
                    dbStatus = `Auth Error: ${error.code}`;
                    playerNameEl.innerText = `Auth Gagal!`;
                    isAuthReady = false;
                    startButton.disabled = true;
                    showModal("CRITICAL ERROR", "Gagal Otentikasi Firebase. Cek konsol untuk detail.");
                    console.error("Firebase Authentication Gagal:", error);
                }
            }
        });

    } catch (error) {
        dbStatus = "Config/Init Error";
        playerNameEl.innerText = `Konfigurasi GAGAL.`;
        startButton.disabled = true;
        showModal("CRITICAL ERROR", `Gagal Koneksi ke Firebase: ${error.message}`);
        console.error("Firebase Initialization Failed:", error);
    }
}

// =========================================================================
// --- GAME INTERAKSI (WEB3/SCORE) ---
// =========================================================================

/**
 * Simulasi Interaksi Wallet untuk memulai game.
 */
async function startOnchain() {
    if (!isAuthReady) {
        showModal("Kesalahan", "Database belum siap. Tunggu atau periksa konfigurasi Anda.");
        return;
    }
    
    // Logika Wallet (Simulasi): Cek ketersediaan Ethers
    if (typeof window.ethereum === 'undefined') {
        showModal("Peringatan", "MetaMask/Wallet tidak terdeteksi. Tidak dapat memulai Onchain.");
        console.error("Wallet not detected.");
        return;
    }

    try {
        startButton.disabled = true;
        startButton.innerText = "Transaksi diproses...";
        
        // 1. Hubungkan Wallet
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        
        // 2. Simulasi Transaksi (Placeholder)
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulasi penundaan transaksi 
        
        // Jika sukses:
        // Panggil fungsi startGameLoop dari game_logic.js
        if (typeof startGameLoop === 'function') {
            startGameLoop();
        } else {
            console.error("startGameLoop tidak ditemukan!");
            throw new Error("Fungsi Game Logic tidak terhubung.");
        }

    } catch (error) {
        startButton.disabled = false;
        startButton.innerText = "START GAME (0.01 SOMI)";
        const msg = error.message.includes("rejected") ? "Transaksi ditolak oleh pengguna." : "Gagal memulai Onchain. Cek konsol.";
        showModal("Submit Gagal", msg);
        console.error("Error during startOnchain:", error);
    }
}

/**
 * Mengirim skor akhir ke Firestore.
 * @param {number} finalScore - Skor yang dicapai pemain.
 */
async function submitFinalScore(finalScore) {
    if (!isAuthReady || !userId) {
        console.error("Submit dibatalkan: Auth belum siap atau userId hilang.");
        return;
    }
    
    // Tentukan lokasi data: /artifacts/{appId}/public/data/leaderboard/{documentId}
    const appId = typeof __app_id !== 'undefined' ? __app_id : DUMMY_APP_ID;
    const leaderboardRef = collection(db, 'artifacts', appId, 'public', 'data', 'leaderboard');
    
    try {
        const displayName = await fetchDisplayName();
        
        // Query untuk mencari skor terbaik yang sudah ada
        const q = query(leaderboardRef, limit(1)); // Cukup ambil 1 (asumsi 1 skor per user di implementasi ini)
        const snapshot = await getDocs(q);
        
        // Data yang akan disimpan
        const scoreData = {
            userId: userId,
            displayName: displayName,
            score: finalScore,
            timestamp: serverTimestamp() 
        };

        let docIdToUpdate = userId; // Gunakan UID sebagai ID dokumen

        // Simpan atau perbarui skor
        await setDoc(doc(leaderboardRef, docIdToUpdate), scoreData);
        
        console.log(`Skor ${finalScore} berhasil disubmit dengan ID: ${docIdToUpdate}`);

    } catch (error) {
        showModal("Submit Gagal", "Gagal mencatat skor. Cek konsol dan saldo.");
        console.error("Error submitting score to Firestore:", error);
    }
}

/**
 * Mengambil displayName yang disimpan pengguna
 */
async function fetchDisplayName() {
    if (!isAuthReady || !userId) return "Player Anonim";
    
    const appId = typeof __app_id !== 'undefined' ? __app_id : DUMMY_APP_ID;
    const profileRef = doc(db, 'artifacts', appId, 'users', userId, 'profile', 'data');
    
    try {
        // Simulasi: Karena Firestore hanya menyediakan doc() dan getDocs(), kita hanya
        // akan menampilkan "User ID" sebagai nama jika tidak ada nama yang disimpan.
        // Jika Anda memiliki implementasi `getDoc` yang berfungsi, gunakan itu.
        return `Player-${userId.substring(0, 5)}`;

    } catch(e) {
        console.warn("Failed to fetch display name:", e);
        return `Player-${userId.substring(0, 5)}`;
    }
}

// Panggil inisialisasi saat script dimuat
initializeFirebase();

// Ekspor fungsi untuk digunakan di game_logic.js dan HTML
window.startOnchain = startOnchain;
window.submitFinalScore = submitFinalScore;
// window.fetchLeaderboard = fetchLeaderboard; // Jika ada fungsi leaderboard
