const canvas = document.getElementById('gameCanvas');
const context = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const timerElement = document.getElementById('timer');
const livesElement = document.getElementById('lives');
const startOverlay = document.getElementById('startOverlay');
const resultOverlay = document.getElementById('resultOverlay');
const resultKicker = document.getElementById('resultKicker');
const resultTitle = document.getElementById('resultTitle');
const resultMessage = document.getElementById('resultMessage');
const finalScore = document.getElementById('finalScore');
const startButton = document.getElementById('startButton');
const restartButton = document.getElementById('restartButton');
const muteButton = document.getElementById('muteButton');

const worldWidth = 5200;
const worldHeight = 640;
const groundY = 560;
const keys = new Set();
let animationFrame;
let lastTime = 0;
let audioEnabled = true;
let gameStarted = false;
let gameState = 'ready';
let state;

const platforms = [
  { x: 0, y: groundY, width: 820, height: 80 }, { x: 960, y: 500, width: 280, height: 140 },
  { x: 1330, y: 430, width: 240, height: 210 }, { x: 1690, y: 520, width: 440, height: 120 },
  { x: 2260, y: 465, width: 220, height: 175 }, { x: 2590, y: groundY, width: 580, height: 80 },
  { x: 3330, y: 475, width: 240, height: 165 }, { x: 3700, y: 405, width: 210, height: 235 },
  { x: 4040, y: 510, width: 290, height: 130 }, { x: 4460, y: 440, width: 300, height: 200 },
  { x: 4890, y: 520, width: 310, height: 120 }
];
const hazards = [
  { x: 720, y: 532, width: 74, height: 28 }, { x: 1800, y: 492, width: 90, height: 28 },
  { x: 2780, y: 532, width: 105, height: 28 }, { x: 4140, y: 482, width: 80, height: 28 }
];
const coins = [
  [250, 465], [330, 410], [415, 465], [570, 460], [1035, 420], [1120, 385], [1415, 345], [1500, 345],
  [1770, 465], [1860, 430], [1950, 465], [2350, 405], [2660, 450], [2740, 400], [2940, 450], [3050, 450],
  [3410, 410], [3500, 365], [3770, 335], [4140, 445], [4250, 445], [4580, 370], [4690, 370], [5000, 450]
];
const gems = [[680, 425], [1230, 360], [2060, 440], [3170, 445], [3900, 320], [4790, 375]];
const enemySpawns = [
  { x: 570, y: 528, width: 32, height: 32, min: 500, max: 690, speed: 54 },
  { x: 1100, y: 468, width: 32, height: 32, min: 970, max: 1200, speed: 42 },
  { x: 1840, y: 488, width: 32, height: 32, min: 1720, max: 2070, speed: 60 },
  { x: 2910, y: 528, width: 32, height: 32, min: 2630, max: 3100, speed: 48 },
  { x: 4190, y: 478, width: 32, height: 32, min: 4060, max: 4300, speed: 53 }
];

function createState() {
  return {
    player: { x: 90, y: 470, width: 34, height: 58, velocityX: 0, velocityY: 0, grounded: false, invincible: 0, facing: 1 },
    collectedCoins: new Set(), collectedGems: new Set(), defeatedEnemies: new Set(),
    enemies: enemySpawns.map((enemy) => ({ ...enemy, direction: 1 })), score: 0, lives: 3, time: 90, cameraX: 0, elapsed: 0
  };
}

function resetGame() { state = createState(); updateHud(); }
function startGame() { resetGame(); gameStarted = true; gameState = 'playing'; startOverlay.classList.remove('overlay-visible'); resultOverlay.classList.remove('overlay-visible'); lastTime = performance.now(); cancelAnimationFrame(animationFrame); animationFrame = requestAnimationFrame(gameLoop); }
function endGame(won) {
  gameState = won ? 'won' : 'lost';
  resultKicker.textContent = won ? 'Run complete' : 'The jungle wins this round';
  resultTitle.textContent = won ? 'You found the sun gate.' : 'The canopy caught you.';
  resultMessage.textContent = won ? 'A clean dash through the ruins. Treasure secured.' : 'Take a breath, then find a better line through the ruins.';
  finalScore.textContent = String(state.score).padStart(6, '0');
  resultOverlay.classList.add('overlay-visible');
  beep(won ? 660 : 160, .18);
}
function updateHud() { scoreElement.textContent = String(state.score).padStart(6, '0'); timerElement.textContent = Math.max(0, Math.ceil(state.time)); livesElement.textContent = '♥'.repeat(state.lives) + '♡'.repeat(3 - state.lives); }
function beep(frequency, duration) { if (!audioEnabled) return; const audio = new (window.AudioContext || window.webkitAudioContext)(); const oscillator = audio.createOscillator(); const gain = audio.createGain(); oscillator.frequency.value = frequency; oscillator.type = 'sine'; gain.gain.setValueAtTime(.035, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration); oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + duration); }
function overlaps(a, b) { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }
function resolvePlatforms(player, previousBottom) {
  player.grounded = false;
  for (const platform of platforms) {
    const horizontal = player.x + player.width > platform.x && player.x < platform.x + platform.width;
    if (horizontal && previousBottom <= platform.y && player.y + player.height >= platform.y && player.velocityY >= 0) { player.y = platform.y - player.height; player.velocityY = 0; player.grounded = true; }
  }
}
function hurtPlayer() { if (state.player.invincible > 0) return; state.lives -= 1; state.player.invincible = 1.5; state.player.x = Math.max(40, state.player.x - 100); state.player.y = 390; state.player.velocityY = -500; beep(130, .16); if (state.lives <= 0) endGame(false); updateHud(); }
function update(delta) {
  const player = state.player; state.elapsed += delta; state.time -= delta; player.invincible = Math.max(0, player.invincible - delta);
  const movingLeft = keys.has('ArrowLeft') || keys.has('a'); const movingRight = keys.has('ArrowRight') || keys.has('d');
  const move = movingRight - movingLeft; player.velocityX += (move * 1150 - player.velocityX) * Math.min(1, delta * 9); if (!move) player.velocityX *= .82; if (move) player.facing = move;
  const previousBottom = player.y + player.height; player.velocityY += 1500 * delta; player.x = Math.max(0, Math.min(worldWidth - player.width, player.x + player.velocityX * delta)); player.y += player.velocityY * delta; resolvePlatforms(player, previousBottom);
  if ((keys.has(' ') || keys.has('ArrowUp') || keys.has('w')) && player.grounded) { player.velocityY = -635; player.grounded = false; beep(440, .08); }
  if (player.y > worldHeight + 100) hurtPlayer();
  coins.forEach(([x, y], index) => { const item = { x: x - 12, y: y - 12, width: 24, height: 24 }; if (!state.collectedCoins.has(index) && overlaps(player, item)) { state.collectedCoins.add(index); state.score += 100; beep(760, .07); } });
  gems.forEach(([x, y], index) => { const item = { x: x - 14, y: y - 14, width: 28, height: 28 }; if (!state.collectedGems.has(index) && overlaps(player, item)) { state.collectedGems.add(index); state.score += 250; beep(940, .1); } });
  hazards.forEach((hazard) => { if (overlaps(player, { x: hazard.x, y: hazard.y + 5, width: hazard.width, height: hazard.height - 5 })) hurtPlayer(); });
  state.enemies.forEach((enemy, index) => { if (state.defeatedEnemies.has(index)) return; enemy.x += enemy.speed * enemy.direction * delta; if (enemy.x < enemy.min || enemy.x + enemy.width > enemy.max) enemy.direction *= -1; if (overlaps(player, enemy)) { if (player.velocityY > 0 && player.y + player.height - enemy.y < 24) { state.defeatedEnemies.add(index); player.velocityY = -430; state.score += 175; beep(520, .1); } else hurtPlayer(); } });
  if (player.x > 4995) { state.score += Math.ceil(state.time) * 10; endGame(true); }
  if (state.time <= 0) endGame(false);
  state.cameraX += (Math.max(0, Math.min(worldWidth - canvas.width, player.x - canvas.width * .34)) - state.cameraX) * Math.min(1, delta * 4); updateHud();
}
function drawBackground() {
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height); gradient.addColorStop(0, '#91d0bd'); gradient.addColorStop(.55, '#4f9d83'); gradient.addColorStop(1, '#275d4a'); context.fillStyle = gradient; context.fillRect(0, 0, canvas.width, canvas.height);
  context.save(); context.translate(-state.cameraX * .15, 0); context.fillStyle = 'rgba(33, 85, 66, .45)'; for (let x = -400; x < worldWidth + 600; x += 260) { context.beginPath(); context.moveTo(x, 440); context.lineTo(x + 80, 180); context.lineTo(x + 180, 440); context.fill(); } context.restore();
  context.save(); context.translate(-state.cameraX * .35, 0); context.fillStyle = '#2b7458'; for (let x = -200; x < worldWidth + 500; x += 155) { context.beginPath(); context.arc(x, 355, 95, 0, Math.PI * 2); context.fill(); } context.restore();
}
function drawWorld() {
  context.save(); context.translate(-state.cameraX, 0);
  platforms.forEach((platform) => { context.fillStyle = '#744f35'; context.fillRect(platform.x, platform.y, platform.width, platform.height); context.fillStyle = '#b9ca60'; context.fillRect(platform.x, platform.y, platform.width, 13); context.fillStyle = 'rgba(35, 56, 36, .3)'; for (let x = platform.x + 18; x < platform.x + platform.width; x += 42) context.fillRect(x, platform.y + 29, 4, platform.height - 30); });
  hazards.forEach((hazard) => { context.fillStyle = '#df7353'; for (let x = hazard.x; x < hazard.x + hazard.width; x += 18) { context.beginPath(); context.moveTo(x, hazard.y + hazard.height); context.lineTo(x + 9, hazard.y); context.lineTo(x + 18, hazard.y + hazard.height); context.fill(); } });
  coins.forEach(([x, y], index) => { if (state.collectedCoins.has(index)) return; const bob = Math.sin(state.elapsed * 5 + index) * 4; context.fillStyle = '#f5c95d'; context.beginPath(); context.arc(x, y + bob, 11, 0, Math.PI * 2); context.fill(); context.strokeStyle = '#fff1a8'; context.lineWidth = 3; context.stroke(); context.fillStyle = '#a86e2f'; context.font = 'bold 13px Trebuchet MS'; context.fillText('$', x - 4, y + bob + 5); });
  gems.forEach(([x, y], index) => { if (state.collectedGems.has(index)) return; const bob = Math.sin(state.elapsed * 4 + index) * 5; context.fillStyle = '#82e0d5'; context.beginPath(); context.moveTo(x, y - 16 + bob); context.lineTo(x + 13, y + bob); context.lineTo(x, y + 17 + bob); context.lineTo(x - 13, y + bob); context.closePath(); context.fill(); context.strokeStyle = '#d8ffed'; context.stroke(); });
  state.enemies.forEach((enemy, index) => { if (state.defeatedEnemies.has(index)) return; context.fillStyle = '#ca5b54'; context.beginPath(); context.arc(enemy.x + 16, enemy.y + 18, 16, Math.PI, 0); context.lineTo(enemy.x + 32, enemy.y + 32); context.lineTo(enemy.x, enemy.y + 32); context.fill(); context.fillStyle = '#fffaf0'; context.fillRect(enemy.x + 7, enemy.y + 12, 5, 6); context.fillRect(enemy.x + 20, enemy.y + 12, 5, 6); });
  drawFinish(); drawPlayer(); context.restore();
}
function drawFinish() { const x = 5050, y = 380; context.fillStyle = '#684831'; context.fillRect(x, y, 10, 140); context.fillStyle = '#f5c95d'; context.beginPath(); context.moveTo(x + 10, y + 10); context.lineTo(x + 105, y + 34); context.lineTo(x + 10, y + 60); context.fill(); context.fillStyle = '#fff1a8'; context.font = 'bold 13px Trebuchet MS'; context.fillText('EXIT', x + 28, y + 43); }
function drawPlayer() { const player = state.player; if (player.invincible > 0 && Math.floor(state.elapsed * 12) % 2 === 0) return; const bounce = player.grounded ? Math.sin(state.elapsed * 10) * 1.5 : 0; context.save(); context.translate(player.x, player.y + bounce); context.scale(player.facing, 1); context.fillStyle = '#e3a85b'; context.fillRect(7, 19, 23, 29); context.fillStyle = '#d9654f'; context.fillRect(4, 10, 29, 18); context.fillStyle = '#173c2e'; context.fillRect(7, 2, 24, 12); context.fillStyle = '#fffaf0'; context.fillRect(23, 17, 5, 5); context.fillStyle = '#10251f'; context.fillRect(25, 18, 2, 3); context.fillStyle = '#a7c957'; context.fillRect(3, 43, 13, 9); context.fillRect(21, 43, 13, 9); context.restore(); }
function draw() { drawBackground(); drawWorld(); }
function gameLoop(timestamp) { const delta = Math.min(.034, (timestamp - lastTime) / 1000); lastTime = timestamp; if (gameState === 'playing') update(delta); draw(); if (gameState === 'playing') animationFrame = requestAnimationFrame(gameLoop); }

window.addEventListener('keydown', (event) => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' ', 'a', 'd', 'w'].includes(event.key)) { event.preventDefault(); keys.add(event.key); } });
window.addEventListener('keyup', (event) => keys.delete(event.key));
startButton.addEventListener('click', startGame); restartButton.addEventListener('click', startGame);
muteButton.addEventListener('click', () => { audioEnabled = !audioEnabled; muteButton.innerHTML = audioEnabled ? '♪ <span>Sound on</span>' : '× <span>Sound off</span>'; });
resetGame(); draw();
