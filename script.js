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

// State
let snake = [];
let food = {};
let direction = 'right';
let nextDirection = 'right';
let score = 0;
let highScore = parseInt(localStorage.getItem('snakeHighScore')) || 0;
let gameRunning = false;
let gameInterval = null;
let speed = 150;

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
    
    // Add new entry
    leaderboard.push({
        name: name || 'Anonymous',
        score: score,
        date: new Date().toLocaleDateString()
    });
    
    // Sort by score (highest first)
    leaderboard.sort((a, b) => b.score - a.score);
    
    // Keep only top 10
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
    
    // Medal emojis for top 3
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
        // Update high score display
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
    scoreDisplay.textContent = '0';
    gameRunning = true;
    gameOverOverlay.classList.add('hidden');
    startOverlay.classList.add('hidden');
    // Remove any save prompt if exists
    const savePrompt = document.querySelector('.save-prompt');
    if (savePrompt) savePrompt.remove();
    spawnFood();
    clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, speed);
}

function spawnFood() {
    let newFood;
    do {
        newFood = {
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE)
        };
    } while (snake.some(segment => segment.x === newFood.x && segment.y === newFood.y));
    food = newFood;
}

function gameLoop() {
    if (!gameRunning) return;
    
    // Apply direction
    if ((nextDirection === 'up' && direction !== 'down') ||
        (nextDirection === 'down' && direction !== 'up') ||
        (nextDirection === 'left' && direction !== 'right') ||
        (nextDirection === 'right' && direction !== 'left')) {
        direction = nextDirection;
    }
    
    // Move snake
    const head = { ...snake[0] };
    switch(direction) {
        case 'up': head.y--; break;
        case 'down': head.y++; break;
        case 'left': head.x--; break;
        case 'right': head.x++; break;
    }
    
    // Check collision with walls
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        gameOver();
        return;
    }
    
    // Check collision with self
    if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
        gameOver();
        return;
    }
    
    // Check if food eaten
    const ateFood = head.x === food.x && head.y === food.y;
    
    // Move snake
    snake.unshift(head);
    if (!ateFood) {
        snake.pop();
    } else {
        score++;
        scoreDisplay.textContent = score;
        spawnFood();
        // Speed up slightly
        if (speed > 80) {
            speed -= 2;
            clearInterval(gameInterval);
            gameInterval = setInterval(gameLoop, speed);
        }
    }
    
    drawCanvas();
}

function gameOver() {
    gameRunning = false;
    clearInterval(gameInterval);
    
    // Update high score
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('snakeHighScore', highScore);
        highScoreDisplay.textContent = highScore;
    }
    
    finalScore.textContent = score;
    gameOverOverlay.classList.remove('hidden');
    
    // Show save to leaderboard prompt
    showSaveScorePrompt(score);
}

function showSaveScorePrompt(score) {
    // Remove existing prompt if any
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
                        class="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg text-sm transition-all">
                        Save 🏆
                    </button>
                    <button id="skipSaveBtn" 
                        class="px-4 py-2 bg-white/10 hover:bg-white/20 text-gray-300 font-bold rounded-lg text-sm transition-all">
                        Skip
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Insert after restart button
    const restartBtn = document.getElementById('restartBtn');
    restartBtn.insertAdjacentHTML('afterend', promptHTML);
    
    // Event listeners
    document.getElementById('saveScoreBtn')?.addEventListener('click', () => {
        const name = document.getElementById('playerNameInput').value.trim() || 'Anonymous';
        saveToLeaderboard(name, score);
        displayLeaderboard();
        // Remove the prompt
        const prompt = document.querySelector('.save-prompt');
        if (prompt) prompt.remove();
        // Show updated leaderboard
        const leaderboardSection = document.getElementById('leaderboardSection');
        if (leaderboardSection) {
            leaderboardSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });
    
    document.getElementById('skipSaveBtn')?.addEventListener('click', () => {
        const prompt = document.querySelector('.save-prompt');
        if (prompt) prompt.remove();
    });
    
    // Enter key support
    document.getElementById('playerNameInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('saveScoreBtn')?.click();
        }
    });
}

function drawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid (subtle)
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
        
        // Rounded rectangle
        ctx.beginPath();
        ctx.roundRect(x + padding, y + padding, CELL_SIZE - padding * 2, CELL_SIZE - padding * 2, radius);
        ctx.fill();
    });
    ctx.shadowBlur = 0;
    
    // Draw food
    const fx = food.x * CELL_SIZE;
    const fy = food.y * CELL_SIZE;
    ctx.fillStyle = '#f472b6';
    ctx.shadowColor = 'rgba(244,114,182,0.6)';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(fx + CELL_SIZE/2, fy + CELL_SIZE/2, CELL_SIZE/2 - 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Glow ring
    ctx.shadowBlur = 30;
    ctx.shadowColor = 'rgba(244,114,182,0.2)';
    ctx.strokeStyle = 'rgba(244,114,182,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(fx + CELL_SIZE/2, fy + CELL_SIZE/2, CELL_SIZE/2 + 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
}

// --- Controls ---
function changeDirection(newDir) {
    if (!gameRunning) return;
    nextDirection = newDir;
}

// Keyboard
document.addEventListener('keydown', (e) => {
    switch(e.key) {
        case 'ArrowUp': e.preventDefault(); changeDirection('up'); break;
        case 'ArrowDown': e.preventDefault(); changeDirection('down'); break;
        case 'ArrowLeft': e.preventDefault(); changeDirection('left'); break;
        case 'ArrowRight': e.preventDefault(); changeDirection('right'); break;
        case ' ': e.preventDefault(); if (!gameRunning) initGame(); break;
    }
});

// Touch swipe (on canvas)
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
    
    if (Math.abs(dx) > Math.abs(dy)) {
        changeDirection(dx > 0 ? 'right' : 'left');
    } else {
        changeDirection(dy > 0 ? 'down' : 'up');
    }
    
    touchStartX = 0;
    touchStartY = 0;
}, { passive: false });

// Button controls
document.getElementById('upBtn').addEventListener('click', () => changeDirection('up'));
document.getElementById('downBtn').addEventListener('click', () => changeDirection('down'));
document.getElementById('leftBtn').addEventListener('click', () => changeDirection('left'));
document.getElementById('rightBtn').addEventListener('click', () => changeDirection('right'));

// Start / Restart
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
        // Fallback: copy link
        navigator.clipboard?.writeText(window.location.href).then(() => {
            alert('📋 Link copied to clipboard!');
        });
    }
});

document.getElementById('shareScoreBtn').addEventListener('click', async () => {
    const scoreText = localStorage.getItem('snakeHighScore') || '0';
    const message = `🐍 I scored ${scoreText} points on Snake Game! Can you beat me? 🎮\nPlay here: ${window.location.href}`;
    
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

// Share Leaderboard button
document.getElementById('shareLeaderboardBtn').addEventListener('click', shareLeaderboard);

// Clear leaderboard
document.getElementById('clearScoresBtn').addEventListener('click', clearLeaderboard);

// --- Polyfill for roundRect if not supported ---
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

// --- PWA: Install Prompt ---
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // You could show a custom install button here
});

// --- INITIALIZE LEADERBOARD ---
displayLeaderboard();

// --- Preload drawing ---
drawCanvas();

console.log('🐍 Snake Game loaded!');
console.log('High Score:', highScore);
console.log('Leaderboard:', getLeaderboard());