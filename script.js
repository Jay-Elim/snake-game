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
const BASE_SPEED = 600; // Starting speed (very slow)
const MIN_SPEED = 100; // Fastest speed
const SPEED_INCREMENT_NORMAL = 8; // Normal speed increase
const SPEED_INCREMENT_BIG = 20; // Big food speed increase
const SPEED_LEVEL_INTERVAL = 5; // Speed up every 5 foods eaten

// ===== BIG FOOD SETTINGS =====
const BIG_FOOD_CHANCE = 0.20; // 20% chance to spawn big food
const BIG_FOOD_SCORE_BONUS = 3; // Big food gives 3 points

// State
let snake = [];
let food = {};
let foodType = 'normal'; // 'normal' or 'big'
let direction = 'right';
let nextDirection = 'right';
let score = 0;
let highScore = parseInt(localStorage.getItem('snakeHighScore')) || 0;
let gameRunning = false;
let gameInterval = null;
let currentSpeed = BASE_SPEED;
let foodsEaten = 0;
let lastMoveTime = 0;
const MOVE_COOLDOWN = 50;

// Input buffer
let inputBuffer = [];
let isProcessingInput = false;

// Speed notification tracking
let lastSpeedLevel = 0;

// Initialize
highScoreDisplay.textContent = highScore;

// --- LEADERBOARD FUNCTIONS ---
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

// --- Game Functions ---
function initGame() {
    console.log('🐍 ===== NEW GAME STARTING =====');
    console.log(`🐢 BASE_SPEED: ${BASE_SPEED}ms`);
    console.log(`🌟 Big Food Chance: ${BIG_FOOD_CHANCE * 100}%`);
    
    const startX = Math.floor(GRID_SIZE / 2);
    const startY = Math.floor(GRID_SIZE / 2);
    snake = [
        { x: startX, y: startY },
        { x: startX - 1, y: startY },
        { x: startX - 2, y: startY }
    ];
    direction = 'right';
    nextDirection = 'right';
    inputBuffer = [];
    isProcessingInput = false;
    score = 0;
    foodsEaten = 0;
    currentSpeed = BASE_SPEED;
    lastSpeedLevel = 0;
    scoreDisplay.textContent = '0';
    gameRunning = true;
    gameOverOverlay.classList.add('hidden');
    startOverlay.classList.add('hidden');
    const savePrompt = document.querySelector('.save-prompt');
    if (savePrompt) savePrompt.remove();
    spawnFood();
    clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, currentSpeed);
    lastMoveTime = performance.now();
    
    console.log(`✅ Game initialized! Speed: ${currentSpeed}ms (${Math.round(1000/currentSpeed)} moves/sec)`);
}

function spawnFood() {
    let newFood;
    let attempts = 0;
    do {
        newFood = {
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE)
        };
        attempts++;
    } while (snake.some(segment => segment.x === newFood.x && segment.y === newFood.y) && attempts < 100);
    
    // Determine food type
    if (Math.random() < BIG_FOOD_CHANCE) {
        foodType = 'big';
        console.log('🌟 BIG FOOD spawned at position:', newFood);
    } else {
        foodType = 'normal';
    }
    
    food = newFood;
}

function processInputBuffer() {
    if (isProcessingInput || inputBuffer.length === 0) return;
    
    isProcessingInput = true;
    const newDir = inputBuffer.shift();
    
    if ((newDir === 'up' && direction !== 'down') ||
        (newDir === 'down' && direction !== 'up') ||
        (newDir === 'left' && direction !== 'right') ||
        (newDir === 'right' && direction !== 'left')) {
        nextDirection = newDir;
    }
    
    isProcessingInput = false;
    
    if (inputBuffer.length > 0) {
        setTimeout(processInputBuffer, 30);
    }
}

function gameLoop(timestamp) {
    if (!gameRunning) return;
    
    processInputBuffer();
    
    if (timestamp - lastMoveTime < MOVE_COOLDOWN) {
        requestAnimationFrame(gameLoop);
        return;
    }
    
    direction = nextDirection;
    
    const head = { ...snake[0] };
    switch(direction) {
        case 'up': head.y--; break;
        case 'down': head.y++; break;
        case 'left': head.x--; break;
        case 'right': head.x++; break;
    }
    
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        gameOver();
        return;
    }
    
    if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
        gameOver();
        return;
    }
    
    const ateFood = head.x === food.x && head.y === food.y;
    
    snake.unshift(head);
    if (!ateFood) {
        snake.pop();
    } else {
        // --- FOOD EATEN LOGGING ---
        console.log(`🍽️ Food eaten! Type: ${foodType.toUpperCase()}`);
        console.log(`📊 Before: score=${score}, foodsEaten=${foodsEaten}, speed=${currentSpeed}ms`);
        
        if (foodType === 'big') {
            // Big food: more points and bigger speed increase
            const bonusPoints = BIG_FOOD_SCORE_BONUS;
            score += bonusPoints;
            foodsEaten += 2; // Counts as 2 foods eaten
            console.log(`🌟 BIG FOOD! +${bonusPoints} points! Counts as 2 foods.`);
            
            // Big speed increase - applies immediately
            const newSpeed = Math.max(MIN_SPEED, currentSpeed - SPEED_INCREMENT_BIG);
            if (newSpeed !== currentSpeed) {
                currentSpeed = newSpeed;
                clearInterval(gameInterval);
                gameInterval = setInterval(gameLoop, currentSpeed);
                console.log(`⚡ BIG SPEED BOOST! New speed: ${currentSpeed}ms (${Math.round(1000/currentSpeed)} moves/sec)`);
                showSpeedNotification('big');
            }
        } else {
            // Normal food
            score++;
            foodsEaten++;
            console.log(`🍎 Normal food. Score: ${score}, Total foods eaten: ${foodsEaten}`);
            
            // Normal speed increase - every SPEED_LEVEL_INTERVAL foods
            if (foodsEaten % SPEED_LEVEL_INTERVAL === 0) {
                const newSpeed = Math.max(MIN_SPEED, currentSpeed - SPEED_INCREMENT_NORMAL);
                if (newSpeed !== currentSpeed) {
                    currentSpeed = newSpeed;
                    clearInterval(gameInterval);
                    gameInterval = setInterval(gameLoop, currentSpeed);
                    const speedLevel = Math.floor(foodsEaten / SPEED_LEVEL_INTERVAL);
                    console.log(`⚡ Speed increased to: ${currentSpeed}ms (${Math.round(1000/currentSpeed)} moves/sec) - Level ${speedLevel}`);
                    showSpeedNotification('normal');
                } else {
                    console.log(`⚠️ Speed at minimum: ${currentSpeed}ms`);
                }
            }
        }
        
        console.log(`📊 After: score=${score}, foodsEaten=${foodsEaten}, speed=${currentSpeed}ms`);
        console.log('---');
        
        scoreDisplay.textContent = score;
        spawnFood();
    }
    
    lastMoveTime = timestamp;
    drawCanvas();
    requestAnimationFrame(gameLoop);
}

// --- SPEED NOTIFICATION ---
function showSpeedNotification(type) {
    const existing = document.querySelector('.speed-notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = 'speed-notification';
    
    let emoji = '🐍';
    let color = '#10b981';
    let label = 'Level Up!';
    let speedLevel = Math.floor(foodsEaten / SPEED_LEVEL_INTERVAL);
    
    if (type === 'big') {
        emoji = '🌟';
        color = '#fbbf24';
        label = 'BIG SPEED BOOST!';
    } else {
        if (speedLevel <= 2) {
            emoji = '🐢';
            color = '#34d399';
            label = 'Getting Started';
        } else if (speedLevel <= 4) {
            emoji = '🐍';
            color = '#10b981';
            label = 'Speeding Up';
        } else if (speedLevel <= 6) {
            emoji = '⚡';
            color = '#fbbf24';
            label = 'Fast!';
        } else if (speedLevel <= 8) {
            emoji = '🔥';
            color = '#f472b6';
            label = 'On Fire!';
        } else {
            emoji = '💨';
            color = '#ef4444';
            label = 'Light Speed!';
        }
    }
    
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-emoji">${emoji}</div>
            <div class="notification-label">${label}</div>
            <div class="notification-level">Speed: ${Math.round(1000 / currentSpeed)} moves/sec</div>
            <div class="notification-speed">⚡ ${currentSpeed}ms</div>
        </div>
    `;
    
    notification.style.setProperty('--notification-color', color);
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            if (notification.parentNode) notification.remove();
        }, 400);
    }, 1200);
}

function gameOver() {
    gameRunning = false;
    clearInterval(gameInterval);
    inputBuffer = [];
    isProcessingInput = false;
    
    console.log('💀 ===== GAME OVER =====');
    console.log(`📊 Final Score: ${score}`);
    console.log(`📊 Final Speed: ${currentSpeed}ms (${Math.round(1000 / currentSpeed)} moves/sec)`);
    console.log(`📊 Total Foods Eaten: ${foodsEaten}`);
    console.log(`📊 Snake Length: ${snake.length}`);
    
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('snakeHighScore', highScore);
        highScoreDisplay.textContent = highScore;
        console.log(`🏆 NEW HIGH SCORE: ${highScore}!`);
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
        const leaderboardSection = document.getElementById('leaderboardSection');
        if (leaderboardSection) {
            leaderboardSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
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
    
    // Draw food
    const fx = food.x * CELL_SIZE;
    const fy = food.y * CELL_SIZE;
    
    if (foodType === 'big') {
        // Big food - golden with glow
        ctx.shadowColor = 'rgba(251,191,36,0.8)';
        ctx.shadowBlur = 24;
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(fx + CELL_SIZE/2, fy + CELL_SIZE/2, CELL_SIZE/2 - 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner glow
        ctx.shadowBlur = 40;
        ctx.shadowColor = 'rgba(251,191,36,0.3)';
        ctx.strokeStyle = 'rgba(251,191,36,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(fx + CELL_SIZE/2, fy + CELL_SIZE/2, CELL_SIZE/2 - 2, 0, Math.PI * 2);
        ctx.stroke();
        
        // Star effect
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⭐', fx + CELL_SIZE/2, fy + CELL_SIZE/2);
    } else {
        // Normal food - pink
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
    }
    ctx.shadowBlur = 0;
}

// --- CONTROLS ---
function changeDirection(newDir) {
    if (!gameRunning) return;
    
    if ((newDir === 'up' && direction === 'down') ||
        (newDir === 'down' && direction === 'up') ||
        (newDir === 'left' && direction === 'right') ||
        (newDir === 'right' && direction === 'left')) {
        return;
    }
    
    inputBuffer.push(newDir);
    if (inputBuffer.length > 3) {
        inputBuffer = inputBuffer.slice(-3);
    }
}

function highlightButton(buttonId) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    btn.classList.add('btn-pressed');
    setTimeout(() => {
        btn.classList.remove('btn-pressed');
    }, 150);
}

// --- Keyboard Controls ---
document.addEventListener('keydown', (e) => {
    switch(e.key) {
        case 'ArrowUp': 
            e.preventDefault(); 
            changeDirection('up');
            highlightButton('upBtn');
            break;
        case 'ArrowDown': 
            e.preventDefault(); 
            changeDirection('down');
            highlightButton('downBtn');
            break;
        case 'ArrowLeft': 
            e.preventDefault(); 
            changeDirection('left');
            highlightButton('leftBtn');
            break;
        case 'ArrowRight': 
            e.preventDefault(); 
            changeDirection('right');
            highlightButton('rightBtn');
            break;
        case ' ': 
            e.preventDefault(); 
            if (!gameRunning) initGame(); 
            break;
    }
});

// --- Touch Swipe ---
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

// --- Button Controls ---
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

// --- Start / Restart ---
document.getElementById('startBtn').addEventListener('click', initGame);
document.getElementById('restartBtn').addEventListener('click', initGame);

// --- Share Functions ---
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

// --- Polyfill ---
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

// --- PWA ---
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

// --- INITIALIZE ---
displayLeaderboard();
drawCanvas();

console.log('🐍 Snake Game loaded!');
console.log('🐢 BASE_SPEED:', BASE_SPEED);
console.log('🌟 Big Food Chance:', (BIG_FOOD_CHANCE * 100) + '%');
console.log('High Score:', highScore);
console.log('Leaderboard:', getLeaderboard());
console.log('📱 To see speed changes, play and watch the console!');

// --- DEBUG HELPER ---
window.debugGame = {
    getState: function() {
        return {
            snakeLength: snake.length,
            score: score,
            foodsEaten: foodsEaten,
            currentSpeed: currentSpeed,
            movesPerSecond: Math.round(1000 / currentSpeed),
            gameRunning: gameRunning,
            foodType: foodType
        };
    },
    setSpeed: function(newSpeed) {
        if (newSpeed < MIN_SPEED) newSpeed = MIN_SPEED;
        currentSpeed = newSpeed;
        clearInterval(gameInterval);
        gameInterval = setInterval(gameLoop, currentSpeed);
        console.log(`🔧 Manual speed set to: ${currentSpeed}ms`);
    }
};

console.log('💡 Type debugGame.getState() to see current game state');
console.log('💡 Type debugGame.setSpeed(200) to change speed manually');