/* game_logic.js */
// File ini hanya menangani rendering dan state game.

// Pastikan variabel global ini ada di scope window (atau dibuat di sini)
let running = false;
let currentScore = 0; // Ganti nama variabel dari 'score' menjadi 'currentScore' agar tidak bentrok

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");

// DUMMY GAME STATE
let x = 100;
let y = 300;
let dx = 3;

/**
 * Game Loop Utama
 */
function loop() {
    if (!running) {
        // Tampilkan pesan "Click Start to Play" jika game belum dimulai
        ctx.clearRect(0,0,800,600);
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.font = "30px Arial";
        ctx.fillText("Click START to Pay and Play!", 400, 300);
        return;
    }
    
    // --- Logika Game Anda ---
    ctx.clearRect(0,0,800,600);
    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.arc(x, y, 30, 0.25*Math.PI, 1.75*Math.PI);
    ctx.lineTo(x, y);
    ctx.fill();

    ctx.fillStyle = "red";
    ctx.fillRect(450, 280, 50, 50);

    x += dx;
    if (x > 750 || x < 50) dx *= -1;

    currentScore++;
    scoreEl.innerText = currentScore;
    
    // Logika Game Over (Contoh: mencapai skor 100)
    if (currentScore > 100) { 
        endGame();
        return;
    }
    // --- Akhir Logika Game ---

    requestAnimationFrame(loop);
}

/**
 * Dipanggil oleh web3_game.js setelah transaksi startGame berhasil.
 */
function startGameLoop() {
    if (running) return;
    running = true;
    currentScore = 0;
    x = 100;
    dx = 3; 
    loop(); // Mulai loop
}

/**
 * Dipanggil ketika game over/win.
 */
function endGame() {
    if (!running) return;
    running = false;
    alert(`GAME OVER! Final Score: ${currentScore}`);
    
    // PENTING: Panggil fungsi submitFinalScore dari web3_game.js
    // Fungsi submitFinalScore(score) harus tersedia di scope global/window.
    if (typeof submitFinalScore === 'function') {
        submitFinalScore(currentScore);
    } else {
        console.error("submitFinalScore tidak ditemukan. Transaksi tidak dikirim.");
    }
    
    // Beri kesempatan user melihat skor sebelum kembali ke menu
    document.getElementById("submitScoreBtn").disabled = false;
}

function backMenu() {
  window.location.href = "index.html";
}

// Mulai loop awal (menampilkan pesan "Click Start")
loop();
