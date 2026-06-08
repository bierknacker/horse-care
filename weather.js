// ═══════════════════════════════════════════════════════════════
//  HORSE CARE – Wettersystem
//  Tägliches Zufallswetter mit Spieleffekten
// ═══════════════════════════════════════════════════════════════

const WEATHER_TYPES = {
  sunny: {
    id: 'sunny',
    label: 'Sonnig',
    emoji: '☀️',
    desc: 'Ein wunderschöner Tag! Dein Pferd ist bester Stimmung.',
    // Statuseffekte pro Stunde (zusätzlich zum normalen Decay)
    effects: {
      happiness: +0.05,   // Sonne hebt die Stimmung
      hygiene:    0,
      thirst:    -0.03,   // Leicht mehr Durst bei Wärme
    },
    // Münz-Multiplikator
    coinMultiplier: 1.1,
    // Aktionen die gesperrt sind
    blockedActions: [],
    // Krankheitsrisiko (für später)
    diseaseRisk: 0,
    // Partikel-Klasse für Animation
    particle: 'sun-ray',
    bgOverlay: 'rgba(255,200,50,0.08)',
  },
  cloudy: {
    id: 'cloudy',
    label: 'Bewölkt',
    emoji: '☁️',
    desc: 'Bedeckter Himmel – ruhiges Wetter für die Stallarbeit.',
    effects: {
      happiness: -0.01,
      hygiene:    0,
      thirst:     0,
    },
    coinMultiplier: 1.0,
    blockedActions: [],
    diseaseRisk: 0,
    particle: 'cloud-puff',
    bgOverlay: 'rgba(150,150,180,0.12)',
  },
  rain: {
    id: 'rain',
    label: 'Regen',
    emoji: '🌧️',
    desc: 'Es regnet! Dein Pferd wird draußen nass und dreckig.',
    effects: {
      happiness: -0.04,
      hygiene:   -0.06,  // Pferd wird dreckiger
      thirst:    +0.02,  // Trinkt etwas mehr
    },
    coinMultiplier: 0.9,
    blockedActions: ['ausritt'],
    diseaseRisk: 0.05,   // 5% Risiko später
    particle: 'raindrop',
    bgOverlay: 'rgba(80,120,180,0.18)',
  },
  storm: {
    id: 'storm',
    label: 'Gewitter',
    emoji: '⛈️',
    desc: 'Gefährliches Gewitter! Kein Ausritt möglich, Pferd ist unruhig.',
    effects: {
      happiness: -0.10,  // Pferd ist verängstigt
      hygiene:   -0.08,
      thirst:     0,
    },
    coinMultiplier: 0.7,
    blockedActions: ['ausritt', 'training'],
    diseaseRisk: 0.10,
    particle: 'lightning',
    bgOverlay: 'rgba(40,40,80,0.30)',
  },
  snow: {
    id: 'snow',
    label: 'Schnee',
    emoji: '❄️',
    desc: 'Winterzauber! Aber achte darauf, dass dein Pferd warm bleibt.',
    effects: {
      happiness: +0.02,  // Pferde mögen Schnee oft
      hygiene:    0,
      thirst:    -0.02,
      energy:    -0.03,  // Kälte kostet Energie
    },
    coinMultiplier: 0.9,
    blockedActions: ['ausritt'],
    diseaseRisk: 0.08,
    particle: 'snowflake',
    bgOverlay: 'rgba(200,230,255,0.20)',
  },
  fog: {
    id: 'fog',
    label: 'Nebel',
    emoji: '🌫️',
    desc: 'Dichter Nebel liegt über dem Stall. Mystisch aber ungemütlich.',
    effects: {
      happiness: -0.02,
      hygiene:    0,
      thirst:     0,
    },
    coinMultiplier: 0.95,
    blockedActions: ['ausritt'],
    diseaseRisk: 0.03,
    particle: 'fog-wisp',
    bgOverlay: 'rgba(180,180,180,0.22)',
  },
};

// Wahrscheinlichkeiten (müssen zusammen 100 ergeben)
const WEATHER_WEIGHTS = {
  sunny:  30,
  cloudy: 25,
  rain:   20,
  storm:  10,
  snow:   8,
  fog:    7,
};

const WeatherSystem = {

  // ── Wetter laden oder neu würfeln ──────────────────────────
  load(gameData) {
    const today = new Date().toISOString().slice(0, 10);

    // Neues Tageswetter würfeln wenn nötig
    if (!gameData.weather || gameData.weather.date !== today) {
      const newWeather = this.roll();
      gameData.weather = {
        id:   newWeather,
        date: today,
      };
    }
    return gameData;
  },

  // ── Zufälliges Wetter würfeln ──────────────────────────────
  roll() {
    const total = Object.values(WEATHER_WEIGHTS).reduce((a, b) => a + b, 0);
    let rand = Math.random() * total;
    for (const [id, weight] of Object.entries(WEATHER_WEIGHTS)) {
      rand -= weight;
      if (rand <= 0) return id;
    }
    return 'sunny';
  },

  // ── Aktuelles Wetter-Objekt holen ─────────────────────────
  get(gameData) {
    const id = gameData.weather?.id || 'sunny';
    return WEATHER_TYPES[id] || WEATHER_TYPES.sunny;
  },

  // ── Wettereffekte auf Decay anwenden (pro Minute) ─────────
  applyWeatherDecay(gameData) {
    const w = this.get(gameData);
    for (const [stat, delta] of Object.entries(w.effects || {})) {
      if (delta !== 0 && gameData.stats[stat] !== undefined) {
        gameData.stats[stat] = Math.max(0, Math.min(100,
          gameData.stats[stat] + delta
        ));
      }
    }
    return gameData;
  },

  // ── Aktion gesperrt? ──────────────────────────────────────
  isBlocked(gameData, action) {
    const w = this.get(gameData);
    return (w.blockedActions || []).includes(action);
  },

  // ── Münz-Multiplikator ────────────────────────────────────
  getCoinMultiplier(gameData) {
    return this.get(gameData).coinMultiplier || 1.0;
  },
};