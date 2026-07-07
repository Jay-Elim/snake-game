// --- Snake Game Logic ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('scoreDisplay');
const highScoreDisplay = document.getElementById('highScoreDisplay');
const finalScore = document.getElementById('finalScore');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const startOverlay = document.getElementById('startOverlay');

// Game settings
const GRID_SIZE = 20;
const CELL_SIZE = canvas.width / GRID_SIZE;

// ===== SPEED SETTINGS =====
const BASE_SPEED = 350;
const MIN_SPEED = 80;
const SPEED_LEVEL_INTERVAL = 5;
const SPEED_INCREMENT = 50;

// ===== BIG FOOD SETTINGS =====
const BIG_FOOD_CHANCE = 0.20; // 20% chance
const BIG_FOOD_SCORE_BONUS = 5; // Big food gives 5 points

// State
let snake = [];
let food = {};
let bigFood = null; // Big food object {x, y} or null
let direction = 'right';
let nextDirection = 'right';
let score = 0;
let highScore = parseInt(localStorage.getItem('snakeHighScore')) || 0;
let gameRunning = false;
let currentSpeed = BASE_SPEED;
let foodsEaten = 0;
let gameInterval = null;
let level = 0;

// Speed display
let speedDisplay = null;

// Initialize
highScoreDisplay.textContent = highScore;

// ===== LEADERBOARD FUNCTIONS =====
const LEADERBOARD_KEY = 'snake_leaderboard';
const MAX_LEADERBOARD_ENTRIES = 10;

function getLeaderboard() {
    try {
        const data = localStorage.getItem(LEADERBOARD_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

function saveToLeaderboard(name, score) {
    const leaderboard = getLeaderboard();
    leaderboard.push({
        name: name || 'Anonymous',
        score: score,
        date: new Date().toLocaleDateString()
    });
    leaderboard.sort((a, b) => b.score - a.score);
    if (leaderboard.length > MAX_LEADERBOARD_ENTRIES) {
        leaderboard.length = MAX_LEADERBOARD_ENTRIES;
    }
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboard));
    displayLeaderboard();
}

function displayLeaderboard() {
    const leaderboard = getLeaderboard();
    const list = document.getElementById('leaderboardList');
    if (leaderboard.length === 0) {
        list.innerHTML = '<div class="text-center text-gray-500 py-2 text-sm">No scores yet. Be the first! 🐍</div>';
        return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    list.innerHTML = leaderboard.map((entry, index) => {
        const medal = index < 3 ? medals[index] : `#${index + 1}`;
        const isCurrentUser = entry.name === 'You';
        return `
            <div class="flex items-center justify-between p-2 rounded-lg ${isCurrentUser ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-white/5'} transition-colors hover:bg-white/10">
                <div class="flex items-center gap-3">
                    <span class="text-sm font-bold ${index < 3 ? 'text-yellow-400' : 'text-gray-400'} w-8 text-center">
                        ${medal}
                    </span>
                    <span class="text-sm font-medium text-white ${isCurrentUser ? 'text-emerald-400' : ''}">
                        ${entry.name}
                        ${isCurrentUser ? '👈' : ''}
                    </span>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-sm font-bold text-emerald-400">${entry.score}</span>
                    <span class="text-xs text-gray-500">${entry.date}</span>
                </div>
            </div>
        `;
    }).join('');
}

function clearLeaderboard() {
    if (confirm('Are you sure you want to clear all scores?')) {
        localStorage.removeItem(LEADERBOARD_KEY);
        displayLeaderboard();
        highScore = 0;
        localStorage.setItem('snakeHighScore', '0');
        highScoreDisplay.textContent = '0';
    }
}

function shareLeaderboard() {
    const leaderboard = getLeaderboard();
    if (leaderboard.length === 0) {
        alert('No scores to share yet!');
        return;
    }
    let message = '🏆 Snake Game Leaderboard 🏆\n\n';
    const medals = ['🥇', '🥈', '🥉'];
    leaderboard.forEach((entry, index) => {
        const medal = index < 3 ? medals[index] : `${index + 1}.`;
        message += `${medal} ${entry.name}: ${entry.score} points\n`;
    });
    message += `\nPlay and beat them: ${window.location.href}`;
    if (navigator.share) {
        navigator.share({ text: message });
    } else {
        navigator.clipboard.writeText(message).then(() => {
            alert('📋 Leaderboard copied! Share it with your friends!');
        });
    }
}

// ===== GAME FUNCTIONS =====
function initGame() {
    console.log('🐍 ===== NEW GAME =====');
    
    // Reset game
    const startX = Math.floor(GRID_SIZE / 2);
    const startY = Math.floor(GRID_SIZE / 2);
    snake = [
        { x: startX, y: startY },
        { x: startX - 1, y: startY },
        { x: startX - 2, y: startY }
    ];
    direction = 'right';
    nextDirection = 'right';
    score = 0;
    foodsEaten = 0;
    level = 0;
    currentSpeed = BASE_SPEED;
    bigFood = null;
    scoreDisplay.textContent = '0';
    gameRunning = true;
    gameOverOverlay.classList.add('hidden');
    startOverlay.classList.add('hidden');
    
    const savePrompt = document.querySelector('.save-prompt');
    if (savePrompt) savePrompt.remove();
    
    // Remove old speed display
    if (speedDisplay) {
        speedDisplay.remove();
        speedDisplay = null;
    }
    
    // Create speed display
    createSpeedDisplay();
    
    spawnFood();
    trySpawnBigFood();
    
    // Clear any existing interval
    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }
    
    // Start game loop with current speed
    gameInterval = setInterval(moveSnake, currentSpeed);
    updateSpeedDisplay();
}

function createSpeedDisplay() {
    speedDisplay = document.createElement('div');
    speedDisplay.id = 'speedDisplay';
    speedDisplay.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.8);
        color: #10b981;
        padding: 8px 16px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: bold;
        z-index: 1000;
        border: 1px solid rgba(16,185,129,0.3);
        backdrop-filter: blur(10px);
        font-family: monospace;
        text-align: center;
        pointer-events: none;
    `;
    document.body.appendChild(speedDisplay);
}

function updateSpeedDisplay() {
    if (speedDisplay) {
        const movesPerSec = (1000 / currentSpeed).toFixed(1);
        const foods = foodsEaten;
        speedDisplay.innerHTML = `
            🍎 ${foods} foods eaten | Level ${level} | ⚡ ${movesPerSec}/sec
        `;
    }
}

function spawnFood() {
    let newFood;
    do {
        newFood = {
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE)
        };
    } while (snake.some(segment => segment.x === newFood.x && segment.y === newFood.y) || 
             (bigFood && bigFood.x === newFood.x && bigFood.y === newFood.y));
    food = newFood;
    drawCanvas();
}

function trySpawnBigFood() {
    // Only spawn big food if there isn't already one and random chance
    if (!bigFood && Math.random() < BIG_FOOD_CHANCE) {
        let newBigFood;
        let attempts = 0;
        do {
            newBigFood = {
                x: Math.floor(Math.random() * GRID_SIZE),
                y: Math.floor(Math.random() * GRID_SIZE)
            };
            attempts++;
        } while ((snake.some(segment => segment.x === newBigFood.x && segment.y === newBigFood.y) || 
                 (food.x === newBigFood.x && food.y === newBigFood.y)) && attempts < 100);
        
        if (attempts < 100) {
            bigFood = newBigFood;
            console.log('🌟 Big Food spawned!');
        }
    }
    drawCanvas();
}

// ===== MAIN GAME LOOP =====
function moveSnake() {
    if (!gameRunning) return;
    
    // Apply direction
    direction = nextDirection;
    
    // Calculate new head
    const head = { ...snake[0] };
    switch(direction) {
        case 'up': head.y--; break;
        case 'down': head.y++; break;
        case 'left': head.x--; break;
        case 'right': head.x++; break;
    }
    
    // Wall collision
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        gameOver();
        return;
    }
    
    // Self collision
    if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
        gameOver();
        return;
    }
    
    // Check if ate big food first (priority)
    let ateBigFood = false;
    if (bigFood && head.x === bigFood.x && head.y === bigFood.y) {
        ateBigFood = true;
        bigFood = null;
    }
    
    // Check if ate regular food
    const ateFood = head.x === food.x && head.y === food.y;
    
    // Move snake
    snake.unshift(head);
    if (!ateFood && !ateBigFood) {
        snake.pop();
    } else {
        if (ateBigFood) {
            // Big food: more points
            score += BIG_FOOD_SCORE_BONUS;
            foodsEaten += 2; // Counts as 2 foods
            console.log(`🌟 Big Food eaten! +${BIG_FOOD_SCORE_BONUS} points!`);
        } else {
            // Normal food
            score++;
            foodsEaten++;
        }
        scoreDisplay.textContent = score;
        spawnFood();
        trySpawnBigFood();
        
        // Speed up every SPEED_LEVEL_INTERVAL foods
        if (foodsEaten % SPEED_LEVEL_INTERVAL === 0) {
            const newSpeed = Math.max(MIN_SPEED, currentSpeed - SPEED_INCREMENT);
            if (newSpeed !== currentSpeed) {
                currentSpeed = newSpeed;
                level++;
                // Reset interval with new speed
                clearInterval(gameInterval);
                gameInterval = setInterval(moveSnake, currentSpeed);
                console.log(`⚡ Level ${level}: Speed ${currentSpeed}ms (${(1000/currentSpeed).toFixed(1)} moves/sec)`);
                updateSpeedDisplay();
            }
        }
    }
    
    drawCanvas();
}

function gameOver() {
    gameRunning = false;
    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }
    
    console.log('💀 Game Over! Score:', score, 'Final Speed:', currentSpeed, 'ms', 'Level:', level);
    
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('snakeHighScore', highScore);
        highScoreDisplay.textContent = highScore;
    }
    
    finalScore.textContent = score;
    gameOverOverlay.classList.remove('hidden');
    showSaveScorePrompt(score);
}

function showSaveScorePrompt(score) {
    const existingPrompt = document.querySelector('.save-prompt');
    if (existingPrompt) existingPrompt.remove();
    
    const promptHTML = `
        <div class="save-prompt mt-3 p-3 bg-white/5 rounded-xl border border-white/10 w-full max-w-[280px]">
            <p class="text-sm text-gray-300 mb-2 text-center">Save your score to the leaderboard!</p>
            <div class="flex flex-col gap-2">
                <input id="playerNameInput" type="text" 
                    placeholder="Your name" maxlength="20"
                    class="w-full px-3 py-2 bg-white/10 rounded-lg text-white text-sm placeholder-gray-500 border border-white/10 focus:border-emerald-500 outline-none"
                    value="Player">
                <div class="flex gap-2">
                    <button id="saveScoreBtn" 
                        class="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg text-sm transition-all active:scale-95">
                        Save 🏆
                    </button>
                    <button id="skipSaveBtn" 
                        class="px-4 py-2 bg-white/10 hover:bg-white/20 text-gray-300 font-bold rounded-lg text-sm transition-all active:scale-95">
                        Skip
                    </button>
                </div>
            </div>
        </div>
    `;
    
    const restartBtn = document.getElementById('restartBtn');
    restartBtn.insertAdjacentHTML('afterend', promptHTML);
    
    document.getElementById('saveScoreBtn')?.addEventListener('click', () => {
        const name = document.getElementById('playerNameInput').value.trim() || 'Anonymous';
        saveToLeaderboard(name, score);
        displayLeaderboard();
        const prompt = document.querySelector('.save-prompt');
        if (prompt) prompt.remove();
    });
    
    document.getElementById('skipSaveBtn')?.addEventListener('click', () => {
        const prompt = document.querySelector('.save-prompt');
        if (prompt) prompt.remove();
    });
    
    document.getElementById('playerNameInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('saveScoreBtn')?.click();
        }
    });
}

function drawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CELL_SIZE, 0);
        ctx.lineTo(i * CELL_SIZE, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * CELL_SIZE);
        ctx.lineTo(canvas.width, i * CELL_SIZE);
        ctx.stroke();
    }
    
    // Draw snake
    snake.forEach((segment, index) => {
        const x = segment.x * CELL_SIZE;
        const y = segment.y * CELL_SIZE;
        const padding = index === 0 ? 2 : 3;
        const radius = 6;
        
        ctx.fillStyle = index === 0 ? '#34d399' : '#10b981';
        ctx.shadowColor = index === 0 ? 'rgba(52,211,153,0.5)' : 'rgba(16,185,129,0.3)';
        ctx.shadowBlur = index === 0 ? 12 : 6;
        
        ctx.beginPath();
        ctx.roundRect(x + padding, y + padding, CELL_SIZE - padding * 2, CELL_SIZE - padding * 2, radius);
        ctx.fill();
    });
    ctx.shadowBlur = 0;
    
    // Draw big food (if exists) - Golden with star
    if (bigFood) {
        const bx = bigFood.x * CELL_SIZE;
        const by = bigFood.y * CELL_SIZE;
        ctx.shadowColor = 'rgba(251,191,36,0.8)';
        ctx.shadowBlur = 24;
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(bx + CELL_SIZE/2, by + CELL_SIZE/2, CELL_SIZE/2 - 2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 40;
        ctx.shadowColor = 'rgba(251,191,36,0.3)';
        ctx.strokeStyle = 'rgba(251,191,36,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bx + CELL_SIZE/2, by + CELL_SIZE/2, CELL_SIZE/2 - 2, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⭐', bx + CELL_SIZE/2, by + CELL_SIZE/2);
    }
    
    // Draw regular food
    const fx = food.x * CELL_SIZE;
    const fy = food.y * CELL_SIZE;
    ctx.fillStyle = '#f472b6';
    ctx.shadowColor = 'rgba(244,114,182,0.6)';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(fx + CELL_SIZE/2, fy + CELL_SIZE/2, CELL_SIZE/2 - 3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowBlur = 30;
    ctx.shadowColor = 'rgba(244,114,182,0.2)';
    ctx.strokeStyle = 'rgba(244,114,182,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(fx + CELL_SIZE/2, fy + CELL_SIZE/2, CELL_SIZE/2 + 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
}

// ===== CONTROLS =====
function changeDirection(newDir) {
    if (!gameRunning) return;
    if ((newDir === 'up' && direction === 'down') ||
        (newDir === 'down' && direction === 'up') ||
        (newDir === 'left' && direction === 'right') ||
        (newDir === 'right' && direction === 'left')) {
        return;
    }
    nextDirection = newDir;
}

function highlightButton(buttonId) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    btn.classList.add('btn-pressed');
    setTimeout(() => {
        btn.classList.remove('btn-pressed');
    }, 150);
}

// Keyboard
document.addEventListener('keydown', (e) => {
    switch(e.key) {
        case 'ArrowUp': e.preventDefault(); changeDirection('up'); highlightButton('upBtn'); break;
        case 'ArrowDown': e.preventDefault(); changeDirection('down'); highlightButton('downBtn'); break;
        case 'ArrowLeft': e.preventDefault(); changeDirection('left'); highlightButton('leftBtn'); break;
        case 'ArrowRight': e.preventDefault(); changeDirection('right'); highlightButton('rightBtn'); break;
        case ' ': e.preventDefault(); if (!gameRunning) initGame(); break;
    }
});

// Touch Swipe
let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    if (touchStartX === 0 && touchStartY === 0) return;
    const touchEnd = e.changedTouches[0];
    const dx = touchEnd.clientX - touchStartX;
    const dy = touchEnd.clientY - touchStartY;
    const minSwipeDistance = 20;
    
    if (Math.abs(dx) < minSwipeDistance && Math.abs(dy) < minSwipeDistance) {
        touchStartX = 0;
        touchStartY = 0;
        return;
    }
    
    if (Math.abs(dx) > Math.abs(dy)) {
        changeDirection(dx > 0 ? 'right' : 'left');
        highlightButton(dx > 0 ? 'rightBtn' : 'leftBtn');
    } else {
        changeDirection(dy > 0 ? 'down' : 'up');
        highlightButton(dy > 0 ? 'downBtn' : 'upBtn');
    }
    touchStartX = 0;
    touchStartY = 0;
}, { passive: false });

// Button Controls
function setupButton(id, direction) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        highlightButton(id);
        changeDirection(direction);
    }, { passive: false });
    btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        highlightButton(id);
        changeDirection(direction);
    });
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

setupButton('upBtn', 'up');
setupButton('downBtn', 'down');
setupButton('leftBtn', 'left');
setupButton('rightBtn', 'right');

// Start / Restart
document.getElementById('startBtn').addEventListener('click', initGame);
document.getElementById('restartBtn').addEventListener('click', initGame);

// Share Functions
document.getElementById('shareBtn').addEventListener('click', async () => {
    if (navigator.share) {
        try {
            await navigator.share({
                title: '🐍 Snake Game',
                text: 'Play Snake on your phone! 🐍',
                url: window.location.href,
            });
        } catch (err) {
            if (err.name !== 'AbortError') console.error('Share failed:', err);
        }
    } else {
        navigator.clipboard?.writeText(window.location.href).then(() => {
            alert('📋 Link copied to clipboard!');
        });
    }
});

document.getElementById('shareScoreBtn').addEventListener('click', async () => {
    const scoreText = localStorage.getItem('snakeHighScore') || '0';
    const message = `🐍 I scored ${scoreText} points on Snake Game! Can you beat me? 🎮\n\nBuilt by @jayelimpro\nPlay here: ${window.location.href}`;
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'My Snake Score',
                text: message,
            });
        } catch (err) {
            if (err.name !== 'AbortError') console.error('Share failed:', err);
        }
    } else {
        navigator.clipboard?.writeText(message).then(() => {
            alert('📋 Score copied! Share it on X! 🎉');
        });
    }
});

document.getElementById('shareLeaderboardBtn').addEventListener('click', shareLeaderboard);
document.getElementById('clearScoresBtn').addEventListener('click', clearLeaderboard);

// Polyfill
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (r > w/2) r = w/2;
        if (r > h/2) r = h/2;
        this.moveTo(x + r, y);
        this.lineTo(x + w - r, y);
        this.quadraticCurveTo(x + w, y, x + w, y + r);
        this.lineTo(x + w, y + h - r);
        this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        this.lineTo(x + r, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - r);
        this.lineTo(x, y + r);
        this.quadraticCurveTo(x, y, x + r, y);
        this.closePath();
        return this;
    };
}

// PWA
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

// INITIALIZE
displayLeaderboard();
drawCanvas();

console.log('🐍 Snake Game loaded!');
console.log(`🐢 BASE_SPEED: ${BASE_SPEED}ms`);
console.log('🌟 Big Food: 20% chance, +5 points!');

// Debug helper
window.debugGame = {
    getState: function() {
        return {
            snakeLength: snake.length,
            score: score,
            foodsEaten: foodsEaten,
            currentSpeed: currentSpeed,
            movesPerSecond: (1000 / currentSpeed).toFixed(1),
            gameRunning: gameRunning,
            level: level,
            hasBigFood: bigFood !== null
        };
    },
    setSpeed: function(newSpeed) {
        if (newSpeed < MIN_SPEED) newSpeed = MIN_SPEED;
        currentSpeed = newSpeed;
        if (gameInterval) {
            clearInterval(gameInterval);
            gameInterval = setInterval(moveSnake, currentSpeed);
        }
        console.log(`🔧 Manual speed set to: ${currentSpeed}ms`);
        updateSpeedDisplay();
    }
};