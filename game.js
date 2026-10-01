(() => {
  'use strict';

  const COLS = 10;
  const ROWS = 8;
  const STAGES = [
    {
      name: 'Khu vực A · Tuyến cơ bản', time: 55, goal: 2, start: [0, 7], pickup: [1, 1], destination: [9, 7],
      obstacles: [[2, 0], [2, 1], [2, 2], [2, 5], [2, 6], [4, 1], [4, 2], [4, 5], [4, 6], [4, 7], [6, 0], [6, 1], [6, 4], [6, 5], [6, 6], [8, 2], [8, 3], [8, 6], [9, 3]],
      hazards: [[1, 4], [5, 3], [7, 1], [7, 6]]
    },
    {
      name: 'Khu vực B · Lối đi hẹp', time: 70, goal: 3, start: [0, 7], pickup: [2, 0], destination: [9, 7],
      obstacles: [[1, 0], [1, 1], [1, 2], [3, 0], [3, 1], [3, 5], [3, 6], [4, 6], [6, 1], [6, 2], [6, 3], [6, 6], [8, 1], [8, 2], [8, 3], [8, 6]],
      hazards: [[2, 4], [5, 2], [7, 5], [9, 2]]
    },
    {
      name: 'Khu vực C · Trung tâm tự động', time: 85, goal: 4, start: [0, 7], pickup: [2, 6], destination: [9, 7],
      obstacles: [[2, 3], [3, 0], [3, 1], [3, 2], [5, 5], [5, 6], [6, 1], [6, 2], [7, 2], [8, 4], [8, 5], [8, 6]],
      hazards: [[2, 1], [4, 4], [7, 5], [9, 1], [6, 7]]
    },
    ...createLaterStages()
  ];

  function createLaterStages() {
    const names = [
      'Khu vực D · Vườn kẹo dẻo',
      'Khu vực E · Kênh caramel',
      'Khu vực F · Rừng thạch',
      'Khu vực G · Kho bánh quy',
      'Khu vực H · Băng chuyền đường',
      'Khu vực I · Đường vòng núi kẹo',
      'Khu vực J · Mê cung lò bánh',
      'Khu vực K · Tháp caramel',
      'Khu vực L · Lõi nhà máy'
    ];
    const forkliftCells = [[0, 3], [1, 3], [2, 3], [3, 3], [4, 3]];
    const reserved = new Set([[0, 7], [1, 1], [9, 7], ...forkliftCells].map(([x, y]) => `${x},${y}`));

    function keepsMapConnected(obstacles, hazards) {
      const blocked = new Set([...obstacles, ...hazards].map(([x, y]) => `${x},${y}`));
      const visited = new Set(['0,7']);
      const queue = [[0, 7]];
      for (let index = 0; index < queue.length; index += 1) {
        const [x, y] = queue[index];
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
          const nextX = x + dx;
          const nextY = y + dy;
          const key = `${nextX},${nextY}`;
          if (nextX < 0 || nextX >= COLS || nextY < 0 || nextY >= ROWS || blocked.has(key) || visited.has(key)) continue;
          visited.add(key);
          queue.push([nextX, nextY]);
        }
      }
      return visited.size === COLS * ROWS - blocked.size;
    }

    return names.map((name, index) => {
      const obstacles = [];
      const hazards = [];
      const candidates = [];
      for (let y = 0; y < ROWS; y += 1) {
        for (let x = 0; x < COLS; x += 1) {
          if (!reserved.has(`${x},${y}`)) candidates.push([x, y]);
        }
      }
      candidates.sort((left, right) => {
        const leftOrder = (left[0] * 17 + left[1] * 31 + index * 19) % 97;
        const rightOrder = (right[0] * 17 + right[1] * 31 + index * 19) % 97;
        return leftOrder - rightOrder;
      });

      const obstacleTarget = 16 + index * 2;
      for (const point of candidates) {
        if (obstacles.length >= obstacleTarget) break;
        obstacles.push(point);
        if (!keepsMapConnected(obstacles, hazards)) obstacles.pop();
      }

      const hazardTarget = 5 + Math.floor(index / 2);
      for (const point of candidates) {
        if (hazards.length >= hazardTarget) break;
        if (obstacles.some(([x, y]) => x === point[0] && y === point[1])) continue;
        hazards.push(point);
        if (!keepsMapConnected(obstacles, hazards)) hazards.pop();
      }

      return {
        name,
        time: 82 - index * 3,
        goal: Math.min(8, 5 + Math.floor(index / 2)),
        start: [0, 7],
        pickup: [1, 1],
        destination: [9, 7],
        obstacles,
        hazards
      };
    });
  }

  const START_SECONDS = STAGES[0].time;
  const MAX_BATTERY = 100;
  const MAX_DELIVERIES = 8;
  const HIGH_SCORE_KEY = 'agv-delivery-high-score';
  const STAGE_PROGRESS_KEY = 'agv-delivery-stage-progress';
  const DIRECTIONS = {
    up: { x: 0, y: -1, icon: '↑' },
    right: { x: 1, y: 0, icon: '→' },
    down: { x: 0, y: 1, icon: '↓' },
    left: { x: -1, y: 0, icon: '←' }
  };
  const COMMANDS = {
    forward: { label: 'Đi thẳng', icon: '↑' },
    left: { label: 'Rẽ trái', icon: '↶' },
    right: { label: 'Rẽ phải', icon: '↷' },
    scan: { label: 'Quét mã', icon: '▦' }
  };

  const FORKLIFT_ROUTE = [[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [3, 3], [2, 3], [1, 3]];
  const SAFE_ORDER_CELLS = [];

  const gridNode = document.getElementById('grid-map');
  const scoreNode = document.getElementById('score');
  const timeNode = document.getElementById('time-left');
  const batteryNode = document.getElementById('battery-label');
  const batteryFill = document.getElementById('battery-fill');
  const deliveriesNode = document.getElementById('deliveries');
  const highScoreNode = document.getElementById('high-score');
  const menuRecordNode = document.getElementById('menu-record');
  const statusNode = document.getElementById('status-message');
  const robotStatusNode = document.getElementById('robot-status');
  const robotTaskNode = document.getElementById('robot-task');
  const missionNode = document.getElementById('mission-text');
  const orderIdNode = document.getElementById('order-id');
  const startOverlay = document.getElementById('start-overlay');
  const endOverlay = document.getElementById('end-overlay');
  const pauseOverlay = document.getElementById('pause-overlay');
  const stageOverlay = document.getElementById('stage-overlay');
  const stageSelectOverlay = document.getElementById('stage-select-overlay');
  const stageListNode = document.getElementById('stage-list');
  const commandQueueNode = document.getElementById('program-queue');
  const commandSelect = document.getElementById('command-select');
  const runButton = document.getElementById('run-program');
  const directModeButton = document.getElementById('direct-mode');
  const programModeButton = document.getElementById('program-mode');
  const directControls = document.getElementById('direct-controls');
  const programControls = document.getElementById('program-controls');
  const cells = [];
  const queue = [];
  const obstacleKeys = new Set();
  const hazardKeys = new Set();
  const directions = Object.keys(DIRECTIONS);

  let state = 'ready';
  let controlMode = 'direct';
  let player = { x: 0, y: 7, direction: 'right' };
  let pickup = { x: 1, y: 1 };
  let destination = { x: 9, y: 7 };
  let hasPackage = false;
  let score = 0;
  let deliveries = 0;
  let battery = MAX_BATTERY;
  let secondsLeft = START_SECONDS;
  let highScore = readHighScore();
  let timerId = null;
  let programRunning = false;
  let programRunId = 0;
  let audioContext;
  let orderNumber = 0;
  let stageIndex = 0;
  let stageDeliveries = 0;
  let starsEarned = 0;
  const stageStars = STAGES.map(() => 0);
  const stageProgress = readStageProgress();
  let playerName = readPlayerName();
  let pausedState = 'running';
  let forkliftIndex = 0;
  let forklift = { x: FORKLIFT_ROUTE[0][0], y: FORKLIFT_ROUTE[0][1] };
  let forkliftSeconds = 0;
  let powerCell = null;
  let powerSpawnSeconds = 0;
  let comboStreak = 0;
  let comboSeconds = 0;

  // Tạo trước mọi ô một lần; các lượt chơi chỉ cập nhật class và biểu tượng.
  function createGrid() {
    const fragment = document.createDocumentFragment();
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', `Ô ${String.fromCharCode(65 + x)}${y + 1}: lối đi`);
        cells.push(cell);
        fragment.append(cell);
      }
    }
    gridNode.append(fragment);
    paintGrid();
  }

  function readHighScore() {
    try { return Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0; }
    catch { return 0; }
  }

  function readPlayerName() {
    try { return (localStorage.getItem('agv-delivery-player-name') || '').trim().slice(0, 18); }
    catch { return ''; }
  }

  function readStageProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(STAGE_PROGRESS_KEY));
      return {
        unlocked: Math.max(0, Math.min(STAGES.length - 1, Number(saved?.unlocked) || 0)),
        played: STAGES.map((_, index) => Boolean(saved?.played?.[index])),
        stars: STAGES.map((_, index) => Math.max(0, Math.min(3, Number(saved?.stars?.[index]) || 0)))
      };
    } catch {
      return { unlocked: 0, played: STAGES.map(() => false), stars: STAGES.map(() => 0) };
    }
  }

  function saveStageProgress() {
    try { localStorage.setItem(STAGE_PROGRESS_KEY, JSON.stringify(stageProgress)); }
    catch { /* Thành tích chỉ được lưu khi trình duyệt cho phép localStorage. */ }
  }

  function renderStageSelect() {
    stageListNode.replaceChildren();
    stageListNode.scrollTop = 0;
    const campaignOrder = [];
    for (let row = 0; row < Math.ceil(STAGES.length / 3); row += 1) {
      const rowStages = Array.from({ length: 3 }, (_, column) => row * 3 + column).filter((index) => index < STAGES.length);
      if (row % 2 === 1) rowStages.reverse();
      campaignOrder.push(...rowStages);
    }
    for (const index of campaignOrder) {
      const map = STAGES[index];
      const card = document.createElement('article');
      const locked = index > stageProgress.unlocked;
      card.className = `stage-card${locked ? ' is-locked' : ''}`;
      card.dataset.stage = String(index + 1);

      const number = document.createElement('span');
      number.className = 'stage-number';
      number.textContent = String(index + 1).padStart(2, '0');

      const info = document.createElement('div');
      info.className = 'stage-card-info';
      const title = document.createElement('strong');
      title.textContent = map.name;
      const details = document.createElement('small');
      details.textContent = `${map.goal} đơn · ${map.time} giây`;
      const status = document.createElement('span');
      status.className = `stage-card-status${!stageProgress.played[index] ? ' is-unplayed' : ''}`;
      status.textContent = locked ? '🔒 Chưa mở khóa' : stageProgress.played[index] ? '✓ Đã chơi' : '● Chưa chơi';
      info.append(title, details, status);

      const right = document.createElement('div');
      right.className = 'stage-card-right';
      const stars = document.createElement('span');
      stars.className = 'stage-card-stars';
      stars.setAttribute('aria-label', `${stageProgress.stars[index]} trên 3 sao`);
      stars.textContent = '★'.repeat(stageProgress.stars[index]) + '☆'.repeat(3 - stageProgress.stars[index]);
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'stage-card-action';
      action.disabled = locked;
      action.textContent = locked ? 'ĐANG KHÓA' : stageProgress.played[index] ? 'CHƠI LẠI' : 'VÀO MÀN';
      action.addEventListener('click', () => {
        if (locked) return;
        playerName = document.getElementById('player-name').value.trim().slice(0, 18) || playerName || 'Người chơi';
        try { localStorage.setItem('agv-delivery-player-name', playerName); }
        catch { /* Không bắt buộc lưu tên. */ }
        beginRunAtStage(index);
      });
      right.append(stars, action);
      card.append(number, info, right);
      stageListNode.append(card);
    }
  }

  function openStageSelect() {
    renderStageSelect();
    startOverlay.classList.add('is-hidden');
    stageSelectOverlay.classList.remove('is-hidden');
  }

  function closeStageSelect() {
    stageSelectOverlay.classList.add('is-hidden');
    startOverlay.classList.remove('is-hidden');
  }

  function beginRunAtStage(index) {
    stageIndex = index;
    score = 0;
    deliveries = 0;
    starsEarned = 0;
    stageStars.fill(0);
    battery = MAX_BATTERY;
    startStage(index);
  }

  function setStageMap(index) {
    const map = STAGES[index];
    obstacleKeys.clear();
    hazardKeys.clear();
    SAFE_ORDER_CELLS.length = 0;
    for (const [x, y] of map.obstacles) obstacleKeys.add(`${x},${y}`);
    for (const [x, y] of map.hazards) hazardKeys.add(`${x},${y}`);
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const key = `${x},${y}`;
        if (!obstacleKeys.has(key) && !hazardKeys.has(key)) SAFE_ORDER_CELLS.push({ x, y });
      }
    }
    document.getElementById('map-stage-label').textContent = `MÀN ${index + 1} · ${map.name.split(' · ')[0].toUpperCase()}`;
    document.getElementById('map-name').textContent = map.name.split(' · ')[1];
    document.getElementById('stage-goal').textContent = String(map.goal);
  }

  function updateHighScore() {
    highScoreNode.textContent = String(highScore);
    menuRecordNode.textContent = String(highScore);
  }

  function playSound(kind) {
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume();
      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const presets = {
        scan: [880, 1320, 'sine', .12],
        power: [660, 1480, 'sine', .24],
        delivery: [540, 1080, 'triangle', .28],
        warning: [240, 95, 'sawtooth', .22],
        start: [420, 720, 'sine', .16],
        end: [330, 120, 'triangle', .32]
      };
      const [from, to, type, duration] = presets[kind];
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(from, now);
      oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(.12, now + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + duration + .01);
    } catch { /* Âm thanh chỉ là bổ sung; game vẫn chơi bình thường nếu bị chặn. */ }
  }

  function setStatus(message, tone = 'normal') {
    statusNode.textContent = message;
    statusNode.dataset.tone = tone;
  }

  function updateHud() {
    scoreNode.textContent = String(score).padStart(4, '0');
    deliveriesNode.textContent = String(stageDeliveries);
    timeNode.innerHTML = `${Math.max(0, Math.ceil(secondsLeft))}<small>s</small>`;
    batteryNode.textContent = `${Math.max(0, Math.round(battery))}%`;
    batteryFill.style.width = `${Math.max(0, battery)}%`;
    batteryFill.style.backgroundColor = battery <= 25 ? '#d9584f' : battery <= 50 ? '#e4a63c' : '#31ab7b';
    robotStatusNode.textContent = state === 'running' ? 'ĐANG DI CHUYỂN' : state === 'program' ? 'ĐANG CHẠY LỆNH' : state === 'paused' ? 'TẠM DỪNG' : state === 'stage-complete' ? 'HOÀN THÀNH MÀN' : state === 'over' ? 'CA ĐÃ KẾT THÚC' : state === 'ready' ? 'CHỜ LỆNH' : 'ĐANG CHỜ';
    robotTaskNode.textContent = hasPackage ? 'Đang vận chuyển kiện hàng' : state === 'running' || state === 'program' ? 'Đang tìm trạm barcode' : 'Sẵn sàng nhận nhiệm vụ';
    missionNode.textContent = hasPackage ? `Giao kiện hàng tới ${coordinate(destination)}` : `Lấy hàng tại ${coordinate(pickup)}`;
    document.getElementById('mission-icon').textContent = hasPackage ? '📦' : '▦';
    const comboNode = document.getElementById('combo-meter');
    comboNode.textContent = `🔥 x${comboStreak}`;
    comboNode.classList.toggle('is-hot', comboStreak >= 3 && comboSeconds > 0);
    orderIdNode.textContent = `ĐƠN: ${String(orderNumber).padStart(3, '0')}`;
    document.getElementById('shift-number').textContent = String(stageIndex + 1).padStart(2, '0');
  }

  function coordinate(point) {
    return `${String.fromCharCode(65 + point.x)}${point.y + 1}`;
  }

  function cellAt(x, y) {
    return cells[y * COLS + x];
  }

  function paintGrid() {
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const cell = cellAt(x, y);
        const key = `${x},${y}`;
        const isPlayer = player.x === x && player.y === y;
        const isObstacle = obstacleKeys.has(key);
        const isHazard = hazardKeys.has(key);
        const isPickup = !hasPackage && pickup.x === x && pickup.y === y;
        const isDestination = hasPackage && destination.x === x && destination.y === y;
        const isForklift = forklift.x === x && forklift.y === y;
        const isPowerCell = powerCell?.x === x && powerCell?.y === y;
        cell.className = 'grid-cell';
        if (isObstacle) cell.classList.add('is-obstacle');
        if (isHazard) cell.classList.add('is-hazard');
        if (isPickup) cell.classList.add('is-pickup');
        if (isDestination) cell.classList.add('is-destination');
        if (isForklift) cell.classList.add('is-forklift');
        if (isPowerCell) cell.classList.add('is-power-cell');
        if (isPlayer) cell.classList.add('is-player');
        // Vẽ đối tượng theo thứ tự ưu tiên để robot luôn nổi bật trên ô hiện tại.
        cell.textContent = isPlayer ? `🤖 ${DIRECTIONS[player.direction].icon}` : isForklift ? '🚜' : isPowerCell ? '🔋' : isObstacle ? '📦' : isHazard ? '🛢️' : isPickup ? '▦' : isDestination ? '🏁' : '';
        const label = isPlayer ? `AGV tại ${coordinate(player)}, hướng ${player.direction}` : isForklift ? 'Xe nâng đang tuần tra' : isPowerCell ? 'Pin dự phòng: tăng 25% năng lượng' : isObstacle ? 'Chướng ngại vật: thùng hàng' : isHazard ? 'Khu vực nguy hiểm' : isPickup ? 'Trạm barcode: lấy hàng' : isDestination ? 'Điểm giao hàng' : `Lối đi ${coordinate({ x, y })}`;
        cell.setAttribute('aria-label', label);
      }
    }
  }

  function startGame() {
    playerName = document.getElementById('player-name').value.trim().slice(0, 18) || 'Người chơi';
    try { localStorage.setItem('agv-delivery-player-name', playerName); }
    catch { /* Không cần lưu tên để tiếp tục chơi. */ }
    beginRunAtStage(0);
  }

  function startStage(index) {
    clearInterval(timerId);
    programRunId += 1;
    stageIndex = index;
    const map = STAGES[stageIndex];
    stageProgress.played[stageIndex] = true;
    saveStageProgress();
    setStageMap(stageIndex);
    player = { x: map.start[0], y: map.start[1], direction: 'right' };
    pickup = { x: map.pickup[0], y: map.pickup[1] };
    destination = { x: map.destination[0], y: map.destination[1] };
    hasPackage = false;
    stageDeliveries = 0;
    battery = index === 0 ? MAX_BATTERY : Math.min(MAX_BATTERY, battery + 15);
    secondsLeft = map.time;
    orderNumber = 1;
    forkliftIndex = 0;
    forklift = { x: FORKLIFT_ROUTE[0][0], y: FORKLIFT_ROUTE[0][1] };
    forkliftSeconds = 0;
    powerCell = null;
    powerSpawnSeconds = 0;
    comboStreak = 0;
    comboSeconds = 0;
    state = 'running';
    programRunning = false;
    queue.length = 0;
    renderQueue();
    startOverlay.classList.add('is-hidden');
    stageSelectOverlay.classList.add('is-hidden');
    endOverlay.classList.add('is-hidden');
    pauseOverlay.classList.add('is-hidden');
    stageOverlay.classList.add('is-hidden');
    setStatus(`Màn ${stageIndex + 1}: giao đủ ${map.goal} đơn trước khi hết ${map.time} giây.`);
    updateHud();
    paintGrid();
    playSound('start');
    timerId = setInterval(() => {
      if (state !== 'running' && state !== 'program') return;
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        secondsLeft = 0;
        updateHud();
        finishGame(false, 'Hết thời gian vận hành.');
      } else {
        tickSpecialEvents();
        updateHud();
      }
    }, 1000);
  }

  function pauseGame() {
    if (state !== 'running' && state !== 'program') return;
    pausedState = state;
    state = 'paused';
    pauseOverlay.classList.remove('is-hidden');
    updateHud();
  }

  function resumeGame() {
    if (state !== 'paused') return;
    state = pausedState;
    pauseOverlay.classList.add('is-hidden');
    updateHud();
  }

  function returnToMenu() {
    clearInterval(timerId);
    state = 'ready';
    programRunning = false;
    pauseOverlay.classList.add('is-hidden');
    stageSelectOverlay.classList.add('is-hidden');
    stageOverlay.classList.add('is-hidden');
    endOverlay.classList.add('is-hidden');
    startOverlay.classList.remove('is-hidden');
    updateHud();
  }

  function completeStage() {
    clearInterval(timerId);
    state = 'stage-complete';
    programRunning = false;
    const map = STAGES[stageIndex];
    const earned = stageDeliveries >= map.goal
      ? battery >= 85 && secondsLeft >= 20 ? 3 : battery >= 70 ? 2 : 1
      : 0;
    starsEarned += earned - stageStars[stageIndex];
    stageStars[stageIndex] = earned;
    stageProgress.played[stageIndex] = true;
    stageProgress.stars[stageIndex] = Math.max(stageProgress.stars[stageIndex], earned);
    stageProgress.unlocked = Math.max(stageProgress.unlocked, Math.min(stageIndex + 1, STAGES.length - 1));
    saveStageProgress();
    document.getElementById('stage-icon').textContent = earned === 3 ? '🏆' : earned > 0 ? '🌟' : '📋';
    document.getElementById('stage-title').textContent = earned > 0 ? `MÀN ${stageIndex + 1} HOÀN THÀNH` : `MÀN ${stageIndex + 1} CHƯA ĐẠT`;
    document.getElementById('stage-stars').textContent = '★'.repeat(earned) + '☆'.repeat(3 - earned);
    document.getElementById('stage-result-copy').textContent = `${playerName} · ${stageDeliveries}/${map.goal} đơn · Pin ${Math.round(battery)}% · Còn ${Math.ceil(secondsLeft)} giây`;
    document.getElementById('next-stage-button').textContent = stageIndex === STAGES.length - 1 ? 'XEM TỔNG KẾT →' : 'TIẾP TỤC SANG MÀN SAU →';
    stageOverlay.classList.remove('is-hidden');
    if (score > highScore) {
      highScore = score;
      try { localStorage.setItem(HIGH_SCORE_KEY, String(highScore)); }
      catch { /* Lưu kỷ lục là tùy chọn. */ }
      updateHighScore();
    }
    updateHud();
    playSound('delivery');
  }

  function advanceStage() {
    stageOverlay.classList.add('is-hidden');
    stageSelectOverlay.classList.add('is-hidden');
    if (stageIndex + 1 >= STAGES.length) {
      finishGame(true, 'Đã hoàn thành toàn bộ bản đồ trong ca!');
      return;
    }
    startStage(stageIndex + 1);
  }

  function finishGame(victory, reason) {
    clearInterval(timerId);
    state = 'over';
    programRunning = false;
    runButton.disabled = false;
    const isNewRecord = score > highScore;
    if (isNewRecord) {
      highScore = score;
      try { localStorage.setItem(HIGH_SCORE_KEY, String(highScore)); }
      catch { /* Lưu kỷ lục là tùy chọn. */ }
      updateHighScore();
    }
    document.getElementById('end-icon').textContent = victory ? '🏆' : '📦';
    document.getElementById('end-kicker').textContent = victory ? 'HOÀN TẤT NHIỆM VỤ' : 'BÁO CÁO CA';
    document.getElementById('end-title').textContent = victory ? 'KHO HÀNG ĐÃ THÔNG SUỐT!' : 'CA VẬN HÀNH KẾT THÚC';
    document.getElementById('final-score').textContent = String(score);
    document.getElementById('final-deliveries').textContent = String(deliveries);
    document.getElementById('final-battery').textContent = `${Math.round(battery)}%`;
    document.getElementById('final-player').textContent = playerName || 'Người chơi';
    document.getElementById('final-stars').textContent = `${starsEarned} / ${STAGES.length * 3} ⭐`;
    document.getElementById('new-record').classList.toggle('is-hidden', !isNewRecord);
    setStatus(reason, victory ? 'good' : 'warning');
    endOverlay.classList.remove('is-hidden');
    playSound('end');
  }

  // Tính ô kế tiếp bằng vector hướng; không cho robot vượt biên hoặc xuyên vật cản.
  function moveForward() {
    if (state !== 'running' && state !== 'program') return false;
    if (battery <= 0) {
      finishGame(false, 'Pin đã cạn. Ca vận hành phải dừng.');
      return false;
    }
    const vector = DIRECTIONS[player.direction];
    const nextX = player.x + vector.x;
    const nextY = player.y + vector.y;
    if (nextX < 0 || nextX >= COLS || nextY < 0 || nextY >= ROWS) {
      score = Math.max(0, score - 2);
      battery = Math.max(0, battery - 5);
      setStatus('Biên kho đã chặn AGV. Trừ 5% pin và 2 điểm.', 'warning');
      playSound('warning');
      updateHud();
      return false;
    }
    const key = `${nextX},${nextY}`;
    if (nextX === forklift.x && nextY === forklift.y) {
      hitForklift();
      return false;
    }
    if (obstacleKeys.has(key) || hazardKeys.has(key)) {
      score = Math.max(0, score - 5);
      battery = Math.max(0, battery - 8);
      setStatus(obstacleKeys.has(key) ? 'Va vào thùng hàng! Trừ 8% pin và 5 điểm.' : 'Cảnh báo khu vực nguy hiểm! Trừ 8% pin và 5 điểm.', 'warning');
      playSound('warning');
      updateHud();
      if (battery <= 0) finishGame(false, 'Pin đã cạn sau va chạm.');
      return false;
    }
    player.x = nextX;
    player.y = nextY;
    battery = Math.max(0, battery - 1);
    collectPowerCell();
    onEnterCell();
    paintGrid();
    updateHud();
    if (battery <= 0 && state !== 'over') finishGame(false, 'Pin đã cạn. Ca vận hành phải dừng.');
    return true;
  }

  function hitForklift() {
    battery = Math.max(0, battery - 15);
    score = Math.max(0, score - 10);
    comboStreak = 0;
    comboSeconds = 0;
    setStatus('Suýt va vào xe nâng! Mất 15% pin, 10 điểm và đứt combo.', 'warning');
    playSound('warning');
    updateHud();
    if (battery <= 0) finishGame(false, 'Pin đã cạn sau va chạm với xe nâng.');
  }

  // Xe nâng tuần tra theo tuyến định sẵn, né trạm hàng và AGV để đường đi luôn công bằng.
  function moveForklift() {
    forkliftIndex = (forkliftIndex + 1) % FORKLIFT_ROUTE.length;
    const [nextX, nextY] = FORKLIFT_ROUTE[forkliftIndex];
    const reserved = (nextX === pickup.x && nextY === pickup.y)
      || (hasPackage && nextX === destination.x && nextY === destination.y)
      || (powerCell && nextX === powerCell.x && nextY === powerCell.y);
    if (reserved) return;
    if (nextX === player.x && nextY === player.y) {
      hitForklift();
      return;
    }
    forklift = { x: nextX, y: nextY };
    paintGrid();
  }

  function spawnPowerCell() {
    const available = getReachableOrderCells(player).filter((point) =>
      !(point.x === player.x && point.y === player.y)
      && !(point.x === pickup.x && point.y === pickup.y)
      && !(point.x === destination.x && point.y === destination.y)
      && !(point.x === forklift.x && point.y === forklift.y)
    );
    if (available.length === 0) return;
    const point = available[Math.floor(Math.random() * available.length)];
    powerCell = { ...point, seconds: 10 };
    setStatus(`Pin dự phòng xuất hiện tại ${coordinate(powerCell)}. Nhặt trong 10 giây để sạc +25%.`, 'good');
    paintGrid();
  }

  function collectPowerCell() {
    if (!powerCell || player.x !== powerCell.x || player.y !== powerCell.y) return;
    powerCell = null;
    battery = Math.min(MAX_BATTERY, battery + 25);
    score += 20;
    setStatus('Đã nhặt pin dự phòng: +25% năng lượng và +20 điểm!', 'good');
    playSound('power');
    paintGrid();
  }

  function tickSpecialEvents() {
    if (comboSeconds > 0) {
      comboSeconds -= 1;
      if (comboSeconds <= 0) {
        comboSeconds = 0;
        comboStreak = 0;
      }
    }

    forkliftSeconds += 1;
    if (forkliftSeconds >= 4) {
      forkliftSeconds = 0;
      moveForklift();
    }

    if (powerCell) {
      powerCell.seconds -= 1;
      if (powerCell.seconds <= 0) {
        powerCell = null;
        setStatus('Pin dự phòng đã biến mất. Chờ lần tiếp theo.');
        paintGrid();
      }
    } else {
      powerSpawnSeconds += 1;
      if (powerSpawnSeconds >= 12) {
        powerSpawnSeconds = 0;
        spawnPowerCell();
      }
    }
  }

  // Hướng rẽ thay đổi theo thứ tự Bắc → Đông → Nam → Tây trên bản đồ dạng lưới.
  function turn(direction) {
    const current = directions.indexOf(player.direction);
    const change = direction === 'left' ? -1 : 1;
    player.direction = directions[(current + change + directions.length) % directions.length];
    battery = Math.max(0, battery - 1);
    paintGrid();
    updateHud();
    setStatus(`Robot đã quay ${direction === 'left' ? 'trái' : 'phải'}, hướng ${player.direction}.`);
  }

  function onEnterCell() {
    if (!hasPackage && player.x === pickup.x && player.y === pickup.y) {
      scanAtCell();
      return;
    }
    if (hasPackage && player.x === destination.x && player.y === destination.y) deliverOrder();
  }

  function scanAtCell() {
    if (!hasPackage && player.x === pickup.x && player.y === pickup.y) {
      hasPackage = true;
      battery = Math.min(MAX_BATTERY, battery + 5);
      setStatus('Đã quét barcode/RFID. Kiện hàng được nạp lên AGV.', 'good');
      playSound('scan');
      updateHud();
      paintGrid();
      return true;
    }
    if (hasPackage && player.x === destination.x && player.y === destination.y) {
      deliverOrder();
      return true;
    }
    battery = Math.max(0, battery - 2);
    setStatus('Không tìm thấy barcode/RFID tại ô này. Trừ 2% pin.', 'warning');
    playSound('warning');
    updateHud();
    return false;
  }

  function deliverOrder() {
    if (!hasPackage || state === 'over') return;
    hasPackage = false;
    deliveries += 1;
    stageDeliveries += 1;
    comboStreak = comboSeconds > 0 ? comboStreak + 1 : 1;
    comboSeconds = 25;
    const timeBonus = Math.max(0, Math.floor(secondsLeft / 3));
    const comboBonus = Math.min(Math.max(0, comboStreak - 1) * 25, 150);
    const orderPoints = 100 + timeBonus + comboBonus;
    score += orderPoints;
    secondsLeft = Math.min(START_SECONDS, secondsLeft + 12);
    battery = Math.min(MAX_BATTERY, battery + 12);
    if (score > highScore) {
      highScore = score;
      try { localStorage.setItem(HIGH_SCORE_KEY, String(highScore)); }
      catch { /* Lưu kỷ lục là tùy chọn. */ }
      updateHighScore();
    }
    playSound('delivery');
    setStatus(`Giao hàng thành công! +${orderPoints} điểm, +12 giây và +12% pin${comboStreak > 1 ? ` · COMBO x${comboStreak}` : ''}.`, 'good');
    cellAt(destination.x, destination.y).classList.add('is-delivery-flash');
    if (stageDeliveries >= STAGES[stageIndex].goal) {
      updateHud();
      paintGrid();
      completeStage();
      return;
    }
    assignNextOrder();
    updateHud();
    paintGrid();
  }

  function assignNextOrder() {
    orderNumber += 1;
    const available = getReachableOrderCells(player).filter((point) =>
      !(point.x === player.x && point.y === player.y)
      && !(point.x === forklift.x && point.y === forklift.y)
      && !(powerCell && point.x === powerCell.x && point.y === powerCell.y)
    );
    pickup = available[Math.floor(Math.random() * available.length)];
    const destinations = getReachableOrderCells(pickup).filter((point) =>
      !(point.x === pickup.x && point.y === pickup.y)
      && !(point.x === player.x && point.y === player.y)
      && !(point.x === forklift.x && point.y === forklift.y)
      && !(powerCell && point.x === powerCell.x && point.y === powerCell.y)
    );
    destination = destinations[Math.floor(Math.random() * destinations.length)];
  }

  // Duyệt vùng lối đi bằng BFS để mọi trạm lấy/giao đều có đường đi hợp lệ.
  function getReachableOrderCells(origin) {
    const visited = new Set([`${origin.x},${origin.y}`]);
    const frontier = [{ x: origin.x, y: origin.y }];
    const vectors = Object.values(DIRECTIONS);
    for (let index = 0; index < frontier.length; index += 1) {
      const current = frontier[index];
      for (const vector of vectors) {
        const x = current.x + vector.x;
        const y = current.y + vector.y;
        if (x < 0 || x >= COLS || y < 0 || y >= ROWS) continue;
        const key = `${x},${y}`;
        if (visited.has(key) || obstacleKeys.has(key) || hazardKeys.has(key)) continue;
        visited.add(key);
        frontier.push({ x, y });
      }
    }
    return SAFE_ORDER_CELLS.filter((point) => visited.has(`${point.x},${point.y}`));
  }

  function directAction(direction) {
    if (controlMode !== 'direct' || state !== 'running') return;
    player.direction = direction;
    moveForward();
  }

  function renderQueue() {
    commandQueueNode.replaceChildren();
    if (queue.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'queue-empty';
      empty.textContent = 'Chưa có lệnh. Thêm lệnh để lập trình.';
      commandQueueNode.append(empty);
      runButton.disabled = true;
      return;
    }
    queue.forEach((command, index) => {
      const chip = document.createElement('span');
      chip.className = 'command-chip';
      chip.textContent = `${index + 1}. ${COMMANDS[command].icon} ${COMMANDS[command].label}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Xóa lệnh ${index + 1}`);
      remove.addEventListener('click', () => { queue.splice(index, 1); renderQueue(); });
      chip.append(remove);
      commandQueueNode.append(chip);
    });
    runButton.disabled = programRunning || state !== 'running';
  }

  function wait(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  async function executeProgram() {
    if (programRunning || state !== 'running' || queue.length === 0) return;
    programRunning = true;
    const runId = ++programRunId;
    state = 'program';
    runButton.disabled = true;
    const commands = [...queue];
    for (const command of commands) {
      while (state === 'paused' && runId === programRunId) await wait(100);
      if (runId !== programRunId) return;
      if (state === 'over') break;
      if (state === 'stage-complete' || state === 'ready') break;
      if (command === 'forward') moveForward();
      else if (command === 'left' || command === 'right') turn(command);
      else scanAtCell();
      await wait(360);
    }
    if (state === 'program') state = 'running';
    programRunning = false;
    renderQueue();
    updateHud();
  }

  function setControlMode(mode) {
    controlMode = mode;
    directModeButton.classList.toggle('is-active', mode === 'direct');
    programModeButton.classList.toggle('is-active', mode === 'program');
    directModeButton.setAttribute('aria-pressed', String(mode === 'direct'));
    programModeButton.setAttribute('aria-pressed', String(mode === 'program'));
    directControls.classList.toggle('is-hidden', mode !== 'direct');
    programControls.classList.toggle('is-hidden', mode !== 'program');
    setStatus(mode === 'direct' ? 'Điều khiển trực tiếp: dùng phím mũi tên hoặc nút hướng.' : 'Lập trình chuỗi lệnh rồi nhấn Chạy chương trình.');
  }

  document.getElementById('start-button').addEventListener('click', startGame);
  document.getElementById('open-stage-select').addEventListener('click', openStageSelect);
  document.getElementById('close-stage-select').addEventListener('click', closeStageSelect);
  document.getElementById('restart-button').addEventListener('click', startGame);
  document.getElementById('menu-button').addEventListener('click', pauseGame);
  document.getElementById('continue-button').addEventListener('click', resumeGame);
  document.getElementById('reset-button').addEventListener('click', startGame);
  document.getElementById('menu-return-button').addEventListener('click', returnToMenu);
  document.getElementById('next-stage-button').addEventListener('click', advanceStage);
  document.getElementById('stage-replay-button').addEventListener('click', () => startStage(stageIndex));
  document.getElementById('stage-menu-button').addEventListener('click', returnToMenu);
  document.getElementById('player-name').value = playerName;
  document.getElementById('player-name').addEventListener('input', (event) => {
    playerName = event.currentTarget.value.slice(0, 18);
    try { localStorage.setItem('agv-delivery-player-name', playerName); }
    catch { /* Tên chỉ là tiện ích, không bắt buộc lưu. */ }
  });
  directModeButton.addEventListener('click', () => setControlMode('direct'));
  programModeButton.addEventListener('click', () => setControlMode('program'));
  document.querySelectorAll('.dpad-button[data-direction]').forEach((button) => {
    button.addEventListener('click', () => directAction(button.dataset.direction));
  });
  document.getElementById('add-command').addEventListener('click', () => {
    if (queue.length >= 24) { setStatus('Chương trình tối đa 24 lệnh.', 'warning'); return; }
    queue.push(commandSelect.value);
    renderQueue();
  });
  document.getElementById('clear-program').addEventListener('click', () => { queue.length = 0; renderQueue(); });
  runButton.addEventListener('click', executeProgram);

  window.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLButtonElement) return;
    if (state !== 'running' || controlMode !== 'direct') return;
    const key = event.key.toLowerCase();
    const bindings = { arrowup: 'up', w: 'up', arrowright: 'right', d: 'right', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left' };
    const direction = bindings[key];
    if (!direction) return;
    event.preventDefault();
    directAction(direction);
  });

  setStageMap(0);
  createGrid();
  updateHighScore();
  updateHud();
  renderQueue();
})();
