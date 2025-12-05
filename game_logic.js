/* game_logic.js */
// File ini hanya menangani rendering dan state game.

// Pastikan variabel global ini ada di scope window (atau dibuat di sini)
let running = false;
let currentScore = 0; 

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");

// DUMMY GAME STATE (Hanya untuk demonstrasi loop)
let x = 100;
let y = 300;
let dx = 3;

/**
 * Game Loop Utama
 */
function loop() {
    // requestAnimationFrame harus selalu di awal loop
    requestAnimationFrame(loop);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!running) {
        // Tampilkan pesan "Click Start to Pay and Play!"
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.font = "30px 'Trebuchet MS', sans-serif";
        ctx.fillText("Click START to Pay and Play!", canvas.width / 2, canvas.height / 2);
        return;
    }
    
    // --- Logika Game Anda ---
    
    // PACMAN
    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.arc(x, y, 30, 0.25 * Math.PI, 1.75 * Math.PI);
    ctx.lineTo(x, y);
    ctx.fill();

    // GHOST (Hantu)
    ctx.fillStyle = "red";
    ctx.fillRect(450, 280, 50, 50);

    // Pergerakan
    x += dx;
    if (x > canvas.width - 50 || x < 50) dx *= -1;

    currentScore++;
    scoreEl.innerText = currentScore;
    
    // Logika Game Over DUMMY (Contoh: mencapai skor 500)
    if (currentScore > 500) { 
        endGame();
        return;
    }
    // --- Akhir Logika Game ---
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
    scoreEl.innerText = currentScore; // Reset UI
    document.getElementById("startOnchainBtn").disabled = true;
    document.getElementById("startOnchainBtn").innerText = "GAME RUNNING...";
}

/**
 * Dipanggil ketika game over/win.
 */
function endGame() {
    if (!running) return;
    running = false;
    alert(`GAME OVER! Final Score: ${currentScore}`);
    
    // PENTING: Panggil fungsi submitFinalScore dari web3_game.js
    if (typeof submitFinalScore === 'function') {
        // Panggil fungsi submitFinalScore yang ada di web3_game.js
        submitFinalScore(currentScore); 
    } else {
        console.error("submitFinalScore tidak ditemukan. Transaksi tidak dikirim.");
    }
    
    // Aktifkan kembali tombol START setelah game berakhir
    document.getElementById("startOnchainBtn").disabled = false;
    document.getElementById("startOnchainBtn").innerText = "START GAME (0.01 SOMI)";
}

/**
 * Navigasi kembali ke menu (index.html).
 */
function backMenu() {
  window.location.href = "index.html";
}

// Mulai loop awal (menampilkan pesan "Click Start")
loop();

