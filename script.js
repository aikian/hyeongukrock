const STORAGE_KEY = "hyungwook-rps-state-v1";

const choices = {
  scissors: {
    name: "가위",
    icon: "✌",
    beats: "paper",
  },
  rock: {
    name: "바위",
    icon: "✊",
    beats: "scissors",
  },
  paper: {
    name: "보",
    icon: "✋",
    beats: "rock",
  },
};

const startLines = [
  "오늘은 내가 이긴다.",
  "한 판만 해도 실력 나온다.",
  "너 패턴 너무 잘 보인다.",
  "가볍게 이겨줄게.",
];

const thinkingLines = [
  "잠깐만, 심리전 중.",
  "방금 손가락 움직임 봤다.",
  "이건 거의 읽었다.",
  "내 촉이 말하고 있다.",
];

const winLines = [
  "아 이건 운이지.",
  "방금 손 미끄러진 거 봤지?",
  "다음 판부터 진짜다.",
  "한 번 이겼다고 웃지 마라.",
];

const loseLines = [
  "봤냐? 실력 차이.",
  "이게 바로 경험이다.",
  "내가 너무 잘했다.",
  "솔직히 예상했다.",
];

const drawLines = [
  "생각이 비슷하네. 좀 별론데.",
  "따라 하지 마라.",
  "이건 탐색전이었다.",
  "잠깐 같은 편 된 느낌이네.",
];

let audioContext;
let isThinking = false;

const elements = {
  arena: document.querySelector("#arena"),
  meScore: document.querySelector("#meScore"),
  hyungwookScore: document.querySelector("#hyungwookScore"),
  drawScore: document.querySelector("#drawScore"),
  streakLabel: document.querySelector("#streakLabel"),
  roundLabel: document.querySelector("#roundLabel"),
  playerMiniStat: document.querySelector("#playerMiniStat"),
  hyungwookMiniStat: document.querySelector("#hyungwookMiniStat"),
  playerHand: document.querySelector("#playerHand"),
  hyungwookHand: document.querySelector("#hyungwookHand"),
  resultHeadline: document.querySelector("#resultHeadline"),
  resultSubline: document.querySelector("#resultSubline"),
  speechBubble: document.querySelector("#speechBubble"),
  hyungwookAvatar: document.querySelector("#hyungwookAvatar"),
  choiceButtons: document.querySelectorAll("[data-choice]"),
  historyList: document.querySelector("#historyList"),
  winRate: document.querySelector("#winRate"),
  resetButton: document.querySelector("#resetButton"),
  soundButton: document.querySelector("#soundButton"),
};

let state = loadState();

function createDefaultState() {
  return {
    me: 0,
    hyungwook: 0,
    draws: 0,
    round: 0,
    streakOwner: null,
    streakCount: 0,
    sound: true,
    history: [],
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (!saved || !Array.isArray(saved.history)) {
      return createDefaultState();
    }

    return {
      ...createDefaultState(),
      ...saved,
      history: saved.history.slice(0, 8),
    };
  } catch {
    return createDefaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function pick(lines) {
  return lines[Math.floor(Math.random() * lines.length)];
}

function counterTo(choice) {
  if (choice === "scissors") {
    return "rock";
  }

  if (choice === "rock") {
    return "paper";
  }

  return "scissors";
}

function randomChoice() {
  const keys = Object.keys(choices);
  return keys[Math.floor(Math.random() * keys.length)];
}

function getHyungwookChoice() {
  const recentPlayerChoices = state.history.slice(0, 3).map((item) => item.player);
  const repeatedRecentChoice =
    recentPlayerChoices.length >= 2 &&
    recentPlayerChoices[0] === recentPlayerChoices[1];

  if (repeatedRecentChoice && Math.random() < 0.64) {
    return counterTo(recentPlayerChoices[0]);
  }

  if (state.history.length >= 4 && Math.random() < 0.34) {
    const counts = { scissors: 0, rock: 0, paper: 0 };

    state.history.forEach((item) => {
      counts[item.player] += 1;
    });

    const favorite = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    return counterTo(favorite);
  }

  return randomChoice();
}

function judge(player, hyungwook) {
  if (player === hyungwook) {
    return "draw";
  }

  return choices[player].beats === hyungwook ? "win" : "loss";
}

function updateStreak(result) {
  if (result === "draw") {
    return;
  }

  const owner = result === "win" ? "me" : "hyungwook";

  if (state.streakOwner === owner) {
    state.streakCount += 1;
  } else {
    state.streakOwner = owner;
    state.streakCount = 1;
  }
}

function getResultCopy(result, player, hyungwook) {
  const playerChoice = choices[player].name;
  const hyungwookChoice = choices[hyungwook].name;

  if (result === "win") {
    return {
      headline: "내가 이겼다",
      subline: `${playerChoice}로 형욱이의 ${hyungwookChoice}를 잡았다.`,
      speech: state.streakOwner === "me" && state.streakCount >= 3 ? "잠깐만. 이거 렉 걸린 듯." : pick(winLines),
      mood: "is-shook",
    };
  }

  if (result === "loss") {
    return {
      headline: "형욱이가 이겼다",
      subline: `형욱이의 ${hyungwookChoice}가 내 ${playerChoice}를 눌렀다.`,
      speech: state.streakOwner === "hyungwook" && state.streakCount >= 3 ? "이쯤 되면 인정해라." : pick(loseLines),
      mood: "is-proud",
    };
  }

  return {
    headline: "무승부",
    subline: `둘 다 ${playerChoice}. 괜히 서로 읽은 척했다.`,
    speech: pick(drawLines),
    mood: "is-tense",
  };
}

function setControls(enabled) {
  elements.choiceButtons.forEach((button) => {
    button.disabled = !enabled;
  });
}

function playRound(playerChoice) {
  if (isThinking) {
    return;
  }

  isThinking = true;
  setControls(false);

  elements.arena.className = "arena thinking";
  elements.playerHand.textContent = choices[playerChoice].icon;
  elements.hyungwookHand.textContent = "?";
  elements.resultHeadline.textContent = "형욱이 고민 중";
  elements.resultSubline.textContent = "지금 표정은 세상 진지하다.";
  elements.speechBubble.textContent = pick(thinkingLines);
  setAvatarMood("is-tense");

  window.setTimeout(() => {
    const hyungwookChoice = getHyungwookChoice();
    const result = judge(playerChoice, hyungwookChoice);

    state.round += 1;

    if (result === "win") {
      state.me += 1;
    } else if (result === "loss") {
      state.hyungwook += 1;
    } else {
      state.draws += 1;
    }

    updateStreak(result);

    const copy = getResultCopy(result, playerChoice, hyungwookChoice);
    state.history.unshift({
      round: state.round,
      player: playerChoice,
      hyungwook: hyungwookChoice,
      result,
    });
    state.history = state.history.slice(0, 8);

    elements.playerHand.textContent = choices[playerChoice].icon;
    elements.hyungwookHand.textContent = choices[hyungwookChoice].icon;
    elements.resultHeadline.textContent = copy.headline;
    elements.resultSubline.textContent = copy.subline;
    elements.speechBubble.textContent = copy.speech;

    elements.arena.className = `arena ${result === "draw" ? "draw-round" : result}`;
    setAvatarMood(copy.mood);
    playSound(result);
    saveState();
    renderScoreboard();

    isThinking = false;
    setControls(true);
  }, 460);
}

function setAvatarMood(mood) {
  elements.hyungwookAvatar.classList.remove("is-shook", "is-proud", "is-tense");
  elements.hyungwookAvatar.classList.add(mood);
}

function renderScoreboard() {
  const decidedGames = state.me + state.hyungwook;
  const winRate = decidedGames === 0 ? 0 : Math.round((state.me / decidedGames) * 100);

  elements.meScore.textContent = state.me;
  elements.hyungwookScore.textContent = state.hyungwook;
  elements.drawScore.textContent = state.draws;
  elements.roundLabel.textContent = state.round === 0 ? "오늘의 첫 승부" : `${state.round}판째 승부`;
  elements.playerMiniStat.textContent = state.me > state.hyungwook ? "기세 좋음" : state.me === state.hyungwook ? "균형 유지" : "복수 준비";
  elements.hyungwookMiniStat.textContent = state.hyungwook > state.me ? "입꼬리 상승" : state.hyungwook === state.me ? "눈치 보는 중" : "슬슬 당황";
  elements.winRate.textContent = `승률 ${winRate}%`;

  if (!state.streakOwner || state.streakCount < 2) {
    elements.streakLabel.textContent = "팽팽";
  } else if (state.streakOwner === "me") {
    elements.streakLabel.textContent = `${state.streakCount}연승`;
  } else {
    elements.streakLabel.textContent = `형욱 ${state.streakCount}연승`;
  }

  renderHistory();
  renderSoundButton();
}

function renderHistory() {
  elements.historyList.innerHTML = "";

  if (state.history.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-history";
    emptyItem.textContent = "아직 기록 없음";
    elements.historyList.append(emptyItem);
    return;
  }

  state.history.forEach((item) => {
    const historyItem = document.createElement("li");
    const resultText = {
      win: "승리",
      loss: "패배",
      draw: "무승부",
    }[item.result];

    historyItem.innerHTML = `
      <span class="history-round">${item.round}판</span>
      <span class="history-result">${resultText}</span>
      <span class="history-hands">${choices[item.player].icon} : ${choices[item.hyungwook].icon}</span>
    `;

    elements.historyList.append(historyItem);
  });
}

function renderSoundButton() {
  elements.soundButton.querySelector("span").textContent = state.sound ? "🔊" : "🔇";
}

function resetGame() {
  const sound = state.sound;
  state = createDefaultState();
  state.sound = sound;

  elements.arena.className = "arena";
  elements.playerHand.textContent = "?";
  elements.hyungwookHand.textContent = "?";
  elements.resultHeadline.textContent = "첫 판 가자";
  elements.resultSubline.textContent = "형욱이가 이미 표정 관리 중이다.";
  elements.speechBubble.textContent = pick(startLines);
  setAvatarMood("is-proud");
  saveState();
  renderScoreboard();
}

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  return audioContext;
}

function playTone(frequency, startAt, duration, volume = 0.07) {
  const context = getAudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

function playSound(result) {
  if (!state.sound) {
    return;
  }

  const context = getAudioContext();
  const now = context.currentTime;

  if (result === "win") {
    playTone(523.25, now, 0.1);
    playTone(783.99, now + 0.11, 0.13);
  } else if (result === "loss") {
    playTone(220, now, 0.13);
    playTone(164.81, now + 0.12, 0.16);
  } else {
    playTone(392, now, 0.1);
    playTone(392, now + 0.11, 0.1);
  }
}

elements.choiceButtons.forEach((button) => {
  button.addEventListener("click", () => {
    playRound(button.dataset.choice);
  });
});

elements.resetButton.addEventListener("click", resetGame);

elements.soundButton.addEventListener("click", () => {
  state.sound = !state.sound;
  saveState();
  renderSoundButton();
});

document.addEventListener("keydown", (event) => {
  const keyMap = {
    1: "scissors",
    2: "rock",
    3: "paper",
    s: "scissors",
    r: "rock",
    p: "paper",
  };

  const choice = keyMap[event.key.toLowerCase()];

  if (choice) {
    playRound(choice);
  }
});

setAvatarMood("is-proud");
renderScoreboard();
