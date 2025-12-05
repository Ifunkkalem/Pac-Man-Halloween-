/* game_logic.js */
// File ini hanya menangani rendering dan state game.
// PERUBAHAN UTAMA: Implementasi Permen (Candy) sebagai poin, Kondisi Menang (Win), dan Tampilan Ghost bertema Halloween.

let running = false;
let currentScore = 0; 
const PLAYER_SPEED = 4; // Kecepatan pergerakan pemain
const GHOST_SIZE = 20; // Radius hantu
const PLAYER_SIZE = 30; // Radius Pacman
const CANDY_VALUE = 10; // Nilai skor per permen

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");

// Player State
let x = 400; 
let y = 300; 
let vx = 0; 
let vy = 0; 
let currentDirection = 0; 

// --- GHOST MANAGEMENT (Tidak Berubah Logika, hanya tampilan) ---
let ghosts = [];

class Ghost {
    constructor(x, y, color, behavior, speed) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.behavior = behavior;
        this.speed = speed;
        this.radius = GHOST_SIZE;
        this.randomMoveCooldown = 0;
        this.vx = 0;
        this.vy = 0;
    }
}

// Logika pergerakan hantu (moveGhost dan checkCollision tidak berubah)
function moveGhost(ghost) {
    let targetX = x;
    let targetY = y;
    let dx = 0;
    let dy = 0;

    if (ghost.behavior === "chase" || ghost.behavior === "flee") {
        dx = targetX - ghost.x;
        dy = targetY - ghost.y;
        
        if (ghost.behavior === "flee") {
            dx *= -1;
            dy *= -1;
        }

        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0) {
            ghost.vx = (dx / distance) * ghost.speed;
            ghost.vy = (dy / distance) * ghost.speed;
        }
    } else if (ghost.behavior === "random") {
        ghost.randomMoveCooldown--;
        if (ghost.randomMoveCooldown <= 0) {
            ghost.vx = (Math.random() - 0.5) * ghost.speed * 2;
            ghost.vy = (Math.random() - 0.5) * ghost.speed * 2;
            ghost.randomMoveCooldown = 60; 
        }
    }

    ghost.x += ghost.vx;
    ghost.y += ghost.vy;

    if (ghost.x - ghost.radius < 0 || ghost.x + ghost.radius > canvas.width) {
        ghost.vx *= -1;
        ghost.x = Math.max(ghost.radius, Math.min(ghost.x, canvas.width - ghost.radius));
    }
    if (ghost.y - ghost.radius < 0 || ghost.y + ghost.radius > canvas.height) {
        ghost.vy *= -1;
        ghost.y = Math.max(ghost.radius, Math.min(ghost.y, canvas.height - ghost.radius));
    }
}

/**
 * MENGGAMBAR HANTU (Bentuk Halloween)
 */
function drawGhost(ghost) {
    const r = ghost.radius;
    const bodyHeight = 1.5 * r;

    ctx.fillStyle = ghost.color;
    ctx.beginPath();
    // Kepala (Arc)
    ctx.arc(ghost.x, ghost.y - r / 2, r, Math.PI, 0, false);
    // Badan (Garis lurus)
    ctx.lineTo(ghost.x + r, ghost.y + r);
    // Kaki/Bawah bergelombang
    ctx.lineTo(ghost.x + r * 0.75, ghost.y + r - 5);
    ctx.lineTo(ghost.x + r * 0.5, ghost.y + r);
    ctx.lineTo(ghost.x + r * 0.25, ghost.y + r - 5);
    ctx.lineTo(ghost.x, ghost.y + r);
    ctx.lineTo(ghost.x - r * 0.25, ghost.y + r - 5);
    ctx.lineTo(ghost.x - r * 0.5, ghost.y + r);
    ctx.lineTo(ghost.x - r * 0.75, ghost.y + r - 5);
    ctx.lineTo(ghost.x - r, ghost.y + r);
    
    ctx.closePath();
    ctx.fill();

    // Mata seram
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(ghost.x - r / 2, ghost.y - r / 2, 4, 0, 2 * Math.PI);
    ctx.arc(ghost.x + r / 2, ghost.y - r / 2, 4, 0, 2 * Math.PI);
    ctx.fill();
    
    // Iris mata (agar terlihat mengejar/menghindar)
    ctx.fillStyle = "black";
    const eyeDx = (x - ghost.x) / 10;
    const eyeDy = (y - ghost.y) / 10;
    ctx.beginPath();
    ctx.arc(ghost.x - r / 2 + eyeDx, ghost.y - r / 2 + eyeDy, 2, 0, 2 * Math.PI);
    ctx.arc(ghost.x + r / 2 + eyeDx, ghost.y - r / 2 + eyeDy, 2, 0, 2 * Math.PI);
    ctx.fill();
}

function checkCollision(ghost) {
    const dx = x - ghost.x;
    const dy = y - ghost.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < PLAYER_SIZE + ghost.radius; 
}


// --- CANDY (PERMEN) MANAGEMENT ---
let candy = [];

/**
 * Menyusun permen di canvas dalam bentuk grid sederhana.
 */
function setupCandy() {
    candy = [];
    const rows = 10;
    const cols = 15;
    const paddingX = 50;
    const paddingY = 50;
    const spacingX = (canvas.width - 2 * paddingX) / (cols - 1);
    const spacingY = (canvas.height - 2 * paddingY) / (rows - 1);

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            // Hindari menaruh permen di tengah (area start player)
            if (r > 3 && r < 6 && c > 5 && c < 9) continue; 
            
            candy.push({
                x: paddingX + c * spacingX,
                y: paddingY + r * spacingY,
            });
        }
    }
}

/**
 * Menggambar semua permen (labu/pumpkin) yang tersisa.
 */
function drawCandy() {
    ctx.fillStyle = "orange";
    for (const item of candy) {
        const radius = 6;
        // Gambar bentuk Labu (Pumpkin) sederhana
        ctx.beginPath();
        // Lingkaran utama (Labu)
        ctx.arc(item.x, item.y, radius, 0, 2 * Math.PI);
        ctx.fill();
        // Batang (stem)
        ctx.fillStyle = "green";
        ctx.fillRect(item.x - 1, item.y - radius - 3, 2, 3);
    }
}

/**
 * Cek apakah Pac-Man mengumpulkan permen.
 */
function checkCandyCollection() {
    for (let i = candy.length - 1; i >= 0; i--) {
        const item = candy[i];
        const dx = x - item.x;
        const dy = y - item.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Jika jarak kurang dari radius Pac-Man, maka permen terkumpul
        if (distance < PLAYER_SIZE) {
            currentScore += CANDY_VALUE;
            candy.splice(i, 1); // Hapus permen yang terkumpul

            // Cek Kondisi Menang
            if (candy.length === 0) {
                endGame(true); // Panggil endGame dengan status menang
                return true;
            }
        }
    }
    return false;
}


// --- PLAYER CONTROL & DRAW FUNCTIONS (Tidak Berubah) ---

function handleKeyDown(event) {
    if (!running) return;

    vx = 0;
    vy = 0;
    
    switch (event.key) {
        case "ArrowRight":
            vx = PLAYER_SPEED;
            currentDirection = 0; 
            break;
        case "ArrowLeft":
            vx = -PLAYER_SPEED;
            currentDirection = 1; 
            break;
        case "ArrowUp":
            vy = -PLAYER_SPEED;
            currentDirection = 2; 
            break;
        case "ArrowDown":
            vy = PLAYER_SPEED;
            currentDirection = 3; 
            break;
    }
}
window.addEventListener('keydown', handleKeyDown);

function drawPacman() {
    const radius = PLAYER_SIZE;
    let startAngle = 0;
    let endAngle = 2 * Math.PI;

    const mouthOpenness = Math.sin(Date.now() / 100) * 0.2 + 0.5;
    const mouthAngle = mouthOpenness * Math.PI / 4;

    switch (currentDirection) {
        case 0: // Kanan
            startAngle = mouthAngle;
            endAngle = 2 * Math.PI - mouthAngle;
            break;
        case 1: // Kiri
            startAngle = Math.PI + mouthAngle;
            endAngle = 3 * Math.PI - mouthAngle;
            break;
        case 2: // Atas
            startAngle = 1.5 * Math.PI + mouthAngle;
            endAngle = 3.5 * Math.PI - mouthAngle;
            break;
        case 3: // Bawah
            startAngle = 0.5 * Math.PI + mouthAngle;
            endAngle = 2.5 * Math.PI - mouthAngle;
            break;
    }
    
    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.arc(x, y, radius, startAngle, endAngle);
    ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();
}


/**
 * Game Loop Utama
 */
function loop() {
    requestAnimationFrame(loop);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!running) {
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.font = "30px 'Trebuchet MS', sans-serif";
        ctx.fillText("Click START to Pay and Play!", canvas.width / 2, canvas.height / 2);
        return;
    }
    
    // 1. GAMBAR PERMEN
    drawCandy();

    // 2. UPDATE POSISI PLAYER & BATAS
    x += vx;
    y += vy;
    
    if (x - PLAYER_SIZE < 0) { x = PLAYER_SIZE; vx = 0; }
    if (x + PLAYER_SIZE > canvas.width) { x = canvas.width - PLAYER_SIZE; vx = 0; }
    if (y - PLAYER_SIZE < 0) { y = PLAYER_SIZE; vy = 0; }
    if (y + PLAYER_SIZE > canvas.height) { y = canvas.height - PLAYER_SIZE; vy = 0; }
    
    // 3. GAMBAR PACMAN
    drawPacman();
    
    // 4. CEK PENGUMPULAN PERMEN
    checkCandyCollection();
    
    // 5. UPDATE DAN GAMBAR GHOSTS + CEK COLLISION
    for (const ghost of ghosts) {
        moveGhost(ghost);
        drawGhost(ghost);

        if (checkCollision(ghost)) {
            endGame(false); // Game Over karena tabrakan
            return; 
        }
    }
    
    // 6. Update Score UI
    scoreEl.innerText = currentScore;

    // Logika Game Over DUMMY (Jika pemain berhasil kabur terlalu lama tanpa mengumpulkan permen, skor mencapai 5000)
    // Ini adalah kondisi gagal jika player hanya menghindar dan tidak bermain.
    if (currentScore >= 5000) { 
        endGame(false);
        return;
    }
}

/**
 * Dipanggil oleh web3_game.js setelah transaksi startGame berhasil.
 */
function startGameLoop() {
    if (running) return;
    running = true;
    currentScore = 0;
    
    // INISIASI 3 GHOST
    ghosts = [
        new Ghost(50, 50, "#FF0000", "chase", 2.5),       // Merah (Chaser)
        new Ghost(750, 50, "#00FFFF", "random", 2.0),    // Cyan (Randomizer)
        new Ghost(50, 550, "#FF69B4", "flee", 1.5)       // Pink (Evader)
    ];
    
    // SETUP CANDY (Permen)
    setupCandy();

    // Reset posisi dan kecepatan player
    x = 400; 
    y = 300;
    vx = 0;
    vy = 0;
    currentDirection = 0;
    
    scoreEl.innerText = currentScore; 
    document.getElementById("startOnchainBtn").disabled = true;
    document.getElementById("startOnchainBtn").innerText = "GAME RUNNING...";
}

/**
 * Dipanggil ketika game over/win.
 * @param {boolean} isWin - True jika menang (kumpulkan semua permen).
 */
function endGame(isWin) {
    if (!running) return;
    running = false;
    
    if (isWin) {
        alert(`CONGRATULATIONS! Anda memenangkan permainan dengan skor penuh: ${currentScore}`);
    } else {
        alert(`GAME OVER! Final Score: ${currentScore}`);
    }
    
    // Panggil fungsi submitFinalScore dari web3_game.js
    if (typeof submitFinalScore === 'function') {
        submitFinalScore(currentScore); 
    } else {
        console.error("submitFinalScore tidak ditemukan. Transaksi tidak dikirim.");
    }
    
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

