/* game_logic.js */
// File ini hanya menangani rendering dan state game.
// PERUBAHAN TEMA: Pac-Man -> Jack-O'-Lantern, Candy -> Soul Gems, Walls -> Stone.

let running = false;
let currentScore = 0; 
let gameStartTime = 0; 

// KONSTANTA GAME
const PLAYER_SPEED = 3.5; 
const PLAYER_SIZE = 20; 
const GHOST_SIZE = 15;  
const CANDY_VALUE = 10; 

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");

// POSISI AWAL AMAN (DIKIRI ATAS)
const START_X = 50; 
const START_Y = 50; 

// Player State
let x = START_X; // Posisi awal di kiri atas
let y = START_Y; 
let vx = 0; 
let vy = 0; 
let currentDirection = 0; 

// --- WALL MANAGEMENT (LABYRINTH KOMPLEKS) ---
const WALL_THICKNESS = 20;

const walls = [
    // 1. Perimeter (Batas Luar)
    { x: 0, y: 0, width: canvas.width, height: WALL_THICKNESS }, 
    { x: 0, y: canvas.height - WALL_THICKNESS, width: canvas.width, height: WALL_THICKNESS }, 
    { x: 0, y: 0, width: WALL_THICKNESS, height: canvas.height }, 
    { x: canvas.width - WALL_THICKNESS, y: 0, width: WALL_THICKNESS, height: canvas.height }, 
    
    // 2. Struktur Internal 
    // T-Blocks
    { x: 100, y: 100, width: 20, height: 100 }, 
    { x: 100, y: 180, width: 100, height: 20 }, 
    
    { x: 500, y: 100, width: 20, height: 100 }, 
    { x: 500, y: 100, width: 100, height: 20 },
    
    // Blok Horizontal Panjang
    { x: 100, y: 380, width: 200, height: 20 },
    { x: 500, y: 380, width: 200, height: 20 },

    // Pusat Labirin
    { x: 300, y: 280, width: 200, height: 20 },
    { x: 300, y: 300, width: 20, height: 100 },
    { x: 480, y: 300, width: 20, height: 100 },

    // Sudut Bawah
    { x: 100, y: 500, width: 100, height: 20 },
    { x: 600, y: 500, width: 100, height: 20 },
    { x: 180, y: 400, width: 20, height: 100 },
    { x: 600, y: 400, width: 20, height: 100 },
];

/**
 * Menggambar semua dinding (Labirin) dengan tema Batu Gelap.
 */
function drawWalls() {
    // Warna dinding: Deep Dark Gray/Blue untuk kesan batu gelap
    ctx.fillStyle = "#36454F"; 
    for (const wall of walls) {
        ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
    }
}

/**
 * Cek tabrakan AABB antara dua kotak.
 */
function checkAABBCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

/**
 * Mencegah Player menembus dinding.
 */
function checkPlayerWallCollision(newX, newY) {
    const playerRect = {
        x: newX - PLAYER_SIZE,
        y: newY - PLAYER_SIZE,
        width: 2 * PLAYER_SIZE, 
        height: 2 * PLAYER_SIZE
    };

    for (const wall of walls) {
        if (checkAABBCollision(playerRect, wall)) {
            return true; 
        }
    }
    return false; 
}


// --- GHOST MANAGEMENT ---
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

/**
 * Menghitung pergerakan hantu, mencegahnya menembus dinding.
 */
function moveGhost(ghost) {
    let targetX = x;
    let targetY = y;
    let dx = 0;
    let dy = 0;

    // Menghitung arah ke target (Logika tetap sama)
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
    
    // --- PENGECEKAN TABRAKAN DINDING UNTUK GHOST ---
    const newX = ghost.x + ghost.vx;
    const newY = ghost.y + ghost.vy;
    
    const ghostRect = {
        x: newX - ghost.radius,
        y: newY - ghost.radius,
        width: 2 * ghost.radius,
        height: 2 * ghost.radius
    };
    
    let collided = false;
    for (const wall of walls) {
        if (checkAABBCollision(ghostRect, wall)) {
            collided = true;
            
            if (ghost.vx !== 0) ghost.vx *= -1;
            if (ghost.vy !== 0) ghost.vy *= -1;
            
            if (ghost.behavior === "random") {
                ghost.randomMoveCooldown = 0; 
            }
            break;
        }
    }

    if (!collided) {
        ghost.x = newX;
        ghost.y = newY;
    }
}

/**
 * Menggambar Hantu
 */
function drawGhost(ghost) {
    const r = ghost.radius;
    
    // Warna Hantu sesuai tema (Ghost.color sudah diatur di startGameLoop)
    ctx.fillStyle = ghost.color;
    ctx.beginPath();
    ctx.arc(ghost.x, ghost.y - r / 2, r, Math.PI, 0, false);
    ctx.lineTo(ghost.x + r, ghost.y + r);
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

    // Gambar mata 
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.arc(ghost.x - r / 2, ghost.y - r / 2, 4, 0, 2 * Math.PI);
    ctx.arc(ghost.x + r / 2, ghost.y - r / 2, 4, 0, 2 * Math.PI);
    ctx.fill();
    
    // Pupil putih kecil untuk efek mata hantu
    ctx.fillStyle = "white";
    const eyeDx = (x - ghost.x) / 10;
    const eyeDy = (y - ghost.y) / 10;
    ctx.beginPath();
    ctx.arc(ghost.x - r / 2 + eyeDx, ghost.y - r / 2 + eyeDy, 1, 0, 2 * Math.PI);
    ctx.arc(ghost.x + r / 2 + eyeDx, ghost.y - r / 2 + eyeDy, 1, 0, 2 * Math.PI); 
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
 * Menyusun permen di canvas. (Logika tetap sama)
 */
function setupCandy() {
    candy = [];
    const rows = 12; 
    const cols = 20; 
    const paddingX = 40;
    const paddingY = 40;
    const spacingX = (canvas.width - 2 * paddingX) / (cols - 1);
    const spacingY = (canvas.height - 2 * paddingY) / (rows - 1);
    
    const candyRectSize = 10; 

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const candyX = paddingX + c * spacingX;
            const candyY = paddingY + r * spacingY;
            
            // Hindari area awal player
            if (Math.abs(candyX - START_X) < 40 && Math.abs(candyY - START_Y) < 40) continue; 
            
            let isInsideWall = false;
            const candyRect = {
                x: candyX - candyRectSize / 2, 
                y: candyY - candyRectSize / 2, 
                width: candyRectSize, 
                height: candyRectSize
            };

            for (const wall of walls) {
                const collisionMargin = 5; 
                const wallCheck = {
                    x: wall.x - collisionMargin,
                    y: wall.y - collisionMargin,
                    width: wall.width + 2 * collisionMargin,
                    height: wall.height + 2 * collisionMargin
                };
                
                if (checkAABBCollision(candyRect, wallCheck)) {
                    isInsideWall = true;
                    break;
                }
            }

            if (!isInsideWall) {
                candy.push({ x: candyX, y: candyY });
            }
        }
    }
}

/**
 * Menggambar semua permen sebagai Soul Gems.
 */
function drawCandy() {
    ctx.fillStyle = "#32cd32"; // Slime Green untuk Soul Gems
    ctx.shadowColor = "#32cd32";
    ctx.shadowBlur = 8; // Efek glowing

    for (const item of candy) {
        const radius = 3; 
        ctx.beginPath();
        // Gambar kotak kecil (Gem)
        ctx.fillRect(item.x - radius, item.y - radius, radius * 2, radius * 2);
    }
    
    ctx.shadowBlur = 0; // Matikan shadow setelah menggambar permen
}

/**
 * Cek apakah Jack-O'-Lantern mengumpulkan Soul Gem. (Logika tetap sama)
 */
function checkCandyCollection() {
    for (let i = candy.length - 1; i >= 0; i--) {
        const item = candy[i];
        const dx = x - item.x;
        const dy = y - item.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < PLAYER_SIZE) { 
            currentScore += CANDY_VALUE;
            candy.splice(i, 1); 

            if (candy.length === 0) {
                endGame(true); 
                return true;
            }
        }
    }
    return false;
}


// --- PLAYER CONTROL & DRAW FUNCTIONS ---

/**
 * Fungsi untuk mengatur arah pergerakan (dipanggil oleh tombol mobile dan keyboard).
 */
function setDirection(key) {
    if (!running) return;

    vx = 0;
    vy = 0;
    
    switch (key) {
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

function handleKeyDown(event) {
    setDirection(event.key);
}

window.addEventListener('keydown', handleKeyDown);


/**
 * Menggambar Pac-Man sebagai Jack-O'-Lantern (Labu Menyala).
 */
function drawPacman() {
    const radius = PLAYER_SIZE;
    let startAngle = 0;
    let endAngle = 2 * Math.PI;

    // Pergerakan mulut (tetap digunakan untuk animasi mengunyah)
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
    
    // 1. Gambar Labu (Warna Orange)
    ctx.fillStyle = "#ff8c00"; 
    ctx.shadowColor = "#ff8c00";
    ctx.shadowBlur = 10; // Efek Glow Labu

    ctx.beginPath();
    ctx.arc(x, y, radius, startAngle, endAngle);
    ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0; // Matikan shadow untuk detail wajah

    // 2. Gambar Wajah Labu (Triangular Eyes and Mouth)
    ctx.fillStyle = "black";
    ctx.beginPath();
    
    // Mata Kiri (Triangle)
    ctx.moveTo(x - 5, y - 5);
    ctx.lineTo(x - 10, y - 10);
    ctx.lineTo(x - 10, y);
    ctx.closePath();

    // Mata Kanan (Triangle)
    ctx.moveTo(x + 5, y - 5);
    ctx.lineTo(x + 10, y - 10);
    ctx.lineTo(x + 10, y);
    ctx.closePath();
    
    // Mulut (V shape atau Triangle) - disembunyikan jika mulut mengunyah
    if (mouthOpenness < 0.6) {
        ctx.moveTo(x + 5, y + 5);
        ctx.lineTo(x, y + 10);
        ctx.lineTo(x - 5, y + 5);
        ctx.closePath();
    }
    
    ctx.fill();
    
    // Batang Labu (Stem)
    ctx.fillStyle = "green";
    ctx.fillRect(x - 2, y - radius - 5, 4, 5); 
}


/**
 * Game Loop Utama
 */
function loop() {
    requestAnimationFrame(loop);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!running) {
        // Teks Menu Awal Diperbarui dengan Branding Somnia
        ctx.fillStyle = "#4b0082"; // Deep Indigo/Ungu
        ctx.textAlign = "center";
        ctx.font = "40px 'Inter', sans-serif";
        ctx.fillText("SOMNIA", canvas.width / 2, canvas.height / 2 - 80);

        ctx.fillStyle = "#ff8c00"; // Dark Orange
        ctx.font = "36px 'Inter', sans-serif";
        ctx.fillText("LABYRINTH OF HORRORS", canvas.width / 2, canvas.height / 2 - 30);
        
        ctx.fillStyle = "#32cd32"; // Slime Green
        ctx.font = "24px 'Inter', sans-serif";
        ctx.fillText("Kumpulkan Soul Gems & Hindari Hantu!", canvas.width / 2, canvas.height / 2 + 30);
        
        ctx.fillStyle = "#f0f0f0";
        ctx.font = "18px 'Inter', sans-serif";
        ctx.fillText("Tekan tombol START di bawah ini.", canvas.width / 2, canvas.height / 2 + 80);
        
        drawWalls(); 
        
        return;
    }
    
    // Hitung waktu berjalan
    const timeElapsed = Date.now() - gameStartTime;
    const isGameActive = timeElapsed > 1000; 
    
    // 1. GAMBAR DINDING (LABIRIN)
    drawWalls();

    // 2. UPDATE POSISI PLAYER & BATAS (Logika tetap sama)
    const newX = x + vx;
    const newY = y + vy;

    if (!checkPlayerWallCollision(newX, y)) {
        x = newX;
    } else {
        vx = 0; 
    }
    
    if (!checkPlayerWallCollision(x, newY)) {
        y = newY;
    } else {
        vy = 0; 
    }

    const perimeterMargin = WALL_THICKNESS + PLAYER_SIZE;
    if (x < perimeterMargin) { x = perimeterMargin; vx = 0; }
    if (x > canvas.width - perimeterMargin) { x = canvas.width - perimeterMargin; vx = 0; }
    if (y < perimeterMargin) { y = perimeterMargin; vy = 0; }
    if (y > canvas.height - perimeterMargin) { y = canvas.height - perimeterMargin; vy = 0; }
    
    // 3. GAMBAR JACK-O'-LANTERN
    drawPacman();
    
    // 4. GAMBAR DAN CEK PENGUMPULAN SOUL GEMS
    drawCandy();
    checkCandyCollection();
    
    // 5. UPDATE DAN GAMBAR GHOSTS + CEK COLLISION
    for (const ghost of ghosts) {
        if (isGameActive) {
            moveGhost(ghost);
            if (checkCollision(ghost)) {
                endGame(false); 
                return; 
            }
        }
        drawGhost(ghost); 
    }
    
    // 6. Update Score UI
    scoreEl.innerText = currentScore;
}

/**
 * Dipanggil oleh web3_game.js setelah transaksi startGame berhasil.
 */
function startGameLoop() {
    if (running) return;
    running = true;
    currentScore = 0;
    
    gameStartTime = Date.now(); 
    
    // INISIASI GHOSTS DENGAN WARNA TEMA HOROR
    ghosts = [
        new Ghost(40, 40, "#FF4500", "chase", 2.0),       // Merah Tua (Blood Orange)
        new Ghost(760, 40, "#6A5ACD", "random", 2.0),    // Slate Blue (Haunted)
        new Ghost(760, 560, "#32cd32", "flee", 1.5)       // Slime Green (Toxic)
    ];
    
    setupCandy();

    // Reset posisi dan kecepatan player ke posisi aman
    x = START_X; 
    y = START_Y;
    vx = 0;
    vy = 0;
    currentDirection = 0; 
    setDirection('ArrowRight'); 
    
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
    
    const timeElapsed = Date.now() - gameStartTime;

    // Guard: Jika skor 0 dan game berakhir kurang dari 2 detik, abaikan 
    if (timeElapsed < 2000 && currentScore === 0 && !isWin) {
        console.warn("endGame diabaikan: Panggilan terjadi terlalu cepat saat inisialisasi.");
        running = false; 
        document.getElementById("startOnchainBtn").disabled = false;
        document.getElementById("startOnchainBtn").innerText = "START GAME (0.01 SOMI)";
        return; 
    }
    
    running = false; // Hentikan loop game
    
    const title = isWin ? "HORROR BERAKHIR!" : "TERTANGKAP HANTU!";
    const message = isWin 
        ? `Anda telah membersihkan labirin dan mendapatkan Soul Gem! Skor Akhir: ${currentScore}` 
        : `Jack-O'-Lantern tertangkap. Skor Akhir: ${currentScore}`;

    if (typeof showModal === 'function') {
        showModal(title, message);
    } else {
        console.error("showModal tidak ditemukan. Tampilkan pesan di konsol.");
    }

    
    if (typeof submitFinalScore === 'function') {
        // Panggil fungsi submit ke kontrak dari web3_game.js
        submitFinalScore(currentScore); 
    } else {
        console.error("submitFinalScore tidak ditemukan. Transaksi skor tidak dikirim.");
    }
    
    // Reset tombol start 
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
