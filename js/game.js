/* ============================================================
   TANK BATTLE — game engine
   Vanilla canvas, zero dependencies. Defend the eagle.
   ============================================================ */

(() => {
  "use strict";

  // ------------------------------------------------------------
  // Constants
  // ------------------------------------------------------------

  const TILE = 48;
  const COLS = 13;
  const ROWS = 13;
  const W = COLS * TILE;
  const H = ROWS * TILE;

  const EMPTY = 0;
  const BRICK = 1;
  const STEEL = 2;
  const WATER = 3;
  const BASE = 4;

  // 0 up · 1 right · 2 down · 3 left
  const DIRS = Object.freeze([
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ]);

  const OPPOSITE = [2, 3, 0, 1];
  const BASE_COL = 6;
  const BASE_ROW = 12;
  const SPAWN_COLS = [0, 6, 12];
  const START_COL = 4;
  const START_ROW = 12;
  const HIGH_SCORE_KEY = "tank-battle-high-score-v1";
  const MUTE_KEY = "tank-battle-muted-v1";

  const MAP_TEMPLATE = [
    ".............",
    ".##.......##.",
    ".##.#####.##.",
    "...#~~.~~#...",
    ".=.=.###.=.=.",
    "...#~~.~~#...",
    ".=.=.=#=.=.=.",
    "...#.....#...",
    ".=.=.###.=.=.",
    "...#.....#...",
    ".##..###..##.",
    ".....###.....",
    ".....#B#.....",
  ];

  const ENEMY_TYPES = {
    grunt: {
      name: "RIFLEMAN",
      color: "#c27b49",
      shade: "#7c482d",
      accent: "#f0c18b",
      tread: "#3b291e",
      speed: 63,
      hp: 1,
      score: 100,
      fireRate: 2.15,
      bulletSpeed: 238,
    },
    scout: {
      name: "OUTRIDER",
      color: "#d8b65a",
      shade: "#8e7432",
      accent: "#f7e6a8",
      tread: "#3d3520",
      speed: 96,
      hp: 1,
      score: 150,
      fireRate: 2.0,
      bulletSpeed: 252,
    },
    gunner: {
      name: "GUNNER",
      color: "#b7594a",
      shade: "#733429",
      accent: "#efa18b",
      tread: "#3c2420",
      speed: 67,
      hp: 1,
      score: 200,
      fireRate: 1.24,
      bulletSpeed: 268,
    },
    armor: {
      name: "JUGGERNAUT",
      color: "#7d9a8e",
      shade: "#465e55",
      accent: "#c6d9cd",
      tread: "#27322d",
      speed: 49,
      hp: 3,
      score: 350,
      fireRate: 1.72,
      bulletSpeed: 242,
    },
  };

  const WAVES = [
    {
      total: 6,
      maxActive: 3,
      interval: 1.8,
      pool: ["grunt", "grunt", "grunt", "scout", "gunner"],
    },
    {
      total: 7,
      maxActive: 3,
      interval: 1.6,
      pool: ["grunt", "scout", "scout", "gunner", "gunner", "armor"],
    },
    {
      total: 8,
      maxActive: 4,
      interval: 1.45,
      pool: ["grunt", "scout", "gunner", "gunner", "armor"],
    },
    {
      total: 9,
      maxActive: 4,
      interval: 1.32,
      pool: ["scout", "gunner", "gunner", "armor", "armor"],
    },
    {
      total: 10,
      maxActive: 5,
      interval: 1.18,
      pool: ["scout", "gunner", "gunner", "armor", "armor"],
    },
  ];

  const POWERUPS = {
    shield: {
      color: "#7fded0",
      label: "SHIELD",
      duration: 0,
    },
    rapid: {
      color: "#ffb52e",
      label: "RAPID FIRE",
      duration: 0,
    },
    life: {
      color: "#a9d36c",
      label: "EXTRA ARMOR",
      duration: 0,
    },
    bomb: {
      color: "#ff6b4d",
      label: "AIR STRIKE",
      duration: 0,
    },
  };

  // ------------------------------------------------------------
  // DOM
  // ------------------------------------------------------------

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });

  const dom = {
    score: document.getElementById("score"),
    wave: document.getElementById("wave"),
    enemies: document.getElementById("enemies"),
    lives: document.getElementById("lives"),
    highScore: document.getElementById("highScore"),
    overlay: document.getElementById("overlay"),
    overlayKicker: document.getElementById("overlayKicker"),
    overlayTitle: document.getElementById("overlayTitle"),
    overlayText: document.getElementById("overlayText"),
    overlayHint: document.getElementById("overlayHint"),
    startBtn: document.getElementById("startBtn"),
    startBtnText: document.getElementById("startBtnText"),
    announce: document.getElementById("announce"),
    announceKicker: document.getElementById("announceKicker"),
    announceText: document.getElementById("announceText"),
    pauseStamp: document.getElementById("pauseStamp"),
    pauseBtn: document.getElementById("pauseBtn"),
    muteBtn: document.getElementById("muteBtn"),
    restartBtn: document.getElementById("restartBtn"),
    buffList: document.getElementById("buffList"),
    buffEmpty: document.getElementById("buffEmpty"),
    buffStrip: document.getElementById("buffStrip"),
    fireBtn: document.getElementById("fireBtn"),
    screenWrap: document.getElementById("screenWrap"),
  };

  // ------------------------------------------------------------
  // State
  // ------------------------------------------------------------

  const state = {
    phase: "menu",
    map: createMap(),
    player: null,
    enemies: [],
    bullets: [],
    powerups: [],
    particles: [],
    explosions: [],
    textPops: [],
    time: 0,
    ambientTime: 0,
    score: 0,
    highScore: loadHighScore(),
    wave: 1,
    kills: 0,
    lives: 3,
    baseAlive: true,
    pendingSpawns: 0,
    spawnTimer: 0,
    waveActive: false,
    respawnTimer: 0,
    transitionTimer: 0,
    nextAction: "",
    doomTimer: 0,
    endReason: "",
    shake: 0,
    damageFlash: 0,
    screenFlash: 0,
    buffSignature: "",
  };

  let dpr = 1;
  let lastFrame = performance.now();
  let audioCtx = null;
  let masterGain = null;
  let noiseBuffer = null;
  let muted = loadMuted();
  let announceTimer = 0;
  let frameRequest = 0;

  // Input
  const heldDirections = [];
  const touchPointers = new Map();
  let keyboardFire = false;
  let touchFire = false;

  const MOVE_KEYS = new Map([
    ["ArrowUp", 0],
    ["KeyW", 0],
    ["ArrowRight", 1],
    ["KeyD", 1],
    ["ArrowDown", 2],
    ["KeyS", 2],
    ["ArrowLeft", 3],
    ["KeyA", 3],
  ]);

  // ------------------------------------------------------------
  // Utility
  // ------------------------------------------------------------

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function pad(value, length = 2) {
    return String(Math.max(0, Math.floor(value))).padStart(length, "0");
  }

  function formatScore(value) {
    return pad(value, 6);
  }

  function tileCenter(col, row) {
    return {
      x: col * TILE + TILE / 2,
      y: row * TILE + TILE / 2,
    };
  }

  function pointTile(x, y) {
    return {
      col: clamp(Math.floor(x / TILE), 0, COLS - 1),
      row: clamp(Math.floor(y / TILE), 0, ROWS - 1),
    };
  }

  function createMap() {
    const legend = {
      ".": EMPTY,
      "#": BRICK,
      "=": STEEL,
      "~": WATER,
      B: BASE,
    };
    return MAP_TEMPLATE.map((row) => [...row].map((char) => legend[char]));
  }

  function getTile(col, row) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return STEEL;
    return state.map[row][col];
  }

  function loadHighScore() {
    try {
      const saved = Number(window.localStorage.getItem(HIGH_SCORE_KEY));
      return Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : 0;
    } catch {
      return 0;
    }
  }

  function loadMuted() {
    try {
      return window.localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      return false;
    }
  }

  function saveHighScore() {
    try {
      window.localStorage.setItem(HIGH_SCORE_KEY, String(state.highScore));
    } catch {
      /* Storage can be unavailable in private or file contexts. */
    }
  }

  function addScore(amount) {
    state.score += amount;
    if (state.score > state.highScore) {
      state.highScore = state.score;
      saveHighScore();
    }
    updateHUD();
  }

  // ------------------------------------------------------------
  // Audio
  // ------------------------------------------------------------

  function ensureAudio() {
    if (audioCtx) {
      if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
      return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    audioCtx = new AudioContextClass();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = muted ? 0 : 0.22;
    masterGain.connect(audioCtx.destination);

    const length = Math.floor(audioCtx.sampleRate * 0.6);
    noiseBuffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  function applyMute() {
    if (masterGain && audioCtx) {
      masterGain.gain.setTargetAtTime(muted ? 0 : 0.22, audioCtx.currentTime, 0.01);
    }
    dom.muteBtn.textContent = muted ? "SOUND OFF" : "SOUND ON";
    dom.muteBtn.setAttribute("aria-pressed", String(muted));
  }

  function toggleMute() {
    ensureAudio();
    muted = !muted;
    try {
      window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {
      /* ignore */
    }
    applyMute();
  }

  function tone(freq, duration, options = {}) {
    if (!audioCtx || !masterGain || muted) return;
    const {
      type = "square",
      volume = 0.08,
      endFreq = freq,
      delay = 0,
    } = options;
    const now = audioCtx.currentTime + delay;
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, freq), now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(masterGain);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  function noise(duration, volume = 0.12, options = {}) {
    if (!audioCtx || !masterGain || !noiseBuffer || muted) return;
    const { filter = 1400, delay = 0 } = options;
    const now = audioCtx.currentTime + delay;
    const source = audioCtx.createBufferSource();
    const filterNode = audioCtx.createBiquadFilter();
    const gain = audioCtx.createGain();
    source.buffer = noiseBuffer;
    filterNode.type = "lowpass";
    filterNode.frequency.value = filter;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filterNode);
    filterNode.connect(gain);
    gain.connect(masterGain);
    source.start(now);
    source.stop(now + duration);
  }

  const sfx = {
    playerShoot() {
      tone(520, 0.08, { endFreq: 150, volume: 0.06, type: "square" });
      noise(0.04, 0.025, { filter: 2600 });
    },
    enemyShoot() {
      tone(220, 0.09, { endFreq: 105, volume: 0.022, type: "sawtooth" });
    },
    brick() {
      noise(0.1, 0.055, { filter: 850 });
      tone(120, 0.06, { endFreq: 60, volume: 0.025, type: "square" });
    },
    steel() {
      tone(1350, 0.07, { endFreq: 780, volume: 0.025, type: "triangle" });
      noise(0.05, 0.025, { filter: 5200 });
    },
    enemyHit() {
      tone(190, 0.07, { endFreq: 90, volume: 0.045, type: "square" });
    },
    explosion() {
      noise(0.38, 0.18, { filter: 620 });
      tone(82, 0.32, { endFreq: 34, volume: 0.09, type: "sawtooth" });
    },
    smallExplosion() {
      noise(0.2, 0.1, { filter: 900 });
      tone(100, 0.16, { endFreq: 45, volume: 0.05, type: "square" });
    },
    powerup() {
      [440, 660, 880].forEach((freq, index) => {
        tone(freq, 0.1, { volume: 0.045, type: "square", delay: index * 0.065 });
      });
    },
    respawn() {
      tone(330, 0.1, { endFreq: 660, volume: 0.035, type: "triangle" });
    },
    playerDeath() {
      noise(0.6, 0.16, { filter: 500 });
      tone(240, 0.6, { endFreq: 42, volume: 0.08, type: "sawtooth" });
    },
    waveStart() {
      [220, 330, 440].forEach((freq, index) => {
        tone(freq, 0.14, { volume: 0.035, type: "triangle", delay: index * 0.1 });
      });
    },
    waveClear() {
      [330, 440, 550, 660].forEach((freq, index) => {
        tone(freq, 0.16, { volume: 0.04, type: "square", delay: index * 0.09 });
      });
    },
    victory() {
      [392, 523, 659, 784, 1047].forEach((freq, index) => {
        tone(freq, 0.26, { volume: 0.045, type: "triangle", delay: index * 0.13 });
      });
    },
    gameOver() {
      [220, 185, 147, 110].forEach((freq, index) => {
        tone(freq, 0.38, { volume: 0.05, type: "sawtooth", delay: index * 0.18 });
      });
      noise(0.8, 0.08, { filter: 320 });
    },
    spawn() {
      tone(880, 0.08, { endFreq: 1320, volume: 0.018, type: "triangle" });
    },
  };

  // ------------------------------------------------------------
  // World setup
  // ------------------------------------------------------------

  function createPlayer() {
    const center = tileCenter(START_COL, START_ROW);
    return {
      id: "player",
      x: center.x,
      y: center.y,
      dir: 0,
      turretDir: 0,
      active: true,
      speed: 148,
      half: 15,
      fireCooldown: 0,
      rapidTimer: 0,
      shieldTimer: 2.2,
      hitFlash: 0,
      spawnTimer: 0.6,
      recoil: 0,
    };
  }

  function createEnemy(typeKey, x, y) {
    const type = ENEMY_TYPES[typeKey];
    return {
      id: `enemy-${Math.random().toString(36).slice(2)}`,
      typeKey,
      type,
      x,
      y,
      dir: 2,
      turretDir: 2,
      half: 15,
      speed: type.speed,
      hp: type.hp,
      maxHp: type.hp,
      score: type.score,
      active: true,
      dead: false,
      spawnTimer: 0.9,
      hitFlash: 0,
      recoil: 0,
      fireCooldown: random(1.0, 2.2),
      stepDir: null,
      stepTarget: null,
      blockedAhead: false,
      blockedTimer: 0,
      targetMode: Math.random() < 0.24 ? "player" : "base",
    };
  }

  function resetWorld() {
    state.map = createMap();
    state.player = createPlayer();
    state.enemies = [];
    state.bullets = [];
    state.powerups = [];
    state.particles = [];
    state.explosions = [];
    state.textPops = [];
    state.time = 0;
    state.score = 0;
    state.wave = 1;
    state.kills = 0;
    state.lives = 3;
    state.baseAlive = true;
    state.pendingSpawns = WAVES[0].total;
    state.spawnTimer = 0;
    state.waveActive = false;
    state.respawnTimer = 0;
    state.transitionTimer = 0;
    state.nextAction = "";
    state.doomTimer = 0;
    state.endReason = "";
    state.shake = 0;
    state.damageFlash = 0;
    state.screenFlash = 0;
    state.buffSignature = "";
    heldDirections.length = 0;
    touchPointers.clear();
    keyboardFire = false;
    touchFire = false;
    dom.announce.classList.remove("is-visible");
    dom.pauseStamp.hidden = true;
    updateHUD();
    updateBuffUI(true);
  }

  function startBattle() {
    ensureAudio();
    resetWorld();
    state.phase = "playing";
    dom.overlay.classList.add("is-hidden");
    dom.overlay.classList.remove("is-defeat");
    dom.pauseStamp.hidden = true;
    startWave(1);
    updateControlsUI();
    canvas.focus({ preventScroll: true });
    sfx.respawn();
  }

  function startWave(waveNumber) {
    const config = WAVES[waveNumber - 1];
    state.wave = waveNumber;
    state.pendingSpawns = config.total;
    state.spawnTimer = 0.55;
    state.waveActive = true;
    state.bullets = [];
    state.phase = "playing";
    announce(
      `WAVE ${pad(waveNumber)}`,
      waveNumber === WAVES.length ? "FINAL ARMORED COLUMN" : "ENEMY ARMOR INBOUND",
      1900,
    );
    sfx.waveStart();
    updateHUD();
    updateControlsUI();
  }

  // ------------------------------------------------------------
  // Wave / spawn flow
  // ------------------------------------------------------------

  function liveEnemies() {
    return state.enemies.filter((enemy) => !enemy.dead);
  }

  function enemiesLeft() {
    return state.pendingSpawns + liveEnemies().length;
  }

  function updateSpawner(dt) {
    if (!state.waveActive || state.pendingSpawns <= 0 || state.phase !== "playing") return;

    const config = WAVES[state.wave - 1];
    if (liveEnemies().length >= config.maxActive) return;

    state.spawnTimer -= dt;
    if (state.spawnTimer > 0) return;

    const spawn = findSpawnPoint();
    if (!spawn) {
      state.spawnTimer = 0.35;
      return;
    }

    const typeKey = pick(config.pool);
    state.enemies.push(createEnemy(typeKey, spawn.x, spawn.y));
    state.pendingSpawns -= 1;
    state.spawnTimer = config.interval * random(0.82, 1.16);
    sfx.spawn();
    updateHUD();
  }

  function findSpawnPoint() {
    const order = SPAWN_COLS.slice().sort(() => Math.random() - 0.5);
    for (const col of order) {
      const point = tileCenter(col, 0);
      if (canPlaceTank(null, point.x, point.y)) return point;
    }
    return null;
  }

  function checkWaveCompletion() {
    if (
      state.phase === "playing" &&
      state.waveActive &&
      state.pendingSpawns === 0 &&
      liveEnemies().length === 0
    ) {
      completeWave();
    }
  }

  function completeWave() {
    state.waveActive = false;
    state.bullets = [];
    const bonus = 500 * state.wave;
    addScore(bonus);
    sfx.waveClear();

    if (state.wave >= WAVES.length) {
      state.phase = "transition";
      state.transitionTimer = 3.1;
      state.nextAction = "victory";
      announce("ALL SECTORS SECURE", `FINAL BONUS +${bonus}`, 2900);
    } else {
      state.phase = "transition";
      state.transitionTimer = 2.9;
      state.nextAction = "next-wave";
      announce("SECTOR CLEARED", `+${bonus} BONUS // REINFORCEMENTS INBOUND`, 2500);
    }

    keyboardFire = false;
    touchFire = false;
    updateHUD();
    updateControlsUI();
  }

  function updateTransition(dt) {
    state.transitionTimer -= dt;
    if (state.transitionTimer > 0) return;

    if (state.nextAction === "victory") {
      finishGame(true);
      return;
    }

    state.nextAction = "";
    startWave(state.wave + 1);
    canvas.focus({ preventScroll: true });
  }

  function finishGame(victory) {
    state.phase = victory ? "victory" : "over";
    state.waveActive = false;
    state.bullets = [];
    keyboardFire = false;
    touchFire = false;

    if (victory) {
      addScore(2500);
      sfx.victory();
      showEndOverlay(true);
    } else {
      sfx.gameOver();
      showEndOverlay(false);
    }

    dom.announce.classList.remove("is-visible");
    saveHighScore();
    updateHUD();
    updateControlsUI();
    updateBuffUI(true);
  }

  function triggerDoom(reason) {
    if (state.phase !== "playing") return;
    state.endReason = reason;
    state.phase = "doom";
    state.doomTimer = reason === "base" ? 1.65 : 1.05;
    keyboardFire = false;
    touchFire = false;
    updateControlsUI();
  }

  // ------------------------------------------------------------
  // Tank collision / movement
  // ------------------------------------------------------------

  function isTankBlockingTile(tile) {
    return tile === BRICK || tile === STEEL || tile === WATER || tile === BASE;
  }

  function allTanks(except) {
    const tanks = [];
    if (state.player && state.player.active && state.player !== except) tanks.push(state.player);
    for (const enemy of state.enemies) {
      if (!enemy.dead && enemy.active && enemy !== except) tanks.push(enemy);
    }
    return tanks;
  }

  function canPlaceTank(tank, x, y) {
    const half = 15;
    if (x - half < 0 || x + half > W || y - half < 0 || y + half > H) return false;

    const startCol = Math.floor((x - half) / TILE);
    const endCol = Math.floor((x + half) / TILE);
    const startRow = Math.floor((y - half) / TILE);
    const endRow = Math.floor((y + half) / TILE);

    for (let row = startRow; row <= endRow; row += 1) {
      for (let col = startCol; col <= endCol; col += 1) {
        if (isTankBlockingTile(getTile(col, row))) return false;
      }
    }

    for (const other of allTanks(tank)) {
      if (Math.abs(x - other.x) < 31 && Math.abs(y - other.y) < 31) return false;
    }

    return true;
  }

  function moveTank(tank, direction, distance) {
    const vector = DIRS[direction];
    return tryTankPosition(tank, tank.x + vector.x * distance, tank.y + vector.y * distance);
  }

  function tryTankPosition(tank, x, y) {
    if (!canPlaceTank(tank, x, y)) return false;
    tank.x = x;
    tank.y = y;
    return true;
  }

  // ------------------------------------------------------------
  // Player
  // ------------------------------------------------------------

  function isFiring() {
    return keyboardFire || touchFire;
  }

  function updatePlayer(dt) {
    const player = state.player;
    if (!player) return;

    if (!player.active) {
      state.respawnTimer -= dt;
      if (state.respawnTimer <= 0) respawnPlayer();
      return;
    }

    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    player.rapidTimer = Math.max(0, player.rapidTimer - dt);
    player.shieldTimer = Math.max(0, player.shieldTimer - dt);
    player.hitFlash = Math.max(0, player.hitFlash - dt);
    player.recoil = Math.max(0, player.recoil - dt * 6);

    if (player.spawnTimer > 0) {
      player.spawnTimer = Math.max(0, player.spawnTimer - dt);
      return;
    }

    const direction = currentDirection();
    if (direction !== null) {
      player.dir = direction;
      player.turretDir = direction;
      const moved = moveTank(player, direction, player.speed * dt);
      if (!moved) {
        // A tiny nudge helps the hull slide around tile corners.
        const slide = direction === 0 || direction === 2 ? { x: 1, y: 0 } : { x: 0, y: 1 };
        const sign = Math.random() < 0.5 ? 1 : -1;
        tryTankPosition(player, player.x + slide.x * 0.8 * sign, player.y + slide.y * 0.8 * sign);
      }
    }

    if (isFiring()) tryPlayerShoot();
  }

  function tryPlayerShoot() {
    const player = state.player;
    if (!player || !player.active || player.fireCooldown > 0 || player.spawnTimer > 0) return;

    const activeBullets = state.bullets.filter(
      (bullet) => !bullet.dead && bullet.fromPlayer,
    ).length;
    const maxBullets = player.rapidTimer > 0 ? 3 : 2;
    if (activeBullets >= maxBullets) return;

    fireBullet(player, player.dir, true);
    player.fireCooldown = player.rapidTimer > 0 ? 0.16 : 0.33;
    player.recoil = 1;
  }

  function hitPlayer(bullet) {
    const player = state.player;
    if (!player || !player.active) return;

    if (player.shieldTimer > 0 || player.spawnTimer > 0) {
      emitSparks(bullet.x, bullet.y, "#7fded0", 7, 90);
      tone(720, 0.09, { endFreq: 980, volume: 0.025, type: "triangle" });
      return;
    }

    player.active = false;
    player.hitFlash = 0;
    state.lives = Math.max(0, state.lives - 1);
    state.shake = 15;
    state.damageFlash = 0.95;
    spawnExplosion(player.x, player.y, 1.55, "#ff6b4d");
    sfx.playerDeath();
    updateHUD();

    if (state.lives <= 0) {
      triggerDoom("player");
    } else {
      state.respawnTimer = 1.35;
    }
  }

  function respawnPlayer() {
    if (state.lives <= 0 || state.phase !== "playing") return;
    const start = tileCenter(START_COL, START_ROW);
    if (!canPlaceTank(null, start.x, start.y)) {
      state.respawnTimer = 0.45;
      return;
    }

    const player = state.player;
    player.x = start.x;
    player.y = start.y;
    player.dir = 0;
    player.turretDir = 0;
    player.active = true;
    player.hp = 1;
    player.fireCooldown = 0.25;
    player.rapidTimer = 0;
    player.shieldTimer = 2.7;
    player.spawnTimer = 0.55;
    player.hitFlash = 0;
    state.respawnTimer = 0;
    emitSparks(start.x, start.y, "#a9d36c", 18, 130);
    sfx.respawn();
    updateHUD();
  }

  // ------------------------------------------------------------
  // Enemy AI
  // ------------------------------------------------------------

  function updateEnemies(dt) {
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;

      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      enemy.recoil = Math.max(0, enemy.recoil - dt * 5);

      if (enemy.spawnTimer > 0) {
        enemy.spawnTimer = Math.max(0, enemy.spawnTimer - dt);
        continue;
      }

      enemy.fireCooldown -= dt;
      updateEnemyMovement(enemy, dt);

      if (enemy.fireCooldown <= 0) {
        const aim = findAimDirection(enemy);
        const shootDir = enemy.blockedAhead ? enemy.dir : aim ?? enemy.dir;
        enemy.turretDir = shootDir;
        fireBullet(enemy, shootDir, false);
        const wavePressure = 1 + (WAVES.length - state.wave) * 0.055;
        enemy.fireCooldown = enemy.type.fireRate * wavePressure * random(0.88, 1.25);
      }
    }
  }

  function updateEnemyMovement(enemy, dt) {
    if (!enemy.stepDir) chooseEnemyStep(enemy);
    if (enemy.stepDir === null || !enemy.stepTarget) return;

    const target = enemy.stepTarget;
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const distance = Math.abs(dx) + Math.abs(dy);

    if (distance < 0.2) {
      enemy.x = target.x;
      enemy.y = target.y;
      enemy.stepDir = null;
      enemy.stepTarget = null;
      enemy.blockedAhead = false;
      enemy.blockedTimer = 0;
      return;
    }

    const vector = DIRS[enemy.stepDir];
    const travel = Math.min(enemy.speed * dt, distance);
    const nextX = enemy.x + vector.x * travel;
    const nextY = enemy.y + vector.y * travel;

    if (!tryTankPosition(enemy, nextX, nextY)) {
      enemy.blockedAhead = true;
      enemy.blockedTimer += dt;
      if (enemy.blockedTimer > 2.4) {
        enemy.stepDir = null;
        enemy.stepTarget = null;
        enemy.blockedTimer = 0;
      }
      return;
    }

    enemy.blockedAhead = false;
    enemy.blockedTimer = 0;

    if (Math.abs(target.x - enemy.x) + Math.abs(target.y - enemy.y) < 0.4) {
      enemy.x = target.x;
      enemy.y = target.y;
      enemy.stepDir = null;
      enemy.stepTarget = null;
    }
  }

  function chooseEnemyStep(enemy) {
    const from = pointTile(enemy.x, enemy.y);
    const target = enemyTargetTile(enemy);
    let direction = firstStepTowards(from.col, from.row, target.col, target.row);

    if (direction === null) {
      const options = [];
      for (let dir = 0; dir < 4; dir += 1) {
        const vector = DIRS[dir];
        const col = from.col + vector.x;
        const row = from.row + vector.y;
        const tile = getTile(col, row);
        if (tile !== STEEL && tile !== WATER && tile !== BASE) {
          options.push(dir);
        }
      }
      const filtered = options.filter((dir) => dir !== OPPOSITE[enemy.dir]);
      direction = filtered.length ? pick(filtered) : options.length ? pick(options) : null;
    }

    if (direction === null) {
      enemy.stepDir = null;
      enemy.stepTarget = null;
      return;
    }

    const vector = DIRS[direction];
    enemy.dir = direction;
    enemy.stepDir = direction;
    enemy.stepTarget = tileCenter(from.col + vector.x, from.row + vector.y);
  }

  function enemyTargetTile(enemy) {
    const player = state.player;
    if (enemy.targetMode === "player" && player?.active) {
      return pointTile(player.x, player.y);
    }
    if (state.baseAlive) {
      return { col: BASE_COL, row: BASE_ROW };
    }
    if (player?.active) return pointTile(player.x, player.y);
    return { col: BASE_COL, row: BASE_ROW };
  }

  function findAimDirection(enemy) {
    const targets = [];
    if (state.player?.active) {
      targets.push({ x: state.player.x, y: state.player.y });
    }
    if (state.baseAlive) {
      targets.push(tileCenter(BASE_COL, BASE_ROW));
    }

    let best = null;
    let bestDistance = Infinity;

    for (const target of targets) {
      const dx = target.x - enemy.x;
      const dy = target.y - enemy.y;
      const verticalAligned = Math.abs(dx) < 27 && Math.abs(dy) > 8;
      const horizontalAligned = Math.abs(dy) < 27 && Math.abs(dx) > 8;

      if (verticalAligned) {
        const distance = Math.abs(dy);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = dy < 0 ? 0 : 2;
        }
      } else if (horizontalAligned) {
        const distance = Math.abs(dx);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = dx < 0 ? 3 : 1;
        }
      }
    }

    return best;
  }

  function firstStepTowards(startCol, startRow, targetCol, targetRow) {
    if (
      startCol < 0 ||
      startCol >= COLS ||
      startRow < 0 ||
      startRow >= ROWS ||
      targetCol < 0 ||
      targetCol >= COLS ||
      targetRow < 0 ||
      targetRow >= ROWS
    ) {
      return null;
    }

    const start = startRow * COLS + startCol;
    const target = targetRow * COLS + targetCol;
    if (start === target) return null;

    const count = COLS * ROWS;
    const distance = new Float32Array(count);
    const previous = new Int16Array(count);
    const visited = new Uint8Array(count);
    distance.fill(Infinity);
    previous.fill(-1);
    distance[start] = 0;

    for (let iteration = 0; iteration < count; iteration += 1) {
      let current = -1;
      let bestDistance = Infinity;

      for (let index = 0; index < count; index += 1) {
        if (!visited[index] && distance[index] < bestDistance) {
          bestDistance = distance[index];
          current = index;
        }
      }

      if (current === -1) break;
      if (current === target) break;
      visited[current] = 1;

      const col = current % COLS;
      const row = Math.floor(current / COLS);

      for (let dir = 0; dir < 4; dir += 1) {
        const vector = DIRS[dir];
        const nextCol = col + vector.x;
        const nextRow = row + vector.y;
        if (nextCol < 0 || nextCol >= COLS || nextRow < 0 || nextRow >= ROWS) continue;

        const tile = getTile(nextCol, nextRow);
        if (tile === STEEL || tile === WATER) continue;

        const neighbor = nextRow * COLS + nextCol;
        if (visited[neighbor]) continue;

        // Bricks are traversable at a high cost: the AI will shoot through them.
        const stepCost = tile === BRICK ? 7 : 1;
        const nextDistance = distance[current] + stepCost;
        if (nextDistance < distance[neighbor]) {
          distance[neighbor] = nextDistance;
          previous[neighbor] = current;
        }
      }
    }

    if (!Number.isFinite(distance[target])) return null;

    let current = target;
    let guard = 0;
    while (previous[current] !== start) {
      current = previous[current];
      guard += 1;
      if (current === -1 || guard > count) return null;
    }

    const col = current % COLS;
    const row = Math.floor(current / COLS);
    const dx = col - startCol;
    const dy = row - startRow;

    if (dx === 1) return 1;
    if (dx === -1) return 3;
    if (dy === 1) return 2;
    if (dy === -1) return 0;
    return null;
  }

  // ------------------------------------------------------------
  // Projectiles
  // ------------------------------------------------------------

  function fireBullet(tank, direction, fromPlayer) {
    if (state.phase !== "playing") return;
    const vector = DIRS[direction];
    const speed = fromPlayer ? 430 : tank.type?.bulletSpeed ?? 240;
    const bullet = {
      x: tank.x + vector.x * 23,
      y: tank.y + vector.y * 23,
      vx: vector.x * speed,
      vy: vector.y * speed,
      speed,
      direction,
      fromPlayer,
      dead: false,
      life: 3.3,
      radius: 2.8,
    };

    state.bullets.push(bullet);
    emitSparks(bullet.x, bullet.y, fromPlayer ? "#ffd36a" : "#ff8a6c", 4, 65);

    if (fromPlayer) {
      sfx.playerShoot();
    } else {
      sfx.enemyShoot();
    }
  }

  function updateBullets(dt) {
    for (const bullet of state.bullets) {
      if (bullet.dead) continue;
      bullet.life -= dt;
      if (bullet.life <= 0) {
        bullet.dead = true;
        continue;
      }

      const distance = bullet.speed * dt;
      const steps = Math.max(1, Math.ceil(distance / 5));
      const stepX = (bullet.vx * dt) / steps;
      const stepY = (bullet.vy * dt) / steps;

      for (let step = 0; step < steps && !bullet.dead; step += 1) {
        bullet.x += stepX;
        bullet.y += stepY;

        if (
          bullet.x < -2 ||
          bullet.x > W + 2 ||
          bullet.y < -2 ||
          bullet.y > H + 2
        ) {
          bullet.dead = true;
          emitSparks(
            clamp(bullet.x, 2, W - 2),
            clamp(bullet.y, 2, H - 2),
            "#ffd36a",
            4,
            50,
          );
          break;
        }

        const tilePosition = pointTile(bullet.x, bullet.y);
        const tile = getTile(tilePosition.col, tilePosition.row);

        if (tile === BRICK) {
          destroyBrick(tilePosition.col, tilePosition.row);
          bullet.dead = true;
          sfx.brick();
          break;
        }

        if (tile === STEEL) {
          bullet.dead = true;
          emitSparks(bullet.x, bullet.y, "#d4dfd8", 8, 100);
          sfx.steel();
          break;
        }

        if (tile === BASE) {
          bullet.dead = true;
          destroyBase(bullet.x, bullet.y);
          break;
        }

        if (bullet.fromPlayer) {
          let hit = false;
          for (const enemy of state.enemies) {
            if (enemy.dead || enemy.spawnTimer > 0) continue;
            if (Math.abs(bullet.x - enemy.x) < 17 && Math.abs(bullet.y - enemy.y) < 17) {
              bullet.dead = true;
              hit = true;
              damageEnemy(enemy, bullet.x, bullet.y);
              break;
            }
          }
          if (hit) break;
        } else {
          const player = state.player;
          if (
            player?.active &&
            Math.abs(bullet.x - player.x) < 17 &&
            Math.abs(bullet.y - player.y) < 17
          ) {
            bullet.dead = true;
            hitPlayer(bullet);
            break;
          }
        }
      }
    }

    // Player projectiles can intercept enemy projectiles.
    for (let i = 0; i < state.bullets.length; i += 1) {
      const first = state.bullets[i];
      if (first.dead) continue;
      for (let j = i + 1; j < state.bullets.length; j += 1) {
        const second = state.bullets[j];
        if (second.dead || first.fromPlayer === second.fromPlayer) continue;
        const dx = first.x - second.x;
        const dy = first.y - second.y;
        if (dx * dx + dy * dy < 100) {
          first.dead = true;
          second.dead = true;
          emitSparks((first.x + second.x) / 2, (first.y + second.y) / 2, "#ffe4a3", 9, 100);
          tone(960, 0.05, { endFreq: 500, volume: 0.02, type: "square" });
          break;
        }
      }
    }

    state.bullets = state.bullets.filter((bullet) => !bullet.dead);
  }

  function destroyBrick(col, row) {
    if (getTile(col, row) !== BRICK) return;
    state.map[row][col] = EMPTY;
    const center = tileCenter(col, row);
    for (let i = 0; i < 12; i += 1) {
      state.particles.push({
        x: center.x + random(-18, 18),
        y: center.y + random(-18, 18),
        vx: random(-75, 75),
        vy: random(-110, 25),
        gravity: 240,
        size: random(2, 5),
        color: pick(["#a95439", "#c46c4e", "#7b3627", "#d78b67"]),
        life: random(0.3, 0.65),
        maxLife: 0.65,
      });
    }
    state.shake = Math.max(state.shake, 2.5);
  }

  function damageEnemy(enemy, x, y) {
    if (enemy.dead) return;
    enemy.hp -= 1;
    enemy.hitFlash = 0.13;

    if (enemy.hp > 0) {
      emitSparks(x, y, "#ffd36a", 8, 95);
      sfx.enemyHit();
      return;
    }

    killEnemy(enemy, x, y);
  }

  function killEnemy(enemy, x, y) {
    if (enemy.dead) return;
    enemy.dead = true;
    state.kills += 1;
    addScore(enemy.score);
    state.shake = Math.max(state.shake, 5);
    spawnExplosion(enemy.x, enemy.y, enemy.typeKey === "armor" ? 1.5 : 1.1, "#ffb52e");
    addTextPop(enemy.x, enemy.y - 10, `+${enemy.score}`, "#ffd36a");
    sfx.explosion();
    maybeDropPowerup(enemy.x, enemy.y);
    updateHUD();
  }

  function destroyBase(x, y) {
    if (!state.baseAlive) return;
    state.baseAlive = false;
    state.shake = 22;
    state.screenFlash = 0.7;
    state.damageFlash = 1;
    const center = tileCenter(BASE_COL, BASE_ROW);
    spawnExplosion(center.x, center.y, 3.2, "#ff7a42");
    setTimeout(() => spawnExplosion(center.x + 13, center.y - 8, 1.9, "#ffb52e"), 130);
    setTimeout(() => spawnExplosion(center.x - 16, center.y + 4, 1.6, "#ff6b4d"), 260);
    sfx.explosion();
    announce("COMMAND EAGLE LOST", "DEFENSE LINE COLLAPSED", 1800);
    triggerDoom("base");
    updateHUD();
  }

  // ------------------------------------------------------------
  // Powerups
  // ------------------------------------------------------------

  function maybeDropPowerup(x, y) {
    if (Math.random() > 0.19) return;
    const roll = Math.random();
    let type = "shield";
    if (roll > 0.78) type = "bomb";
    else if (roll > 0.56) type = "life";
    else if (roll > 0.3) type = "rapid";

    state.powerups.push({
      x,
      y,
      type,
      life: 13,
      maxLife: 13,
      bob: random(0, Math.PI * 2),
      dead: false,
    });
  }

  function updatePowerups(dt) {
    const player = state.player;
    for (const powerup of state.powerups) {
      powerup.life -= dt;
      powerup.bob += dt * 3;
      if (powerup.life <= 0) {
        powerup.dead = true;
        continue;
      }

      if (
        player?.active &&
        Math.abs(powerup.x - player.x) < 25 &&
        Math.abs(powerup.y - player.y) < 25
      ) {
        powerup.dead = true;
        collectPowerup(powerup);
      }
    }
    state.powerups = state.powerups.filter((powerup) => !powerup.dead);
  }

  function collectPowerup(powerup) {
    const player = state.player;
    const config = POWERUPS[powerup.type];
    sfx.powerup();
    state.screenFlash = 0.22;
    emitSparks(powerup.x, powerup.y, config.color, 22, 150);
    addTextPop(powerup.x, powerup.y - 12, config.label, config.color);

    if (powerup.type === "shield") {
      player.shieldTimer = Math.max(player.shieldTimer, 9);
    } else if (powerup.type === "rapid") {
      player.rapidTimer = Math.max(player.rapidTimer, 11);
    } else if (powerup.type === "life") {
      state.lives = Math.min(9, state.lives + 1);
    } else if (powerup.type === "bomb") {
      state.shake = 13;
      state.screenFlash = 0.55;
      const targets = liveEnemies();
      for (const enemy of targets) {
        killEnemy(enemy, enemy.x, enemy.y);
      }
      sfx.explosion();
    }

    updateHUD();
    updateBuffUI(true);
  }

  // ------------------------------------------------------------
  // Effects
  // ------------------------------------------------------------

  function emitSparks(x, y, color, count, spread) {
    if (state.particles.length > 650) return;
    for (let i = 0; i < count; i += 1) {
      const angle = random(0, Math.PI * 2);
      const speed = random(spread * 0.25, spread);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 80,
        size: random(1.5, 3.6),
        color,
        life: random(0.18, 0.48),
        maxLife: 0.48,
      });
    }
  }

  function spawnExplosion(x, y, size = 1, color = "#ffb52e") {
    state.explosions.push({
      x,
      y,
      age: 0,
      duration: 0.36 + size * 0.1,
      radius: 17 * size,
      color,
    });

    const count = Math.min(44, Math.floor(14 * size));
    for (let i = 0; i < count; i += 1) {
      const angle = random(0, Math.PI * 2);
      const speed = random(25, 165 * Math.sqrt(size));
      state.particles.push({
        x: x + random(-4, 4),
        y: y + random(-4, 4),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 45,
        size: random(2, 2 + 4 * Math.sqrt(size)),
        color: pick([color, "#ff6b4d", "#ffe4a3", "#9b4d35"]),
        life: random(0.3, 0.85),
        maxLife: 0.85,
      });
    }
  }

  function addTextPop(x, y, text, color) {
    state.textPops.push({
      x,
      y,
      text,
      color,
      life: 0.95,
      maxLife: 0.95,
    });
  }

  function updateEffects(dt) {
    state.shake = Math.max(0, state.shake - dt * 24);
    state.damageFlash = Math.max(0, state.damageFlash - dt * 1.8);
    state.screenFlash = Math.max(0, state.screenFlash - dt * 2.7);

    for (const particle of state.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += particle.gravity * dt;
      particle.vx *= 0.985;
    }
    state.particles = state.particles.filter((particle) => particle.life > 0);

    for (const explosion of state.explosions) {
      explosion.age += dt;
    }
    state.explosions = state.explosions.filter(
      (explosion) => explosion.age < explosion.duration,
    );

    for (const textPop of state.textPops) {
      textPop.life -= dt;
      textPop.y -= dt * 24;
    }
    state.textPops = state.textPops.filter((textPop) => textPop.life > 0);
  }

  // ------------------------------------------------------------
  // Main updates
  // ------------------------------------------------------------

  function updateGame(dt) {
    state.time += dt;
    updatePlayer(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updatePowerups(dt);
    updateSpawner(dt);
    state.enemies = state.enemies.filter((enemy) => !enemy.dead);
    checkWaveCompletion();
    updateHUD();
  }

  function updateDoom(dt) {
    state.time += dt;
    state.doomTimer -= dt;
    if (state.doomTimer <= 0) {
      finishGame(false);
    }
  }

  // ------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------

  function setupCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const targetWidth = Math.round(W * dpr);
    const targetHeight = Math.round(H * dpr);
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
    ctx.imageSmoothingEnabled = false;
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    if (state.shake > 0.1) {
      ctx.translate(random(-state.shake, state.shake) * 0.5, random(-state.shake, state.shake) * 0.5);
    }

    drawFloor();
    drawMap();
    drawPowerups();
    drawEnemies();
    drawPlayer();
    drawBullets();
    drawExplosions();
    drawParticles();
    drawTextPops();
    drawArenaEdges();

    ctx.restore();

    if (state.damageFlash > 0) {
      ctx.fillStyle = `rgba(255, 61, 42, ${state.damageFlash * 0.2})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (state.screenFlash > 0) {
      ctx.fillStyle = `rgba(255, 238, 195, ${state.screenFlash * 0.18})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (state.phase === "doom") {
      ctx.fillStyle = "rgba(10, 8, 5, 0.22)";
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawFloor() {
    ctx.fillStyle = "#0c130e";
    ctx.fillRect(0, 0, W, H);

    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const x = col * TILE;
        const y = row * TILE;
        if ((row + col) % 2 === 0) {
          ctx.fillStyle = "rgba(174, 197, 160, 0.018)";
          ctx.fillRect(x, y, TILE, TILE);
        }

        ctx.fillStyle = "rgba(217, 229, 197, 0.025)";
        ctx.fillRect(x, y, TILE, 1);
        ctx.fillRect(x, y, 1, TILE);
      }
    }

    // Faint diagonal hazard marks in the corners.
    ctx.save();
    ctx.strokeStyle = "rgba(255, 181, 46, 0.035)";
    ctx.lineWidth = 5;
    for (let offset = 0; offset < 130; offset += 18) {
      ctx.beginPath();
      ctx.moveTo(offset, 0);
      ctx.lineTo(0, offset);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(W - offset, H);
      ctx.lineTo(W, H - offset);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMap() {
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const tile = getTile(col, row);
        if (tile === BRICK) drawBrick(col, row);
        else if (tile === STEEL) drawSteel(col, row);
        else if (tile === WATER) drawWater(col, row);
      }
    }
    drawBase();
  }

  function drawBrick(col, row) {
    const x = col * TILE;
    const y = row * TILE;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, TILE, TILE);
    ctx.clip();

    ctx.fillStyle = "#3d241c";
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = "#8e452f";
    ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);

    const brickW = 20;
    const brickH = 10;
    for (let brickRow = 0; brickRow < 4; brickRow += 1) {
      const offset = brickRow % 2 === 0 ? -4 : 7;
      for (let bx = x + offset; bx < x + TILE; bx += brickW + 3) {
        const by = y + 2 + brickRow * 11;
        ctx.fillStyle = "#a95439";
        ctx.fillRect(bx, by, brickW, brickH);
        ctx.fillStyle = "#c46c4e";
        ctx.fillRect(bx, by, brickW, 2);
        ctx.fillStyle = "#713224";
        ctx.fillRect(bx, by + brickH - 2, brickW, 2);
        ctx.fillStyle = "rgba(61, 31, 23, 0.22)";
        ctx.fillRect(bx + 12, by + 3, 5, 3);
      }
    }
    ctx.restore();
  }

  function drawSteel(col, row) {
    const x = col * TILE;
    const y = row * TILE;
    ctx.fillStyle = "#263234";
    ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
    ctx.fillStyle = "#5f7374";
    ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = "#7f9492";
    ctx.fillRect(x + 3, y + 3, TILE - 6, 3);
    ctx.fillRect(x + 3, y + 3, 3, TILE - 6);
    ctx.fillStyle = "#455659";
    ctx.fillRect(x + 3, y + TILE - 8, TILE - 6, 5);
    ctx.fillRect(x + TILE - 8, y + 3, 5, TILE - 6);

    ctx.strokeStyle = "rgba(27, 37, 37, 0.65)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 9.5, y + 9.5, TILE - 19, TILE - 19);

    ctx.fillStyle = "#c6d2ce";
    for (const [dx, dy] of [
      [6, 6],
      [TILE - 8, 6],
      [6, TILE - 8],
      [TILE - 8, TILE - 8],
    ]) {
      ctx.fillRect(x + dx, y + dy, 2, 2);
    }

    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(x + 15, y + 15, 18, 2);
    ctx.fillRect(x + 15, y + 15, 2, 18);
  }

  function drawWater(col, row) {
    const x = col * TILE;
    const y = row * TILE;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, TILE, TILE);
    ctx.clip();

    const gradient = ctx.createLinearGradient(x, y, x, y + TILE);
    gradient.addColorStop(0, "#16444d");
    gradient.addColorStop(1, "#0d2c38");
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, TILE, TILE);

    ctx.strokeStyle = "rgba(127, 222, 208, 0.28)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      const offset = (state.ambientTime * 12 + i * 16 + col * 7 + row * 4) % 54 - 6;
      ctx.beginPath();
      ctx.moveTo(x + 3, y + offset);
      ctx.lineTo(x + 20, y + offset);
      ctx.moveTo(x + 30, y + offset + 7);
      ctx.lineTo(x + 45, y + offset + 7);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(211, 248, 234, 0.16)";
    ctx.fillRect(x + 7, y + 13, 11, 1);
    ctx.fillRect(x + 28, y + 31, 14, 1);
    ctx.restore();
  }

  function drawBase() {
    const x = BASE_COL * TILE;
    const y = BASE_ROW * TILE;

    ctx.fillStyle = "#252d27";
    ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
    ctx.strokeStyle = "rgba(255, 181, 46, 0.24)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 4.5, y + 4.5, TILE - 9, TILE - 9);

    if (!state.baseAlive) {
      ctx.fillStyle = "#120e0a";
      ctx.fillRect(x + 6, y + 9, TILE - 12, TILE - 13);
      ctx.fillStyle = "#47341f";
      ctx.beginPath();
      ctx.moveTo(x + 10, y + 40);
      ctx.lineTo(x + 17, y + 22);
      ctx.lineTo(x + 24, y + 36);
      ctx.lineTo(x + 31, y + 18);
      ctx.lineTo(x + 39, y + 40);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255, 102, 56, 0.65)";
      ctx.fillRect(x + 16, y + 35, 3, 5);
      ctx.fillRect(x + 31, y + 31, 2, 6);
      return;
    }

    ctx.save();
    ctx.translate(x + TILE / 2, y + TILE / 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
    ctx.fillRect(-17, 17, 34, 4);

    // A stepped pixel eagle.
    ctx.fillStyle = "#c7953f";
    ctx.beginPath();
    ctx.moveTo(0, -19);
    ctx.lineTo(5, -12);
    ctx.lineTo(10, -14);
    ctx.lineTo(9, -5);
    ctx.lineTo(18, -10);
    ctx.lineTo(15, 0);
    ctx.lineTo(9, 5);
    ctx.lineTo(11, 17);
    ctx.lineTo(4, 13);
    ctx.lineTo(0, 20);
    ctx.lineTo(-4, 13);
    ctx.lineTo(-11, 17);
    ctx.lineTo(-9, 5);
    ctx.lineTo(-15, 0);
    ctx.lineTo(-18, -10);
    ctx.lineTo(-9, -5);
    ctx.lineTo(-10, -14);
    ctx.lineTo(-5, -12);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#f3d271";
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(4, -8);
    ctx.lineTo(0, 10);
    ctx.lineTo(-4, -8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#1b2118";
    ctx.fillRect(-4, -10, 2, 2);
    ctx.fillRect(2, -10, 2, 2);
    ctx.fillStyle = "#f3d271";
    ctx.fillRect(-1, -7, 2, 5);
    ctx.restore();
  }

  function drawEnemies() {
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      if (enemy.spawnTimer > 0) {
        drawSpawnEffect(enemy.x, enemy.y, enemy.spawnTimer);
      } else {
        drawTank(enemy, false);
      }
    }
  }

  function drawSpawnEffect(x, y, timer) {
    const progress = 1 - Math.min(1, timer / 0.9);
    const pulse = 0.55 + Math.sin(state.ambientTime * 22) * 0.25;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(state.ambientTime * 3);
    ctx.strokeStyle = `rgba(127, 222, 208, ${pulse * (0.4 + progress * 0.6)})`;
    ctx.lineWidth = 2;
    const size = 10 + progress * 11;
    for (let i = 0; i < 4; i += 1) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(size, -size * 0.45);
      ctx.lineTo(size, -size);
      ctx.lineTo(size * 0.45, -size);
      ctx.stroke();
    }
    ctx.rotate(-state.ambientTime * 3);
    ctx.fillStyle = `rgba(255, 181, 46, ${0.16 + progress * 0.22})`;
    ctx.fillRect(-10 - progress * 4, -10 - progress * 4, 20 + progress * 8, 20 + progress * 8);
    ctx.restore();
  }

  function drawPlayer() {
    const player = state.player;
    if (!player || !player.active) return;
    if (player.spawnTimer > 0) {
      drawSpawnEffect(player.x, player.y, Math.max(0.06, player.spawnTimer));
    }
    drawTank(player, true);
  }

  function drawTank(tank, isPlayer) {
    const colors = isPlayer
      ? {
          body: "#c7d36b",
          shade: "#6c7838",
          accent: "#eff4bb",
          tread: "#31381e",
          detail: "#3b4323",
        }
      : {
          body: tank.type.color,
          shade: tank.type.shade,
          accent: tank.type.accent,
          tread: tank.type.tread,
          detail: "#141b16",
        };

    const flash = tank.hitFlash > 0;
    const shield = isPlayer && tank.shieldTimer > 0;
    const recoilOffset = tank.recoil > 0 ? 1.5 : 0;

    ctx.save();
    ctx.translate(tank.x, tank.y);

    // Ground shadow.
    ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
    ctx.fillRect(-15, 14, 30, 5);

    ctx.rotate(tank.dir * (Math.PI / 2));

    // Treads.
    ctx.fillStyle = colors.tread;
    ctx.fillRect(-18, -17, 7, 34);
    ctx.fillRect(11, -17, 7, 34);
    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    for (let treadY = -13; treadY <= 13; treadY += 7) {
      ctx.fillRect(-18, treadY, 7, 2);
      ctx.fillRect(11, treadY, 7, 2);
    }
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.fillRect(-15, -17, 2, 34);
    ctx.fillRect(13, -17, 2, 34);

    // Hull.
    ctx.fillStyle = colors.shade;
    ctx.fillRect(-12, -14, 24, 30);
    ctx.fillStyle = colors.body;
    ctx.fillRect(-10, -12, 20, 26);
    ctx.fillStyle = colors.accent;
    ctx.fillRect(-10, -12, 20, 2);
    ctx.fillRect(-10, 8, 20, 2);
    ctx.fillStyle = colors.detail;
    ctx.fillRect(-10, 3, 20, 3);
    ctx.fillRect(5, -12, 3, 15);

    if (isPlayer) {
      ctx.fillStyle = "#ffb52e";
      ctx.fillRect(-8, 10, 16, 2);
      ctx.fillRect(-2, -6, 4, 7);
    } else if (tank.typeKey === "armor") {
      ctx.fillStyle = "#c6d9cd";
      ctx.fillRect(-8, -4, 16, 2);
      ctx.fillRect(-8, 0, 16, 2);
    } else if (tank.typeKey === "scout") {
      ctx.fillStyle = "#f7e6a8";
      ctx.fillRect(-8, 6, 5, 2);
      ctx.fillRect(3, 6, 5, 2);
    } else {
      ctx.fillStyle = colors.accent;
      ctx.fillRect(-7, 6, 3, 3);
      ctx.fillRect(4, 6, 3, 3);
    }

    // Independently aimed turret and barrel.
    const turretRotation = ((tank.turretDir ?? tank.dir) - tank.dir) * (Math.PI / 2);
    ctx.save();
    ctx.rotate(turretRotation);

    ctx.fillStyle = colors.tread;
    ctx.fillRect(-4, -27 + recoilOffset, 8, 23);
    ctx.fillStyle = colors.accent;
    ctx.fillRect(-2, -26 + recoilOffset, 4, 20);
    ctx.fillStyle = colors.detail;
    ctx.fillRect(-5, -28 + recoilOffset, 10, 3);

    ctx.fillStyle = colors.shade;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.body;
    ctx.beginPath();
    ctx.arc(0, -1, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.accent;
    ctx.fillRect(-2, -4, 4, 3);
    ctx.fillStyle = colors.detail;
    ctx.beginPath();
    ctx.arc(0, -1, 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (flash) {
      ctx.globalAlpha = 0.68;
      ctx.fillStyle = "#fff8e1";
      ctx.fillRect(-12, -14, 24, 30);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    if (shield) {
      ctx.save();
      ctx.translate(tank.x, tank.y);
      ctx.rotate(state.ambientTime * 1.2);
      ctx.strokeStyle = "rgba(127, 222, 208, 0.72)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, 23, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(127, 222, 208, 0.16)";
      ctx.beginPath();
      ctx.arc(0, 0, 27, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (!isPlayer && tank.maxHp > 1) {
      const width = 24;
      const healthRatio = Math.max(0, tank.hp / tank.maxHp);
      ctx.fillStyle = "rgba(7, 11, 8, 0.65)";
      ctx.fillRect(tank.x - width / 2, tank.y - 27, width, 3);
      ctx.fillStyle = "#c6d9cd";
      ctx.fillRect(tank.x - width / 2, tank.y - 27, width * healthRatio, 3);
    }
  }

  function drawBullets() {
    ctx.save();
    for (const bullet of state.bullets) {
      if (bullet.dead) continue;
      const color = bullet.fromPlayer ? "#ffd36a" : "#ff7157";
      const trailX = bullet.x - bullet.vx * 0.028;
      const trailY = bullet.y - bullet.vy * 0.028;

      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(trailX, trailY);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();

      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 2.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff6d4";
      ctx.fillRect(bullet.x - 1, bullet.y - 1, 2, 2);
    }
    ctx.restore();
  }

  function drawPowerups() {
    for (const powerup of state.powerups) {
      const blink = powerup.life < 3.5 && Math.floor(powerup.life * 7) % 2 === 0;
      if (blink) continue;
      const bobY = Math.sin(powerup.bob) * 2.5;
      const config = POWERUPS[powerup.type];

      ctx.save();
      ctx.translate(powerup.x, powerup.y + bobY);
      ctx.fillStyle = "rgba(5, 10, 7, 0.55)";
      ctx.fillRect(-15, 14, 30, 5);
      ctx.fillStyle = "#101811";
      ctx.fillRect(-15, -15, 30, 30);
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-14, -14, 28, 28);
      ctx.globalAlpha = 0.12 + Math.sin(state.ambientTime * 4) * 0.06;
      ctx.fillStyle = config.color;
      ctx.fillRect(-12, -12, 24, 24);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = config.color;
      ctx.fillStyle = config.color;
      if (powerup.type === "shield") {
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(8, -5);
        ctx.lineTo(7, 3);
        ctx.quadraticCurveTo(5, 9, 0, 11);
        ctx.quadraticCurveTo(-5, 9, -7, 3);
        ctx.lineTo(-8, -5);
        ctx.closePath();
        ctx.fill();
      } else if (powerup.type === "rapid") {
        ctx.beginPath();
        ctx.moveTo(1, -10);
        ctx.lineTo(-7, 1);
        ctx.lineTo(-1, 1);
        ctx.lineTo(-3, 10);
        ctx.lineTo(8, -3);
        ctx.lineTo(1, -3);
        ctx.closePath();
        ctx.fill();
      } else if (powerup.type === "life") {
        ctx.fillRect(-3, -10, 6, 20);
        ctx.fillRect(-10, -3, 20, 6);
      } else if (powerup.type === "bomb") {
        ctx.beginPath();
        ctx.arc(0, 2, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(4, -5);
        ctx.quadraticCurveTo(9, -10, 8, -12);
        ctx.stroke();
        ctx.fillRect(7, -13, 3, 3);
      }
      ctx.restore();
    }
  }

  function drawExplosions() {
    for (const explosion of state.explosions) {
      const progress = explosion.age / explosion.duration;
      const radius = explosion.radius * (0.25 + progress * 0.95);
      const alpha = 1 - progress;

      ctx.save();
      ctx.globalAlpha = alpha * 0.75;
      ctx.strokeStyle = explosion.color;
      ctx.lineWidth = Math.max(1, 4 * (1 - progress));
      ctx.beginPath();
      ctx.arc(explosion.x, explosion.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = alpha * 0.22;
      ctx.fillStyle = explosion.color;
      ctx.beginPath();
      ctx.arc(explosion.x, explosion.y, radius * 0.7, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#ffe8b0";
      const core = Math.max(1, radius * 0.22);
      ctx.fillRect(explosion.x - core / 2, explosion.y - core / 2, core, core);
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const particle of state.particles) {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.fillRect(
        Math.round(particle.x),
        Math.round(particle.y),
        Math.max(1, particle.size),
        Math.max(1, particle.size),
      );
    }
    ctx.globalAlpha = 1;
  }

  function drawTextPops() {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "700 10px Consolas, monospace";
    for (const textPop of state.textPops) {
      const alpha = Math.max(0, textPop.life / textPop.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "rgba(6, 10, 7, 0.7)";
      ctx.fillText(textPop.text, textPop.x + 1, textPop.y + 1);
      ctx.fillStyle = textPop.color;
      ctx.fillText(textPop.text, textPop.x, textPop.y);
    }
    ctx.restore();
  }

  function drawArenaEdges() {
    ctx.strokeStyle = "rgba(233, 237, 216, 0.16)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

    const length = 20;
    ctx.strokeStyle = "rgba(255, 181, 46, 0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(5, 5 + length);
    ctx.lineTo(5, 5);
    ctx.lineTo(5 + length, 5);

    ctx.moveTo(W - 5 - length, 5);
    ctx.lineTo(W - 5, 5);
    ctx.lineTo(W - 5, 5 + length);

    ctx.moveTo(W - 5, H - 5 - length);
    ctx.lineTo(W - 5, H - 5);
    ctx.lineTo(W - 5 - length, H - 5);

    ctx.moveTo(5 + length, H - 5);
    ctx.lineTo(5, H - 5);
    ctx.lineTo(5, H - 5 - length);
    ctx.stroke();
  }

  // ------------------------------------------------------------
  // HUD / overlays
  // ------------------------------------------------------------

  function updateHUD() {
    dom.score.textContent = formatScore(state.score);
    dom.wave.textContent = pad(state.wave);
    dom.enemies.textContent = pad(enemiesLeft());
    dom.lives.textContent = String(Math.max(0, state.lives));
    dom.highScore.textContent = formatScore(Math.max(state.highScore, state.score));
  }

  function updateBuffUI(force = false) {
    const inactive =
      state.phase === "menu" || state.phase === "over" || state.phase === "victory";
    const player = state.player;
    const rapid = !inactive && player?.rapidTimer > 0 ? Math.ceil(player.rapidTimer) : 0;
    const shield = !inactive && player?.shieldTimer > 0 ? Math.ceil(player.shieldTimer) : 0;
    const signature = `${inactive ? "off" : "on"}:${rapid}:${shield}`;
    if (!force && signature === state.buffSignature) return;
    state.buffSignature = signature;

    if (!rapid && !shield) {
      dom.buffList.innerHTML = "";
      dom.buffEmpty.hidden = false;
      dom.buffEmpty.textContent =
        state.phase === "menu"
          ? "AWAITING DEPLOYMENT"
          : inactive
            ? "SYSTEMS OFFLINE"
            : "ALL SYSTEMS NOMINAL";
      return;
    }

    dom.buffEmpty.hidden = true;
    let html = "";
    if (shield) {
      html += `<span class="buff">SHIELD ${pad(shield)}s</span>`;
    }
    if (rapid) {
      html += `<span class="buff buff--amber">RAPID ${pad(rapid)}s</span>`;
    }
    dom.buffList.innerHTML = html;
  }

  function updateControlsUI() {
    const canPause = state.phase === "playing" || state.phase === "paused";
    dom.pauseBtn.disabled = !canPause;
    dom.pauseBtn.textContent = state.phase === "paused" ? "RESUME" : "PAUSE";
  }

  function announce(kicker, text, duration = 1900) {
    window.clearTimeout(announceTimer);
    dom.announceKicker.textContent = kicker;
    dom.announceText.textContent = text;
    dom.announce.classList.add("is-visible");
    announceTimer = window.setTimeout(() => {
      dom.announce.classList.remove("is-visible");
    }, duration);
  }

  function showEndOverlay(victory) {
    dom.overlayKicker.textContent = victory ? "MISSION COMPLETE // ALL SECTORS" : "MISSION FAILED // SIGNAL LOST";
    if (victory) {
      dom.overlayTitle.innerHTML = "防线<br><span>守住了</span>";
      dom.overlayText.textContent = `全部五波敌军已被击退 · 最终得分 ${formatScore(state.score)}`;
      dom.overlayHint.textContent = `击毁 ${state.kills} 辆敌军坦克 · 最高纪录 ${formatScore(state.highScore)}`;
      dom.startBtnText.textContent = "再次出击";
    } else {
      const reason = state.endReason === "base" ? "指挥鹰被摧毁" : "装甲耗尽";
      dom.overlayTitle.innerHTML = "防线<br><span>失守</span>";
      dom.overlayText.textContent = `${reason} · 最终得分 ${formatScore(state.score)}`;
      dom.overlayHint.textContent = `击毁 ${state.kills} 辆敌军坦克 · 最高纪录 ${formatScore(state.highScore)}`;
      dom.startBtnText.textContent = "重新部署";
    }
    dom.overlay.classList.remove("is-hidden");
    dom.overlay.classList.toggle("is-defeat", !victory);
    dom.startBtn.focus({ preventScroll: true });
    dom.pauseStamp.hidden = true;
  }

  // ------------------------------------------------------------
  // Pause
  // ------------------------------------------------------------

  function togglePause() {
    if (state.phase === "playing") {
      state.phase = "paused";
      keyboardFire = false;
      touchFire = false;
      dom.pauseStamp.hidden = false;
      dom.pauseBtn.textContent = "RESUME";
      updateControlsUI();
    } else if (state.phase === "paused") {
      state.phase = "playing";
      dom.pauseStamp.hidden = true;
      dom.pauseBtn.textContent = "PAUSE";
      updateControlsUI();
      canvas.focus({ preventScroll: true });
    }
  }

  function clearInput() {
    heldDirections.length = 0;
    touchPointers.clear();
    keyboardFire = false;
    touchFire = false;
    document.querySelectorAll(".is-pressed").forEach((element) => {
      element.classList.remove("is-pressed");
    });
  }

  // ------------------------------------------------------------
  // Input
  // ------------------------------------------------------------

  function currentDirection() {
    if (touchPointers.size > 0) {
      return [...touchPointers.values()][touchPointers.size - 1];
    }
    if (heldDirections.length > 0) {
      return heldDirections[heldDirections.length - 1];
    }
    return null;
  }

  function handleKeyDown(event) {
    const code = event.code;

    if (MOVE_KEYS.has(code)) {
      event.preventDefault();
      if (state.phase === "playing" || state.phase === "paused") {
        const direction = MOVE_KEYS.get(code);
        if (!heldDirections.includes(direction)) heldDirections.push(direction);
      }
      return;
    }

    if (code === "Space") {
      if (state.phase === "playing" || state.phase === "paused") {
        event.preventDefault();
        keyboardFire = true;
      }
      return;
    }

    if (code === "KeyP" || code === "Escape") {
      if (!event.repeat) {
        event.preventDefault();
        togglePause();
      }
      return;
    }

    if (code === "KeyM") {
      if (!event.repeat) toggleMute();
      return;
    }

    if (code === "KeyR") {
      if (!event.repeat && state.phase !== "menu") {
        event.preventDefault();
        startBattle();
      }
    }
  }

  function handleKeyUp(event) {
    const code = event.code;
    if (MOVE_KEYS.has(code)) {
      const direction = MOVE_KEYS.get(code);
      const index = heldDirections.indexOf(direction);
      if (index >= 0) heldDirections.splice(index, 1);
    }
    if (code === "Space") keyboardFire = false;
  }

  function bindInput() {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    window.addEventListener("blur", clearInput);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        clearInput();
        if (state.phase === "playing") togglePause();
      }
    });

    for (const button of document.querySelectorAll(".dpad-btn")) {
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        ensureAudio();
        button.setPointerCapture?.(event.pointerId);
        touchPointers.set(event.pointerId, Number(button.dataset.dir));
        button.classList.add("is-pressed");
      });

      const release = (event) => {
        touchPointers.delete(event.pointerId);
        button.classList.remove("is-pressed");
      };

      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("lostpointercapture", release);
    }

    const releaseFire = () => {
      touchFire = false;
      dom.fireBtn.classList.remove("is-pressed");
    };

    dom.fireBtn.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      ensureAudio();
      dom.fireBtn.setPointerCapture?.(event.pointerId);
      touchFire = true;
      dom.fireBtn.classList.add("is-pressed");
    });
    dom.fireBtn.addEventListener("pointerup", releaseFire);
    dom.fireBtn.addEventListener("pointercancel", releaseFire);
    dom.fireBtn.addEventListener("lostpointercapture", releaseFire);

    dom.screenWrap.addEventListener("contextmenu", (event) => event.preventDefault());
    document.querySelector(".touch-controls")?.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });
  }

  function bindButtons() {
    dom.startBtn.addEventListener("click", () => {
      startBattle();
    });

    dom.restartBtn.addEventListener("click", () => {
      startBattle();
    });

    dom.pauseBtn.addEventListener("click", () => {
      togglePause();
    });

    dom.muteBtn.addEventListener("click", () => {
      toggleMute();
    });

    window.addEventListener("resize", () => {
      setupCanvas();
      render();
    });
  }

  // ------------------------------------------------------------
  // Frame loop
  // ------------------------------------------------------------

  function frame(timestamp) {
    frameRequest = window.requestAnimationFrame(frame);
    const rawDelta = (timestamp - lastFrame) / 1000;
    lastFrame = timestamp;
    const dt = Math.min(Math.max(rawDelta, 0), 0.045);

    state.ambientTime += state.phase === "paused" ? 0 : dt;

    if (state.phase === "playing") {
      updateGame(dt);
      updateEffects(dt);
    } else if (state.phase === "transition") {
      updateTransition(dt);
      updateEffects(dt);
    } else if (state.phase === "doom") {
      updateDoom(dt);
      updateEffects(dt);
    } else if (state.phase === "over" || state.phase === "victory") {
      updateEffects(dt);
    }

    updateBuffUI();
    render();
  }

  // ------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------

  function boot() {
    MAP_TEMPLATE.forEach((row, index) => {
      if (row.length !== COLS) {
        console.warn(`Map row ${index} must contain ${COLS} tiles.`);
      }
    });

    setupCanvas();
    applyMute();
    resetWorld();
    state.phase = "menu";
    updateControlsUI();
    bindInput();
    bindButtons();
    render();
    lastFrame = performance.now();
    frameRequest = window.requestAnimationFrame(frame);
  }

  boot();

  // Expose a tiny read-only surface for automated smoke tests.
  window.__TANK_BATTLE__ = {
    get phase() {
      return state.phase;
    },
    get score() {
      return state.score;
    },
    get lives() {
      return state.lives;
    },
    get enemies() {
      return liveEnemies().length;
    },
    get pending() {
      return state.pendingSpawns;
    },
    get wave() {
      return state.wave;
    },
    get player() {
      return state.player
        ? { x: state.player.x, y: state.player.y, active: state.player.active }
        : null;
    },
    get baseAlive() {
      return state.baseAlive;
    },
    get snapshot() {
      return {
        phase: state.phase,
        score: state.score,
        wave: state.wave,
        kills: state.kills,
        lives: state.lives,
        baseAlive: state.baseAlive,
        pending: state.pendingSpawns,
        player: state.player
          ? {
              x: state.player.x,
              y: state.player.y,
              dir: state.player.dir,
              active: state.player.active,
              shield: state.player.shieldTimer,
              rapid: state.player.rapidTimer,
            }
          : null,
        enemies: liveEnemies().map((enemy) => ({
          type: enemy.typeKey,
          x: enemy.x,
          y: enemy.y,
          dir: enemy.dir,
          hp: enemy.hp,
          spawnTimer: enemy.spawnTimer,
        })),
        bullets: state.bullets.map((bullet) => ({
          x: bullet.x,
          y: bullet.y,
          fromPlayer: bullet.fromPlayer,
        })),
        powerups: state.powerups.map((powerup) => ({
          x: powerup.x,
          y: powerup.y,
          type: powerup.type,
        })),
      };
    },
    start: startBattle,
    pause: togglePause,
    cancelFrame: () => window.cancelAnimationFrame(frameRequest),
  };
})();
