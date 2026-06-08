// ═══════════════════════════════════════════════
//  HORSE CARE – Zentrales Speichersystem
//  Speichert beim Verlassen der Seite (pagehide/beforeunload)
// ═══════════════════════════════════════════════

const SAVE_KEY = 'horsecare_save';

const CARE_MAX_DURABILITY = {
  buerste_einfach:  10,   // 10 Nutzungen
  buerste_gut:      25,   // 25 Nutzungen
  buerste_profi:    60,   // 60 Nutzungen
  hufkratzer_einf:  15,
  hufkratzer_profi: 40,
  schwamm:          20,
};

const GameData = {

  // ── Standardwerte (neues Spiel) ──────────────
  defaults() {
    return {
      version: 1,
      // Pferd
      race:      null,   // { id, name, img, accent }
      horseName: null,
      // Status (0–100)
      stats: {
        happiness: 80,
        hygiene:   80,
        hunger:    70,
        thirst:    70,
        energy:    90,
      },
      // Fortschritt
      xp:    0,
      level: 1,
      xpToNextLevel: 100,
      // Zeit
      startDate:   null,   // ISO-String, gesetzt beim ersten Start
      lastSaved:   null,   // ISO-String
      gameDay:     1,
      lastGameDay: null,   // YYYY-MM-DD des letzten echten Tages
      // Stallaufgaben (reset täglich)
      stallTasks: {
        misten:     false,
        einstreuen: false,
        putzen:     false,
        wasser:     false,
      },
      lastTaskReset: null, // YYYY-MM-DD
      // Tierarzt
      criticalSince:  null, // YYYY-MM-DD
      lastVetVisit:   null, // ISO-String
      // Wetter
      weather: null, // { id, date }
      // Münzsystem
      coins:           100,  // Startmünzen
      lastCoinAccrual: null, // ISO-String, letzter Münz-Zuwachs
      // Inventar (Gegenstände im Besitz)
      inventory: {
        // Futter (Stückzahl)
        heu:           0,
        kraftfutter:   0,
        mash:          0,
        eimer:         0,
        kraeutertee:   0,
        apfel:         0,
        karotte:       0,
        zuckerwuerfel: 0,
        // Pflegeartikel mit Haltbarkeit { qty, durability }
        // durability = verbleibende Nutzungen
        buerste_einfach:  { qty: 0, durability: 0 },
        buerste_gut:      { qty: 0, durability: 0 },
        buerste_profi:    { qty: 0, durability: 0 },
        hufkratzer_einf:  { qty: 0, durability: 0 },
        hufkratzer_profi: { qty: 0, durability: 0 },
        schwamm:          { qty: 0, durability: 0 },
      },
    };
  },

  // ── Laden ────────────────────────────────────
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return this.defaults();
      const data = JSON.parse(raw);

      // Täglichen Reset prüfen
      const today = new Date().toISOString().slice(0, 10);
      if (data.lastTaskReset !== today) {
        data.stallTasks = { misten: false, einstreuen: false, putzen: false, wasser: false };
        data.lastTaskReset = today;
        // Neuer Spieltag
        if (data.lastGameDay && data.lastGameDay !== today) {
          data.gameDay = (data.gameDay || 1) + 1;
        }
        data.lastGameDay = today;
      }
      return data;
    } catch (e) {
      console.warn('Laden fehlgeschlagen:', e);
      return this.defaults();
    }
  },

  // ── Speichern ────────────────────────────────
  save(data) {
    try {
      data.lastSaved = new Date().toISOString();
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('Speichern fehlgeschlagen:', e);
      return false;
    }
  },

  // ── Zurücksetzen ─────────────────────────────
  reset() {
    localStorage.removeItem(SAVE_KEY);
  },

  // ── XP hinzufügen & Level prüfen ─────────────
  addXP(data, amount) {
    data.xp += amount;
    while (data.xp >= data.xpToNextLevel) {
      data.xp -= data.xpToNextLevel;
      data.level += 1;
      data.xpToNextLevel = Math.floor(data.xpToNextLevel * 1.4);
    }
    return data;
  },

  // ── Stat-Wert setzen (0–100) ──────────────────
  setStat(data, key, value) {
    data.stats[key] = Math.max(0, Math.min(100, value));
    return data;
  },

  // ── Pflegeartikel benutzen ──────────────────
  useCareItem(data, itemId) {
    const item = data.inventory[itemId];
    if (!item || item.durability <= 0) return { data, ok: false };
    item.durability -= 1;
    if (item.durability <= 0) {
      item.qty = Math.max(0, item.qty - 1);
      // Nächstes Exemplar laden falls vorhanden
      if (item.qty > 0) {
        const maxDur = CARE_MAX_DURABILITY[itemId] || 10;
        item.durability = maxDur;
      }
    }
    return { data, ok: true };
  },

  // ── Stallaufgabe abhaken + XP vergeben ───────
  completeStallTask(data, taskId) {
    const rewards = { misten: 15, einstreuen: 10, putzen: 10, wasser: 5 };
    if (!data.stallTasks[taskId]) {
      data.stallTasks[taskId] = true;
      if (rewards[taskId]) data = this.addXP(data, rewards[taskId]);
      // Stall-Sauberkeit steigt
      if (taskId === 'misten' || taskId === 'putzen') {
        data = this.setStat(data, 'hygiene', data.stats.hygiene + 15);
      }
      if (taskId === 'wasser') {
        data = this.setStat(data, 'thirst', data.stats.thirst + 20);
      }
    }
    return data;
  },

  // ── Stat-Verfall: läuft jede Minute im Hub ───
  // Ziel: nach 24h Echtzeit ohne Pflege sind alle Werte bei 0
  // 100 / 1440 Minuten = 0.0694 pro Minute
  applyDecay(data) {
    const now = new Date();
    const h = now.getHours();
    const isNight = h >= 21 || h < 6;

    // Hunger:    leer nach 24h → 0.0694/min
    // Durst:     etwas schneller, leer nach 20h → 0.0833/min
    // Energie:   nachts regeneriert (+0.10/min), tagsüber leicht sinkend
    // Sauberkeit: leer nach 48h → 0.0347/min
    // Glück:     leer nach 36h → 0.0463/min
    data = this.setStat(data, 'hunger',    data.stats.hunger    - (isNight ? 0.035 : 0.0694));
    data = this.setStat(data, 'thirst',    data.stats.thirst    - (isNight ? 0.042 : 0.0833));
    data = this.setStat(data, 'energy',    data.stats.energy    + (isNight ? 0.10  : -0.035));
    data = this.setStat(data, 'hygiene',   data.stats.hygiene   - 0.0347);
    // Zufriedenheit: dreckiges Pferd verliert bis zu 3x schneller
    // hygiene 100 → normaler Verlust; hygiene 0 → 3x so schnell
    const dirtyMultiplier = 1 + 2 * (1 - (data.stats.hygiene / 100));
    const baseHappyDecay  = isNight ? 0.023 : 0.0463;
    data = this.setStat(data, 'happiness', data.stats.happiness - baseHappyDecay * dirtyMultiplier);
    return data;
  },
};

// ── Auto-Speichern beim Verlassen ────────────────
// Jede Seite ruft GameData.registerAutosave(getData) auf
GameData.registerAutosave = function(getDataFn) {
  const handler = () => {
    const data = getDataFn();
    if (data) GameData.save(data);
  };
  window.addEventListener('pagehide',       handler);
  window.addEventListener('beforeunload',   handler);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') handler();
  });
};
