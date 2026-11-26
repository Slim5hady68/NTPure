"use strict";
const STORAGE_KEY = "amoled-ntp-shortcuts-v2";
const SETTINGS_KEY = "ntp-am-settings-v1";
const WALLPAPER_KEY = "ntp-am-wallpaper-v1";
const TOTAL_SLOTS = 18;
const DEFAULT_PREFS = {showClock:true, gridColumns:4, gridRows:2, gridBottomPosition:80, iconSize:"medium", showLabels:true, iconStyle:"floating"};
const showClock = document.getElementById("show-clock");
const backupInput = document.getElementById("backup-file");
const status = document.getElementById("status");

function readPreferences() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch {}
  return {
    showClock: typeof saved.showClock === "boolean" ? saved.showClock : true,
    gridColumns: [4,5,6].includes(Number(saved.gridColumns)) ? Number(saved.gridColumns) : 4,
    gridRows: [1,2,3].includes(Number(saved.gridRows)) ? Number(saved.gridRows) : 2,
    gridBottomPosition: Number.isFinite(Number(saved.gridBottomPosition)) && Number(saved.gridBottomPosition)>=25 && Number(saved.gridBottomPosition)<=80 ? Number(saved.gridBottomPosition) : 80,
    iconSize: ["small","medium","large"].includes(saved.iconSize) ? saved.iconSize : "medium",
    showLabels: typeof saved.showLabels === "boolean" ? saved.showLabels : true,
    iconStyle: ["floating","tiles","glass"].includes(saved.iconStyle) ? saved.iconStyle : "floating"
  };
}
function savePreference(key, value) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({...readPreferences(), [key]:value}));
  setStatus("Display preference saved.");
}
function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}
showClock.checked = readPreferences().showClock;
showClock.addEventListener("change", () => savePreference("showClock", showClock.checked));
const columnButtons = [...document.querySelectorAll("[data-columns]")];
function updateColumnButtons(value) {
  columnButtons.forEach(button => {
    const selected = Number(button.dataset.columns) === Number(value);
    button.setAttribute("aria-pressed", String(selected));
  });
}
const rowButtons = [...document.querySelectorAll('[data-rows]')];
function updateRowButtons(value) { rowButtons.forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.rows)===Number(value)))); }
updateRowButtons(readPreferences().gridRows);
rowButtons.forEach(b=>b.addEventListener('click',()=>{const value=Number(b.dataset.rows);savePreference('gridRows',value);updateRowButtons(value);}));
const positionSlider=document.getElementById('grid-position');
const positionOutput=document.getElementById('grid-position-value');
function syncPosition(value){positionSlider.value=value;positionOutput.textContent=value===80?'Bottom':value<45?'Higher':'Raised';}
syncPosition(readPreferences().gridBottomPosition);
positionSlider.addEventListener('input',()=>{syncPosition(Number(positionSlider.value));savePreference('gridBottomPosition',Number(positionSlider.value));});
const iconSizeSelect = document.getElementById("icon-size");
const labelsToggle = document.getElementById("show-labels");
const iconStyleSelect = document.getElementById("icon-style");
iconStyleSelect.value = readPreferences().iconStyle;
iconStyleSelect.addEventListener("change", () => savePreference("iconStyle", iconStyleSelect.value));
updateColumnButtons(readPreferences().gridColumns);
iconSizeSelect.value = readPreferences().iconSize;
labelsToggle.checked = readPreferences().showLabels;
columnButtons.forEach(button => button.addEventListener("click", () => {
  const columns = Number(button.dataset.columns);
  savePreference("gridColumns", columns);
  updateColumnButtons(columns);
}));
iconSizeSelect.addEventListener("change", () => savePreference("iconSize", iconSizeSelect.value));
labelsToggle.addEventListener("change", () => savePreference("showLabels", labelsToggle.checked));
function readSites() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(data) && data.length >= 8 && data.length <= TOTAL_SLOTS) return data.concat(Array(TOTAL_SLOTS - data.length).fill(null));
  } catch {}
  return Array(TOTAL_SLOTS).fill(null);
}
function exportBackup() {
  const backup = { app: "NTPure", backupVersion: 1, exportedAt: new Date().toISOString(), shortcuts: readSites(), preferences: readPreferences(), wallpaper: JSON.parse(localStorage.getItem(WALLPAPER_KEY) || "null") };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "NTPure-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus("Backup exported. Keep it somewhere safe.");
}
document.getElementById("export-backup").addEventListener("click", exportBackup);
document.getElementById("choose-backup").addEventListener("click", () => { backupInput.value = ""; backupInput.click(); });
function validateBackup(data) {
  if (!data || !["NTPure", "NTP-Am"].includes(data.app) || data.backupVersion !== 1 || !Array.isArray(data.shortcuts) || ![8, 10, 12, 18].includes(data.shortcuts.length)) throw new Error("This is not a valid NTPure or NTP-Am backup.");
  const shortcuts = data.shortcuts.map(site => {
    if (site === null) return null;
    if (!site || typeof site.name !== "string" || typeof site.url !== "string") throw new Error("The backup contains an invalid shortcut.");
    const url = new URL(site.url);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) throw new Error("The backup contains an invalid website address.");
    const custom = {};
    if (site.iconData !== undefined) {
      if (typeof site.iconData !== "string" || site.iconData.length > 150000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(site.iconData)) throw new Error("Invalid uploaded icon in backup.");
      custom.iconData = site.iconData;
    } else if (site.iconUrl !== undefined) {
      if (typeof site.iconUrl !== "string") throw new Error("Invalid icon URL in backup.");
      const imageUrl = new URL(site.iconUrl);
      if (imageUrl.protocol !== "https:") throw new Error("Icon URLs must use HTTPS.");
      custom.iconUrl = imageUrl.href;
    }
    return { name: site.name.slice(0, 30), url: url.href, ...custom };
  });
  while (shortcuts.length < TOTAL_SLOTS) shortcuts.push(null);
  const raw = data.preferences || {};
  const preferences = {
    showClock: typeof raw.showClock === "boolean" ? raw.showClock : true,
    gridColumns: [4,5,6].includes(Number(raw.gridColumns)) ? Number(raw.gridColumns) : 4,
    gridRows: [1,2,3].includes(Number(raw.gridRows)) ? Number(raw.gridRows) : 2,
    gridBottomPosition: Number.isFinite(Number(raw.gridBottomPosition)) && Number(raw.gridBottomPosition)>=25 && Number(raw.gridBottomPosition)<=80 ? Number(raw.gridBottomPosition) : 80,
    iconSize: ["small","medium","large"].includes(raw.iconSize) ? raw.iconSize : "medium",
    showLabels: typeof raw.showLabels === "boolean" ? raw.showLabels : true,
    iconStyle: ["floating","tiles","glass"].includes(raw.iconStyle) ? raw.iconStyle : "floating"
  };
  let wallpaper=null;
  if (data.wallpaper != null) {
    const w=data.wallpaper;
    if (typeof w !== 'object' || typeof w.image !== 'string' || w.image.length>4300000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(w.image) || !Number.isFinite(Number(w.darkness)) || Number(w.darkness)<0 || Number(w.darkness)>90) throw new Error('Invalid wallpaper in backup.');
    wallpaper={image:w.image,darkness:Number(w.darkness)};
  }
  return { shortcuts, preferences, wallpaper };
}
backupInput.addEventListener("change", async () => {
  const file = backupInput.files && backupInput.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const restored = validateBackup(data);
    if (!window.confirm("Restore this NTPure backup? Your current shortcuts, preferences and wallpaper will be replaced.")) { setStatus("Restore cancelled."); return; }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(restored.shortcuts));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(restored.preferences));
    if(restored.wallpaper)localStorage.setItem(WALLPAPER_KEY,JSON.stringify(restored.wallpaper));else localStorage.removeItem(WALLPAPER_KEY);
    showClock.checked = restored.preferences.showClock;
    updateColumnButtons(restored.preferences.gridColumns);
    updateRowButtons(restored.preferences.gridRows);
    syncPosition(restored.preferences.gridBottomPosition);
    iconSizeSelect.value = restored.preferences.iconSize;
    labelsToggle.checked = restored.preferences.showLabels;
    iconStyleSelect.value = restored.preferences.iconStyle;
    setStatus("Backup restored successfully.");
  } catch (err) { setStatus(err.message || "Could not read that backup file.", true); }
});

// Switch the parent New Tab Page into shortcut editing mode.
document.getElementById('edit-shortcuts').addEventListener('click', () => {
  if (window.parent !== window) {
    window.parent.postMessage({type:'ntpam-edit-shortcuts'}, location.origin);
    setStatus('Tap a shortcut to edit it, then select Done.');
  } else {
    setStatus('Open Settings from the New Tab Page to edit shortcuts.', true);
  }
});
