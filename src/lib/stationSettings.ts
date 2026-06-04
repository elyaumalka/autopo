// הגדרות מנהל לתחנת ההשכרה - נשמרות מקומית בדפדפן (localStorage), ללא צורך ב-DB
export interface StationSettings {
  requireHold: boolean;    // חובה לתפוס מסגרת אשראי לפני הפעלת השכרה
  requirePrepay: boolean;  // חובה לשלם מראש (ללא יתרה) לפני הפעלת השכרה
}

const KEY = "autopo_station_settings";

const DEFAULTS: StationSettings = {
  requireHold: true,
  requirePrepay: false,
};

export function getStationSettings(): StationSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function setStationSettings(settings: StationSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}
