
"use strict";

const STORAGE_KEY = "amoled-ntp-shortcuts-v2";
const TOTAL_SLOTS = 18;

const shortcuts = document.getElementById("shortcuts");
const modal = document.getElementById("modal");
const form = document.getElementById("shortcut-form");
const nameInput = document.getElementById("site-name");
const urlInput = document.getElementById("site-url");
const title = document.getElementById("modal-title");
const error = document.getElementById("form-error");
const removeButton = document.getElementById("remove-shortcut");
const iconSource = document.getElementById("icon-source");
const iconUpload = document.getElementById("icon-upload");

const iconPreview = document.getElementById("icon-preview");
let uploadedIcon = "";
function validIconUrl(value) { try { const u = new URL(value); return u.protocol === "https:" && u.hostname ? u.href : ""; } catch { return ""; } }
function iconChoice(site) {
  if (site?.iconData && /^data:image\/(png|jpeg|webp);base64,/.test(site.iconData)) return {iconData:site.iconData};
  if (site?.iconUrl && validIconUrl(site.iconUrl)) return {iconUrl:validIconUrl(site.iconUrl)};
  return {};
}
function updateIconEditor() {
  document.getElementById("icon-upload-wrap").hidden = iconSource.value !== "upload";

  let preview = "";
  if (iconSource.value === "upload") preview = uploadedIcon;

  else { try { preview = remoteFavicon(new URL(normaliseUrl(urlInput.value)).hostname); } catch {} }
  iconPreview.hidden = !preview;
  if (preview) iconPreview.src = preview;
}
iconSource.addEventListener("change", updateIconEditor);
// Mirror the real select in a compact dropdown to avoid Android's full-screen picker.
const iconSourceTrigger=document.getElementById("icon-source-trigger");
const iconSourceMenu=document.getElementById("icon-source-menu");
const iconSourcePicker=document.getElementById("icon-source-picker");
function syncIconSourcePicker() {
  iconSourceTrigger.textContent=iconSource.selectedOptions[0]?.textContent || "Website favicon";
  iconSourceMenu.querySelectorAll("button").forEach(button=>{
    button.setAttribute("aria-selected",String(button.dataset.source===iconSource.value));
  });
}
function closeIconSourcePicker() {
  iconSourceMenu.hidden=true;
  iconSourceTrigger.setAttribute("aria-expanded","false");
}
iconSourceTrigger.addEventListener("click",()=>{
  const open=iconSourceMenu.hidden;
  iconSourceMenu.hidden=!open;
  iconSourceTrigger.setAttribute("aria-expanded",String(open));
});
iconSourceMenu.querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>{
  iconSource.value=button.dataset.source;
  iconSource.dispatchEvent(new Event("change",{bubbles:true}));
  closeIconSourcePicker();
  iconSourceTrigger.focus();
}));
document.addEventListener("pointerdown",event=>{if(!iconSourcePicker.contains(event.target))closeIconSourcePicker();});
iconSourceTrigger.addEventListener("keydown",event=>{if(event.key==="Escape")closeIconSourcePicker();});
iconSource.addEventListener("change",syncIconSourcePicker);
syncIconSourcePicker();


urlInput.addEventListener("input", () => { if(iconSource.value === "favicon") updateIconEditor(); });
iconUpload.addEventListener("change", async () => {
  const file = iconUpload.files?.[0]; if (!file) return;
  if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 5*1024*1024) { error.textContent = "Choose a PNG, JPG or WebP smaller than 5 MB."; return; }
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas'); canvas.width=96; canvas.height=96;
    const ctx = canvas.getContext('2d');
    const ratio = Math.min(96/bitmap.width,96/bitmap.height);
    ctx.drawImage(bitmap,(96-bitmap.width*ratio)/2,(96-bitmap.height*ratio)/2,bitmap.width*ratio,bitmap.height*ratio);
    bitmap.close?.();
    uploadedIcon = canvas.toDataURL('image/png');
    error.textContent = ""; updateIconEditor();
  } catch { error.textContent = "This image could not be processed."; }
});

let sites = Array(TOTAL_SLOTS).fill(null);
let editingIndex = null;
let draggedIndex = null;
let editMode = false;
let highlightedTarget = null;

function cancelPendingNavigation() { /* Navigation is now immediate. */ }

function positionEditModeBar() {
  const bar=document.getElementById('edit-mode-bar');
  const grid=document.getElementById('shortcuts');
  if(bar.hidden || !grid) return;
  const rect=grid.getBoundingClientRect();
  const height=bar.getBoundingClientRect().height;
  // Keep the prompt near the first row, with room for the phone status area.
  bar.style.setProperty('--edit-prompt-top',Math.max(42,Math.round(rect.top-height-12))+'px');
}
function setEditMode(enabled) {
  editMode = Boolean(enabled);
  document.body.classList.toggle('shortcut-edit-mode', editMode);
  const bar = document.getElementById('edit-mode-bar');
  bar.hidden = !editMode;
  render();
  if(editMode) { positionEditModeBar(); requestAnimationFrame(positionEditModeBar); }
}
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== document.getElementById('settings-frame').contentWindow) return;
  if (event.data?.type === 'ntpam-edit-shortcuts') setEditMode(true);
});
document.getElementById('finish-editing').addEventListener('click', () => setEditMode(false));

function loadSites() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (Array.isArray(saved) && saved.length >= 8 && saved.length <= TOTAL_SLOTS) {
      sites = saved.map(site => {
        if (!site || typeof site.name !== "string" ||
            typeof site.url !== "string") return null;

        try {
          const url = new URL(site.url);
          if (!["https:", "http:"].includes(url.protocol)) return null;

          return { name: site.name, url: url.href, ...iconChoice(site) };
        } catch {
          return null;
        }
      });
      sites = sites.concat(Array(TOTAL_SLOTS - sites.length).fill(null));
    }
  } catch {}
}

function saveSites() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sites));
}

function normaliseUrl(value) {
  let address = value.trim();

  if (!/^https?:\/\//i.test(address)) {
    address = "https://" + address;
  }

  const url = new URL(address);

  if (!["https:", "http:"].includes(url.protocol) ||
      !url.hostname.includes(".")) {
    throw new Error("Invalid URL");
  }

  return url.href;
}

function openModal(index = null) {
  cancelPendingNavigation();
  editingIndex = index;
  error.textContent = "";

  const site = index === null ? null : sites[index];

  title.textContent = site ? "Edit shortcut" : "Add shortcut";
  nameInput.value = site ? site.name : "";
  urlInput.value = site ? site.url : "";

  removeButton.hidden = !site;
  uploadedIcon = site?.iconData || "";
  iconUpload.value = "";

  iconSource.value = site?.iconData ? "upload" : "favicon";
  syncIconSourcePicker();
  closeIconSourcePicker();
  updateIconEditor();
  modal.hidden = false;

  setTimeout(() => nameInput.focus(), 50);
}

function closeModal() {
  modal.hidden = true;
  form.reset();
  error.textContent = "";
  editingIndex = null;
}

document.getElementById("close-modal")
  .addEventListener("click", closeModal);

document.getElementById("cancel-modal")
  .addEventListener("click", closeModal);

modal.addEventListener("click", event => {
  if (event.target === modal) closeModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !modal.hidden) {
    closeModal();
  }
});

form.addEventListener("submit", event => {
  event.preventDefault();
  error.textContent = "";

  const name = nameInput.value.trim();

  if (!name) {
    error.textContent = "Please enter a name.";
    return;
  }

  let url;

  try {
    url = normaliseUrl(urlInput.value);
  } catch {
    error.textContent = "Please enter a valid website URL.";
    return;
  }

  const index = editingIndex !== null
    ? editingIndex
    : sites.findIndex((site, i) => i < preferences.gridColumns * preferences.gridRows && site === null);

  if (index < 0) {
    error.textContent = "All visible shortcut slots are full.";
    return;
  }

  let custom = {};
  if (iconSource.value === "upload") {
    if (!uploadedIcon) { error.textContent = "Choose an image or switch to Website favicon."; return; }
    custom = {iconData:uploadedIcon};
  }
  if (editingIndex !== null && iconSource.value === "favicon" && sites[index]?.iconUrl) custom = {iconUrl:sites[index].iconUrl};
  sites[index] = { name, url, ...custom };
  saveSites();
  render();
  closeModal();
});

removeButton.addEventListener("click", () => {
  if (editingIndex === null) return;

  sites[editingIndex] = null;
  saveSites();
  render();
  closeModal();
});

// Install a local app-shell and favicon cache for repeat visits.
// The page remains usable when service workers are unsupported.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).then(reg => reg.update().catch(() => {})).catch(() => {});
  });
}

// Favicons are loaded as regular cross-origin images on GitHub Pages.
function remoteFavicon(host) {
  return "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(host) + "&sz=64";
}

// Public HTTPS pages cannot fetch Google favicon blobs reliably because of CORS.
// Use the image endpoint directly; browser HTTP caching still applies.
async function getIconUrl(host) {
  return remoteFavicon(host);
}

function makeIcon(site) {
  const icon = document.createElement("div");
  icon.className = "icon";
  const img = document.createElement("img");
  const host = new URL(site.url).hostname;
  img.alt = "";
  img.decoding = "async";
  img.loading = "eager";
  img.fetchPriority = "auto";
  img.onerror = () => {
    img.remove();
    icon.textContent = site.name.charAt(0).toUpperCase();
  };
  icon.appendChild(img);
  // The service worker caches favicon responses where supported. Ignore completion
  // if the shortcut was replaced or removed in the meantime.
  if (site.iconData || site.iconUrl) img.src = site.iconData || site.iconUrl;
  else img.src = remoteFavicon(host); // Avoid an unnecessary promise/microtask for each favicon.
  return icon;
}

function render() {
  // Keep already-loaded icon elements when rebuilding the grid.
  // Moving an existing image node avoids resetting its loading state.
  const previousIcons = new Map();
  for (const oldSlot of shortcuts.children) {
    const oldUrl = oldSlot.dataset.siteUrl;
    const oldIcon = oldSlot.querySelector(".icon");
    if (oldUrl && oldIcon && !previousIcons.has(oldUrl)) {
      previousIcons.set(oldUrl + "|" + (oldSlot.dataset.iconKey || ""), oldIcon);
    }
  }
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < preferences.gridColumns * preferences.gridRows; i++) {
    const site = sites[i];
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.dataset.index = String(i);

    const label = document.createElement("span");
    label.className = "label";

    if (!site) {
      slot.classList.add("empty");

      const icon = document.createElement("div");
      icon.className = "icon";
      icon.textContent = "+";

      label.textContent = "Add shortcut";
      slot.append(icon, label);

      slot.addEventListener("click", () => openModal(i));
    } else {
      slot.dataset.siteUrl = site.url;
      slot.dataset.iconKey = site.iconData || site.iconUrl || "";
      const cachedIcon = previousIcons.get(site.url + "|" + (site.iconData || site.iconUrl || ""));
      slot.append(cachedIcon || makeIcon(site));
      previousIcons.delete(site.url + "|" + (site.iconData || site.iconUrl || ""));

      label.textContent = site.name;
      slot.appendChild(label);

      // Hold to drag. The editor never opens from a stationary hold.
      let pointerId = null;
      let holdTimer = null;
      let startX = 0, startY = 0;
      let armed = false, moving = false, suppressClick = false;
      let targetIndex = null;
      let suppressionTimer = null;
      let originRect = null;
      let slotRects = null;
      let liveTarget = null;
      let lastX = 0, lastY = 0;
      let animationFrame = null;

      function updateLivePosition() {
        animationFrame = null;
        if (!moving || !originRect) return;
        slot.style.transform = `translate3d(${lastX - startX}px, ${lastY - startY}px, 0) scale(1.05)`;
      }
      function setLiveTarget(index) {
        if (liveTarget === index) return;
        if (liveTarget !== null) {
          const old = shortcuts.children[liveTarget];
          if (old) { old.style.transform = ""; old.classList.remove("slot-displaced"); }
        }
        liveTarget = index;
        if (index !== null && index !== i && slotRects) {
          const target = shortcuts.children[index];
          if (target) {
            const dx = originRect.left - slotRects[index].left;
            const dy = originRect.top - slotRects[index].top;
            target.classList.add("slot-displaced");
            target.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
          }
        }
      }
      function findLiveTarget(x, y) {
        if (!slotRects) return null;
        const bounds = shortcuts.getBoundingClientRect();
        if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) return null;
        let best = null, distance = Infinity;
        for (let j = 0; j < slotRects.length; j++) {
          const rect = slotRects[j];
          const d = Math.hypot(x - (rect.left + rect.width / 2), y - (rect.top + rect.height / 2));
          if (d < distance) { distance = d; best = j; }
        }
        return best;
      }

      function highlight(index) {
        const next = index !== i ? index : null;
        if (highlightedTarget === next) return;
        if (highlightedTarget !== null) {
          const previous = shortcuts.children[highlightedTarget];
          if (previous) previous.classList.remove("drag-over");
        }
        highlightedTarget = next;
        if (next !== null) {
          const target = shortcuts.children[next];
          if (target) target.classList.add("drag-over");
        }
      }
      function resetGesture(cancelled = false) {
        clearTimeout(holdTimer);
        if (pointerId === null) return;
        const wasDrag = armed || moving;
        const destination = targetIndex;
        const changed = moving && !cancelled && destination !== null && destination !== i;
        if (animationFrame !== null) cancelAnimationFrame(animationFrame);
        animationFrame = null;
        setLiveTarget(null);
        slot.style.transform = "";
        slot.classList.remove("drag-ready", "dragging");
        if (wasDrag) {
          suppressClick = true;
          clearTimeout(suppressionTimer);
          suppressionTimer = setTimeout(() => { suppressClick = false; }, 700);
        }
        pointerId = null;
        armed = moving = false;
        originRect = slotRects = null;
        liveTarget = null;
        highlight(null);
        if (changed) {
          [sites[i], sites[destination]] = [sites[destination], sites[i]];
          saveSites();
          render();
        }
      }
      slot.addEventListener("pointerdown", event => {
        if (editMode || event.button !== 0 || pointerId !== null || !modal.hidden) return;
        pointerId = event.pointerId;
        // Keep touch events directed to the shortcut throughout the hold and drag.
        try { slot.setPointerCapture(event.pointerId); } catch {}
        startX = event.clientX;
        startY = event.clientY;
        targetIndex = null;
        originRect = slotRects = null;
        liveTarget = null;
        armed = moving = false;
        clearTimeout(holdTimer);
        // Leave ordinary taps uncaptured so the browser can handle them naturally.
        holdTimer = setTimeout(() => {
          if (pointerId !== event.pointerId) return;
          armed = true;
          cancelPendingNavigation();
          slotRects = Array.from(shortcuts.children, el => el.getBoundingClientRect());
          originRect = slotRects[i];
          slot.classList.add("drag-ready");
        }, 450);
      });
      slot.addEventListener("pointermove", event => {
        if (pointerId !== event.pointerId) return;
        const distance = Math.hypot(event.clientX - startX, event.clientY - startY);
        if (!armed) {
          if (distance > 12) resetGesture(true);
          return;
        }
        if (distance > 9) {
          moving = true;
          slot.classList.remove("drag-ready");
          slot.classList.add("dragging");
        }
        if (moving) {
          event.preventDefault();
          lastX = event.clientX;
          lastY = event.clientY;
          if (animationFrame === null) animationFrame = requestAnimationFrame(updateLivePosition);
          targetIndex = findLiveTarget(event.clientX, event.clientY);
          setLiveTarget(targetIndex === i ? null : targetIndex);
        }
      });
      slot.addEventListener("pointerup", event => {
        if (pointerId === event.pointerId) resetGesture(false);
      });
      slot.addEventListener("pointercancel", event => {
        if (pointerId === event.pointerId) resetGesture(true);
      });
      slot.addEventListener("lostpointercapture", event => {
        if (pointerId === event.pointerId) resetGesture(true);
      });
      slot.addEventListener("contextmenu", event => {
        event.preventDefault();
        // A touch long-press may synthesize a context menu: never open Edit for it.
        if (event.pointerType === "touch" || pointerId !== null) return;
        if (modal.hidden) openModal(i);
      });
      slot.addEventListener("click", event => {
        if (suppressClick || !modal.hidden) {
          event.preventDefault();
          return;
        }
        if (editMode) {
          event.preventDefault();
          openModal(i);
          return;
        }
        // Navigate on the first tap; no 350ms double-tap wait.
        window.location.assign(site.url);
      });
    }

    fragment.appendChild(slot);
  }
  highlightedTarget = null;
  shortcuts.replaceChildren(fragment);
}


// Clock/date preference and settings
const SETTINGS_KEY = "ntp-am-settings-v1";
const clockPanel = document.getElementById("clock-panel");
const clockTime = document.getElementById("clock-time");
const clockDate = document.getElementById("clock-date");

let preferences = { showClock: true, gridColumns: 4, gridRows: 2, gridPosition: 66, gridAnchor: "default", iconSize: "medium", showLabels: true, iconStyle: "floating" };

function loadPreferences() {
  const oldLayout = `${preferences.gridColumns}|${preferences.gridRows}|${preferences.iconSize}|${preferences.iconStyle}|${preferences.showLabels}`;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch {}
  preferences.showClock = typeof saved.showClock === "boolean" ? saved.showClock : true;
  preferences.gridColumns = [4,5,6].includes(Number(saved.gridColumns)) ? Number(saved.gridColumns) : 4;
  preferences.gridRows = [1,2,3].includes(Number(saved.gridRows)) ? Number(saved.gridRows) : 2;
  preferences.gridPosition = Number.isFinite(Number(saved.gridPosition)) && Number(saved.gridPosition) >= 25 && Number(saved.gridPosition) <= 80 ? Number(saved.gridPosition) : 66;
  preferences.gridAnchor = ["default","top","centre","bottom"].includes(saved.gridAnchor) ? saved.gridAnchor : "default";
  preferences.iconSize = ["small","medium","large"].includes(saved.iconSize) ? saved.iconSize : "medium";
  preferences.showLabels = typeof saved.showLabels === "boolean" ? saved.showLabels : true;
  preferences.iconStyle = ["floating","tiles","glass"].includes(saved.iconStyle) ? saved.iconStyle : "floating";
  applyClockVisibility();
  scheduleClock();
  applyShortcutAppearance();
  applyWallpaper();
  const newLayout = `${preferences.gridColumns}|${preferences.gridRows}|${preferences.iconSize}|${preferences.iconStyle}|${preferences.showLabels}`;
  if (!shortcuts.children.length || oldLayout !== newLayout) render();
}
function applyShortcutAppearance() {
  shortcuts.style.setProperty("--grid-columns", String(preferences.gridColumns));
  shortcuts.style.setProperty("--grid-position", String(preferences.gridPosition) + "%");
  shortcuts.dataset.gridAnchor = preferences.gridAnchor;
  requestAnimationFrame(positionEditModeBar);
  shortcuts.dataset.iconSize = preferences.iconSize;
  shortcuts.dataset.iconStyle = preferences.iconStyle;
  shortcuts.classList.toggle("hide-labels", !preferences.showLabels);
}

function savePreferences() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(preferences));
}

function applyClockVisibility() {
  clockPanel.hidden = !preferences.showClock;
}

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit", minute: "2-digit", hourCycle: "h23"
});
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long", day: "numeric", month: "long", year: "numeric"
});
let lastClockMinute = "";
let clockTimer = null;
function updateClock() {
  if (!preferences.showClock || document.hidden) return;
  const now = new Date();
  const minute = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
  if (minute === lastClockMinute) return;
  lastClockMinute = minute;
  clockTime.textContent = timeFormatter.format(now);
  clockDate.textContent = dateFormatter.format(now);
}
function scheduleClock() {
  clearTimeout(clockTimer);
  if (!preferences.showClock || document.hidden) return;
  updateClock();
  // Align updates with the minute boundary instead of formatting every 15 seconds.
  clockTimer = setTimeout(scheduleClock, 60000 - Date.now() % 60000 + 30);
}
document.addEventListener("visibilitychange", scheduleClock);


// Render the wallpaper as a genuine image, independently of CSS background painting.
const WALLPAPER_KEY = "ntp-am-wallpaper-v1";
function applyWallpaper() {
  const layer = document.getElementById("wallpaper-layer");
  if (!layer) return;
  let wallpaper = {};
  try { wallpaper = JSON.parse(localStorage.getItem(WALLPAPER_KEY)) || {}; } catch {}
  const source = typeof wallpaper.image === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(wallpaper.image) ? wallpaper.image : "";
  let photo = document.getElementById("ntpure-wallpaper-photo");
  if (!photo) {
    photo = document.createElement("img");
    photo.id = "ntpure-wallpaper-photo";
    photo.alt = "";
    photo.setAttribute("aria-hidden", "true");
    photo.decoding = "async";
    layer.appendChild(photo);
  }
  let shade = document.getElementById("ntpure-wallpaper-shade");
  if (!shade) {
    shade = document.createElement("div");
    shade.id = "ntpure-wallpaper-shade";
    layer.appendChild(shade);
  }
  if (source) {
    if (photo.src !== source) photo.src = source;
    photo.style.display = "block";
    shade.style.display = "block";
    const darkness = Math.min(90, Math.max(0, Number(wallpaper.darkness ?? 35) || 0)) / 100;
    shade.style.backgroundColor = `rgba(0,0,0,${darkness})`;
  } else {
    photo.removeAttribute("src");
    photo.style.display = "none";
    shade.style.display = "none";
  }
  layer.style.backgroundImage = "none";
}
window.applyNtpWallpaper = applyWallpaper;
window.applyNtpWallpaperDarkness = applyWallpaper;
window.addEventListener("storage", event => {
  if (event.key === WALLPAPER_KEY) applyWallpaper();
  if (event.key === SETTINGS_KEY) {
    loadPreferences();
  }
});


loadSites();
loadPreferences();

window.addEventListener('resize',()=>{if(editMode)positionEditModeBar();});
if('ResizeObserver' in window) new ResizeObserver(()=>{if(editMode)positionEditModeBar();}).observe(document.getElementById('shortcuts'));

// Optional local diagnostic: append ?perf=1 to the page URL and view the console.
if (new URLSearchParams(location.search).has('perf')) {
  const measure = () => {
    const nav = performance.getEntriesByType('navigation')[0];
    console.info('[NTPure performance]', {
      domReadyMs: Math.round(nav?.domContentLoadedEventEnd ?? 0),
      loadMs: Math.round(nav?.loadEventEnd ?? 0),
      shortcuts: document.querySelectorAll('#shortcuts .slot').length,
      wallpaperEnabled: Boolean(currentWallpaperImage)
    });
  };
  window.addEventListener('load', () => setTimeout(measure, 0), {once:true});
  document.getElementById('shortcuts').addEventListener('click', event => {
    const slot = event.target.closest('.slot[data-site-url]');
    if (slot) console.info('[NTPure performance] Shortcut click dispatched', performance.now().toFixed(1), slot.dataset.siteUrl);
  }, {capture:true});
}
