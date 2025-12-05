import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, query, limit, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Variabel Global dari Lingkungan Canvas
const appId = typeof __app_id !== 'undefined' ? __app_id : 'somnia-default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let app;
let db;
let auth;
let userId = null;
let isAuthReady = false;
let isWalletConnected = false;
let displayName = "Player Anon";

// Elemen UI
const startGameBtn = document.getElementById('startGameBtn');
const saveDisplayNameBtn = document.getElementById('saveDisplayNameBtn');
const playerNameGameDisplay = document.getElementById('playerNameGame');
const leaderboardList = document.getElementById('leaderboardList');
const modalOverlay = document.getElementById('customModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');


/**
 * @description Inisialisasi Firebase dan otentikasi pengguna.
 */
async function initializeFirebase() {
    console.log("Memulai inisialisasi Firebase...");
    
    if (!firebaseConfig) {
        window.updateFirebaseStatusUI("[ERROR KRITIS]", "Konfigurasi Firebase Hilang!", false);
        return;
    }

    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        
        // Logika Otentikasi
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
                // Jika tidak ada nama tampilan yang ditetapkan, gunakan sebagian UID sebagai default
                if (!localStorage.getItem('displayName')) {
                    displayName = "User#" + userId.substring(0, 6);
                } else {
                    displayName = localStorage.getItem('displayName');
                }
                
                isAuthReady = true;
                console.log(`Otentikasi Berhasil. UID: ${userId}`);
                window.updateFirebaseStatusUI("KONEKSI BERHASIL", `ID Pemain: ${displayName} (${userId.substring(0, 8)}...)`, true);
                
                // Aktifkan tombol save display name dan set nilai awal
                saveDisplayNameBtn.disabled = false;
                
                // Pastikan tombol Play Game hanya aktif setelah otentikasi berhasil
                if (isWalletConnected) {
                     startGameBtn.disabled = false;
                }
                
                // Mulai listener Leaderboard
                listenToLeaderboard();
                
            } else {
                console.log("Pengguna keluar atau otentikasi gagal.");
                userId = null;
                isAuthReady = true; // Tetapkan true agar kita tidak mengulang upaya auth
                window.updateFirebaseStatusUI("[Gagal Otentikasi]", "Tidak dapat masuk. Otentikasi Anonim Gagal.", false);
            }
        });
        
        // Coba masuk dengan token khusus atau anonim
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            await signInAnonymously(auth);
        }

    } catch (error) {
        console.error("Gagal saat inisialisasi atau otentikasi Firebase:", error);
        window.updateFirebaseStatusUI("[ERROR KRITIS]", `Kode: ${error.code} | Pesan: ${error.message}`, false);
    }
}

/**
 * @description Mensimulasikan koneksi ke dompet Web3.
 */
window.startOnchain = () => {
    console.log("Memulai simulasi koneksi dompet...");
    // Simulasi ethers.js
    if (typeof ethers !== 'undefined' && ethers.providers) {
        // Anggap koneksi berhasil
        isWalletConnected = true;
        window.updateConnectButtonUI(true);
        console.log("Simulasi Dompet Terhubung.");
        
        if (isAuthReady) {
            startGameBtn.disabled = false;
        }
    } else {
        console.warn("Ethers.js tidak termuat atau koneksi gagal disimulasikan.");
    }
};

/**
 * @description Menyimpan nama tampilan ke Firestore dan LocalStorage.
 */
saveDisplayNameBtn.addEventListener('click', async () => {
    const input = prompt("Masukkan nama tampilan Anda (maks 15 karakter):");
    if (input && input.trim().length > 0) {
        const newName = input.trim().substring(0, 15);
        displayName = newName;
        localStorage.setItem('displayName', newName);
        
        // Update di Firestore (di koleksi publik)
        if (db && userId) {
            try {
                const userRef = doc(db, `artifacts/${appId}/public/data/users/${userId}`);
                await setDoc(userRef, { displayName: newName, lastUpdate: new Date() }, { merge: true });
                console.log("Nama tampilan berhasil disimpan di Firestore.");
                window.updateFirebaseStatusUI("KONEKSI BERHASIL", `ID Pemain: ${displayName} (${userId.substring(0, 8)}...)`, true);
            } catch (e) {
                console.error("Error menyimpan nama tampilan:", e);
                showCustomModal("Error", "Gagal menyimpan nama tampilan ke database.");
            }
        } else {
             window.updateFirebaseStatusUI("KONEKSI GAGAL", "Silakan coba otentikasi ulang.", false);
        }
    }
});


/**
 * @description Menampilkan modal kustom.
 * @param {string} title Judul modal.
 * @param {string} message Pesan modal.
 */
window.showCustomModal = (title, message) => {
    modalTitle.innerText = title;
    modalMessage.innerHTML = message;
    modalOverlay.style.display = 'flex';
};


/**
 * @description Menyimpan skor tertinggi pemain.
 * @param {number} score Skor yang akan disimpan.
 */
window.saveScore = async (score) => {
    if (!db || !userId) {
        console.error("Database belum siap atau UID tidak ditemukan.");
        return;
    }

    try {
        const userRef = doc(db, `artifacts/${appId}/public/data/users/${userId}`);
        
        // Coba ambil skor lama (atau 0 jika tidak ada)
        // Kita tidak menggunakan getDoc di sini, kita biarkan logic di setDoc dengan merge
        
        // Karena aturan Firestore, kita TIDAK boleh menggunakan orderBy dan limit di sisi klien untuk mengambil skor tertinggi
        // Jadi, kita akan menganggap setiap pengguna hanya memiliki satu skor dan skor itu diupdate
        await setDoc(userRef, { 
            displayName: displayName, 
            score: score, 
            lastPlayed: new Date() 
        }, { merge: true });
        
        console.log(`Skor ${score} berhasil disimpan.`);
        
    } catch (e) {
        console.error("Gagal menyimpan skor:", e);
        showCustomModal("Error Database", "Gagal menyimpan skor tertinggi Anda.");
    }
};


/**
 * @description Mendengarkan perubahan data Leaderboard secara real-time.
 */
function listenToLeaderboard() {
    if (!db) return;
    
    // Path koleksi publik
    const leaderboardCollectionRef = collection(db, `artifacts/${appId}/public/data/users`);
    
    // Peringatan: Karena keterbatasan, kita akan menggunakan onSnapshot dan mengurutkan secara manual di klien.
    // Jika data terlalu besar, ini bisa menyebabkan masalah performa.
    // Query ini akan mengambil semua dokumen (pengguna)
    const q = query(leaderboardCollectionRef);

    onSnapshot(q, (snapshot) => {
        let scores = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.score && typeof data.score === 'number') {
                scores.push({
                    id: doc.id,
                    name: data.displayName || `User#${doc.id.substring(0, 6)}`,
                    score: data.score
                });
            }
        });

        // Urutkan skor secara manual (descending) dan ambil 10 teratas
        scores.sort((a, b) => b.score - a.score);
        const topScores = scores.slice(0, 10);
        
        updateLeaderboardUI(topScores);
    }, (error) => {
        console.error("Error mendengarkan leaderboard:", error);
        leaderboardList.innerHTML = `<p class="text-center text-red-500">Error memuat data leaderboard: ${error.message}</p>`;
    });
}


/**
 * @description Memperbarui UI modal Leaderboard.
 * @param {Array} scores Array skor yang diurutkan.
 */
function updateLeaderboardUI(scores) {
    if (scores.length === 0) {
        leaderboardList.innerHTML = '<p class="text-center text-gray-500">Belum ada skor yang tercatat.</p>';
        return;
    }

    leaderboardList.innerHTML = scores.map((item, index) => `
        <div class="leaderboard-item">
            <span class="leaderboard-name">#${index + 1} - ${item.name}</span>
            <span class="leaderboard-score">${item.score}</span>
        </div>
    `).join('');
}

// Hanya perlu dipanggil sekali saat pemuatan
window.fetchLeaderboard = () => {
    // Fungsi ini hanya ada untuk dipanggil oleh tombol, listener sudah berjalan
    console.log("Leaderboard dipanggil. Data diperbarui melalui listener.");
    // Tidak perlu melakukan apa-apa di sini karena listenToLeaderboard sudah berjalan
};


// Mulai proses inisialisasi Firebase saat dokumen dimuat
window.onload = initializeFirebase;
