// v1.69.5_DRAGGABLE_AUTO_REFRESH_LAMP - status lampica moze da se prevuce
/* ASKCREATE.APP by AskCreate - AskCreate.app
   VAŽNO:
   1) SUPABASE_URL je već upisan.
   2) SUPABASE_KEY zameni tvojim Publishable key iz supabase-podaci.txt.
   3) Nikad ne ubacuj Secret key u ovaj fajl.
*/

const SUPABASE_URL = "https://kzwawwrewakjbfhgrbdt.supabase.co";
const SUPABASE_KEY = "sb_publishable_tounvJXNQqJmmkeEfm84Ow_rncVTr3V";
// VAPID public key nije tajna. Zalepi ovde PUBLIC key iz Supabase Edge Function Secrets kada spremimo push.
// Dok je prazno/placeholder, dugme za obaveštenja će jasno javiti šta fali.
const MECHANIC_VAPID_PUBLIC_KEY = "BPariq57Qi11Lw_CgoWwgaazc9G3M-YOaZS1BAZ3a6Z5422DfxDgYdaxRTJfIwMPf63aPhwxXVLKNlw6WsIvTsk";
const APP_VERSION = "1.71.1-tanker-consumption";


let sb = null;
let currentCompany = null;
let editingPersonId = null;
let editingAssetId = null;
let editingMaterialId = null;
let editingSiteId = null;
let currentWorker = null;
let workerAssetOptions = [];
let workerSiteOptions = [];
let workerMaterialOptions = [];
let deferredPwaInstallPrompt = null;
let pwaInstallPromptReadyAt = 0;
const AUTO_REFRESH_INTERVAL_MS = 10000;
let directorAutoRefreshTimer = null;
let directorAutoRefreshBusy = false;
let mechanicBossAutoRefreshBusy = false;
let ownerAutoRefreshTimer = null;
let ownerAutoRefreshBusy = false;
let autoRefreshHeartbeatTimer = null;
let autoRefreshHeartbeatScope = "panel";
let autoRefreshProbeBusy = false;
let autoRefreshLastOk = null;
let directorKnownReportIds = new Set();
let workerReportSubmitBusy = false;
let fieldTankerMemorySubmitBusy = false;
let adminCompanySaveBusy = false;
let directorBulkApproveBusy = false;
let directorBulkArchiveBusy = false;
let directorBulkDeleteArchiveBusy = false;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function initSupabase() {
  if (!SUPABASE_KEY || SUPABASE_KEY.includes("OVDE_NALEPI")) {
    toast("Nije ubačen Supabase Publishable key u script.js. Otvori script.js i zameni placeholder.", true);
    return false;
  }
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  return true;
}

function toast(msg, isError = false) {
  const el = $("#toast");
  el.textContent = msg;
  el.style.borderColor = isError ? "rgba(185,28,28,.75)" : "rgba(245,185,66,.35)";
  el.style.background = isError ? "#7f1d1d" : "#173b24";
  el.classList.toggle("toast-error", !!isError);
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), isError ? 6500 : 4500);
}



function ensureDirectorTopLogoutButton() {
  // Nema više dodatnog Odjavi se dugmeta u Upravi.
  // Koristi se samo glavno dugme na zelenoj traci (#logoutBtn).
}



function showCurrentCompanyLoginInfo() {
  const box = $("#directorWorkerCodeHelpBox");
  if (!box || !currentCompany) return;
  const companyCode = currentCompany.code || currentCompany.company_code || "";
  box.innerHTML = `
    <b>Prijava zaposlenog:</b>
    <span>Šifra firme je <strong>${escapeHtml(companyCode)}</strong>. Ovde upisuješ samo lični pristupni kod zaposlenog.</span>
  `;
}

function normalizeLoginCode(code) {
  // Login kodovi ne smeju da padnu zbog velikih/malih slova ili slučajnog razmaka.
  // Primer: " FIRMA01 " i "firma01" tretiramo isto.
  return String(code || "").trim().toLowerCase().replace(/\s+/g, "");
}

const COMPANY_BRAND_OPTIONS = [
  { value: "green", label: "Poslovna zelena" },
  { value: "darkgreen", label: "Tamno zelena" },
  { value: "blue", label: "Poslovna plava" },
  { value: "orange", label: "Narandžasta" },
  { value: "red", label: "Crvena" },
  { value: "purple", label: "Ljubičasta" },
  { value: "dark", label: "Tamna / grafit" }
];

function normalizeCompanyBrandColor(value) {
  const color = String(value || "green").toLowerCase().trim();
  return COMPANY_BRAND_OPTIONS.some(o => o.value === color) ? color : "green";
}

function companyBrandLabel(value) {
  const color = normalizeCompanyBrandColor(value);
  return (COMPANY_BRAND_OPTIONS.find(o => o.value === color) || COMPANY_BRAND_OPTIONS[0]).label;
}

function companyBrandSelectHtml(table, id, color) {
  const selected = normalizeCompanyBrandColor(color);
  const options = COMPANY_BRAND_OPTIONS.map(o => `<option value="${escapeHtml(o.value)}" ${o.value === selected ? "selected" : ""}>${escapeHtml(o.label)}</option>`).join("");
  return `<label class="admin-brand-picker">Boja firme <select data-brand-table="${escapeHtml(table)}" data-brand-id="${escapeHtml(id)}" onchange="adminUpdateCompanyBrand('${escapeHtml(table)}','${escapeHtml(id)}',this.value)">${options}</select></label><button class="secondary small-action" type="button" onclick="adminSaveCompanyBrandFromButton(this)">Sačuvaj boju</button>`;
}

function adminRenewPackageHtml(table, id, paidUntil) {
  const safeValue = String(paidUntil || "").slice(0, 10);
  return `
    <div class="admin-renew-row">
      <label>Produži paket do
        <input type="date" data-renew-table="${escapeHtml(table)}" data-renew-id="${escapeHtml(id)}" value="${escapeHtml(safeValue)}" />
      </label>
      <button class="secondary small-action" type="button" onclick="adminSavePackageUntilFromButton(this)">Sačuvaj datum</button>
      <button class="secondary small-action" type="button" onclick="adminAddMonthPackageUntil('${escapeHtml(table)}','${escapeHtml(id)}')">+ 1 mesec</button>
    </div>`;
}

function applyCompanyBrandToBody(color) {
  const brand = normalizeCompanyBrandColor(color);
  document.body.classList.remove("company-brand-green", "company-brand-darkgreen", "company-brand-blue", "company-brand-orange", "company-brand-red", "company-brand-purple", "company-brand-dark");
  document.body.classList.add(`company-brand-${brand}`);
}

function clearCompanyBrandFromBody() {
  document.body.classList.remove("company-brand-green", "company-brand-darkgreen", "company-brand-blue", "company-brand-orange", "company-brand-red", "company-brand-purple", "company-brand-dark");
}

function readRpcSingleRow(data) {
  if (Array.isArray(data)) return data[0] || null;
  if (data && typeof data === "object") return data;
  return null;
}

function normalizeWorkerLoginValue(value) {
  return normalizeLoginCode(String(value || ""));
}

function workerRowMatchesLogin(row = {}, companyCode = "", accessCode = "", expectedPersonId = "") {
  const expectedCompany = normalizeWorkerLoginValue(companyCode);
  const expectedCode = normalizeWorkerLoginValue(accessCode);
  const expectedId = String(expectedPersonId || "").trim();
  const rowCompany = normalizeWorkerLoginValue(row.company_code || row.code || row.company || row.company_slug);
  const rowAccess = normalizeWorkerLoginValue(row.access_code || row.worker_code || row.personal_code || row.pin);
  const rowIds = [row.user_id, row.id, row.person_id, row.worker_id, row.company_user_id].map(v => String(v || "").trim()).filter(Boolean);
  const companyOk = !expectedCompany || !rowCompany || rowCompany === expectedCompany;
  const codeOk = !expectedCode || !rowAccess || rowAccess === expectedCode;
  const idOk = !expectedId || rowIds.includes(expectedId);
  return companyOk && codeOk && idOk;
}

function selectWorkerLoginRow(data, companyCode = "", accessCode = "", expectedPersonId = "") {
  const rows = Array.isArray(data) ? data : (data && typeof data === "object" ? [data] : []);
  if (!rows.length) return null;
  const exact = rows.find(row => workerRowMatchesLogin(row, companyCode, accessCode, expectedPersonId));
  if (exact) return exact;
  return rows.length === 1 && workerRowMatchesLogin(rows[0], companyCode, accessCode, "") ? rows[0] : null;
}

let internalHeaderCollapseTimer = null;

function expandInternalHeaderForMoment(durationMs = 10000) {
  const header = $("#internalHeader");
  if (!header) return;
  header.classList.add("is-expanded");
  clearTimeout(internalHeaderCollapseTimer);
  internalHeaderCollapseTimer = setTimeout(() => {
    if (!header.matches(":hover") && !header.matches(":focus-within")) {
      header.classList.remove("is-expanded");
    }
  }, durationMs);
}

function setupInternalHeaderHover() {
  const header = $("#internalHeader");
  if (!header || header.dataset.askcreateHeaderReady === "1") return;
  header.dataset.askcreateHeaderReady = "1";
  ["mouseenter", "focusin", "click", "touchstart"].forEach((eventName) => {
    header.addEventListener(eventName, () => expandInternalHeaderForMoment(10000), { passive: true });
  });
  header.addEventListener("mouseleave", () => {
    clearTimeout(internalHeaderCollapseTimer);
    internalHeaderCollapseTimer = setTimeout(() => header.classList.remove("is-expanded"), 10000);
  });
}

function setInternalHeader(title = "", subtitle = "", showHeader = true) {
  const header = $("#internalHeader");
  if (!header) return;
  const titleEl = $("#internalTitle");
  const subtitleEl = $("#internalSubtitle");
  const logoutBtn = $("#internalLogoutBtn");
  if (titleEl) titleEl.textContent = title || "Radni prostor";
  if (subtitleEl) subtitleEl.textContent = subtitle || "";
  header.classList.toggle("hidden", !showHeader);
  if (logoutBtn) logoutBtn.classList.toggle("hidden", !showHeader);
  document.body.classList.toggle("in-app", !!showHeader);
  setupInternalHeaderHover();
  if (showHeader) expandInternalHeaderForMoment(10000);
}

function businessSetText(id, value) {
  const el = $("#" + id);
  if (el) el.textContent = value;
}

function businessUpdateCompanyName() {
  const name = currentCompany?.name || activeCompany?.name || "Firma";
  businessSetText("directorBusinessCompanyName", name);
}

function businessUpdatePeopleCount(list) {
  businessSetText("directorMetricPeople", Array.isArray(list) ? String(list.length) : "—");
}

function businessUpdateSitesCount(list) {
  businessSetText("directorMetricSites", Array.isArray(list) ? String(list.length) : "—");
}

function businessCollectFuelLiters(data) {
  const d = data || {};
  const fuelEntries = Array.isArray(d.fuel_entries) ? d.fuel_entries : [];
  const fieldTankerEntries = Array.isArray(d.field_tanker_entries)
    ? d.field_tanker_entries
    : (Array.isArray(d.tanker_fuel_entries) ? d.tanker_fuel_entries : []);

  const fuelTotal = fuelEntries.reduce((sum, entry) => sum + parseDecimalInput(entry?.liters), 0);
  const tankerTotal = fieldTankerEntries.reduce((sum, entry) => sum + parseDecimalInput(entry?.liters), 0);

  // Važno: ne sabiramo rekurzivno sva polja iz report.data.
  // Stari kod je mogao duplo brojati d.fuel_liters + fuel_entries[].liters
  // i praviti pogrešan zbir goriva u Uprava firme dashboardu.
  if (fuelEntries.length || fieldTankerEntries.length) return fuelTotal + tankerTotal;

  // Fallback samo za stare izveštaje koji nemaju niz fuel_entries.
  return parseDecimalInput(d.fuel_liters) + parseDecimalInput(d.field_tanker_liters) + parseDecimalInput(d.tanker_liters);
}

function fuelReportCountLabel(count) {
  const n = Number(count || 0);
  if (n === 1) return "1 izveštaj";
  return `${n} izveštaja`;
}

function fuelReportDateKey(r) {
  return String(r?.report_date || r?.submitted_at || r?.created_at || "").slice(0, 10);
}

function getTodayFuelWorkerDashboardReports(reports) {
  const todayIso = today();
  return (Array.isArray(reports) ? reports : []).filter(r => {
    if (isArchivedReport(r)) return false;
    if (fuelReportDateKey(r) !== todayIso) return false;
    // Gorivo radnici: radnik sipa u svoju mašinu/vozilo i šalje odmah.
    // Ne meša se sa dnevnikom rada i ne meša se sa cisternom.
    return hasWorkerFuelEntryData(r) && !hasFieldTankerFuelData(r);
  });
}

function getTodayFuelTankerDashboardReports(reports) {
  const todayIso = today();
  return (Array.isArray(reports) ? reports : []).filter(r => {
    if (isArchivedReport(r)) return false;
    if (fuelReportDateKey(r) !== todayIso) return false;
    // Gorivo cisterna: izveštaj cisterne za gorivo, zasebno od radničkih sipanja.
    return hasFieldTankerFuelData(r);
  });
}

function getTodayFuelDashboardReports(reports) {
  return [
    ...getTodayFuelWorkerDashboardReports(reports),
    ...getTodayFuelTankerDashboardReports(reports)
  ];
}

function businessUpdateReportsMetrics(list) {
  const reports = Array.isArray(list) ? list : [];
  const pending = reports.filter(isPendingDirectorReport).length;
  businessSetText("directorMetricPendingReports", String(pending));
  const workerFuelReports = getTodayFuelWorkerDashboardReports(reports);
  const tankerFuelReports = getTodayFuelTankerDashboardReports(reports);
  const fuelReports = [...workerFuelReports, ...tankerFuelReports];
  const fuel = Math.round(fuelReports.reduce((sum, r) => sum + businessCollectFuelLiters(r.data || {}), 0));
  const todayIso = today();
  const todayDefects = reports.filter(r => !isArchivedReport(r) && String(r.report_date || r.submitted_at || r.created_at || "").slice(0, 10) === todayIso && hasDefectData(r)).length;
  const archived = reports.filter(isArchivedReport).length;
  // Kvarovi se vode samo kroz karticu Kvarovi. Ne smeju dizati broj u kartici Dnevnik rada danas.
  const todayDailyLogReports = reports.filter(r => !isArchivedReport(r) && !isDefectOnlyReport(r) && !isFuelDashboardOnlyReport(r) && hasDailyReportData(r) && officeReportMatchesDateSite(r, todayIso, todayIso, "")).length;
  const todayCarnetRows = officeMetricCarnetRowsForToday(reports);
  businessSetText("directorMetricDailyLog", String(todayDailyLogReports));
  businessSetText("directorMetricCarnet", String(todayCarnetRows));
  businessSetText("directorMetricFuel", fuelReportCountLabel(fuelReports.length));
  businessSetText("directorMetricFuelLabel", fuel > 0 ? `Gorivo · radnici ${workerFuelReports.length} / cisterna ${tankerFuelReports.length} · ${fuel} L` : "Gorivo radnici / cisterna");
  businessSetText("directorMetricDefectsToday", String(todayDefects));
  businessSetText("directorMetricArchive", String(archived));
}

function show(view) {
  const publicViews = ["Home", "AdminLogin", "DirectorLogin", "WorkerLogin"];
  // VAŽNO: QR radnički login ima svoj "samo kod" izgled.
  // Kada zaposleni uspešno uđe u profil, taj login izgled mora nestati,
  // inače forma za prijavu ostaje iznad terenskog obrasca.
  if (view !== "WorkerLogin") {
    document.body.classList.remove("worker-code-only-mode", "worker-company-locked");
    const loginCard = document.querySelector("#viewWorkerLogin .card");
    if (loginCard) loginCard.classList.remove("worker-company-locked-card");
  }
  document.body.classList.toggle("worker-field-theme", view === "WorkerForm" || view === "MechanicBossPanel" || view === "OwnerDashboardPanel");
  document.body.classList.toggle("mechanic-boss-mode", view === "MechanicBossPanel");
  document.body.classList.toggle("owner-dashboard-mode", view === "OwnerDashboardPanel");
  if (view !== "WorkerForm") document.body.classList.remove("worker-desktop-panel");
  if (publicViews.includes(view)) {
    clearCompanyBrandFromBody();
    setInternalHeader("", "", false);
  }

  $$(".view").forEach(v => v.classList.remove("active"));
  const el = $("#view" + view);
  if (el) el.classList.add("active");
  if (view === "WorkerLogin") setTimeout(applyWorkerCompanyContextFromUrlOrStorage, 0);
  if (view === "Home") {
    setTimeout(() => {
      applyPublicHomeVisualSettings();
      loadPublicHomeVisualSettings().catch(() => applyPublicHomeVisualSettings());
    }, 0);
  }

  // Koristimo samo jedno dugme za odjavu: ono na zelenoj traci (#internalLogoutBtn).
  // Staro dugme iz javnog topbara ostaje skriveno da ne pravi duplikat.
  const oldTopbarLogout = $("#logoutBtn");
  if (oldTopbarLogout) oldTopbarLogout.classList.add("hidden");
  const workerLogoutBtn = $("#workerLogoutBtn");
  if (workerLogoutBtn && view !== "WorkerForm") {
    workerLogoutBtn.classList.add("hidden");
    workerLogoutBtn.setAttribute("aria-hidden", "true");
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeCode(s) {
  return String(s || "").trim().toLowerCase();
}

async function signUp(email, password) {
  if (!initSupabase()) return null;
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

async function signIn(email, password) {
  if (!initSupabase()) return null;
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signOut() {
  stopDirectorAutoRefresh();
  if (sb) await sb.auth.signOut();
  currentCompany = null;
  currentWorker = null;
  clearCompanyBrandFromBody();
  localStorage.removeItem("swp_worker");
  setInternalHeader("", "", false);
  show("Home");
}

async function ensureAdmin() {
  const { data, error } = await sb.from("app_admins").select("*").eq("email", "duskomacak@gmail.com").maybeSingle();
  if (error || !data || !data.active) throw new Error("Ovaj nalog nema Administrator sistema dozvolu.");
  return true;
}

async function loadAdmin() {
  await ensureAdmin();
  setInternalHeader("Admin soba", "Odobravanje izveštaja firmi", true);
  show("AdminDashboard");
  await Promise.all([loadApprovedCompanies(), loadCompanies(), loadPublicHomeVisualSettings()]);
}

let adminApprovedCompaniesCache = [];
let adminRegisteredCompaniesCache = [];
let adminCompanyCodeCheckTimer = null;
let publicHomeVisualSettings = { hero_image_data_url: "" };
let pendingAdminHomeVisualDataUrl = "";

async function loadPublicHomeVisualSettings() {
  const cachedUrl = String(localStorage.getItem("askcreate_public_home_visual") || "").trim();
  if (cachedUrl && !String(publicHomeVisualSettings?.hero_image_data_url || "").trim()) {
    publicHomeVisualSettings = { hero_image_data_url: cachedUrl };
    applyPublicHomeVisualSettings();
  }
  try {
    if (!initSupabase()) {
      renderAdminHomeVisualPreview();
      return;
    }
    const { data, error } = await sb.from("public_home_settings").select("*").eq("id", 1).maybeSingle();
    if (error) throw error;
    publicHomeVisualSettings = data || { hero_image_data_url: cachedUrl };
    const dbUrl = String(publicHomeVisualSettings?.hero_image_data_url || "").trim();
    if (dbUrl) localStorage.setItem("askcreate_public_home_visual", dbUrl);
    else localStorage.removeItem("askcreate_public_home_visual");
  } catch (e) {
    console.warn("AskCreate.app: public_home_settings nije učitan", e?.message || e);
    publicHomeVisualSettings = { hero_image_data_url: cachedUrl };
  }
  pendingAdminHomeVisualDataUrl = "";
  applyPublicHomeVisualSettings();
  renderAdminHomeVisualPreview();
}

function applyPublicHomeVisualSettings() {
  const screen = document.getElementById("homePhoneDisplay");
  const visual = document.getElementById("homePhoneVisual");
  const visualImg = document.getElementById("homePhoneVisualImg");
  const overlay = document.getElementById("homePhoneOverlay");
  const face = document.getElementById("homePhoneDefaultFace");
  const title = document.getElementById("homePhoneDefaultTitle");
  const subtitle = document.getElementById("homePhoneDefaultSubtitle");
  const badge = document.getElementById("homePhoneAppBadge");
  if (!screen || !visual) return;
  const url = String(publicHomeVisualSettings?.hero_image_data_url || localStorage.getItem("askcreate_public_home_visual") || "").trim();
  if (url) {
    visual.style.setProperty("--home-visual-url", `url("${url}")`);
    visual.style.backgroundImage = "none";
    if (visualImg) visualImg.src = url;
    visual.classList.remove("hidden");
    screen.classList.add("with-custom-visual");
    if (overlay) overlay.classList.add("compact-overlay");
    if (face) face.classList.add("hidden");
    if (title) title.textContent = "AskCreate.app";
    if (subtitle) subtitle.textContent = "Ulaz za teren i kancelariju";
    if (badge) badge.classList.remove("hidden");
  } else {
    visual.style.removeProperty("--home-visual-url");
    visual.style.backgroundImage = "none";
    if (visualImg) visualImg.removeAttribute("src");
    visual.classList.add("hidden");
    screen.classList.remove("with-custom-visual");
    if (overlay) overlay.classList.remove("compact-overlay");
    if (face) face.classList.remove("hidden");
    if (title) title.textContent = "AskCreate.app";
    if (subtitle) subtitle.textContent = "Digitalni ulaz za teren i kancelariju";
    if (badge) badge.classList.remove("hidden");
  }
}

function renderAdminHomeVisualPreview(url) {
  const preview = document.getElementById("adminHomeVisualPreview");
  const placeholder = document.getElementById("adminHomeVisualPlaceholder");
  const status = document.getElementById("adminHomeVisualStatus");
  if (!preview) return;
  const effective = String(url || pendingAdminHomeVisualDataUrl || publicHomeVisualSettings?.hero_image_data_url || "").trim();
  preview.style.backgroundImage = effective ? `url(${effective})` : "";
  preview.classList.toggle("has-image", !!effective);
  if (placeholder) placeholder.classList.toggle("hidden", !!effective);
  if (status) status.textContent = effective ? "Nova početna slika je spremna. Klikni Sačuvaj sliku da postane javna." : "Ako ne dodaš sliku, na početnoj ostaje namigujući smajli.";
}

async function resizeImageFileToDataUrl(file, maxWidth = 900, quality = 0.82) {
  if (!file) return "";
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = img.width > maxWidth ? maxWidth / img.width : 1;
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * ratio));
        canvas.height = Math.max(1, Math.round(img.height * ratio));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Slika nije ispravna."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Čitanje slike nije uspelo."));
    reader.readAsDataURL(file);
  });
}


const DEFECT_IMAGES_MAX = 5;
let defectImagesDraft = [];
let defectSubmitBusy = false;

function makeDefectImageId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return "defimg_" + window.crypto.randomUUID();
  }
  return "defimg_" + Date.now() + "_" + Math.random().toString(16).slice(2, 8);
}

function normalizeDefectImages(dataOrReport = {}) {
  const d = dataOrReport?.data || dataOrReport || {};
  const raw = d.defect_images || d.defectImages || d.defect_photos || d.defectPhotos || d.defect_images_json || [];
  let list = raw;
  if (typeof list === "string") {
    try { list = JSON.parse(list); } catch (_) { list = list.trim() ? [list] : []; }
  }
  if (!Array.isArray(list)) list = [];
  return list
    .map((img, index) => {
      if (!img) return null;
      if (typeof img === "string") {
        return { id: `defimg_legacy_${index}`, name: `Slika ${index + 1}`, type: "image/jpeg", size: "", data_url: img, created_at: "" };
      }
      const dataUrl = img.data_url || img.dataUrl || img.url || img.src || "";
      if (!dataUrl) return null;
      return {
        id: String(img.id || `defimg_legacy_${index}`),
        name: String(img.name || img.filename || `Slika ${index + 1}`),
        type: String(img.type || "image/jpeg"),
        size: img.size || "",
        data_url: dataUrl,
        created_at: img.created_at || img.createdAt || ""
      };
    })
    .filter(Boolean)
    .slice(0, DEFECT_IMAGES_MAX);
}

function defectImagesPayload() {
  return normalizeDefectImages({ defect_images: defectImagesDraft });
}

function renderDefectImagesPreview() {
  const box = document.getElementById("wrDefectImagesPreview");
  const count = document.getElementById("wrDefectImagesCount");
  if (count) count.textContent = `${defectImagesDraft.length}/${DEFECT_IMAGES_MAX} slika`;
  if (!box) return;
  if (!defectImagesDraft.length) {
    box.innerHTML = `<p class="muted tiny">Nema dodatih slika kvara.</p>`;
    return;
  }
  box.innerHTML = defectImagesDraft.map((img, index) => `
    <div class="defect-image-preview-card" data-defect-image-id="${escapeHtml(img.id)}">
      <img src="${escapeHtml(img.data_url)}" alt="Slika kvara ${index + 1}" loading="lazy" />
      <div class="defect-image-preview-meta">
        <span>${escapeHtml(img.name || `Slika ${index + 1}`)}</span>
        <button class="delete-btn small-action" type="button" onclick="removeDefectImageDraft('${escapeHtml(img.id)}')">Obriši</button>
      </div>
    </div>
  `).join("");
}

function clearDefectImagesDraft() {
  defectImagesDraft = [];
  const input = document.getElementById("wrDefectImages");
  if (input) input.value = "";
  renderDefectImagesPreview();
}

function removeDefectImageDraft(id) {
  defectImagesDraft = defectImagesDraft.filter(img => String(img.id) !== String(id));
  const input = document.getElementById("wrDefectImages");
  if (input) input.value = "";
  renderDefectImagesPreview();
}
window.removeDefectImageDraft = removeDefectImageDraft;

async function handleDefectImagesInput(event) {
  try {
    const input = event?.target || document.getElementById("wrDefectImages");
    const files = Array.from(input?.files || []);
    if (!files.length) return;
    const slots = DEFECT_IMAGES_MAX - defectImagesDraft.length;
    if (slots <= 0) {
      toast(`Može najviše ${DEFECT_IMAGES_MAX} slika po kvaru.`, true);
      if (input) input.value = "";
      return;
    }
    const selected = files.slice(0, slots);
    for (const file of selected) {
      if (!String(file.type || "").startsWith("image/")) {
        toast("Preskačem fajl koji nije slika.", true);
        continue;
      }
      const dataUrl = await resizeImageFileToDataUrl(file, 1000, 0.76);
      defectImagesDraft.push({
        id: makeDefectImageId(),
        name: file.name || "slika-kvara.jpg",
        type: "image/jpeg",
        size: file.size || "",
        data_url: dataUrl,
        created_at: new Date().toISOString()
      });
    }
    if (files.length > selected.length) toast(`Dodato je ${selected.length}. Maksimalno je ${DEFECT_IMAGES_MAX} slika.`, true);
    if (input) input.value = "";
    renderDefectImagesPreview();
  } catch (e) {
    toast(e.message || "Dodavanje slike nije uspelo.", true);
  }
}

function openDefectImageViewer(src, title = "Slika kvara") {
  if (!src) return;
  let modal = document.getElementById("defectImageViewerModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "defectImageViewerModal";
    modal.className = "defect-image-viewer-modal hidden";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="defect-image-viewer-backdrop" onclick="closeDefectImageViewer()"></div>
      <div class="defect-image-viewer-dialog" role="dialog" aria-modal="true" aria-label="Uvećana slika kvara">
        <div class="defect-image-viewer-top">
          <strong id="defectImageViewerTitle">Slika kvara</strong>
          <button class="secondary small-action" type="button" onclick="closeDefectImageViewer()">Zatvori</button>
        </div>
        <div class="defect-image-viewer-body">
          <img id="defectImageViewerImg" alt="Uvećana slika kvara" />
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  const img = document.getElementById("defectImageViewerImg");
  const ttl = document.getElementById("defectImageViewerTitle");
  if (img) img.src = src;
  if (ttl) ttl.textContent = title || "Slika kvara";
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("defect-image-viewer-open");
}
window.openDefectImageViewer = openDefectImageViewer;

function closeDefectImageViewer() {
  const modal = document.getElementById("defectImageViewerModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }
  document.body.classList.remove("defect-image-viewer-open");
}
window.closeDefectImageViewer = closeDefectImageViewer;

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDefectImageViewer();
});

function defectImagesHtml(dataOrReport = {}, options = {}) {
  const images = normalizeDefectImages(dataOrReport);
  if (!images.length) return "";
  const title = options.title || "Fotografije kvara";
  const safeTitle = escapeHtml(title);
  return `<div class="defect-images-block ${options.compact ? "defect-images-compact" : ""}">
    <h5>${safeTitle} <span>${images.length}</span></h5>
    <div class="defect-images-grid">
      ${images.map((img, index) => {
        const src = escapeHtml(img.data_url);
        const imageTitle = `${title} ${index + 1}`;
        return `<button class="defect-image-link defect-image-zoom-btn" type="button" onclick="openDefectImageViewer('${src}', '${escapeHtml(imageTitle)}')" title="Klikni za uvećanje slike">
          <img src="${src}" alt="Slika kvara ${index + 1}" loading="lazy" />
          <span class="defect-image-zoom-label no-print">Uvećaj</span>
        </button>`;
      }).join("")}
    </div>
  </div>`;
}


function makeDefectTimelineEvent(status, actorName = "", actorRole = "", note = "") {
  const nowIso = new Date().toISOString();
  return {
    id: `defevt_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    status: String(status || "").trim(),
    label: defectStatusHumanLabel(status),
    actor_name: actorName || "—",
    actor_role: actorRole || "—",
    note: note || "",
    at: nowIso
  };
}

function normalizeDefectTimeline(dataOrReport = {}) {
  const d = dataOrReport?.data || dataOrReport || {};
  const raw = d.defect_timeline || d.defect_history || d.mechanic_history || [];
  const map = new Map();
  const push = (item) => {
    if (!item) return;
    const at = item.at || item.created_at || item.time || item.date || item.updated_at;
    const status = item.status || item.action || item.label || "promena";
    const key = String(item.id || `${status}_${at}_${item.actor_name || item.by || ""}`);
    if (map.has(key)) return;
    map.set(key, {
      id: item.id || key,
      status,
      label: item.label || defectStatusHumanLabel(status),
      actor_name: item.actor_name || item.by || item.user || item.worker || "—",
      actor_role: item.actor_role || item.role || "—",
      note: item.note || item.comment || "",
      at
    });
  };
  (Array.isArray(raw) ? raw : []).forEach(push);

  if (d.defect_reported_at) push({ id: "reported", status: "prijavljen", label: "Kvar prijavljen", actor_name: d.created_by_worker || d.reporter_name || "Radnik", actor_role: d.function_title || "Radnik", at: d.defect_reported_at, note: d.defect || "" });
  if (d.defect_received_at) push({ id: "received", status: "preuzeto", label: "Kvar preuzet / primljen", actor_name: d.defect_received_by || d.mechanic_updated_by || "Šef mehanizacije", actor_role: d.defect_received_role || "Šef mehanizacije", at: d.defect_received_at });
  if (d.defect_repair_started_at) push({ id: "repair_started", status: "u_radu", label: "Popravka započeta", actor_name: d.defect_repair_started_by || d.mechanic_updated_by || "Šef mehanizacije", actor_role: d.defect_repair_started_role || "Šef mehanizacije", at: d.defect_repair_started_at });
  if (d.defect_resolved_at) push({ id: "resolved", status: "reseno", label: "Kvar popravljen / rešen", actor_name: d.defect_resolved_by || d.mechanic_updated_by || "Šef mehanizacije", actor_role: d.defect_resolved_role || "Šef mehanizacije", at: d.defect_resolved_at });
  if (d.mechanic_note_at && d.mechanic_note) push({ id: `note_${d.mechanic_note_at}`, status: "napomena", label: "Napomena šefa mehanizacije", actor_name: d.mechanic_note_by || d.mechanic_updated_by || "Šef mehanizacije", actor_role: "Šef mehanizacije", at: d.mechanic_note_at, note: d.mechanic_note });

  return Array.from(map.values())
    .filter(x => x.at || x.label || x.status)
    .sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
}

function appendDefectTimelineEvent(d, event) {
  const list = normalizeDefectTimeline(d).filter(x => !String(x.id || "").startsWith("reported") && !["received", "repair_started", "resolved"].includes(String(x.id || "")));
  const next = event || null;
  if (next) list.push(next);
  d.defect_timeline = list;
  d.defect_history = list;
  return d;
}

function defectTimelineHtml(dataOrReport = {}, options = {}) {
  const events = normalizeDefectTimeline(dataOrReport);
  if (!events.length) return "";
  return `<div class="defect-timeline-block ${options.compact ? "defect-timeline-compact" : ""}">
    <h5>🕒 Tok kvara / dnevnik promena</h5>
    <div class="defect-timeline-list">
      ${events.map(ev => `<div class="defect-timeline-item">
        <b>${escapeHtml(ev.label || defectStatusHumanLabel(ev.status))}</b>
        <span>${escapeHtml(formatDateTimeLocal(ev.at) || ev.at || "—")}</span>
        <small>${escapeHtml([ev.actor_role, ev.actor_name].filter(Boolean).join(" · ") || "—")}</small>
        ${ev.note ? `<em>${escapeHtml(ev.note)}</em>` : ""}
      </div>`).join("")}
    </div>
  </div>`;
}

async function handleAdminHomeVisualFileChange(e) {
  try {
    const file = e?.target?.files?.[0];
    if (!file) {
      pendingAdminHomeVisualDataUrl = "";
      renderAdminHomeVisualPreview();
      return;
    }
    if (!String(file.type || "").startsWith("image/")) throw new Error("Dodaj sliku u JPG, PNG ili WEBP formatu.");
    if (file.size > 6 * 1024 * 1024) throw new Error("Slika je prevelika. Maksimum je oko 6 MB pre obrade.");
    pendingAdminHomeVisualDataUrl = await resizeImageFileToDataUrl(file, 900, 0.82);
    renderAdminHomeVisualPreview(pendingAdminHomeVisualDataUrl);
    toast("Slika je učitana. Klikni Sačuvaj sliku.");
  } catch (e2) {
    pendingAdminHomeVisualDataUrl = "";
    renderAdminHomeVisualPreview();
    toast(e2.message || e2, true);
  }
}

async function saveAdminHomeVisualSettings() {
  try {
    await ensureAdmin();
    const payloadUrl = String(pendingAdminHomeVisualDataUrl || publicHomeVisualSettings?.hero_image_data_url || "").trim();
    if (!pendingAdminHomeVisualDataUrl && !payloadUrl) throw new Error("Prvo dodaj sliku za početnu stranu.");
    const payload = { id: 1, hero_image_data_url: payloadUrl, updated_at: new Date().toISOString() };
    const { error } = await sb.from("public_home_settings").upsert(payload, { onConflict: "id" });
    if (error) throw error;
    publicHomeVisualSettings = { hero_image_data_url: payloadUrl };
    localStorage.setItem("askcreate_public_home_visual", payloadUrl);
    pendingAdminHomeVisualDataUrl = "";
    applyPublicHomeVisualSettings();
    renderAdminHomeVisualPreview();
    const fileInput = document.getElementById("adminHomeVisualFile");
    if (fileInput) fileInput.value = "";
    toast("Početna slika telefona je sačuvana.");
  } catch (e) {
    const msg = String(e?.message || e || "");
    if (/public_home_settings/i.test(msg) || /relation/i.test(msg) || /does not exist/i.test(msg)) {
      toast("Treba prvo dodati SQL tabelu public_home_settings u Supabase. Poslaću ti SQL u poruci.", true);
    } else {
      toast(msg, true);
    }
  }
}

async function removeAdminHomeVisualSettings() {
  try {
    await ensureAdmin();
    const { error } = await sb.from("public_home_settings").upsert({ id: 1, hero_image_data_url: "", updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) throw error;
    publicHomeVisualSettings = { hero_image_data_url: "" };
    localStorage.removeItem("askcreate_public_home_visual");
    pendingAdminHomeVisualDataUrl = "";
    applyPublicHomeVisualSettings();
    renderAdminHomeVisualPreview();
    const fileInput = document.getElementById("adminHomeVisualFile");
    if (fileInput) fileInput.value = "";
    toast("Početna slika je uklonjena. Vraćen je smajli prikaz.");
  } catch (e) {
    const msg = String(e?.message || e || "");
    if (/public_home_settings/i.test(msg) || /relation/i.test(msg) || /does not exist/i.test(msg)) {
      toast("Treba prvo dodati SQL tabelu public_home_settings u Supabase. Poslaću ti SQL u poruci.", true);
    } else {
      toast(msg, true);
    }
  }
}


function setAdminCompanyCodeStatus(message, type = "info") {
  const el = $("#adminCompanyCodeStatus");
  const input = $("#acCompanyCode");
  if (el) {
    el.textContent = message || "";
    el.classList.remove("code-ok", "code-bad", "code-info");
    el.classList.add(type === "ok" ? "code-ok" : type === "bad" ? "code-bad" : "code-info");
  }
  if (input) {
    input.classList.remove("code-ok-input", "code-bad-input", "code-info-input");
    input.classList.add(type === "ok" ? "code-ok-input" : type === "bad" ? "code-bad-input" : "code-info-input");
  }
}

async function findDuplicateCompanyCode(rawCode) {
  const normalized = normalizeLoginCode(rawCode);
  if (!normalized) return null;
  if (!initSupabase()) return null;

  const [approvedRes, companiesRes] = await Promise.all([
    sb.from("approved_companies").select("id, company_name, approved_email, company_code").limit(5000),
    sb.from("companies").select("id, name, owner_email, company_code").limit(5000)
  ]);

  if (approvedRes.error) throw approvedRes.error;
  if (companiesRes.error) throw companiesRes.error;

  const approved = (approvedRes.data || []).find(c => normalizeLoginCode(c.company_code) === normalized);
  if (approved) {
    return {
      table: "approved_companies",
      id: approved.id,
      company_code: approved.company_code,
      name: approved.company_name || approved.approved_email || "firma u Admin CRM"
    };
  }

  const company = (companiesRes.data || []).find(c => normalizeLoginCode(c.company_code) === normalized);
  if (company) {
    return {
      table: "companies",
      id: company.id,
      company_code: company.company_code,
      name: company.name || company.owner_email || "registrovana firma"
    };
  }

  return null;
}

async function checkAdminCompanyCodeAvailability(showOk = true) {
  const input = $("#acCompanyCode");
  if (!input) return false;
  const raw = input.value || "";
  const normalized = normalizeLoginCode(raw);
  if (!normalized) {
    setAdminCompanyCodeStatus("Upiši šifru firme. Mora biti jedinstvena u celoj aplikaciji.", "info");
    return false;
  }
  if (normalized.length < 3) {
    setAdminCompanyCodeStatus("Šifra firme je prekratka. Koristi najmanje 3 karaktera.", "bad");
    return false;
  }

  try {
    setAdminCompanyCodeStatus("Proveravam da li je šifra firme slobodna...", "info");
    const duplicate = await findDuplicateCompanyCode(raw);
    if (duplicate) {
      setAdminCompanyCodeStatus(`Zauzeto: šifra već pripada firmi "${duplicate.name}". Unesi drugi kod.`, "bad");
      return false;
    }
    if (showOk) setAdminCompanyCodeStatus("Zeleno: šifra firme je slobodna i može se koristiti.", "ok");
    return true;
  } catch (e) {
    setAdminCompanyCodeStatus("Ne mogu proveriti šifru firme. Proveri vezu/Supabase pa pokušaj ponovo.", "bad");
    return false;
  }
}

function scheduleAdminCompanyCodeAvailabilityCheck() {
  clearTimeout(adminCompanyCodeCheckTimer);
  setAdminCompanyCodeStatus("Proveravam šifru firme...", "info");
  adminCompanyCodeCheckTimer = setTimeout(() => {
    checkAdminCompanyCodeAvailability(true).catch(() => {
      setAdminCompanyCodeStatus("Provera šifre firme nije uspela.", "bad");
    });
  }, 450);
}

function todayDateOnly() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDateOnly(value) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateSchool(value) {
  if (!value) return "nije upisano";
  const d = parseDateOnly(value);
  if (!d) return String(value);
  return d.toLocaleDateString("sr-RS", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function daysUntilDate(value) {
  const d = parseDateOnly(value);
  if (!d) return null;
  return Math.ceil((d.getTime() - todayDateOnly().getTime()) / 86400000);
}

function getCompanyPaidUntil(c) {
  return c?.paid_until || c?.trial_until || null;
}

function getCompanyPaidFrom(c) {
  return c?.paid_from || c?.created_at?.slice?.(0, 10) || null;
}

function getCompanyStatusInfo(c) {
  const rawStatus = String(c?.status || "trial").toLowerCase();
  if (rawStatus === "blocked") return { label: "Blokirano", cls: "bad", days: daysUntilDate(getCompanyPaidUntil(c)) };
  if (rawStatus === "deleted") return { label: "Obrisano", cls: "bad", days: daysUntilDate(getCompanyPaidUntil(c)) };
  const days = daysUntilDate(getCompanyPaidUntil(c));
  if (days === null) return { label: "Bez datuma", cls: "neutral", days };
  if (days < 0) return { label: `Isteklo pre ${Math.abs(days)} dana`, cls: "bad", days };
  if (days <= 10) return { label: `Ističe za ${days} dana`, cls: "warn", days };
  return { label: `Aktivno još ${days} dana`, cls: "good", days };
}

function isCompanyExpiringSoon(c) {
  const info = getCompanyStatusInfo(c);
  return info.days !== null && info.days >= 0 && info.days <= 10 && String(c?.status || "").toLowerCase() !== "blocked";
}

function adminCompanySearchText(c) {
  return [
    c.company_name, c.name, c.approved_email, c.owner_email, c.company_code,
    c.invite_code, c.contact_name, c.contact_phone, c.phone, c.status, c.plan, c.note
  ].filter(Boolean).join(" ").toLowerCase();
}

function normalizeWhatsappPhone(phone) {
  let p = String(phone || "").trim();
  if (!p) return "";
  p = p.replace(/[^\d+]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (p.startsWith("0")) p = "+381" + p.slice(1);
  if (p.startsWith("+")) p = p.slice(1);
  return p;
}


function getAppPublicBaseUrl() {
  const url = new URL(window.location.href);
  let path = url.pathname || "/";
  path = path.replace(/index\.html$/i, "");
  if (!path.endsWith("/")) path = path.slice(0, path.lastIndexOf("/") + 1) || "/";
  return `${url.origin}${path}`;
}

function buildWorkerCompanyLink(companyCode) {
  const url = new URL(getAppPublicBaseUrl());
  url.searchParams.set("ulaz", "radnik");
  url.searchParams.set("firma", String(companyCode || "").trim());
  return url.toString();
}

function buildMechanicCompanyLink(companyCode) {
  const url = new URL(getAppPublicBaseUrl());
  url.searchParams.set("ulaz", "mehanika");
  url.searchParams.set("firma", String(companyCode || "").trim());
  return url.toString();
}

function buildWorkerPersonalLink(person = {}, mode = "worker") {
  const companyCode = String(currentCompany?.company_code || currentCompany?.code || person.company_code || "").trim();
  const accessCode = String(person?.access_code || "").trim();
  const url = new URL(getAppPublicBaseUrl());
  url.searchParams.set("ulaz", mode === "mechanic" ? "mehanika" : "radnik");
  if (companyCode) url.searchParams.set("firma", companyCode);
  if (accessCode) url.searchParams.set("kod", accessCode);
  if (person?.id) url.searchParams.set("osoba", String(person.id));
  return url.toString();
}

function findDirectorPersonById(personId) {
  return (directorPeopleCache || []).find(p => String(p.id) === String(personId)) || null;
}

async function copyDirectorPersonLink(personId, mode = "worker") {
  const p = findDirectorPersonById(personId);
  if (!p) return toast("Zaposleni nije pronađen.", true);
  const link = buildWorkerPersonalLink(p, mode);
  try {
    await navigator.clipboard.writeText(link);
    toast(mode === "mechanic" ? "Link šefa mehanizacije je kopiran." : "Radnički link je kopiran.");
  } catch (e) {
    window.prompt(mode === "mechanic" ? "Kopiraj link šefa mehanizacije:" : "Kopiraj radnički link:", link);
  }
}

function openDirectorPersonLink(personId, mode = "worker") {
  const p = findDirectorPersonById(personId);
  if (!p) return toast("Zaposleni nije pronađen.", true);
  window.open(buildWorkerPersonalLink(p, mode), "_blank", "noopener");
}

window.copyDirectorPersonLink = copyDirectorPersonLink;
window.openDirectorPersonLink = openDirectorPersonLink;

function getWorkerEntryModeFromUrl() {
  const params = new URLSearchParams(window.location.search || "");
  const mode = String(params.get("ulaz") || "").toLowerCase();
  return mode === "mehanika" || mode === "sef_mehanizacije" || mode === "mechanic" ? "mechanic" : "worker";
}

function isMechanicEntryMode() {
  return localStorage.getItem("swp_worker_entry_mode") === "mechanic" || getWorkerEntryModeFromUrl() === "mechanic";
}

function buildCompanyQrImageUrl(link, size = 380) {
  const cleanSize = Math.max(220, Math.min(600, Number(size) || 380));
  return `https://api.qrserver.com/v1/create-qr-code/?size=${cleanSize}x${cleanSize}&margin=12&data=${encodeURIComponent(link)}`;
}

function getWorkerCompanyCodeFromUrl() {
  const params = new URLSearchParams(window.location.search || "");
  return String(params.get("firma") || params.get("sw_company") || params.get("company") || params.get("company_code") || "").trim();
}

function getWorkerAccessCodeFromUrl() {
  const params = new URLSearchParams(window.location.search || "");
  return String(params.get("kod") || params.get("code") || params.get("access_code") || params.get("radnik") || "").trim();
}

function getWorkerPersonIdFromUrl() {
  const params = new URLSearchParams(window.location.search || "");
  return String(params.get("osoba") || params.get("person") || params.get("person_id") || params.get("user_id") || "").trim();
}

function applyWorkerAccessCodeFromUrl() {
  const code = getWorkerAccessCodeFromUrl();
  const input = document.getElementById("workerAccessCode");
  if (code && input) {
    input.value = code;
    input.classList.add("locked-company-code");
  }
  return !!code;
}

function isWorkerQrEntrance() {
  const params = new URLSearchParams(window.location.search || "");
  return String(params.get("ulaz") || params.get("entry") || "").toLowerCase() === "radnik" || !!getWorkerCompanyCodeFromUrl();
}

function isAppInstalledMode() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

function getSavedWorkerCompanyCode() {
  return String(localStorage.getItem("swp_worker_company_code") || "").trim();
}

function setWorkerLoginModeLocked(isLocked) {
  document.body.classList.toggle("worker-company-locked", !!isLocked);
  document.body.classList.toggle("worker-code-only-mode", !!isLocked);
  const card = document.querySelector("#viewWorkerLogin .card");
  if (card) card.classList.toggle("worker-company-locked-card", !!isLocked);
  const title = document.getElementById("workerLoginTitle");
  const codeLabel = document.getElementById("workerAccessCodeLabel");
  const help = document.getElementById("workerLoginHelpBox");
  if (title) title.textContent = isLocked ? "Radnički ulaz" : "Terenski radni unos";
  if (codeLabel) codeLabel.textContent = isLocked ? "Pristupni kod zaposlenog" : "Pristupni kod zaposlenog";
  if (help) {
    help.innerHTML = isLocked
      ? `<b>Pristupni kod zaposlenog:</b><span>Upišite samo kod koji vam je dodelila Uprava firme.</span>`
      : `<b>Prijava zaposlenog:</b><span>Zaposleni ulazi sa šifrom firme + svojim kodom. Kod zaposlenog važi samo unutar ove firme.</span>`;
  }
}

function updateWorkerInstallBox() {
  const box = document.getElementById("workerInstallBox");
  const hint = document.getElementById("workerInstallHint");
  if (!box) return;
  const lockedToCompany = !!(getWorkerCompanyCodeFromUrl() || getSavedWorkerCompanyCode() || document.body.classList.contains("worker-company-locked"));
  // Svaki radnik na početku vidi "Preuzmi app", a ako je firma već učitana preko QR koda,
  // poruka se prilagođava toj firmi. Ako je app već instalirana kao PWA, nema potrebe da box stoji.
  if (!isAppInstalledMode()) {
    box.classList.remove("hidden");
    if (hint) {
      hint.textContent = lockedToCompany
        ? "Posle dodavanja na telefon, zaposleni otvara ikonicu i vidi samo unos svog koda."
        : "Preporuka je da svaki radnik preuzme app na svoj telefon radi bržeg ulaza u posao.";
    }
  } else {
    box.classList.add("hidden");
  }
}

function waitForPwaInstallPrompt(timeoutMs = 2200) {
  if (deferredPwaInstallPrompt) return Promise.resolve(deferredPwaInstallPrompt);
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (deferredPwaInstallPrompt || Date.now() - started >= timeoutMs) {
        clearInterval(timer);
        resolve(deferredPwaInstallPrompt || null);
      }
    }, 120);
  });
}

async function ensurePwaInstallReady() {
  if (!window.isSecureContext && location.hostname !== "localhost") {
    throw new Error("PWA instalacija radi samo preko HTTPS veze. Proveri da li je adresa https://askcreate.app.");
  }
  if ("serviceWorker" in navigator) {
    try {
      const reg = await registerAskCreateServiceWorker(true);
      try { await navigator.serviceWorker.ready; } catch {}
      return reg;
    } catch (e) {
      console.warn("AskCreate PWA SW register failed", e);
    }
  }
  return null;
}

function showInstallFallbackInstructions() {
  const ua = navigator.userAgent || "";
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);

  if (isAppInstalledMode()) {
    alert("AskCreate.app je već otvoren kao instalirana aplikacija / prečica. Ako želiš novu ikonicu, obriši staru prečicu pa instaliraj ponovo.");
    return;
  }

  if (isIos) {
    alert(`iPhone/iPad ne dozvoljava automatsko instaliranje iz dugmeta.

Uradi ovako:
1. Otvori askcreate.app u Safari browseru.
2. Dodirni Share / Podeli.
3. Izaberi Add to Home Screen / Dodaj na početni ekran.
4. Potvrdi Add / Dodaj.

Posle toga se pojavljuje AskCreate ikonica na telefonu.`);
    return;
  }

  if (isAndroid) {
    alert(`Ako se prozor za instalaciju nije otvorio automatski:

1. U Chrome-u dodirni meni ⋮ gore desno.
2. Izaberi Install app / Instaliraj aplikaciju ili Add to Home screen.
3. Potvrdi Install / Dodaj.

Ako ne vidiš tu opciju, osveži stranicu pa opet klikni Preuzmi app.`);
    return;
  }

  alert(`Ako se instalacija nije otvorila automatski na laptopu:

CHROME / EDGE:
1. Klikni meni ⋮ gore desno.
2. Izaberi Cast, save and share / Sačuvaj i deli.
3. Klikni Install AskCreate.app / Instaliraj AskCreate.app.

Ako nema Install:
1. Klikni meni ⋮.
2. More tools / Još alatki.
3. Create shortcut / Napravi prečicu.
4. Uključi Open as window / Otvori kao prozor.
5. Klikni Create / Napravi.`);
}


async function installWorkerApp() {
  try {
    toast("Pripremam instalaciju aplikacije...");
    await ensurePwaInstallReady();

    // Browser ne dozvoljava sajtu da sam napravi prečicu bez install prompt-a.
    // Zato ovde maksimalno čekamo pravi Chrome/Edge PWA prompt pre fallback poruke.
    const prompt = deferredPwaInstallPrompt || await waitForPwaInstallPrompt(8500);
    if (prompt) {
      prompt.prompt();
      const choice = await prompt.userChoice;
      deferredPwaInstallPrompt = null;
      localStorage.removeItem("askcreate_install_retry_done");
      updateWorkerInstallBox();
      if (choice?.outcome === "accepted") return toast("AskCreate.app prečica je dodata.");
      return toast("Instalacija nije završena. Možeš probati ponovo.", true);
    }

    // Ako prompt nije stigao, jednom automatski osvežavamo stranicu u install modu.
    // Često Chrome tek posle registracije Service Worker-a pusti beforeinstallprompt.
    const alreadyRetried = localStorage.getItem("askcreate_install_retry_done") === "1";
    if (!alreadyRetried && !isAppInstalledMode()) {
      localStorage.setItem("askcreate_install_retry_done", "1");
      toast("Osvežavam instalacioni režim...");
      const url = new URL(window.location.href);
      url.searchParams.set("install", "1");
      url.searchParams.set("v", "1410");
      url.searchParams.set("t", Date.now().toString());
      setTimeout(() => { window.location.href = url.toString(); }, 650);
      return;
    }

    localStorage.removeItem("askcreate_install_retry_done");
    showInstallFallbackInstructions();
  } catch (e) {
    localStorage.removeItem("askcreate_install_retry_done");
    toast("Instalacija nije uspela: " + (e?.message || e), true);
    showInstallFallbackInstructions();
  }
}


window.installWorkerApp = installWorkerApp;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPwaInstallPrompt = event;
  pwaInstallPromptReadyAt = Date.now();
  updateWorkerInstallBox();
});

window.addEventListener("appinstalled", () => {
  deferredPwaInstallPrompt = null;
  updateWorkerInstallBox();
  toast("AskCreate.app je dodat kao app prečica.");
});

function setWorkerCompanyQrContext(companyCode, source = "saved") {
  const code = String(companyCode || "").trim();
  const input = $("#workerCompanyCode");
  const notice = $("#workerCompanyQrNotice");
  if (!input) return false;
  if (!code) {
    input.readOnly = false;
    input.classList.remove("locked-company-code");
    setWorkerLoginModeLocked(false);
    updateWorkerInstallBox();
    if (notice) notice.classList.add("hidden");
    return false;
  }
  input.value = code;
  input.readOnly = true;
  input.classList.add("locked-company-code");
  localStorage.setItem("swp_worker_company_code", code);
  setWorkerLoginModeLocked(true);
  updateWorkerInstallBox();
  if (notice) {
    notice.classList.remove("hidden");
    const strong = notice.querySelector("strong");
    if (strong) strong.textContent = source === "qr" ? "Firma je učitana preko QR koda." : "Firma je zapamćena na ovom uređaju.";
  }
  return true;
}

function applyWorkerCompanyContextFromUrlOrStorage() {
  const fromUrl = getWorkerCompanyCodeFromUrl();
  applyWorkerAccessCodeFromUrl();
  if (fromUrl) {
    localStorage.setItem("swp_worker_company_code", fromUrl);
    localStorage.setItem("swp_worker_entry_mode", getWorkerEntryModeFromUrl() === "mechanic" ? "mechanic" : "worker");
    updateWorkerEntryModeUi();
    return setWorkerCompanyQrContext(fromUrl, "qr");
  }
  const saved = localStorage.getItem("swp_worker_company_code") || "";
  return setWorkerCompanyQrContext(saved, "saved");
}

function updateWorkerEntryModeUi() {
  const isMechanic = isMechanicEntryMode();
  document.body.classList.toggle("mechanic-worker-entry", isMechanic);
  const keep = $("#workerKeepLogin")?.closest(".keep-login-option");
  if (keep) keep.classList.toggle("hidden", !isMechanic);
  const help = $("#workerLoginHelpBox");
  if (help) {
    help.innerHTML = isMechanic
      ? `<b>Prijava šefa mehanizacije:</b><span>Ovaj ulaz je samo za osobu kojoj je Uprava štiklirala “Šef mehanizacije”. Ako običan radnik unese kod, app ga NE pušta u panel kvarova.</span>`
      : `<b>Prijava zaposlenog:</b><span>Zaposleni ulazi preko QR koda firme + svojim pristupnim kodom. Kod zaposlenog mora biti jedinstven u celoj aplikaciji.</span>`;
  }
}

window.clearWorkerCompanyQrContext = () => {
  localStorage.removeItem("swp_worker_company_code");
  localStorage.removeItem("swp_worker_entry_mode");
  const input = $("#workerCompanyCode");
  if (input) {
    input.readOnly = false;
    input.classList.remove("locked-company-code");
    input.value = "";
    input.focus();
  }
  setWorkerLoginModeLocked(false);
  document.body.classList.remove("worker-code-only-mode");
  updateWorkerInstallBox();
  const notice = $("#workerCompanyQrNotice");
  if (notice) notice.classList.add("hidden");
  toast("Firma je sklonjena. Sada možeš ručno upisati drugu šifru firme.");
};

function openCompanyQrModal(companyName, companyCode, source = "admin", target = "worker") {
  const code = String(companyCode || "").trim();
  if (!code) return toast("Ova firma nema šifru firme, pa QR kod ne može da se napravi.", true);
  const name = companyName || "Firma";
  const isMechanicQr = target === "mechanic";
  const link = isMechanicQr ? buildMechanicCompanyLink(code) : buildWorkerCompanyLink(code);
  const modal = $("#companyQrModal");
  if (!modal) return toast("Prozor za QR kod nije pronađen.", true);
  const title = $("#companyQrTitle");
  const subtitle = $("#companyQrSubtitle");
  const kicker = $("#companyQrKicker");
  const img = $("#companyQrImage");
  const nameEl = $("#companyQrCompanyName");
  const codeEl = $("#companyQrCompanyCode");
  const linkInput = $("#companyQrLink");
  if (kicker) kicker.textContent = isMechanicQr ? "QR kod za šefa mehanizacije" : (source === "director" ? "QR kod za zaposlene ove firme" : "Admin QR kod za zaposlene");
  if (title) title.textContent = `${isMechanicQr ? "Ulaz šefa mehanizacije" : "Radnički ulaz"} · ${name}`;
  if (subtitle) subtitle.textContent = isMechanicQr
    ? "Ovaj QR se daje samo osobi kojoj je u Upravi štiklirano: Šef mehanizacije. Bez te dozvole običan radnik ne može otvoriti panel kvarova."
    : "Zaposleni skenira QR kod, preuzme app kao prečicu, a zatim upisuje samo svoj pristupni kod zaposlenog.";
  if (img) img.src = buildCompanyQrImageUrl(link, 420);
  if (nameEl) nameEl.textContent = name;
  if (codeEl) codeEl.textContent = code;
  if (linkInput) linkInput.value = link;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

window.closeCompanyQrModal = () => {
  const modal = $("#companyQrModal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
};

window.copyCompanyWorkerLinkFromModal = async () => {
  const input = $("#companyQrLink");
  const link = input?.value || "";
  if (!link) return toast("Link nije pronađen.", true);
  try {
    await navigator.clipboard.writeText(link);
    toast("Link za zaposlene je kopiran.");
  } catch (e) {
    window.prompt("Kopiraj link za zaposlene:", link);
  }
};

window.openCompanyWorkerLinkFromModal = () => {
  const link = $("#companyQrLink")?.value || "";
  if (!link) return toast("Link nije pronađen.", true);
  window.open(link, "_blank", "noopener");
};

window.downloadCompanyQrImageFromModal = () => {
  const img = $("#companyQrImage");
  if (!img?.src) return toast("QR slika nije pronađena.", true);
  const a = document.createElement("a");
  a.href = img.src;
  a.download = "askcreate-radnicki-qr.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
};

window.adminShowWorkerQr = (id) => {
  const c = findAdminCompanyById(id);
  if (!c) return toast("Firma nije pronađena.", true);
  openCompanyQrModal(adminCompanyDisplayName(c), c.company_code, "admin");
};

window.directorShowWorkerQr = () => {
  if (!currentCompany) return toast("Firma nije učitana.", true);
  openCompanyQrModal(currentCompany.name || currentCompany.company_name || "Firma", currentCompany.company_code || currentCompany.code, "director");
};

window.directorShowMechanicQr = () => {
  if (!currentCompany) return toast("Firma nije učitana.", true);
  openCompanyQrModal(currentCompany.name || currentCompany.company_name || "Firma", currentCompany.company_code || currentCompany.code, "director", "mechanic");
};

function adminMessage(c, type = "renewed") {
  const company = c.company_name || c.name || "vaša firma";
  const validUntil = formatDateSchool(getCompanyPaidUntil(c));
  const email = c.approved_email || c.owner_email || "email Uprave";
  const code = c.company_code || "šifra firme";
  const invite = c.invite_code || "aktivacioni kod";
  if (type === "expiring") {
    return `Poštovani,\n\nObaveštavamo vas da vaš AskCreate.app paket ističe za 10 dana.\n\nFirma: ${company}\nPaket važi do: ${validUntil}.\n\nDa biste nastavili korišćenje bez prekida, potrebno je produžiti paket pre navedenog datuma.\n\nZa sva pitanja možete odgovoriti na ovu poruku.\n\nAskCreate.app`;
  }
  if (type === "expired") {
    return `Poštovani,\n\nVaš AskCreate.app paket je istekao.\n\nFirma: ${company}\nPaket je važio do: ${validUntil}.\n\nMolimo vas da nas kontaktirate radi produženja paketa.\n\nAskCreate.app`;
  }
  if (type === "activation") {
    return `Poštovani,\n\nVaša firma je dodata u AskCreate.app aplikaciju.\n\nPodaci za prvu aktivaciju:\n\nLink aplikacije: https://askcreate.app\nLink za zaposlene: ${buildWorkerCompanyLink(code)}\nEmail Uprave: ${email}\nŠifra firme: ${code}\nAktivacioni kod: ${invite}\n\nPrvi korak:\n1. Otvorite aplikaciju.\n2. Kliknite na “Uprava”.\n3. Registrujte email i lozinku.\n4. Unesite šifru firme i aktivacioni kod.\n5. Kliknite “Aktiviraj firmu”.\n\nNakon aktivacije, Uprava se ubuduće prijavljuje samo preko emaila i lozinke.\n\nAskCreate.app`;
  }
  return `Poštovani,\n\nVaš AskCreate.app paket je produžen.\n\nFirma: ${company}\nPaket važi do: ${validUntil}.\n\nMožete nastaviti normalno korišćenje aplikacije.\n\nHvala na poverenju.\nAskCreate.app`;
}

function companyBrandClass(c) {
  return normalizeCompanyBrandColor(c?.brand_color || "green");
}

function renderAdminCompanyCard(c, compact = false) {
  const status = getCompanyStatusInfo(c);
  const phone = c.contact_phone || c.phone || "";
  const email = c.approved_email || c.owner_email || "";
  const name = c.company_name || c.name || "Firma";
  const messageType = status.days !== null && status.days < 0 ? "expired" : (status.days !== null && status.days <= 10 ? "expiring" : "renewed");
  return `
    <div class="item admin-company-card brand-${companyBrandClass(c)}" data-company-id="${escapeHtml(c.id || "")}">
      <div class="admin-company-main">
        <div>
          <strong>${escapeHtml(name)}</strong>
          <small>${escapeHtml(email || "bez emaila")} · ${escapeHtml(phone || "bez telefona")}</small><br/>
          <small>Kontakt: ${escapeHtml(c.contact_name || "nije upisano")} · šifra: ${escapeHtml(c.company_code || "—")} · aktivacioni kod: ${escapeHtml(c.invite_code || "—")}</small>
        </div>
        <div class="admin-company-status">
          <span class="pill ${status.cls}">${escapeHtml(status.label)}</span>
          <span class="pill">${c.registered ? "registrovana" : "čeka aktivaciju"}</span>
        </div>
      </div>
      <div class="admin-company-dates">
        <span>Važi od: <b>${escapeHtml(formatDateSchool(getCompanyPaidFrom(c)))}</b></span>
        <span>Važi do: <b>${escapeHtml(formatDateSchool(getCompanyPaidUntil(c)))}</b></span>
        <span>Paket: <b>${escapeHtml(c.plan || "trial")}</b></span>
        <span>Boja: <b>${escapeHtml(companyBrandLabel(c.brand_color))}</b></span>
      </div>
      <div class="admin-company-brand-row">
        ${companyBrandSelectHtml("approved_companies", c.id, c.brand_color)}
      </div>
      ${adminRenewPackageHtml("approved_companies", c.id, getCompanyPaidUntil(c))}
      ${c.note ? `<p class="muted admin-note">Napomena: ${escapeHtml(c.note)}</p>` : ""}
      <div class="actions admin-crm-actions">
        <button class="secondary" onclick="adminPreviewCompany('${c.id}','director')">👁️ Pogledaj firmu</button>
        <button class="secondary" onclick="adminPreviewCompany('${c.id}','worker')">👷 Pogledaj zaposlenog</button>
        <button class="secondary" onclick="adminShowWorkerQr('${c.id}')">📲 QR za zaposlene</button>
        <button class="secondary" onclick="adminCopyCompanyMessage('${c.id}','activation')">📋 Prva aktivacija</button>
        <button class="secondary" onclick="adminCopyCompanyMessage('${c.id}','${messageType}')">📋 Poruka</button>
        <button class="secondary" onclick="adminOpenWhatsApp('${c.id}','${messageType}')">💬 WhatsApp</button>
        <button class="secondary" onclick="adminOpenEmail('${c.id}','${messageType}')">📧 Email</button>
        ${compact ? "" : `<button class="secondary" onclick="adminSetApprovedStatus('${c.id}','active')">Aktiviraj</button><button class="secondary" onclick="adminSetApprovedStatus('${c.id}','blocked')">Blokiraj</button><button class="delete-btn" onclick="adminDeleteCompanyEverything('approved_companies','${c.id}')">Trajno obriši firmu</button>`}
      </div>
    </div>`;
}

function updateAdminMetrics(list) {
  const total = list.length;
  const active = list.filter(c => String(c.status || "").toLowerCase() !== "blocked").length;
  const expiring = list.filter(isCompanyExpiringSoon).length;
  const blocked = list.filter(c => String(c.status || "").toLowerCase() === "blocked").length;
  if ($("#adminMetricTotalCompanies")) $("#adminMetricTotalCompanies").textContent = total;
  if ($("#adminMetricActiveCompanies")) $("#adminMetricActiveCompanies").textContent = active;
  if ($("#adminMetricExpiringCompanies")) $("#adminMetricExpiringCompanies").textContent = expiring;
  if ($("#adminMetricBlockedCompanies")) $("#adminMetricBlockedCompanies").textContent = blocked;
}

function renderAdminCompanies(filter = "") {
  const q = String(filter || "").trim().toLowerCase();
  const list = q ? adminApprovedCompaniesCache.filter(c => adminCompanySearchText(c).includes(q)) : adminApprovedCompaniesCache;
  updateAdminMetrics(adminApprovedCompaniesCache);
  const expiring = adminApprovedCompaniesCache.filter(isCompanyExpiringSoon);
  if ($("#expiringCompaniesList")) {
    $("#expiringCompaniesList").innerHTML = expiring.map(c => renderAdminCompanyCard(c, true)).join("") || `<p class="muted">Nema firmi kojima paket ističe u narednih 10 dana.</p>`;
  }
  if ($("#approvedCompaniesList")) {
    $("#approvedCompaniesList").innerHTML = list.map(c => renderAdminCompanyCard(c)).join("") || `<p class="muted">Nema pronađenih firmi.</p>`;
  }
}

function findAdminCompanyById(id) {
  return adminApprovedCompaniesCache.find(c => String(c.id) === String(id)) || adminRegisteredCompaniesCache.find(c => String(c.id) === String(id));
}

window.adminCopyCompanyMessage = async (id, type = "renewed") => {
  const c = findAdminCompanyById(id);
  if (!c) return toast("Firma nije pronađena.", true);
  const msg = adminMessage(c, type);
  try {
    await navigator.clipboard.writeText(msg);
    toast("Poruka je kopirana. Možeš je nalepiti u WhatsApp ili email.");
  } catch(e) {
    window.prompt("Kopiraj poruku:", msg);
  }
};

window.adminOpenWhatsApp = (id, type = "renewed") => {
  const c = findAdminCompanyById(id);
  if (!c) return toast("Firma nije pronađena.", true);
  const phone = normalizeWhatsappPhone(c.contact_phone || c.phone);
  if (!phone) return toast("Nema upisan mobilni/WhatsApp broj za ovu firmu.", true);
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(adminMessage(c, type))}`;
  window.open(url, "_blank", "noopener");
};

window.adminOpenEmail = (id, type = "renewed") => {
  const c = findAdminCompanyById(id);
  if (!c) return toast("Firma nije pronađena.", true);
  const email = c.approved_email || c.owner_email;
  if (!email) return toast("Nema upisan email za ovu firmu.", true);
  const subject = type === "activation" ? "AskCreate.app - podaci za aktivaciju" : type === "expiring" ? "AskCreate.app - paket ističe uskoro" : type === "expired" ? "AskCreate.app - paket je istekao" : "AskCreate.app - paket je produžen";
  const url = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(adminMessage(c, type))}`;
  window.location.href = url;
};

async function loadApprovedCompanyForDirector(companyCode) {
  if (!companyCode) return null;
  try {
    const { data, error } = await sb.from("approved_companies").select("*").eq("company_code", companyCode).maybeSingle();
    if (error) return null;
    return data || null;
  } catch(e) {
    return null;
  }
}

function showDirectorPackageNotice(source) {
  const box = $("#directorPackageNotice");
  if (!box) return;
  const paidUntil = getCompanyPaidUntil(source);
  const status = getCompanyStatusInfo(source || {});
  if (!paidUntil || status.days === null || status.days > 10) {
    box.className = "package-notice hidden";
    box.innerHTML = "";
    return;
  }
  const expired = status.days < 0;
  box.className = `package-notice ${expired ? "danger" : "warn"}`;
  box.innerHTML = `
    <strong>${expired ? "⚠️ Vaš paket je istekao." : `⚠️ Vaš paket ističe za ${status.days} dana.`}</strong>
    <p>Paket važi do: <b>${escapeHtml(formatDateSchool(paidUntil))}</b>.</p>
    <p>Za produženje paketa kontaktirajte podršku: <b>duskomacak@gmail.com</b></p>`;
}

async function loadApprovedCompanies() {
  const { data, error } = await sb.from("approved_companies").select("*").order("created_at", { ascending:false });
  if (error) return toast(error.message, true);
  adminApprovedCompaniesCache = data || [];
  renderAdminCompanies($("#adminCompanySearch")?.value || "");
}

async function loadCompanies() {
  const { data, error } = await sb.from("companies").select("*").order("created_at", { ascending:false });
  if (error) return toast(error.message, true);
  adminRegisteredCompaniesCache = data || [];
  if ($("#companiesList")) {
    $("#companiesList").innerHTML = (data || []).map(c => {
      const status = getCompanyStatusInfo(c);
      return `
        <div class="item admin-company-card brand-${companyBrandClass(c)}">
          <div class="admin-company-main">
            <div>
              <strong>${escapeHtml(c.name)}</strong>
              <small>${escapeHtml(c.owner_email)} · šifra: ${escapeHtml(c.company_code)}</small><br/>
              <small>Važi do: ${escapeHtml(formatDateSchool(getCompanyPaidUntil(c)))} · paket: ${escapeHtml(c.plan || "—")} · boja: ${escapeHtml(companyBrandLabel(c.brand_color))}</small>
            </div>
            <div class="admin-company-status">
              <span class="pill ${status.cls}">${escapeHtml(status.label)}</span>
              <span class="pill">${escapeHtml(c.status || "active")}</span>
            </div>
          </div>
          <div class="admin-company-brand-row">
            ${companyBrandSelectHtml("companies", c.id, c.brand_color)}
          </div>
          ${adminRenewPackageHtml("companies", c.id, getCompanyPaidUntil(c))}
          <div class="actions admin-crm-actions">
            <button class="secondary" onclick="adminPreviewCompany('${c.id}','director')">👁️ Pogledaj firmu</button>
            <button class="secondary" onclick="adminPreviewCompany('${c.id}','worker')">👷 Pogledaj zaposlenog</button>
        <button class="secondary" onclick="adminShowWorkerQr('${c.id}')">📲 QR za zaposlene</button>
            <button class="secondary" onclick="adminSetCompanyStatus('${c.id}','active')">Aktiviraj</button>
            <button class="secondary" onclick="adminSetCompanyStatus('${c.id}','expired')">Označi isteklo</button>
            <button class="secondary" onclick="adminSetCompanyStatus('${c.id}','blocked')">Blokiraj</button>
            <button class="delete-btn" onclick="adminDeleteCompanyEverything('companies','${c.id}')">Trajno obriši firmu</button>
          </div>
        </div>`;
    }).join("") || `<p class="muted">Još nema registrovanih firmi.</p>`;
  }
}


window.adminSaveCompanyBrandFromButton = (btn) => {
  const row = btn?.closest?.(".admin-company-brand-row");
  const select = row?.querySelector?.("select[data-brand-table][data-brand-id]");
  if (!select) return toast("Ne mogu da pronađem izbor boje za ovu firmu.", true);
  return adminUpdateCompanyBrand(select.dataset.brandTable, select.dataset.brandId, select.value);
};

function adminBrandHex(color) {
  const brand = normalizeCompanyBrandColor(color);
  return {
    green: "#0f766e",
    darkgreen: "#065f46",
    blue: "#2563eb",
    orange: "#f97316",
    red: "#dc2626",
    purple: "#7c3aed",
    dark: "#111827"
  }[brand] || "#0f766e";
}

function adminCompanyDisplayName(c) {
  return c?.company_name || c?.name || "Firma";
}

function adminPreviewStatusHtml(c) {
  const status = getCompanyStatusInfo(c || {});
  return `<span class="pill ${escapeHtml(status.cls)}">${escapeHtml(status.label)}</span><span class="pill neutral">${escapeHtml(companyBrandLabel(c?.brand_color))}</span>`;
}

function renderAdminDirectorPreview(c) {
  const brand = normalizeCompanyBrandColor(c?.brand_color || "green");
  const color = adminBrandHex(brand);
  const name = adminCompanyDisplayName(c);
  const code = c?.company_code || "ŠIFRA";
  const paidUntil = formatDateSchool(getCompanyPaidUntil(c));
  return `
    <div class="preview-shell preview-director brand-${brand}" style="--preview-brand:${color}">
      <aside class="preview-sidebar">
        <div class="preview-logo"><span>A</span><div><b>AskCreate.app</b><small>platforma</small></div></div>
        <button>🏠 Početna / Ljudi</button>
        <button>🏗️ Gradilišta</button>
        <button>🚚 Sredstva rada</button>
        <button>📦 Materijali</button>
        <button>📄 Izveštaji</button>
        <button>⚙️ Podešavanja</button>
      </aside>
      <main class="preview-main">
        <div class="preview-topbar">
          <div>
            <small>Uprava firme</small>
            <h3>${escapeHtml(name)}</h3>
            <p>Šifra firme: <b>${escapeHtml(code)}</b> · Paket važi do: <b>${escapeHtml(paidUntil)}</b></p>
          </div>
          <div class="preview-status">${adminPreviewStatusHtml(c)}</div>
        </div>
        <div class="preview-kpis">
          <div><b>Zaposleni</b><strong>12</strong><small>primer prikaza</small></div>
          <div><b>Gradilišta</b><strong>4</strong><small>aktivna</small></div>
          <div><b>Izveštaji</b><strong>8</strong><small>za danas</small></div>
          <div><b>Gorivo</b><strong>340 L</strong><small>primer</small></div>
        </div>
        <div class="preview-grid">
          <section>
            <h4>Dnevni radni izveštaji</h4>
            <p>Uprava vidi izveštaje zaposlenog, vraća na ispravku, odobrava i izvozi Excel.</p>
            <div class="preview-table-row"><span>Bagerista</span><b>Novo</b></div>
            <div class="preview-table-row"><span>Ime i prezime vozača kipera</span><b>Odobreno</b></div>
            <div class="preview-table-row"><span>Kvar mašine</span><b>Za proveru</b></div>
          </section>
          <section>
            <h4>Povezanost sa Adminom</h4>
            <p>Admin podešava firmu, paket, status, boju i QR pristup. Uprava zatim u svom radnom prostoru vodi zaposlene, gradilišta, sredstva rada, materijale i izveštaje.</p>
            <div class="preview-flow-row"><span>Admin</span><b>firma / paket / boja</b></div>
            <div class="preview-flow-row"><span>Direkcija</span><b>radni prostor firme</b></div>
          </section>
        </div>
        <p class="preview-note"><b>Admin pregled:</b> ovo nije ulazak u nalog firme. Pregled služi da vidiš kako firma izgleda i šta joj je podešeno. Radnike, gradilišta, sredstva, materijale i izveštaje vodi Direkcija u svom radnom prostoru.</p>
      </main>
    </div>`;
}

function renderAdminWorkerPreview(c) {
  const brand = normalizeCompanyBrandColor(c?.brand_color || "green");
  const color = adminBrandHex(brand);
  const name = adminCompanyDisplayName(c);
  const code = c?.company_code || "ŠIFRA";
  return `
    <div class="preview-shell preview-worker brand-${brand}" style="--preview-brand:${color}">
      <div class="preview-phone">
        <div class="preview-phone-head">
          <span>Terenski radni unos</span>
          <b>${escapeHtml(name)}</b>
          <small>Šifra firme: ${escapeHtml(code)}</small>
        </div>
        <div class="preview-worker-card">
          <label>Datum / godina</label>
          <div class="fake-input">${escapeHtml(today())}</div>
          <label>Ime gradilišta</label>
          <div class="fake-input">Gradilište iz liste Uprave</div>
        </div>
        <div class="preview-worker-section"><b>👷 Evidencija zaposlenih na gradilištu</b><small>zaposleni vidi samo ono što mu Uprava uključi</small></div>
        <div class="preview-worker-section"><b>⛽ Sipanje goriva</b><small>mašina/vozilo, litri, MTČ/km, primalac</small></div>
        <div class="preview-worker-section"><b>📦 Materijal</b><small>materijal, ture, količina, relacija</small></div>
        <div class="preview-worker-section"><b>🛠️ Kvar</b><small>brzo slanje kvara odgovornom licu mehanizacije</small></div>
        <button class="preview-send">Pošalji Upravi firme</button>
      </div>
      <div class="preview-worker-info">
        <h4>Kako zaposleni vidi firmu</h4>
        <p>Zaposleni vidi naziv firme, šifru firme i poslovnu boju firme. Ne vidi admin panel, plaćanje, druge firme ni tuđe izveštaje.</p>
        ${adminPreviewStatusHtml(c)}
      </div>
    </div>`;
}

window.adminPreviewCompany = (id, mode = "director") => {
  const c = findAdminCompanyById(id);
  if (!c) return toast("Firma nije pronađena za pregled.", true);
  const modal = $("#adminPreviewModal");
  const body = $("#adminPreviewBody");
  const title = $("#adminPreviewTitle");
  const subtitle = $("#adminPreviewSubtitle");
  const kicker = $("#adminPreviewKicker");
  if (!modal || !body) return toast("Prozor za pregled nije pronađen.", true);
  const isWorker = mode === "worker";
  const name = adminCompanyDisplayName(c);
  if (kicker) kicker.textContent = isWorker ? "Pregled zaposlenog" : "Pregled Uprave firme";
  if (title) title.textContent = isWorker ? `Kako zaposleni vidi: ${name}` : `Kako Uprava firme vidi: ${name}`;
  if (subtitle) subtitle.textContent = "Pregled je informativan. Ne menja podatke i ne šalje izveštaje.";
  body.innerHTML = isWorker ? renderAdminWorkerPreview(c) : renderAdminDirectorPreview(c);
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
};

window.closeAdminCompanyPreview = () => {
  const modal = $("#adminPreviewModal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
};

window.adminUpdateCompanyBrand = async (table, id, color) => {
  try {
    const safeTable = table === "companies" ? "companies" : "approved_companies";
    const safeColor = normalizeCompanyBrandColor(color);

    const source = safeTable === "approved_companies"
      ? adminApprovedCompaniesCache.find(c => String(c.id) === String(id))
      : adminRegisteredCompaniesCache.find(c => String(c.id) === String(id));

    const { error } = await sb.from(safeTable).update({ brand_color: safeColor }).eq("id", id);
    if (error) throw error;

    // VAŽNO v1.23.9:
    // Ako admin promeni boju u listi odobrenih firmi, a firma je već aktivirana,
    // mora se promeniti i red u tabeli companies. Inače Admin vidi novu boju,
    // ali Uprava firme i zaposleni ostanu na staroj boji.
    const companyCode = source?.company_code || "";
    const approvedEmail = source?.approved_email || source?.owner_email || "";

    if (safeTable === "approved_companies") {
      if (companyCode) {
        const { error: syncErr } = await sb.from("companies").update({ brand_color: safeColor }).eq("company_code", companyCode);
        if (syncErr) console.warn("AskCreate.app: boja nije sinhronizovana u companies po company_code", syncErr.message);
      }
      if (approvedEmail) {
        const { error: syncEmailErr } = await sb.from("companies").update({ brand_color: safeColor }).eq("owner_email", approvedEmail);
        if (syncEmailErr) console.warn("AskCreate.app: boja nije sinhronizovana u companies po emailu", syncEmailErr.message);
      }
    } else {
      if (companyCode) {
        const { error: syncErr } = await sb.from("approved_companies").update({ brand_color: safeColor }).eq("company_code", companyCode);
        if (syncErr) console.warn("AskCreate.app: boja nije sinhronizovana u approved_companies po company_code", syncErr.message);
      }
      if (approvedEmail) {
        const { error: syncEmailErr } = await sb.from("approved_companies").update({ brand_color: safeColor }).eq("approved_email", approvedEmail);
        if (syncEmailErr) console.warn("AskCreate.app: boja nije sinhronizovana u approved_companies po emailu", syncEmailErr.message);
      }
    }

    adminApprovedCompaniesCache = adminApprovedCompaniesCache.map(c => {
      const sameId = safeTable === "approved_companies" && String(c.id) === String(id);
      const sameCode = companyCode && String(c.company_code || "") === String(companyCode);
      const sameEmail = approvedEmail && String(c.approved_email || "") === String(approvedEmail);
      return (sameId || sameCode || sameEmail) ? { ...c, brand_color: safeColor } : c;
    });
    adminRegisteredCompaniesCache = adminRegisteredCompaniesCache.map(c => {
      const sameId = safeTable === "companies" && String(c.id) === String(id);
      const sameCode = companyCode && String(c.company_code || "") === String(companyCode);
      const sameEmail = approvedEmail && String(c.owner_email || "") === String(approvedEmail);
      return (sameId || sameCode || sameEmail) ? { ...c, brand_color: safeColor } : c;
    });

    if (currentCompany && (
      String(currentCompany.id) === String(id) ||
      (companyCode && String(currentCompany.company_code || "") === String(companyCode)) ||
      (approvedEmail && String(currentCompany.owner_email || "") === String(approvedEmail))
    )) {
      currentCompany.brand_color = safeColor;
      applyCompanyBrandToBody(safeColor);
    }

    renderAdminCompanies($("#adminCompanySearch")?.value || "");
    loadCompanies();
    toast(`Boja firme promenjena i sinhronizovana: ${companyBrandLabel(safeColor)}.`);
  } catch (e) {
    toast(e.message || "Boja firme nije promenjena.", true);
  }
};

window.adminSavePackageUntilFromButton = (btn) => {
  const row = btn?.closest?.(".admin-renew-row");
  const input = row?.querySelector?.("input[type='date'][data-renew-id]");
  if (!input) return toast("Datum za produženje nije pronađen.", true);
  return adminUpdateCompanyPaidUntil(input.dataset.renewTable, input.dataset.renewId, input.value);
};

window.adminAddMonthPackageUntil = (table, id) => {
  const safeTable = table === "companies" ? "companies" : "approved_companies";
  const source = safeTable === "approved_companies"
    ? adminApprovedCompaniesCache.find(c => String(c.id) === String(id))
    : adminRegisteredCompaniesCache.find(c => String(c.id) === String(id));
  const baseValue = getCompanyPaidUntil(source);
  let base = parseDateOnly(baseValue);
  const today = todayDateOnly();
  if (!base || base < today) base = today;
  base.setMonth(base.getMonth() + 1);
  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");
  return adminUpdateCompanyPaidUntil(safeTable, id, `${yyyy}-${mm}-${dd}`);
};

window.adminUpdateCompanyPaidUntil = async (table, id, paidUntil) => {
  try {
    const safeTable = table === "companies" ? "companies" : "approved_companies";
    const newDate = String(paidUntil || "").slice(0, 10);
    if (!newDate) throw new Error("Izaberi datum do kada je paket plaćen.");

    const source = safeTable === "approved_companies"
      ? adminApprovedCompaniesCache.find(c => String(c.id) === String(id))
      : adminRegisteredCompaniesCache.find(c => String(c.id) === String(id));

    const payload = safeTable === "approved_companies"
      ? { paid_until: newDate, trial_until: newDate }
      : { paid_until: newDate };

    if (source && String(source.status || "").toLowerCase() !== "blocked") payload.status = "active";

    const { error } = await sb.from(safeTable).update(payload).eq("id", id);
    if (error) throw error;

    const companyCode = source?.company_code || "";
    const email = source?.approved_email || source?.owner_email || "";
    const syncPayloadApproved = { paid_until: newDate, trial_until: newDate };
    const syncPayloadCompany = { paid_until: newDate };
    if (source && String(source.status || "").toLowerCase() !== "blocked") {
      syncPayloadApproved.status = "active";
      syncPayloadCompany.status = "active";
    }

    if (safeTable === "approved_companies") {
      if (companyCode) {
        const { error: syncErr } = await sb.from("companies").update(syncPayloadCompany).eq("company_code", companyCode);
        if (syncErr) console.warn("AskCreate.app: datum nije sinhronizovan u companies po company_code", syncErr.message);
      }
      if (email) {
        const { error: syncEmailErr } = await sb.from("companies").update(syncPayloadCompany).eq("owner_email", email);
        if (syncEmailErr) console.warn("AskCreate.app: datum nije sinhronizovan u companies po emailu", syncEmailErr.message);
      }
    } else {
      if (companyCode) {
        const { error: syncErr } = await sb.from("approved_companies").update(syncPayloadApproved).eq("company_code", companyCode);
        if (syncErr) console.warn("AskCreate.app: datum nije sinhronizovan u approved_companies po company_code", syncErr.message);
      }
      if (email) {
        const { error: syncEmailErr } = await sb.from("approved_companies").update(syncPayloadApproved).eq("approved_email", email);
        if (syncEmailErr) console.warn("AskCreate.app: datum nije sinhronizovan u approved_companies po emailu", syncEmailErr.message);
      }
    }

    const updateCache = c => {
      const sameCode = companyCode && String(c.company_code || "") === String(companyCode);
      const sameApprovedEmail = email && String(c.approved_email || "") === String(email);
      const sameOwnerEmail = email && String(c.owner_email || "") === String(email);
      const sameApprovedId = safeTable === "approved_companies" && String(c.id) === String(id);
      const sameCompanyId = safeTable === "companies" && String(c.id) === String(id);
      if (sameCode || sameApprovedEmail || sameOwnerEmail || sameApprovedId || sameCompanyId) {
        const next = { ...c, paid_until: newDate };
        if ("trial_until" in next) next.trial_until = newDate;
        if (String(next.status || "").toLowerCase() !== "blocked") next.status = "active";
        return next;
      }
      return c;
    };

    adminApprovedCompaniesCache = adminApprovedCompaniesCache.map(updateCache);
    adminRegisteredCompaniesCache = adminRegisteredCompaniesCache.map(updateCache);

    if (currentCompany && (
      String(currentCompany.id) === String(id) ||
      (companyCode && String(currentCompany.company_code || "") === String(companyCode)) ||
      (email && String(currentCompany.owner_email || "") === String(email))
    )) {
      currentCompany.paid_until = newDate;
      if (String(currentCompany.status || "").toLowerCase() !== "blocked") currentCompany.status = "active";
      showCompanyExpiryNotice();
    }

    renderAdminCompanies($("#adminCompanySearch")?.value || "");
    loadCompanies();
    toast(`Paket je produžen do ${formatDateSchool(newDate)}.`);
  } catch (e) {
    toast(e.message || "Datum paketa nije sačuvan.", true);
  }
};

window.adminSetApprovedStatus = async (id, status) => {
  const { error } = await sb.from("approved_companies").update({ status }).eq("id", id);
  if (error) return toast(error.message, true);
  toast("Status promenjen.");
  loadApprovedCompanies();
};

window.adminSetCompanyStatus = async (id, status) => {
  const { error } = await sb.from("companies").update({ status }).eq("id", id);
  if (error) return toast(error.message, true);
  toast("Status firme promenjen.");
  loadCompanies();
};


window.adminDeleteCompanyEverything = async (table, id) => {
  try {
    const safeTable = table === "companies" ? "companies" : "approved_companies";
    const source = safeTable === "companies"
      ? adminRegisteredCompaniesCache.find(c => String(c.id) === String(id))
      : adminApprovedCompaniesCache.find(c => String(c.id) === String(id));

    if (!source) return toast("Firma nije pronađena u Admin listi.", true);

    const companyCode = String(source.company_code || "").trim();
    const companyName = source.company_name || source.name || "firma";
    if (!companyCode) return toast("Ova firma nema šifru firme, ne mogu bezbedno da je obrišem.", true);

    const firstConfirm = confirm(
      "TRAJNO obrisati firmu i sve njene podatke?\n\n" +
      "Firma: " + companyName + "\n" +
      "Šifra firme: " + companyCode + "\n\n" +
      "Briše se: Direkcija zapis, radnici, gradilišta, sredstva rada, materijali i izveštaji.\n" +
      "Ovo koristi samo za test firme. Ova radnja se ne može vratiti."
    );
    if (!firstConfirm) return;

    const typed = prompt(
      "Za potvrdu trajnog brisanja upiši tačno šifru firme:\n\n" + companyCode
    );
    if (String(typed || "").trim() !== companyCode) {
      return toast("Brisanje je otkazano. Šifra firme nije tačno upisana.", true);
    }

    const finalConfirm = confirm(
      "POSLEDNJA PROVERA\n\n" +
      "Ako klikneš OK, firma " + companyName + " i svi njeni podaci biće trajno obrisani iz baze.\n\n" +
      "Nastaviti?"
    );
    if (!finalConfirm) return;

    const { data, error } = await sb.rpc("admin_delete_company_everything", {
      p_company_code: companyCode
    });
    if (error) throw error;

    toast("Firma je trajno obrisana iz baze. Sada možeš napraviti novu čistu firmu sa istim emailom.");
    await loadApprovedCompanies();
    await loadCompanies();
  } catch (e) {
    toast((e && e.message ? e.message : e) || "Trajno brisanje firme nije uspelo. Proveri da li je SQL funkcija admin_delete_company_everything dodata u Supabase.", true);
  }
};

async function loadDirectorCompany() {
  const { data: userData } = await sb.auth.getUser();
  const email = userData?.user?.email;
  if (!email) throw new Error("Nema aktivnog Uprava login-a.");

  const { data, error } = await sb.from("companies").select("*").eq("owner_email", email).maybeSingle();
  if (error) throw error;
  if (!data) {
    show("DirectorLogin");
    toast("Email je prijavljen, ali firma još nije aktivirana. Unesi šifru firme i pozivni kod.");
    return null;
  }
  const approvedSource = await loadApprovedCompanyForDirector(data.company_code);
  const effectiveBrandColor = data.brand_color || approvedSource?.brand_color || "green";
  currentCompany = { ...data, brand_color: effectiveBrandColor };
  applyCompanyBrandToBody(effectiveBrandColor);
  $("#directorCompanyLabel").textContent = `${data.name} · ${data.company_code}`;
  businessUpdateCompanyName();
  setInternalHeader("Uprava", "", true);
  show("DirectorDashboard");
  showDirectorPackageNotice(approvedSource || currentCompany);
  showCurrentCompanyLoginInfo();
  await Promise.all([loadPeople(), loadSites(), loadAssets(), loadMaterials(), loadReports()]);
  startDirectorAutoRefresh();
  return data;
}












const PERSON_FUNCTION_OPTIONS = [
  "Vlasnik / Direktor",
  "Šef mehanizacije",
  "Šef gradilišta inženjer",
  "Mehaničar",
  "Vozač",
  "Magacioner",
  "Rukovaoc građevinskom mehanizacijom",
  "Fizički radnik",
  "Ostalo"
];

function normalizePersonFunctionText(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "dj")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function canonicalPersonFunction(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const n = normalizePersonFunctionText(raw);
  const direct = PERSON_FUNCTION_OPTIONS.find(opt => normalizePersonFunctionText(opt) === n);
  if (direct) return direct;
  if ((n.includes("vlasnik") || n.includes("gazda") || n.includes("direktor") || n.includes("owner"))) return "Vlasnik / Direktor";
  if (n.includes("mehanizacije") && n.includes("sef")) return "Šef mehanizacije";
  if (n.includes("gradil") && (n.includes("sef") || n.includes("inzenjer"))) return "Šef gradilišta inženjer";
  if (n.includes("mehanicar") || n.includes("mehanicar")) return "Mehaničar";
  if (n.includes("vozac") || n === "vozac") return "Vozač";
  if (n.includes("magacioner") || n.includes("magacin") || n.includes("skladistar") || n.includes("skladiste")) return "Magacioner";
  if (n.includes("rukovaoc") || n.includes("rukovalac") || n.includes("masin") || n.includes("gradjevinsk")) return "Rukovaoc građevinskom mehanizacijom";
  if (n.includes("fizicki") || n.includes("fizicki radnik") || n.includes("radnik")) return "Fizički radnik";
  return "Ostalo";
}


const ROLE_PERMISSION_PRESETS = {
  "Vlasnik / Direktor": ["owner_dashboard", "view_reports", "excel_export"],
  "Vozač": ["vehicles", "materials", "fuel", "lowloader", "water_tanker", "defects", "leave_request"],
  "Rukovaoc građevinskom mehanizacijom": ["machines", "fuel", "defects", "leave_request"],
  "Fizički radnik": ["workers", "leave_request"],
  "Mehaničar": ["defects", "workers", "warehouse", "leave_request"],
  "Magacioner": ["warehouse", "materials", "leave_request"],
  "Šef gradilišta inženjer": ["site_daily_log", "workers", "machines", "vehicles", "materials", "defects", "signature", "view_reports", "approve_reports"],
  "Šef mehanizacije": ["mechanic_boss", "defects", "fuel", "machines", "vehicles", "view_reports", "approve_reports"],
  "Ostalo": ["workers", "leave_request"]
};

function rolePresetKeys(roleValue = "") {
  return ROLE_PERMISSION_PRESETS[canonicalPersonFunction(roleValue)] || [];
}

function updateRolePresetHint() {
  const role = $("#personFunction")?.value || "";
  const hint = $("#rolePresetHint");
  const btn = $("#applyRolePresetBtn");
  const keys = rolePresetKeys(role);
  if (hint) {
    if (!role) hint.textContent = "Izaberi radno mesto. Aplikacija može automatski predložiti osnovne funkcije, a Direkcija posle može dodati ili skinuti šta treba.";
    else if (keys.length) hint.textContent = `Za ulogu „${canonicalPersonFunction(role)}” predloženo je ${keys.length} osnovnih funkcija. Direkcija može ručno dodati ili skinuti funkcije.`;
    else hint.textContent = "Za ovu ulogu nema posebnog predloga. Funkcije štiklira Direkcija ručno.";
  }
  if (btn) btn.disabled = !keys.length;
}

function applyRolePresetToPersonForm({ merge = false } = {}) {
  const role = $("#personFunction")?.value || "";
  const keys = new Set(rolePresetKeys(role));
  if (!keys.size) return;
  $$(".perm").forEach(ch => {
    if (merge) ch.checked = ch.checked || keys.has(ch.value);
    else ch.checked = keys.has(ch.value);
  });
  renderWorkerPreview(true);
  toast("Predložene funkcije za izabranu ulogu su primenjene. Direkcija i dalje može ručno da ih promeni.");
}

function selectedPeopleRegisterRole() {
  return $("#peopleRegisterRoleFilter")?.value || "";
}

function peopleRegisterRoleLabel() {
  return selectedPeopleRegisterRole() || "Sva radna mesta";
}

function safeRoleFilePart(value = "") {
  return safeFilePart(String(value || "sva_radna_mesta").replace(/\s+/g, "_"));
}

function filteredDirectorPeopleForRegister() {
  const selectedRole = selectedPeopleRegisterRole();
  const selectedCanonical = canonicalPersonFunction(selectedRole);
  const people = sortedDirectorPeopleForRegister();
  if (!selectedCanonical) return people;
  return people.filter(p => canonicalPersonFunction(p.function_title || "") === selectedCanonical);
}

function setPersonFormMode(mode = "add") {
  const editing = mode === "edit";
  const title = $("#personFormTitle");
  const btn = $("#addPersonBtn");
  const cancel = $("#cancelEditPersonBtn");
  if (title) title.textContent = editing ? "✏️ Izmeni profil zaposlenog" : "+ Dodaj osobu";
  if (btn) btn.textContent = editing ? "Sačuvaj izmene" : "Sačuvaj osobu";
  if (cancel) cancel.classList.toggle("hidden", !editing);
}

function clearPersonForm() {
  ["personEmployeeNumber", "personFirst", "personLast", "personFunction", "personCode"].forEach(id => {
    const el = $("#" + id);
    if (el) el.value = "";
  });
  $$(".perm").forEach(ch => { ch.checked = false; });
  editingPersonId = null;
  setPersonFormMode("add");
  refreshPersonMaterialPermissions();
  setPersonCodeStatus("Kod mora biti jedinstven u celoj aplikaciji. Kucaj kod — crveno znači zauzeto/neispravno, zeleno znači da može.", "info");
  hideWorkerPreview();
}

function setPersonCodeStatus(message, type = "info") {
  const el = $("#personCodeStatus");
  const input = $("#personCode");
  if (el) {
    el.textContent = message || "";
    el.classList.remove("code-ok", "code-bad", "code-info");
    el.classList.add(type === "ok" ? "code-ok" : type === "bad" ? "code-bad" : "code-info");
  }
  if (input) {
    input.classList.remove("code-ok-input", "code-bad-input", "code-info-input");
    input.classList.add(type === "ok" ? "code-ok-input" : type === "bad" ? "code-bad-input" : "code-info-input");
  }
}

async function findDuplicatePersonAccessCode(rawCode) {
  if (!currentCompany) return null;
  const normalizedCode = normalizeLoginCode(rawCode);
  if (!normalizedCode) return null;

  const { data, error } = await sb
    .from("company_users")
    .select("id, first_name, last_name, function_title, access_code, active")
    .eq("company_id", currentCompany.id);
  if (error) throw error;

  return (data || []).find(person => {
    if (editingPersonId && String(person.id) === String(editingPersonId)) return false;
    return normalizeLoginCode(person.access_code) === normalizedCode;
  }) || null;
}

let personCodeCheckTimer = null;
async function checkPersonCodeAvailability(showFreeMessage = true) {
  const input = $("#personCode");
  if (!input) return true;

  const code = normalizeLoginCode(input.value);
  if (!code) {
    setPersonCodeStatus("Kod mora biti jedinstven u celoj aplikaciji. Kucaj kod — crveno znači zauzeto/neispravno, zeleno znači da može.", "info");
    return true;
  }

  if (code.length < 4) {
    setPersonCodeStatus("Kod je prekratak. Upiši najmanje 4 karaktera, npr. ime + broj.", "bad");
    return false;
  }

  // Prvo proveravamo lokalno u trenutno učitanoj firmi, da korisnik dobije ime ako je duplikat u istoj firmi.
  const duplicate = await findDuplicatePersonAccessCode(code);
  if (duplicate) {
    const fullName = `${duplicate.first_name || ""} ${duplicate.last_name || ""}`.trim() || "drugi zaposleni";
    const status = duplicate.active === false ? "neaktivan/arhiviran profil" : "aktivan profil";
    setPersonCodeStatus(`Crveno: ovaj kod već koristi ${fullName} (${status}). Odredi drugi kod.`, "bad");
    return false;
  }

  // Zatim proveravamo globalno preko RPC-a, jer baza sada ne dozvoljava isti kod ni u drugoj firmi.
  try {
    if (sb?.rpc) {
      const { data, error } = await sb.rpc("check_worker_access_code_available", {
        p_access_code: code,
        p_current_person_id: editingPersonId || null
      });
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      if (row && row.available === false) {
        setPersonCodeStatus(row.message || "Crveno: ovaj pristupni kod već postoji u sistemu. Odredi drugi kod.", "bad");
        return false;
      }
    }
  } catch (err) {
    console.warn("Globalna provera pristupnog koda nije uspela, oslanjam se na zaštitu baze:", err);
    setPersonCodeStatus("Ne mogu trenutno proveriti kod u celoj aplikaciji. Sačuvaj profil — baza će ga svakako odbiti ako je zauzet.", "bad");
    return false;
  }

  if (showFreeMessage) setPersonCodeStatus("Zeleno: kod je slobodan u celoj aplikaciji i može se koristiti.", "ok");
  return true;
}

function schedulePersonCodeAvailabilityCheck() {
  clearTimeout(personCodeCheckTimer);
  personCodeCheckTimer = setTimeout(() => {
    checkPersonCodeAvailability(true).catch(err => {
      console.warn("Provera pristupnog koda nije uspela", err);
      setPersonCodeStatus("Ne mogu trenutno proveriti kod u celoj aplikaciji. Pokušaj ponovo za par sekundi.", "bad");
    });
  }, 350);
}


const WORKER_PREVIEW_SECTIONS = [
  { key: "daily_work", group: "field", title: "Gradilište i datum izveštaja", lines: ["Datum / godina", "Gradilište iz liste Uprave"] },
  { key: "workers", group: "field", title: "Evidencija zaposlenih na gradilištu", lines: ["Ime i prezime zaposlenog", "Sati rada", "+ Dodaj zaposlenog"] },
  { key: "machines", group: "field", title: "Rad sa mašinom", lines: ["Mašina iz evidencije ili dodatni unos", "Početni i završni MTČ", "Sati rada"] },
  { key: "vehicles", group: "field", title: "Rad vozila / kamiona", lines: ["Vozilo / kamion", "Početna i završna kilometraža", "Ture / kubici"] },
  { key: "lowloader", group: "field", title: "Transport mašine labudicom", lines: ["Tablice labudice", "Odakle i gde se vozi", "Mašina koju seli", "Početna / završna kilometraža"] },
  { key: "water_tanker", group: "field", title: "Cisterna za vodu", lines: ["Vozilo / cisterna", "Punjenje i istovar/prskanje", "Litara vode", "Broj punjenja"] },
  { key: "fuel", group: "field", title: "Evidencija goriva – korisnik", lines: ["Mašina ili vozilo", "KM posebno", "MTČ posebno", "Litara", "Ko je sipao / primio"] },
  { key: "field_tanker", group: "field", title: "Evidencija goriva – cisterna", lines: ["Gradilište", "Mašina ili vozilo", "Litara", "Primio gorivo"] },
  { key: "materials", group: "field", title: "Evidencija materijala", lines: ["Ulaz / izlaz / ugradnja", "Vrsta materijala", "Količina i jedinica mere"] },
  { key: "signature", group: "field", title: "Potpis zaposlenog", lines: ["Potpis prstom na telefonu ili mišem na laptopu", "Ime i prezime potpisnika opciono"] },
  { key: "leave_request", group: "field", title: "Zahtev za odsustvo / godišnji odmor", lines: ["Slobodan dan: jedan datum", "Godišnji odmor: datum od - do", "Napomena / razlog"] },
  { key: "warehouse", group: "field", title: "Magacin", lines: ["Ulaz / izlaz", "Materijal", "Količina"] },
  { key: "defects", group: "field", title: "Prijava kvara", lines: ["Mašina / vozilo", "Lokacija", "Opis kvara", "Hitnost"] },
  { key: "desktop_panel", group: "layout", title: "Laptop prikaz", lines: ["Iste štiklirane rubrike", "Širi raspored za unos sa laptopa", "Ne daje dodatne dozvole"] },
  { key: "site_daily_log", group: "layout", title: "Dnevnik gradilišta", lines: ["Poseban laptop A4 dnevnik", "Zaposleni/radni sati, materijali, ture", "Potpis u app ili učitan potpisan dokument"] },
  { key: "mechanic_boss", group: "layout", title: "Šef mehanizacije", lines: ["Poseban panel za kvarove", "Novi / aktivni / rešeni kvarovi", "Preuzmi, U radu, Rešeno, napomena"] },
  { key: "owner_dashboard", group: "office", title: "Vlasnik/Direktor pregled firme", lines: ["Vlasnički pregled bez izmene podataka", "Radni sati, gorivo, materijal, kvarovi, gradilišta"] },
  { key: "view_reports", group: "office", title: "Pregled izveštaja", lines: ["Kancelarijsko ovlašćenje - nije polje u terenskom izveštaju"] },
  { key: "approve_reports", group: "office", title: "Odobravanje izveštaja", lines: ["Kancelarijsko ovlašćenje - odobravanje ili vraćanje izveštaja"] },
  { key: "excel_export", group: "office", title: "Izvoz u Excel", lines: ["Kancelarijsko ovlašćenje - priprema i preuzimanje Excel/CSV izvoza"] },
  { key: "manage_people", group: "office", title: "Upravljanje korisnicima", lines: ["Kancelarijsko ovlašćenje - dodavanje i izmena ljudi u firmi"] },
  { key: "settings", group: "office", title: "Podešavanja firme", lines: ["Kancelarijsko ovlašćenje - osnovna podešavanja firme"] }
];

function getPersonEmployeeNumber(person = {}) {
  const permissions = person.permissions || {};
  return String(
    person.employee_number ||
    person.worker_number ||
    person.evidential_number ||
    person.evidence_number ||
    permissions.employee_number ||
    permissions.worker_number ||
    permissions.evidential_number ||
    permissions.evidence_number ||
    ""
  ).trim();
}

function formatPersonNameWithEmployeeNumber(person = {}, fallbackName = "") {
  const number = getPersonEmployeeNumber(person);
  const name = fallbackName || `${person.first_name || ""} ${person.last_name || ""}`.trim();
  return number ? `${number} — ${name || "Zaposleni"}` : (name || "Zaposleni");
}

function currentWorkerEmployeeNumber() {
  return getPersonEmployeeNumber(currentWorker || {});
}

function reportEmployeeNumber(r) {
  const d = r?.data || {};
  return String(
    getPersonEmployeeNumber(r?.company_users || {}) ||
    d.employee_number ||
    d.worker_number ||
    d.created_by_employee_number ||
    ""
  ).trim();
}

function getPersonPreviewData() {
  const employeeNumber = $("#personEmployeeNumber")?.value.trim() || "";
  const first = $("#personFirst")?.value.trim() || "Zaposleni";
  const last = $("#personLast")?.value.trim() || "";
  const role = $("#personFunction")?.value.trim() || "terenski radni unos";
  const code = $("#personCode")?.value.trim() || "šifra zaposlenog";
  const selectedKeys = $$(".perm:checked").map(ch => ch.value);
  const materialNames = $$(".material-perm:checked").map(ch => ch.dataset.name || ch.value).filter(Boolean);
  return { employeeNumber, first, last, role, code, selectedKeys, materialNames };
}

function renderWorkerPreview(show = true) {
  const card = $("#workerPreviewCard");
  const body = $("#workerPreviewBody");
  if (!card || !body) return;

  const d = getPersonPreviewData();
  const hasAnyFormValue = ["personEmployeeNumber", "personFirst", "personLast", "personFunction", "personCode"].some(id => ($("#" + id)?.value || "").trim());
  const hasSelection = d.selectedKeys.length > 0 || d.materialNames.length > 0;

  if (!show || (!hasAnyFormValue && !hasSelection)) {
    card.classList.add("hidden");
    body.innerHTML = "";
    return;
  }

  const selected = WORKER_PREVIEW_SECTIONS.filter(s => d.selectedKeys.includes(s.key));
  const fieldSelected = selected.filter(s => s.group === "field");
  const layoutSelected = selected.filter(s => s.group === "layout");
  const officeSelected = selected.filter(s => s.group === "office");

  const renderPreviewGroup = (title, sections, emptyText = "") => sections.length ? `
    <div class="worker-preview-section worker-preview-grouped">
      <strong>${escapeHtml(title)}</strong>
      ${sections.map(section => `
        <div class="worker-preview-mini-section">
          <b>${escapeHtml(section.title)}</b>
          <ul>${section.lines.map(line => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
        </div>
      `).join("")}
    </div>
  ` : (emptyText ? `<p class="muted tiny">${escapeHtml(emptyText)}</p>` : "");

  const sectionHtml = selected.length ? `
    ${renderPreviewGroup("Rubrike koje ulaze u terenski izveštaj", fieldSelected, "Nije štiklirana nijedna terenska rubrika.")}
    ${renderPreviewGroup("Poseban prikaz", layoutSelected)}
    ${renderPreviewGroup("Kancelarijska ovlašćenja", officeSelected)}
  ` : `<p class="muted">Još nije štiklirana nijedna stavka. Kad štikliraš rubriku levo, ovde se odmah vidi šta zaposleni dobija.</p>`;

  const materialsHtml = d.materialNames.length ? `
    <div class="worker-preview-section">
      <strong>Posebno označeni materijali</strong>
      <ul>${d.materialNames.map(name => `<li>${escapeHtml(name)}</li>`).join("")}</ul>
    </div>
  ` : (d.selectedKeys.includes("materials") ? `
    <div class="worker-preview-section">
      <strong>Materijali</strong>
      <p class="muted tiny">Zaposleni koristi aktivne materijale iz evidencije firme.</p>
    </div>
  ` : "");

  body.innerHTML = `
    <div class="phone-preview-shell">
      <div class="phone-preview-topbar">Terenski radni unos</div>
      <div class="phone-preview-card">
        <h4>Dobrodošli, ${escapeHtml(d.employeeNumber ? `${d.employeeNumber} — ${(d.first + " " + d.last).trim()}` : (d.first + " " + d.last).trim())}</h4>
        <p>${escapeHtml(currentCompany?.name || "Firma")} · ${escapeHtml(d.role)}</p>
        ${d.employeeNumber ? `<small>Evidencioni broj radnika: ${escapeHtml(d.employeeNumber)}</small>` : ""}
        <small>Pristupni kod zaposlenog: ${escapeHtml(d.code)}</small>
      </div>
      <div class="phone-preview-card">
        <h4>Šta ovaj profil dobija</h4>
        ${sectionHtml}
        ${materialsHtml}
      </div>
    </div>
  `;
  card.classList.remove("hidden");
}

function hideWorkerPreview() {
  renderWorkerPreview(false);
}

function bindPersonPreviewEvents() {
  ["personEmployeeNumber", "personFirst", "personLast", "personFunction", "personCode"].forEach(id => {
    const el = $("#" + id);
    if (el) {
      const refresh = () => {
        renderWorkerPreview(true);
        if (id === "personCode") schedulePersonCodeAvailabilityCheck();
      };
      el.addEventListener("input", refresh);
      el.addEventListener("change", refresh);
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target?.classList?.contains("perm") || e.target?.classList?.contains("material-perm")) {
      renderWorkerPreview(true);
    }
  });
  const hideBtn = $("#hideWorkerPreviewBtn");
  if (hideBtn) hideBtn.addEventListener("click", hideWorkerPreview);
  const roleSelect = $("#personFunction");
  if (roleSelect) roleSelect.addEventListener("change", updateRolePresetHint);
  const presetBtn = $("#applyRolePresetBtn");
  if (presetBtn) presetBtn.addEventListener("click", () => applyRolePresetToPersonForm({ merge: false }));
  updateRolePresetHint();
}

window.editPerson = async (id) => {
  try {
    if (!currentCompany) throw new Error("Nema aktivne firme.");
    const { data: person, error } = await sb
      .from("company_users")
      .select("*")
      .eq("id", id)
      .eq("company_id", currentCompany.id)
      .maybeSingle();
    if (error) throw error;
    if (!person) throw new Error("Zaposleni nije pronađen.");

    editingPersonId = person.id;
    $("#personEmployeeNumber").value = getPersonEmployeeNumber(person);
    $("#personFirst").value = person.first_name || "";
    $("#personLast").value = person.last_name || "";
    const personFunctionSelect = $("#personFunction");
    if (personFunctionSelect) personFunctionSelect.value = canonicalPersonFunction(person.function_title || "");
    $("#personCode").value = person.access_code || "";

    const permissions = person.permissions || {};
    $$(".perm").forEach(ch => { ch.checked = !!permissions[ch.value]; });
    const selectedMaterialIds = new Set((permissions.allowed_material_ids || []).map(String));
    await refreshPersonMaterialPermissions(selectedMaterialIds);

    setPersonFormMode("edit");
    renderWorkerPreview(true);
    checkPersonCodeAvailability(false).catch(() => {});
    toast("Korisnički profil je otvoren za izmenu.");
    const title = $("#personFormTitle");
    if (title) title.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (e) {
    toast(e.message, true);
  }
};

async function savePersonForm() {
  try {
    if (!currentCompany) throw new Error("Nema aktivne firme.");

    const employeeNumber = $("#personEmployeeNumber")?.value.trim() || "";
    const firstName = $("#personFirst").value.trim();
    const lastName = $("#personLast").value.trim();
    const functionTitle = $("#personFunction").value.trim();
    const code = normalizeLoginCode($("#personCode").value);

    if (!firstName) throw new Error("Upiši ime zaposlenog.");
    if (!lastName) throw new Error("Upiši prezime zaposlenog.");
    if (!functionTitle) throw new Error("Upiši funkciju zaposlenog.");
    if (code.length < 4) throw new Error("Pristupni kod zaposlenog mora imati najmanje 4 karaktera.");

    const duplicatePerson = await findDuplicatePersonAccessCode(code);
    if (duplicatePerson) {
      const fullName = `${duplicatePerson.first_name || ""} ${duplicatePerson.last_name || ""}`.trim() || "drugi zaposleni";
      const status = duplicatePerson.active === false ? "neaktivan/arhiviran profil" : "aktivan profil";
      throw new Error(`Ovaj pristupni kod već koristi ${fullName} (${status}). Odredi drugi kod, jer jedan kod ne sme pripadati dvema osobama u celoj aplikaciji.`);
    }

    const permissions = collectPermissions();
    permissions.employee_number = employeeNumber;
    permissions.worker_number = employeeNumber;

    const payload = {
      company_id: currentCompany.id,
      first_name: firstName,
      last_name: lastName,
      function_title: functionTitle,
      access_code: code,
      permissions,
      active: true
    };

    if (editingPersonId) {
      const { error } = await sb
        .from("company_users")
        .update(payload)
        .eq("id", editingPersonId)
        .eq("company_id", currentCompany.id);
      if (error) throw error;
      toast("Korisnički profil je sačuvan.");
    } else {
      const { error } = await sb.from("company_users").insert(payload);
      if (error) throw error;
      toast("Zaposleni je dodat.");
    }

    clearPersonForm();
    loadPeople();
  } catch (e) {
    const msg = String(e?.message || "");
    if (msg.includes("company_users_access_code_global_unique") || msg.toLowerCase().includes("duplicate key")) {
      setPersonCodeStatus("Crveno: ovaj pristupni kod već postoji u celoj aplikaciji. Odredi drugi kod.", "bad");
      const codeInput = $("#personCode");
      if (codeInput) codeInput.scrollIntoView({ behavior: "smooth", block: "center" });
      toast("Ovaj pristupni kod već postoji u sistemu. Odredi drugi kod.", true);
    } else {
      toast(e.message, true);
    }
  }
}

function reportActionLabel(r) {
  if (!r) return "izveštaj";
  const d = r.data || {};
  const date = r.report_date || d.report_date || "bez datuma";
  const type = d.report_type_label || reportDocumentTitle(r) || "Izveštaj";
  const person = reportDocumentPerson(r) || "nepoznat radnik";
  const site = reportPrimaryLocationLabel(r) || d.site_name || d.location || "bez gradilišta";
  return `${type} · ${person} · ${site} · ${date}`;
}

function confirmPermanentDeleteReport(r) {
  const label = reportActionLabel(r);
  return confirm(
    `Da li ste sigurni da želite trajno obrisati ovu stavku?\n\n${label}\n\n` +
    "Ova radnja briše stavku iz baze i ne može se vratiti."
  );
}

window.deleteReportPermanently = async (id) => {
  try {
    if (!currentCompany) throw new Error("Nema aktivne firme.");
    const existingReport = directorReportsCache.find(r => String(r.id) === String(id)) || loadLocalArchivedReports().find(r => String(r.id) === String(id));
    if (!confirmPermanentDeleteReport(existingReport || { id, data: { report_type_label: "Arhivirani izveštaj" } })) return;

    const deleteMode = await permanentlyDeleteReportInDatabase(id);
    rememberLocalPermanentlyDeletedReport(id);
    removeLocalArchivedReport(id);
    directorReportsCache = directorReportsCache.filter(r => String(r.id) !== String(id));
    toast(deleteMode === "deleted" ? "Izveštaj je trajno obrisan iz baze." : "Izveštaj je sklonjen iz svih prikaza kao trajno obrisan. SQL/RLS nije dozvolio pravi DELETE, pa je označen kao deleted.");
    closeReportDocumentCenter?.();
    renderArchiveList();
    businessUpdateReportsMetrics(directorReportsCache);
    await loadReports();
    if (typeof runDirectorGlobalSearch === "function") runDirectorGlobalSearch(false);
  } catch (e) {
    toast(e.message, true);
  }
};



const ASSET_FEATURE_DEFINITIONS = [
  { key: "kipper", label: "Kiper / ture / m³", emoji: "🚚" },
  { key: "lowloader", label: "Labudica", emoji: "🚛" },
  { key: "water_tanker", label: "Cisterna voda", emoji: "💧" },
  { key: "fuel_tanker", label: "Cisterna gorivo", emoji: "⛽" },
  { key: "service_vehicle", label: "Servisno vozilo", emoji: "🧰" },
  { key: "fixed_fuel_pump", label: "Fiksna pumpa baza", emoji: "🏠" },
  { key: "allow_images", label: "Slike dozvoljene", emoji: "📸" }
];

const ASSET_FUEL_TYPE_LABELS = {
  dizel: "Dizel",
  benzin: "Benzin",
  adblue: "AdBlue",
  ostalo: "Ostalo"
};

const ASSET_TANK_LABELS = {
  mala: "Mala",
  velika: "Velika",
  prikolica: "Prikolica",
  pumpa_baza: "Fiksna pumpa u bazi",
  ostalo: "Ostalo"
};

function normalizeAssetFeatures(raw) {
  let value = raw;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch (_) { value = value.split(/[;,|]/).map(x => x.trim()).filter(Boolean); }
  }
  if (Array.isArray(value)) return [...new Set(value.map(x => String(x || "").trim()).filter(Boolean))];
  if (value && typeof value === "object") {
    if (Array.isArray(value.features)) return normalizeAssetFeatures(value.features);
    return Object.keys(value).filter(k => value[k] === true || value[k] === "true" || value[k] === 1 || value[k] === "1");
  }
  return [];
}

function getAssetFeatures(asset = {}) {
  return normalizeAssetFeatures(asset.asset_features || asset.features || asset.vehicle_features || asset.work_features || asset.capabilities || []);
}

function collectAssetFeatureInputs() {
  return Array.from(document.querySelectorAll(".assetFeatureInput"))
    .filter(input => input.checked)
    .map(input => input.value);
}

function setAssetFeatureInputs(features) {
  const set = new Set(normalizeAssetFeatures(features));
  document.querySelectorAll(".assetFeatureInput").forEach(input => {
    input.checked = set.has(input.value);
  });
}

function collectAssetFuelTypeInputs() {
  return Array.from(document.querySelectorAll(".assetFuelTypeInput"))
    .filter(input => input.checked)
    .map(input => input.value);
}

function setAssetFuelTypeInputs(types) {
  const set = new Set(normalizeAssetFeatures(types));
  document.querySelectorAll(".assetFuelTypeInput").forEach(input => {
    input.checked = set.has(input.value);
  });
}

function getAssetFuelTypes(asset = {}) {
  return normalizeAssetFeatures(asset.fuel_types || asset.asset_fuel_types || asset.supported_fuel_types || []);
}

function formatAssetLiters(value) {
  const v = String(value || "").trim();
  return v ? `${escapeHtml(v)} L` : "";
}

function assetTankLabel(value) {
  return ASSET_TANK_LABELS[String(value || "")] || String(value || "");
}

function assetFeatureLabel(key) {
  const found = ASSET_FEATURE_DEFINITIONS.find(f => f.key === key);
  return found ? `${found.emoji} ${found.label}` : key;
}

function renderAssetFeatureBadges(asset = {}) {
  const features = getAssetFeatures(asset);
  const badges = features.map(k => `<span class="asset-feature-badge">${escapeHtml(assetFeatureLabel(k))}</span>`);
  const fuelTypes = getAssetFuelTypes(asset);
  if (fuelTypes.length) badges.push(`<span class="asset-feature-badge">⛽ ${escapeHtml(fuelTypes.map(t => ASSET_FUEL_TYPE_LABELS[t] || t).join(" + "))}</span>`);
  if (asset.fuel_tank_capacity) badges.push(`<span class="asset-feature-badge">🛢️ ${formatAssetLiters(asset.fuel_tank_capacity)}${asset.fuel_tank_label ? ` · ${escapeHtml(assetTankLabel(asset.fuel_tank_label))}` : ""}</span>`);
  if (asset.water_tank_capacity) badges.push(`<span class="asset-feature-badge">💧 ${formatAssetLiters(asset.water_tank_capacity)}${asset.water_tank_label ? ` · ${escapeHtml(assetTankLabel(asset.water_tank_label))}` : ""}</span>`);
  if (!badges.length) return `<small class="muted">Nema podešenih rubrika.</small>`;
  return `<div class="asset-feature-badges">${badges.join("")}</div>`;
}

function defaultAssetFeaturesForType(assetType) {
  const raw = rawAssetTypeValue(assetType);
  const defaults = [];
  if (raw === "vehicle_kiper") defaults.push("kipper");
  if (raw === "lowloader_vehicle" || raw === "lowloader") defaults.push("lowloader");
  if (raw === "water_tanker") defaults.push("water_tanker");
  if (raw === "fuel_tanker_vehicle" || raw === "fuel_tanker" || raw === "small_fuel_tanker") defaults.push("fuel_tanker");
  if (raw === "pickup_service") defaults.push("service_vehicle");
  if (raw === "fixed_fuel_pump") defaults.push("fixed_fuel_pump", "fuel_tanker");
  return defaults;
}

function applyDefaultAssetFeaturesFromType({ onlyIfEmpty = true } = {}) {
  const inputs = Array.from(document.querySelectorAll(".assetFeatureInput"));
  if (!inputs.length) return;
  if (onlyIfEmpty && inputs.some(i => i.checked)) return;
  const type = document.querySelector("#assetType")?.value || "";
  const defaults = new Set(defaultAssetFeaturesForType(type));
  inputs.forEach(input => {
    if (defaults.has(input.value)) input.checked = true;
  });
}

function defaultFuelUnitForAssetType(assetType) {
  const t = normalizeAssetType(assetType);
  if (t === "vehicle") return "l_per_100km";
  if (t === "machine") return "l_per_mtc";
  return "l_per_hour";
}

function fuelNormUnitLabel(unit) {
  const u = String(unit || "").trim();
  if (u === "l_per_100km") return "L / 100 km";
  if (u === "l_per_hour") return "L / sat";
  return "L / MTČ";
}

function assetFuelNormValue(asset) {
  return parseDecimalInput(asset?.fuel_norm ?? asset?.consumption_norm ?? asset?.fuel_consumption_norm ?? "");
}

function assetFuelNormUnit(asset) {
  return String(asset?.fuel_norm_unit || asset?.consumption_unit || defaultFuelUnitForAssetType(asset?.asset_type || asset?.type || "machine"));
}

function assetFuelToleranceValue(asset) {
  const n = parseDecimalInput(asset?.fuel_tolerance_percent ?? asset?.consumption_tolerance_percent ?? asset?.tolerance_percent ?? "");
  return n > 0 ? n : 20;
}

function nullableNumericInputValue(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return parseDecimalInput(raw);
}

function formatAssetFuelNorm(asset) {
  const n = assetFuelNormValue(asset);
  if (!n) return "";
  return `${n} ${fuelNormUnitLabel(assetFuelNormUnit(asset))}`;
}

function formatAssetTolerance(asset) {
  return `${assetFuelToleranceValue(asset)}%`;
}

function isMissingAssetConsumptionColumnError(error) {
  const msg = String(error?.message || error?.details || "").toLowerCase();
  return msg.includes("fuel_norm") || msg.includes("fuel_norm_unit") || msg.includes("fuel_tolerance_percent") || msg.includes("asset_features") || msg.includes("fuel_tank_capacity") || msg.includes("fuel_tank_label") || msg.includes("fuel_types") || msg.includes("water_tank_capacity") || msg.includes("water_tank_label") || msg.includes("consumption");
}

function stripAssetConsumptionColumns(payload) {
  const clean = { ...payload };
  delete clean.fuel_norm;
  delete clean.fuel_norm_unit;
  delete clean.fuel_tolerance_percent;
  delete clean.asset_features;
  delete clean.fuel_tank_capacity;
  delete clean.fuel_tank_label;
  delete clean.fuel_types;
  delete clean.water_tank_capacity;
  delete clean.water_tank_label;
  return clean;
}

async function saveAssetPayloadWithConsumptionFallback(payload, editingId) {
  const runSave = async (dataPayload) => {
    if (editingId) {
      return await sb.from("assets").update(dataPayload).eq("id", editingId).eq("company_id", currentCompany.id);
    }
    return await sb.from("assets").insert(dataPayload);
  };
  let { error } = await runSave(payload);
  if (!error) return { ok: true };
  if (!isMissingAssetConsumptionColumnError(error)) throw error;
  const retry = await runSave(stripAssetConsumptionColumns(payload));
  if (retry.error) throw retry.error;
  return { ok: true, warning: "Sredstvo je sačuvano, ali norme potrošnje ili rubrike sredstva nisu upisane jer u Supabase tabeli assets još nisu dodate nove kolone. Pokreni SQL za assets, pa ponovo izmeni sredstvo." };
}

function setAssetFormMode(mode = "add") {
  const editing = mode === "edit";
  const title = document.querySelector("#assetFormTitle");
  const btn = document.querySelector("#addAssetBtn");
  const cancel = document.querySelector("#cancelEditAssetBtn");
  if (title) title.textContent = editing ? "✏️ Izmeni sredstvo" : "+ Dodaj sredstvo";
  if (btn) btn.textContent = editing ? "Sačuvaj izmene" : "Sačuvaj";
  if (cancel) cancel.classList.toggle("hidden", !editing);
}

function clearAssetForm() {
  ["assetCode", "assetName", "assetReg", "assetCapacity", "assetFuelNorm", "assetFuelTolerance", "assetFuelTankCapacity", "assetWaterTankCapacity"].forEach(id => {
    const el = document.querySelector("#" + id);
    if (el) el.value = "";
  });
  const capacityUnit = document.querySelector("#assetCapacityUnit");
  if (capacityUnit) capacityUnit.value = "m3";
  const type = document.querySelector("#assetType");
  if (type) type.value = "machine";
  const fuelUnit = document.querySelector("#assetFuelUnit");
  if (fuelUnit) fuelUnit.value = "l_per_mtc";
  const fuelTankLabel = document.querySelector("#assetFuelTankLabel");
  if (fuelTankLabel) fuelTankLabel.value = "";
  const waterTankLabel = document.querySelector("#assetWaterTankLabel");
  if (waterTankLabel) waterTankLabel.value = "";
  setAssetFeatureInputs([]);
  setAssetFuelTypeInputs([]);
  applyDefaultAssetFeaturesFromType({ onlyIfEmpty: true });
  editingAssetId = null;
  setAssetFormMode("add");
  setAssetCodeStatus("Interni broj sredstva mora biti jedinstven u ovoj firmi. Ne koristi isti broj za dve mašine, vozila ili opremu.", "info");
}

function setAssetCodeStatus(message, type = "info") {
  const el = $("#assetCodeStatus");
  if (!el) return;
  el.textContent = message || "";
  el.classList.remove("code-ok", "code-bad", "code-info");
  el.classList.add(type === "ok" ? "code-ok" : type === "bad" ? "code-bad" : "code-info");
}

function normalizeUniqueKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

async function findDuplicateAssetCode(rawCode) {
  if (!currentCompany) return null;
  const wanted = normalizeUniqueKey(rawCode);
  if (!wanted) return null;

  const { data, error } = await sb
    .from("assets")
    .select("id, asset_code, name, registration, active")
    .eq("company_id", currentCompany.id);
  if (error) throw error;

  return (data || []).find(asset => {
    if (editingAssetId && String(asset.id) === String(editingAssetId)) return false;
    return normalizeUniqueKey(asset.asset_code) === wanted;
  }) || null;
}

let assetCodeCheckTimer = null;
let directorAssetListFilter = "all";

function rawAssetTypeValue(value) {
  return String(value || "").toLowerCase().trim();
}

function normalizeAssetType(value) {
  const v = rawAssetTypeValue(value);
  if (["machine", "masina", "mašina"].includes(v)) return "machine";
  if (["vehicle", "vozilo", "truck", "kamion", "vehicle_kiper", "kiper", "lowloader", "lowloader_vehicle", "labudica", "water_tanker", "cisterna_voda", "cisterna za vodu", "fuel_tanker_vehicle", "fuel_tanker", "cisterna_gorivo", "small_fuel_tanker", "mala_cisterna", "pickup_service", "pickup", "pikap", "kombi"].includes(v)) return "vehicle";
  if (["fixed_fuel_pump", "fuel_canister", "other", "ostalo", "oprema"].includes(v)) return "machine";
  return v === "vehicle" ? "vehicle" : "machine";
}

function assetTypeLabel(value) {
  const raw = rawAssetTypeValue(value);
  const detailed = {
    vehicle_kiper: "Kiper / kamion za materijal",
    lowloader_vehicle: "Labudica / niskonoseća prikolica",
    lowloader: "Labudica / niskonoseća prikolica",
    water_tanker: "Cisterna za vodu",
    fuel_tanker_vehicle: "Cisterna za gorivo",
    fuel_tanker: "Cisterna za gorivo",
    small_fuel_tanker: "Mala pokretna cisterna za gorivo",
    pickup_service: "Kombi / pikap / servisno vozilo",
    fixed_fuel_pump: "Fiksna pumpa u bazi",
    fuel_canister: "Kanister / ručno sipanje"
  };
  if (detailed[raw]) return detailed[raw];
  const v = normalizeAssetType(value);
  if (v === "machine") return "Mašina";
  if (v === "vehicle") return "Vozilo";
  return "Ostalo / oprema";
}

function assetFilterLabel(value) {
  const v = String(value || "all");
  if (v === "machine") return "mašine";
  if (v === "vehicle") return "vozila";
  if (v === "other") return "ostalo / oprema";
  return "sva aktivna sredstva rada";
}

async function checkAssetCodeAvailability(showFreeMessage = true) {
  const input = $("#assetCode");
  if (!input) return true;
  const code = input.value.trim();

  if (!code) {
    setAssetCodeStatus("Interni broj nije obavezan, ali ako ga upišeš mora biti jedinstven u ovoj firmi.", "info");
    return true;
  }

  const duplicate = await findDuplicateAssetCode(code);
  if (duplicate) {
    const assetName = duplicate.name ? ` — ${duplicate.name}` : "";
    const reg = duplicate.registration ? ` · registracija/oznaka: ${duplicate.registration}` : "";
    setAssetCodeStatus(`Interni broj ${code} već postoji u evidenciji${assetName}${reg}. Odredi drugi broj, jer jedan interni broj ne sme pripadati dvema sredstvima rada.`, "bad");
    return false;
  }

  if (showFreeMessage) setAssetCodeStatus("Interni broj je slobodan. Možeš sačuvati sredstvo rada.", "ok");
  return true;
}

function scheduleAssetCodeAvailabilityCheck() {
  clearTimeout(assetCodeCheckTimer);
  assetCodeCheckTimer = setTimeout(() => {
    checkAssetCodeAvailability(true).catch(err => {
      console.warn("Provera internog broja sredstva nije uspela", err);
      setAssetCodeStatus("Ne mogu trenutno proveriti interni broj. Pokušaj ponovo ili sačuvaj pa će aplikacija proveriti.", "bad");
    });
  }, 350);
}

window.editAsset = async (id) => {
  try {
    if (!currentCompany) throw new Error("Nema aktivne firme.");
    const { data: asset, error } = await sb
      .from("assets")
      .select("*")
      .eq("id", id)
      .eq("company_id", currentCompany.id)
      .maybeSingle();
    if (error) throw error;
    if (!asset) throw new Error("Sredstvo nije pronađeno.");

    editingAssetId = asset.id;
    document.querySelector("#assetCode").value = asset.asset_code || asset.internal_code || asset.code || "";
    document.querySelector("#assetName").value = asset.name || "";
    document.querySelector("#assetType").value = normalizeAssetType(asset.asset_type || "machine") === "vehicle" ? "vehicle" : "machine";
    document.querySelector("#assetReg").value = asset.registration || "";
    setAssetCapacityInputs(asset.capacity || "");
    if (document.querySelector("#assetFuelNorm")) document.querySelector("#assetFuelNorm").value = asset.fuel_norm || asset.consumption_norm || asset.fuel_consumption_norm || "";
    if (document.querySelector("#assetFuelUnit")) document.querySelector("#assetFuelUnit").value = asset.fuel_norm_unit || asset.consumption_unit || defaultFuelUnitForAssetType(asset.asset_type || "machine");
    if (document.querySelector("#assetFuelTolerance")) document.querySelector("#assetFuelTolerance").value = asset.fuel_tolerance_percent || asset.consumption_tolerance_percent || asset.tolerance_percent || "";
    const storedFeatures = getAssetFeatures(asset);
    setAssetFeatureInputs(storedFeatures.length ? storedFeatures : defaultAssetFeaturesForType(asset.asset_type || ""));
    setAssetFuelTypeInputs(getAssetFuelTypes(asset));
    if (document.querySelector("#assetFuelTankCapacity")) document.querySelector("#assetFuelTankCapacity").value = asset.fuel_tank_capacity || "";
    if (document.querySelector("#assetFuelTankLabel")) document.querySelector("#assetFuelTankLabel").value = asset.fuel_tank_label || "";
    if (document.querySelector("#assetWaterTankCapacity")) document.querySelector("#assetWaterTankCapacity").value = asset.water_tank_capacity || "";
    if (document.querySelector("#assetWaterTankLabel")) document.querySelector("#assetWaterTankLabel").value = asset.water_tank_label || "";
    applyDefaultAssetFeaturesFromType({ onlyIfEmpty: true });
    setAssetFormMode("edit");
    checkAssetCodeAvailability(false).catch(() => {});
    toast("Sredstvo je otvoreno za izmenu.");
    const title = document.querySelector("#assetFormTitle");
    if (title) title.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (e) {
    toast(e.message, true);
  }
};

async function saveAssetForm() {
  try {
    if (!currentCompany) throw new Error("Nema aktivne firme.");
    const assetCode = document.querySelector("#assetCode")?.value.trim() || "";
    const name = document.querySelector("#assetName").value.trim();
    const assetType = document.querySelector("#assetType").value;
    const registration = document.querySelector("#assetReg").value.trim();
    const capacityValue = document.querySelector("#assetCapacity")?.value.trim() || "";
    const capacityUnit = document.querySelector("#assetCapacityUnit")?.value || "m3";
    const capacity = buildAssetCapacityText(capacityValue, capacityUnit);
    const fuelNorm = nullableNumericInputValue(document.querySelector("#assetFuelNorm")?.value);
    const fuelNormUnit = document.querySelector("#assetFuelUnit")?.value || defaultFuelUnitForAssetType(assetType);
    const fuelTolerance = nullableNumericInputValue(document.querySelector("#assetFuelTolerance")?.value);
    const assetFeatures = collectAssetFeatureInputs();
    const assetFuelTypes = collectAssetFuelTypeInputs();
    const fuelTankCapacity = nullableNumericInputValue(document.querySelector("#assetFuelTankCapacity")?.value);
    const fuelTankLabel = document.querySelector("#assetFuelTankLabel")?.value || "";
    const waterTankCapacity = nullableNumericInputValue(document.querySelector("#assetWaterTankCapacity")?.value);
    const waterTankLabel = document.querySelector("#assetWaterTankLabel")?.value || "";

    if (!name) throw new Error("Upiši naziv mašine/vozila.");

    const duplicateAsset = await findDuplicateAssetCode(assetCode);
    if (duplicateAsset) {
      const assetName = duplicateAsset.name ? ` — ${duplicateAsset.name}` : "";
      const reg = duplicateAsset.registration ? ` · registracija/oznaka: ${duplicateAsset.registration}` : "";
      throw new Error(`Interni broj ${assetCode} već postoji u evidenciji${assetName}${reg}. Ne možeš dva puta koristiti isti interni broj sredstva. Izmeni postojeće sredstvo ili odredi drugi broj.`);
    }

    const payload = {
      company_id: currentCompany.id,
      asset_code: assetCode,
      name,
      asset_type: assetType,
      registration,
      capacity,
      fuel_norm: fuelNorm,
      fuel_norm_unit: fuelNormUnit,
      fuel_tolerance_percent: fuelTolerance,
      asset_features: assetFeatures,
      fuel_tank_capacity: fuelTankCapacity,
      fuel_tank_label: fuelTankLabel,
      fuel_types: assetFuelTypes,
      water_tank_capacity: waterTankCapacity,
      water_tank_label: waterTankLabel
    };

    const saveResult = await saveAssetPayloadWithConsumptionFallback(payload, editingAssetId);
    if (saveResult.warning) {
      toast(saveResult.warning, true);
    } else {
      toast(editingAssetId ? "Sredstvo je izmenjeno." : "Sredstvo dodato.");
    }

    clearAssetForm();
    loadAssets();
    if (typeof runDirectorGlobalSearch === "function") runDirectorGlobalSearch(false);
  } catch (e) {
    toast(e.message, true);
  }
}


function isMechanicBossPerson(p = {}) {
  const title = String(p.function_title || "").toLowerCase();
  const perms = p.permissions || {};
  return !!(perms.mechanic_boss || perms.mechanicBoss || title.includes("šef mehanizacije") || title.includes("sef mehanizacije"));
}

function renderPersonItem(p) {
  const permissionCount = Object.keys(p.permissions || {}).filter(k => p.permissions[k]).length;
  const rawFullName = `${p.first_name || ""} ${p.last_name || ""}`.trim();
  const fullName = escapeHtml(formatPersonNameWithEmployeeNumber(p, rawFullName));
  const employeeNumber = getPersonEmployeeNumber(p);
  return `
    <div class="director-table-row person-card-v1116" data-person-id="${escapeHtml(p.id)}">
      <div class="dt-cell dt-name"><strong>${fullName}</strong><small>${employeeNumber ? `Broj radnika: ${escapeHtml(employeeNumber)} · ` : ""}Pristupni kod: ${escapeHtml(p.access_code || "—")}</small></div>
      <div class="dt-cell"><span>${escapeHtml(p.function_title || "—")}</span><small>Radno mesto</small></div>
      <div class="dt-cell"><span class="dt-status dt-ok">Aktivan</span><small>${permissionCount} rubrika</small></div>
      <div class="dt-actions person-actions-v1116">
        <button class="secondary small-action" type="button" onclick="copyDirectorPersonLink('${p.id}','worker')">🔗 Kopiraj link</button>
        <button class="secondary small-action" type="button" onclick="openDirectorPersonLink('${p.id}','worker')">Otvori</button>
        ${isMechanicBossPerson(p) ? `<button class="secondary small-action" type="button" onclick="copyDirectorPersonLink('${p.id}','mechanic')">🔧 Link šefa</button>` : ""}
        <button class="edit-btn" type="button" onclick="editPerson('${p.id}')">✏️ Izmeni</button>
        <button class="delete-btn" type="button" onclick="deletePerson('${p.id}')">Deaktiviraj</button>
      </div>
    </div>
  `;
}

function renderPeopleRegisterList() {
  const list = $("#peopleList");
  if (!list) return;
  const people = filteredDirectorPeopleForRegister();
  const roleLabel = peopleRegisterRoleLabel();
  list.innerHTML = people.map(renderPersonItem).join("") || `<p class="muted">Nema zaposlenih za prikaz: ${escapeHtml(roleLabel)}.</p>`;
}

async function loadPeople() {
  if (!currentCompany) return;

  const { data, error } = await sb
    .from("company_users")
    .select("*")
    .eq("company_id", currentCompany.id)
    .eq("active", true)
    .order("created_at", { ascending:false });

  if (error) return toast(error.message, true);

  directorPeopleCache = data || [];
  updateSmartExportDatalists();
  businessUpdatePeopleCount(data || []);
  renderPeopleRegisterList();
}

function sortedDirectorPeopleForRegister() {
  return [...(directorPeopleCache || [])].sort((a, b) => {
    const an = getPersonEmployeeNumber(a);
    const bn = getPersonEmployeeNumber(b);
    const ai = Number.parseInt(an, 10);
    const bi = Number.parseInt(bn, 10);
    if (Number.isFinite(ai) && Number.isFinite(bi) && ai !== bi) return ai - bi;
    return String(an || `${a.first_name || ""} ${a.last_name || ""}`).localeCompare(String(bn || `${b.first_name || ""} ${b.last_name || ""}`), "sr");
  });
}

function peopleRegisterRows() {
  return filteredDirectorPeopleForRegister().map((p, index) => {
    const fullName = `${p.first_name || ""} ${p.last_name || ""}`.trim() || "—";
    return {
      index: index + 1,
      employeeNumber: getPersonEmployeeNumber(p) || "—",
      fullName,
      functionTitle: canonicalPersonFunction(p.function_title || "") || p.function_title || "—"
    };
  });
}

function downloadPeopleRegister() {
  try {
    const rows = peopleRegisterRows();
    if (!rows.length) throw new Error(`Nema zaposlenih za spisak: ${peopleRegisterRoleLabel()}.`);
    const header = ["R. br.", "Evidencioni broj radnika", "Ime i prezime", "Radno mesto", "Potpis radnika"];
    const body = rows.map(r => [r.index, r.employeeNumber, r.fullName, r.functionTitle, ""]);
    const csv = "\ufeff" + [header, ...body].map(row => row.map(v => csvEscape(excelCleanCell(v))).join(";")).join("\r\n");
    const companyCode = safeFilePart(currentCompany?.code || currentCompany?.company_code || "firma");
    const rolePart = selectedPeopleRegisterRole() ? `_${safeRoleFilePart(selectedPeopleRegisterRole())}` : "";
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `spisak_zaposlenih_${companyCode}${rolePart}_${today()}.csv`);
    toast(`Spisak zaposlenih je preuzet: ${peopleRegisterRoleLabel()}.`);
  } catch (e) {
    toast(e.message || "Spisak zaposlenih nije preuzet.", true);
  }
}

function buildPeopleRegisterPrintHtml() {
  const rows = peopleRegisterRows();
  const companyName = currentCompanyExportName();
  const companyCode = currentCompany?.code || currentCompany?.company_code || "—";
  const dateText = formatDateOnlyLocal(today());
  const roleLabel = peopleRegisterRoleLabel();
  return `<!doctype html>
<html lang="sr">
<head>
<meta charset="utf-8">
<title>Spisak zaposlenih</title>
<style>
  *{box-sizing:border-box} @page{size:A4 portrait;margin:12mm} body{font-family:Arial,Helvetica,sans-serif;margin:24px;color:#17231b;background:#fff} h1{margin:0 0 8px;font-size:22px;letter-spacing:.02em}.meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;margin:12px 0 18px;font-size:13px}.meta b{display:inline-block;min-width:112px;color:#405347} table{width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed} th,td{border:1px solid #cfd8d2;padding:7px 6px;text-align:left;vertical-align:middle;overflow-wrap:anywhere} th{background:#edf6ef;font-weight:800} tbody tr:nth-child(even){background:#fafcfb}.row-col{width:8%}.num-col{width:18%}.name-col{width:27%}.role-col{width:25%}.signature-col{width:22%}.sig-cell{height:40px}.sig-line{display:block;border-bottom:1px solid #222;height:24px;width:100%}.note{margin-top:16px;padding:9px 11px;border:1px solid #e3dcc7;background:#fff8dc;font-size:11px}.sign{display:flex;justify-content:space-between;margin-top:30px;font-size:12px}.line{border-top:1px solid #333;width:220px;text-align:center;padding-top:6px}@media print{body{margin:0}.no-print{display:none}}
</style>
</head>
<body>
  <h1>SPISAK ZAPOSLENIH</h1>
  <div class="meta">
    <div><b>Firma:</b> ${escapeHtml(companyName)}</div>
    <div><b>Šifra firme:</b> ${escapeHtml(companyCode)}</div>
    <div><b>Datum štampe:</b> ${escapeHtml(dateText)}</div>
    <div><b>Radno mesto:</b> ${escapeHtml(roleLabel)}</div>
    <div><b>Ukupno zaposlenih:</b> ${rows.length}</div>
  </div>
  <table>
    <thead><tr><th class="row-col">R. br.</th><th class="num-col">Evidencioni broj radnika</th><th class="name-col">Ime i prezime</th><th class="role-col">Radno mesto</th><th class="signature-col">Potpis radnika</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td>${escapeHtml(r.index)}</td><td>${escapeHtml(r.employeeNumber)}</td><td>${escapeHtml(r.fullName)}</td><td>${escapeHtml(r.functionTitle)}</td><td class="sig-cell"><span class="sig-line"></span></td></tr>`).join("")}</tbody>
  </table>
  <div class="sign"><div></div><div class="line">Direkcija / Uprava firme</div></div>
  <script>window.onload=function(){setTimeout(function(){window.print();},250)};<\/script>
</body>
</html>`;
}

function printPeopleRegister() {
  try {
    const rows = peopleRegisterRows();
    if (!rows.length) throw new Error(`Nema zaposlenih za štampu: ${peopleRegisterRoleLabel()}.`);
    const win = window.open("", "_blank", "width=1100,height=800");
    if (!win) throw new Error("Pregledač je blokirao prozor za štampu. Dozvoli popup za askcreate.app.");
    win.document.open();
    win.document.write(buildPeopleRegisterPrintHtml());
    win.document.close();
  } catch (e) {
    toast(e.message || "Štampa spiska nije pokrenuta.", true);
  }
}

window.downloadPeopleRegister = downloadPeopleRegister;
window.printPeopleRegister = printPeopleRegister;
window.renderPeopleRegisterList = renderPeopleRegisterList;

document.addEventListener("change", (e) => {
  if (e.target && e.target.id === "peopleRegisterRoleFilter") {
    renderPeopleRegisterList();
  }
});

async function loadSites() {
  if (!currentCompany) return;
  const { data, error } = await sb
    .from("sites")
    .select("*")
    .eq("company_id", currentCompany.id)
    .eq("active", true)
    .order("created_at", { ascending:false });

  if (error) return toast(error.message, true);

  directorSitesCache = data || [];
  updateSmartExportDatalists();
  businessUpdateSitesCount(data || []);
  $("#sitesList").innerHTML = (data || []).map(s => `
    <div class="director-table-row management-item">
      <div class="dt-cell dt-name"><strong>${escapeHtml(s.name)}</strong><small>Naziv gradilišta</small></div>
      <div class="dt-cell"><span>${escapeHtml(s.location || "—")}</span><small>Lokacija / opis</small></div>
      <div class="dt-cell"><span class="dt-status dt-ok">Aktivno</span><small>Status</small></div>
      <div class="dt-actions management-actions">
        <button class="edit-btn" type="button" onclick="editSite('${s.id}')">✏️ Izmeni</button>
        <button class="archive-btn" type="button" onclick="archiveSite('${s.id}', '${escapeHtml(s.name || '')}')">Zatvori</button>
      </div>
    </div>
  `).join("") || `<p class="muted">Nema aktivnih gradilišta.</p>`;
}

function setSiteFormMode(mode = "add") {
  const editing = mode === "edit";
  const title = $("#siteFormTitle");
  const btn = $("#addSiteBtn");
  const cancel = $("#cancelEditSiteBtn");
  if (title) title.textContent = editing ? "✏️ Izmeni gradilište" : "+ Dodaj gradilište";
  if (btn) btn.textContent = editing ? "Sačuvaj izmene" : "Sačuvaj gradilište";
  if (cancel) cancel.classList.toggle("hidden", !editing);
}

function clearSiteForm() {
  const name = $("#siteName");
  const location = $("#siteLocation");
  if (name) name.value = "";
  if (location) location.value = "";
  editingSiteId = null;
  setSiteFormMode("add");
  setSiteNameStatus("Naziv gradilišta mora biti jedinstven u ovoj firmi. Ne upisuj isto gradilište dva puta.", "info");
}

function setSiteNameStatus(message, type = "info") {
  const el = $("#siteNameStatus");
  if (!el) return;
  el.textContent = message || "";
  el.classList.remove("code-ok", "code-bad", "code-info");
  el.classList.add(type === "ok" ? "code-ok" : type === "bad" ? "code-bad" : "code-info");
}

async function findDuplicateSiteName(rawName) {
  if (!currentCompany) return null;
  const wanted = normalizeUniqueKey(rawName);
  if (!wanted) return null;

  const { data, error } = await sb
    .from("sites")
    .select("id, name, location, active")
    .eq("company_id", currentCompany.id);
  if (error) throw error;

  return (data || []).find(site => {
    if (editingSiteId && String(site.id) === String(editingSiteId)) return false;
    return normalizeUniqueKey(site.name) === wanted;
  }) || null;
}

let siteNameCheckTimer = null;
async function checkSiteNameAvailability(showFreeMessage = true) {
  const input = $("#siteName");
  if (!input) return true;
  const name = input.value.trim();

  if (!name) {
    setSiteNameStatus("Naziv gradilišta mora biti jedinstven u ovoj firmi. Ne upisuj isto gradilište dva puta.", "info");
    return true;
  }

  const duplicate = await findDuplicateSiteName(name);
  if (duplicate) {
    const location = duplicate.location ? ` · lokacija: ${duplicate.location}` : "";
    setSiteNameStatus(`Gradilište sa ovim nazivom već postoji: ${duplicate.name}${location}. Ne pravi duplo gradilište — izmeni postojeće ili upiši drugačiji naziv.`, "bad");
    return false;
  }

  if (showFreeMessage) setSiteNameStatus("Naziv gradilišta je slobodan. Možeš ga sačuvati u evidenciji firme.", "ok");
  return true;
}

function scheduleSiteNameAvailabilityCheck() {
  clearTimeout(siteNameCheckTimer);
  siteNameCheckTimer = setTimeout(() => {
    checkSiteNameAvailability(true).catch(err => {
      console.warn("Provera naziva gradilišta nije uspela", err);
      setSiteNameStatus("Ne mogu trenutno proveriti naziv gradilišta. Pokušaj ponovo ili sačuvaj pa će aplikacija proveriti.", "bad");
    });
  }, 350);
}

window.editSite = async (id) => {
  try {
    if (!currentCompany) throw new Error("Nema aktivne firme.");
    const { data: site, error } = await sb
      .from("sites")
      .select("*")
      .eq("id", id)
      .eq("company_id", currentCompany.id)
      .maybeSingle();
    if (error) throw error;
    if (!site) throw new Error("Gradilište nije pronađeno.");

    editingSiteId = site.id;
    $("#siteName").value = site.name || "";
    $("#siteLocation").value = site.location || "";
    setSiteFormMode("edit");
    checkSiteNameAvailability(false).catch(() => {});
    toast("Gradilište je otvoreno za izmenu.");
    const title = $("#siteFormTitle");
    if (title) title.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch(e) {
    toast(e.message || e, true);
  }
};

async function saveSiteForm() {
  try {
    if (!currentCompany) throw new Error("Nema aktivne firme.");
    const name = $("#siteName").value.trim();
    const location = $("#siteLocation").value.trim();
    if (!name) throw new Error("Upiši naziv gradilišta.");

    const duplicateSite = await findDuplicateSiteName(name);
    if (duplicateSite) {
      const duplicateLocation = duplicateSite.location ? ` · lokacija: ${duplicateSite.location}` : "";
      throw new Error(`Gradilište sa ovim nazivom već postoji: ${duplicateSite.name}${duplicateLocation}. Ne možeš dva puta upisati isti naziv gradilišta. Izmeni postojeće gradilište ili odredi drugačiji naziv.`);
    }

    const payload = { company_id: currentCompany.id, name, location, active: true };

    if (editingSiteId) {
      const { error } = await sb
        .from("sites")
        .update({ name, location })
        .eq("id", editingSiteId)
        .eq("company_id", currentCompany.id);
      if (error) throw error;
      toast("Gradilište je izmenjeno.");
    } else {
      const { error } = await sb.from("sites").insert(payload);
      if (error) throw error;
      toast("Gradilište dodato.");
    }

    clearSiteForm();
    await loadSites();
    if (typeof runDirectorGlobalSearch === "function") runDirectorGlobalSearch(false);
  } catch(e) {
    toast(e.message || e, true);
  }
}

async function loadAssets() {
  if (!currentCompany) return;
  const { data, error } = await sb
    .from("assets")
    .select("*")
    .eq("company_id", currentCompany.id)
    .order("created_at", { ascending:false });

  if (error) return toast(error.message, true);

  directorAssetsCache = data || [];
  updateSmartExportDatalists();
  renderAssetsList();
}

function renderAssetsList() {
  const list = $("#assetsList");
  if (!list) return;

  const filterSelect = $("#assetListFilter");
  if (filterSelect && filterSelect.value !== directorAssetListFilter) filterSelect.value = directorAssetListFilter;

  const activeAssets = (directorAssetsCache || []).filter(a => a.active !== false);
  const selected = normalizeAssetType(directorAssetListFilter || "all");
  const filteredAssets = selected === "all"
    ? activeAssets
    : activeAssets.filter(a => normalizeAssetType(a.asset_type) === selected);

  const info = $("#assetListFilterInfo");
  if (info) {
    const total = activeAssets.length;
    const shown = filteredAssets.length;
    info.textContent = selected === "all"
      ? `Prikazuju se sva aktivna sredstva rada (${total}).`
      : `Prikaz: ${assetFilterLabel(selected)} (${shown}/${total}).`;
  }

  list.innerHTML = filteredAssets.map(a => `
    <div class="director-table-row management-item asset-list-card-v1345" data-asset-type="${escapeHtml(normalizeAssetType(a.asset_type))}">
      <div class="dt-cell dt-name"><strong>${escapeHtml(formatAssetTitleWithCode(a))}</strong><small>Interni broj / naziv</small></div>
      <div class="dt-cell"><span>${escapeHtml(assetTypeLabel(a.asset_type))}</span><small>Kategorija</small></div>
      <div class="dt-cell"><span>Rubrike</span>${renderAssetFeatureBadges(a)}</div>
      <div class="dt-cell"><span>${escapeHtml(a.registration || "—")}</span><small>Reg. oznaka</small></div>
      <div class="dt-cell"><span>${escapeHtml(formatCapacityM3(a.capacity))}</span><small>Kapacitet</small></div>
      <div class="dt-cell"><span>${escapeHtml(formatAssetFuelNorm(a) || "—")}</span><small>Norma goriva</small><small class="asset-consumption-note">Odstupanje ${escapeHtml(formatAssetTolerance(a))}</small></div>
      <div class="dt-actions management-actions asset-actions-v1117">
        <button class="edit-btn" type="button" onclick="editAsset('${a.id}')">✏️ Izmeni</button>
        <button class="delete-btn" type="button" onclick="deleteAsset('${a.id}', '${escapeHtml(a.name || '')}')">Skloni</button>
      </div>
    </div>
  `).join("") || `<p class="muted">Nema aktivnih sredstava u izabranoj kategoriji: ${escapeHtml(assetFilterLabel(selected))}.</p>`;
}

function handleAssetListFilterChange(value) {
  directorAssetListFilter = value || "all";
  renderAssetsList();
}


async function loadMaterials() {
  if (!currentCompany) return;
  const list = $("#materialsList");
  const datalist = $("#materialsDatalist");

  const { data, error } = await sb.rpc("director_list_materials", {
    p_company_id: currentCompany.id
  });

  if (error) {
    if (list) list.innerHTML = `<p class="muted">Evidencija materijala se ne mogu učitati: ${escapeHtml(error.message)}. Pokreni SQL ispravku za v1.12.0.</p>`;
    const box = $("#personMaterialPermissions");
    if (box) box.innerHTML = `<p class="muted tiny">Evidencija materijala nisu učitani.</p>`;
    return;
  }

  directorMaterialsCache = data || [];
  updateSmartExportDatalists();
  const activeMaterials = (data || []).filter(m => m.active !== false);

  if (list) {
    list.innerHTML = activeMaterials.map(m => `
      <div class="director-table-row management-item material-card-v1119">
        <div class="dt-cell dt-name"><strong>${escapeHtml(m.name)}</strong><small>Naziv materijala</small></div>
        <div class="dt-cell"><span>${escapeHtml(m.unit || "—")}</span><small>Jedinica mere</small></div>
        <div class="dt-cell"><span>${m.category ? escapeHtml(m.category) : "—"}</span><small>Kategorija</small></div>
        <div class="dt-actions management-actions material-actions-v1119">
          <button class="edit-btn" type="button" onclick="editMaterial('${m.id}')">✏️ Izmeni</button>
          <button class="delete-btn" type="button" onclick="deleteMaterial('${m.id}', '${escapeHtml(m.name || '')}')">Skloni</button>
        </div>
      </div>
    `).join("") || `<p class="muted">Nema dodatih materijala.</p>`;
  }

  if (datalist) {
    datalist.innerHTML = activeMaterials.map(m => `<option value="${escapeHtml(m.name)}"></option>`).join("");
  }

  renderPersonMaterialPermissions(activeMaterials);
}

function setMaterialNameStatus(message, type = "info") {
  const el = $("#materialNameStatus");
  if (!el) return;
  el.textContent = message || "";
  el.classList.remove("code-ok", "code-bad", "code-info");
  el.classList.add(type === "ok" ? "code-ok" : type === "bad" ? "code-bad" : "code-info");
}

function normalizeMaterialNameKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

async function findDuplicateMaterialName(rawName) {
  if (!currentCompany) return null;
  const wanted = normalizeMaterialNameKey(rawName);
  if (!wanted) return null;

  let rows = [];
  const rpcRes = await sb.rpc("director_list_materials", { p_company_id: currentCompany.id });
  if (rpcRes.error) {
    const fallback = await sb
      .from("materials")
      .select("id, name, unit, category")
      .eq("company_id", currentCompany.id);
    if (fallback.error) throw fallback.error;
    rows = fallback.data || [];
  } else {
    rows = rpcRes.data || [];
  }

  return rows.find(material => {
    if (editingMaterialId && String(material.id) === String(editingMaterialId)) return false;
    return normalizeMaterialNameKey(material.name) === wanted;
  }) || null;
}

let materialNameCheckTimer = null;
async function checkMaterialNameAvailability(showFreeMessage = true) {
  const input = $("#materialName");
  if (!input) return true;

  const name = input.value.trim();
  if (!name) {
    setMaterialNameStatus("Naziv materijala mora biti jedinstven u ovoj firmi. Ne upisuj isti materijal dva puta.", "info");
    return true;
  }

  const duplicate = await findDuplicateMaterialName(name);
  if (duplicate) {
    const unit = duplicate.unit ? ` · jedinica: ${duplicate.unit}` : "";
    setMaterialNameStatus(`Ovaj materijal već postoji u evidenciji: ${duplicate.name || name}${unit}. Nemoj praviti dupli materijal — izmeni postojeći ili upiši drugačiji naziv.`, "bad");
    return false;
  }

  if (showFreeMessage) setMaterialNameStatus("Naziv je slobodan. Materijal možeš sačuvati u evidenciji firme.", "ok");
  return true;
}

function scheduleMaterialNameAvailabilityCheck() {
  clearTimeout(materialNameCheckTimer);
  materialNameCheckTimer = setTimeout(() => {
    checkMaterialNameAvailability(true).catch(err => {
      console.warn("Provera naziva materijala nije uspela", err);
      setMaterialNameStatus("Ne mogu trenutno proveriti naziv materijala. Pokušaj ponovo ili sačuvaj pa će aplikacija proveriti.", "bad");
    });
  }, 350);
}

function setMaterialFormMode(mode = "add") {
  const editing = mode === "edit";
  const title = $("#materialFormTitle");
  const btn = $("#addMaterialBtn");
  const cancel = $("#cancelEditMaterialBtn");
  if (title) title.textContent = editing ? "✏️ Izmeni materijal" : "+ Dodaj materijal";
  if (btn) btn.textContent = editing ? "Sačuvaj izmene" : "Sačuvaj materijal";
  if (cancel) cancel.classList.toggle("hidden", !editing);
}

function clearMaterialForm() {
  const name = $("#materialName");
  const category = $("#materialCategory");
  const unit = $("#materialUnit");
  if (name) name.value = "";
  if (category) category.value = "";
  if (unit) unit.value = "m3";
  editingMaterialId = null;
  setMaterialFormMode("add");
  setMaterialNameStatus("Naziv materijala mora biti jedinstven u ovoj firmi. Ne upisuj isti materijal dva puta.", "info");
}

window.editMaterial = async (id) => {
  try {
    if (!currentCompany) throw new Error("Nema aktivne firme.");
    const { data, error } = await sb.rpc("director_get_material", {
      p_company_id: currentCompany.id,
      p_material_id: id
    });
    if (error) throw error;
    const material = Array.isArray(data) ? data[0] : data;
    if (!material) throw new Error("Materijal nije pronađen.");

    editingMaterialId = material.id;
    $("#materialName").value = material.name || "";
    $("#materialUnit").value = material.unit || "m3";
    $("#materialCategory").value = material.category || "";
    setMaterialFormMode("edit");
    checkMaterialNameAvailability(false).catch(() => {});
    toast("Materijal je otvoren za izmenu.");
    const title = $("#materialFormTitle");
    if (title) title.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch(e) {
    toast(e.message, true);
  }
};

async function saveMaterialForm() {
  try {
    if (!currentCompany) throw new Error("Nema aktivne firme.");
    const name = $("#materialName").value.trim();
    if (!name) throw new Error("Upiši naziv materijala.");

    const duplicateMaterial = await findDuplicateMaterialName(name);
    if (duplicateMaterial) {
      const unit = duplicateMaterial.unit ? ` · jedinica: ${duplicateMaterial.unit}` : "";
      throw new Error(`Ovaj materijal već postoji u evidenciji: ${duplicateMaterial.name || name}${unit}. Ne možeš dva puta upisati isti naziv materijala. Izmeni postojeći materijal ili odredi drugačiji naziv.`);
    }

    const { error } = await sb.rpc("director_upsert_material", {
      p_company_id: currentCompany.id,
      p_material_id: editingMaterialId || null,
      p_name: name,
      p_unit: $("#materialUnit").value,
      p_category: $("#materialCategory").value.trim()
    });

    if (error) throw error;
    toast(editingMaterialId ? "Materijal je izmenjen." : "Materijal je dodat.");

    clearMaterialForm();
    await loadMaterials();
    if (typeof runDirectorGlobalSearch === "function") runDirectorGlobalSearch(false);
  } catch(e) {
    toast(e.message, true);
  }
}


window.archiveSite = async (id, name = "") => {
  const label = name ? ` (${name})` : "";
  if (!confirm("Obrisati gradilište iz aktivnog spiska" + label + "?\\n\\nStari izveštaji ostaju sačuvani zbog evidencije.")) return;

  const { error } = await sb
    .from("sites")
    .update({ active: false })
    .eq("id", id)
    .eq("company_id", currentCompany.id);

  if (error) return toast(error.message, true);
  toast("Gradilište je sklonjeno iz aktivnog spiska.");
  loadSites();
};

window.deletePerson = async (id, name = "") => {
  try {
    if (!currentCompany) throw new Error("Nema aktivne firme.");

    if (!name) {
      const { data: person, error: readError } = await sb
        .from("company_users")
        .select("first_name,last_name")
        .eq("id", id)
        .eq("company_id", currentCompany.id)
        .maybeSingle();
      if (readError) throw readError;
      if (person) name = `${person.first_name || ""} ${person.last_name || ""}`.trim();
    }

    const label = name ? ` (${name})` : "";
    if (!confirm("Obrisati zaposlenog iz aktivnog spiska" + label + "?\n\nStari izveštaji ostaju sačuvani zbog evidencije.")) return;

    const { error } = await sb
      .from("company_users")
      .update({ active: false })
      .eq("id", id)
      .eq("company_id", currentCompany.id);

    if (error) throw error;
    toast("Zaposleni je sklonjen iz aktivnog spiska.");
    clearPersonForm();
    loadPeople();
  } catch (e) {
    toast(e.message, true);
  }
};

window.deletePersonPermanently = async (id, name = "") => {
  toast("Trajno brisanje zaposlenih je isključeno za Upravu firme. Koristi 'Obriši sa spiska' da istorija ostane sačuvana.", true);
};

window.deleteAsset = async (id, name = "") => {
  try {
    if (!currentCompany) throw new Error("Nema aktivne firme.");
    const label = name ? ` (${name})` : "";
    if (!confirm("Obrisati ovu mašinu/vozilo iz aktivnog spiska" + label + "?\n\nStari izveštaji, gorivo, MTČ i evidencija ostaju sačuvani zbog dokumentacije.")) return;

    const { error } = await sb
      .from("assets")
      .update({ active: false })
      .eq("id", id)
      .eq("company_id", currentCompany.id);

    if (error) throw error;
    toast("Sredstvo je sklonjeno iz aktivnog spiska. Stari izveštaji ostaju sačuvani.");
    if (editingAssetId === id) clearAssetForm();
    loadAssets();
    if (typeof runDirectorGlobalSearch === "function") runDirectorGlobalSearch(false);
  } catch (e) {
    toast((e && e.message ? e.message : e) + " Ako tabela assets nema kolonu active, treba prvo dodati soft-delete kolonu u Supabase.", true);
  }
};

window.deleteMaterial = async (id, name = "") => {
  try {
    if (!currentCompany) throw new Error("Nema aktivne firme.");
    const label = name ? ` (${name})` : "";
    if (!confirm("Obrisati ovaj materijal iz aktivnog spiska" + label + "?\n\nStari izveštaji i dokumentacija ostaju sačuvani.")) return;

    const { error } = await sb
      .from("materials")
      .update({ active: false })
      .eq("id", id)
      .eq("company_id", currentCompany.id);

    if (error) throw error;
    toast("Materijal je sklonjen iz aktivnog spiska. Stari izveštaji ostaju sačuvani.");
    if (editingMaterialId === id) clearMaterialForm();
    await loadMaterials();
    if (typeof runDirectorGlobalSearch === "function") runDirectorGlobalSearch(false);
  } catch(e) {
    toast((e && e.message ? e.message : e) + " Ako tabela materials nema kolonu active, treba prvo dodati soft-delete kolonu u Supabase.", true);
  }
};

async function runDirectorGlobalSearch(showEmptyMessage = true) {
  const input = $("#directorGlobalSearch");
  const box = $("#directorSearchResults");
  const list = $("#directorSearchResultsList");
  if (!input || !box || !list || !currentCompany) return;

  const q = input.value.trim().toLowerCase();
  list.innerHTML = "";
  box.classList.add("hidden");

  if (!q) {
    if (showEmptyMessage) toast("Upiši pojam za pretragu.");
    return;
  }

  box.classList.remove("hidden");

  const results = [];

  try {
    const [peopleRes, assetsRes, sitesRes, materialsRes, reportsRes] = await Promise.all([
      sb.from("company_users").select("*").eq("company_id", currentCompany.id),
      sb.from("assets").select("*").eq("company_id", currentCompany.id),
      sb.from("sites").select("*").eq("company_id", currentCompany.id),
      sb.from("materials").select("*").eq("company_id", currentCompany.id),
      directorRpcListReports()
    ]);

    if (peopleRes.data) peopleRes.data.forEach(p => {
      const employeeNumber = getPersonEmployeeNumber(p);
      const text = `${employeeNumber} ${p.first_name} ${p.last_name} ${p.function_title} ${p.access_code} ${p.active ? "aktivan" : "neaktivan"}`;
      if (searchMatch(text, q)) results.push({
        type:"Zaposleni / osoba",
        title:formatPersonNameWithEmployeeNumber(p),
        subtitle:`${employeeNumber ? `broj radnika: ${employeeNumber} · ` : ""}${p.function_title} · kod: ${p.access_code} · ${p.active ? "aktivan" : "neaktivan"}`,
        actions:`${p.active ? `<button class="secondary small-action" onclick="copyDirectorPersonLink('${p.id}','worker')">🔗 Kopiraj link</button><button class="edit-btn" onclick="editPerson('${p.id}')">✏️ Izmeni</button><button class="delete-btn" onclick="deletePerson('${p.id}')">❌ Obriši sa spiska</button>` : `<span class="pill">sklonjeno iz aktivnog spiska</span>`}`
      });
    });

    if (assetsRes.data) assetsRes.data.forEach(a => {
      const text = `${a.asset_code || ""} ${a.internal_code || ""} ${a.code || ""} ${a.name} ${a.asset_type} ${a.registration || ""} ${a.capacity || ""}`;
      if (searchMatch(text, q)) results.push({
        type:"Mašina / vozilo",
        title:formatAssetTitleWithCode(a),
        subtitle:`broj: ${getAssetCode(a) || "—"} · ${a.asset_type} · ${a.registration || ""} · ${formatCapacityM3(a.capacity)}`,
        actions:`${a.active === false ? `<span class="pill">sklonjeno iz aktivnog spiska</span>` : `<button class="edit-btn" onclick="editAsset('${a.id}')">✏️ Izmeni</button><button class="delete-btn" onclick="deleteAsset('${a.id}', '${escapeHtml(a.name || '')}')">❌ Obriši sa spiska</button>`}`
      });
    });

    if (sitesRes.data) sitesRes.data.forEach(s => {
      const text = `${s.name} ${s.location || ""} ${s.active ? "aktivno" : "završeno sklonjeno"}`;
      if (searchMatch(text, q)) results.push({
        type:"Gradilište",
        title:s.name,
        subtitle:`${s.location || ""} · ${s.active ? "aktivno" : "završeno/sklonjeno"}`,
        actions:`${s.active ? `<button class="edit-btn" onclick="editSite('${s.id}')">✏️ Izmeni</button><button class="archive-btn" onclick="archiveSite('${s.id}', '${escapeHtml(s.name || '')}')">✅ Obriši sa spiska</button>` : `<span class="pill">sklonjeno iz aktivnog spiska</span>`}`
      });
    });

    if (materialsRes.data) materialsRes.data.forEach(m => {
      const text = `${m.name} ${m.unit || ""} ${m.category || ""}`;
      if (searchMatch(text, q)) results.push({
        type:"Materijal",
        title:m.name,
        subtitle:`${m.unit || ""} ${m.category ? "· " + m.category : ""}`,
        actions:`${m.active === false ? `<span class="pill">sklonjeno iz aktivnog spiska</span>` : `<button class="edit-btn" onclick="editMaterial('${m.id}')">✏️ Izmeni</button><button class="delete-btn" onclick="deleteMaterial('${m.id}', '${escapeHtml(m.name || '')}')">❌ Obriši sa spiska</button>`}`
      });
    });

    const reportsForSearch = await enrichReportsWithUsers(Array.isArray(reportsRes) ? reportsRes.slice(0, 150) : (reportsRes.data || []));
    reportsForSearch.forEach(r => {
      const d = r.data || {};
      const person = r.company_users ? `${r.company_users.first_name || ""} ${r.company_users.last_name || ""}`.trim() : (d.created_by_worker || d.worker_name || "");
      const text = `${person} ${r.status} ${r.report_date} ${d.site_name || ""} ${d.description || ""} ${d.machine || ""} ${d.vehicle || ""} ${d.material || ""} ${d.defect || ""} ${d.note || ""}`;
      if (searchMatch(text, q)) results.push({
        type:"Izveštaj",
        title:`${person || "Izveštaj"} · ${r.report_date || ""}`,
        subtitle:`status: ${r.status} · ${d.site_name || "bez gradilišta"} ${d.defect ? "· kvar: " + d.defect : ""}`,
        actions:`${r.status !== "archived" ? `<button class="archive-report-btn" onclick="archiveReport('${r.id}')">📦 Arhiviraj izveštaj</button>` : `<span class="pill">arhivirano</span>`}`
      });
    });

    list.innerHTML = results.length ? results.map(r => `
      <div class="item management-item">
        <div class="item-main">
          <span class="search-result-type">${escapeHtml(r.type)}</span>
          <strong>${escapeHtml(r.title)}</strong>
          <small>${escapeHtml(r.subtitle || "")}</small>
        </div>
        <div class="management-actions">${r.actions}</div>
      </div>
    `).join("") : `<p class="muted">Nema rezultata za: ${escapeHtml(q)}</p>`;
  } catch(e) {
    list.innerHTML = `<p class="muted">Greška pretrage: ${escapeHtml(e.message)}</p>`;
  }
}

let directorReportsCache = [];
let directorSitesCache = [];
let directorAssetsCache = [];
let directorMaterialsCache = [];
let directorPeopleCache = [];


// v1.29.2 — sigurniji put za izveštaje Direkcije.
// Direkcija čita/odobrava/vraća/arhivira izveštaje preko RPC funkcija,
// umesto direktnog rada nad tabelom reports. Ovo je priprema da se kasnije
// zatvore stare reports_*_all_mvp RLS politike bez lomljenja aplikacije.
async function directorRpcListReports() {
  if (!currentCompany?.id) return [];
  const { data, error } = await sb.rpc("director_list_reports", {
    p_company_id: currentCompany.id
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function directorDirectListArchivedReports() {
  if (!currentCompany?.id) return [];
  const { data, error } = await sb
    .from("reports")
    .select("*")
    .eq("company_id", currentCompany.id)
    .in("status", ["archived", "arhivirano"])
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) {
    console.warn("AskCreate.app: arhiva nije učitana direktno, oslanjam se na RPC listu:", error.message);
    return [];
  }
  return Array.isArray(data) ? data : [];
}


function directorArchiveLocalKey() {
  return `askcreate_archived_reports_${currentCompany?.id || "no_company"}`;
}

function directorDeletedReportsLocalKey() {
  return `askcreate_permanently_deleted_reports_${currentCompany?.id || currentWorker?.company_id || "no_company"}`;
}

function loadLocalPermanentlyDeletedReportIds() {
  try {
    const raw = localStorage.getItem(directorDeletedReportsLocalKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch (_) {
    return new Set();
  }
}

function rememberLocalPermanentlyDeletedReport(id) {
  if (!id) return;
  try {
    const ids = loadLocalPermanentlyDeletedReportIds();
    ids.add(String(id));
    localStorage.setItem(directorDeletedReportsLocalKey(), JSON.stringify(Array.from(ids).slice(-1000)));
  } catch (e) {
    console.warn("AskCreate.app: ne mogu upisati lokalnu listu trajno obrisanih izveštaja:", e.message);
  }
}

function forgetLocalPermanentlyDeletedReport(id) {
  if (!id) return;
  try {
    const ids = loadLocalPermanentlyDeletedReportIds();
    ids.delete(String(id));
    localStorage.setItem(directorDeletedReportsLocalKey(), JSON.stringify(Array.from(ids)));
  } catch (_) {}
}

function isPermanentlyDeletedReport(r) {
  const status = String(r?.status || "").toLowerCase();
  const d = r?.data || {};
  return status === "deleted" || status === "permanently_deleted" || d.permanently_deleted === true || d.deleted_from_archive === true;
}

function filterVisibleReportsAfterPermanentDelete(reports = []) {
  const deletedIds = loadLocalPermanentlyDeletedReportIds();
  return (Array.isArray(reports) ? reports : []).filter(r => {
    if (!r?.id) return false;
    if (deletedIds.has(String(r.id))) return false;
    if (isPermanentlyDeletedReport(r)) return false;
    return true;
  });
}

// v1.68.4 — ista baza može imati stare arhivirane/obrisane zapise.
// Ti zapisi smeju da postoje za dokumentaciju/arhivu, ali ne smeju više hraniti
// Direktor pregled, Šef mehanizacije gorivo/potrošnju, dnevnik, karnet i KPI brojeve.
function isReportOperationalForAnalytics(r) {
  if (!r?.id) return false;
  if (isPermanentlyDeletedReport(r)) return false;
  if (isArchivedReport(r)) return false;
  return true;
}

function filterOperationalReportsForAnalytics(reports = []) {
  return filterVisibleReportsAfterPermanentDelete(reports).filter(isReportOperationalForAnalytics);
}

function isMissingSupabaseRpc(error, rpcName = "") {
  const msg = String(error?.message || error || "").toLowerCase();
  return !!(msg.includes("function") || msg.includes("schema cache") || (rpcName && msg.includes(String(rpcName).toLowerCase())));
}

function clearLocalReportStateForCompany() {
  try { writeLocalArchivedReports([]); } catch (_) {}
  try { saveOfficeGeneratedArchive([]); } catch (_) {}
  try {
    localStorage.removeItem(directorArchiveLocalKey());
    localStorage.removeItem(directorDeletedReportsLocalKey());
    localStorage.removeItem("swp_returned_report_id");
    localStorage.removeItem("swp_returned_report_type");
  } catch (_) {}
}

async function callHardDeleteReportRpc(reportId) {
  if (!currentCompany?.id || !sb) return false;
  try {
    const { error } = await sb.rpc("director_permanently_delete_report", {
      p_company_id: currentCompany.id,
      p_report_id: reportId
    });
    if (error) throw error;
    return true;
  } catch (e) {
    if (!isMissingSupabaseRpc(e, "director_permanently_delete_report")) {
      console.warn("director_permanently_delete_report RPC nije uspeo, pokušavam direktan DELETE:", e?.message || e);
    }
    return false;
  }
}

async function callHardPurgeCompanyReportsRpc() {
  if (!currentCompany?.id || !sb) return null;
  try {
    const { data, error } = await sb.rpc("askcreate_purge_company_reports", {
      p_company_id: currentCompany.id
    });
    if (error) throw error;
    return data ?? true;
  } catch (e) {
    if (!isMissingSupabaseRpc(e, "askcreate_purge_company_reports")) {
      console.warn("askcreate_purge_company_reports RPC nije uspeo, pokušavam direktan DELETE:", e?.message || e);
    }
    return null;
  }
}


function currentCompanyCodeForPurge() {
  return String(
    currentCompany?.company_code ||
    currentCompany?.code ||
    currentWorker?.company_code ||
    localStorage.getItem("swp_worker_company_code") ||
    ""
  ).trim();
}

async function callHardPurgeCompanyReportsByCodeRpc() {
  const companyCode = currentCompanyCodeForPurge();
  if (!companyCode || !sb) return null;
  try {
    const { data, error } = await sb.rpc("askcreate_purge_company_reports_by_code", {
      p_company_code: companyCode
    });
    if (error) throw error;
    return data ?? true;
  } catch (e) {
    if (!isMissingSupabaseRpc(e, "askcreate_purge_company_reports_by_code")) {
      console.warn("askcreate_purge_company_reports_by_code RPC nije uspeo:", e?.message || e);
    }
    return null;
  }
}

async function callHardDeleteReportByCodeRpc(reportId) {
  const companyCode = currentCompanyCodeForPurge();
  if (!companyCode || !reportId || !sb) return false;
  try {
    const { data, error } = await sb.rpc("askcreate_delete_report_by_company_code", {
      p_company_code: companyCode,
      p_report_id: reportId
    });
    if (error) throw error;
    return data === true || Number(data || 0) > 0;
  } catch (e) {
    if (!isMissingSupabaseRpc(e, "askcreate_delete_report_by_company_code")) {
      console.warn("askcreate_delete_report_by_company_code RPC nije uspeo:", e?.message || e);
    }
    return false;
  }
}


// v1.68.8 — najčvršći put za radničke linkove: brisanje i čitanje izveštaja preko stvarno prijavljenog korisnika.
// Ovo rešava slučaj kada company_code/currentCompany.id nisu isti izvor koji koriste Direktor/Šef mehanizacije linkovi.
async function callHardPurgeReportsForLoggedWorkerRpc() {
  if (!currentWorker?.id || !currentWorker?.access_code || !sb) return null;
  try {
    const { data, error } = await sb.rpc("askcreate_purge_reports_for_logged_worker", {
      p_worker_id: currentWorker.id,
      p_access_code: currentWorker.access_code
    });
    if (error) throw error;
    return data ?? 0;
  } catch (e) {
    if (!isMissingSupabaseRpc(e, "askcreate_purge_reports_for_logged_worker")) {
      console.warn("askcreate_purge_reports_for_logged_worker RPC nije uspeo:", e?.message || e);
    }
    return null;
  }
}

async function listActiveReportsForLoggedWorkerRpc() {
  if (!currentWorker?.id || !currentWorker?.access_code || !sb) return null;
  try {
    const { data, error } = await sb.rpc("askcreate_list_active_reports_for_logged_worker", {
      p_worker_id: currentWorker.id,
      p_access_code: currentWorker.access_code
    });
    if (error) throw error;
    return filterOperationalReportsForAnalytics(data || []);
  } catch (e) {
    if (!isMissingSupabaseRpc(e, "askcreate_list_active_reports_for_logged_worker")) {
      console.warn("askcreate_list_active_reports_for_logged_worker RPC nije uspeo:", e?.message || e);
    }
    return null;
  }
}

async function debugLoggedWorkerReportsSource(label = "reports-debug") {
  try {
    const viaRpc = await listActiveReportsForLoggedWorkerRpc();
    const direct = currentWorker?.company_id && sb
      ? await sb.from("reports").select("id, company_id, user_id, report_date, status, submitted_at, created_at, data").eq("company_id", currentWorker.company_id).limit(50)
      : { data: [], error: null };
    console.log(`AskCreate ${label}:`, {
      worker_id: currentWorker?.id,
      worker_company_id: currentWorker?.company_id,
      worker_company_code: currentWorker?.company_code,
      rpc_count: Array.isArray(viaRpc) ? viaRpc.length : null,
      direct_count: Array.isArray(direct?.data) ? direct.data.length : null,
      direct_error: direct?.error?.message || null,
      direct_sample: direct?.data || []
    });
  } catch (e) {
    console.warn("AskCreate reports debug nije uspeo:", e?.message || e);
  }
}

async function permanentlyDeleteReportInDatabase(reportId) {
  if (!currentCompany?.id) throw new Error("Firma nije učitana.");

  // v1.68.6: prvo pokušavamo SECURITY DEFINER RPC koji zaista briše red iz Supabase baze.
  // Ovo je jedini ispravan put za oslobađanje baze kada RLS ne dozvoli browser-u direktan DELETE.
  const rpcDeleted = await callHardDeleteReportRpc(reportId);
  if (rpcDeleted) return "deleted_rpc";

  const rpcDeletedByCode = await callHardDeleteReportByCodeRpc(reportId);
  if (rpcDeletedByCode) return "deleted_rpc_by_code";

  const { error: deleteError } = await sb
    .from("reports")
    .delete()
    .eq("id", reportId)
    .eq("company_id", currentCompany.id);

  if (!deleteError) return "deleted";

  // Fallback ostaje samo kao zaštita prikaza ako SQL/RPC još nije dodat.
  // VAŽNO: ovo NE oslobađa bazu. Za pravo čišćenje treba pokrenuti SQL koji šaljem u chatu.
  const existing = directorReportsCache.find(r => String(r.id) === String(reportId)) || loadLocalArchivedReports().find(r => String(r.id) === String(reportId));
  const nextData = {
    ...(existing?.data || {}),
    permanently_deleted: true,
    deleted_from_archive: true,
    permanently_deleted_at: new Date().toISOString()
  };
  const { error: updateError } = await sb
    .from("reports")
    .update({ status: "deleted", data: nextData })
    .eq("id", reportId)
    .eq("company_id", currentCompany.id);
  if (updateError) {
    const msg = "Supabase nije dozvolio trajno brisanje iz browsera. Pokreni SQL za askcreate_purge_company_reports / director_permanently_delete_report.";
    throw new Error(`${msg} Detalj: ${deleteError.message || deleteError}`);
  }
  return "marked_deleted";
}

function loadLocalArchivedReports() {
  if (!currentCompany?.id) return [];
  try {
    const raw = localStorage.getItem(directorArchiveLocalKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(r => r && r.id) : [];
  } catch (e) {
    console.warn("AskCreate.app: lokalna arhiva nije učitana:", e.message);
    return [];
  }
}

function writeLocalArchivedReports(list) {
  if (!currentCompany?.id) return;
  try {
    localStorage.setItem(directorArchiveLocalKey(), JSON.stringify(Array.isArray(list) ? list.slice(0, 500) : []));
  } catch (e) {
    console.warn("AskCreate.app: lokalna arhiva nije upisana:", e.message);
  }
}

function saveLocalArchivedReport(report) {
  if (!report?.id || !currentCompany?.id) return;
  const archivedAt = new Date().toISOString();
  const archivedReport = {
    ...report,
    status: "archived",
    updated_at: archivedAt,
    data: {
      ...(report?.data || {}),
      archived: true,
      archived_from_direction: true,
      archived_at: archivedAt
    }
  };
  const map = new Map(loadLocalArchivedReports().map(r => [String(r.id), r]));
  map.set(String(archivedReport.id), archivedReport);
  writeLocalArchivedReports(Array.from(map.values()));
}

function removeLocalArchivedReport(id) {
  if (!id || !currentCompany?.id) return;
  writeLocalArchivedReports(loadLocalArchivedReports().filter(r => String(r.id) !== String(id)));
}

function mergeReportsById(primary = [], extra = []) {
  const map = new Map();
  [...primary, ...extra].forEach(r => {
    if (r?.id) map.set(String(r.id), r);
  });
  return Array.from(map.values());
}

async function directorRpcApproveReport(reportId) {
  if (!currentCompany?.id) throw new Error("Firma nije učitana.");
  const { error } = await sb.rpc("director_approve_report", {
    p_company_id: currentCompany.id,
    p_report_id: reportId
  });
  if (error) throw error;
}

async function directorRpcReturnReport(reportId, reason) {
  if (!currentCompany?.id) throw new Error("Firma nije učitana.");
  const { error } = await sb.rpc("director_return_report", {
    p_company_id: currentCompany.id,
    p_report_id: reportId,
    p_reason: reason
  });
  if (error) throw error;
}

async function directorRpcArchiveReport(reportId) {
  if (!currentCompany?.id) throw new Error("Firma nije učitana.");
  const { error } = await sb.rpc("director_archive_report", {
    p_company_id: currentCompany.id,
    p_report_id: reportId
  });
  if (error) throw error;
}

function isDefectOnlyReport(r) {
  const d = r?.data || {};
  return d.report_type === "defect_record" || d.report_type === "defect_alert" || d.sent_immediately === true;
}

function hasDefectData(r) {
  const d = r?.data || {};
  return isDefectOnlyReport(r) ||
    d.defect_exists === "da" ||
    !!d.defect ||
    !!d.defect_status ||
    !!d.defect_urgency ||
    !!d.defect_asset_name ||
    !!d.defect_machine;
}

function isActiveDefectReport(r) {
  return hasDefectData(r) && !isArchivedReport(r);
}

function isResolvedDefectReport(r) {
  const d = r?.data || {};
  const status = String(d.mechanic_status || d.defect_status || r?.status || "").toLowerCase();
  return ["reseno", "rešeno", "resolved", "zavrseno", "završeno"].includes(status);
}

function hasFieldTankerFuelData(r) {
  const d = r?.data || {};
  const fieldTankers = Array.isArray(d.field_tanker_entries)
    ? d.field_tanker_entries
    : (Array.isArray(d.tanker_fuel_entries) ? d.tanker_fuel_entries : []);
  return String(d.report_type || "") === "field_tanker_daily_batch" ||
    String(d.source || "") === "field_tanker_memory" ||
    fieldTankers.some(item => item && Object.values(item).some(Boolean));
}

function hasWorkerFuelEntryData(r) {
  const d = r?.data || {};
  const entries = Array.isArray(d.fuel_entries) ? d.fuel_entries : [];
  return String(d.report_type || "") === "fuel_entry" ||
    String(d.source || "") === "fuel_immediate" ||
    d.report_sections_sent?.fuel === true ||
    entries.some(item => item && Object.values(item).some(Boolean));
}

function hasAnyFuelReportData(r) {
  return hasWorkerFuelEntryData(r) || hasFieldTankerFuelData(r);
}

function isFuelDashboardOnlyReport(r) {
  const d = r?.data || {};
  const perms = r?.company_users?.permissions || {};
  return hasAnyFuelReportData(r) && !!(
    perms.fuel ||
    perms.field_tanker ||
    d.report_type === "fuel_entry" ||
    d.report_type === "field_tanker_daily_batch" ||
    d.source === "fuel_immediate" ||
    d.source === "field_tanker_memory" ||
    d.report_sections_sent?.fuel === true ||
    d.report_sections_sent?.field_tanker === true
  );
}

function isArchivedReport(r) {
  const status = String(r?.status || "").toLowerCase();
  const d = r?.data || {};
  return status === "archived" || status === "arhivirano" || d.archived === true || d.archived_from_direction === true || !!d.archived_at;
}

function isPendingDirectorReport(r) {
  const status = String(r?.status || "").toLowerCase();
  if (!status || ["approved", "odobreno", "archived", "arhivirano"].includes(status)) return false;
  if (isDefectOnlyReport(r)) return false;
  if (isFuelDashboardOnlyReport(r)) return false;
  return hasDailyReportData(r);
}

function hasDailyReportData(r) {
  // v1.18.5: Uprava ne sme da izgubi prikaz izveštaja zato što filter
  // ne prepoznaje novu rubriku. Sve što nije poseban kvar i nije arhivirano
  // mora ostati vidljivo u Dnevnim izveštajima.
  const d = r?.data || {};
  if (!d || typeof d !== "object") return true;

  const arraysToCheck = [
    d.workers, d.worker_entries, d.machines, d.vehicles,
    d.lowloader_moves, d.lowloader_entries, d.water_tanker_entries, d.water_entries,
    d.fuel_entries, d.field_tanker_entries, d.tanker_fuel_entries,
    d.material_entries, d.material_movements
  ];
  const hasAnyArrayData = arraysToCheck.some(arr =>
    Array.isArray(arr) && arr.some(item => item && Object.values(item).some(Boolean))
  );

  const leave = d.leave_request || {};
  const hasLeave = !!(
    d.leave_type || d.leave_label || d.leave_date || d.leave_from || d.leave_to || d.leave_note ||
    leave.type || leave.label || leave.date || leave.date_from || leave.date_to || leave.note
  );

  const hasKnownField = !!(
    d.site_name || d.description || d.hours || d.note ||
    d.material || d.quantity || d.unit || d.warehouse_type || d.warehouse_item || d.warehouse_qty ||
    d.machine || d.vehicle || d.fuel_liters || d.tours || d.route ||
    hasLeave || hasAnyArrayData
  );

  // Ako ne prepoznamo strukturu, ipak prikaži izveštaj. Bolje je da Uprava
  // vidi višak nego da joj nestane poslat izveštaj.
  return true || hasKnownField;
}

function formatDateTimeLocal(value) {
  if (!value) return "—";
  try {
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return String(value);
    return dt.toLocaleString("sr-RS", { dateStyle: "short", timeStyle: "short" });
  } catch(e) {
    return String(value);
  }
}

function formatDateOnlyLocal(value) {
  if (!value) return "—";
  try {
    const raw = String(value || "").trim();
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}.`;
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return raw || "—";
    return dt.toLocaleDateString("sr-RS", { day:"2-digit", month:"2-digit", year:"numeric" });
  } catch(e) {
    return String(value || "—");
  }
}

function decimalDiffText(start, end) {
  const s = parseFloat(String(start || "").replace(",", "."));
  const e = parseFloat(String(end || "").replace(",", "."));
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return "";
  const v = Math.round((e - s) * 100) / 100;
  return Number.isInteger(v) ? String(v) : String(v).replace(".", ",");
}

function machineKmStart(m = {}) { return m.km_start || m.machine_km_start || ""; }
function machineKmEnd(m = {}) { return m.km_end || m.machine_km_end || ""; }
function machineKmTotal(m = {}) { return m.km_total || m.machine_km_total || decimalDiffText(machineKmStart(m), machineKmEnd(m)); }
function machineMtcStart(m = {}) { return m.mtc_start || m.machine_mtc_start || m.start || ""; }
function machineMtcEnd(m = {}) { return m.mtc_end || m.machine_mtc_end || m.end || ""; }
function machineMtcTotal(m = {}) { return m.mtc_total || m.machine_mtc_total || m.hours || decimalDiffText(machineMtcStart(m), machineMtcEnd(m)); }

function reportStatusLabel(status) {
  const key = String(status || "novo").toLowerCase();
  const map = {
    new: "Novo",
    novo: "Novo",
    approved: "Odobreno",
    odobreno: "Odobreno",
    returned: "Vraćeno na ispravku",
    vraceno: "Vraćeno na ispravku",
    exported: "Izvezeno",
    izvezeno: "Izvezeno",
    archived: "Arhivirano",
    arhivirano: "Arhivirano",
    draft: "Nacrt",
    pending: "Na čekanju",
    sent: "Poslato",
    submitted: "Poslato"
  };
  return map[key] || String(status || "Novo");
}

function safeFilePart(value) {
  return String(value || "izvestaj")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "_")
    .slice(0, 80) || "izvestaj";
}


function reportUserFallback(r) {
  const d = r?.data || {};
  return {
    first_name: d.first_name || d.worker_first_name || d.created_by_first_name || (d.created_by_worker || d.worker_name || "").split(" ")[0] || "",
    last_name: d.last_name || d.worker_last_name || d.created_by_last_name || (d.created_by_worker || d.worker_name || "").split(" ").slice(1).join(" ") || "",
    function_title: d.function_title || d.worker_function || d.role || ""
  };
}

async function enrichReportsWithUsers(reports = []) {
  const list = Array.isArray(reports) ? reports : [];
  const ids = [...new Set(list.map(r => r && r.user_id).filter(Boolean))];
  if (!ids.length) {
    return list.map(r => ({ ...r, company_users: r.company_users || reportUserFallback(r) }));
  }

  try {
    const { data: users, error } = await sb
      .from("company_users")
      .select("id, first_name, last_name, function_title, permissions")
      .in("id", ids);

    if (error) throw error;
    const map = new Map((users || []).map(u => [u.id, u]));
    return list.map(r => ({ ...r, company_users: map.get(r.user_id) || r.company_users || reportUserFallback(r) }));
  } catch (e) {
    console.warn("Ne mogu da povežem reports sa company_users, koristim data fallback:", e);
    return list.map(r => ({ ...r, company_users: r.company_users || reportUserFallback(r) }));
  }
}


function formatRefreshTime(date = new Date()) {
  return date.toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const AUTO_REFRESH_LAMP_POS_KEY = "askcreate_auto_refresh_lamp_pos_v1";

function applySavedAutoRefreshLampPosition(lamp) {
  if (!lamp || lamp.dataset.positionApplied === "1") return;
  lamp.dataset.positionApplied = "1";
  try {
    const saved = JSON.parse(localStorage.getItem(AUTO_REFRESH_LAMP_POS_KEY) || "null");
    if (!saved || typeof saved.x !== "number" || typeof saved.y !== "number") return;
    const margin = 8;
    const maxX = Math.max(margin, window.innerWidth - lamp.offsetWidth - margin);
    const maxY = Math.max(margin, window.innerHeight - lamp.offsetHeight - margin);
    const x = Math.min(Math.max(saved.x, margin), maxX);
    const y = Math.min(Math.max(saved.y, margin), maxY);
    lamp.style.left = `${x}px`;
    lamp.style.top = `${y}px`;
    lamp.style.right = "auto";
    lamp.style.bottom = "auto";
    lamp.classList.add("is-custom-position");
  } catch (_) {}
}

function saveAutoRefreshLampPosition(lamp) {
  if (!lamp) return;
  const rect = lamp.getBoundingClientRect();
  try {
    localStorage.setItem(AUTO_REFRESH_LAMP_POS_KEY, JSON.stringify({ x: Math.round(rect.left), y: Math.round(rect.top) }));
  } catch (_) {}
}

function makeAutoRefreshLampDraggable(lamp) {
  if (!lamp || lamp.dataset.dragReady === "1") return;
  lamp.dataset.dragReady = "1";
  lamp.title = lamp.title || "Možeš me prevući gde ti odgovara";

  let dragging = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  const moveTo = (clientX, clientY) => {
    const margin = 8;
    const nextLeft = startLeft + (clientX - startX);
    const nextTop = startTop + (clientY - startY);
    const maxLeft = Math.max(margin, window.innerWidth - lamp.offsetWidth - margin);
    const maxTop = Math.max(margin, window.innerHeight - lamp.offsetHeight - margin);
    const left = Math.min(Math.max(nextLeft, margin), maxLeft);
    const top = Math.min(Math.max(nextTop, margin), maxTop);
    lamp.style.left = `${left}px`;
    lamp.style.top = `${top}px`;
    lamp.style.right = "auto";
    lamp.style.bottom = "auto";
    lamp.classList.add("is-custom-position", "is-dragging");
  };

  lamp.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    dragging = true;
    moved = false;
    const rect = lamp.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    lamp.setPointerCapture?.(e.pointerId);
    lamp.classList.add("is-dragging");
    e.preventDefault();
  });

  lamp.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    if (Math.abs(e.clientX - startX) > 2 || Math.abs(e.clientY - startY) > 2) moved = true;
    moveTo(e.clientX, e.clientY);
  });

  const stopDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    lamp.classList.remove("is-dragging");
    lamp.releasePointerCapture?.(e.pointerId);
    if (moved) saveAutoRefreshLampPosition(lamp);
  };

  lamp.addEventListener("pointerup", stopDrag);
  lamp.addEventListener("pointercancel", stopDrag);

  window.addEventListener("resize", () => {
    const rect = lamp.getBoundingClientRect();
    const margin = 8;
    const maxLeft = Math.max(margin, window.innerWidth - lamp.offsetWidth - margin);
    const maxTop = Math.max(margin, window.innerHeight - lamp.offsetHeight - margin);
    const left = Math.min(Math.max(rect.left, margin), maxLeft);
    const top = Math.min(Math.max(rect.top, margin), maxTop);
    lamp.style.left = `${left}px`;
    lamp.style.top = `${top}px`;
    lamp.style.right = "auto";
    lamp.style.bottom = "auto";
    saveAutoRefreshLampPosition(lamp);
  });
}

function ensureAutoRefreshLamp() {
  let lamp = document.getElementById("autoRefreshLamp");
  if (!lamp) {
    lamp = document.createElement("div");
    lamp.id = "autoRefreshLamp";
    lamp.className = "auto-refresh-lamp hidden is-offline";
    lamp.innerHTML = `<span class="auto-refresh-dot"></span><span class="auto-refresh-text">Online · osvežava 10s</span>`;
    document.body.appendChild(lamp);
  }
  makeAutoRefreshLampDraggable(lamp);
  setTimeout(() => applySavedAutoRefreshLampPosition(lamp), 0);
  return lamp;
}

function hideAutoRefreshManualButtons() {
  const ids = [
    "directorManualRefreshBtn", "refreshDailyLogBtn", "refreshCarnetBtn",
    "refreshFuelReportsBtn", "refreshFuelAnalysisBtn", "refreshMaterialOverviewBtn",
    "refreshOwnerDashboardBtn", "refreshArchiveBtn", "refreshDefectsBtn",
    "ownerPanelRefreshBtn", "refreshMechanicDefectsBtn", "refreshMechanicOpsBtn",
    "refreshDirectorBtn"
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = "none";
      el.hidden = true;
      el.setAttribute("aria-hidden", "true");
    }
  });
  document.querySelectorAll('button[onclick="manualDirectorRefresh()"], .manual-refresh-btn').forEach(el => {
    el.style.display = "none";
    el.hidden = true;
    el.setAttribute("aria-hidden", "true");
  });
}

function setAutoRefreshStatus(scope = "panel", ok = true, message = "") {
  const lamp = ensureAutoRefreshLamp();
  hideAutoRefreshManualButtons();
  const online = !!ok;
  autoRefreshLastOk = online;
  lamp.classList.remove("hidden", "is-online", "is-offline");
  lamp.classList.add(online ? "is-online" : "is-offline");
  const text = lamp.querySelector(".auto-refresh-text");
  const shortLabel = online
    ? `Online · osvežava 10s · ${formatRefreshTime()}`
    : `Offline · proverite internet`;
  const fullLabel = online
    ? `${scope} · online · ${message || "osveženo " + formatRefreshTime() + " · na svakih 10 sekundi"}`
    : `${scope} · proverite internet konekciju · trenutno ste offline`;
  if (text) text.textContent = shortLabel;
  lamp.title = `${fullLabel} · prevuci lampicu mišem gde ti odgovara`;
  document.querySelectorAll("[data-auto-refresh-status]").forEach(el => {
    el.textContent = fullLabel;
  });
}

async function probeRealConnection() {
  if (navigator.onLine === false) return false;
  if (!SUPABASE_URL || !SUPABASE_KEY) return navigator.onLine !== false;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 4500);
  try {
    const url = `${SUPABASE_URL}/rest/v1/companies?select=id&limit=1&_ac_ping=${Date.now()}`;
    await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Cache-Control": "no-cache"
      }
    });
    return true;
  } catch (e) {
    return false;
  } finally {
    clearTimeout(t);
  }
}

async function autoRefreshConnectionHeartbeat(scope = autoRefreshHeartbeatScope) {
  if (autoRefreshProbeBusy) return autoRefreshLastOk !== false;
  autoRefreshProbeBusy = true;
  try {
    const ok = await probeRealConnection();
    if (ok) {
      setAutoRefreshStatus(scope, true, `veza proverena ${formatRefreshTime()} · osvežava na 10 sekundi`);
    } else {
      setAutoRefreshStatus(scope, false);
    }
    return ok;
  } finally {
    autoRefreshProbeBusy = false;
  }
}

function startAutoRefreshHeartbeat(scope = "panel") {
  autoRefreshHeartbeatScope = scope;
  hideAutoRefreshManualButtons();
  ensureAutoRefreshLamp();
  if (autoRefreshHeartbeatTimer) clearInterval(autoRefreshHeartbeatTimer);
  autoRefreshConnectionHeartbeat(scope);
  autoRefreshHeartbeatTimer = setInterval(() => autoRefreshConnectionHeartbeat(autoRefreshHeartbeatScope), 2500);
}

function stopAutoRefreshHeartbeat() {
  if (autoRefreshHeartbeatTimer) clearInterval(autoRefreshHeartbeatTimer);
  autoRefreshHeartbeatTimer = null;
}

function markAutoRefreshOnline(scope = "panel") {
  setAutoRefreshStatus(scope, true, `osveženo ${formatRefreshTime()} · na svakih 10 sekundi`);
}

function markAutoRefreshOffline(scope = "panel", err = null) {
  setAutoRefreshStatus(scope, false, err?.message || "proverite internet konekciju");
}

window.addEventListener("online", () => autoRefreshConnectionHeartbeat(autoRefreshHeartbeatScope || "Veza"));
window.addEventListener("offline", () => markAutoRefreshOffline(autoRefreshHeartbeatScope || "Veza"));

function updateDirectorRefreshStatus(text) {
  document.querySelectorAll("[data-auto-refresh-status]").forEach(el => {
    el.textContent = text;
  });
}

function updateDirectorKnownReports(reports = [], silent = false) {
  const ids = new Set((Array.isArray(reports) ? reports : []).map(r => String(r.id || "")).filter(Boolean));
  if (silent && directorKnownReportIds.size) {
    const fresh = Array.from(ids).filter(id => !directorKnownReportIds.has(id));
    if (fresh.length) toast(`Stiglo novih izveštaja: ${fresh.length}.`);
  }
  directorKnownReportIds = ids;
}

async function directorAutoRefreshTick() {
  if (!currentCompany || directorAutoRefreshBusy) return;
  const dashboard = document.getElementById("viewDirectorDashboard");
  if (!dashboard || !dashboard.classList.contains("active")) return;
  const connectionOk = await probeRealConnection();
  if (!connectionOk) {
    markAutoRefreshOffline("Direkcija");
    return;
  }
  directorAutoRefreshBusy = true;
  try {
    await loadReports({ silent: true, auto: true });
    markAutoRefreshOnline("Direkcija");
  } catch (e) {
    markAutoRefreshOffline("Direkcija", e);
  } finally {
    directorAutoRefreshBusy = false;
  }
}

function startDirectorAutoRefresh() {
  stopDirectorAutoRefresh();
  startAutoRefreshHeartbeat("Direkcija");
  directorAutoRefreshTick();
  directorAutoRefreshTimer = setInterval(directorAutoRefreshTick, AUTO_REFRESH_INTERVAL_MS);
}

function stopDirectorAutoRefresh() {
  if (directorAutoRefreshTimer) clearInterval(directorAutoRefreshTimer);
  directorAutoRefreshTimer = null;
  directorAutoRefreshBusy = false;
}

window.manualDirectorRefresh = async function() {
  if (!currentCompany) return toast("Nema aktivne firme.", true);
  await loadReports({ silent: false, manual: true });
  toast("Izveštaji su osveženi.");
};

window.copySupportEmail = async function() {
  const email = "duskomacak@gmail.com";
  try {
    await navigator.clipboard.writeText(email);
    toast("Email podrške je kopiran.");
  } catch (e) {
    toast(email);
  }
};

async function loadReports(options = {}) {
  const silent = !!options.silent;
  if (!currentCompany) return;

  let data = [];
  try {
    const activeReports = filterVisibleReportsAfterPermanentDelete(await directorRpcListReports());
    const archivedReports = filterVisibleReportsAfterPermanentDelete(await directorDirectListArchivedReports());
    const remoteReports = mergeReportsById(activeReports, archivedReports);

    // Lokalna arhiva je pomoćni prikaz za karticu Arhiva kada RLS/RPC ne vrati arhivirane redove.
    // NE SME se čistiti samo zato što aktivni remoteReports nema stavki — time bi arhivirani kvar nestao iz Arhive.
    data = remoteReports;
  } catch (error) {
    if (silent) console.warn("Automatsko osvežavanje izveštaja preko RPC nije uspelo:", error.message);
    else toast(error.message, true);
    markAutoRefreshOffline("Direkcija", error);
    return;
  }

  directorReportsCache = await enrichReportsWithUsers(data || []);
  updateDirectorKnownReports(directorReportsCache, silent);
  markAutoRefreshOnline("Direkcija");
  businessUpdateReportsMetrics(directorReportsCache);
  const dailyReports = directorReportsCache.filter(isPendingDirectorReport);
  $("#reportsList").innerHTML = dailyReports.map(r => reportHtml(r)).join("") || `<p class="muted">Nema dnevnih izveštaja koji čekaju odobrenje.</p>`;
  renderDefectsList();
  renderFuelReportsList();
  renderFuelConsumptionAnalysis();
  renderArchiveList();
  renderExportPanel();
  officeFillSiteDatalists();
  if (document.getElementById("tabDailyLog")?.classList.contains("active")) renderDailyLogPreview();
  if (document.getElementById("tabCarnet")?.classList.contains("active")) renderCarnetPreview();
  if (document.getElementById("tabMaterials")?.classList.contains("active")) renderMaterialOverview();
  if (document.getElementById("tabOwner")?.classList.contains("active")) renderOwnerDashboard();
  if (document.getElementById("tabTest")?.classList.contains("active")) renderFlowTestPanel();
}

// === AskCreate v-karnet: Dnevnik rada + Karnet pregledi za Direkciju ===
function officeReportDate(r = {}) {
  return String(r.report_date || r.submitted_at || r.created_at || "").slice(0, 10);
}

function officeReportSite(r = {}) {
  const d = r.data || {};
  return String(d.site_name || d.site || r.site_name || "").trim();
}

function officePersonLabel(r = {}) {
  const d = r.data || {};
  return reportDocumentPerson(r) || reportPersonName(r) || d.created_by_worker || d.worker_name || "—";
}

function officeReportMatchesDateSite(r, from = "", to = "", site = "") {
  return officeReportMatchesDateSiteDeep(r, from, to, site);
}

function officeFillSiteDatalists() {
  const options = activeDirectorSites().map(s => exportOptionHtml(s.name, [s.location, "gradilište"].filter(Boolean).join(" · "))).join("");
  ["dailyLogSiteList", "carnetSiteList", "materialOverviewSiteList", "ownerDashboardSiteList", "ownerPanelDashboardSiteList"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = options;
  });
}

function officeEnsureDefaultDates() {
  const t = today();
  if (document.getElementById("dailyLogDate") && !document.getElementById("dailyLogDate").value) document.getElementById("dailyLogDate").value = t;
  if (document.getElementById("carnetFrom") && !document.getElementById("carnetFrom").value) document.getElementById("carnetFrom").value = t;
  if (document.getElementById("carnetTo") && !document.getElementById("carnetTo").value) document.getElementById("carnetTo").value = t;
}

function officeMetricCarnetRowsForToday(reports = []) {
  const t = today();
  return reports.filter(r => officeReportMatchesDateSite(r, t, t, "")).reduce((sum, r) => {
    const d = r.data || {};
    return sum
      + (Array.isArray(d.workers) ? d.workers.length : (Array.isArray(d.worker_entries) ? d.worker_entries.length : (d.hours ? 1 : 0)))
      + (Array.isArray(d.machines) ? d.machines.length : 0)
      + (Array.isArray(d.vehicles) ? d.vehicles.length : 0);
  }, 0);
}

function officeTable(headers = [], rows = []) {
  if (!rows.length) return `<p class="muted office-empty">Nema podataka za ovu rubriku.</p>`;
  return `<div class="office-table-wrap"><table class="office-table"><thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(v => `<td>${escapeHtml(v === undefined || v === null ? "" : String(v))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}


// === v14: voda, labudica i izvor goriva u pregledima/izvozima ===
function officeWaterEntries(d = {}) {
  return Array.isArray(d.water_tanker_entries) ? d.water_tanker_entries : (Array.isArray(d.water_entries) ? d.water_entries : []);
}

function officeLowloaderEntries(d = {}) {
  return Array.isArray(d.lowloader_moves) ? d.lowloader_moves : (Array.isArray(d.lowloader_entries) ? d.lowloader_entries : []);
}

function waterTankerLiters(entry = {}) {
  return parseDecimalInput(entry.water_liters || entry.liters || entry.water_l || "");
}

function waterTankerLoads(entry = {}) {
  return parseDecimalInput(entry.loads || entry.fill_count || entry.water_loads || "");
}

function waterTankerKmTotal(entry = {}) {
  return decimalDiffText(entry.km_start || entry.start_km, entry.km_end || entry.end_km) || entry.km_total || "";
}

function waterTankerPurposeLabel(value = "") {
  const v = String(value || "").toLowerCase();
  if (v === "prskanje") return "Prskanje puta / prašina";
  if (v === "zalivanje") return "Zalivanje / vlaženje";
  if (v === "dopuna") return "Dopuna vode";
  if (v === "ciscenje" || v === "čišćenje") return "Čišćenje / pranje";
  return value || "";
}

function lowloaderKmTotal(entry = {}) {
  return entry.km_total || decimalDiffText(entry.km_start || entry.start_km, entry.km_end || entry.end_km) || "";
}

function lowloaderSiteLabel(entry = {}, fallback = "") {
  return entry.site_name || entry.site || entry.to_site || entry.to_address || entry.from_site || entry.from_address || fallback || "";
}

function fuelSourceTypeLabel(value = "") {
  const v = String(value || "").toLowerCase();
  if (v === "fixed_base_pump") return "Fiksna pumpa u bazi";
  if (v === "small_mobile_tanker") return "Mala pokretna cisterna";
  if (v === "fuel_tanker") return "Cisterna za gorivo";
  if (v === "gas_station") return "Benzinska pumpa / račun";
  if (v === "canister") return "Kanister / ručno";
  if (v === "other") return "Ostalo";
  return value || "";
}

function fuelSourceName(entry = {}) {
  return entry.source_name || entry.fuel_source || entry.fuel_location || entry.tanker_asset_name || entry.tanker_vehicle || entry.cistern_vehicle || "";
}

function fuelSourceText(entry = {}) {
  return [fuelSourceTypeLabel(entry.fuel_source_type || entry.source_type), fuelSourceName(entry)].filter(Boolean).join(" · ");
}



function vehicleTourOfficeRows(v = {}, reportSite = "") {
  const items = Array.isArray(v.tour_items) ? v.tour_items : [];
  const baseVehicle = v.name || v.vehicle || "";
  const assetCode = v.asset_code || v.vehicle_code || "";
  const kmTotal = officeVehicleKmTotal(v) || v.km_total || decimalDiffText(v.km_start, v.km_end) || "";
  const out = [];

  const pushRow = (siteName, action, item, routeText, countAsCompanyTotal = true) => {
    const tours = item.tours || item.tour_count || "";
    out.push({
      site_name: siteName || reportSite || "—",
      asset_code: assetCode,
      vehicle: baseVehicle,
      registration: v.registration || "",
      km_start: v.km_start || "",
      km_end: v.km_end || "",
      km_total: kmTotal,
      tours,
      material: item.material || item.material_name || "",
      action,
      route: routeText || item.note || "",
      note: item.note || "",
      count_company_total: countAsCompanyTotal
    });
  };

  if (items.length) {
    items.forEach(item => {
      const type = item.tour_type || "local";
      if (type === "site_to_site") {
        const from = item.from_site || item.load_location || "";
        const to = item.to_site || item.unload_location || "";
        const route = `${from || "—"} → ${to || "—"}`;
        pushRow(from, "izlaz ka " + (to || "drugom gradilištu"), item, route, true);
        pushRow(to, "ulaz iz " + (from || "drugog gradilišta"), item, route, false);
      } else if (type === "landfill") {
        const from = item.from_site || item.site_name || item.site || "";
        const landfill = item.landfill || item.unload_location || "deponija";
        pushRow(from, "odvoz na deponiju", item, `${from || "—"} → ${landfill}`, true);
      } else if (type === "external_in") {
        const to = item.to_site || item.site_name || item.unload_location || "";
        const src = item.external_source || item.load_location || "spolja";
        pushRow(to, "ulaz spolja", item, `${src} → ${to || "—"}`, true);
      } else {
        const siteName = item.site_name || item.site || reportSite;
        pushRow(siteName, "lokal u krugu gradilišta", item, `${siteName || "—"} · lokal`, true);
      }
    });
    return out;
  }

  // Stari izveštaji bez tour_items ostaju kompatibilni.
  pushRow(officeEntrySiteName(v, reportSite), officeVehicleMaterialAction(v) || "prevoz", {
    tours: v.tours || "",
    material: officeVehicleMaterialName(v)
  }, officeVehicleRouteText(v), true);
  return out;
}

function vehicleTourMatchesFilter(row = {}, site = "") {
  if (!site) return true;
  return normalizeSearch(row.site_name || "").includes(normalizeSearch(site));
}

function officeBuildDailyLogData(date, site) {
  // Dnevnik rada prikazuje samo radne izveštaje. Kvarovi idu u posebnu karticu Kvarovi,
  // a arhivirani zapisi se prikazuju samo u kartici Arhiva.
  const reports = (directorReportsCache || []).filter(r => !isArchivedReport(r) && !isDefectOnlyReport(r) && !isFuelDashboardOnlyReport(r) && hasDailyReportData(r) && officeReportMatchesDateSite(r, date, date, site));
  const workers = [];
  const machines = [];
  const vehicles = [];
  const lowloaders = [];
  const waters = [];
  const fuels = [];
  const materials = [];
  const defects = [];
  const syntheticDailyWorkers = new Set();

  reports.forEach(r => {
    const d = r.data || {};
    const reportPerson = officePersonLabel(r);
    const reportSite = officeReportSite(r) || site || "—";
    const workerRows = Array.isArray(d.workers) ? d.workers : (Array.isArray(d.worker_entries) ? d.worker_entries : []);
    if (workerRows.length) {
      workerRows.forEach(w => {
        const rowSite = w.site_name || w.site || reportSite;
        if (!officeEntryMatchesSite({ site_name: rowSite }, reportSite, site)) return;
        workers.push([
          rowSite || reportSite,
          w.employee_number || w.worker_number || "",
          w.full_name || [w.first_name, w.last_name].filter(Boolean).join(" ") || reportPerson,
          w.function_title || w.role || "",
          w.hours || "",
          d.description || w.description || w.note || ""
        ]);
      });
    } else if ((d.hours || d.description) && (!site || officeEntryMatchesSite({ site_name: reportSite }, reportSite, site))) {
      workers.push([reportSite, reportEmployeeNumber(r) || "", reportPerson, r.company_users?.function_title || d.function_title || "", d.hours || "", d.description || ""]);
    }

    (Array.isArray(d.machines) ? d.machines : []).forEach(m => {
      if (!officeEntryMatchesSite(m, reportSite, site)) return;
      const entrySite = officeEntrySiteName(m, reportSite) || reportSite;
      machines.push([
        entrySite,
        m.asset_code || m.machine_code || "",
        m.name || d.machine || "",
        reportPerson,
        machineMtcStart(m),
        machineMtcEnd(m),
        machineMtcTotal(m),
        machineKmTotal(m),
        officeEntryDescription(m, "Rad mašine / MTČ")
      ]);
      if (!workerRows.length && !d.hours) officePushDailySyntheticWorker(workers, syntheticDailyWorkers, entrySite, r, "Rad mašine / MTČ", machineMtcTotal(m));
    });

    (Array.isArray(d.vehicles) ? d.vehicles : []).forEach(v => {
      const rows = vehicleTourOfficeRows(v, reportSite).filter(row => vehicleTourMatchesFilter(row, site));
      rows.forEach(row => {
        vehicles.push([
          row.site_name,
          row.asset_code,
          row.vehicle || d.vehicle || "",
          row.registration || "",
          reportPerson,
          row.km_start || "",
          row.km_end || "",
          row.route || "",
          row.tours || "",
          ""
        ]);
        if (row.material || row.tours) {
          materials.push([
            row.site_name,
            row.action || "prevoz",
            row.material || "Materijal iz ture",
            row.tours || "",
            "",
            "",
            row.route || row.note || ""
          ]);
        }
        if (!workerRows.length && !d.hours) officePushDailySyntheticWorker(workers, syntheticDailyWorkers, row.site_name, r, "Vožnja / ture", "");
      });
    });

    officeLowloaderEntries(d).forEach(ll => {
      if (!officeEntryMatchesSite({ site_name: lowloaderSiteLabel(ll, reportSite) }, reportSite, site)) return;
      const entrySite = lowloaderSiteLabel(ll, reportSite) || reportSite;
      lowloaders.push([
        entrySite,
        ll.plates || ll.registration || ll.tanker_plates || "",
        ll.machine || ll.machine_name || ll.transported_machine || "",
        reportPerson,
        ll.from_site || ll.from_address || "",
        ll.to_site || ll.to_address || "",
        ll.km_start || "",
        ll.km_end || "",
        lowloaderKmTotal(ll),
        ll.accompanying_tools || ll.tools || ll.note || ""
      ]);
      if (!workerRows.length && !d.hours) officePushDailySyntheticWorker(workers, syntheticDailyWorkers, entrySite, r, "Transport mašine labudicom", "");
    });

    officeWaterEntries(d).forEach(wt => {
      if (!officeEntryMatchesSite(wt, reportSite, site)) return;
      const entrySite = officeEntrySiteName(wt, reportSite) || reportSite;
      waters.push([
        entrySite,
        wt.asset_code || wt.vehicle_code || "",
        wt.vehicle || wt.asset_name || wt.tanker_vehicle || "",
        reportPerson,
        wt.km_start || "",
        wt.km_end || "",
        waterTankerKmTotal(wt),
        waterTankerLiters(wt) || "",
        waterTankerLoads(wt) || "",
        wt.fill_location || "",
        wt.unload_location || wt.spray_location || "",
        waterTankerPurposeLabel(wt.purpose),
        wt.note || ""
      ]);
      if (!workerRows.length && !d.hours) officePushDailySyntheticWorker(workers, syntheticDailyWorkers, entrySite, r, "Cisterna za vodu", "");
    });

    const ownFuels = Array.isArray(d.fuel_entries) ? d.fuel_entries : [];
    ownFuels.forEach(f => {
      if (!officeEntryMatchesSite(f, reportSite, site)) return;
      const entrySite = officeEntrySiteName(f, reportSite) || reportSite;
      fuels.push([
        entrySite,
        f.asset_code || "",
        f.asset_name || f.machine || f.vehicle || f.other || "",
        f.liters || "",
        f.km || f.current_km || "",
        f.mtc || f.current_mtc || "",
        f.by || reportPerson,
        f.receiver || d.fuel_receiver || "",
        fuelSourceText(f)
      ]);
    });

    const tankerFuels = Array.isArray(d.field_tanker_entries) ? d.field_tanker_entries : (Array.isArray(d.tanker_fuel_entries) ? d.tanker_fuel_entries : []);
    tankerFuels.forEach(f => {
      if (!officeEntryMatchesSite(f, reportSite, site)) return;
      const entrySite = officeEntrySiteName(f, reportSite) || reportSite;
      fuels.push([
        entrySite,
        f.asset_code || "",
        f.asset_name || f.machine || f.vehicle || f.other || "",
        f.liters || "",
        f.km || f.current_km || "",
        f.mtc || f.current_mtc || "",
        f.tanker_asset_name || f.tanker_vehicle || f.cistern_vehicle || reportPerson,
        f.receiver || f.received_by || "",
        fuelSourceText(f)
      ]);
    });

    const mats = Array.isArray(d.material_entries) ? d.material_entries : (Array.isArray(d.material_movements) ? d.material_movements : (Array.isArray(d.materials) ? d.materials : []));
    mats.forEach(m => {
      if (!officeEntryMatchesSite(m, reportSite, site)) return;
      const entrySite = officeEntrySiteName(m, reportSite) || reportSite;
      materials.push([
        entrySite,
        m.action || m.material_action || "",
        m.material || m.name || m.material_name || "",
        m.tours || m.material_tours || "",
        materialQuantityValue(m),
        materialUnitValue(m),
        m.note || materialCalcText(m) || ""
      ]);
    });

    // Namerno ne dodajemo kvarove u Dnevnik rada.
    // Aktivni kvarovi se signaliziraju i prikazuju samo u kartici Kvarovi,
    // a po arhiviranju samo u kartici Arhiva.
  });

  return { reports, workers, machines, vehicles, lowloaders, waters, fuels, materials, defects };
}



const OFFICE_ARCHIVE_STORAGE_KEY = "askcreate_office_generated_archive_v1";

function officeArchiveCompanyKey() {
  return String(currentCompany?.id || currentCompany?.company_code || currentCompany?.code || "no_company");
}

function loadOfficeGeneratedArchive() {
  try {
    const all = JSON.parse(localStorage.getItem(OFFICE_ARCHIVE_STORAGE_KEY) || "{}");
    const list = all[officeArchiveCompanyKey()] || [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveOfficeGeneratedArchive(list = []) {
  try {
    const all = JSON.parse(localStorage.getItem(OFFICE_ARCHIVE_STORAGE_KEY) || "{}");
    all[officeArchiveCompanyKey()] = Array.isArray(list) ? list : [];
    localStorage.setItem(OFFICE_ARCHIVE_STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn("Ne mogu sačuvati kancelarijsku arhivu:", e);
  }
}

function generatedOfficeArchiveId(kind, from, to, site) {
  return `office_${kind}_${from || ""}_${to || ""}_${normalizeSearch(site || "sva").replace(/[^a-z0-9]+/g, "_")}_${Date.now()}`;
}

function generatedOfficeArchiveLabel(item = {}) {
  const type = item.kind === "carnet" ? "Karnet stavki" : "Dnevnik rada";
  const period = item.from && item.to && item.from !== item.to ? `${formatDateOnlyLocal(item.from)} — ${formatDateOnlyLocal(item.to)}` : formatDateOnlyLocal(item.from || item.date || "");
  return `${type} · ${period || "bez datuma"} · ${item.site || "Sva gradilišta"}`;
}

async function archiveReportSilentlyForOfficeArchive(reportId) {
  const existingReport = directorReportsCache.find(r => String(r.id) === String(reportId));
  try {
    await directorRpcArchiveReport(reportId);
  } catch (error) {
    const { error: directError } = await sb
      .from("reports")
      .update({ status: "archived" })
      .eq("id", reportId)
      .eq("company_id", currentCompany.id);
    if (directError) throw (error || directError);
  }
  if (existingReport) saveLocalArchivedReport(existingReport);
  directorReportsCache = directorReportsCache.map(r => String(r.id) === String(reportId) ? { ...r, status: "archived", updated_at: new Date().toISOString() } : r);
}

async function archiveGeneratedOfficePreview(kind, previewId, from, to, site) {
  const box = document.getElementById(previewId);
  if (!box || !box.innerHTML.trim()) return toast("Prvo prikaži pregled, pa ga pošalji u arhivu.", true);
  const label = generatedOfficeArchiveLabel({ kind, from, to, site });
  const sourceReports = kind === "carnet"
    ? officeBuildCarnetData(from, to, site).reports
    : officeBuildDailyLogData(from, site).reports;
  const sourceIds = [...new Set((sourceReports || []).map(r => r.id).filter(Boolean))];
  if (!sourceIds.length) return toast("Nema izvornih izveštaja za arhiviranje.", true);
  if (!confirm(`Poslati u arhivu?\n\n${label}\n\nBiće arhivirano i sklonjeno iz aktivnog Dnevnika/Karneta: ${sourceIds.length} izveštaja.`)) return;
  try {
    for (const id of sourceIds) {
      await archiveReportSilentlyForOfficeArchive(id);
    }
    const list = loadOfficeGeneratedArchive();
    const item = {
      id: generatedOfficeArchiveId(kind, from, to, site),
      kind,
      from,
      to,
      site: site || "Sva gradilišta",
      label,
      html: box.innerHTML,
      source_report_ids: sourceIds,
      created_at: new Date().toISOString(),
      company_name: currentCompanyExportName()
    };
    list.unshift(item);
    saveOfficeGeneratedArchive(list);
    toast(`Pregled je poslat u arhivu. Arhivirano izveštaja: ${sourceIds.length}.`);
    if (kind === "carnet") renderCarnetPreview();
    else renderDailyLogPreview();
    renderArchiveList();
    businessUpdateReportsMetrics(directorReportsCache);
  } catch (e) {
    toast(e.message || String(e), true);
  }
}

function archiveDailyLogPreview() {
  const date = document.getElementById("dailyLogDate")?.value || today();
  const site = document.getElementById("dailyLogSite")?.value || "";
  archiveGeneratedOfficePreview("daily_log", "dailyLogPreview", date, date, site);
}

function archiveCarnetPreview() {
  const from = document.getElementById("carnetFrom")?.value || today();
  const to = document.getElementById("carnetTo")?.value || from;
  const site = document.getElementById("carnetSite")?.value || "";
  archiveGeneratedOfficePreview("carnet", "carnetPreview", from, to, site);
}

function officeGeneratedArchiveHtml(item = {}) {
  return `
    <article class="report-row-item report-document-card archive-report-card office-generated-archive-card">
      <div class="report-list-grid archive-list-grid">
        <div class="report-list-date">
          <strong>${escapeHtml(item.from || "")}</strong>
          <small>${escapeHtml(formatDateTimeLocal(item.created_at) || "")}</small>
        </div>
        <div class="report-list-site">
          <strong>${escapeHtml(item.site || "Sva gradilišta")}</strong>
          <small>${escapeHtml(item.kind === "carnet" ? "Karnet stavki" : "Dnevnik rada")}</small>
        </div>
        <div class="report-list-worker">
          <strong>${escapeHtml(item.company_name || currentCompanyExportName())}</strong>
          <small>${escapeHtml(item.label || "")}</small>
        </div>
        <div class="report-list-status">
          <span class="status-chip status-archived">Arhivirano</span>
          <small>kancelarijski pregled</small>
        </div>
      </div>
      <div class="report-card-actions no-print report-row-actions">
        <button class="secondary compact-doc-btn" type="button" onclick="openGeneratedOfficeArchive('${escapeHtml(item.id || "")}')">Otvori</button>
        <button class="secondary compact-doc-btn" type="button" onclick="printGeneratedOfficeArchive('${escapeHtml(item.id || "")}')">Štampaj</button>
        <button class="delete-btn compact-doc-btn" type="button" onclick="deleteGeneratedOfficeArchive('${escapeHtml(item.id || "")}')">Obriši trajno</button>
      </div>
    </article>`;
}

function findGeneratedOfficeArchive(id) {
  return loadOfficeGeneratedArchive().find(x => String(x.id) === String(id)) || null;
}

function openGeneratedOfficeArchive(id) {
  const item = findGeneratedOfficeArchive(id);
  if (!item) return toast("Arhivirana stavka nije pronađena.", true);
  const title = generatedOfficeArchiveLabel(item);
  const win = window.open("", "_blank", "width=1200,height=850");
  if (!win) return toast("Pregledač je blokirao prozor. Dozvoli popup.", true);
  win.document.open();
  win.document.write(`<!doctype html><html lang="sr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;margin:18px}h1{font-size:20px;margin:0 0 10px}.office-form-titlebar{display:flex;justify-content:space-between;gap:16px;border:1px solid #999;padding:10px;margin-bottom:12px}.office-form-titlebar b{display:block;font-size:18px}.office-form-titlebar span{font-size:12px}.office-badges{display:flex;gap:6px;flex-wrap:wrap}.office-badges span{border:1px solid #999;padding:4px 6px}h4{margin:14px 0 6px}.office-table{width:100%;border-collapse:collapse;font-size:10px}.office-table th,.office-table td{border:1px solid #777;padding:5px;vertical-align:top}.office-table th{background:#eee}.muted{color:#555}.office-empty{border:1px dashed #bbb;padding:8px}</style></head><body><h1>${escapeHtml(title)}</h1>${item.html || ""}</body></html>`);
  win.document.close();
}

function printGeneratedOfficeArchive(id) {
  const item = findGeneratedOfficeArchive(id);
  if (!item) return toast("Arhivirana stavka nije pronađena.", true);
  const title = generatedOfficeArchiveLabel(item);
  const win = window.open("", "_blank", "width=1200,height=850");
  if (!win) return toast("Pregledač je blokirao prozor za štampu. Dozvoli popup.", true);
  win.document.open();
  win.document.write(`<!doctype html><html lang="sr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;margin:18px}h1{font-size:20px;margin:0 0 10px}.office-form-titlebar{display:flex;justify-content:space-between;gap:16px;border:1px solid #999;padding:10px;margin-bottom:12px}.office-form-titlebar b{display:block;font-size:18px}.office-form-titlebar span{font-size:12px}.office-badges{display:flex;gap:6px;flex-wrap:wrap}.office-badges span{border:1px solid #999;padding:4px 6px}h4{margin:14px 0 6px}.office-table{width:100%;border-collapse:collapse;font-size:10px}.office-table th,.office-table td{border:1px solid #777;padding:5px;vertical-align:top}.office-table th{background:#eee}.muted{color:#555}.office-empty{border:1px dashed #bbb;padding:8px}</style></head><body><h1>${escapeHtml(title)}</h1>${item.html || ""}<script>window.onload=function(){setTimeout(function(){window.print()},250)};<\/script></body></html>`);
  win.document.close();
}

async function deleteGeneratedOfficeArchive(id) {
  const list = loadOfficeGeneratedArchive();
  const item = list.find(x => String(x.id) === String(id));
  if (!item) return toast("Arhivirana stavka nije pronađena.", true);
  const label = generatedOfficeArchiveLabel(item);
  const sourceIds = Array.isArray(item.source_report_ids) ? item.source_report_ids.filter(Boolean) : [];
  if (!confirm(`Da li ste sigurni da želite trajno obrisati ovu stavku?\n\n${label}\n\nBiće trajno obrisani i povezani izveštaji: ${sourceIds.length}.\n\nOva radnja briše stavke iz baze i ne može se vratiti.`)) return;
  try {
    for (const reportId of sourceIds) {
      await permanentlyDeleteReportInDatabase(reportId);
      rememberLocalPermanentlyDeletedReport(reportId);
      removeLocalArchivedReport(reportId);
      directorReportsCache = directorReportsCache.filter(r => String(r.id) !== String(reportId));
    }
    saveOfficeGeneratedArchive(list.filter(x => String(x.id) !== String(id)));
    toast("Arhivirana stavka i povezani izveštaji su trajno obrisani.");
    renderArchiveList();
    if (item.kind === "carnet") renderCarnetPreview?.();
    else renderDailyLogPreview?.();
    if (document.getElementById("tabOwner")?.classList.contains("active")) renderOwnerDashboard();
    businessUpdateReportsMetrics(directorReportsCache);
  } catch (e) {
    toast(e.message || String(e), true);
  }
}

window.archiveDailyLogPreview = archiveDailyLogPreview;
window.archiveCarnetPreview = archiveCarnetPreview;
window.openGeneratedOfficeArchive = openGeneratedOfficeArchive;
window.printGeneratedOfficeArchive = printGeneratedOfficeArchive;
window.deleteGeneratedOfficeArchive = deleteGeneratedOfficeArchive;

function renderDailyLogPreview() {
  officeEnsureDefaultDates();
  officeFillSiteDatalists();
  const date = document.getElementById("dailyLogDate")?.value || today();
  const site = document.getElementById("dailyLogSite")?.value || "";
  const data = officeBuildDailyLogData(date, site);
  const totalHours = data.workers.reduce((sum, r) => sum + parseDecimalInput(r[4]), 0);
  const totalFuel = data.fuels.reduce((sum, r) => sum + parseDecimalInput(r[3]), 0);
  const totalWater = (data.waters || []).reduce((sum, r) => sum + parseDecimalInput(r[7]), 0);
  const box = document.getElementById("dailyLogPreview");
  if (!box) return;
  box.innerHTML = `
    <div class="office-form-titlebar">
      <div><b>Dnevnik rada</b><span>${escapeHtml(formatDateOnlyLocal(date))} · ${escapeHtml(site || "Sva gradilišta")}</span></div>
      <div class="office-badges"><span>${data.reports.length} izveštaja</span><span>${data.workers.length} radnika</span><span>${totalHours || 0} h</span><span>${Math.round(totalFuel * 100) / 100} L goriva</span><span>${Math.round(totalWater * 100) / 100} L vode</span><button class="secondary small-action office-archive-inline" type="button" onclick="archiveDailyLogPreview()">📦 U arhivu</button></div>
    </div>
    <section><h4>👷 Radnici i radni sati</h4>${officeTable(["Gradilište","Evid. broj","Radnik","Radno mesto","Sati","Opis rada"], data.workers)}</section>
    <section><h4>🚜 Mašine / MTČ</h4>${officeTable(["Gradilište","Broj","Mašina","Operator","MTČ početak","MTČ kraj","Ukupno MTČ","Ukupno KM","Rad"], data.machines)}</section>
    <section><h4>🚚 Vozila / kamioni</h4>${officeTable(["Gradilište","Broj","Vozilo","Registracija","Vozač","KM poč.","KM kraj","Relacija","Ture","m³"], data.vehicles)}</section>
    <section><h4>🚛 Labudica / transport mašine</h4>${officeTable(["Gradilište","Tablice","Prevezena mašina","Vozač","Od","Do","KM poč.","KM kraj","Ukupno KM","Napomena"], data.lowloaders || [])}</section>
    <section><h4>💧 Cisterna za vodu</h4>${officeTable(["Gradilište","Broj","Cisterna","Vozač","KM poč.","KM kraj","Ukupno KM","Litara vode","Punjenja","Punjenje","Istovar/prskanje","Namena","Napomena"], data.waters || [])}</section>
    <section><h4>⛽ Gorivo</h4>${officeTable(["Gradilište","Broj","Sredstvo","L","KM","MTČ","Sipao","Primio","Izvor"], data.fuels)}</section>
    <section><h4>📦 Materijali</h4>${officeTable(["Gradilište","Radnja","Materijal","Ture","Količina","Jed.","Napomena"], data.materials)}</section>
    <section><h4>🛠️ Kvarovi</h4>${officeTable(["Gradilište","Broj","Sredstvo","Opis kvara","Hitnost","Status"], data.defects)}</section>
  `;
}


let siteBossOverviewCache = null;

function siteBossMetricSet(data = null, loadingText = "—") {
  const box = $("#siteBossOverviewMetrics");
  if (!box) return;
  if (!data) {
    box.innerHTML = `<span>Izveštaji: ${escapeHtml(loadingText)}</span><span>Radnici: ${escapeHtml(loadingText)}</span><span>MTČ: ${escapeHtml(loadingText)}</span><span>KM: ${escapeHtml(loadingText)}</span><span>Gorivo: ${escapeHtml(loadingText)}</span><span>Materijal: ${escapeHtml(loadingText)}</span>`;
    return;
  }
  const totalHours = data.workers.reduce((sum, r) => sum + parseDecimalInput(r[4]), 0);
  const totalMtc = data.machines.reduce((sum, r) => sum + parseDecimalInput(r[6]), 0);
  const totalKm = data.vehicles.reduce((sum, r) => sum + parseDecimalInput(decimalDiffText(r[5], r[6])) + parseDecimalInput(r[6] && !r[5] ? r[6] : 0), 0);
  const totalFuel = data.fuels.reduce((sum, r) => sum + parseDecimalInput(r[3]), 0);
  const totalM3 = data.materials.reduce((sum, r) => sum + parseDecimalInput(r[4]), 0)
    + data.vehicles.reduce((sum, r) => sum + parseDecimalInput(r[9]), 0);
  box.innerHTML = `
    <span>Izveštaji: ${data.reports.length}</span>
    <span>Radnici: ${data.workers.length}${totalHours ? ` · ${Math.round(totalHours * 100) / 100} h` : ""}</span>
    <span>MTČ: ${Math.round(totalMtc * 100) / 100}</span>
    <span>KM: ${Math.round(totalKm * 100) / 100}</span>
    <span>Gorivo: ${Math.round(totalFuel * 100) / 100} L</span>
    <span>Materijal: ${Math.round(totalM3 * 100) / 100} m³</span>`;
}

function siteBossBuildOverviewFromReports(reports = [], date = today(), site = "") {
  const previousCache = directorReportsCache;
  try {
    directorReportsCache = Array.isArray(reports) ? reports : [];
    return officeBuildDailyLogData(date, site);
  } finally {
    directorReportsCache = previousCache;
  }
}

function siteBossOverviewSummaryText(data = siteBossOverviewCache, date = $("#siteLogDate")?.value || today(), site = $("#siteLogSite")?.value || "") {
  if (!data) return "";
  const totalHours = data.workers.reduce((sum, r) => sum + parseDecimalInput(r[4]), 0);
  const totalMtc = data.machines.reduce((sum, r) => sum + parseDecimalInput(r[6]), 0);
  const totalFuel = data.fuels.reduce((sum, r) => sum + parseDecimalInput(r[3]), 0);
  const totalTours = data.vehicles.reduce((sum, r) => sum + parseDecimalInput(r[8]), 0);
  const parts = [];
  parts.push(`Dana ${formatDateOnlyLocal(date) || date} na gradilištu ${site || "izabrano gradilište"} evidentirano je ${data.workers.length} radničkih stavki${totalHours ? ` sa ukupno ${Math.round(totalHours * 100) / 100} sati` : ""}.`);
  if (data.machines.length) parts.push(`Angažovano je ${data.machines.length} mašinskih stavki${totalMtc ? ` sa ukupno ${Math.round(totalMtc * 100) / 100} MTČ` : ""}.`);
  if (data.vehicles.length) parts.push(`Evidentirano je ${data.vehicles.length} voznih/kamionskih stavki${totalTours ? ` i ${Math.round(totalTours * 100) / 100} tura` : ""}.`);
  if (data.fuels.length) parts.push(`Ukupno goriva po izveštajima: ${Math.round(totalFuel * 100) / 100} L.`);
  if (data.materials.length) parts.push(`Materijalne stavke: ${data.materials.length}.`);
  if (data.defects.length) parts.push(`Prijavljeni kvarovi/problemi: ${data.defects.length}.`);
  return parts.join(" ");
}

function renderSiteBossOverview(data, date, site) {
  const box = $("#siteBossOverviewBox");
  if (!box) return;
  siteBossOverviewCache = data;
  siteBossMetricSet(data);
  const header = `<div class="office-form-titlebar"><div><b>Pregled za šefa gradilišta</b><span>${escapeHtml(formatDateOnlyLocal(date) || date)} · ${escapeHtml(site || "Sva gradilišta")}</span></div><div class="office-badges"><span>${data.reports.length} izveštaja</span><span>${data.defects.length} kvarova</span></div></div>`;
  box.innerHTML = header + `
    <section><h4>👷 Radnici i sati</h4>${officeTable(["Gradilište","Evid. broj","Radnik","Radno mesto","Sati","Opis"], data.workers)}</section>
    <section><h4>🚜 Mašine / MTČ</h4>${officeTable(["Gradilište","Broj","Mašina","Operator","MTČ poč.","MTČ kraj","Ukupno MTČ","KM","Rad"], data.machines)}</section>
    <section><h4>🚚 Vozila / ture</h4>${officeTable(["Gradilište","Broj","Vozilo","Reg.","Vozač","KM poč.","KM kraj","Relacija","Ture","m³"], data.vehicles)}</section>
    <section><h4>⛽ Gorivo</h4>${officeTable(["Gradilište","Broj","Sredstvo","Litara","KM","MTČ","Sipao/cisterna","Primio"], data.fuels)}</section>
    <section><h4>📦 Materijal</h4>${officeTable(["Gradilište","Radnja","Materijal","Ture","Količina","Jed.","Napomena"], data.materials)}</section>
    <section><h4>🛠️ Kvarovi</h4>${officeTable(["Gradilište","Broj","Sredstvo","Opis","Hitnost","Status"], data.defects)}</section>`;
}

async function refreshSiteBossOverview() {
  const box = $("#siteBossOverviewBox");
  try {
    if (!currentWorker?.company_id) throw new Error("Nema aktivne firme za ovog korisnika.");
    const date = $("#siteLogDate")?.value || today();
    const site = $("#siteLogSite")?.value || "";
    if (box) box.innerHTML = `<p class="muted">Učitavam poslate izveštaje za ${escapeHtml(formatDateOnlyLocal(date) || date)}...</p>`;
    siteBossMetricSet(null, "učitavam");
    const { data, error } = await sb
      .from("reports")
      .select("id, company_id, report_date, status, data, submitted_at, created_at")
      .eq("company_id", currentWorker.company_id)
      .eq("report_date", date)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    const clean = (Array.isArray(data) ? data : []).filter(r => !isArchivedReport(r));
    const overview = siteBossBuildOverviewFromReports(clean, date, site);
    renderSiteBossOverview(overview, date, site);
  } catch (e) {
    siteBossMetricSet(null, "nije dostupno");
    if (box) box.innerHTML = `<div class="site-boss-warning"><b>Pregled nije učitan.</b><br>${escapeHtml(e.message || e)}<br><span class="muted">Ako Supabase RLS ne dozvoljava šefu gradilišta da čita izveštaje firme, treba dodati posebnu RPC/SQL dozvolu za ovu ulogu. Dnevnik gradilišta i dalje može da se popuni ručno i pošalje Upravi.</span></div>`;
  }
}

function copySiteBossSummaryToDailyLog() {
  const text = siteBossOverviewSummaryText();
  if (!text) return toast("Prvo osveži pregled gradilišta.", true);
  const area = $("#siteLogDescription");
  if (!area) return;
  const existing = area.value.trim();
  area.value = existing ? `${existing}\n\n${text}` : text;
  toast("Kratak opis iz pregleda je ubačen u Dnevnik gradilišta.");
}

function officeBuildCarnetData(from, to, site) {
  const workerRows = [];
  const assetRows = [];
  const syntheticWorkers = new Set();
  (directorReportsCache || []).filter(r => officeReportMatchesDateSite(r, from, to, site)).forEach(r => {
    const d = r.data || {};
    const reportSite = officeReportSite(r) || "—";
    const date = officeReportDate(r);
    const reportPerson = officePersonLabel(r);
    const workerRowsRaw = Array.isArray(d.workers) ? d.workers : (Array.isArray(d.worker_entries) ? d.worker_entries : []);

    if (workerRowsRaw.length) {
      workerRowsRaw.forEach(w => {
        const rowSite = w.site_name || w.site || reportSite;
        if (!officeEntryMatchesSite({ site_name: rowSite }, reportSite, site)) return;
        workerRows.push([date, rowSite || reportSite, w.employee_number || w.worker_number || "", w.full_name || [w.first_name, w.last_name].filter(Boolean).join(" ") || reportPerson, w.function_title || w.role || "", w.hours || "", d.description || w.description || w.note || ""]);
      });
    } else if ((d.hours || d.description) && (!site || officeEntryMatchesSite({ site_name: reportSite }, reportSite, site))) {
      workerRows.push([date, reportSite, reportEmployeeNumber(r) || "", reportPerson, r.company_users?.function_title || d.function_title || "", d.hours || "", d.description || ""]);
    }

    (Array.isArray(d.machines) ? d.machines : []).forEach(m => {
      if (!officeEntryMatchesSite(m, reportSite, site)) return;
      const entrySite = officeEntrySiteName(m, reportSite) || reportSite;
      assetRows.push([date, entrySite, "Mašina", m.asset_code || m.machine_code || "", m.name || d.machine || "", reportPerson, machineMtcTotal(m), machineKmTotal(m), "", "", "", officeEntryDescription(m, "Rad mašine / MTČ")]);
      if (!workerRowsRaw.length && !d.hours) officePushSyntheticWorker(workerRows, syntheticWorkers, date, entrySite, r, "Rad mašine / MTČ", machineMtcTotal(m));
    });

    (Array.isArray(d.vehicles) ? d.vehicles : []).forEach(v => {
      const rows = vehicleTourOfficeRows(v, reportSite).filter(row => vehicleTourMatchesFilter(row, site));
      rows.forEach(row => {
        assetRows.push([date, row.site_name, "Vozilo", row.asset_code || "", row.vehicle || d.vehicle || "", reportPerson, "", row.km_total || "", row.tours || "", row.material || "", "", row.action ? `${row.action} · ${row.route || ""}` : (row.route || "")]);
        if (!workerRowsRaw.length && !d.hours) officePushSyntheticWorker(workerRows, syntheticWorkers, date, row.site_name, r, "Vožnja / ture", "");
      });
    });

    officeLowloaderEntries(d).forEach(ll => {
      if (!officeEntryMatchesSite({ site_name: lowloaderSiteLabel(ll, reportSite) }, reportSite, site)) return;
      const entrySite = lowloaderSiteLabel(ll, reportSite) || reportSite;
      assetRows.push([date, entrySite, "Labudica", ll.plates || ll.registration || "", ll.machine || ll.machine_name || ll.transported_machine || "", reportPerson, "", lowloaderKmTotal(ll), "1", "", "", [ll.from_site || ll.from_address, ll.to_site || ll.to_address, ll.accompanying_tools || ll.tools || ll.note].filter(Boolean).join(" → ")]);
      if (!workerRowsRaw.length && !d.hours) officePushSyntheticWorker(workerRows, syntheticWorkers, date, entrySite, r, "Transport mašine labudicom", "");
    });

    officeWaterEntries(d).forEach(wt => {
      if (!officeEntryMatchesSite(wt, reportSite, site)) return;
      const entrySite = officeEntrySiteName(wt, reportSite) || reportSite;
      assetRows.push([date, entrySite, "Cisterna za vodu", wt.asset_code || wt.vehicle_code || "", wt.vehicle || wt.asset_name || wt.tanker_vehicle || "", reportPerson, "", waterTankerKmTotal(wt), waterTankerLoads(wt) || "", "Voda", waterTankerLiters(wt) || "", [waterTankerPurposeLabel(wt.purpose), wt.fill_location && `punjenje: ${wt.fill_location}`, (wt.unload_location || wt.spray_location) && `istovar/prskanje: ${wt.unload_location || wt.spray_location}`, wt.note].filter(Boolean).join(" · ")]);
      if (!workerRowsRaw.length && !d.hours) officePushSyntheticWorker(workerRows, syntheticWorkers, date, entrySite, r, "Cisterna za vodu", "");
    });
  });
  return { workerRows, assetRows };
}


function renderCarnetPreview() {
  officeEnsureDefaultDates();
  officeFillSiteDatalists();
  const from = document.getElementById("carnetFrom")?.value || today();
  const to = document.getElementById("carnetTo")?.value || from;
  const site = document.getElementById("carnetSite")?.value || "";
  const data = officeBuildCarnetData(from, to, site);
  const totalHours = data.workerRows.reduce((sum, r) => sum + parseDecimalInput(r[5]), 0);
  const totalMtc = data.assetRows.reduce((sum, r) => sum + parseDecimalInput(r[6]), 0);
  const totalKm = data.assetRows.reduce((sum, r) => sum + parseDecimalInput(r[7]), 0);
  const totalTours = data.assetRows.reduce((sum, r) => sum + parseDecimalInput(r[8]), 0);
  const totalWater = data.assetRows.filter(r => String(r[2] || "").toLowerCase().includes("voda")).reduce((sum, r) => sum + parseDecimalInput(r[10]), 0);
  const totalLowloader = data.assetRows.filter(r => String(r[2] || "").toLowerCase().includes("labudica")).length;
  const box = document.getElementById("carnetPreview");
  if (!box) return;
  box.innerHTML = `
    <div class="office-form-titlebar">
      <div><b>Karnet radnika i mehanizacije</b><span>${escapeHtml(formatDateOnlyLocal(from))} — ${escapeHtml(formatDateOnlyLocal(to))} · ${escapeHtml(site || "Sva gradilišta")}</span></div>
      <div class="office-badges"><span>${data.workerRows.length} radnik-redova</span><span>${totalHours || 0} h</span><span>${data.assetRows.length} sredstava</span><span>${Math.round(totalMtc * 100) / 100} MTČ</span><span>${Math.round(totalKm * 100) / 100} km</span><span>${Math.round(totalTours * 100) / 100} tura/punjenja</span><span>${Math.round(totalWater * 100) / 100} L vode</span><span>${totalLowloader} transporta</span><button class="secondary small-action office-archive-inline" type="button" onclick="archiveCarnetPreview()">📦 U arhivu</button></div>
    </div>
    <section><h4>📒 Karnet radnika</h4>${officeTable(["Datum","Gradilište","Evid. broj","Radnik","Radno mesto","Sati","Opis"], data.workerRows)}</section>
    <section><h4>🚜 Karnet mehanizacije / vozila</h4>${officeTable(["Datum","Gradilište","Tip","Broj","Sredstvo","Rukovalac/vozač","MTČ","KM","Ture","Materijal","m³","Opis/relacija"], data.assetRows)}</section>
  `;
}

function officeCsvDownload(filename, headers, rows) {
  const csv = "\ufeff" + [headers, ...rows].map(row => row.map(v => csvEscape(excelCleanCell(v))).join(";")).join("\r\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
}

function downloadDailyLogCsv() {
  const date = document.getElementById("dailyLogDate")?.value || today();
  const site = document.getElementById("dailyLogSite")?.value || "";
  const data = officeBuildDailyLogData(date, site);
  const rows = [];
  data.workers.forEach(r => rows.push(["Radnici", ...r]));
  data.machines.forEach(r => rows.push(["Mašine", ...r]));
  data.vehicles.forEach(r => rows.push(["Vozila", ...r]));
  (data.lowloaders || []).forEach(r => rows.push(["Labudica", ...r]));
  (data.waters || []).forEach(r => rows.push(["Voda", ...r]));
  data.fuels.forEach(r => rows.push(["Gorivo", ...r]));
  data.materials.forEach(r => rows.push(["Materijali", ...r]));
  data.defects.forEach(r => rows.push(["Kvarovi", ...r]));
  if (!rows.length) return toast("Nema podataka za Dnevnik rada u izabranom filteru.", true);
  officeCsvDownload(`dnevnik_rada_${safeFilePart(currentCompany?.company_code || "firma")}_${date}.csv`, ["Rubrika","Kolona 1","Kolona 2","Kolona 3","Kolona 4","Kolona 5","Kolona 6","Kolona 7","Kolona 8","Kolona 9","Kolona 10","Kolona 11","Kolona 12","Kolona 13"], rows);
}

function downloadCarnetCsv() {
  const from = document.getElementById("carnetFrom")?.value || today();
  const to = document.getElementById("carnetTo")?.value || from;
  const site = document.getElementById("carnetSite")?.value || "";
  const data = officeBuildCarnetData(from, to, site);
  const rows = [];
  data.workerRows.forEach(r => rows.push(["Karnet radnika", ...r]));
  data.assetRows.forEach(r => rows.push(["Karnet mehanizacije", ...r]));
  if (!rows.length) return toast("Nema podataka za Karnet u izabranom filteru.", true);
  officeCsvDownload(`karnet_${safeFilePart(currentCompany?.company_code || "firma")}_${from}_${to}.csv`, ["Rubrika","Datum","Gradilište","Broj/Tip","Naziv/Radnik","Radno mesto/Sredstvo","Sati/Rukovalac","Opis/MTČ","KM","Ture","Materijal","m³","Napomena"], rows);
}

function printOfficePreview(title, previewId) {
  const box = document.getElementById(previewId);
  if (!box || !box.innerHTML.trim()) return toast("Prvo prikaži pregled, pa pokreni štampu.", true);
  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) return toast("Pregledač je blokirao prozor za štampu. Dozvoli popup.", true);
  win.document.open();
  win.document.write(`<!doctype html><html lang="sr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;margin:18px}h1{font-size:20px;margin:0 0 10px}.office-form-titlebar{display:flex;justify-content:space-between;gap:16px;border:1px solid #ccc;padding:10px;margin-bottom:12px}.office-form-titlebar b{display:block;font-size:18px}.office-form-titlebar span{font-size:12px}.office-badges{display:flex;gap:6px;flex-wrap:wrap}.office-badges span{border:1px solid #999;padding:4px 6px;border-radius:12px}h4{margin:14px 0 6px}.office-table{width:100%;border-collapse:collapse;font-size:10px}.office-table th,.office-table td{border:1px solid #aaa;padding:5px;vertical-align:top}.office-table th{background:#eee}.muted{color:#555}.office-empty{border:1px dashed #bbb;padding:8px}</style></head><body><h1>${escapeHtml(currentCompanyExportName())} · ${escapeHtml(title)}</h1>${box.innerHTML}<script>window.onload=function(){setTimeout(function(){window.print()},250)};<\/script></body></html>`);
  win.document.close();
}

window.renderDailyLogPreview = renderDailyLogPreview;
window.renderCarnetPreview = renderCarnetPreview;
window.downloadDailyLogCsv = downloadDailyLogCsv;
window.downloadCarnetCsv = downloadCarnetCsv;
window.printDailyLogPreview = () => printOfficePreview("Dnevnik rada", "dailyLogPreview");
window.printCarnetPreview = () => printOfficePreview("Karnet", "carnetPreview");


function renderDirectorDefectNoticeInReports() {
  const listBox = $("#reportsList");
  if (!listBox) return;
  const defects = directorReportsCache.filter(isActiveDefectReport);
  if (!defects.length) return;
  const dailyReports = directorReportsCache.filter(r => !isDefectOnlyReport(r) && !isFuelDashboardOnlyReport(r) && hasDailyReportData(r));
  const notice = document.createElement("div");
  notice.className = "item report-item defect-alert-notice";
  notice.innerHTML = `<strong>🚨 Ima ${defects.length} prijavljenih kvarova</strong><p class="muted">Kvarovi nisu u listi dnevnih izveštaja. Klikni podtab <b>Kvarovi</b> u ovom ekranu da vidiš prijave kvarova.</p><button class="secondary small-action" type="button" data-business-tab="defects">Otvori kvarove</button>`;
  if (dailyReports.length) listBox.prepend(notice);
  else listBox.innerHTML = notice.outerHTML;
}

function defectHtml(r) {
  const d = r.data || {};
  const person = r.company_users ? `${r.company_users.first_name} ${r.company_users.last_name}` : (d.created_by_worker || "Nepoznat zaposleni");
  const employeeNumber = reportEmployeeNumber(r);
  const status = d.defect_status || "prijavljen";
  const reportedAt = d.defect_reported_at || r.submitted_at || r.created_at;
  const assetName = [d.defect_asset_code, d.defect_asset_name || d.defect_machine || d.machine || d.vehicle || (Array.isArray(d.machines) && d.machines[0]?.name) || (Array.isArray(d.vehicles) && d.vehicles[0]?.name)].filter(Boolean).join(" · ") || "—";

  return `
    <div class="item report-item defect-item defect-work-card">
      <strong>🚨 KVAR · ${escapeHtml(d.defect_urgency || "prijavljen")}</strong>
      ${d.sent_immediately ? `<span class="pill danger-pill">Evidentirano odmah · vidi Direkcija i Šef mehanizacije</span>` : ""}
      <small>${escapeHtml([employeeNumber ? `broj ${employeeNumber}` : "", person, r.company_users?.function_title || d.function_title || "", r.report_date || ""].filter(Boolean).join(" · "))}</small><br/>
      <span class="pill">Prijavljeno: ${escapeHtml(formatDateTimeLocal(reportedAt))}</span>
      <span class="pill">Status: ${escapeHtml(status)}</span>
      <span class="pill">Gradilište/lokacija: ${escapeHtml(d.defect_site_name || d.site_name || "bez gradilišta")}</span>
      <span class="pill">Sredstvo: ${escapeHtml(assetName)}</span>
      ${d.defect_work_impact ? `<span class="pill">Uticaj na rad: ${escapeHtml(d.defect_work_impact === "zaustavlja_rad" ? "Zaustavlja rad" : d.defect_work_impact === "moze_nastaviti" ? "Može nastaviti rad" : d.defect_work_impact)}</span>` : ""}
      ${d.called_mechanic_by_phone ? `<span class="pill">Odgovorno lice mehanizacije pozvano: ${escapeHtml(d.called_mechanic_by_phone)}</span>` : ""}
      <p>${escapeHtml(d.defect || "Bez opisa kvara")}</p>
      ${defectImagesHtml(d)}
      <div class="report-kv">
        <b>Status mehanizacije</b><span>${escapeHtml(d.mechanic_status || d.defect_status || "novo")}</span>
        <b>Šef mehanizacije</b><span>${escapeHtml(d.mechanic_updated_by || "—")}</span>
        <b>Napomena</b><span>${escapeHtml(d.mechanic_note || "—")}</span>
        <b>Primljeno</b><span>${escapeHtml(formatDateTimeLocal(d.defect_received_at))}</span>
        <b>Početak popravke</b><span>${escapeHtml(formatDateTimeLocal(d.defect_repair_started_at))}</span>
        <b>Rešeno</b><span>${escapeHtml(formatDateTimeLocal(d.defect_resolved_at))}</span>
      </div>
      ${defectTimelineHtml(d)}
      <div class="actions defect-actions no-print">
        <button class="primary" onclick="openReportDocumentCenter('${r.id}')">Otvori dokument</button>
        <button class="secondary" onclick="printReportDocument('${r.id}')">Štampaj kvar</button>
        ${isArchivedReport(r) ? `<span class="pill">Arhivirano</span>` : `<button class="archive-report-btn" onclick="archiveReport('${r.id}')">📦 Arhiviraj kvar</button>`}
      </div>
    </div>`;
}

function renderDefectsList() {
  const box = $("#defectsList");
  if (!box) return;
  const defects = directorReportsCache.filter(isActiveDefectReport);
  const archivedDefects = directorReportsCache.filter(r => hasDefectData(r) && isArchivedReport(r));
  const summary = `<div class="defects-summary no-print"><b>Aktivni kvarovi: ${defects.length}</b><span>Arhivirani kvarovi: ${archivedDefects.length}</span><span>Za štampu otvori kvar ili klikni “Štampaj kvar”.</span></div>`;
  box.innerHTML = summary + (defects.map(defectHtml).join("") || `<p class="muted">Nema aktivnih prijavljenih kvarova. Arhivirani kvarovi su u kartici Arhiva.</p>`);
}


function fieldTankerEntryReadingMode(entry = {}, asset = null) {
  const unit = asset ? assetFuelNormUnit(asset) : "";
  const kind = String(entry.asset_kind || entry.asset_type || asset?.asset_type || "").toLowerCase();
  if (unit === "l_per_100km") return "km";
  if (unit === "l_per_hour" || unit === "l_per_mtc") return "mtc";
  if (kind.includes("vehicle") || kind.includes("voz")) return "km";
  return parseDecimalInput(entry.km || entry.current_km) ? "km" : "mtc";
}

function fieldTankerEntryReadingValue(entry = {}, mode = "mtc") {
  if (mode === "km") return parseDecimalInput(entry.km || entry.current_km || entry.kilometers || entry.odometer || (entry.asset_kind === "vehicle" ? (entry.reading || entry.mtc_km) : ""));
  return parseDecimalInput(entry.mtc || entry.current_mtc || entry.machine_mtc || (entry.asset_kind === "machine" ? (entry.reading || entry.mtc_km) : ""));
}

function fieldTankerEntryMatchKeys(entry = {}, asset = null) {
  return [
    asset?.id, entry.asset_id,
    asset?.asset_code, asset?.machine_code, asset?.vehicle_code, entry.asset_code, entry.machine_code, entry.vehicle_code,
    asset?.registration, entry.asset_registration, entry.registration,
    asset?.name, asset?.asset_name, asset?.machine, asset?.vehicle, entry.asset_name, entry.machine, entry.vehicle, entry.other, entry.manual_asset_name, entry.asset_custom
  ].map(v => normalizeVehicleSearch(v || "")).filter(Boolean);
}

function fieldTankerEntriesFromReportData(d = {}) {
  const out = [];
  if (Array.isArray(d.fuel_entries)) out.push(...d.fuel_entries);
  if (Array.isArray(d.field_tanker_entries)) out.push(...d.field_tanker_entries);
  else if (Array.isArray(d.tanker_fuel_entries)) out.push(...d.tanker_fuel_entries);
  return out;
}

function reportTimeMs(r = {}) {
  const raw = r.submitted_at || r.created_at || r.updated_at || r.report_date || "";
  const t = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

function previousFuelReadingForEntry(entry = {}, currentReport = {}) {
  const lookup = buildDirectorAssetLookup();
  const asset = findDirectorAssetForEntry(entry, lookup);
  const keys = fieldTankerEntryMatchKeys(entry, asset);
  if (!keys.length) return { asset, previous: null };
  const mode = fieldTankerEntryReadingMode(entry, asset);
  const currentTime = reportTimeMs(currentReport) || Date.now();
  let best = null;
  (directorReportsCache || []).forEach(rep => {
    if (!rep || rep.id === currentReport.id) return;
    const t = reportTimeMs(rep);
    if (t && currentTime && t >= currentTime) return;
    const d = rep.data || {};
    fieldTankerEntriesFromReportData(d).forEach(prev => {
      const prevAsset = findDirectorAssetForEntry(prev, lookup);
      const prevKeys = fieldTankerEntryMatchKeys(prev, prevAsset);
      const matched = prevKeys.some(k => keys.includes(k));
      if (!matched) return;
      const reading = fieldTankerEntryReadingValue(prev, mode);
      if (!reading) return;
      if (!best || t > best.time) {
        best = { reading, time: t, report: rep, entry: prev };
      }
    });
  });
  return { asset, previous: best, mode };
}

function calculateTankerEntryConsumption(entry = {}, currentReport = {}) {
  const { asset, previous, mode } = previousFuelReadingForEntry(entry, currentReport);
  const readingMode = mode || fieldTankerEntryReadingMode(entry, asset);
  const current = fieldTankerEntryReadingValue(entry, readingMode);
  const liters = parseDecimalInput(entry.liters || entry.fuel_liters);
  const norm = assetFuelNormValue(asset || {});
  const tolerance = assetFuelToleranceValue(asset || {});
  const unit = assetFuelNormUnit(asset || {});
  const previousValue = previous?.reading || 0;
  const delta = current && previousValue ? current - previousValue : 0;
  let rate = 0;
  let expected = 0;
  let status = { label: "Nema dovoljno podataka", cls: "" };
  if (delta > 0 && liters > 0) {
    rate = readingMode === "km" ? (liters / delta * 100) : (liters / delta);
    if (norm) {
      expected = unit === "l_per_100km" || readingMode === "km" ? (delta * norm / 100) : (delta * norm);
      const diffPct = expected ? Math.abs(liters - expected) / expected * 100 : 0;
      if (diffPct <= tolerance) status = { label: "U normi", cls: "consumption-status-ok" };
      else status = { label: liters > expected ? "Povećana potrošnja" : "Manje od norme", cls: liters > expected ? "consumption-status-bad" : "consumption-status-warn" };
    } else {
      status = { label: "Izračunato bez norme", cls: "consumption-status-warn" };
    }
  } else if (!previousValue) {
    status = { label: "Prvo sipanje / nema prethodnog stanja", cls: "" };
  } else if (delta <= 0) {
    status = { label: "Proveri KM/MTČ", cls: "consumption-status-warn" };
  }
  return { asset, mode: readingMode, current, previous: previousValue, delta, liters, rate, expected, norm, tolerance, status };
}

function formatFuelCalcNumber(n, suffix = "") {
  const x = Number(n || 0);
  if (!Number.isFinite(x) || !x) return "—";
  return `${Math.round(x * 100) / 100}${suffix}`;
}

function tankerConsumptionTableHtml(entries = [], report = {}, compact = false) {
  if (!entries.length) return "";
  const rows = entries.map((entry, i) => {
    const calc = calculateTankerEntryConsumption(entry, report);
    const assetLabel = fuelAnalysisAssetLabel(calc.asset, entry);
    const modeLabel = calc.mode === "km" ? "KM" : "MTČ";
    const rateSuffix = calc.mode === "km" ? " L/100km" : " L/MTČ";
    const normText = calc.norm ? `${formatFuelCalcNumber(calc.norm)} ${fuelNormUnitLabel(assetFuelNormUnit(calc.asset || {}))}` : "Nema norme";
    return `<tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(assetLabel)}</td>
      <td>${escapeHtml(modeLabel)}</td>
      <td>${escapeHtml(formatFuelCalcNumber(calc.previous))}</td>
      <td>${escapeHtml(formatFuelCalcNumber(calc.current))}</td>
      <td>${escapeHtml(formatFuelCalcNumber(calc.delta))}</td>
      <td>${escapeHtml(formatFuelCalcNumber(calc.liters, " L"))}</td>
      <td>${escapeHtml(formatFuelCalcNumber(calc.rate, rateSuffix))}</td>
      <td>${escapeHtml(normText)}</td>
      <td>${escapeHtml(formatFuelCalcNumber(calc.expected, " L"))}</td>
      <td><span class="${escapeHtml(calc.status.cls)}">${escapeHtml(calc.status.label)}</span></td>
    </tr>`;
  }).join("");
  return `<div class="tanker-consumption-box">
    <h5>📊 Potrošnja po sredstvu</h5>
    <p class="field-hint">Računa se odmah iz poslednjeg prethodnog KM/MTČ stanja, trenutnog stanja i sipanih litara. Ako nema prethodnog stanja, prikazuje se upozorenje.</p>
    <div class="office-table-wrap"><table class="office-table tanker-consumption-table">
      <thead><tr><th>#</th><th>Sredstvo</th><th>Osnova</th><th>Prethodno</th><th>Trenutno</th><th>Razlika</th><th>Sipano</th><th>Potrošnja</th><th>Norma</th><th>Očekivano</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
}

function fuelReportHtml(r, fuelKind = "worker") {
  const d = r.data || {};
  const person = reportDocumentPerson(r);
  const submitted = formatDateTimeLocal(r.submitted_at || r.created_at);
  const liters = Math.round(businessCollectFuelLiters(d) * 100) / 100;
  const fuelEntries = Array.isArray(d.fuel_entries) ? d.fuel_entries : [];
  const fieldEntries = Array.isArray(d.field_tanker_entries)
    ? d.field_tanker_entries
    : (Array.isArray(d.tanker_fuel_entries) ? d.tanker_fuel_entries : []);
  const entries = fuelKind === "tanker" ? fieldEntries : fuelEntries;
  const sites = [...new Set(entries.map(x => x && x.site_name).filter(Boolean))];
  const title = fuelKind === "tanker"
    ? `Gorivo cisterna · ${fieldEntries.length || 1} sipanje/a`
    : `Gorivo radnici · ${fuelEntries.length || 1} sipanje/a`;
  const archiveLabel = fuelKind === "tanker" ? "📦 Arhiviraj cisternu" : "📦 Arhiviraj gorivo radnika";
  return `
    <article class="report-row-item report-document-card fuel-report-card fuel-report-card-${escapeHtml(fuelKind)}">
      <div class="report-list-grid">
        <div class="report-list-date">
          <strong>${escapeHtml(r.report_date || "")}</strong>
          <small>${escapeHtml(submitted || "")}</small>
        </div>
        <div class="report-list-site">
          <strong>${escapeHtml(sites.join(", ") || d.site_name || (fuelKind === "tanker" ? "Gorivo cisterna" : "Gorivo radnici"))}</strong>
          <small>${escapeHtml(title)}</small>
        </div>
        <div class="report-list-worker">
          <strong>${escapeHtml(person)}</strong>
          <small>${escapeHtml([reportEmployeeNumber(r) ? `broj ${reportEmployeeNumber(r)}` : "", r.company_users?.function_title || d.function_title || ""].filter(Boolean).join(" · "))}</small>
        </div>
        <div class="report-list-status">
          <span class="status-chip">${escapeHtml(liters ? `${liters} L` : "Gorivo")}</span>
          <small>${escapeHtml(reportStatusLabel(r.status))}</small>
        </div>
      </div>
      ${fuelKind === "tanker" ? tankerConsumptionTableHtml(entries, r, true) : ""}
      <div class="report-card-actions no-print report-row-actions fuel-row-actions">
        <button class="secondary compact-doc-btn" type="button" onclick="openReportDocumentCenter('${r.id}')">Otvori</button>
        <button class="archive-report-btn compact-doc-btn" type="button" onclick="archiveReport('${r.id}')">${archiveLabel}</button>
      </div>
    </article>`;
}


function assetLookupKeyParts(asset = {}) {
  return [getAssetCode(asset), asset?.asset_code, asset?.machine_code, asset?.vehicle_code, asset?.tanker_asset_code, asset?.name, asset?.asset_name, asset?.machine, asset?.vehicle, asset?.other, asset?.registration]
    .map(v => String(v || "").trim())
    .filter(Boolean);
}

function buildDirectorAssetLookup() {
  const map = new Map();
  (directorAssetsCache || []).forEach(asset => {
    assetLookupKeyParts(asset).forEach(key => map.set(normalizeVehicleSearch(key), asset));
  });
  return map;
}

function findDirectorAssetForEntry(entry = {}, lookup = buildDirectorAssetLookup()) {
  for (const key of assetLookupKeyParts(entry)) {
    const found = lookup.get(normalizeVehicleSearch(key));
    if (found) return found;
  }
  return null;
}

function reportDateInRange(report, from, to) {
  const d = String(report?.report_date || report?.created_at || "").slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function fuelAnalysisAssetKey(asset, entry) {
  return String(asset?.id || entry?.asset_id || entry?.asset_code || entry?.machine_code || entry?.vehicle_code || entry?.asset_name || entry?.machine || entry?.vehicle || entry?.other || "unknown");
}

function fuelAnalysisAssetLabel(asset, entry) {
  return formatAssetTitleWithCode(asset || entry) || entry?.asset_name || entry?.machine || entry?.vehicle || entry?.other || "Nepoznato sredstvo";
}

function addFuelAnalysisWork(rows, entry = {}, kind = "") {
  if (!entry) return;
  const lookup = rows.lookup;
  const asset = findDirectorAssetForEntry(entry, lookup);
  const key = fuelAnalysisAssetKey(asset, entry);
  if (!rows.map.has(key)) {
    rows.map.set(key, {
      asset,
      label: fuelAnalysisAssetLabel(asset, entry),
      type: normalizeAssetType(asset?.asset_type || entry.asset_type || entry.asset_kind || kind),
      mtc: 0,
      km: 0,
      hours: 0,
      liters: 0,
      sites: new Set()
    });
  }
  const row = rows.map.get(key);
  row.type = row.type || normalizeAssetType(asset?.asset_type || entry.asset_type || entry.asset_kind || kind);
  row.mtc += parseDecimalInput(machineMtcTotal(entry) || entry.mtc_total || entry.total_mtc || entry.hours_mtc || entry.mtc);
  row.km += parseDecimalInput(machineKmTotal(entry) || entry.km_total || entry.total_km);
  row.hours += parseDecimalInput(entry.hours || entry.work_hours || "");
  const site = entry.site_name || entry.site || "";
  if (site) row.sites.add(site);
}

function addFuelAnalysisLiters(rows, entry = {}) {
  if (!entry) return;
  const lookup = rows.lookup;
  const asset = findDirectorAssetForEntry(entry, lookup);
  const key = fuelAnalysisAssetKey(asset, entry);
  if (!rows.map.has(key)) {
    rows.map.set(key, {
      asset,
      label: fuelAnalysisAssetLabel(asset, entry),
      type: normalizeAssetType(asset?.asset_type || entry.asset_type || entry.asset_kind || ""),
      mtc: 0,
      km: 0,
      hours: 0,
      liters: 0,
      sites: new Set()
    });
  }
  const row = rows.map.get(key);
  row.type = row.type || normalizeAssetType(asset?.asset_type || entry.asset_type || entry.asset_kind || "");
  row.liters += parseDecimalInput(entry.liters || entry.fuel_liters);
  const site = entry.site_name || entry.site || "";
  if (site) row.sites.add(site);
}

function expectedFuelForRow(row) {
  const asset = row.asset || {};
  const norm = assetFuelNormValue(asset);
  const unit = assetFuelNormUnit(asset);
  if (!norm) return 0;
  if (unit === "l_per_100km") return row.km * norm / 100;
  if (unit === "l_per_hour") return (row.hours || row.mtc) * norm;
  return row.mtc * norm;
}

function fuelConsumptionStatus(row) {
  const expected = expectedFuelForRow(row);
  if (!expected || !row.liters) return { label: "Nema dovoljno podataka", cls: "" };
  const diff = row.liters - expected;
  const pct = Math.abs(diff) / expected * 100;
  const tolerance = assetFuelToleranceValue(row.asset || {});
  if (pct <= tolerance) return { label: "U normi", cls: "consumption-status-ok" };
  return { label: diff > 0 ? "Povećana potrošnja" : "Manje od norme", cls: diff > 0 ? "consumption-status-bad" : "consumption-status-warn" };
}

function buildFuelConsumptionRows(from, to) {
  const rows = { map: new Map(), lookup: buildDirectorAssetLookup() };
  filterOperationalReportsForAnalytics(directorReportsCache || []).filter(r => reportDateInRange(r, from, to)).forEach(r => {
    const d = r.data || {};
    (Array.isArray(d.machines) ? d.machines : []).forEach(m => addFuelAnalysisWork(rows, m, "machine"));
    (Array.isArray(d.vehicles) ? d.vehicles : []).forEach(v => addFuelAnalysisWork(rows, v, "vehicle"));
    (Array.isArray(d.fuel_entries) ? d.fuel_entries : []).forEach(f => addFuelAnalysisLiters(rows, f));
    const tanker = Array.isArray(d.field_tanker_entries) ? d.field_tanker_entries : (Array.isArray(d.tanker_fuel_entries) ? d.tanker_fuel_entries : []);
    tanker.forEach(f => addFuelAnalysisLiters(rows, f));
  });
  return Array.from(rows.map.values()).filter(r => r.liters || r.mtc || r.km || r.hours);
}

function renderFuelConsumptionAnalysis() {
  const box = $("#fuelConsumptionList");
  if (!box) return;
  const from = $("#fuelAnalysisFrom")?.value || today().slice(0, 8) + "01";
  const to = $("#fuelAnalysisTo")?.value || today();
  if ($("#fuelAnalysisFrom") && !$("#fuelAnalysisFrom").value) $("#fuelAnalysisFrom").value = from;
  if ($("#fuelAnalysisTo") && !$("#fuelAnalysisTo").value) $("#fuelAnalysisTo").value = to;
  const rows = buildFuelConsumptionRows(from, to);
  const tableRows = rows.map(row => {
    const expected = expectedFuelForRow(row);
    const diff = row.liters - expected;
    const status = fuelConsumptionStatus(row);
    return [
      row.label,
      assetTypeLabel(row.type),
      [...row.sites].join(", ") || "—",
      row.mtc ? `${Math.round(row.mtc * 100) / 100} MTČ` : "—",
      row.km ? `${Math.round(row.km * 100) / 100} km` : "—",
      formatAssetFuelNorm(row.asset) || "Nema norme",
      expected ? `${Math.round(expected * 100) / 100} L` : "—",
      row.liters ? `${Math.round(row.liters * 100) / 100} L` : "—",
      expected ? `${diff >= 0 ? "+" : ""}${Math.round(diff * 100) / 100} L` : "—",
      `<span class="${status.cls}">${escapeHtml(status.label)}</span>`
    ];
  });
  if (!tableRows.length) {
    box.innerHTML = `<p class="muted office-empty">Nema podataka za potrošnju u izabranom periodu. Potrebni su rad MTČ/KM i sipanja goriva.</p>`;
    return;
  }
  box.innerHTML = `<div class="office-table-wrap"><table class="office-table"><thead><tr>${["Sredstvo","Tip","Gradilišta","MTČ","KM","Norma","Očekivano","Sipano","Razlika","Status"].map(h => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${tableRows.map(row => `<tr>${row.map((v, idx) => idx === 9 ? `<td>${v}</td>` : `<td>${escapeHtml(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}



// === AskCreate v5: Vlasnik/Direktor pregled + materijal po gradilištu ===
function officeEntrySiteName(entry = {}, fallback = "") {
  return String(entry.site_name || entry.site || entry.site_label || entry.project_name || fallback || "").trim();
}

function officeEntryMatchesSite(entry = {}, fallback = "", site = "") {
  const q = normalizeSearch(site || "");
  if (!q) return true;
  return normalizeSearch(officeEntrySiteName(entry, fallback)).includes(q);
}

function officeFirstMatchingSiteFromReport(r = {}, site = "") {
  const d = r.data || {};
  const fallback = officeReportSite(r);
  const pools = [d.machines, d.vehicles, d.fuel_entries, d.field_tanker_entries, d.tanker_fuel_entries, d.material_entries, d.material_movements, d.materials];
  for (const arr of pools) {
    if (!Array.isArray(arr)) continue;
    const found = arr.find(x => officeEntryMatchesSite(x, fallback, site));
    if (found) return officeEntrySiteName(found, fallback);
  }
  return fallback;
}

function officeReportMatchesDateSiteDeep(r, from = "", to = "", site = "") {
  if (!r || isArchivedReport(r)) return false;
  const date = officeReportDate(r);
  if (from && date && date < from) return false;
  if (to && date && date > to) return false;
  const siteQ = normalizeSearch(site || "");
  if (!siteQ) return true;
  const d = r.data || {};
  if (normalizeSearch(officeReportSite(r)).includes(siteQ)) return true;
  const pools = [d.machines, d.vehicles, d.fuel_entries, d.field_tanker_entries, d.tanker_fuel_entries, d.material_entries, d.material_movements, d.materials];
  return pools.some(arr => Array.isArray(arr) && arr.some(item => {
    if (officeEntryMatchesSite(item, "", site)) return true;
    if (Array.isArray(item.tour_items)) {
      return item.tour_items.some(t => {
        const text = [t.site_name, t.site, t.from_site, t.to_site, t.load_location, t.unload_location, t.landfill, t.external_source].filter(Boolean).join(" ");
        return normalizeSearch(text).includes(siteQ);
      });
    }
    return false;
  }));
}

function round2(n) {
  const x = Number(n || 0);
  return Math.round(x * 100) / 100;
}


// === AskCreate v9: finalno povezivanje Dnevnika/Karneta sa multi-gradilište stavkama ===
function officeReportTypeLabel(r = {}) {
  const d = r.data || {};
  return d.report_type_label || d.report_label || d.report_type || "Radnički unos";
}

function officeVehicleKmTotal(v = {}) {
  return v.km_total || v.vehicle_km_total || decimalDiffText(v.km_start || v.start_km, v.km_end || v.end_km) || "";
}

function officeVehicleMaterialName(v = {}) {
  return v.material_name || v.material || v.material_custom || v.cargo || v.load || "";
}

function officeVehicleMaterialAction(v = {}) {
  return v.transport_type || v.direction || v.action || v.material_action || v.transport_direction || "";
}

function officeVehicleM3(v = {}) {
  return v.cubic_m3 || v.cubic_auto || v.total_m3 || v.calculated_m3 || v.volume_m3 || "";
}

function officeVehicleRouteText(v = {}) {
  const from = v.load_location || v.from_location || v.from_site || v.pickup || "";
  const to = v.unload_location || v.to_location || v.to_site || v.delivery || "";
  const route = v.route || [from, to].filter(Boolean).join(" → ");
  return route || "";
}

function officeEntryDescription(entry = {}, fallback = "") {
  return entry.work || entry.description || entry.note || entry.notes || fallback || "";
}

function officePushSyntheticWorker(rows, seen, date, siteName, r, label, hours = "") {
  const person = officePersonLabel(r);
  const emp = reportEmployeeNumber(r) || (r.data || {}).employee_number || (r.data || {}).worker_number || "";
  const role = r.company_users?.function_title || (r.data || {}).function_title || (r.data || {}).worker_role || "";
  const key = [date, siteName || "—", emp, person, label].join("||");
  if (seen.has(key)) return;
  seen.add(key);
  rows.push([date, siteName || "—", emp, person, role, hours || "", label || officeReportTypeLabel(r)]);
}

function officePushDailySyntheticWorker(rows, seen, siteName, r, label, hours = "") {
  const person = officePersonLabel(r);
  const emp = reportEmployeeNumber(r) || (r.data || {}).employee_number || (r.data || {}).worker_number || "";
  const role = r.company_users?.function_title || (r.data || {}).function_title || (r.data || {}).worker_role || "";
  const key = [siteName || "—", emp, person, label].join("||");
  if (seen.has(key)) return;
  seen.add(key);
  rows.push([siteName || "—", emp, person, role, hours || "", label || officeReportTypeLabel(r)]);
}

function buildMaterialOverviewRows(from, to, site = "") {
  const rows = [];
  (directorReportsCache || []).filter(r => officeReportMatchesDateSiteDeep(r, from, to, site)).forEach(r => {
    const d = r.data || {};
    const date = officeReportDate(r);
    const reportPerson = officePersonLabel(r);
    const reportSite = officeReportSite(r) || "—";

    (Array.isArray(d.vehicles) ? d.vehicles : []).forEach(v => {
      if (!officeEntryMatchesSite(v, reportSite, site)) return;
      const m3 = parseDecimalInput(v.cubic_m3 || v.cubic_auto || v.total_m3 || "");
      rows.push({
        date,
        site: officeEntrySiteName(v, reportSite) || "—",
        source: "Vozilo / ture",
        material: v.material || v.material_name || "—",
        action: v.direction || v.transport_direction || "—",
        tours: parseDecimalInput(v.tours || ""),
        quantity: m3,
        unit: m3 ? "m³" : "",
        worker: reportPerson,
        asset: v.asset_code || v.vehicle_code || v.name || v.vehicle || "",
        note: [v.load_location && `utovar: ${v.load_location}`, v.unload_location && `istovar: ${v.unload_location}`, v.route].filter(Boolean).join(" · ")
      });
    });

    const mats = Array.isArray(d.material_entries) ? d.material_entries : (Array.isArray(d.material_movements) ? d.material_movements : (Array.isArray(d.materials) ? d.materials : []));
    mats.forEach(m => {
      if (!officeEntryMatchesSite(m, reportSite, site)) return;
      rows.push({
        date,
        site: officeEntrySiteName(m, reportSite) || "—",
        source: "Materijal / magacin",
        material: m.material || m.name || m.material_name || "—",
        action: m.action || m.material_action || "—",
        tours: parseDecimalInput(m.tours || m.material_tours || ""),
        quantity: parseDecimalInput(materialQuantityValue(m)),
        unit: materialUnitValue(m) || m.unit || "",
        worker: reportPerson,
        asset: m.asset_code || "",
        note: m.note || materialCalcText(m) || ""
      });
    });
  });
  return rows;
}

function buildMaterialTotals(rows = []) {
  const bySite = new Map();
  const byMaterial = new Map();
  rows.forEach(r => {
    const site = r.site || "—";
    const mat = r.material || "—";
    if (!bySite.has(site)) bySite.set(site, { site, tours: 0, m3: 0, qty: 0, rows: 0 });
    const srow = bySite.get(site);
    srow.tours += Number(r.tours || 0);
    if (String(r.unit || "").toLowerCase().includes("m")) srow.m3 += Number(r.quantity || 0);
    else srow.qty += Number(r.quantity || 0);
    srow.rows += 1;

    const key = `${mat}||${r.unit || ""}`;
    if (!byMaterial.has(key)) byMaterial.set(key, { material: mat, unit: r.unit || "", tours: 0, quantity: 0, rows: 0 });
    const mrow = byMaterial.get(key);
    mrow.tours += Number(r.tours || 0);
    mrow.quantity += Number(r.quantity || 0);
    mrow.rows += 1;
  });
  return { bySite: Array.from(bySite.values()), byMaterial: Array.from(byMaterial.values()) };
}

function ensureOverviewDatalists() {
  const options = activeDirectorSites().map(s => exportOptionHtml(s.name, [s.location, "gradilište"].filter(Boolean).join(" · "))).join("");
  ["materialOverviewSiteList", "ownerDashboardSiteList", "ownerPanelDashboardSiteList"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = options;
  });
}

function ensureOverviewDefaultDates(prefix) {
  const fromEl = document.getElementById(`${prefix}From`);
  const toEl = document.getElementById(`${prefix}To`);
  const from = today().slice(0, 8) + "01";
  const to = today();
  if (fromEl && !fromEl.value) fromEl.value = from;
  if (toEl && !toEl.value) toEl.value = to;
}

function renderMaterialOverview() {
  ensureOverviewDatalists();
  ensureOverviewDefaultDates("materialOverview");
  const from = document.getElementById("materialOverviewFrom")?.value || today().slice(0, 8) + "01";
  const to = document.getElementById("materialOverviewTo")?.value || today();
  const site = document.getElementById("materialOverviewSite")?.value || "";
  const rows = buildMaterialOverviewRows(from, to, site);
  const totals = buildMaterialTotals(rows);
  const box = document.getElementById("materialOverviewPreview");
  if (!box) return;
  const totalTours = round2(rows.reduce((s, r) => s + Number(r.tours || 0), 0));
  const totalM3 = round2(rows.filter(r => String(r.unit || "").toLowerCase().includes("m")).reduce((s, r) => s + Number(r.quantity || 0), 0));
  box.innerHTML = `
    <div class="office-form-titlebar">
      <div><b>Materijal po gradilištu</b><span>${escapeHtml(formatDateOnlyLocal(from))} — ${escapeHtml(formatDateOnlyLocal(to))} · ${escapeHtml(site || "Sva gradilišta")}</span></div>
      <div class="office-badges"><span>${rows.length} stavki</span><span>${totalTours} tura</span><span>${totalM3} m³</span></div>
    </div>
    <section><h4>🏗️ Ukupno po gradilištu</h4>${officeTable(["Gradilište","Stavki","Ture","m³","Ostala količina"], totals.bySite.map(r => [r.site, r.rows, round2(r.tours), round2(r.m3), round2(r.qty)]))}</section>
    <section><h4>📦 Ukupno po materijalu</h4>${officeTable(["Materijal","Jedinica","Stavki","Ture","Količina"], totals.byMaterial.map(r => [r.material, r.unit, r.rows, round2(r.tours), round2(r.quantity)]))}</section>
    <section><h4>📋 Detaljne stavke</h4>${officeTable(["Datum","Gradilište","Izvor","Materijal","Smer/radnja","Ture","Količina","Jed.","Radnik","Sredstvo","Napomena"], rows.map(r => [r.date, r.site, r.source, r.material, r.action, round2(r.tours), round2(r.quantity), r.unit, r.worker, r.asset, r.note]))}</section>`;
}

function downloadMaterialOverviewCsv() {
  ensureOverviewDefaultDates("materialOverview");
  const from = document.getElementById("materialOverviewFrom")?.value || today().slice(0, 8) + "01";
  const to = document.getElementById("materialOverviewTo")?.value || today();
  const site = document.getElementById("materialOverviewSite")?.value || "";
  const rows = buildMaterialOverviewRows(from, to, site);
  if (!rows.length) return toast("Nema materijala za izabrani period.", true);
  officeCsvDownload(`materijal_po_gradilistu_${safeFilePart(currentCompany?.company_code || "firma")}_${from}_${to}.csv`, ["Datum","Gradilište","Izvor","Materijal","Smer/radnja","Ture","Količina","Jedinica","Radnik","Sredstvo","Napomena"], rows.map(r => [r.date, r.site, r.source, r.material, r.action, round2(r.tours), round2(r.quantity), r.unit, r.worker, r.asset, r.note]));
}

function ownerReportMatchesDateSiteAny(r, from = "", to = "", site = "") {
  if (!r || isArchivedReport(r)) return false;
  const date = officeReportDate(r);
  if (from && date && date < from) return false;
  if (to && date && date > to) return false;
  const siteQ = normalizeSearch(site || "");
  if (!siteQ) return true;
  const d = r.data || {};
  const directText = [
    officeReportSite(r),
    d.site_name,
    d.site,
    d.site_label,
    d.project_name,
    d.defect_site_name,
    d.location,
    d.route,
    d.from_site,
    d.to_site
  ].filter(Boolean).join(" ");
  if (normalizeSearch(directText).includes(siteQ)) return true;
  const pools = [
    d.workers, d.worker_entries,
    d.machines, d.machine_entries,
    d.vehicles, d.vehicle_entries,
    d.fuel_entries, d.field_tanker_entries, d.tanker_fuel_entries,
    d.material_entries, d.material_movements, d.materials,
    d.lowloader_entries, d.water_tanker_entries
  ];
  return pools.some(arr => Array.isArray(arr) && arr.some(item => officeEntryMatchesSite(item, officeReportSite(r), site)));
}

function ownerTopLevelNumber(d = {}, keys = []) {
  for (const key of keys) {
    const n = parseDecimalInput(d[key]);
    if (n) return n;
  }
  return 0;
}

function ownerDiffNumber(d = {}, startKeys = [], endKeys = []) {
  let start = 0, end = 0;
  for (const k of startKeys) {
    start = parseDecimalInput(d[k]);
    if (start) break;
  }
  for (const k of endKeys) {
    end = parseDecimalInput(d[k]);
    if (end) break;
  }
  return end && start ? Math.max(0, end - start) : 0;
}

function buildOwnerDashboardData(from, to, site = "") {
  const analyticsReports = filterOperationalReportsForAnalytics(directorReportsCache || []);
  const reports = analyticsReports.filter(r => ownerReportMatchesDateSiteAny(r, from, to, site));
  const allMatchingReports = analyticsReports.filter(r => {
    const date = officeReportDate(r);
    if (from && date && date < from) return false;
    if (to && date && date > to) return false;
    const siteQ = normalizeSearch(site || "");
    if (!siteQ) return true;
    const d = r.data || {};
    const reportSite = officeReportSite(r) || "";
    if (normalizeSearch(reportSite).includes(siteQ)) return true;
    if (normalizeSearch(d.defect_site_name || d.site_name || "").includes(siteQ)) return true;
    const pools = [d.machines, d.vehicles, d.fuel_entries, d.field_tanker_entries, d.tanker_fuel_entries, d.material_entries, d.material_movements, d.materials, d.worker_entries, d.machine_entries, d.vehicle_entries];
    return pools.some(arr => Array.isArray(arr) && arr.some(item => officeEntryMatchesSite(item, reportSite, site)));
  });

  let hours = 0, mtc = 0, km = 0, tours = 0, fuel = 0, water = 0, waterLoads = 0, lowloaderKm = 0, lowloaderCount = 0;

  reports.forEach(r => {
    const d = r.data || {};
    const reportSite = officeReportSite(r) || "";

    const workerRows = Array.isArray(d.workers) ? d.workers : (Array.isArray(d.worker_entries) ? d.worker_entries : []);
    if (workerRows.length) {
      workerRows.forEach(w => {
        if (!site || officeEntryMatchesSite(w, reportSite, site) || normalizeSearch(reportSite).includes(normalizeSearch(site))) {
          hours += parseDecimalInput(w.hours || w.work_hours || w.total_hours || "");
        }
      });
    } else {
      hours += ownerTopLevelNumber(d, ["hours", "work_hours", "worker_hours", "workers_total_hours", "total_hours", "radni_sati"]);
    }

    const machineRows = Array.isArray(d.machines) ? d.machines : (Array.isArray(d.machine_entries) ? d.machine_entries : []);
    if (machineRows.length) {
      machineRows.forEach(m => {
        if (!site || officeEntryMatchesSite(m, reportSite, site) || normalizeSearch(reportSite).includes(normalizeSearch(site))) {
          mtc += parseDecimalInput(machineMtcTotal(m) || m.mtc_total || m.total_mtc || m.work_mtc || m.mtc || "");
          km += parseDecimalInput(machineKmTotal(m) || m.km_total || m.total_km || "");
        }
      });
    } else {
      mtc += ownerTopLevelNumber(d, ["mtc_total", "total_mtc", "work_mtc", "machine_mtc", "mtc", "mtč", "machine_hours_mtc"]);
      mtc += ownerDiffNumber(d, ["mtc_start", "machine_mtc_start", "start_mtc"], ["mtc_end", "machine_mtc_end", "end_mtc"]);
      km += ownerTopLevelNumber(d, ["km_total", "total_km", "work_km", "machine_km", "vehicle_km", "kilometers", "kilometraza"]);
      km += ownerDiffNumber(d, ["km_start", "vehicle_km_start", "start_km"], ["km_end", "vehicle_km_end", "end_km"]);
    }

    const vehicleRows = Array.isArray(d.vehicles) ? d.vehicles : (Array.isArray(d.vehicle_entries) ? d.vehicle_entries : []);
    vehicleRows.forEach(v => {
      if (!site || officeEntryMatchesSite(v, reportSite, site) || normalizeSearch(reportSite).includes(normalizeSearch(site))) {
        km += parseDecimalInput(officeVehicleKmTotal(v) || decimalDiffText(v.km_start, v.km_end) || v.km_total || v.total_km || "");
        tours += parseDecimalInput(v.tours || v.total_tours || v.tour_count || "");
      }
    });
    if (!vehicleRows.length) {
      tours += ownerTopLevelNumber(d, ["tours", "total_tours", "tour_count", "ture"]);
    }

    officeLowloaderEntries(d).forEach(ll => {
      if (officeEntryMatchesSite({ site_name: lowloaderSiteLabel(ll, reportSite) }, reportSite, site) || !site) {
        lowloaderCount += 1;
        lowloaderKm += parseDecimalInput(lowloaderKmTotal(ll));
        km += parseDecimalInput(lowloaderKmTotal(ll));
      }
    });

    officeWaterEntries(d).forEach(wt => {
      if (officeEntryMatchesSite(wt, reportSite, site) || !site) {
        water += waterTankerLiters(wt);
        waterLoads += waterTankerLoads(wt);
        km += parseDecimalInput(waterTankerKmTotal(wt));
      }
    });

    const fuelEntries = Array.isArray(d.fuel_entries) ? d.fuel_entries : [];
    fuelEntries.forEach(f => {
      if (officeEntryMatchesSite(f, reportSite, site) || !site || normalizeSearch(reportSite).includes(normalizeSearch(site))) {
        fuel += parseDecimalInput(f.liters || f.fuel_liters || "");
      }
    });
    const tank = Array.isArray(d.field_tanker_entries) ? d.field_tanker_entries : (Array.isArray(d.tanker_fuel_entries) ? d.tanker_fuel_entries : []);
    tank.forEach(f => {
      if (officeEntryMatchesSite(f, reportSite, site) || !site || normalizeSearch(reportSite).includes(normalizeSearch(site))) {
        fuel += parseDecimalInput(f.liters || f.fuel_liters || "");
      }
    });
    if (!fuelEntries.length && !tank.length) {
      fuel += ownerTopLevelNumber(d, ["fuel_liters", "field_tanker_liters", "tanker_liters", "liters", "litara"]);
    }
  });

  const materials = buildMaterialOverviewRows(from, to, site);
  const materialM3 = materials.filter(r => String(r.unit || "").toLowerCase().includes("m")).reduce((s, r) => s + Number(r.quantity || 0), 0);
  const fuelRows = buildFuelConsumptionRows(from, to).filter(row => !site || [...row.sites].some(s => normalizeSearch(s).includes(normalizeSearch(site))));
  const badFuel = fuelRows.filter(row => fuelConsumptionStatus(row).cls === "consumption-status-bad").length;

  // Direktorov aktivni pregled kvarova ne prikazuje arhivirane kvarove.
  // Kada Direkcija klikne Arhiviraj, kvar ostaje samo u kartici Arhiva.
  const defectReports = allMatchingReports.filter(r => hasDefectData(r) && !isArchivedReport(r)).filter(r => !isOwnerHiddenDefectReport(r));
  const defectStatusCounts = { novo: 0, aktivno: 0, reseno: 0, arhivirano: 0 };
  const defectRows = defectReports.map(r => {
    const archived = isArchivedReport(r);
    const group = archived ? "archived" : mechanicStatusGroup(r);
    if (archived) defectStatusCounts.arhivirano += 1;
    else if (group === "resolved") defectStatusCounts.reseno += 1;
    else if (group === "active") defectStatusCounts.aktivno += 1;
    else defectStatusCounts.novo += 1;
    const d = r.data || {};
    const lastChange = d.defect_resolved_at || d.defect_repair_started_at || d.defect_received_at || r.updated_at || "";
    return {
      sortTime: mechanicDefectTime(r) || lastChange || r.created_at || "",
      row: [
        mechanicDefectSiteName(r),
        mechanicDefectAssetName(r),
        mechanicDefectText(r),
        mechanicDefectUrgency(r),
        `${normalizeDefectImages(d).length} slika`,
        archived ? "Arhivirano" : mechanicStatusLabel(r),
        formatDateTimeLocal(mechanicDefectTime(r) || ""),
        formatDateTimeLocal(lastChange || "")
      ]
    };
  }).sort((a, b) => String(b.sortTime).localeCompare(String(a.sortTime)));

  const defectCount = defectReports.length;
  return { reports, hours, mtc, km, tours, fuel, water, waterLoads, lowloaderKm, lowloaderCount, materials, materialM3, fuelRows, badFuel, defectCount, defectRows, defectStatusCounts };
}


function ownerHiddenDefectsLocalKey() {
  return `askcreate_owner_hidden_defect_reports_${currentCompany?.id || "no_company"}`;
}

function loadOwnerHiddenDefectIds() {
  try {
    const raw = localStorage.getItem(ownerHiddenDefectsLocalKey());
    const arr = JSON.parse(raw || "[]");
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch (_) {
    return new Set();
  }
}

function saveOwnerHiddenDefectIds(ids) {
  try {
    localStorage.setItem(ownerHiddenDefectsLocalKey(), JSON.stringify(Array.from(ids || []).slice(-1000)));
  } catch (_) {}
}

function isOwnerHiddenDefectReport(r) {
  if (!r?.id) return false;
  return loadOwnerHiddenDefectIds().has(String(r.id));
}

window.ownerHideDefectReport = function(reportId) {
  if (!reportId) return;
  const ok = confirm("Skloniti ovaj izveštaj kvara samo sa direktorovog prikaza?\n\nNe ide u arhivu. Direkcija ga i dalje vidi dok ne klikne Arhiviraj.");
  if (!ok) return;
  const ids = loadOwnerHiddenDefectIds();
  ids.add(String(reportId));
  saveOwnerHiddenDefectIds(ids);
  renderOwnerDashboard?.();
  renderOwnerDashboard?.("ownerPanelDashboard", "ownerPanelPreview");
  const ownerBox = document.getElementById("ownerDashboardPreview");
  const ownerPanelBox = document.getElementById("ownerPanelPreview");
  if (ownerBox && ownerBox.innerHTML.includes("Izveštaj kvarova")) openOwnerDefectsReport("ownerDashboard");
  if (ownerPanelBox && ownerPanelBox.innerHTML.includes("Izveštaj kvarova")) openOwnerDefectsReport("ownerPanelDashboard");
  toast("Izveštaj kvara je sklonjen samo sa direktorovog prikaza.");
};

window.ownerRestoreHiddenDefectReports = function() {
  const ids = loadOwnerHiddenDefectIds();
  if (!ids.size) { toast("Nema sklonjenih kvarova u direktorovom prikazu."); return; }
  const ok = confirm(`Vratiti ${ids.size} sklonjenih izveštaja kvarova u direktorov prikaz?`);
  if (!ok) return;
  saveOwnerHiddenDefectIds(new Set());
  renderOwnerDashboard?.();
  renderOwnerDashboard?.("ownerPanelDashboard", "ownerPanelPreview");
  toast("Sklonjeni kvarovi su vraćeni u direktorov prikaz.");
};

function getOwnerFilteredDefectReports(prefix = "ownerDashboard") {
  ensureOverviewDatalists();
  ensureOverviewDefaultDates(prefix);
  const from = document.getElementById(`${prefix}From`)?.value || today().slice(0, 8) + "01";
  const to = document.getElementById(`${prefix}To`)?.value || today();
  const site = document.getElementById(`${prefix}Site`)?.value || "";
  const normalizedSite = normalizeSearch(site);
  const reports = (directorReportsCache || [])
    .filter(hasDefectData)
    .filter(r => !isOwnerHiddenDefectReport(r))
    .filter(r => {
      const date = String(r.report_date || r.submitted_at || r.created_at || "").slice(0, 10);
      if (from && date && date < from) return false;
      if (to && date && date > to) return false;
      if (!normalizedSite) return true;
      return normalizeSearch(mechanicDefectSiteName(r)).includes(normalizedSite);
    })
    .sort((a, b) => String(mechanicDefectTime(b) || b.created_at || "").localeCompare(String(mechanicDefectTime(a) || a.created_at || "")));
  return { from, to, site, reports };
}

function ownerDefectReportCardHtml(r, options = {}) {
  const d = r.data || {};
  const actions = options.noActions ? "" : `<div class="owner-defect-card-actions no-print"><button class="secondary small-action" type="button" onclick="ownerHideDefectReport('${escapeHtml(r.id)}')">Skloni sa mog prikaza</button><small class="muted">Ne arhivira — samo sakriva kod Direktora.</small></div>`;
  return `<article class="owner-defect-report-card ${options.compact ? "owner-defect-report-card-compact" : ""}">
    <div class="owner-defect-card-head"><h4>🚨 Kvar — ${escapeHtml(mechanicDefectAssetName(r))}</h4>${actions}</div>
    <div class="report-kv">
      <b>Datum prijave</b><span>${escapeHtml(formatDateTimeLocal(mechanicDefectTime(r)) || r.report_date || "—")}</span>
      <b>Prijavio</b><span>${escapeHtml(mechanicDefectReporter(r))}</span>
      <b>Gradilište/lokacija</b><span>${escapeHtml(mechanicDefectSiteName(r))}</span>
      <b>Sredstvo</b><span>${escapeHtml(mechanicDefectAssetName(r))}</span>
      <b>Opis kvara</b><span>${escapeHtml(mechanicDefectText(r))}</span>
      <b>Hitnost</b><span>${escapeHtml(mechanicDefectUrgency(r))}</span>
      <b>Uticaj na rad</b><span>${escapeHtml(mechanicDefectImpact(r))}</span>
      <b>Status</b><span>${escapeHtml(isArchivedReport(r) ? "Arhivirano" : mechanicStatusLabel(r))}</span>
      <b>Napomena šefa mehanizacije</b><span>${escapeHtml(d.mechanic_note || "—")}</span>
      <b>Broj slika</b><span>${normalizeDefectImages(d).length}</span>
    </div>
    ${defectImagesHtml(d, { compact: options.compact, title: "Fotografije kvara" })}
    ${defectTimelineHtml(d, { compact: options.compact })}
  </article>`;
}

function ownerDashboardDefectImagesPreviewHtml(prefix = "ownerDashboard") {
  const { reports } = getOwnerFilteredDefectReports(prefix);
  const withImages = reports.filter(r => normalizeDefectImages(r.data || r).length).slice(0, 12);
  if (!withImages.length) return `<p class="muted tiny">Za izabrani period nema slika uz kvarove.</p>`;
  return `<div class="owner-defect-image-preview-list">${withImages.map(r => ownerDefectReportCardHtml(r, { compact: true })).join("")}</div>`;
}

function buildOwnerDefectsReportHtml(prefix = "ownerDashboard") {
  const { from, to, site, reports } = getOwnerFilteredDefectReports(prefix);
  const cards = reports.map(r => ownerDefectReportCardHtml(r)).join("") || `<p class="muted">Nema kvarova za izabrani period.</p>`;

  const hiddenCount = loadOwnerHiddenDefectIds().size;
  const restoreBtn = hiddenCount ? `<button class="secondary small-action no-print" type="button" onclick="ownerRestoreHiddenDefectReports()">Vrati sklonjene (${hiddenCount})</button>` : "";
  return `<div class="office-form-titlebar owner-titlebar"><div><b>Izveštaj kvarova</b><span>${escapeHtml(formatDateOnlyLocal(from))} — ${escapeHtml(formatDateOnlyLocal(to))} · ${escapeHtml(site || "Sva gradilišta")}</span></div><div class="office-badges"><span>${reports.length} kvarova</span>${restoreBtn}</div></div>${cards}`;
}

function openOwnerDefectsReport(prefix = "ownerDashboard") {
  const box = document.getElementById(`${prefix}Preview`) || document.getElementById("ownerDashboardPreview");
  if (box) box.innerHTML = buildOwnerDefectsReportHtml(prefix);
}
window.openOwnerDefectsReport = openOwnerDefectsReport;

function printOwnerDefectsReport(prefix = "ownerDashboard") {
  const html = buildOwnerDefectsReportHtml(prefix);
  const win = window.open("", "_blank");
  if (!win) { toast("Popup je blokiran. Dozvoli otvaranje prozora za štampu.", true); return; }
  win.document.write(`<!doctype html><html><head><title>Izveštaj kvarova</title><link rel="stylesheet" href="style.css?v=1708-ispravka-samo-direkcija"><style>body{background:#fff;color:#111;padding:24px}.no-print{display:none!important}.office-form-preview{box-shadow:none}.defect-image-link{break-inside:avoid}.owner-defect-report-card{break-inside:avoid;margin-bottom:18px}</style></head><body><div class="office-form-preview owner-dashboard-preview">${html}</div><script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>`);
  win.document.close();
}
window.printOwnerDefectsReport = printOwnerDefectsReport;

function renderOwnerDashboard(prefix = "ownerDashboard", previewId = "") {
  ensureOverviewDatalists();
  ensureOverviewDefaultDates(prefix);
  const from = document.getElementById(`${prefix}From`)?.value || today().slice(0, 8) + "01";
  const to = document.getElementById(`${prefix}To`)?.value || today();
  const site = document.getElementById(`${prefix}Site`)?.value || "";
  const data = buildOwnerDashboardData(from, to, site);
  const box = document.getElementById(previewId || `${prefix}Preview`);
  if (!box) return;
  const materialTotals = buildMaterialTotals(data.materials);
  const fuelBadRows = data.fuelRows.filter(row => fuelConsumptionStatus(row).cls === "consumption-status-bad").map(row => {
    const expected = expectedFuelForRow(row);
    return [row.label, formatAssetFuelNorm(row.asset) || "Nema norme", expected ? `${round2(expected)} L` : "—", row.liters ? `${round2(row.liters)} L` : "—", expected ? `${round2(row.liters - expected)} L` : "—", fuelConsumptionStatus(row).label];
  });
  const defectStatus = data.defectStatusCounts || { novo: 0, aktivno: 0, reseno: 0, arhivirano: 0 };
  const defectTableRows = (data.defectRows || []).slice(0, 20).map(item => item.row);
  box.innerHTML = `
    <div class="office-form-titlebar owner-titlebar">
      <div><b>Vlasnik/Direktor pregled firme</b><span>${escapeHtml(formatDateOnlyLocal(from))} — ${escapeHtml(formatDateOnlyLocal(to))} · ${escapeHtml(site || "Sva gradilišta")}</span></div>
      <div class="office-badges"><span>${data.reports.length} izveštaja</span><span>${data.defectCount} kvarova</span><span>${data.badFuel} povećane potrošnje</span></div>
    </div>
    <div class="owner-kpi-grid">
      <div class="owner-kpi"><b>${round2(data.hours)} h</b><span>Radni sati</span></div>
      <div class="owner-kpi"><b>${round2(data.fuel)} L</b><span>Gorivo</span></div>
      <div class="owner-kpi"><b>${round2(data.mtc)} MTČ</b><span>Rad mašina</span></div>
      <div class="owner-kpi"><b>${round2(data.km)} km</b><span>Kilometraža</span></div>
      <div class="owner-kpi"><b>${round2(data.tours)}</b><span>Ture</span></div>
      <div class="owner-kpi"><b>${round2(data.materialM3)} m³</b><span>Materijal</span></div>
      <div class="owner-kpi"><b>${round2(data.water)} L</b><span>Voda cisterna</span></div>
      <div class="owner-kpi"><b>${round2(data.lowloaderCount)}</b><span>Transport labudicom</span></div>
    </div>
    <section>
      <h4>🛠️ Kvarovi — pregled statusa</h4>
      <div class="owner-kpi-grid owner-kpi-grid-defects">
        <div class="owner-kpi owner-kpi-status"><b>${defectStatus.novo}</b><span>Novi kvarovi</span></div>
        <div class="owner-kpi owner-kpi-status"><b>${defectStatus.aktivno}</b><span>Preuzeto / u radu</span></div>
        <div class="owner-kpi owner-kpi-status"><b>${defectStatus.reseno}</b><span>Rešeni</span></div>
        <div class="owner-kpi owner-kpi-status"><b>Arhiva</b><span>Arhivirani kvarovi su samo u kartici Arhiva</span></div>
      </div>
      ${loadOwnerHiddenDefectIds().size ? `<div class="owner-hidden-defects-note no-print"><span>Sklonjeno sa direktorovog prikaza: ${loadOwnerHiddenDefectIds().size}</span><button class="secondary small-action" type="button" onclick="ownerRestoreHiddenDefectReports()">Vrati sklonjene</button></div>` : ""}
      ${officeTable(["Lokacija/gradilište","Sredstvo","Opis kvara","Hitnost","Slike","Status","Prijavljen","Zadnja promena"], defectTableRows)}
      <div class="owner-defect-images-inline">
        <h4>📸 Slike kvarova</h4>
        ${ownerDashboardDefectImagesPreviewHtml(prefix)}
      </div>
    </section>
    <section><h4>📦 Materijal po gradilištu</h4>${officeTable(["Gradilište","Stavki","Ture","m³","Ostala količina"], materialTotals.bySite.map(r => [r.site, r.rows, round2(r.tours), round2(r.m3), round2(r.qty)]))}</section>
    <section><h4>⛽ Povećana potrošnja</h4>${officeTable(["Sredstvo","Norma","Očekivano","Sipano","Razlika","Status"], fuelBadRows)}</section>`;
}

function renderFuelReportGroup(box, reports, kind, emptyText) {
  if (!box) return;
  const totalLiters = Math.round(reports.reduce((sum, r) => sum + businessCollectFuelLiters(r.data || {}), 0));
  const title = kind === "tanker" ? "Gorivo cisterna" : "Gorivo radnici";
  const header = reports.length
    ? `<div class="fuel-list-summary"><strong>${escapeHtml(fuelReportCountLabel(reports.length))}</strong><span>${escapeHtml(totalLiters ? `${totalLiters} L · ${title}` : title)}</span></div>`
    : "";
  box.innerHTML = header + (reports.map(r => fuelReportHtml(r, kind)).join("") || `<p class="muted">${escapeHtml(emptyText)}</p>`);
}

function renderFuelReportsList() {
  renderFuelReportGroup(
    $("#fuelWorkerReportsList"),
    getTodayFuelWorkerDashboardReports(directorReportsCache),
    "worker",
    "Danas nema goriva koje su radnici poslali za svoju mašinu/vozilo."
  );
  renderFuelReportGroup(
    $("#fuelTankerReportsList"),
    getTodayFuelTankerDashboardReports(directorReportsCache),
    "tanker",
    "Danas nema izveštaja cisterne za gorivo."
  );
  // Fallback za stariji HTML ako korisniku browser još vuče staru strukturu.
  const oldBox = $("#fuelReportsList");
  if (oldBox && !$("#fuelWorkerReportsList") && !$("#fuelTankerReportsList")) {
    const all = getTodayFuelDashboardReports(directorReportsCache);
    renderFuelReportGroup(oldBox, all, "worker", "Danas nema posebnih izveštaja za gorivo.");
  }
}

function archiveReportHtml(r) {
  const d = r.data || {};
  const person = reportDocumentPerson(r);
  const title = reportDocumentTitle(r);
  const submitted = formatDateTimeLocal(r.submitted_at || r.created_at);
  const archivedAt = formatDateTimeLocal(r.updated_at || r.submitted_at || r.created_at);
  return `
    <article class="report-row-item report-document-card archive-report-card">
      <div class="report-list-grid archive-list-grid">
        <div class="report-list-date">
          <strong>${escapeHtml(r.report_date || "")}</strong>
          <small>${escapeHtml(submitted || "")}</small>
        </div>
        <div class="report-list-site">
          <strong>${escapeHtml(reportPrimaryLocationLabel(r))}</strong>
          <small>${escapeHtml(d.report_type_label || title)}</small>
        </div>
        <div class="report-list-worker">
          <strong>${escapeHtml(person)}</strong>
          <small>${escapeHtml([reportEmployeeNumber(r) ? `broj ${reportEmployeeNumber(r)}` : "", r.company_users?.function_title || d.function_title || ""].filter(Boolean).join(" · "))}</small>
        </div>
        <div class="report-list-status">
          <span class="status-chip status-archived">Arhivirano</span>
          <small>${escapeHtml(archivedAt || "")}</small>
        </div>
      </div>
      <div class="report-card-actions no-print report-row-actions">
        <button class="secondary compact-doc-btn" type="button" onclick="openReportDocumentCenter('${r.id}')">Otvori</button>
        <button class="secondary compact-doc-btn" type="button" onclick="printReportDocument('${r.id}')">Štampaj</button>
        <button class="delete-btn compact-doc-btn" type="button" onclick="deleteReportPermanently('${r.id}')">Obriši trajno</button>
      </div>
    </article>`;
}

function renderArchiveList() {
  const box = $("#archiveReportsList");
  if (!box) return;
  const archived = mergeReportsById(
    filterVisibleReportsAfterPermanentDelete(directorReportsCache || []).filter(isArchivedReport),
    filterVisibleReportsAfterPermanentDelete(loadLocalArchivedReports()).filter(isArchivedReport)
  );
  const generated = loadOfficeGeneratedArchive();
  const html = [
    ...archived.map(archiveReportHtml),
    ...generated.map(officeGeneratedArchiveHtml)
  ].join("");
  box.innerHTML = html || `<p class="muted">Arhiva je prazna. Kada arhiviraš izveštaj, dnevnik rada ili karnet, pojaviće se ovde.</p>`;
}



function renderOwnerPanelArchiveList() {
  const box = document.getElementById("ownerPanelArchiveList");
  const wrap = document.getElementById("ownerPanelArchiveBox");
  if (!box || !wrap) return;
  const archived = mergeReportsById(
    filterVisibleReportsAfterPermanentDelete(directorReportsCache || []).filter(isArchivedReport),
    filterVisibleReportsAfterPermanentDelete(loadLocalArchivedReports()).filter(isArchivedReport)
  );
  const generated = loadOfficeGeneratedArchive();
  const html = [
    ...archived.map(archiveReportHtml),
    ...generated.map(officeGeneratedArchiveHtml)
  ].join("");
  box.innerHTML = html || `<p class="muted">Arhiva je prazna. Kada Direkcija arhivira izveštaj ili kvar, direktor će ga videti ovde.</p>`;
}

async function openOwnerPanelArchive() {
  const wrap = document.getElementById("ownerPanelArchiveBox");
  if (!wrap) return;
  try {
    if (!directorReportsCache?.length) await loadOwnerPanelData();
  } catch (e) {
    // Ako osvežavanje ne uspe, ipak prikaži ono što je već u kešu/lokalnoj arhivi.
  }
  wrap.classList.remove("hidden");
  renderOwnerPanelArchiveList();
  wrap.scrollIntoView({ behavior: "smooth", block: "start" });
}

window.openOwnerPanelArchive = openOwnerPanelArchive;

function renderReportReadableDetails(d = {}, options = {}) {
  const esc = escapeHtml;
  const safe = (x) => (x === undefined || x === null || x === "" ? "" : String(x));
  const val = (x) => safe(x) ? esc(safe(x)) : "<span class='report-empty'>—</span>";
  const rows = (pairs) => pairs.map(([k, v]) => `<b>${esc(k)}</b><span>${val(v)}</span>`).join("");
  const reportHasValue = (x) => x !== undefined && x !== null && String(x).trim() !== "";
  const firstValue = (...items) => {
    for (const item of items) {
      if (reportHasValue(item)) return item;
    }
    return "";
  };
  const tankerPlates = (ft = {}) => firstValue(ft.tanker_registration, ft.tanker_plates, ft.cistern_registration, ft.cistern_plates);
  const tankerName = (ft = {}) => firstValue(ft.tanker_asset_name, ft.tanker_vehicle, ft.cistern_vehicle, ft.cistern_name, ft.tanker_manual_vehicle, ft.tanker_asset_code, ft.tanker_vehicle_code);
  const tankerLabel = (ft = {}) => firstValue(tankerPlates(ft), tankerName(ft));
  const fuelKmValue = (entry = {}) => firstValue(entry.km, entry.current_km, entry.asset_kind === "vehicle" ? firstValue(entry.reading, entry.mtc_km) : "");
  const fuelMtcValue = (entry = {}) => firstValue(entry.mtc, entry.current_mtc, entry.asset_kind === "machine" ? firstValue(entry.reading, entry.mtc_km) : "");
  const assetDisplayName = (entry = {}) => firstValue(entry.asset_name, entry.machine, entry.vehicle, entry.other, entry.manual_asset_name, entry.asset_custom, entry.machine_custom, entry.vehicle_custom, entry.other_custom);
  const assetKindKey = (entry = {}) => {
    const raw = String(entry.asset_kind || entry.kind || entry.type || "").toLowerCase();
    if (raw.includes("vehicle") || raw.includes("voz")) return "vehicle";
    if (raw.includes("other") || raw.includes("ostalo") || raw.includes("oprema") || raw.includes("alat")) return "other";
    if (reportHasValue(entry.vehicle) || reportHasValue(entry.vehicle_custom)) return "vehicle";
    if (reportHasValue(entry.other) || reportHasValue(entry.other_custom)) return "other";
    return "machine";
  };
  const assetNameForKind = (entry = {}, kind) => assetKindKey(entry) === kind ? val(assetDisplayName(entry)) : "";

  const workers = Array.isArray(d.workers) ? d.workers : (Array.isArray(d.worker_entries) ? d.worker_entries : []);
  const machines = Array.isArray(d.machines) ? d.machines : [];
  const vehicles = Array.isArray(d.vehicles) ? d.vehicles : [];
  const lowloaders = officeLowloaderEntries(d);
  const waters = officeWaterEntries(d);
  const fuels = Array.isArray(d.fuel_entries) ? d.fuel_entries : [];
  const fieldTankers = Array.isArray(d.field_tanker_entries) ? d.field_tanker_entries : (Array.isArray(d.tanker_fuel_entries) ? d.tanker_fuel_entries : []);

  // v1.18.9 — sigurnosna normalizacija materijala
  // Stari izveštaji mogu imati material_entries kao niz, objekat, tekst, boolean ili null.
  // .some() i .map() smeju da rade samo nad nizom.
  const normalizeReportArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return [value];
    return [];
  };
  const materialEntries =
    normalizeReportArray(d.material_entries).length ? normalizeReportArray(d.material_entries) :
    normalizeReportArray(d.material_movements).length ? normalizeReportArray(d.material_movements) :
    Array.isArray(d.materials) ? d.materials :
    [];


  if (d.report_type === "site_daily_log") {
    const siteLogData = {
      ...d,
      report_date_manual: d.report_date_manual || d.report_date,
      workers: Array.isArray(d.workers) ? d.workers : [],
      material_in: Array.isArray(d.material_in) ? d.material_in : [],
      material_out: Array.isArray(d.material_out) ? d.material_out : [],
      materials_installed: Array.isArray(d.materials_installed) ? d.materials_installed : [],
      materials_stock_on_site: Array.isArray(d.materials_stock_on_site) ? d.materials_stock_on_site : [],
      truck_tours: Array.isArray(d.truck_tours) ? d.truck_tours : []
    };
    const signed = siteLogData.site_log_signature_data_url ? `<div class="paper-signature-box"><img src="${esc(siteLogData.site_log_signature_data_url)}" alt="Potpis"/><div><b>${esc(siteLogData.site_log_signature_name || siteLogData.created_by_worker || "Potpisnik")}</b><span>${esc(formatDateTimeLocal(siteLogData.site_log_signature_signed_at) || "")}</span></div></div>` : `<div class="paper-signature-line">Potpis odgovornog lica gradilišta</div>`;
    const uploaded = siteLogData.signed_file ? `<p class="signed-file-note">Dodat potpisan dokument: <b>${esc(siteLogData.signed_file.name || "fajl")}</b>. Uploadovani fajl služi kao dokaz; Excel koristi podatke iz forme.</p>` : "";
    return `<div class="report-readable site-log-report-readable">
      <div class="report-section"><h4>Evidencija zaposlenih i radnih sati</h4>${siteLogTable(["#","Ime i prezime","Sati","Napomena"], siteLogData.workers, (w,i)=>[String(i+1), w.full_name, w.hours, w.note])}</div>
      <div class="report-section"><h4>Opis radova danas</h4><p>${esc(siteLogData.today_work_description || "—")}</p></div>
      <div class="report-section"><h4>Plan radova za naredni dan</h4><p>${esc(siteLogData.tomorrow_work_plan || "—")}</p></div>
      <div class="report-section"><h4>Ulaz materijala</h4>${siteLogTable(["#","Materijal","Količina","Jed.","Napomena"], siteLogData.material_in, (m,i)=>[String(i+1), m.material_name, m.quantity, m.unit, m.note])}</div>
      <div class="report-section"><h4>Izlaz materijala</h4>${siteLogTable(["#","Materijal","Količina","Jed.","Napomena"], siteLogData.material_out, (m,i)=>[String(i+1), m.material_name, m.quantity, m.unit, m.note])}</div>
      <div class="report-section"><h4>Ugrađeni materijali</h4>${siteLogTable(["#","Materijal","Količina","Jed.","Pozicija/rad"], siteLogData.materials_installed, (m,i)=>[String(i+1), m.material_name, m.quantity, m.unit, m.work_position || m.note])}</div>
      <div class="report-section"><h4>Stanje materijala na gradilištu</h4>${siteLogTable(["#","Materijal","Količina","Jed.","Lokacija/napomena"], siteLogData.materials_stock_on_site, (m,i)=>[String(i+1), m.material_name, m.quantity, m.unit, m.location_note || m.note])}</div>
      <div class="report-section"><h4>Evidencija kamionskih tura</h4>${siteLogTable(["#","Vrsta transporta","Izvor prevoza","Spoljni dobavljač","Reg. oznake","Ime i prezime vozača","Materijal","Broj tura","m³","Napomena"], siteLogData.truck_tours, (t,i)=>[String(i+1), siteLogTruckTypeText(t.tour_type), siteLogTransportText(t.transport_source, t.partner_company), t.partner_company, t.truck_plate, t.driver_name, t.material_name, t.tours, t.m3, t.note])}</div>
      <div class="report-section report-signature-section"><h4>Potpis / overa dokumenta</h4>${signed}${uploaded}</div>
    </div>`;
  }

  const reportRows = [];
  const leaveRequest = d.leave_request || {};
  const previewLeaveRequest = leaveRequest;
  const previewHasLeave = !!(safe(d.leave_request_type) || safe(d.leave_type) || safe(d.leave_date) || safe(d.leave_from) || safe(d.leave_to) || safe(d.leave_note) || Object.values(previewLeaveRequest).some(v => v !== undefined && v !== null && String(v).trim() !== ""));
  const previewHasWarehouse = !!(safe(d.warehouse_type) || safe(d.warehouse_item) || safe(d.warehouse_qty));

  const maxRows = Math.max(1, workers.length, machines.length, vehicles.length, lowloaders.length, waters.length, fuels.length, fieldTankers.length, materialEntries.length, previewHasLeave ? 1 : 0, previewHasWarehouse ? 1 : 0)
  for (let i = 0; i < maxRows; i++) {
    const w = workers[i] || {};
    const m = machines[i] || {};
    const v = vehicles[i] || {};
    const ll = lowloaders[i] || {};
    const f = fuels[i] || {};
    const ft = fieldTankers[i] || {};
    const mat = materialEntries[i] || {};
    reportRows.push(`
      <tr>
        <td>${i + 1}</td>
        <td>${val(d.site_name)}</td>
        <td>${val(d.hours)}</td>
        <td>${val(d.description)}</td>
        <td>${val(w.full_name || [w.first_name, w.last_name].filter(Boolean).join(" "))}</td>
        <td>${val(w.hours)}</td>
        <td>${val(m.name)}</td>
        <td>${val(m.start)}</td>
        <td>${val(m.end)}</td>
        <td>${val(m.hours)}</td>
        <td>${val(m.work)}</td>
        <td>${val(v.name || v.vehicle)}</td>
        <td>${val(v.registration)}</td>
        <td>${val(v.capacity)}</td>
        <td>${val(v.km_start)}</td>
        <td>${val(v.km_end)}</td>
        <td>${val(v.route)}</td>
        <td>${val(v.tours)}</td>
        <td>${val(v.cubic_m3 || v.cubic_auto)}</td>
        <td>${val(v.cubic_manual)}</td>
        <td>${val(ll.plates || ll.registration)}</td>
        <td>${val(ll.from_site || ll.from_address)}</td>
        <td>${val(ll.to_site || ll.to_address)}</td>
        <td>${val(ll.km_start)}</td>
        <td>${val(ll.km_end)}</td>
        <td>${val(lowloaderKmTotal(ll))}</td>
        <td>${val(ll.machine)}</td>
        <td>${val(ll.accompanying_tools || ll.tools)}</td>
        <td>${val(f.asset_name || f.machine || f.vehicle || f.other)}</td>
        <td>${val(f.liters)}</td>
        <td>${val(f.km || f.current_km || (f.asset_kind === "vehicle" ? (f.reading || f.mtc_km) : ""))}</td>
        <td>${val(f.mtc || f.current_mtc || (f.asset_kind === "machine" ? (f.reading || f.mtc_km) : ""))}</td>
        <td>${val(f.by)}</td>
        <td>${val(f.receiver || d.fuel_receiver)}</td>
        <td>${val(ft.site_name)}</td>
        <td>${val(ft.asset_name || ft.machine)}</td>
        <td>${val(ft.km || ft.current_km || (ft.asset_kind === "vehicle" ? (ft.reading || ft.mtc_km) : ""))}</td>
        <td>${val(ft.mtc || ft.current_mtc || (ft.asset_kind === "machine" ? (ft.reading || ft.mtc_km) : ""))}</td>
        <td>${val(ft.liters)}</td>
        <td>${val(ft.receiver || ft.received_by)}</td>
        <td>${val(mat.action || mat.material_action)}</td>
        <td>${val(mat.material || mat.name)}</td>
        <td>${val(materialQuantityValue(mat))}</td>
        <td>${val(materialUnitValue(mat))}</td>
        <td>${val(mat.note)}</td>
        <td>${val(d.leave_request_type || leaveRequest.leave_label || leaveRequest.label)}</td>
        <td>${val(d.leave_date || leaveRequest.leave_date || leaveRequest.date)}</td>
        <td>${val(d.leave_from || leaveRequest.date_from)}</td>
        <td>${val(d.leave_to || leaveRequest.date_to)}</td>
        <td>${val(d.leave_note || leaveRequest.leave_note || leaveRequest.note)}</td>
        <td>${val(d.warehouse_type)}</td>
        <td>${val(d.warehouse_item)}</td>
        <td>${val(d.warehouse_qty)}</td>
      </tr>
    `);
  }

  const excelPreviewRows = [];
  const addPreview = (section, rowLabel, field, value) => {
    if (!safe(value)) return;
    excelPreviewRows.push(`<tr><td>${esc(section)}</td><td>${esc(rowLabel || "")}</td><td>${esc(field)}</td><td>${val(value)}</td></tr>`);
  };

  addPreview("Osnovni podaci", "", "Gradilište", d.site_name);
  addPreview("Osnovni podaci", "", "Opis rada", d.description);
  addPreview("Osnovni podaci", "", "Sati rada", d.hours);

  workers.forEach((w, i) => {
    const row = `Zaposleni ${i + 1}`;
    addPreview("Evidencija zaposlenih na gradilištu", row, "Ime i prezime", w.full_name || [w.first_name, w.last_name].filter(Boolean).join(" "));
    addPreview("Evidencija zaposlenih na gradilištu", row, "Sati", w.hours);
  });

  machines.forEach((m, i) => {
    const row = `Mašina ${i + 1}`;
    addPreview("Evidencija rada mašine", row, "Broj", m.asset_code || m.machine_code);
    addPreview("Evidencija rada mašine", row, "Mašina", m.name);
    addPreview("Evidencija rada mašine", row, "KM početak", machineKmStart(m));
    addPreview("Evidencija rada mašine", row, "KM kraj", machineKmEnd(m));
    addPreview("Evidencija rada mašine", row, "Ukupno KM", machineKmTotal(m));
    addPreview("Evidencija rada mašine", row, "MTČ početak", machineMtcStart(m));
    addPreview("Evidencija rada mašine", row, "MTČ kraj", machineMtcEnd(m));
    addPreview("Evidencija rada mašine", row, "Ukupno MTČ", machineMtcTotal(m));
    addPreview("Evidencija rada mašine", row, "Opis rada", m.work);
  });

  vehicles.forEach((v, i) => {
    const row = `Vozilo ${i + 1}`;
    addPreview("Evidencija rada vozila", row, "Broj", v.asset_code || v.vehicle_code);
    addPreview("Evidencija rada vozila", row, "Vozilo", v.name || v.vehicle);
    addPreview("Evidencija rada vozila", row, "Registracija", v.registration);
    addPreview("Evidencija rada vozila", row, "Kapacitet m³", v.capacity);
    addPreview("Evidencija rada vozila", row, "KM početak", v.km_start);
    addPreview("Evidencija rada vozila", row, "KM kraj", v.km_end);
    addPreview("Evidencija rada vozila", row, "Relacija", v.route);
    addPreview("Evidencija rada vozila", row, "Broj izvršenih tura", v.tours);
    addPreview("Evidencija rada vozila", row, "Ukupno m³", v.cubic_m3 || v.cubic_auto);
  });

  lowloaders.forEach((ll, i) => {
    const row = `Transport ${i + 1}`;
    addPreview("Transport mašine labudicom", row, "Tablice labudice", ll.plates || ll.registration);
    addPreview("Transport mašine labudicom", row, "Od lokacije", ll.from_site || ll.from_address);
    addPreview("Transport mašine labudicom", row, "Do lokacije", ll.to_site || ll.to_address);
    addPreview("Transport mašine labudicom", row, "KM početak", ll.km_start);
    addPreview("Transport mašine labudicom", row, "KM kraj", ll.km_end);
    addPreview("Transport mašine labudicom", row, "Ukupno km", ll.km_total);
    addPreview("Transport mašine labudicom", row, "Mašina koja se transportuje", ll.machine);
    addPreview("Transport mašine labudicom", row, "Prateći alat uz mašinu", ll.accompanying_tools || ll.tools);
  });

  waters.forEach((wt, i) => {
    const row = `Cisterna za vodu ${i + 1}`;
    addPreview("Cisterna za vodu", row, "Broj", wt.asset_code || wt.vehicle_code);
    addPreview("Cisterna za vodu", row, "Cisterna", wt.vehicle || wt.asset_name || wt.tanker_vehicle);
    addPreview("Cisterna za vodu", row, "Gradilište", officeEntrySiteName(wt, d.site_name || ""));
    addPreview("Cisterna za vodu", row, "KM početak", wt.km_start);
    addPreview("Cisterna za vodu", row, "KM kraj", wt.km_end);
    addPreview("Cisterna za vodu", row, "Ukupno KM", waterTankerKmTotal(wt));
    addPreview("Cisterna za vodu", row, "Litara vode", waterTankerLiters(wt));
    addPreview("Cisterna za vodu", row, "Broj punjenja", waterTankerLoads(wt));
    addPreview("Cisterna za vodu", row, "Punjenje vode", wt.fill_location);
    addPreview("Cisterna za vodu", row, "Istovar / prskanje", wt.unload_location || wt.spray_location);
    addPreview("Cisterna za vodu", row, "Namena", waterTankerPurposeLabel(wt.purpose));
    addPreview("Cisterna za vodu", row, "Napomena", wt.note);
  });

  fuels.forEach((f, i) => {
    const row = `Gorivo ${i + 1}`;
    addPreview("Evidencija goriva", row, "Tip", assetKindLabel(f.asset_kind));
    addPreview("Evidencija goriva", row, "Broj", f.asset_code);
    addPreview("Evidencija goriva", row, "Sredstvo", f.asset_name || f.machine || f.vehicle || f.other);
    addPreview("Evidencija goriva", row, "L", f.liters);
    addPreview("Evidencija goriva", row, "KM", f.km || f.current_km || (f.asset_kind === "vehicle" ? (f.reading || f.mtc_km) : ""));
    addPreview("Evidencija goriva", row, "MTČ", f.mtc || f.current_mtc || (f.asset_kind === "machine" ? (f.reading || f.mtc_km) : ""));
    addPreview("Evidencija goriva", row, "Sipao", f.by);
    addPreview("Evidencija goriva", row, "Primio", f.receiver || d.fuel_receiver);
    addPreview("Evidencija goriva", row, "Izvor", fuelSourceText(f));
  });

  fieldTankers.forEach((ft, i) => {
    const row = `Cisterna ${i + 1}`;
    addPreview("Evidencija goriva – cisterna", row, "Gradilište", ft.site_name);
    addPreview("Evidencija goriva – cisterna", row, "Cisterna / tablice", ft.tanker_registration || ft.tanker_plates || ft.tanker_asset_code || ft.tanker_asset_name || ft.tanker_vehicle || ft.cistern_vehicle);
    addPreview("Evidencija goriva – cisterna", row, "Tip sredstva", assetKindLabel(ft.asset_kind));
    addPreview("Evidencija goriva – cisterna", row, "Broj sredstva", ft.asset_code);
    addPreview("Evidencija goriva – cisterna", row, "Sredstvo", ft.asset_name || ft.machine || ft.vehicle || ft.other);
    addPreview("Evidencija goriva – cisterna", row, "KM", ft.km || ft.current_km || (ft.asset_kind === "vehicle" ? (ft.reading || ft.mtc_km) : ""));
    addPreview("Evidencija goriva – cisterna", row, "MTČ", ft.mtc || ft.current_mtc || (ft.asset_kind === "machine" ? (ft.reading || ft.mtc_km) : ""));
    addPreview("Evidencija goriva – cisterna", row, "Litara", ft.liters);
    addPreview("Evidencija goriva – cisterna", row, "Primio gorivo", ft.receiver || ft.received_by);
    addPreview("Evidencija goriva – cisterna", row, "Izvor goriva", fuelSourceText(ft));
  });

  materialEntries.forEach((m, i) => {
    const row = `Materijal ${i + 1}`;
    addPreview("Materijal", row, "Radnja", m.action || m.material_action);
    addPreview("Materijal", row, "Materijal", m.material || m.name);
    addPreview("Materijal", row, "Broj izvršenih tura", m.tours || m.material_tours);
    addPreview("Materijal", row, "Količina po turi", m.per_tour || m.quantity_per_tour || m.material_per_tour);
    addPreview("Materijal", row, "Ukupna količina", materialQuantityValue(m));
    addPreview("Materijal", row, "Jedinica", materialUnitValue(m));
    addPreview("Materijal", row, "Obračun", m.calc_text || materialCalcText(m));
    addPreview("Materijal", row, "Napomena", m.note);
  });

  addPreview("Magacin", "", "Tip promene", d.warehouse_type);
  addPreview("Magacin", "", "Stavka", d.warehouse_item);
  addPreview("Magacin", "", "Količina", d.warehouse_qty);

  addPreview("Zahtev za odsustvo", "", "Vrsta zahteva", d.leave_request_type || leaveRequest.leave_label || leaveRequest.label);
  addPreview("Zahtev za odsustvo", "", "Datum", d.leave_date || leaveRequest.leave_date || leaveRequest.date);
  addPreview("Zahtev za odsustvo", "", "Od", d.leave_from || leaveRequest.date_from);
  addPreview("Zahtev za odsustvo", "", "Do", d.leave_to || leaveRequest.date_to);
  addPreview("Zahtev za odsustvo", "", "Napomena", d.leave_note || leaveRequest.leave_note || leaveRequest.note);

  const excelTable = `
    <div class="report-excel-wrap report-excel-compact-wrap">
      <table class="report-excel-table report-excel-compact-table">
        <thead>
          <tr>
            <th>Sekcija</th>
            <th>Red</th>
            <th>Polje</th>
            <th>Vrednost</th>
          </tr>
        </thead>
        <tbody>${excelPreviewRows.join("") || `<tr><td colspan="4"><span class="report-empty">Nema podataka za Excel pregled.</span></td></tr>`}</tbody>
      </table>
    </div>`;

  const workerTable = workers.length ? `
    <table class="report-mini-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Ime i prezime</th>
          <th>Sati rada</th>
        </tr>
      </thead>
      <tbody>
        ${workers.map((w, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${val(w.full_name || [w.first_name, w.last_name].filter(Boolean).join(" "))}</td>
            <td>${val(w.hours)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>` : `<p class="report-empty">Nema dodatih zaposlenog u ekipi.</p>`;

  const machineTable = machines.length ? `
    <div class="paper-machine-list">
      ${machines.map((m, i) => `
        <div class="paper-machine-card">
          <div class="paper-machine-title"><b>${i + 1}. ${val(m.name)}</b><span>Broj: ${val(m.asset_code || m.machine_code)}</span></div>
          <div class="paper-machine-grid">
            <b>KM početak</b><span>${val(machineKmStart(m))}</span>
            <b>KM kraj</b><span>${val(machineKmEnd(m))}</span>
            <b>Ukupno KM</b><span>${val(machineKmTotal(m))}</span>
            <b>MTČ početak</b><span>${val(machineMtcStart(m))}</span>
            <b>MTČ kraj</b><span>${val(machineMtcEnd(m))}</span>
            <b>Ukupno MTČ</b><span>${val(machineMtcTotal(m))}</span>
            <b>Rad</b><span class="paper-machine-work">${val(m.work)}</span>
          </div>
        </div>
      `).join("")}
    </div>` : `<p class="report-empty">Nema unetih mašina.</p>`;

  const vehicleTable = vehicles.length ? `
    <table class="report-mini-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Broj</th>
          <th>Vozilo</th>
          <th>Reg.</th>
          <th>Kapacitet</th>
          <th>KM početak</th>
          <th>KM kraj</th>
          <th>Relacija</th>
          <th>Ture</th>
          <th>Ukupno m³</th>
        </tr>
      </thead>
      <tbody>
        ${vehicles.map((v, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${val(v.asset_code || v.vehicle_code)}</td>
            <td>${val(v.name || v.vehicle)}</td>
            <td>${val(v.registration)}</td>
            <td>${val(v.capacity)}</td>
            <td>${val(v.km_start)}</td>
            <td>${val(v.km_end)}</td>
            <td>${val(v.route)}</td>
            <td>${val(v.tours)}</td>
            <td>${val(v.cubic_m3 || v.cubic_auto)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>` : `<p class="report-empty">Nema unetih vozila.</p>`;

  const lowloaderTable = lowloaders.length ? `
    <table class="report-mini-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Tablice labudice</th>
          <th>Od lokacije</th>
          <th>Do lokacije</th>
          <th>KM početak</th>
          <th>KM kraj</th>
          <th>Ukupno km</th>
          <th>Mašina koja se transportuje</th>
          <th>Prateći alat</th>
        </tr>
      </thead>
      <tbody>
        ${lowloaders.map((ll, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${val(ll.plates || ll.registration)}</td>
            <td>${val(ll.from_site || ll.from_address)}</td>
            <td>${val(ll.to_site || ll.to_address)}</td>
            <td>${val(ll.km_start)}</td>
            <td>${val(ll.km_end)}</td>
            <td>${val(ll.km_total)}</td>
            <td>${val(ll.machine)}</td>
            <td>${val(ll.accompanying_tools || ll.tools)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>` : `<p class="report-empty">Nema unetih selidbi labudicom.</p>`;

  const waterTable = waters.length ? `
    <table class="report-mini-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Broj</th>
          <th>Cisterna</th>
          <th>Gradilište</th>
          <th>KM početak</th>
          <th>KM kraj</th>
          <th>Ukupno KM</th>
          <th>Litara vode</th>
          <th>Punjenja</th>
          <th>Punjenje</th>
          <th>Istovar/prskanje</th>
          <th>Namena</th>
        </tr>
      </thead>
      <tbody>
        ${waters.map((wt, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${val(wt.asset_code || wt.vehicle_code)}</td>
            <td>${val(wt.vehicle || wt.asset_name || wt.tanker_vehicle)}</td>
            <td>${val(officeEntrySiteName(wt, d.site_name || ""))}</td>
            <td>${val(wt.km_start)}</td>
            <td>${val(wt.km_end)}</td>
            <td>${val(waterTankerKmTotal(wt))}</td>
            <td>${val(waterTankerLiters(wt))}</td>
            <td>${val(waterTankerLoads(wt))}</td>
            <td>${val(wt.fill_location)}</td>
            <td>${val(wt.unload_location || wt.spray_location)}</td>
            <td>${val([waterTankerPurposeLabel(wt.purpose), wt.note].filter(Boolean).join(" · "))}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>` : `<p class="report-empty">Nema unete cisterne za vodu.</p>`;

  const fuelTable = fuels.length ? `
    <table class="report-mini-table report-fuel-horizontal">
      <colgroup>
        <col style="width:4%">
        <col style="width:8%">
        <col style="width:8%">
        <col style="width:20%">
        <col style="width:7%">
        <col style="width:7%">
        <col style="width:8%">
        <col style="width:12%">
        <col style="width:13%">
        <col style="width:13%">
      </colgroup>
      <thead>
        <tr>
          <th>#</th>
          <th>Tip</th>
          <th>Broj</th>
          <th>Sredstvo</th>
          <th>L</th>
          <th>KM</th>
          <th>MTČ</th>
          <th>Sipao</th>
          <th>Primio</th>
          <th>Izvor</th>
        </tr>
      </thead>
      <tbody>
        ${fuels.map((f, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${val(assetKindLabel(f.asset_kind))}</td>
            <td>${val(f.asset_code)}</td>
            <td>${val(assetDisplayName(f))}</td>
            <td>${val(f.liters)}</td>
            <td>${val(fuelKmValue(f))}</td>
            <td>${val(fuelMtcValue(f))}</td>
            <td>${val(f.by)}</td>
            <td>${val(f.receiver || d.fuel_receiver)}</td>
            <td>${val(fuelSourceText(f))}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>` : `<p class="report-empty">Nema sipanja goriva.</p>`;

  const tankerHeaderText = (() => {
    const plates = Array.from(new Set(fieldTankers.map(ft => tankerPlates(ft)).filter(v => safe(v))));
    const names = Array.from(new Set(fieldTankers.map(ft => tankerName(ft)).filter(v => safe(v))));
    const parts = [];
    if (plates.length) parts.push(`Tablice: ${plates.map(esc).join(", ")}`);
    if (names.length) parts.push(`Cisterna: ${names.map(esc).join(", ")}`);
    return parts.length ? ` <span class="paper-section-note">${parts.join(" · ")}</span>` : "";
  })();

  const fieldTankerTable = fieldTankers.length ? `
    <table class="report-mini-table report-fuel-horizontal">
      <colgroup>
        <col style="width:4%">
        <col style="width:8%">
        <col style="width:20%">
        <col style="width:20%">
        <col style="width:12%">
        <col style="width:7%">
        <col style="width:8%">
        <col style="width:7%">
        <col style="width:14%">
      </colgroup>
      <thead>
        <tr>
          <th>#</th>
          <th>Broj</th>
          <th>Mašina</th>
          <th>Vozilo</th>
          <th>Ostalo</th>
          <th>KM</th>
          <th>MTČ</th>
          <th>L</th>
          <th>Primio / izvor</th>
        </tr>
      </thead>
      <tbody>
        ${fieldTankers.map((ft, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${val(ft.asset_code)}</td>
            <td>${assetNameForKind(ft, "machine") || "<span class='report-empty'>—</span>"}</td>
            <td>${assetNameForKind(ft, "vehicle") || "<span class='report-empty'>—</span>"}</td>
            <td>${assetNameForKind(ft, "other") || "<span class='report-empty'>—</span>"}</td>
            <td>${val(fuelKmValue(ft))}</td>
            <td>${val(fuelMtcValue(ft))}</td>
            <td>${val(ft.liters)}</td>
            <td>${val([ft.receiver || ft.received_by, fuelSourceText(ft)].filter(Boolean).join(" / "))}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>` : `<p class="report-empty">Nema terenskih sipanja cisternom.</p>`;

  const materialTable = materialEntries.length ? `
    <table class="report-mini-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Radnja</th>
          <th>Materijal</th>
          <th>Ture</th>
          <th>Po turi</th>
          <th>Ukupno</th>
          <th>Jedinica</th>
          <th>Obračun</th>
          <th>Napomena</th>
        </tr>
      </thead>
      <tbody>
        ${materialEntries.map((m, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${val(m.action || m.material_action)}</td>
            <td>${val(m.material || m.name)}</td>
            <td>${val(m.tours || m.material_tours)}</td>
            <td>${val(m.per_tour || m.quantity_per_tour || m.material_per_tour)}</td>
            <td>${val(materialQuantityValue(m))}</td>
            <td>${val(materialUnitValue(m))}</td>
            <td>${val(m.calc_text || materialCalcText(m))}</td>
            <td>${val(m.note)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>` : ``;



  const hasWarehouse = safe(d.warehouse_type) || safe(d.warehouse_item) || safe(d.warehouse_qty);
  const warehouseBox = hasWarehouse ? `<div class="report-kv report-sub-kv">
    ${rows([
      ["Magacin tip", d.warehouse_type],
      ["Magacin stavka", d.warehouse_item],
      ["Magacin količina", d.warehouse_qty]
    ])}
  </div>` : "";

  const showDefectSection = options.showDefect !== false;
  const hasDefect = showDefectSection && (safe(d.defect) || safe(d.defect_exists) === "da" || safe(d.defect_urgency) || safe(d.defect_status) || safe(d.defect_asset_name) || safe(d.defect_asset_code));
  const hasMaterialEntries = materialEntries.some(entry => entry && Object.values(entry).some(v => v !== undefined && v !== null && String(v).trim() !== ""));
  const hasMaterial = hasMaterialEntries || safe(d.material) || safe(d.quantity) || safe(d.unit) || safe(d.warehouse_type) || safe(d.warehouse_item) || safe(d.warehouse_qty);
  const hasLeaveRequest = safe(d.leave_request_type) || safe(d.leave_type) || safe(d.leave_date) || safe(d.leave_from) || safe(d.leave_to) || safe(d.leave_note) || (leaveRequest && Object.values(leaveRequest).some(v => v !== undefined && v !== null && String(v).trim() !== ""));

  const hasUsefulEntry = (entry) => entry && Object.values(entry).some(v => v !== undefined && v !== null && String(v).trim() !== "");
  const hasWorkers = workers.some(hasUsefulEntry);
  const hasMachines = machines.some(hasUsefulEntry);
  const hasVehicles = vehicles.some(hasUsefulEntry);
  const hasLowloaders = lowloaders.some(hasUsefulEntry);
  const hasWaters = waters.some(hasUsefulEntry);
  const hasFuels = fuels.some(hasUsefulEntry);
  const hasFieldTankers = fieldTankers.some(hasUsefulEntry);
  const hasGeneralNote = safe(d.description) || safe(d.note);
  const hasSignature = safe(d.signature_data_url);
  const signatureBox = hasSignature ? `
    <div class="report-section report-signature-section">
      <h4>Potpis zaposlenog / odgovornog lica</h4>
      <div class="paper-signature-box">
        <img src="${esc(d.signature_data_url)}" alt="Potpis zaposlenog" />
        <div>
          <b>${esc(d.signature_name || d.created_by_worker || "Potpisnik")}</b>
          <span>${esc(formatDateTimeLocal(d.signature_signed_at) || "")}</span>
        </div>
      </div>
    </div>` : `
    <div class="report-section report-signature-section paper-empty-signature">
      <h4>Potpis</h4>
      <div class="paper-signature-line">Potpis zaposlenog / odgovornog lica</div>
    </div>`;

  return `
    <div class="report-readable">
      ${hasGeneralNote ? `<div class="report-section report-note-summary">
        <h4>Napomena / opis sa terena</h4>
        <div class="report-kv">
          ${rows([
            ["Opis rada", d.description],
            ["Napomena", d.note]
          ])}
        </div>
      </div>` : ""}

      ${hasWorkers ? `<div class="report-section">
        <h4>Evidencija zaposlenih na gradilištu</h4>
        ${workerTable}
      </div>` : ""}

      ${hasMachines ? `<div class="report-section">
        <h4>Evidencija rada mašine</h4>
        ${machineTable}
      </div>` : ""}

      ${hasVehicles ? `<div class="report-section">
        <h4>Evidencija rada vozila</h4>
        ${vehicleTable}
      </div>` : ""}

      ${hasLowloaders ? `<div class="report-section">
        <h4>Transport mašine labudicom</h4>
        ${lowloaderTable}
      </div>` : ""}

      ${hasWaters ? `<div class="report-section">
        <h4>Cisterna za vodu</h4>
        ${waterTable}
      </div>` : ""}

      ${hasFuels ? `<div class="report-section">
        <h4>Evidencija goriva</h4>
        ${fuelTable}
      </div>` : ""}

      ${hasFieldTankers ? `<div class="report-section">
        <h4>Evidencija goriva – cisterna${tankerHeaderText}</h4>
        ${fieldTankerTable}
        ${tankerConsumptionTableHtml(fieldTankers, options.report || {})}
      </div>` : ""}

      ${hasDefect ? `
        <div class="report-section">
          <h4>Evidencija kvara</h4>
          <div class="report-kv">
            ${rows([
              ["Broj sredstva", d.defect_asset_code],
              ["Sredstvo/oprema u kvaru", d.defect_asset_name || d.defect_machine || d.machine || d.vehicle],
              ["Registracija", d.defect_asset_registration],
              ["Lokacija", d.defect_site_name || d.site_name],
              ["Opis kvara", d.defect],
              ["Hitnost", d.defect_urgency],
              ["Uticaj na rad", d.defect_work_impact === "zaustavlja_rad" ? "Zaustavlja rad" : d.defect_work_impact === "moze_nastaviti" ? "Može nastaviti rad" : d.defect_work_impact],
              ["Pozvan odgovorno lice mehanizacije", d.called_mechanic_by_phone],
              ["Status kvara", d.defect_status],
              ["Broj slika", normalizeDefectImages(d).length || "—"]
            ])}
          </div>
          ${defectImagesHtml(d)}
          ${defectTimelineHtml(d)}
        </div>` : ""}

      ${hasLeaveRequest ? `
        <div class="report-section">
          <h4>Zahtev za odsustvo</h4>
          <div class="report-kv">
            ${rows([
              ["Vrsta zahteva", d.leave_request_type || leaveRequest.leave_label || leaveRequest.label],
              ["Datum", d.leave_date || leaveRequest.leave_date || leaveRequest.date],
              ["Od", d.leave_from || leaveRequest.date_from],
              ["Do", d.leave_to || leaveRequest.date_to],
              ["Napomena", d.leave_note || leaveRequest.leave_note || leaveRequest.note]
            ])}
          </div>
        </div>` : ""}

      ${hasMaterial ? `
        <div class="report-section">
          <h4>Materijal i magacin</h4>
          ${hasMaterialEntries ? materialTable + warehouseBox : `<div class="report-kv">
            ${rows([
              ["Materijal", d.material],
              ["Količina", d.quantity],
              ["Jedinica", d.unit],
              ["Magacin tip", d.warehouse_type],
              ["Magacin stavka", d.warehouse_item],
              ["Magacin količina", d.warehouse_qty]
            ])}
          </div>`}
        </div>` : ""}

      ${signatureBox}

      <!-- Excel pregled je uklonjen iz A4 papira; izvoz se preuzima posebnim dugmetom. -->
    </div>
  `;
}


function getReportFilledSections(d = {}) {
  const hasValue = (v) => v !== undefined && v !== null && String(v).trim() !== "";
  const hasEntry = (entry) => entry && typeof entry === "object" && Object.values(entry).some(hasValue);
  const arr = (v) => Array.isArray(v) ? v : [];
  const sections = [];

  if (d.report_type === "site_daily_log") {
    sections.push("Dnevnik gradilišta");
    if (arr(d.workers).some(hasEntry)) sections.push("Zaposleni");
    if (arr(d.material_in).some(hasEntry)) sections.push("Ulaz materijala");
    if (arr(d.material_out).some(hasEntry)) sections.push("Izlaz materijala");
    if (arr(d.materials_installed).some(hasEntry)) sections.push("Ugrađeno");
    if (arr(d.materials_stock_on_site).some(hasEntry)) sections.push("Lager");
    if (arr(d.truck_tours).some(hasEntry)) sections.push("Broj tura");
    if (hasValue(d.site_log_signature_data_url) || d.signed_file) sections.push("Overa");
    return sections;
  }

  if (hasValue(d.site_name) || hasValue(d.description) || hasValue(d.hours) || hasValue(d.note)) sections.push("Osnovno");
  if (arr(d.workers).some(hasEntry) || arr(d.worker_entries).some(hasEntry)) sections.push("Zaposleni");
  if (arr(d.machines).some(hasEntry)) sections.push("Mašina");
  if (arr(d.vehicles).some(hasEntry)) sections.push("Vozilo");
  if (arr(d.lowloader_moves).some(hasEntry) || arr(d.lowloader_entries).some(hasEntry)) sections.push("Transport");
  if (arr(d.water_tanker_entries).some(hasEntry) || arr(d.water_entries).some(hasEntry)) sections.push("Voda");
  if (arr(d.fuel_entries).some(hasEntry)) sections.push("Gorivo");
  if (arr(d.field_tanker_entries).some(hasEntry) || arr(d.tanker_fuel_entries).some(hasEntry)) sections.push("Cisterna");
  if (hasValue(d.defect) || hasValue(d.defect_asset_name) || hasValue(d.defect_urgency) || hasValue(d.defect_work_impact)) sections.push("Kvar");
  if (arr(d.material_entries).some(hasEntry) || arr(d.material_movements).some(hasEntry) || hasValue(d.material) || hasValue(d.quantity)) sections.push("Materijal");
  if (hasValue(d.signature_data_url)) sections.push("Potpis");
  if (hasValue(d.warehouse_type) || hasValue(d.warehouse_item) || hasValue(d.warehouse_qty)) sections.push("Magacin");
  if (hasValue(d.leave_request_type) || hasValue(d.leave_type) || hasValue(d.leave_date) || hasValue(d.leave_from) || hasValue(d.leave_to) || (d.leave_request && hasEntry(d.leave_request))) sections.push("Odsustvo");
  return sections.length ? sections : ["Izveštaj"];
}

window.setReportPaperZoom = function(id, zoom) {
  const el = document.getElementById(`paper-${id}`);
  if (!el) return;
  const next = Math.max(0.8, Math.min(1.5, Number(zoom) || 1));
  el.style.setProperty("--report-zoom", String(next));
  const label = document.getElementById(`paperZoom-${id}`);
  if (label) label.textContent = `${Math.round(next * 100)}%`;
};

window.changeReportPaperZoom = function(id, delta) {
  const el = document.getElementById(`paper-${id}`);
  const current = el ? Number(el.style.getPropertyValue("--report-zoom") || "1") : 1;
  window.setReportPaperZoom(id, current + delta);
};

window.printReportA4 = function(id) {
  const el = document.getElementById(`paper-${id}`);
  if (!el) return toast("Ne mogu da pronađem papirni pregled za štampu.", true);
  document.querySelectorAll(".print-target-report").forEach(x => x.classList.remove("print-target-report"));
  el.classList.add("print-target-report");
  document.body.classList.add("printing-report-paper");
  setTimeout(() => window.print(), 50);
  setTimeout(() => {
    document.body.classList.remove("printing-report-paper");
    el.classList.remove("print-target-report");
  }, 800);
};

window.downloadReportA4 = function(id) {
  const el = document.getElementById(`paper-${id}`);
  if (!el) return toast("Ne mogu da pronađem papirni pregled za preuzimanje.", true);
  const title = (el.querySelector("h3")?.textContent || "Dnevni radni izveštaj").trim();
  const metaText = Array.from(el.querySelectorAll(".paper-meta-table td")).map(x => x.textContent.trim()).filter(Boolean);
  const fileName = safeFilePart(`${title}_${metaText[0] || ""}_${metaText[1] || ""}`) + ".html";
  const html = `<!doctype html>
<html lang="sr">
<head>
<meta charset="utf-8" />
<title> </title>
<style>
  @page{size:A4;margin:12mm;}
  *{box-sizing:border-box;}
  body{font-family:Arial,Helvetica,sans-serif;margin:0;background:#fff;color:#17231b;font-size:12px;}
  .report-paper-view{width:100%;max-width:190mm;margin:0 auto;background:#fff;}
  .paper-title-block{border-bottom:2px solid #1f3326;margin-bottom:12px;padding-bottom:8px;text-align:center;}
  .paper-title-block h3{margin:0 0 4px;font-size:18px;text-transform:uppercase;}
  .paper-title-block p{margin:0;color:#5e6b62;font-size:11px;}
  table{width:100%;border-collapse:collapse;page-break-inside:auto;}
  th,td{border:1px solid #c8d2cc;padding:5px 7px;vertical-align:top;}
  th{background:#edf1ee;text-align:left;font-weight:700;}
  tr{page-break-inside:avoid;page-break-after:auto;}
  h4{font-size:13px;text-transform:uppercase;border-bottom:2px solid #c8d2cc;margin:14px 0 7px;padding-bottom:5px;}
  .report-section{page-break-inside:avoid;margin:12px 0;}
  .report-kv{display:grid;grid-template-columns:45mm 1fr;border:1px solid #c8d2cc;}
  .report-kv b,.report-kv span{border-bottom:1px solid #dce4df;padding:5px 7px;}
  .report-kv b{background:#f2f4f3;}
  .paper-footer-note{border-top:1px solid #c8d2cc;margin-top:14px;padding-top:7px;text-align:right;color:#66716a;font-size:10px;}
  .report-excel-details{display:none;}
</style>
</head>
<body>${el.outerHTML}</body>
</html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast("A4 pregled je preuzet na kompjuter. Može da se otvori i štampa.");
};



function reportDocumentPrefix(r) {
  const d = r?.data || {};
  const type = String(d.report_type || "").toLowerCase();
  if (type === "site_daily_log") return "DG";      // Dnevnik gradilišta
  if (type.includes("defect")) return "KV";        // Kvar
  if (type.includes("fuel") || type.includes("tanker")) return "GR"; // Gorivo
  return "DRI";                                    // Dnevni radni izveštaj
}

function compactDateForDocumentNumber(value) {
  const raw = String(value || "").trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}${m[2]}${m[3]}`;
  const d = value ? new Date(value) : new Date();
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  }
  return new Date().toISOString().slice(0,10).replaceAll("-", "");
}

function compactTimeForDocumentNumber(value) {
  const d = value ? new Date(value) : new Date();
  if (!Number.isNaN(d.getTime())) {
    return `${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}`;
  }
  return "0000";
}

function reportDocumentNumber(r) {
  const d = r?.data || {};
  if (d.document_number) return String(d.document_number);
  const prefix = reportDocumentPrefix(r);
  const datePart = compactDateForDocumentNumber(r?.report_date || d.report_date_manual || d.report_date || r?.created_at || r?.submitted_at);
  const timePart = compactTimeForDocumentNumber(r?.submitted_at || r?.created_at);
  const idPart = String(r?.id || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toUpperCase() || "NACRT";
  return `${prefix}-${datePart}-${timePart}-${idPart}`;
}

function reportDocumentTitle(r) {
  const d = r?.data || {};
  return d.report_type === "site_daily_log" ? "DNEVNIK GRADILIŠTA" : (isDefectOnlyReport(r) ? "PRIJAVA KVARA" : "DNEVNI RADNI IZVEŠTAJ SA TERENA");
}

function reportDocumentPerson(r) {
  const d = r?.data || {};
  return r?.company_users ? `${r.company_users.first_name || ""} ${r.company_users.last_name || ""}`.trim() : (d.created_by_worker || d.worker_name || "Nepoznat korisnik");
}

function buildReportPaperHtml(r, paperIdPrefix = "paper") {
  const d = r.data || {};
  const title = reportDocumentTitle(r);
  const person = reportDocumentPerson(r);
  const submitted = formatDateTimeLocal(r.submitted_at || r.created_at);
  const statusText = r.status || "novo";
  const statusLabel = reportStatusLabel(statusText);
  const primaryLocation = reportPrimaryLocationLabel(r);
  const paperSubtitle = isDefectOnlyReport(r)
    ? "Papirni pregled prijave kvara za mehanizaciju, Direkciju, štampu i arhivu"
    : "Papirni pregled dnevnog izveštaja za kontrolu, potpis, štampu i arhivu";
  return `
    <section class="report-paper-view document-center-paper" id="${paperIdPrefix}-${r.id}" style="--report-zoom:1">
      <div class="paper-title-block">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(paperSubtitle)}</p>
      </div>

      <table class="paper-meta-table">
        <tbody>
          <tr><th>Datum izveštaja</th><td>${escapeHtml(formatDateOnlyLocal(r.report_date || d.report_date_manual || d.report_date || ""))}</td><th>Status</th><td>${escapeHtml(statusLabel)}</td></tr>
          <tr><th>Gradilište / lokacija</th><td>${escapeHtml(primaryLocation || "—")}</td><th>Vreme slanja</th><td>${escapeHtml(submitted || "—")}</td></tr>
          <tr><th>Broj radnika</th><td>${escapeHtml(reportEmployeeNumber(r) || "—")}</td><th>Zaposleni / odgovorno lice</th><td>${escapeHtml(person)}</td></tr>
          <tr><th>Radno mesto</th><td colspan="3">${escapeHtml(r.company_users?.function_title || d.function_title || "—")}</td></tr>
          <tr><th>Firma</th><td>${escapeHtml(currentCompany?.company_name || currentCompany?.name || "—")}</td><th>Broj dokumenta</th><td>${escapeHtml(reportDocumentNumber(r))}</td></tr>
        </tbody>
      </table>

      ${r.returned_reason ? `<div class="paper-returned-reason"><b>Razlog vraćanja na ispravku:</b> ${escapeHtml(r.returned_reason)}</div>` : ""}

      ${renderReportReadableDetails(d, { showDefect: true, report: r })}

      <div class="paper-footer-note">
        Pregled pripremljen u AskCreate.app · ${escapeHtml(formatDateTimeLocal(new Date().toISOString()))}
      </div>
    </section>`;
}

function buildStandaloneReportPrintHtml(r) {
  const title = reportDocumentTitle(r);
  const paper = buildReportPaperHtml(r, "print-paper");
  return `<!doctype html>
<html lang="sr">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page{size:A4;margin:12mm;}
  *{box-sizing:border-box;}
  body{font-family:Arial,Helvetica,sans-serif;margin:0;background:#fff;color:#111827;font-size:12px;}
  .report-paper-view{width:100%;max-width:190mm;margin:0 auto;background:#fff;color:#111827;}
  .paper-title-block{border-bottom:2px solid #111827;margin-bottom:12px;padding-bottom:8px;text-align:center;}
  .paper-title-block h3{margin:0 0 4px;font-size:18px;text-transform:uppercase;color:#111827;letter-spacing:.03em;}
  .paper-title-block p{margin:0;color:#374151;font-size:11px;}
  table{width:100%;border-collapse:collapse;page-break-inside:auto;color:#111827;}
  th,td{border:1px solid #9ca3af;padding:5px 7px;vertical-align:top;color:#111827;}
  th{background:#edf1ee;text-align:left;font-weight:700;}
  tr{page-break-inside:avoid;page-break-after:auto;}
  h4{font-size:13px;text-transform:uppercase;border-bottom:2px solid #9ca3af;margin:14px 0 7px;padding-bottom:5px;color:#111827;}
  p{color:#111827;}
  .report-section{page-break-inside:avoid;margin:12px 0;color:#111827;}
  .report-kv{display:grid;grid-template-columns:45mm 1fr;border:1px solid #9ca3af;}
  .report-kv b,.report-kv span{border-bottom:1px solid #d1d5db;padding:5px 7px;color:#111827;}
  .report-kv b{background:#f3f4f6;font-weight:700;}
  .paper-footer-note{border-top:1px solid #9ca3af;margin-top:14px;padding-top:7px;text-align:right;color:#4b5563;font-size:10px;}
  .report-excel-details{display:none!important;}
  .report-empty{color:#6b7280;}
  .paper-signature-box img{max-height:80px;max-width:220px;border:1px solid #d1d5db;background:#fff;}
  .paper-signature-line{margin-top:40px;border-top:1px solid #111827;width:70mm;padding-top:5px;color:#111827;}
  .signed-file-note{border:1px solid #9ca3af;padding:7px;background:#f9fafb;}
  .paper-machine-list{display:grid;gap:8px;margin:4px 0 0;}
  .paper-machine-card{border:1px solid #9ca3af;background:#fff;break-inside:avoid;page-break-inside:avoid;}
  .paper-machine-title{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:6px 8px;background:#eef2f0;border-bottom:1px solid #9ca3af;font-size:12px;}
  .paper-machine-title b{font-weight:800;}
  .paper-machine-title span{font-size:11px;color:#374151;}
  .paper-machine-grid{display:grid;grid-template-columns:28mm 1fr 28mm 1fr 28mm 1fr;}
  .paper-machine-grid b,.paper-machine-grid span{border-right:1px solid #d1d5db;border-bottom:1px solid #d1d5db;padding:5px 6px;min-height:25px;font-size:11px;}
  .paper-machine-grid b{background:#f8fafc;font-weight:800;}
  .paper-machine-grid .paper-machine-work{grid-column:2 / -1;}
  .report-mini-table{min-width:0!important;width:100%;table-layout:auto;}
  .report-mini-table th,.report-mini-table td{white-space:normal!important;overflow-wrap:anywhere!important;}

</style>
</head>
<body>${paper}</body>
</html>`;
}

window.openReportDocumentCenter = function(id) {
  const r = directorReportsCache.find(x => String(x.id) === String(id));
  if (!r) return toast("Izveštaj nije pronađen. Osveži listu izveštaja.", true);
  const d = r.data || {};
  const title = reportDocumentTitle(r);
  const person = reportDocumentPerson(r);
  const statusLabel = reportStatusLabel(r.status || "novo");
  let modal = document.getElementById("reportDocumentCenter");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "reportDocumentCenter";
    modal.className = "report-document-center hidden";
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div class="report-doc-shell">
      <header class="report-doc-top no-print">
        <div>
          <small>Centar dokumenata izveštaja</small>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(person)} · ${escapeHtml(reportPrimaryLocationLabel(r))} · ${escapeHtml(r.report_date || "")}</p>
        </div>
        <button class="secondary report-doc-close" type="button" onclick="closeReportDocumentCenter()">Nazad</button>
      </header>

      <div class="report-doc-actions no-print">
        <button class="primary" type="button" onclick="saveReportDocumentAsPdf('${r.id}')">Sačuvaj kao PDF</button>
        <button class="secondary" type="button" onclick="saveReportDocumentAsPng('${r.id}')">Preuzmi PNG</button>
        <button class="secondary" type="button" onclick="printReportDocument('${r.id}')">Štampaj dokument</button>
        <button class="secondary" type="button" onclick="exportSingleReportToExcel('${r.id}')">Izvezi dokument u Excel</button>
        <button class="secondary" type="button" onclick="setReportStatus('${r.id}','approved')">Odobri izveštaj</button>
        <button class="secondary danger-soft" type="button" onclick="returnReport('${r.id}')">Vrati na ispravku</button>
        <button class="secondary" type="button" onclick="archiveReport('${r.id}')">Arhiviraj</button>
      </div>

      <div class="report-doc-status no-print">
        <span>Status: <b>${escapeHtml(statusLabel)}</b></span>
        <span>Firma: <b>${escapeHtml(currentCompany?.company_name || currentCompany?.name || "—")}</b></span>
        <span>Dokument ostaje u bazi; PDF/štampa/Excel su izlazni fajlovi za kancelariju.</span>
      </div>

      <main class="report-doc-paper-wrap">
        ${buildReportPaperHtml(r, "doc-paper")}
      </main>
    </div>`;
  modal.classList.remove("hidden");
  document.body.classList.add("report-doc-open");
};

window.closeReportDocumentCenter = function() {
  const modal = document.getElementById("reportDocumentCenter");
  if (modal) modal.classList.add("hidden");
  document.body.classList.remove("report-doc-open", "printing-report-document-center");
};

function loadJsPdfForReports() {
  const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
  if (jsPDF) return Promise.resolve(jsPDF);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-report-jspdf="1"]');
    if (existing) {
      existing.addEventListener("load", () => {
        const loaded = window.jspdf?.jsPDF || window.jsPDF;
        loaded ? resolve(loaded) : reject(new Error("PDF print alat nije učitan."));
      });
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.async = true;
    script.dataset.reportJspdf = "1";
    script.onload = () => {
      const loaded = window.jspdf?.jsPDF || window.jsPDF;
      loaded ? resolve(loaded) : reject(new Error("PDF print alat nije učitan."));
    };
    script.onerror = () => reject(new Error("PDF print alat nije mogao da se učita. Proveri internet vezu."));
    document.head.appendChild(script);
  });
}

async function buildCleanReportPdfBlobUrl(r) {
  const [html2canvas, jsPDF] = await Promise.all([loadHtml2CanvasForReports(), loadJsPdfForReports()]);
  const holder = document.createElement("div");
  holder.className = "report-clean-print-holder";
  holder.style.position = "fixed";
  holder.style.left = "-10000px";
  holder.style.top = "0";
  holder.style.width = "210mm";
  holder.style.background = "#ffffff";
  holder.style.zIndex = "-1";
  holder.style.pointerEvents = "none";
  holder.innerHTML = buildReportPaperHtml(r, "clean-print-paper");
  document.body.appendChild(holder);
  try {
    const paper = holder.querySelector(".report-paper-view");
    if (!paper) throw new Error("A4 dokument nije pronađen za štampu.");
    paper.style.width = "210mm";
    paper.style.maxWidth = "210mm";
    paper.style.minHeight = "297mm";
    paper.style.margin = "0";
    paper.style.boxShadow = "none";
    paper.style.border = "0";
    paper.style.background = "#ffffff";
    await new Promise(resolve => setTimeout(resolve, 80));
    const canvas = await html2canvas(paper, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0
    });
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    const imgData = canvas.toDataURL("image/jpeg", 0.98);
    pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
    if (typeof pdf.autoPrint === "function") pdf.autoPrint({ variant: "non-conform" });
    return pdf.output("bloburl");
  } finally {
    holder.remove();
  }
}

window.printReportDocument = async function(id) {
  const r = directorReportsCache.find(x => String(x.id) === String(id));
  if (!r) return toast("Izveštaj nije pronađen.", true);
  try {
    toast("Pripremam čistu A4 štampu bez datuma i duplog naslova...");
    const pdfUrl = await buildCleanReportPdfBlobUrl(r);
    const w = window.open(pdfUrl, "_blank");
    if (!w) {
      const a = document.createElement("a");
      a.href = pdfUrl;
      a.target = "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast("Otvoren je čist PDF za štampu. Ako browser blokira automatsku štampu, pritisni Print u PDF prikazu.");
      return;
    }
    setTimeout(() => { try { w.focus(); } catch(e) {} }, 300);
    toast("Otvoren je čist A4 dokument za štampu, bez Chrome datuma i zaglavlja.");
  } catch (e) {
    document.querySelectorAll(".report-clean-print-holder").forEach(x => x.remove());
    toast(e.message || "Čista štampa nije uspela.", true);
  }
};

function loadHtml2PdfForReports() {
  if (window.html2pdf) return Promise.resolve(window.html2pdf);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-report-html2pdf="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.html2pdf));
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    script.async = true;
    script.dataset.reportHtml2pdf = "1";
    script.onload = () => window.html2pdf ? resolve(window.html2pdf) : reject(new Error("PDF alat nije učitan."));
    script.onerror = () => reject(new Error("PDF alat nije mogao da se učita. Proveri internet vezu."));
    document.head.appendChild(script);
  });
}

window.saveReportDocumentAsPdf = async function(id) {
  const r = directorReportsCache.find(x => String(x.id) === String(id));
  if (!r) return toast("Izveštaj nije pronađen.", true);
  try {
    toast("Pripremam čist A4 PDF bez Chrome datuma i naslova...");
    const html2pdf = await loadHtml2PdfForReports();
    const holder = document.createElement("div");
    holder.className = "report-pdf-export-holder";
    holder.style.position = "fixed";
    holder.style.left = "0";
    holder.style.top = "0";
    holder.style.width = "210mm";
    holder.style.background = "#ffffff";
    holder.style.zIndex = "-1";
    holder.style.opacity = "0";
    holder.style.pointerEvents = "none";
    holder.innerHTML = buildReportPaperHtml(r, "pdf-paper");
    document.body.appendChild(holder);
    const paper = holder.querySelector(".report-paper-view");
    if (!paper) throw new Error("A4 dokument nije pronađen za PDF.");
    paper.style.width = "210mm";
    paper.style.maxWidth = "210mm";
    paper.style.minHeight = "297mm";
    paper.style.margin = "0";
    paper.style.boxShadow = "none";
    paper.style.border = "0";
    paper.style.background = "#ffffff";
    const name = safeFilePart(`${reportDocumentTitle(r)}_${r.report_date || today()}_${(r.data || {}).site_name || "izvestaj"}`) + ".pdf";
    await html2pdf()
      .set({
        margin: 0,
        filename: name,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false, scrollX: 0, scrollY: 0 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
        pagebreak: { mode: ["css", "legacy"], avoid: [".paper-machine-card", ".report-section", "tr"] }
      })
      .from(paper)
      .save();
    holder.remove();
    toast("Čist A4 PDF je preuzet bez datuma i duplog naslova.");
  } catch (e) {
    document.querySelectorAll(".report-pdf-export-holder").forEach(x => x.remove());
    toast(e.message || "PDF preuzimanje nije uspelo.", true);
  }
};

function loadHtml2CanvasForReports() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-report-html2canvas="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.html2canvas));
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
    script.async = true;
    script.dataset.reportHtml2canvas = "1";
    script.onload = () => window.html2canvas ? resolve(window.html2canvas) : reject(new Error("PNG alat nije učitan."));
    script.onerror = () => reject(new Error("PNG alat nije mogao da se učita. Proveri internet vezu."));
    document.head.appendChild(script);
  });
}

window.saveReportDocumentAsPng = async function(id) {
  const r = directorReportsCache.find(x => String(x.id) === String(id));
  const el = document.getElementById(`doc-paper-${id}`) || document.getElementById(`paper-${id}`);
  if (!r || !el) return toast("Ne mogu da pronađem A4 dokument za PNG.", true);
  try {
    toast("Pripremam A4 PNG...");
    const html2canvas = await loadHtml2CanvasForReports();
    const canvas = await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: Math.min(2.2, Math.max(1.5, window.devicePixelRatio || 1.5)),
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0
    });
    canvas.toBlob(blob => {
      if (!blob) return toast("PNG nije mogao da se napravi.", true);
      const name = safeFilePart(`${reportDocumentTitle(r)}_${r.report_date || today()}_${(r.data || {}).site_name || "izvestaj"}`) + ".png";
      downloadBlob(blob, name);
      toast("A4 PNG dokument je preuzet.");
    }, "image/png", 1);
  } catch (e) {
    toast(e.message || "PNG preuzimanje nije uspelo.", true);
  }
};

window.addReportToExcelSelection = function(id) {
  toggleReportExportSelection(id, true);
  const cb = Array.from(document.querySelectorAll(".report-export-check")).find(x => String(x.dataset.reportId || "") === String(id));
  if (cb) cb.checked = true;
  renderExportPanel();
  toast("Izveštaj je dodat u Excel izbor.");
};

function excelDisplayValue(key, value) {
  if (key === "status") return reportStatusLabel(value);
  if (key === "date" || /_date$/.test(key) || key === "leave_from" || key === "leave_to") return value ? formatDateOnlyLocal(value) : "";
  return excelCellText(value);
}

function excelNonEmpty(value) {
  return String(value ?? "").trim() !== "";
}

function excelSectionRows(items, columns) {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) return `<tr><td colspan="${columns.length}" class="empty-cell">Nema podataka</td></tr>`;
  return rows.map((row, i) => `<tr>${columns.map(col => `<td>${escapeHtml(excelDisplayValue(col.key, col.get ? col.get(row, i) : row[col.key]))}</td>`).join("")}</tr>`).join("");
}

function excelColgroup(widths = []) {
  return widths.length ? `<colgroup>${widths.map(w => `<col style="width:${w};" />`).join("")}</colgroup>` : "";
}

function cleanExcelShell(title, bodyHtml, subtitle = "") {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: Arial, Helvetica, sans-serif; color:#111827; background:#ffffff; }
  .sheet { max-width: 1180px; }
  .doc-title { font-size: 18pt; font-weight: 800; margin: 0 0 6px; color:#111827; }
  .doc-subtitle { font-size: 10pt; color:#4b5563; margin: 0 0 18px; }
  .section-title { font-size: 12pt; font-weight: 800; margin: 20px 0 8px; color:#111827; border-bottom:2px solid #111827; padding-bottom:4px; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; margin-bottom: 14px; font-size: 10.5pt; }
  th { background:#e8f1ec; color:#111827; font-weight:800; border:1px solid #9ca3af; padding:7px 8px; text-align:left; white-space:normal; }
  td { border:1px solid #c7d0d8; padding:7px 8px; vertical-align:top; white-space:normal; mso-number-format:"\\@"; }
  .meta th { background:#f3f4f6; width: 22%; }
  .meta td { width: 28%; }
  .empty-cell { color:#6b7280; font-style:italic; text-align:center; }
  .small-note { color:#6b7280; font-size:9pt; margin-top:10px; }
</style>
</head>
<body><div class="sheet"><div class="doc-title">${escapeHtml(title)}</div>${subtitle ? `<div class="doc-subtitle">${escapeHtml(subtitle)}</div>` : ""}${bodyHtml}</div></body>
</html>`;
}

function buildSingleReportExcelHtml(r) {
  const d = r.data || {};
  const machines = Array.isArray(d.machines) ? d.machines : [];
  const vehicles = Array.isArray(d.vehicles) ? d.vehicles : [];
  const fuels = Array.isArray(d.fuel_entries) ? d.fuel_entries : [];
  const materials = Array.isArray(d.material_entries) ? d.material_entries : (Array.isArray(d.material_movements) ? d.material_movements : (Array.isArray(d.materials) ? d.materials : []));
  const lowloaders = officeLowloaderEntries(d);
  const waters = officeWaterEntries(d);
  const title = reportDocumentTitle(r);
  const docNo = reportDocumentNumber(r);
  const body = `
    <div class="section-title">Osnovni podaci</div>
    <table class="meta">
      <tr><th>Firma</th><td>${escapeHtml(currentCompanyExportName())}</td><th>Broj dokumenta</th><td>${escapeHtml(docNo)}</td></tr>
      <tr><th>Datum izveštaja</th><td>${escapeHtml(formatDateOnlyLocal(r.report_date || d.report_date))}</td><th>Status</th><td>${escapeHtml(reportStatusLabel(r.status))}</td></tr>
      <tr><th>Gradilište</th><td>${escapeHtml(d.site_name || "")}</td><th>Vreme slanja</th><td>${escapeHtml(formatDateTimeLocal(r.submitted_at || r.created_at))}</td></tr>
      <tr><th>Broj radnika</th><td>${escapeHtml(reportEmployeeNumber(r) || "—")}</td><th>Zaposleni</th><td>${escapeHtml(reportPersonName(r))}</td></tr>
      <tr><th>Radno mesto</th><td colspan="3">${escapeHtml(r.company_users?.function_title || d.function_title || "")}</td></tr>
      <tr><th>Opis rada</th><td colspan="3">${escapeHtml(d.description || d.note || "")}</td></tr>
    </table>

    <div class="section-title">Rad mašina — KM i MTČ odvojeno</div>
    <table>${excelColgroup(["7%","13%","20%","10%","10%","10%","10%","10%","10%"])}
      <tr><th>#</th><th>Broj</th><th>Mašina</th><th>KM početak</th><th>KM kraj</th><th>Ukupno KM</th><th>MTČ početak</th><th>MTČ kraj</th><th>Ukupno MTČ</th></tr>
      ${excelSectionRows(machines, [
        {key:"i", get:(m,i)=>i+1},
        {key:"code", get:m=>m.asset_code || m.machine_code || ""},
        {key:"name", get:m=>m.name || ""},
        {key:"km_start", get:m=>machineKmStart(m)},
        {key:"km_end", get:m=>machineKmEnd(m)},
        {key:"km_total", get:m=>machineKmTotal(m)},
        {key:"mtc_start", get:m=>machineMtcStart(m)},
        {key:"mtc_end", get:m=>machineMtcEnd(m)},
        {key:"mtc_total", get:m=>machineMtcTotal(m)}
      ])}
    </table>

    <div class="section-title">Gorivo</div>
    <table>${excelColgroup(["5%","11%","10%","18%","8%","8%","8%","11%","11%","10%"])}
      <tr><th>#</th><th>Tip sredstva</th><th>Broj</th><th>Sredstvo</th><th>Litara</th><th>KM</th><th>MTČ</th><th>Sipao</th><th>Primio</th><th>Izvor</th></tr>
      ${excelSectionRows(fuels, [
        {key:"i", get:(f,i)=>i+1},
        {key:"type", get:f=>assetKindLabel(f.asset_kind)},
        {key:"code", get:f=>f.asset_code || ""},
        {key:"asset", get:f=>f.asset_name || f.machine || f.vehicle || f.other || f.manual_asset_name || ""},
        {key:"liters", get:f=>f.liters || ""},
        {key:"km", get:f=>f.km || f.current_km || (f.asset_kind === "vehicle" ? (f.reading || f.mtc_km) : "") || ""},
        {key:"mtc", get:f=>f.mtc || f.current_mtc || (f.asset_kind === "machine" ? (f.reading || f.mtc_km) : "") || ""},
        {key:"by", get:f=>f.by || ""},
        {key:"receiver", get:f=>f.receiver || d.fuel_receiver || ""},
        {key:"source", get:f=>fuelSourceText(f)}
      ])}
    </table>

    <div class="section-title">Vozila / ture</div>
    <table>${excelColgroup(["6%","13%","18%","12%","10%","10%","12%","9%","10%"])}
      <tr><th>#</th><th>Broj</th><th>Vozilo</th><th>Registracija</th><th>KM početak</th><th>KM kraj</th><th>Relacija</th><th>Ture</th><th>m³</th></tr>
      ${excelSectionRows(vehicles, [
        {key:"i", get:(v,i)=>i+1},
        {key:"code", get:v=>v.asset_code || v.vehicle_code || ""},
        {key:"name", get:v=>v.name || v.vehicle || ""},
        {key:"registration", get:v=>v.registration || ""},
        {key:"km_start", get:v=>v.km_start || ""},
        {key:"km_end", get:v=>v.km_end || ""},
        {key:"route", get:v=>v.route || ""},
        {key:"tours", get:v=>v.tours || ""},
        {key:"cubic", get:v=>v.cubic_m3 || v.cubic_auto || ""}
      ])}
    </table>

    <div class="section-title">Cisterna za vodu</div>
    <table>${excelColgroup(["5%","12%","18%","9%","9%","9%","10%","8%","10%","10%"])}
      <tr><th>#</th><th>Broj</th><th>Cisterna</th><th>KM početak</th><th>KM kraj</th><th>Ukupno KM</th><th>Litara vode</th><th>Punjenja</th><th>Lokacije</th><th>Namena</th></tr>
      ${excelSectionRows(waters, [
        {key:"i", get:(w,i)=>i+1},
        {key:"code", get:w=>w.asset_code || w.vehicle_code || ""},
        {key:"vehicle", get:w=>w.vehicle || w.asset_name || w.tanker_vehicle || ""},
        {key:"km_start", get:w=>w.km_start || ""},
        {key:"km_end", get:w=>w.km_end || ""},
        {key:"km_total", get:w=>waterTankerKmTotal(w)},
        {key:"liters", get:w=>waterTankerLiters(w) || ""},
        {key:"loads", get:w=>waterTankerLoads(w) || ""},
        {key:"locations", get:w=>[w.fill_location && `punjenje: ${w.fill_location}`, (w.unload_location || w.spray_location) && `istovar/prskanje: ${w.unload_location || w.spray_location}`].filter(Boolean).join(" / ")},
        {key:"purpose", get:w=>[waterTankerPurposeLabel(w.purpose), w.note].filter(Boolean).join(" · ")}
      ])}
    </table>

    <div class="section-title">Materijal</div>
    <table>${excelColgroup(["6%","16%","24%","10%","14%","12%","18%"])}
      <tr><th>#</th><th>Radnja</th><th>Materijal</th><th>Ture</th><th>Količina po turi</th><th>Ukupno</th><th>Napomena</th></tr>
      ${excelSectionRows(materials, [
        {key:"i", get:(m,i)=>i+1},
        {key:"action", get:m=>m.action || m.material_action || ""},
        {key:"material", get:m=>m.material || m.name || ""},
        {key:"tours", get:m=>m.tours || m.material_tours || ""},
        {key:"per", get:m=>m.per_tour || m.quantity_per_tour || m.material_per_tour || ""},
        {key:"qty", get:m=>[materialQuantityValue(m), materialUnitValue(m)].filter(Boolean).join(" ")},
        {key:"note", get:m=>m.note || materialCalcText(m) || ""}
      ])}
    </table>

    <div class="section-title">Transport mašine labudicom</div>
    <table>${excelColgroup(["6%","14%","18%","18%","12%","12%","20%"])}
      <tr><th>#</th><th>Tablice</th><th>Od</th><th>Do</th><th>KM početak</th><th>KM kraj</th><th>Mašina / alat</th></tr>
      ${excelSectionRows(lowloaders, [
        {key:"i", get:(ll,i)=>i+1},
        {key:"plates", get:ll=>ll.plates || ll.registration || ""},
        {key:"from", get:ll=>ll.from_site || ll.from_address || ""},
        {key:"to", get:ll=>ll.to_site || ll.to_address || ""},
        {key:"km_start", get:ll=>ll.km_start || ""},
        {key:"km_end", get:ll=>ll.km_end || ""},
        {key:"machine", get:ll=>[ll.machine, ll.accompanying_tools || ll.tools].filter(Boolean).join(" / ")}
      ])}
    </table>
    <div class="small-note">Izvoz pripremljen u AskCreate.app. Dokument ostaje u bazi; Excel je izlazni fajl za kancelariju.</div>`;
  return cleanExcelShell(title, body, "Kancelarijski Excel pregled — podaci su razdvojeni po sekcijama radi lakše kontrole.");
}

function excelCleanCell(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/\t/g, " ")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singleReportCsvRow(values = []) {
  return values.map(v => csvEscape(excelCleanCell(v))).join(";");
}

function buildSingleReportExcelCsv(r) {
  const d = r.data || {};
  const machines = Array.isArray(d.machines) ? d.machines : [];
  const vehicles = Array.isArray(d.vehicles) ? d.vehicles : [];
  const fuels = Array.isArray(d.fuel_entries) ? d.fuel_entries : [];
  const materials = Array.isArray(d.material_entries) ? d.material_entries : (Array.isArray(d.material_movements) ? d.material_movements : (Array.isArray(d.materials) ? d.materials : []));
  const lowloaders = officeLowloaderEntries(d);
  const waters = officeWaterEntries(d);
  const docNo = reportDocumentNumber(r);
  const base = {
    datum: formatDateOnlyLocal(r.report_date || d.report_date),
    firma: currentCompanyExportName(),
    gradiliste: d.site_name || "",
    zaposleni: reportPersonName(r),
    brojRadnika: reportEmployeeNumber(r),
    radnoMesto: r.company_users?.function_title || d.function_title || "",
    status: reportStatusLabel(r.status),
    vremeSlanja: formatDateTimeLocal(r.submitted_at || r.created_at),
    dokument: docNo,
    opis: d.description || d.note || ""
  };

  const rows = [];
  rows.push(["sep=;"]);
  rows.push(["DNEVNI RADNI IZVEŠTAJ SA TERENA - KANCELARIJSKI EXCEL IZVOZ"]);
  rows.push([]);
  rows.push(["Tip reda", "Datum", "Firma", "Gradilište", "Zaposleni", "Broj radnika", "Radno mesto", "Status", "Vreme slanja", "Broj dokumenta", "Opis rada", "Broj", "Sredstvo / mašina / vozilo", "KM početak", "KM kraj", "Ukupno KM", "MTČ početak", "MTČ kraj", "Ukupno MTČ", "Litara goriva", "KM gorivo", "MTČ gorivo", "Gorivo sipao", "Gorivo primio", "Relacija / Od", "Do", "Ture", "m³", "Materijal", "Količina po turi", "Ukupno", "Jedinica", "Napomena", "Broj cisterne", "Cisterna koja je sipala gorivo", "Tablice cisterne koja je sipala gorivo", "Izvor goriva", "Litara vode", "Punjenja vode", "Punjenje vode", "Istovar/prskanje vode", "Namena vode"]);

  if (machines.length) {
    machines.forEach((m) => rows.push([
      "Rad mašine", base.datum, base.firma, base.gradiliste, base.zaposleni, base.brojRadnika, base.radnoMesto, base.status, base.vremeSlanja, base.dokument, base.opis,
      m.asset_code || m.machine_code || "", m.name || "",
      machineKmStart(m), machineKmEnd(m), machineKmTotal(m),
      machineMtcStart(m), machineMtcEnd(m), machineMtcTotal(m),
      "", "", "", "", "", "", "", "", "", "", "", "", "", m.work || m.description || m.note || ""
    ]));
  }

  if (fuels.length) {
    fuels.forEach((f) => rows.push([
      "Gorivo", base.datum, base.firma, base.gradiliste, base.zaposleni, base.brojRadnika, base.radnoMesto, base.status, base.vremeSlanja, base.dokument, base.opis,
      f.asset_code || "", f.asset_name || f.machine || f.vehicle || f.other || f.manual_asset_name || "",
      "", "", "", "", "", "",
      f.liters || "",
      f.km || f.current_km || (f.asset_kind === "vehicle" ? (f.reading || f.mtc_km) : "") || "",
      f.mtc || f.current_mtc || (f.asset_kind === "machine" ? (f.reading || f.mtc_km) : "") || "",
      f.by || "", f.receiver || d.fuel_receiver || "",
       "", "", "", "", "", "", "", "", assetKindLabel(f.asset_kind),
      fuelSourceText(f)
    ]));
  }

  const fieldTankers = Array.isArray(d.field_tanker_entries) ? d.field_tanker_entries : (Array.isArray(d.tanker_fuel_entries) ? d.tanker_fuel_entries : []);
  if (fieldTankers.length) {
    fieldTankers.forEach((ft) => rows.push([
      "Gorivo cisterna", base.datum, base.firma, ft.site_name || base.gradiliste, base.zaposleni, base.brojRadnika, base.radnoMesto, base.status, base.vremeSlanja, base.dokument, base.opis,
      ft.asset_code || "", ft.asset_name || ft.machine || ft.vehicle || ft.other || ft.manual_asset_name || "",
      "", "", "", "", "", "",
      ft.liters || "",
      ft.km || ft.current_km || (ft.asset_kind === "vehicle" ? (ft.reading || ft.mtc_km) : "") || "",
      ft.mtc || ft.current_mtc || (ft.asset_kind === "machine" ? (ft.reading || ft.mtc_km) : "") || "",
      "", ft.receiver || ft.received_by || "",
      "", "", "", "", "", "", "", "", assetKindLabel(ft.asset_kind),
      ft.tanker_asset_code || ft.tanker_vehicle_code || "",
      ft.tanker_asset_name || ft.tanker_vehicle || ft.cistern_vehicle || "",
      ft.tanker_registration || ft.tanker_plates || ft.cistern_registration || ft.cistern_plates || "",
      fuelSourceText(ft)
    ]));
  }

  if (vehicles.length) {
    vehicles.forEach((v) => rows.push([
      "Vozilo / tura", base.datum, base.firma, base.gradiliste, base.zaposleni, base.brojRadnika, base.radnoMesto, base.status, base.vremeSlanja, base.dokument, base.opis,
      v.asset_code || v.vehicle_code || "", v.name || v.vehicle || v.registration || "",
      v.km_start || "", v.km_end || "", numericDiff(v.km_start, v.km_end), "", "", "",
      "", "", "", "", "", v.route || "", "", v.tours || "", v.cubic_m3 || v.cubic_auto || "", "", "", "", "", ""
    ]));
  }

  if (materials.length) {
    materials.forEach((m) => rows.push([
      "Materijal", base.datum, base.firma, base.gradiliste, base.zaposleni, base.brojRadnika, base.radnoMesto, base.status, base.vremeSlanja, base.dokument, base.opis,
      "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", m.tours || m.material_tours || "", "",
      m.material || m.name || "", m.per_tour || m.quantity_per_tour || m.material_per_tour || "", materialQuantityValue(m), materialUnitValue(m), m.note || materialCalcText(m) || ""
    ]));
  }

  if (waters.length) {
    waters.forEach((wt) => rows.push([
      "Cisterna za vodu", base.datum, base.firma, officeEntrySiteName(wt, base.gradiliste), base.zaposleni, base.brojRadnika, base.radnoMesto, base.status, base.vremeSlanja, base.dokument, base.opis,
      wt.asset_code || wt.vehicle_code || "", wt.vehicle || wt.asset_name || wt.tanker_vehicle || "",
      wt.km_start || "", wt.km_end || "", waterTankerKmTotal(wt), "", "", "",
      "", "", "", "", "",
      wt.fill_location || "", wt.unload_location || wt.spray_location || "", waterTankerLoads(wt) || "", "", "Voda", "", waterTankerLiters(wt) || "", "L", wt.note || "",
      "", "", "", "", waterTankerLiters(wt) || "", waterTankerLoads(wt) || "", wt.fill_location || "", wt.unload_location || wt.spray_location || "", waterTankerPurposeLabel(wt.purpose)
    ]));
  }

  if (lowloaders.length) {
    lowloaders.forEach((ll) => rows.push([
      "Transport labudicom", base.datum, base.firma, base.gradiliste, base.zaposleni, base.brojRadnika, base.radnoMesto, base.status, base.vremeSlanja, base.dokument, base.opis,
      ll.plates || ll.registration || "", [ll.machine, ll.accompanying_tools || ll.tools].filter(Boolean).join(" / "),
      ll.km_start || "", ll.km_end || "", numericDiff(ll.km_start, ll.km_end), "", "", "",
      "", "", "", "", "", ll.from_site || ll.from_address || "", ll.to_site || ll.to_address || "", "", "", "", "", "", "", ""
    ]));
  }

  if (!machines.length && !fuels.length && !fieldTankers.length && !vehicles.length && !materials.length && !lowloaders.length && !waters.length) {
    rows.push(["Nema unetih stavki", base.datum, base.firma, base.gradiliste, base.zaposleni, base.brojRadnika, base.radnoMesto, base.status, base.vremeSlanja, base.dokument, base.opis]);
  }

  return "\ufeff" + rows.map(singleReportCsvRow).join("\r\n");
}

window.exportSingleReportToExcel = function(id) {
  const r = directorReportsCache.find(x => String(x.id) === String(id));
  if (!r) return toast("Izveštaj nije pronađen.", true);
  const csv = buildSingleReportExcelCsv(r);
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const name = safeFilePart(`${reportDocumentTitle(r)}_${r.report_date || today()}_${(r.data || {}).site_name || "izvestaj"}`) + ".csv";
  downloadBlob(blob, name);
  toast("Excel/CSV dokument je preuzet — kolone su sada stvarno razdvojene za Excel/LibreOffice.");
};

function reportPrimaryLocationLabel(r = {}) {
  const d = r.data || {};
  const multiSites = []
    .concat(Array.isArray(d.machines) ? d.machines.map(x => x && (x.site_name || x.site)) : [])
    .concat(Array.isArray(d.vehicles) ? d.vehicles.map(x => x && (x.site_name || x.site)) : [])
    .filter(Boolean);
  const uniqueSites = [...new Set(multiSites)];
  return d.site_name ||
    d.defect_site_name ||
    d.location ||
    d.defect_location ||
    d.water_site_name ||
    d.lowloader_to_site ||
    d.lowloader_from_site ||
    (uniqueSites.length === 1 ? uniqueSites[0] : (uniqueSites.length > 1 ? `Više gradilišta (${uniqueSites.length})` : "")) ||
    d.request_title ||
    d.report_type_label ||
    d.report_label ||
    "Bez gradilišta";
}

function reportHtml(r) {
  const d = r.data || {};
  const person = reportDocumentPerson(r);
  const title = reportDocumentTitle(r);
  const sections = getReportFilledSections(d);
  const sectionsHtml = sections.slice(0, 6).map(x => `<span class="pill report-section-pill">${escapeHtml(x)}</span>`).join("") + (sections.length > 6 ? `<span class="pill report-section-pill">+${sections.length - 6}</span>` : "");
  const submitted = formatDateTimeLocal(r.submitted_at || r.created_at);
  const statusText = r.status || "novo";
  const statusLabel = reportStatusLabel(statusText);

  return `
    <article class="report-row-item report-document-card">
      <div class="report-list-grid">
        <div class="report-list-date">
          <strong>${escapeHtml(r.report_date || "")}</strong>
          <small>${escapeHtml(submitted || "")}</small>
        </div>
        <div class="report-list-site">
          <strong>${escapeHtml(reportPrimaryLocationLabel(r))}</strong>
          <small>${escapeHtml(d.report_type_label || title)}</small>
        </div>
        <div class="report-list-worker">
          <strong>${escapeHtml(person)}</strong>
          <small>${escapeHtml([reportEmployeeNumber(r) ? `broj ${reportEmployeeNumber(r)}` : "", r.company_users?.function_title || d.function_title || ""].filter(Boolean).join(" · "))}</small>
        </div>
        <div class="report-list-sections">${sectionsHtml}</div>
        <div class="report-list-status"><span class="status-chip status-${escapeHtml(statusText)}">${escapeHtml(statusLabel)}</span></div>
      </div>
      ${r.returned_reason ? `<div class="report-card-warning">Vraćeno na ispravku: ${escapeHtml(r.returned_reason)}</div>` : ""}
      <div class="report-card-actions no-print report-row-single-action">
        <button class="primary compact-doc-btn" type="button" onclick="openReportDocumentCenter('${r.id}')">Otvori</button>
      </div>
    </article>`;
}

window.setReportStatus = async (id, status) => {
  try {
    if (status === "approved") {
      await directorRpcApproveReport(id);
    } else {
      throw new Error("Ovaj status još nije prebačen na sigurni RPC tok: " + status);
    }
  } catch (error) {
    return toast(error.message || String(error), true);
  }
  toast("Status izveštaja promenjen.");
  await loadReports();
  if (typeof openReportDocumentCenter === "function" && document.getElementById("reportDocumentCenter") && !document.getElementById("reportDocumentCenter").classList.contains("hidden")) {
    openReportDocumentCenter(id);
  }
};

window.archiveReport = async (id) => {
  const existingReport = directorReportsCache.find(r => String(r.id) === String(id));
  const label = reportActionLabel(existingReport);
  if (!confirm(`Arhivirati ovu stavku?\n\n${label}\n\nStavka ostaje u bazi, ali se sklanja iz aktivne liste i prelazi u karticu Arhiva.`)) return;
  const archivedAt = new Date().toISOString();
  const nextData = {
    ...(existingReport?.data || {}),
    archived: true,
    archived_from_direction: true,
    archived_at: archivedAt
  };
  try {
    await directorRpcArchiveReport(id);
    // I posle uspešnog RPC-a forsiramo isti status/podatke. Ovo štiti slučaj da stara RPC funkcija
    // samo skloni iz aktivnog pregleda, ali ne vrati stavku u karticu Arhiva.
    const { error: directArchiveError } = await sb
      .from("reports")
      .update({ status: "archived", data: nextData })
      .eq("id", id)
      .eq("company_id", currentCompany.id);
    if (directArchiveError) console.warn("AskCreate.app: direktno potvrđivanje arhive nije uspelo, koristim lokalnu arhivu:", directArchiveError.message);
  } catch (error) {
    try {
      const { error: directError } = await sb
        .from("reports")
        .update({ status: "archived", data: nextData })
        .eq("id", id)
        .eq("company_id", currentCompany.id);
      if (directError) throw directError;
    } catch (fallbackError) {
      return toast((error?.message || fallbackError?.message || String(error)), true);
    }
  }

  if (existingReport) {
    saveLocalArchivedReport({ ...existingReport, status: "archived", data: nextData, updated_at: archivedAt });
    directorReportsCache = directorReportsCache.map(r => String(r.id) === String(id) ? { ...r, status: "archived", data: { ...(r.data || {}), ...nextData }, updated_at: archivedAt } : r);
    businessUpdateReportsMetrics(directorReportsCache);
    renderFuelReportsList();
    renderFuelConsumptionAnalysis();
    renderArchiveList();
    renderDefectsList();
    const reportsBox = document.getElementById("reportsList");
    if (reportsBox) {
      const dailyReports = directorReportsCache.filter(isPendingDirectorReport);
      reportsBox.innerHTML = dailyReports.map(r => reportHtml(r)).join("") || `<p class="muted">Nema dnevnih izveštaja koji čekaju odobrenje.</p>`;
    }
  }

  toast("Izveštaj je arhiviran i prebačen u karticu Arhiva.");
  closeReportDocumentCenter?.();
  await loadReports({ silent: true });
};

function isApprovedDirectorReport(r) {
  const status = String(r?.status || "").toLowerCase();
  return status === "approved" || status === "odobreno";
}

function refreshDirectorReportViewsAfterBulk() {
  businessUpdateReportsMetrics(directorReportsCache);
  renderFuelReportsList();
  renderFuelConsumptionAnalysis();
  renderArchiveList();
  renderDefectsList();
  const reportsBox = document.getElementById("reportsList");
  if (reportsBox) {
    const dailyReports = directorReportsCache.filter(isPendingDirectorReport);
    reportsBox.innerHTML = dailyReports.map(r => reportHtml(r)).join("") || `<p class="muted">Nema dnevnih izveštaja koji čekaju odobrenje.</p>`;
  }
  if (typeof renderFlowTestPreview === "function") renderFlowTestPreview();
}

window.approveAllPendingReports = async () => {
  if (directorBulkApproveBusy) return toast("Odobravanje je već u toku. Sačekaj da se završi.", true);
  const pending = directorReportsCache.filter(isPendingDirectorReport);
  if (!pending.length) return toast("Nema izveštaja koji čekaju odobrenje.", true);
  const sample = pending.slice(0, 5).map(r => `• ${reportActionLabel(r)}`).join("\n");
  const more = pending.length > 5 ? `\n• ... i još ${pending.length - 5}` : "";
  if (!confirm(`Odobriti sve izveštaje koji čekaju odobrenje?\n\nUkupno: ${pending.length}\n\n${sample}${more}`)) return;
  directorBulkApproveBusy = true;
  try {
    for (const r of pending) {
      await directorRpcApproveReport(r.id);
      directorReportsCache = directorReportsCache.map(x => String(x.id) === String(r.id) ? { ...x, status: "approved", updated_at: new Date().toISOString() } : x);
    }
    toast(`Odobreno izveštaja: ${pending.length}.`);
    refreshDirectorReportViewsAfterBulk();
    await loadReports({ silent: true });
  } catch (e) {
    toast(e.message || String(e), true);
  } finally {
    directorBulkApproveBusy = false;
  }
};

window.archiveAllApprovedReports = async () => {
  if (directorBulkArchiveBusy) return toast("Arhiviranje je već u toku. Sačekaj da se završi.", true);
  const approved = directorReportsCache.filter(r => isApprovedDirectorReport(r) && !isArchivedReport(r));
  if (!approved.length) return toast("Nema odobrenih izveštaja za arhiviranje.", true);
  const sample = approved.slice(0, 5).map(r => `• ${reportActionLabel(r)}`).join("\n");
  const more = approved.length > 5 ? `\n• ... i još ${approved.length - 5}` : "";
  if (!confirm(`Arhivirati sve odobrene izveštaje?\n\nUkupno: ${approved.length}\n\n${sample}${more}\n\nIzveštaji ostaju u bazi i prelaze u karticu Arhiva.`)) return;
  directorBulkArchiveBusy = true;
  try {
    for (const r of approved) {
      try {
        await directorRpcArchiveReport(r.id);
      } catch (rpcError) {
        const { error: directError } = await sb
          .from("reports")
          .update({ status: "archived" })
          .eq("id", r.id)
          .eq("company_id", currentCompany.id);
        if (directError) throw rpcError || directError;
      }
      saveLocalArchivedReport(r);
      directorReportsCache = directorReportsCache.map(x => String(x.id) === String(r.id) ? { ...x, status: "archived", updated_at: new Date().toISOString() } : x);
    }
    toast(`Arhivirano izveštaja: ${approved.length}.`);
    refreshDirectorReportViewsAfterBulk();
    await loadReports({ silent: true });
  } catch (e) {
    toast(e.message || String(e), true);
  } finally {
    directorBulkArchiveBusy = false;
  }
};

window.deleteAllArchivedReportsPermanently = async () => {
  if (directorBulkDeleteArchiveBusy) return toast("Brisanje arhive je već u toku. Sačekaj da se završi.", true);
  const archived = directorReportsCache.filter(isArchivedReport);
  const generated = loadOfficeGeneratedArchive();
  const total = archived.length + generated.length;
  if (!total) return toast("Arhiva je prazna.", true);
  const dbSample = archived.slice(0, 5).map(r => `• ${reportActionLabel(r)}`);
  const genSample = generated.slice(0, 5).map(item => `• ${generatedOfficeArchiveLabel(item)}`);
  const sampleAll = [...dbSample, ...genSample].slice(0, 8).join("\n");
  const more = total > 8 ? `\n• ... i još ${total - 8}` : "";
  if (!confirm(`Da li ste sigurni da želite trajno obrisati SVE stavke iz arhive?\n\nUkupno: ${total}\n\n${sampleAll}${more}\n\nOva radnja briše stavke iz arhive i ne može se vratiti.`)) return;
  directorBulkDeleteArchiveBusy = true;
  try {
    for (const r of archived) {
      await permanentlyDeleteReportInDatabase(r.id);
      rememberLocalPermanentlyDeletedReport(r.id);
      removeLocalArchivedReport(r.id);
      directorReportsCache = directorReportsCache.filter(x => String(x.id) !== String(r.id));
    }
    const generatedSourceIds = [...new Set(generated.flatMap(item => Array.isArray(item.source_report_ids) ? item.source_report_ids : []).filter(Boolean))];
    for (const reportId of generatedSourceIds) {
      if (directorReportsCache.some(r => String(r.id) === String(reportId))) continue;
      await permanentlyDeleteReportInDatabase(reportId);
      rememberLocalPermanentlyDeletedReport(reportId);
      removeLocalArchivedReport(reportId);
    }
    saveOfficeGeneratedArchive([]);
    toast(`Trajno obrisano iz arhive: ${total}.`);
    closeReportDocumentCenter?.();
    refreshDirectorReportViewsAfterBulk();
    await loadReports({ silent: true });
  } catch (e) {
    toast(e.message || String(e), true);
  } finally {
    directorBulkDeleteArchiveBusy = false;
  }
};


window.resetAllCompanyReportsForTesting = async () => {
  if (directorBulkDeleteArchiveBusy) return toast("Reset izveštaja je već u toku. Sačekaj da se završi.", true);
  if (!currentCompany?.id || !sb) return toast("Nema aktivne firme za reset izveštaja.", true);
  const codeConfirm = prompt(
    "OPREZ: Ovo nulira SVE izveštaje firme za testiranje.\n\n" +
    "Izveštaji će biti označeni kao deleted i više neće hraniti Direkciju, Direktora, Šefa mehanizacije, gorivo, potrošnju, Dnevnik, Karnet ni Arhivu.\n\n" +
    "Za potvrdu upiši: NULIRAJ"
  );
  if (String(codeConfirm || "").trim().toUpperCase() !== "NULIRAJ") return toast("Reset nije pokrenut.");
  directorBulkDeleteArchiveBusy = true;
  try {
    // v1.68.8: najpre brišemo po trenutno prijavljenom korisniku/linku.
    // Direktor i Šef mehanizacije se otvaraju preko radničkog linka, zato je ovo najtačnije mapiranje na company_id.
    const purgeByWorkerResult = await callHardPurgeReportsForLoggedWorkerRpc();
    if (purgeByWorkerResult !== null) {
      directorReportsCache = [];
      mechanicBossAllReportsCache = [];
      mechanicBossReportsCache = [];
      clearLocalReportStateForCompany();
      closeReportDocumentCenter?.();
      refreshDirectorReportViewsAfterBulk();
      businessUpdateReportsMetrics([]);
      renderOwnerDashboard?.();
      renderMechanicFuelAnalysis?.();
      renderMechanicBossDefects?.();
      toast(`Svi izveštaji firme su trajno obrisani iz Supabase baze po prijavljenom korisniku. Obrisano: ${purgeByWorkerResult}.`);
      await loadReports({ silent: true });
      return;
    }

    // v1.68.7: zatim brišemo po šifri firme, jer radnički/direktor/mehanika linkovi nose company_code.
    // Ovo rešava slučaj kada currentCompany.id nije isti izvor koji koristi reports.company_id.
    const purgeByCodeResult = await callHardPurgeCompanyReportsByCodeRpc();
    if (purgeByCodeResult !== null) {
      directorReportsCache = [];
      clearLocalReportStateForCompany();
      closeReportDocumentCenter?.();
      refreshDirectorReportViewsAfterBulk();
      businessUpdateReportsMetrics([]);
      renderOwnerDashboard?.();
      toast(`Svi izveštaji firme su trajno obrisani iz Supabase baze po šifri firme. Obrisano: ${purgeByCodeResult}.`);
      await loadReports({ silent: true });
      return;
    }

    const purgeResult = await callHardPurgeCompanyReportsRpc();
    if (purgeResult !== null) {
      directorReportsCache = [];
      clearLocalReportStateForCompany();
      closeReportDocumentCenter?.();
      refreshDirectorReportViewsAfterBulk();
      businessUpdateReportsMetrics([]);
      renderOwnerDashboard?.();
      toast(`Svi izveštaji firme su trajno obrisani iz Supabase baze po ID firme. Obrisano: ${purgeResult}.`);
      await loadReports({ silent: true });
      return;
    }

    // Ako SQL RPC još nije dodat, pokušavamo direktan bulk DELETE.
    const { error: bulkDeleteError } = await sb
      .from("reports")
      .delete()
      .eq("company_id", currentCompany.id);
    if (!bulkDeleteError) {
      directorReportsCache = [];
      clearLocalReportStateForCompany();
      closeReportDocumentCenter?.();
      refreshDirectorReportViewsAfterBulk();
      businessUpdateReportsMetrics([]);
      renderOwnerDashboard?.();
      toast("Svi izveštaji firme su obrisani direktno iz baze.");
      await loadReports({ silent: true });
      return;
    }

    const { data, error } = await sb
      .from("reports")
      .select("id, company_id, status, data")
      .eq("company_id", currentCompany.id)
      .limit(2000);
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) {
      directorReportsCache = [];
      clearLocalReportStateForCompany();
      refreshDirectorReportViewsAfterBulk();
      businessUpdateReportsMetrics([]);
      renderOwnerDashboard?.();
      return toast("Baza već nema izveštaje za ovu firmu. Lokalni prikazi su očišćeni.");
    }
    let ok = 0;
    for (const r of rows) {
      try {
        await permanentlyDeleteReportInDatabase(r.id);
        rememberLocalPermanentlyDeletedReport(r.id);
        removeLocalArchivedReport(r.id);
        ok += 1;
      } catch (e) {
        console.warn("Ne mogu trajno obrisati izveštaj:", r.id, e?.message || e);
      }
    }
    directorReportsCache = [];
    clearLocalReportStateForCompany();
    closeReportDocumentCenter?.();
    refreshDirectorReportViewsAfterBulk();
    businessUpdateReportsMetrics([]);
    renderOwnerDashboard?.();
    if (ok < rows.length) {
      toast(`Nije obrisano sve iz baze (${ok}/${rows.length}). Pokreni SQL iz chata, pa opet klikni Nuliraj.`, true);
    } else {
      toast(`Nulirano izveštaja: ${ok}/${rows.length}. Sada direktor i šef mehanizacije treba da budu na nuli.`);
    }
    await loadReports({ silent: true });
  } catch (e) {
    toast(e.message || String(e), true);
  } finally {
    directorBulkDeleteArchiveBusy = false;
  }
};

window.returnReport = async (id) => {
  const reason = prompt("Razlog vraćanja zaposlenom na ispravku:");
  if (!reason || !reason.trim()) return;
  try {
    await directorRpcReturnReport(id, reason.trim());
  } catch (error) {
    return toast(error.message || String(error), true);
  }
  toast("Izveštaj je vraćen zaposlenom na ispravku.");
  await loadReports();
  if (typeof openReportDocumentCenter === "function") openReportDocumentCenter(id);
};


window.markAllDefectsReceived = async () => {
  const defects = directorReportsCache.filter(isActiveDefectReport).filter(r => {
    const d = r.data || {};
    const st = String(d.defect_status || d.mechanic_status || "").toLowerCase();
    return !["primljeno", "u_popravci", "reseno", "rešeno"].includes(st);
  });
  if (!defects.length) return toast("Nema novih kvarova za označavanje kao primljeno.", true);
  if (!confirm(`Označiti kao PRIMLJENO sve nove kvarove?\n\nUkupno: ${defects.length}`)) return;
  for (const r of defects) {
    await setDefectRecordStatus(r.id, "primljeno", { silent: true, skipReload: true });
  }
  toast(`Kvarovi označeni kao primljeno: ${defects.length}.`);
  await loadReports({ silent: true });
};

window.archiveResolvedDefects = async () => {
  const defects = directorReportsCache.filter(isActiveDefectReport).filter(isResolvedDefectReport);
  if (!defects.length) return toast("Nema rešenih kvarova za arhiviranje.", true);
  const sample = defects.slice(0, 6).map(r => `• ${reportActionLabel(r)}`).join("\n");
  const more = defects.length > 6 ? `\n• ... i još ${defects.length - 6}` : "";
  if (!confirm(`Arhivirati sve rešene kvarove?\n\nUkupno: ${defects.length}\n\n${sample}${more}`)) return;
  for (const r of defects) {
    const archivedAt = new Date().toISOString();
    const nextData = { ...(r.data || {}), archived: true, archived_from_direction: true, archived_at: archivedAt };
    try {
      await directorRpcArchiveReport(r.id);
      const { error: confirmError } = await sb
        .from("reports")
        .update({ status: "archived", data: nextData })
        .eq("id", r.id)
        .eq("company_id", currentCompany.id);
      if (confirmError) console.warn("AskCreate.app: potvrda arhive kvara nije uspela:", confirmError.message);
    } catch (error) {
      const { error: directError } = await sb
        .from("reports")
        .update({ status: "archived", data: nextData })
        .eq("id", r.id)
        .eq("company_id", currentCompany.id);
      if (directError) throw directError;
    }
    saveLocalArchivedReport({ ...r, status: "archived", data: nextData, updated_at: archivedAt });
    directorReportsCache = directorReportsCache.map(x => String(x.id) === String(r.id) ? { ...x, status: "archived", data: nextData, updated_at: archivedAt } : x);
  }
  toast(`Rešeni kvarovi arhivirani: ${defects.length}.`);
  refreshDirectorReportViewsAfterBulk();
  await loadReports({ silent: true });
};

window.setDefectRecordStatus = async (id, newStatus, options = {}) => {
  const { data: row, error: readError } = await sb.from("reports").select("data").eq("id", id).eq("company_id", currentCompany.id).maybeSingle();
  if (readError) return toast(readError.message, true);
  const d = row?.data || {};
  const nowIso = new Date().toISOString();
  const actorName = currentDirector?.name || currentCompany?.name || "Direkcija";
  const actorRole = "Direkcija";
  d.defect_status = newStatus;
  d.mechanic_status = d.mechanic_status || newStatus;
  d.defect_last_change_at = nowIso;
  d.defect_last_change_by = actorName;
  d.defect_last_change_role = actorRole;
  if (newStatus === "primljeno") {
    d.defect_received_at = d.defect_received_at || nowIso;
    d.defect_received_by = d.defect_received_by || actorName;
    d.defect_received_role = d.defect_received_role || actorRole;
  }
  if (newStatus === "u_popravci") {
    d.defect_repair_started_at = d.defect_repair_started_at || nowIso;
    d.defect_repair_started_by = d.defect_repair_started_by || actorName;
    d.defect_repair_started_role = d.defect_repair_started_role || actorRole;
  }
  if (newStatus === "reseno") {
    d.defect_resolved_at = d.defect_resolved_at || nowIso;
    d.defect_resolved_by = d.defect_resolved_by || actorName;
    d.defect_resolved_role = d.defect_resolved_role || actorRole;
  }
  appendDefectTimelineEvent(d, makeDefectTimelineEvent(newStatus, actorName, actorRole));
  const { error } = await sb.from("reports").update({ data: d }).eq("id", id).eq("company_id", currentCompany.id);
  if (error) {
    if (!options.silent) return toast(error.message, true);
    throw error;
  }
  if (!options.silent) toast("Status kvara promenjen i upisan u dnevnik promena.");
  if (!options.skipReload) await loadReports();
};

function collectPermissions() {
  const obj = {};
  $$(".perm").forEach(ch => obj[ch.value] = ch.checked);

  // v1.11.9: posebna prava po materijalu.
  // Ovo ne ruši stari login: ako nema izabranih materijala, zaposleni i dalje ima/ili nema osnovnu rubriku "Materijal" preko obj.materials.
  obj.allowed_material_ids = $$(".material-perm:checked").map(ch => ch.value);
  obj.allowed_material_names = $$(".material-perm:checked").map(ch => ch.dataset.name || "").filter(Boolean);
  return obj;
}

function getCheckedMaterialPermissionIdsFromForm() {
  return new Set($$(".material-perm:checked").map(ch => ch.value));
}

function renderPersonMaterialPermissions(materials = [], selectedIds = null) {
  const box = $("#personMaterialPermissions");
  if (!box) return;

  const checkedNow = selectedIds || getCheckedMaterialPermissionIdsFromForm();
  if (!materials.length) {
    box.innerHTML = `<p class="muted tiny">Nema dodatih materijala. Dodaj materijal u tabu Evidencija materijala pa će se pojaviti ovde za štikliranje.</p>`;
    return;
  }

  box.innerHTML = materials.map(m => {
    const id = String(m.id || "");
    const checked = checkedNow.has(id) ? "checked" : "";
    const label = `${m.name || "Materijal"}${m.unit ? " · " + m.unit : ""}`;
    return `
      <label class="material-permission-option">
        <input type="checkbox" class="material-perm" value="${escapeHtml(id)}" data-name="${escapeHtml(m.name || "")}" ${checked} />
        ${escapeHtml(label)}
      </label>
    `;
  }).join("");
}

async function refreshPersonMaterialPermissions(selectedIds = null) {
  if (!currentCompany) return;
  const { data, error } = await sb
    .from("materials")
    .select("id,name,unit,category,active")
    .eq("company_id", currentCompany.id)
    .order("created_at", { ascending:false });

  if (error) {
    const box = $("#personMaterialPermissions");
    if (box) box.innerHTML = `<p class="muted tiny">Evidencija materijala nisu učitani: ${escapeHtml(error.message)}</p>`;
    return;
  }
  renderPersonMaterialPermissions(data || [], selectedIds);
  renderWorkerPreview(true);
}


function getSelectedWorkerSite() {
  const el = $("#wrSiteName");
  if (!el) return { site_id: null, site_name: "" };
  const option = el.options ? el.options[el.selectedIndex] : null;
  return {
    site_id: option?.dataset?.siteId || null,
    site_name: (el.value || "").trim()
  };
}


function normalizeAssetType(type) {
  return String(type || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/š/g, "s")
    .replace(/đ/g, "dj")
    .replace(/č/g, "c")
    .replace(/ć/g, "c")
    .replace(/ž/g, "z");
}

function getAssetName(asset) {
  return String(
    asset?.name ||
    asset?.asset_name ||
    asset?.assetName ||
    asset?.title ||
    asset?.label ||
    asset?.registration ||
    asset?.plate ||
    asset?.reg_no ||
    ""
  ).trim();
}

function getAssetCode(asset) {
  return String(
    asset?.asset_code ||
    asset?.internal_code ||
    asset?.code ||
    asset?.asset_number ||
    asset?.number ||
    asset?.inventory_number ||
    ""
  ).trim();
}

function formatAssetTitleWithCode(asset) {
  const code = getAssetCode(asset);
  const name = getAssetName(asset) || asset?.name || "Sredstvo";
  return code ? `${code} · ${name}` : name;
}

function getAssetType(asset) {
  // v1.19.7: worker_list_assets u nekim bazama vraća drugačije ime kolone
  // ili ne vrati asset_type za sva sredstva. Zato čitamo više mogućih naziva.
  return normalizeAssetType(
    asset?.asset_type ||
    asset?.type ||
    asset?.assetType ||
    asset?.asset_kind ||
    asset?.kind ||
    asset?.category ||
    asset?.asset_category ||
    asset?.group ||
    ""
  );
}

function getAssetRegistration(asset) {
  return String(asset?.registration || asset?.plate || asset?.plates || asset?.reg_no || asset?.oznaka || "").trim();
}

function inferAssetTypeFromText(asset) {
  const text = normalizeAssetType([
    getAssetName(asset),
    getAssetRegistration(asset),
    asset?.description,
    asset?.note,
    asset?.capacity ? "capacity" : ""
  ].filter(Boolean).join(" "));

  if (/\b(kamion|kiper|vozilo|cisterna|labudica|sleper|prikolica|kombi|auto|man|scania|mercedes|iveco|volvo|daf)\b/.test(text)) return "vehicle";
  if (/\b(agregat|vibro|vibroploca|vibro ploca|ploca|pumpa|kompresor|oprema|alat)\b/.test(text)) return "other";
  if (/\b(bager|dozer|buldozer|valjak|grader|utovarivac|finiser|masina|cat|komatsu|jcb|liebherr|volvo)\b/.test(text)) return "machine";
  return "";
}

function isVehicleAsset(asset) {
  const t = getAssetType(asset) || inferAssetTypeFromText(asset);
  return ["vehicle", "vozilo", "vehicles", "vozila", "truck", "kamion", "kiper", "cisterna", "lowloader", "labudica", "sleper", "prikolica", "auto", "kombinovano vozilo"].includes(t);
}

function isOtherAsset(asset) {
  const t = getAssetType(asset) || inferAssetTypeFromText(asset);
  return ["other", "ostalo", "alat", "tool", "tools", "oprema", "equipment", "agregat", "vibro", "vibro ploca", "vibroploca", "ploca", "pumpa", "kompresor"].includes(t);
}

function assetKindLabel(kind) {
  if (kind === "vehicle") return "Vozilo";
  if (kind === "other") return "Oprema / ostalo";
  return "Mašina";
}

function defectImpactLabel(value) {
  if (value === "zaustavlja_rad") return "Zaustavlja rad";
  if (value === "moze_nastaviti") return "Može nastaviti rad do popravke";
  return value || "";
}

function formatAssetLabel(asset) {
  const parts = [formatAssetTitleWithCode(asset) || "Vozilo"];
  const reg = getAssetRegistration(asset);
  if (reg) parts.push(reg);
  if (asset?.capacity) parts.push(asset.capacity);
  return parts.filter(Boolean).join(" · ");
}

function isMachineAsset(asset) {
  const t = getAssetType(asset) || inferAssetTypeFromText(asset);
  if (isVehicleAsset(asset) || isOtherAsset(asset)) return false;
  // Ako tip nije upisan, tretiramo kao mašinu da se stari podaci ne izgube,
  // ali vozila/oprema se sada prvo pokušavaju prepoznati po nazivu i drugim poljima.
  if (!t) return true;
  return ["machine", "machines", "machinery", "masina", "masine", "bager", "dozer", "buldozer", "bulldozer", "valjak", "grader", "utovarivac", "finiser", "cat", "komatsu", "jcb", "liebherr"].includes(t);
}

function formatMachineLabel(asset) {
  const parts = [formatAssetTitleWithCode(asset) || "Mašina"];
  const reg = getAssetRegistration(asset);
  if (reg) parts.push(reg);
  return parts.filter(Boolean).join(" · ");
}

function formatOtherAssetLabel(asset) {
  const parts = [formatAssetTitleWithCode(asset) || "Oprema / ostalo"];
  const reg = getAssetRegistration(asset);
  if (reg) parts.push(reg);
  return parts.filter(Boolean).join(" · ");
}

function filterAssetsByFuelKind(asset, kind) {
  if (kind === "vehicle") return isVehicleAsset(asset);
  if (kind === "other") return isOtherAsset(asset);
  return isMachineAsset(asset);
}

function fuelKindEmptyText(kind) {
  if (kind === "vehicle") return "Nema vozila iz Uprave";
  if (kind === "other") return "Nema opreme / ostalog iz Uprave";
  return "Nema mašina iz Uprave";
}

function fuelKindChooseText(kind) {
  if (kind === "vehicle") return "Odaberi vozilo";
  if (kind === "other") return "Odaberi ostalo / opremu";
  return "Odaberi mašinu";
}

function formatFuelKindAssetLabel(asset, kind) {
  if (kind === "vehicle") return formatAssetLabel(asset);
  if (kind === "other") return formatOtherAssetLabel(asset);
  return formatMachineLabel(asset);
}

function machineMatchesSearch(asset, searchValue) {
  const q = normalizeVehicleSearch(searchValue);
  if (!q) return true;
  const haystack = normalizeVehicleSearch([
    getAssetCode(asset),
    asset?.name,
    asset?.registration,
    asset?.capacity,
    asset?.type || asset?.asset_type
  ].filter(Boolean).join(" "));
  return haystack.includes(q);
}

function autoSelectExactAssetCode(selectEl, searchValue) {
  if (!selectEl) return;
  const q = normalizeVehicleSearch(searchValue);
  if (!q) return;
  const options = Array.from(selectEl.options || []).filter(o => o.value);
  const exact = options.find(o => normalizeVehicleSearch(o.dataset.assetCode || "") === q);
  if (exact) {
    selectEl.value = exact.value;
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function getCanonicalAssetKind(asset) {
  if (isVehicleAsset(asset)) return "vehicle";
  if (isOtherAsset(asset)) return "other";
  return "machine";
}

function findAssetByExactCode(searchValue) {
  const q = normalizeVehicleSearch(searchValue);
  if (!q) return null;
  return (workerAssetOptions || []).find(asset => normalizeVehicleSearch(getAssetCode(asset)) === q) || null;
}

function findAssetsByUniversalSearch(searchValue) {
  const q = normalizeVehicleSearch(searchValue);
  if (!q) return [];
  return (workerAssetOptions || []).filter(asset => machineMatchesSearch(asset, searchValue));
}

function assetOptionHtml(asset, selectedValue = "", labelFormatter = formatMachineLabel) {
  const name = getAssetName(asset) || getAssetRegistration(asset) || "Sredstvo";
  const reg = getAssetRegistration(asset);
  const label = labelFormatter(asset) || formatAssetTitleWithCode(asset) || name;
  const type = asset.asset_type || asset.type || getCanonicalAssetKind(asset);
  const selected = String(selectedValue || "").trim();
  const isSelected = selected && (
    selected === name ||
    selected === getAssetCode(asset) ||
    selected === reg ||
    selected === String(asset.id || "")
  ) ? "selected" : "";
  return `<option value="${escapeHtml(name)}" data-asset-id="${escapeHtml(asset.id || "")}" data-asset-code="${escapeHtml(getAssetCode(asset) || "")}" data-registration="${escapeHtml(reg || "")}" data-capacity="${escapeHtml(asset.capacity || "")}" data-asset-type="${escapeHtml(type)}" ${isSelected}>${escapeHtml(label)}</option>`;
}

function getMachineAssetsFromDirection() {
  return workerAssetOptions
    .filter(isMachineAsset)
    .filter(asset => getAssetCode(asset) || getAssetName(asset) || getAssetRegistration(asset));
}

function buildMachineOptionsHtml(selectedValue = "", searchValue = "") {
  const allMachines = getMachineAssetsFromDirection();
  let machines = allMachines.filter(m => machineMatchesSearch(m, searchValue));
  const selected = String(selectedValue || "").trim();
  const q = normalizeVehicleSearch(searchValue);

  // v1.20.0: Interni broj ima prednost i kod rubrike "Rad sa mašinom".
  // Ranije je ovde stajao uslov getCanonicalAssetKind(exact) === "machine".
  // Ako RPC/Supabase vrati tip malo drugačije, mašina postoji ali se ne prikaže.
  // Sada, ako je broj tačan, prikaži sredstvo odmah, pa tek za običnu pretragu koristi filter tipa.
  const exact = findAssetByExactCode(searchValue);
  if (exact && !machines.some(m => String(m.id || "") === String(exact.id || ""))) {
    machines = [exact, ...machines];
  }
  if (q && !machines.length) {
    machines = findAssetsByUniversalSearch(searchValue);
  }

  if (!workerAssetOptions.length) {
    return `<option value="">Nema sredstava iz Uprave</option>`;
  }
  if (!machines.length) {
    return q ? `<option value="">Nema mašine za taj broj/pretragu</option>` : `<option value="">Nema mašina iz Uprave</option>`;
  }

  return `<option value="">Odaberi mašinu</option>` + machines.map(m => assetOptionHtml(m, selected, formatMachineLabel)).join("");
}

function findMachineAssetForSmartInput(searchValue) {
  const q = normalizeVehicleSearch(searchValue);
  if (!q) return null;
  const machines = getMachineAssetsFromDirection();
  const exactCode = (workerAssetOptions || []).find(asset => normalizeVehicleSearch(getAssetCode(asset)) === q);
  if (exactCode) return exactCode;
  const exactMachineCode = machines.find(asset => normalizeVehicleSearch(getAssetCode(asset)) === q);
  if (exactMachineCode) return exactMachineCode;
  const exactName = machines.find(asset => {
    const name = normalizeVehicleSearch(getAssetName(asset));
    const label = normalizeVehicleSearch(formatMachineLabel(asset));
    return name === q || label === q;
  });
  if (exactName) return exactName;
  const matches = machines.filter(asset => machineMatchesSearch(asset, searchValue));
  return matches.length === 1 ? matches[0] : null;
}

function updateMachineSmartResult(entryEl, asset, manualValue) {
  const result = entryEl.querySelector(".m-picked");
  if (!result) return;
  if (asset) {
    result.className = "asset-smart-result m-picked ok";
    result.textContent = `Pronađena mašina: ${formatMachineLabel(asset)}`;
    return;
  }
  const value = String(manualValue || "").trim();
  if (value) {
    result.className = "asset-smart-result m-picked warn";
    result.textContent = `Nije pronađeno u evidenciji. Biće poslato kao dodatni unos: ${value}`;
    return;
  }
  result.className = "asset-smart-result m-picked";
  result.textContent = "Upiši broj mašine iz Uprave ili naziv ako nije na listi.";
}

function refreshOneMachineSelect(entryEl) {
  const sel = entryEl.querySelector(".m-name");
  if (!sel) return;
  const search = entryEl.querySelector(".m-search")?.value || "";
  const custom = entryEl.querySelector(".m-custom");
  const exact = findMachineAssetForSmartInput(search);
  sel.innerHTML = buildMachineOptionsHtml(exact ? getAssetName(exact) : "", search);
  if (exact) {
    const assetId = String(exact.id || "");
    const option = Array.from(sel.options || []).find(o => String(o.dataset.assetId || "") === assetId)
      || Array.from(sel.options || []).find(o => normalizeVehicleSearch(o.dataset.assetCode || "") === normalizeVehicleSearch(getAssetCode(exact)))
      || Array.from(sel.options || []).find(o => o.value === getAssetName(exact));
    if (option) sel.value = option.value;
    if (custom) custom.value = "";
    updateMachineSmartResult(entryEl, exact, "");
  } else {
    if (custom) custom.value = String(search || "").trim();
    updateMachineSmartResult(entryEl, null, search);
  }
  refreshFuelMachineOptions();
}

function buildLowloaderMachineDatalistOptionsHtml() {
  const machines = getMachineAssetsFromDirection();
  return machines.map(m => {
    const label = formatMachineLabel(m);
    return `<option value="${escapeHtml(label)}"></option>`;
  }).join("");
}

function buildLowloaderMachineOptionsHtml(selectedValue = "") {
  const selected = String(selectedValue || "").trim();
  const machines = getMachineAssetsFromDirection();
  if (!workerAssetOptions.length) return `<option value="">Nema sredstava iz Uprave</option>`;
  if (!machines.length) return `<option value="">Nema mašina iz Uprave</option>`;
  const options = [`<option value="">Odaberi mašinu iz Uprave</option>`];
  let hasSelected = false;
  machines.forEach(m => {
    const label = formatMachineLabel(m);
    const isSelected = selected && label === selected;
    if (isSelected) hasSelected = true;
    options.push(`<option value="${escapeHtml(label)}" data-asset-id="${escapeHtml(m.id || "")}" data-asset-code="${escapeHtml(getAssetCode(m))}" ${isSelected ? "selected" : ""}>${escapeHtml(label)}</option>`);
  });
  if (selected && !hasSelected) {
    options.push(`<option value="${escapeHtml(selected)}" selected>Stari / ručni unos: ${escapeHtml(selected)}</option>`);
  }
  return options.join("");
}

function buildLowloaderSiteDatalistOptionsHtml() {
  return (Array.isArray(workerSiteOptions) ? workerSiteOptions : []).map(site => {
    const name = site.name || site.site_name || site.title || "";
    const loc = site.location ? ` · ${site.location}` : "";
    const label = String(name + loc).trim();
    return label ? `<option value="${escapeHtml(label)}"></option>` : "";
  }).join("");
}

function buildLowloaderSiteOptionsHtml(selectedValue = "") {
  const selected = String(selectedValue || "").trim();
  const sites = Array.isArray(workerSiteOptions) ? workerSiteOptions : [];
  if (!sites.length) return `<option value="">Nema gradilišta iz Uprave</option>`;
  const options = [`<option value="">Odaberi gradilište iz Uprave</option>`];
  let hasSelected = false;
  sites.forEach(site => {
    const name = site.name || site.site_name || site.title || "";
    const loc = site.location ? ` · ${site.location}` : "";
    const label = String(name + loc).trim();
    const value = String(name).trim();
    if (!value) return;
    const isSelected = selected && (value.toLowerCase() === selected.toLowerCase() || label.toLowerCase() === selected.toLowerCase());
    if (isSelected) hasSelected = true;
    options.push(`<option value="${escapeHtml(value)}" data-site-id="${escapeHtml(site.id || "")}" ${isSelected ? "selected" : ""}>${escapeHtml(label)}</option>`);
  });
  if (selected && !hasSelected) {
    options.push(`<option value="${escapeHtml(selected)}" selected>Stari / ručni unos: ${escapeHtml(selected)}</option>`);
  }
  return options.join("");
}

function refreshDefectSiteDatalist() {
  // v1.31.0: Na telefonu datalist ne otvara uvek lepo listu.
  // Zato za kvar koristimo pravi SELECT iz gradilišta Uprave + posebno polje za ručnu lokaciju.
  const select = $("#wrDefectSiteName");
  if (select && select.tagName === "SELECT") {
    const oldValue = select.value || "";
    select.innerHTML = buildLowloaderSiteOptionsHtml(oldValue);
    if (oldValue && Array.from(select.options).some(o => o.value === oldValue)) select.value = oldValue;
  }
  const list = $("#defectSiteList");
  if (list) list.innerHTML = buildLowloaderSiteDatalistOptionsHtml();
}

function getSelectedDefectSite() {
  const select = $("#wrDefectSiteName");
  const manual = String($("#wrDefectSiteManual")?.value || "").trim();
  const selectedName = String(select?.value || "").trim();
  const selectedOption = select && select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
  const siteId = selectedOption?.dataset?.siteId || "";
  const siteName = manual || selectedName;
  return {
    site_id: siteId,
    site_name: siteName,
    manual_location: manual,
    selected_site_name: selectedName
  };
}

function parseLowloaderDecimalInput(value) {
  const n = Number(String(value || "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}

function formatLowloaderDecimalForInput(value) {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
}

function updateLowloaderKmTotal(entryEl) {
  if (!entryEl) return;
  const start = parseLowloaderDecimalInput(entryEl.querySelector(".ll-km-start")?.value);
  const end = parseLowloaderDecimalInput(entryEl.querySelector(".ll-km-end")?.value);
  const totalEl = entryEl.querySelector(".ll-km");
  if (!totalEl) return;
  if (start === null || end === null || end < start) {
    totalEl.value = "";
    return;
  }
  totalEl.value = formatLowloaderDecimalForInput(end - start);
}

function refreshOneLowloaderMachineSelect(entryEl) {
  const machineSelect = entryEl.querySelector("select.ll-machine");
  if (machineSelect) {
    const oldValue = machineSelect.value;
    machineSelect.innerHTML = buildLowloaderMachineOptionsHtml(oldValue);
    if (oldValue && Array.from(machineSelect.options).some(o => o.value === oldValue)) machineSelect.value = oldValue;
  }
  const machineList = entryEl.querySelector(".ll-machine-list");
  if (machineList) machineList.innerHTML = buildLowloaderMachineDatalistOptionsHtml();
  entryEl.querySelectorAll("select.ll-from, select.ll-to").forEach(select => {
    const oldValue = select.value;
    select.innerHTML = buildLowloaderSiteOptionsHtml(oldValue);
    if (oldValue && Array.from(select.options).some(o => o.value === oldValue)) select.value = oldValue;
  });
  entryEl.querySelectorAll(".ll-site-list").forEach(list => {
    list.innerHTML = buildLowloaderSiteDatalistOptionsHtml();
  });
}

function refreshLowloaderMachineSelectors() {
  $$("#lowloaderEntries .lowloader-entry").forEach(entry => refreshOneLowloaderMachineSelect(entry));
}

function refreshMachineDatalists() {
  $$("#machineEntries .machine-entry").forEach(entry => refreshOneMachineSelect(entry));
  refreshLowloaderMachineSelectors();
}

function normalizeWorkerAssetRows(rows) {
  return (Array.isArray(rows) ? rows : []).map(a => {
    const rawType = a.asset_type || a.type || a.assetType || a.asset_kind || a.kind || a.category || a.asset_category || a.group || "";
    const normalized = {
      ...a,
      name: getAssetName(a),
      asset_code: getAssetCode(a),
      registration: getAssetRegistration(a),
      asset_type: rawType,
      type: a.type || rawType
    };
    // Ako RPC ne vrati tip, pokušaj da ga popuniš po nazivu/registraciji.
    if (!normalized.asset_type) normalized.asset_type = inferAssetTypeFromText(normalized);
    if (!normalized.type) normalized.type = normalized.asset_type;
    return normalized;
  }).filter(a => a.name || a.registration || a.asset_code);
}

function mergeAssetRows(primary = [], fallback = []) {
  const map = new Map();
  [...primary, ...fallback].forEach(a => {
    const key = String(a.id || `${getAssetCode(a) || ""}|${a.name || ""}|${a.registration || ""}|${a.asset_type || a.type || ""}`);
    if (!map.has(key)) map.set(key, a);
  });
  return Array.from(map.values());
}

async function loadWorkerAssets() {
  const worker = currentWorker || JSON.parse(localStorage.getItem("swp_worker") || "null");
  workerAssetOptions = [];

  if (!worker) return;

  let rpcRows = [];
  let directRows = [];
  let rpcError = null;
  let directError = null;

  // Prvi izvor: RPC. Ovo je pravilan put za zaposlenog.
  try {
    const { data, error } = await sb.rpc("worker_list_assets", {
      p_company_code: worker.company_code,
      p_access_code: worker.access_code
    });
    if (error) throw error;
    rpcRows = normalizeWorkerAssetRows(data);
  } catch (e) {
    rpcError = e;
  }

  // Drugi izvor: direktno iz assets po company_id.
  // VAŽNO v1.19.7: ovo se sada pokušava UVEK kada zaposleni ima company_id,
  // ne samo kada RPC vrati prazno. Tako zaposleni vidi mašine i ako je RPC star
  // i ne vraća sva polja/tipove, a ne diramo Supabase SQL.
  if (worker.company_id) {
    try {
      const { data, error } = await sb
        .from("assets")
        .select("*")
        .eq("company_id", worker.company_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      directRows = normalizeWorkerAssetRows(data);
    } catch (e) {
      directError = e;
    }
  }

  workerAssetOptions = mergeAssetRows(directRows, rpcRows).filter(a => a.active !== false);

  refreshVehicleSelects();
  refreshMachineDatalists();
  refreshFieldTankerSelectors();
  refreshFuelMachineOptions();
  refreshSiteLogTruckAssetSelectors();

  const machineCount = workerAssetOptions.filter(isMachineAsset).length;
  const vehicleCount = workerAssetOptions.filter(isVehicleAsset).length;
  const otherCount = workerAssetOptions.filter(isOtherAsset).length;

  if (!workerAssetOptions.length) {
    toast("Zaposlenom nisu učitane mašine/vozila. Proveri da li u Upravi postoje sredstva za ovu firmu i da li je zaposleni u istoj firmi. Detalj: " + ((directError && directError.message) || (rpcError && rpcError.message) || "nema podataka"), true);
  } else if (!machineCount && (vehicleCount || otherCount)) {
    toast(`Sredstva su učitana, ali nema tipa Mašina. U Upravi proveri Kategorija: Mašina. Učitano: vozila ${vehicleCount}, ostalo ${otherCount}.`, true);
  } else if (machineCount && !vehicleCount && !otherCount) {
    console.warn("AskCreate.app: učitane su samo mašine. Ako u Upravi postoje vozila/ostalo, proveri Supabase RPC worker_list_assets da vraća sve asset_type vrednosti.", { workerAssetOptions, rpcError, directError });
  }
}

function normalizeVehicleSearch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9čćžšđ]/gi, "")
    .trim();
}

function normalizeSearch(value) {
  return normalizeVehicleSearch(value);
}

function vehicleMatchesSearch(asset, searchValue) {
  const q = normalizeVehicleSearch(searchValue);
  if (!q) return true;
  const haystack = normalizeVehicleSearch([
    getAssetCode(asset),
    asset?.name,
    asset?.registration,
    asset?.capacity,
    asset?.type || asset?.asset_type
  ].filter(Boolean).join(" "));
  return haystack.includes(q);
}

function buildVehicleOptionsHtml(selectedValue = "", searchValue = "") {
  const allVehicles = workerAssetOptions.filter(isVehicleAsset);
  let vehicles = allVehicles.filter(v => vehicleMatchesSearch(v, searchValue));
  const selected = String(selectedValue || "").trim();
  const q = normalizeVehicleSearch(searchValue);

  // v1.19.8: broj sredstva ne sme da blokira stari filter.
  // Ako zaposleni ukuca tačan interni broj, prvo prikaži to sredstvo makar je tip došao čudno iz RPC-a.
  const exact = findAssetByExactCode(searchValue);
  if (exact && !vehicles.some(v => String(v.id || "") === String(exact.id || ""))) {
    vehicles = [exact, ...vehicles];
  }
  if (q && !vehicles.length) {
    vehicles = findAssetsByUniversalSearch(searchValue);
  }

  if (!workerAssetOptions.length) {
    return `<option value="">Nema sredstava iz Uprave</option>`;
  }
  if (!vehicles.length) {
    return q ? `<option value="">Nema sredstva za taj broj/pretragu</option>` : `<option value="">Nema vozila iz Uprave</option>`;
  }

  return `<option value="">Odaberi vozilo</option>` + vehicles.map(v => assetOptionHtml(v, selected, formatAssetLabel)).join("");
}


function findVehicleAssetForSmartInput(searchValue) {
  const q = normalizeVehicleSearch(searchValue);
  if (!q) return null;
  const vehicles = (workerAssetOptions || []).filter(isVehicleAsset);

  // Interni broj ima prednost. Ako je broj tačan, uzmi sredstvo odmah.
  // Ovo čuva praktičan rad na terenu: zaposleni zna broj, ne treba da bira iz tri polja.
  const exactCode = (workerAssetOptions || []).find(asset => normalizeVehicleSearch(getAssetCode(asset)) === q);
  if (exactCode) return exactCode;

  const exactVehicleCode = vehicles.find(asset => normalizeVehicleSearch(getAssetCode(asset)) === q);
  if (exactVehicleCode) return exactVehicleCode;

  const exactName = vehicles.find(asset => {
    const name = normalizeVehicleSearch(getAssetName(asset));
    const reg = normalizeVehicleSearch(getAssetRegistration(asset));
    const label = normalizeVehicleSearch(formatAssetLabel(asset));
    return name === q || reg === q || label === q;
  });
  if (exactName) return exactName;

  const matches = vehicles.filter(asset => vehicleMatchesSearch(asset, searchValue));
  return matches.length === 1 ? matches[0] : null;
}

function updateVehicleSmartResult(entryEl, asset, manualValue) {
  const result = entryEl.querySelector(".v-picked");
  if (!result) return;
  if (asset) {
    result.className = "asset-smart-result v-picked ok";
    result.textContent = `Pronađeno vozilo: ${formatAssetLabel(asset)}`;
    return;
  }
  const value = String(manualValue || "").trim();
  if (value) {
    result.className = "asset-smart-result v-picked warn";
    result.textContent = `Nije pronađeno u evidenciji. Biće poslato kao dodatni unos: ${value}`;
    return;
  }
  result.className = "asset-smart-result v-picked";
  result.textContent = "Pronadjeno vozilo će se pokazati ispod.";
}

function refreshOneVehicleSelect(entryEl) {
  const sel = entryEl.querySelector(".v-name");
  if (!sel) return;
  const search = entryEl.querySelector(".v-search")?.value || "";
  const custom = entryEl.querySelector(".v-custom");
  const exact = findVehicleAssetForSmartInput(search);

  sel.innerHTML = buildVehicleOptionsHtml(exact ? getAssetName(exact) : "", search);

  if (exact) {
    const assetId = String(exact.id || "");
    const option = Array.from(sel.options || []).find(o => String(o.dataset.assetId || "") === assetId)
      || Array.from(sel.options || []).find(o => normalizeVehicleSearch(o.dataset.assetCode || "") === normalizeVehicleSearch(getAssetCode(exact)))
      || Array.from(sel.options || []).find(o => o.value === getAssetName(exact));
    if (option) sel.value = option.value;
    if (custom) custom.value = "";
    updateVehicleSmartResult(entryEl, exact, "");
  } else {
    if (custom) custom.value = String(search || "").trim();
    updateVehicleSmartResult(entryEl, null, search);
  }
  refreshFuelMachineOptions();
}

function refreshVehicleSelects() {
  $$("#vehicleEntries .vehicle-entry").forEach(entry => refreshOneVehicleSelect(entry));
}

function getSelectedVehicleFromEntry(el) {
  const select = el.querySelector(".v-name");
  const option = select?.options ? select.options[select.selectedIndex] : null;
  const custom = el.querySelector(".v-custom")?.value.trim() || "";
  return {
    asset_id: custom ? null : (option?.dataset?.assetId || null),
    asset_code: custom ? "" : (option?.dataset?.assetCode || ""),
    name: custom || (select?.value || ""),
    registration: custom ? "" : (option?.dataset?.registration || ""),
    capacity: custom ? "" : (option?.dataset?.capacity || "")
  };
}

function parseDecimal(value) {
  const n = Number(String(value || "").replace(",", ".").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function calculateVehicleCubic(capacity, tours) {
  const cap = parseDecimal(capacity);
  const t = parseDecimal(tours);
  if (!cap || !t) return "";
  const total = cap * t;
  return Number.isInteger(total) ? String(total) : String(Math.round(total * 100) / 100);
}


function vehicleLastKmStorageKey(assetCode = "", assetId = "", name = "") {
  const company = currentWorker?.company_id || currentWorker?.company_code || currentCompany?.id || currentCompany?.company_code || "no_company";
  const key = assetCode || assetId || name || "no_vehicle";
  return `askcreate_last_km_${company}_${normalizeSearch(key).replace(/[^a-z0-9]+/g, "_")}`;
}

function getStoredVehicleLastKm(selected = {}) {
  const key = vehicleLastKmStorageKey(selected.asset_code, selected.asset_id, selected.name);
  return localStorage.getItem(key) || "";
}

function setStoredVehicleLastKm(selected = {}, km = "") {
  const val = String(km || "").trim();
  if (!val) return;
  const key = vehicleLastKmStorageKey(selected.asset_code, selected.asset_id, selected.name);
  localStorage.setItem(key, val);
}

function applyVehicleLastKmToEntry(entryEl) {
  const selected = getSelectedVehicleFromEntry(entryEl);
  const startInput = entryEl?.querySelector(".v-km-start");
  if (!startInput) return;
  const stored = getStoredVehicleLastKm(selected);
  if (stored) {
    startInput.value = stored;
    startInput.readOnly = true;
    startInput.classList.add("km-start-locked");
    startInput.placeholder = "preuzeto iz prethodne završne km";
  } else {
    const current = String(startInput.value || "").trim();
    startInput.readOnly = false;
    startInput.classList.remove("km-start-locked");
    if (!current) startInput.value = "";
    startInput.placeholder = "prvi put upiši početnu km";
  }
  updateVehicleCubic(entryEl);
}

function updateVehicleCubic(entryEl) {
  const selected = getSelectedVehicleFromEntry(entryEl);
  const tourTotal = Array.from(entryEl.querySelectorAll(".tour-count")).reduce((sum, input) => sum + parseDecimalInput(input.value), 0);
  const totalEl = entryEl.querySelector(".v-total-tours");
  if (totalEl) totalEl.textContent = tourTotal ? String(Math.round(tourTotal * 100) / 100) : "0";
  const kmStart = entryEl.querySelector(".v-km-start")?.value || "";
  const kmEnd = entryEl.querySelector(".v-km-end")?.value || "";
  const kmTotal = decimalDiffText(kmStart, kmEnd) || "";
  const kmEl = entryEl.querySelector(".v-total-km");
  if (kmEl) kmEl.textContent = kmTotal || "—";
  const legacyTours = entryEl.querySelector(".v-tours")?.value || "";
  const auto = calculateVehicleCubic(selected.capacity, legacyTours || tourTotal);
  const autoEl = entryEl.querySelector(".v-cubic-auto");
  if (autoEl) autoEl.value = auto;
  const hint = entryEl.querySelector(".v-cubic-hint");
  if (hint) {
    hint.textContent = auto
      ? `Automatski: ${selected.capacity || 0} × ${legacyTours || tourTotal || 0} tura = ${auto}`
      : "Ture se vode po stavkama. Ukupna kilometraža je završna minus početna km.";
  }
}

function getWorkerSiteOptionPayload(select) {
  if (!select) return { site_id: null, site_name: "" };
  const option = select.options ? select.options[select.selectedIndex] : null;
  return {
    site_id: option?.dataset?.siteId || null,
    site_name: String(select.value || "").trim()
  };
}

function refreshDailyItemSiteSelectors() {
  $$(".entry-site-select").forEach(select => {
    const oldValue = select.value || "";
    select.innerHTML = buildLowloaderSiteOptionsHtml(oldValue);
    if (oldValue && Array.from(select.options).some(o => o.value === oldValue)) select.value = oldValue;
  });
}

function summarizeSitesFromDailyItems(items = []) {
  const names = [];
  const add = (v) => { const s = String(v || "").trim(); if (s) names.push(s); };
  (items || []).forEach(x => {
    add(x.site_name || x.site);
    (Array.isArray(x.tour_items) ? x.tour_items : []).forEach(t => {
      add(t.site_name || t.site);
      add(t.from_site);
      add(t.to_site);
    });
  });
  const unique = Array.from(new Set(names));
  if (!unique.length) return { site_id: null, site_name: "" };
  if (unique.length === 1) {
    const first = (items || []).find(x => (x.site_name || x.site) === unique[0]) || {};
    return { site_id: first.site_id || null, site_name: unique[0] };
  }
  return { site_id: null, site_name: `Više gradilišta (${unique.length})` };
}


function buildTruckTourSiteOptionsHtml(selectedValue = "") {
  return buildLowloaderSiteOptionsHtml(selectedValue || "");
}

function truckTourTypeLabel(value = "") {
  const v = String(value || "").trim();
  if (v === "local") return "Lokal u krugu gradilišta";
  if (v === "site_to_site") return "Gradilište → gradilište";
  if (v === "landfill") return "Odvoz na deponiju";
  if (v === "external_in") return "Dovoz spolja / dobavljač";
  return v || "—";
}

function addVehicleTourRow(vehicleCard, values = {}) {
  const list = vehicleCard?.querySelector(".v-tour-items");
  if (!list) return;
  const idx = list.querySelectorAll(".vehicle-tour-row").length + 1;
  const rawType = values.tour_type || values.type || values.direction_type || (values.direction === "interno" ? "site_to_site" : values.direction === "odvoz" ? "landfill" : "local");
  const type = rawType === "external_in" ? "site_to_site" : rawType;
  const material = values.material || values.material_name || "";
  const div = document.createElement("div");
  div.className = "vehicle-tour-row truck-tour-card";
  div.innerHTML = `
    <div class="entry-card-head vehicle-tour-head">
      <strong>Tura ${idx}</strong>
      <button type="button" class="remove-entry">Ukloni</button>
    </div>

    <div class="grid two">
      <div>
        <label>Vrsta ture</label>
        <select class="tour-type">
          <option value="local" ${type === "local" ? "selected" : ""}>Lokal u krugu gradilišta</option>
          <option value="site_to_site" ${type === "site_to_site" ? "selected" : ""}>Sa gradilišta na gradilište</option>
          <option value="landfill" ${type === "landfill" ? "selected" : ""}>Odvoz na deponiju</option>
        </select>
      </div>
      <div>
        <label>Materijal</label>
        <select class="tour-material">${buildWorkerMaterialOptionsHtml(material)}</select>
      </div>
    </div>

    <div class="grid two tour-count-box">
      <div>
        <label>Broj tura</label>
        <input class="tour-count" inputmode="decimal" placeholder="npr. 2" value="${escapeHtml(values.tours || values.tour_count || "")}" />
      </div>
      <div>
        <label>Napomena</label>
        <input class="tour-note" placeholder="kratka napomena" value="${escapeHtml(values.note || values.route || "")}" />
      </div>
    </div>

    <div class="grid two tour-site-local">
      <div>
        <label>Gradilište</label>
        <select class="tour-site">${buildTruckTourSiteOptionsHtml(values.site_name || values.site || "")}</select>
      </div>
    </div>

    <div class="grid two tour-site-transfer">
      <div>
        <label>Od gradilišta</label>
        <select class="tour-from-site">${buildTruckTourSiteOptionsHtml(values.from_site || values.load_location || "")}</select>
      </div>
      <div>
        <label>Do gradilišta</label>
        <select class="tour-to-site">${buildTruckTourSiteOptionsHtml(values.to_site || values.unload_location || "")}</select>
      </div>
    </div>

    <div class="grid two tour-site-landfill">
      <div>
        <label>Sa gradilišta</label>
        <select class="tour-source-site">${buildTruckTourSiteOptionsHtml(values.from_site || values.site_name || values.site || values.load_location || "")}</select>
      </div>
      <div>
        <label>Deponija</label>
        <input class="tour-landfill" placeholder="npr. Deponija Surčin" value="${escapeHtml(values.landfill || values.unload_location || values.to_site || "")}" />
      </div>
    </div>
  `;
  const setBlock = (selector, show) => {
    const el = div.querySelector(selector);
    if (!el) return;
    el.style.display = show ? "grid" : "none";
  };
  const refreshVisibility = () => {
    const t = div.querySelector(".tour-type")?.value || "local";
    setBlock('.tour-site-local', t === 'local');
    setBlock('.tour-site-transfer', t === 'site_to_site');
    setBlock('.tour-site-landfill', t === 'landfill');
  };
  div.querySelector(".remove-entry")?.addEventListener("click", () => {
    div.remove();
    updateVehicleCubic(vehicleCard);
  });
  div.querySelector(".tour-type")?.addEventListener("change", () => {
    refreshVisibility();
    updateVehicleCubic(vehicleCard);
  });
  div.querySelectorAll("input, select").forEach(el => el.addEventListener("input", () => updateVehicleCubic(vehicleCard)));
  div.querySelectorAll("select").forEach(el => el.addEventListener("change", () => updateVehicleCubic(vehicleCard)));
  list.appendChild(div);
  preventNumberInputScrollChanges(div);
  refreshVisibility();
  updateVehicleCubic(vehicleCard);
}

function addVehicleEntry(values = {}) {
  const list = $("#vehicleEntries");
  if (!list) return;
  const idx = list.querySelectorAll(".vehicle-entry").length + 1;
  const selectedName = values.name || values.vehicle || values.asset_id || "";
  const initialSearch = values.asset_code || values.vehicle_code || values.code || values.custom || values.vehicle_custom || selectedName || values.registration || "";
  const div = document.createElement("div");
  div.className = "entry-card vehicle-entry truck-daily-entry worker-compact-card";
  div.innerHTML = `
    <div class="entry-card-head">
      <strong>Vozilo / kamion ${idx}</strong>
      <button type="button" class="remove-entry">Ukloni</button>
    </div>

    <label>Vozilo / interni broj</label>
    <input class="v-search asset-code-search smart-asset-input" placeholder="upiši broj, tablice ili naziv vozila, npr. 2 ili KAM-05" value="${escapeHtml(initialSearch)}" />
    <div class="asset-smart-result v-picked">Pronadjeno vozilo će se pokazati ispod.</div>
    <button class="secondary small-btn refresh-vehicle-assets" type="button">Osveži vozila iz Uprave</button>

    <select class="v-name hidden-asset-select" aria-hidden="true" tabindex="-1">${buildVehicleOptionsHtml(selectedName)}</select>
    <input class="v-custom hidden-asset-custom" aria-hidden="true" tabindex="-1" value="${escapeHtml(values.custom || values.vehicle_custom || "")}" />

    <div class="truck-km-box">
      <div>
        <label>Početna kilometraža</label>
        <input class="v-km-start" inputmode="decimal" value="${escapeHtml(values.km_start || values.start || values.last_km || "")}" placeholder="prvi put upiši početnu km" />
        
      </div>
      <div>
        <label>Završna kilometraža</label>
        <input class="v-km-end" inputmode="decimal" value="${escapeHtml(values.km_end || values.end || "")}" placeholder="npr. 100.180" />
      </div>
    </div>

    <div class="truck-tour-explain">
      <b>Ture i materijal</b>
      <span></span>
    </div>

    <div class="v-tour-items entry-list"></div>
    <button type="button" class="secondary small-action add-tour-row">+ Dodaj turu / materijal</button>

    <div class="truck-summary-line">
      <span>Ukupno tura: <b class="v-total-tours">0</b></span>
      <span>Ukupno km: <b class="v-total-km">—</b></span>
    </div>
  `;

  div.querySelector(".remove-entry").addEventListener("click", () => {
    div.remove();
    refreshFuelMachineOptions();
  });
  div.querySelector(".v-search").addEventListener("input", () => {
    refreshOneVehicleSelect(div);
    applyVehicleLastKmToEntry(div);
    updateVehicleCubic(div);
  });
  div.querySelector(".v-name").addEventListener("change", () => {
    applyVehicleLastKmToEntry(div);
    updateVehicleCubic(div);
    refreshFuelMachineOptions();
  });
  div.querySelector(".v-custom").addEventListener("input", refreshFuelMachineOptions);
  div.querySelector(".v-km-start")?.addEventListener("input", () => updateVehicleCubic(div));
  div.querySelector(".v-km-end")?.addEventListener("input", () => updateVehicleCubic(div));
  div.querySelector(".add-tour-row")?.addEventListener("click", () => addVehicleTourRow(div, {}));
  const refreshVehiclesBtn = div.querySelector(".refresh-vehicle-assets");
  if (refreshVehiclesBtn) refreshVehiclesBtn.addEventListener("click", async () => {
    try {
      refreshVehiclesBtn.disabled = true;
      refreshVehiclesBtn.textContent = "Učitavam...";
      await loadWorkerAssets();
      refreshOneVehicleSelect(div);
      applyVehicleLastKmToEntry(div);
      updateVehicleCubic(div);
      toast(workerAssetOptions.length ? "Vozila iz Uprave su osvežena." : "Nema učitanih vozila. Proveri firmu zaposlenog i listu u Upravi.", !workerAssetOptions.length);
    } finally {
      refreshVehiclesBtn.disabled = false;
      refreshVehiclesBtn.textContent = "Osveži vozila iz Uprave";
    }
  });
  list.appendChild(div);
  preventNumberInputScrollChanges(div);
  refreshOneVehicleSelect(div);
  applyVehicleLastKmToEntry(div);

  const items = Array.isArray(values.tour_items) ? values.tour_items : [];
  if (items.length) items.forEach(item => addVehicleTourRow(div, item));
  else if (values.tours || values.material || values.site_name || values.direction || values.load_location || values.unload_location || values.route) {
    addVehicleTourRow(div, values);
  } else {
    addVehicleTourRow(div, {});
  }

  updateVehicleCubic(div);
  refreshFuelMachineOptions();
}

function getVehicleTourItemsFromEntry(el, selected = {}) {
  return Array.from(el.querySelectorAll(".vehicle-tour-row")).map((row, idx) => {
    const type = row.querySelector(".tour-type")?.value || "local";
    const material = row.querySelector(".tour-material")?.value.trim() || "";
    const tours = row.querySelector(".tour-count")?.value.trim() || "";
    const base = {
      no: idx + 1,
      tour_type: type,
      tour_type_label: truckTourTypeLabel(type),
      material,
      material_name: material,
      tours,
      note: row.querySelector(".tour-note")?.value.trim() || ""
    };
    if (type === "site_to_site") {
      return {
        ...base,
        from_site: row.querySelector(".tour-from-site")?.value || "",
        to_site: row.querySelector(".tour-to-site")?.value || "",
        load_location: row.querySelector(".tour-from-site")?.value || "",
        unload_location: row.querySelector(".tour-to-site")?.value || "",
        direction: "transfer"
      };
    }
    if (type === "landfill") {
      return {
        ...base,
        site_name: row.querySelector(".tour-source-site")?.value || "",
        from_site: row.querySelector(".tour-source-site")?.value || "",
        landfill: row.querySelector(".tour-landfill")?.value.trim() || "",
        unload_location: row.querySelector(".tour-landfill")?.value.trim() || "",
        direction: "landfill"
      };
    }
    return {
      ...base,
      site_name: row.querySelector(".tour-site")?.value || "",
      direction: "local"
    };
  }).filter(x => x.tours || x.material || x.site_name || x.from_site || x.to_site || x.landfill || x.note);
}

function getVehicleEntries() {
  return $$("#vehicleEntries .vehicle-entry").map((el, i) => {
    const selected = getSelectedVehicleFromEntry(el);
    const tourItems = getVehicleTourItemsFromEntry(el, selected);
    const tours = tourItems.reduce((sum, item) => sum + parseDecimalInput(item.tours), 0) || "";
    const firstSite = summarizeSitesFromDailyItems(tourItems);
    const kmStart = el.querySelector(".v-km-start")?.value || "";
    const kmEnd = el.querySelector(".v-km-end")?.value || "";
    return {
      no: i + 1,
      asset_id: selected.asset_id,
      name: selected.name,
      vehicle: selected.name,
      asset_code: selected.asset_code,
      vehicle_code: selected.asset_code,
      registration: selected.registration,
      capacity: selected.capacity,
      vehicle_custom: el.querySelector(".v-custom")?.value.trim() || "",
      site_id: firstSite.site_id || null,
      site_name: firstSite.site_name || "",
      km_start: kmStart,
      km_end: kmEnd,
      km_total: decimalDiffText(kmStart, kmEnd) || "",
      route: tourItems.map(t => {
        if (t.tour_type === "site_to_site") return `${t.from_site || "—"} → ${t.to_site || "—"}`;
        if (t.tour_type === "landfill") return `${t.from_site || t.site_name || "—"} → ${t.landfill || "deponija"}`;
        if (t.tour_type === "external_in") return `${t.external_source || "spolja"} → ${t.to_site || t.site_name || "—"}`;
        return `${t.site_name || "—"} · lokal`;
      }).join(" | "),
      tours,
      tour_items: tourItems,
      material: tourItems.map(t => t.material).filter(Boolean).join(" | "),
      material_name: tourItems.map(t => t.material).filter(Boolean).join(" | "),
      direction: "tour_items",
      transport_direction: "tour_items",
      cubic_auto: "",
      cubic_manual: "",
      cubic_m3: ""
    };
  }).filter(v => v.name || v.site_name || v.km_start || v.km_end || v.tours || (v.tour_items || []).length);
}


function rememberVehicleEndKilometersAfterSubmit(vehicles = []) {
  (Array.isArray(vehicles) ? vehicles : []).forEach(v => {
    const selected = { asset_code: v.asset_code || v.vehicle_code || "", asset_id: v.asset_id || "", name: v.name || v.vehicle || "" };
    const kmEnd = v.km_end || "";
    if (kmEnd) setStoredVehicleLastKm(selected, kmEnd);
  });
}

async function loadWorkerSites(selectedName = "") {
  const select = $("#wrSiteName");
  const hint = $("#workerSiteHint");
  if (!select) return;

  const worker = currentWorker || JSON.parse(localStorage.getItem("swp_worker") || "null");
  if (!worker) {
    select.innerHTML = `<option value="">Prvo se prijavi kao zaposleni</option>`;
    return;
  }

  select.innerHTML = `<option value="">Učitavam gradilišta...</option>`;
  if (hint) hint.textContent = "Gradilišta se učitavaju iz Uprave.";

  try {
    const { data, error } = await sb.rpc("worker_list_sites", {
      p_company_code: worker.company_code,
      p_access_code: worker.access_code
    });

    if (error) throw error;

    const sites = Array.isArray(data) ? data : [];
    workerSiteOptions = sites;
    if (!sites.length) {
      select.innerHTML = `<option value="">Nema aktivnih gradilišta</option>`;
      if (hint) hint.textContent = "Uprava još nije dodala aktivno gradilište ili je SQL za worker_list_sites star.";
      refreshFieldTankerSelectors();
      refreshDefectSiteDatalist();
      refreshDailyItemSiteSelectors();
      return;
    }

    select.innerHTML = `<option value="">Odaberi gradilište</option>` + sites.map(site => {
      const name = site.name || "Gradilište";
      const loc = site.location ? ` · ${site.location}` : "";
      return `<option value="${escapeHtml(name)}" data-site-id="${escapeHtml(site.id || "")}">${escapeHtml(name + loc)}</option>`;
    }).join("");

    if (selectedName) {
      const wanted = String(selectedName).trim().toLowerCase();
      const match = Array.from(select.options).find(o => String(o.value || "").trim().toLowerCase() === wanted);
      if (match) select.value = match.value;
    }
    refreshFieldTankerSelectors();
    refreshDefectSiteDatalist();
    refreshDailyItemSiteSelectors();

    if (hint) hint.textContent = "Odaberi aktivno gradilište koje je dodala Uprava.";
  } catch (e) {
    select.innerHTML = `<option value="">Gradilišta nisu učitana</option>`;
    if (hint) hint.textContent = "Pokreni Supabase SQL za v1.12.1: worker_list_sites. Detalj: " + (e.message || e);
    workerSiteOptions = [];
    refreshFieldTankerSelectors();
    refreshDefectSiteDatalist();
    toast("Gradilišta za zaposlenog nisu učitana: " + (e.message || e), true);
  }
}


function normalizeWorkerMaterialList(rows = []) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : [])
    .map(m => {
      if (typeof m === "string") return { name: m, unit: "", category: "" };
      return {
        id: m?.id || "",
        name: m?.name || m?.material || m?.title || m?.label || "",
        unit: m?.unit || "",
        category: m?.category || ""
      };
    })
    .filter(m => {
      const key = String(m.name || "").trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "sr"));
}

function buildWorkerMaterialOptionsHtml(selectedValue = "") {
  const selected = String(selectedValue || "").trim();
  const materials = normalizeWorkerMaterialList(workerMaterialOptions);

  if (!materials.length) {
    return `<option value="">Nema materijala iz Uprave</option>`;
  }

  return `<option value="">Odaberi vrstu materijala</option>` + materials.map(m => {
    const labelParts = [m.name];
    if (m.unit) labelParts.push(m.unit);
    if (m.category) labelParts.push(m.category);
    const label = labelParts.filter(Boolean).join(" · ");
    const isSelected = selected && selected === m.name ? "selected" : "";
    return `<option value="${escapeHtml(m.name)}" data-material-id="${escapeHtml(m.id || "")}" data-unit="${escapeHtml(m.unit || "")}" ${isSelected}>${escapeHtml(label)}</option>`;
  }).join("");
}

function fillUnitFromMaterialOption(selectEl, unitInputEl, force = false) {
  if (!selectEl || !unitInputEl) return;
  const option = selectEl.options ? selectEl.options[selectEl.selectedIndex] : null;
  const unit = option?.dataset?.unit || "";
  if (!unit) return;
  if (force || !String(unitInputEl.value || "").trim()) {
    unitInputEl.value = unit;
    unitInputEl.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function fillMaterialEntryUnitFromSelect(entryEl, force = false) {
  if (!entryEl) return;
  const selectEl = entryEl.querySelector(".mat-select");
  const unitSelect = entryEl.querySelector(".mat-unit");
  const unitManual = entryEl.querySelector(".mat-unit-manual");
  const option = selectEl?.options ? selectEl.options[selectEl.selectedIndex] : null;
  const unit = option?.dataset?.unit || "";
  if (!unit || !unitSelect) return;
  const standardValues = Array.from(unitSelect.options || []).map(o => o.value);
  if (standardValues.includes(unit)) {
    if (force || !unitSelect.value || unitSelect.value === "ručno") unitSelect.value = unit;
  } else {
    unitSelect.value = "ručno";
    if (unitManual && (force || !unitManual.value)) unitManual.value = unit;
  }
  updateMaterialUnitManualVisibility(entryEl);
  updateMaterialCalculation(entryEl);
}

function refreshWorkerMaterialSelect(selectedValue = "") {
  const select = $("#wrMaterialSelect");
  if (!select) return;
  const old = selectedValue || select.value || "";
  select.innerHTML = buildWorkerMaterialOptionsHtml(old);
  if (old && Array.from(select.options).some(o => o.value === old)) select.value = old;
}

function getSelectedWorkerMaterial() {
  const manual = $("#wrMaterialManual")?.value?.trim() || "";
  const selected = $("#wrMaterialSelect")?.value?.trim() || "";
  return manual || selected;
}

async function loadWorkerMaterials(selectedValue = "") {
  const worker = currentWorker || JSON.parse(localStorage.getItem("swp_worker") || "null");
  const permissionNames = worker?.permissions?.allowed_material_names || [];

  try {
    let materials = normalizeWorkerMaterialList(permissionNames);

    // Radnik/šef nije Direkcija i ne sme da koristi director_list_materials.
    // Zato lista materijala za teren mora ići preko posebne RPC funkcije koja proverava
    // company_code + access_code, isto kao worker_list_sites i worker_list_assets.
    if (!materials.length && worker?.company_code && worker?.access_code && sb) {
      const { data, error } = await sb.rpc("worker_list_materials", {
        p_company_code: worker.company_code,
        p_access_code: worker.access_code
      });
      if (!error) materials = normalizeWorkerMaterialList(data || []);
    }

    // Fallback ostaje samo za staru/test bazu ako worker_list_materials još nije ubačen.
    // U produkciji očekujemo RPC worker_list_materials, jer direktan select često blokira RLS.
    if (!materials.length && worker?.company_id && sb) {
      const { data, error } = await sb
        .from("materials")
        .select("id,name,unit,category")
        .eq("company_id", worker.company_id)
        .order("name", { ascending: true });
      if (!error) materials = normalizeWorkerMaterialList(data || []);
    }

    workerMaterialOptions = materials;
  } catch (e) {
    workerMaterialOptions = normalizeWorkerMaterialList(permissionNames);
  }

  refreshWorkerMaterialSelect(selectedValue);
  refreshMaterialEntrySelectors();
  refreshSiteLogSelectors();
}

function refreshOneMaterialEntrySelect(entryEl) {
  const sel = entryEl.querySelector(".mat-select");
  if (!sel) return;
  const old = sel.value || "";
  sel.innerHTML = buildWorkerMaterialOptionsHtml(old);
  if (old && Array.from(sel.options).some(o => o.value === old)) sel.value = old;
}

function refreshMaterialEntrySelectors() {
  $$("#materialEntries .material-entry").forEach(entryEl => refreshOneMaterialEntrySelect(entryEl));
}



function formatMaterialCalcNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  const rounded = Math.round(n * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
}

function calculateMaterialTotal(tours, perTour) {
  const t = parseDecimalInput(tours);
  const p = parseDecimalInput(perTour);
  if (!t || !p) return "";
  return formatMaterialCalcNumber(t * p);
}

function materialQuantityValue(m = {}) {
  return m.total_quantity || m.calculated_quantity || m.quantity || m.qty || "";
}

function materialUnitValue(m = {}) {
  return m.unit || m.measure_unit || "";
}

function materialCalcText(m = {}) {
  const tours = m.tours || m.material_tours || "";
  const perTour = m.per_tour || m.quantity_per_tour || m.material_per_tour || "";
  const unit = materialUnitValue(m);
  const total = materialQuantityValue(m);
  if (!tours && !perTour) return "";
  return `${tours || "0"} tura × ${perTour || "0"}${unit ? " " + unit : ""} = ${total || "0"}${unit ? " " + unit : ""}`;
}

function updateMaterialCalculation(entryEl) {
  if (!entryEl) return;
  const toursEl = entryEl.querySelector(".mat-tours");
  const perTourEl = entryEl.querySelector(".mat-per-tour");
  const qtyEl = entryEl.querySelector(".mat-qty");
  const hint = entryEl.querySelector(".mat-calc-hint");
  const total = calculateMaterialTotal(toursEl?.value || "", perTourEl?.value || "");
  if (total && qtyEl && (!qtyEl.value || qtyEl.dataset.autoMaterialQty === "1")) {
    qtyEl.value = total;
    qtyEl.dataset.autoMaterialQty = "1";
  }
  if (qtyEl && !total && qtyEl.dataset.autoMaterialQty === "1") {
    qtyEl.value = "";
    qtyEl.dataset.autoMaterialQty = "0";
  }
  const unitSelect = entryEl.querySelector(".mat-unit")?.value || "";
  const unitManual = entryEl.querySelector(".mat-unit-manual")?.value.trim() || "";
  const selectedDefaultUnit = entryEl.querySelector(".mat-select")?.selectedOptions?.[0]?.dataset?.unit || "";
  const unit = unitSelect === "ručno" ? unitManual : (unitSelect || selectedDefaultUnit || "");
  if (hint) {
    hint.textContent = total
      ? `Obračun materijala: ${toursEl?.value || 0} tura × ${perTourEl?.value || 0}${unit ? " " + unit : ""} = ${total}${unit ? " " + unit : ""}.`
      : "Za materijal: upiši broj tura i količinu po turi. Gorivo se ovde ne računa i ne sabira.";
  }
}

function buildMaterialUnitOptionsHtml(selectedValue = "") {
  const selected = String(selectedValue || "").trim();
  const units = [
    { value: "", label: "Odaberi meru" },
    { value: "t", label: "t — tona" },
    { value: "m³", label: "m³ — kubik" },
    { value: "kg", label: "kg" },
    { value: "m", label: "m — metar" },
    { value: "m²", label: "m² — kvadrat" },
    { value: "kom", label: "kom — komad" },
    { value: "paleta", label: "paleta" },
    { value: "kamion", label: "kamion" },
    { value: "tura", label: "tura" },
    { value: "ručno", label: "druga mera" }
  ];
  return units.map(u => `<option value="${escapeHtml(u.value)}" ${selected === u.value ? "selected" : ""}>${escapeHtml(u.label)}</option>`).join("");
}

function updateMaterialUnitManualVisibility(entryEl) {
  if (!entryEl) return;
  const sel = entryEl.querySelector(".mat-unit");
  const manualWrap = entryEl.querySelector(".mat-unit-manual-wrap");
  if (!sel || !manualWrap) return;
  manualWrap.classList.toggle("hidden", sel.value !== "ručno");
}

function addMaterialEntry(values = {}) {
  const list = $("#materialEntries");
  if (!list) return;
  const idx = list.querySelectorAll(".material-entry").length + 1;
  const action = values.action || values.material_action || values.type || "ulaz";
  const selectedMaterial = values.material || values.name || "";
  const manualMaterial = values.material_custom || values.manual || "";
  const savedUnit = values.unit || values.measure || values.measure_unit || "";
  const isKnownUnit = ["", "t", "m³", "kg", "m", "m²", "kom", "paleta", "kamion", "tura"].includes(savedUnit);
  const unitSelectValue = isKnownUnit ? savedUnit : (savedUnit ? "ručno" : "");
  const unitManualValue = isKnownUnit ? "" : savedUnit;
  const div = document.createElement("div");
  div.className = "entry-card material-entry";
  div.innerHTML = `
    <div class="entry-card-head">
      <strong>Materijal ${idx}</strong>
      <button type="button" class="remove-entry">Ukloni</button>
    </div>

    <label>Radnja sa materijalom</label>
    <select class="mat-action">
      <option value="ulaz" ${action === "ulaz" ? "selected" : ""}>Ulaz materijala na gradilište</option>
      <option value="izlaz" ${action === "izlaz" ? "selected" : ""}>Izlaz materijala sa gradilišta</option>
      <option value="ugradnja" ${action === "ugradnja" ? "selected" : ""}>Ugradnja materijala</option>
    </select>

    <label>Vrsta materijala iz Uprave</label>
    <select class="mat-select"></select>

    <label>Van evidencije ako nije u listi</label>
    <input class="mat-manual" placeholder="npr. kamen 0-31, pesak, rizla..." value="${escapeHtml(manualMaterial)}" />

    <div class="mini-grid">
      <div>
        <label>Broj izvršenih tura <span class="muted">(materijal)</span></label>
        <input class="mat-tours numeric-text" type="text" inputmode="decimal" autocomplete="off" placeholder="npr. 6" value="${escapeHtml(values.tours || values.material_tours || "")}" />
      </div>
      <div>
        <label>Količina po turi</label>
        <input class="mat-per-tour numeric-text" type="text" inputmode="decimal" autocomplete="off" placeholder="npr. 8" value="${escapeHtml(values.per_tour || values.quantity_per_tour || values.material_per_tour || "")}" />
      </div>
      <div>
        <label>Ukupna količina</label>
        <input class="mat-qty numeric-text" type="text" inputmode="decimal" autocomplete="off" placeholder="npr. 48" value="${escapeHtml(values.total_quantity || values.calculated_quantity || values.quantity || values.qty || "")}" />
      </div>
      <div>
        <label>Jedinica mere</label>
        <select class="mat-unit">${buildMaterialUnitOptionsHtml(unitSelectValue)}</select>
      </div>
      <div class="mat-unit-manual-wrap hidden">
        <label>Ručna mera</label>
        <input class="mat-unit-manual" placeholder="npr. džak, bala, set..." value="${escapeHtml(unitManualValue)}" />
      </div>
      <div>
        <label>Napomena <span class="muted">(opciono)</span></label>
        <input class="mat-note" placeholder="npr. dovezao Marko / vraćeno u bazu" value="${escapeHtml(values.note || "")}" />
      </div>
    </div>
    <p class="field-hint mat-calc-hint">Za materijal: upiši broj tura i količinu po turi. Gorivo se ovde ne računa i ne sabira.</p>
  `;
  div.querySelector(".remove-entry").addEventListener("click", () => { div.remove(); renumberMaterialEntries(); });
  div.querySelector(".mat-unit")?.addEventListener("change", () => { updateMaterialUnitManualVisibility(div); updateMaterialCalculation(div); });
  div.querySelector(".mat-unit-manual")?.addEventListener("input", () => updateMaterialCalculation(div));
  div.querySelector(".mat-select")?.addEventListener("change", () => fillMaterialEntryUnitFromSelect(div, true));
  div.querySelector(".mat-tours")?.addEventListener("input", () => updateMaterialCalculation(div));
  div.querySelector(".mat-per-tour")?.addEventListener("input", () => updateMaterialCalculation(div));
  div.querySelector(".mat-qty")?.addEventListener("input", (ev) => { ev.currentTarget.dataset.autoMaterialQty = "0"; updateMaterialCalculation(div); });
  updateMaterialUnitManualVisibility(div);
  list.appendChild(div);
  preventNumberInputScrollChanges(div);
  refreshOneMaterialEntrySelect(div);
  if (selectedMaterial) {
    const sel = div.querySelector(".mat-select");
    if (Array.from(sel.options).some(o => o.value === selectedMaterial)) sel.value = selectedMaterial;
  }
  fillMaterialEntryUnitFromSelect(div);
  updateMaterialCalculation(div);
}

function renumberMaterialEntries() {
  $$("#materialEntries .material-entry").forEach((card, i) => {
    const title = card.querySelector(".entry-card-head strong");
    if (title) title.textContent = `Materijal ${i + 1}`;
  });
}

function getMaterialEntries() {
  return $$("#materialEntries .material-entry").map((el, i) => {
    const action = el.querySelector(".mat-action")?.value || "";
    const selected = el.querySelector(".mat-select")?.value || "";
    const manual = el.querySelector(".mat-manual")?.value.trim() || "";
    const select = el.querySelector(".mat-select");
    const option = select?.options ? select.options[select.selectedIndex] : null;
    const materialName = manual || selected;
    const unitSelect = el.querySelector(".mat-unit")?.value || "";
    const unitManual = el.querySelector(".mat-unit-manual")?.value.trim() || "";
    const selectedMaterialDefaultUnit = option?.dataset?.unit || "";
    const finalUnit = unitSelect === "ručno" ? unitManual : (unitSelect || selectedMaterialDefaultUnit || "");
    const tours = el.querySelector(".mat-tours")?.value.trim() || "";
    const perTour = el.querySelector(".mat-per-tour")?.value.trim() || "";
    const calculatedQuantity = calculateMaterialTotal(tours, perTour);
    const quantity = el.querySelector(".mat-qty")?.value.trim() || calculatedQuantity || "";
    return {
      no: i + 1,
      action,
      material_action: action,
      material: materialName,
      name: materialName,
      material_id: manual ? null : (option?.dataset?.materialId || null),
      material_custom: manual,
      tours,
      material_tours: tours,
      per_tour: perTour,
      quantity_per_tour: perTour,
      calculated_quantity: calculatedQuantity,
      total_quantity: quantity,
      quantity,
      unit: finalUnit,
      measure_unit: finalUnit,
      calc_text: materialCalcText({ tours, per_tour: perTour, quantity, unit: finalUnit }),
      note: el.querySelector(".mat-note")?.value.trim() || ""
    };
  }).filter(m => m.action || m.material || m.quantity || m.tours || m.per_tour || m.note);
}


const WORKER_MODULE_DEFINITIONS = [
  {
    value: "worker_hours",
    label: "Radni izveštaj / radni sati",
    requiredPerms: ["workers"],
    sectionKeys: ["workers", "signature"],
    needsMainSite: true,
    reportType: "worker_hours"
  },
  {
    value: "machine_work",
    label: "Rad mašine / MTČ",
    requiredPerms: ["machines"],
    sectionKeys: ["machines", "signature"],
    // v2.1: Bagerista može u toku dana raditi na više gradilišta.
    // Zato gradilište više nije jedno glavno polje, nego se bira u svakoj stavki mašine.
    needsMainSite: false,
    reportType: "machine_work_daily"
  },
  {
    value: "truck_tours",
    label: "Vožnja / ture / materijal",
    requiredPerms: ["vehicles"],
    // v2.1: Vozač može imati više gradilišta u jednom dnevnom izveštaju.
    // Materijal se unosi u samoj stavci vozila, da Direkcija može čistije da razvrsta po gradilištu.
    sectionKeys: ["vehicles", "signature"],
    needsMainSite: false,
    reportType: "truck_tours_daily"
  },
  {
    value: "fuel_entry",
    label: "⛽ Gorivo odmah",
    requiredPerms: ["fuel"],
    sectionKeys: ["fuel"],
    needsMainSite: false,
    reportType: "fuel_entry"
  },
  {
    value: "field_tanker",
    label: "Cisterna goriva",
    requiredPerms: ["field_tanker"],
    sectionKeys: ["field_tanker"],
    needsMainSite: false,
    reportType: "field_tanker_daily_batch"
  },
  {
    value: "lowloader",
    label: "Labudica / transport mašine",
    requiredPerms: ["lowloader"],
    sectionKeys: ["lowloader"],
    needsMainSite: false,
    reportType: "lowloader_transport"
  },
  {
    value: "water_tanker",
    label: "Cisterna za vodu",
    requiredPerms: ["water_tanker"],
    sectionKeys: ["water_tanker"],
    needsMainSite: false,
    reportType: "water_tanker_daily"
  },
  {
    value: "defect_report",
    label: "Prijava kvara",
    requiredPerms: ["defects"],
    sectionKeys: ["defects"],
    needsMainSite: false,
    reportType: "defect_report"
  },
  {
    value: "leave_request",
    label: "Slobodan dan / godišnji odmor",
    requiredPerms: ["leave_request"],
    sectionKeys: ["leave_request"],
    needsMainSite: false,
    reportType: "leave_request"
  },
  {
    value: "warehouse",
    label: "Magacin",
    requiredPerms: ["warehouse"],
    sectionKeys: ["warehouse"],
    needsMainSite: false,
    reportType: "warehouse_movement"
  },
  {
    value: "material_entry",
    label: "Materijal",
    requiredPerms: ["materials"],
    sectionKeys: ["materials", "signature"],
    needsMainSite: true,
    reportType: "material_movement"
  }
];

function getAllowedWorkerModules(perms = {}) {
  const normalized = normalizePermissions(perms);
  return WORKER_MODULE_DEFINITIONS.filter(module => module.requiredPerms.some(key => !!normalized[key]));
}

function getSelectedWorkerModule() {
  const value = $("#wrModuleSelect")?.value || "";
  return WORKER_MODULE_DEFINITIONS.find(m => m.value === value) || null;
}

function updateWorkerSubmitButtonLabel() {
  const btn = $("#submitReportBtn");
  const module = getSelectedWorkerModule();
  if (!btn || !module) return;
  const labels = {
    fuel_entry: "⛽ Pošalji gorivo odmah",
    field_tanker_daily_batch: "⛽ Pošalji evidenciju cisterne odmah",
    defect_report: "Pošalji prijavu kvara",
    worker_hours: "Pošalji dnevni izveštaj",
    machine_work_daily: "Pošalji dnevni izveštaj",
    truck_tours_daily: "Pošalji dnevni izveštaj"
  };
  btn.textContent = labels[module.reportType] || "Pošalji Upravi";
}

function activeWorkerSectionKeys(perms = {}) {
  const module = getSelectedWorkerModule();
  if (!module) return new Set();
  const normalized = normalizePermissions(perms);
  const keys = new Set(module.sectionKeys.filter(key => !!normalized[key]));
  if (module.needsMainSite && (normalized.daily_work || normalized.daily_work_site || true)) keys.add("daily_work");
  return keys;
}

function workerReportTypeFromSelection() {
  return getSelectedWorkerModule()?.reportType || "";
}

function workerModuleValueFromReportType(reportType = "") {
  const type = String(reportType || "").trim();
  const found = WORKER_MODULE_DEFINITIONS.find(m => m.reportType === type);
  return found?.value || "";
}

function refreshWorkerModuleSelector(perms = {}) {
  const select = $("#wrModuleSelect");
  const hint = $("#wrModuleHint");
  if (!select) return;
  const allowed = getAllowedWorkerModules(perms);
  const previous = select.value;
  select.innerHTML = `<option value="">Izaberi rubriku...</option>` + allowed.map(m => `<option value="${escapeHtml(m.value)}">${escapeHtml(m.label)}</option>`).join("");
  if (allowed.length === 1) select.value = allowed[0].value;
  else if (allowed.some(m => m.value === previous)) select.value = previous;
  else select.value = "";
  if (hint) hint.textContent = "";
  applyWorkerModuleSelection({ addDefaults: false });
  updateWorkerSubmitButtonLabel();
}

function applyWorkerModuleSelection({ addDefaults = true } = {}) {
  const perms = currentWorker?.permissions || {};
  workerSetSections(perms);
  const module = getSelectedWorkerModule();
  const hint = $("#wrModuleHint");
  if (hint && module) hint.textContent = "";
  updateWorkerSubmitButtonLabel();
  if (!module || !addDefaults) return;
  if (module.value === "worker_hours" && $("#workerEntries") && !$("#workerEntries").children.length) addWorkerEntry();
  if (module.value === "machine_work" && $("#machineEntries") && !$("#machineEntries").children.length) addMachineEntry();
  if (module.value === "truck_tours" && $("#vehicleEntries") && !$("#vehicleEntries").children.length) addVehicleEntry();
  if (module.value === "fuel_entry" && $("#fuelEntries") && !$("#fuelEntries").children.length) addFuelEntry();
  if (module.value === "field_tanker" && $("#fieldTankerEntries") && !$("#fieldTankerEntries").children.length) addFieldTankerEntry();
  if (module.value === "lowloader" && $("#lowloaderEntries") && !$("#lowloaderEntries").children.length) addLowloaderEntry();
  if (module.value === "water_tanker" && $("#waterTankerEntries") && !$("#waterTankerEntries").children.length) addWaterTankerEntry();
  if ((module.value === "truck_tours" || module.value === "material_entry") && $("#materialEntries") && !$("#materialEntries").children.length && perms.materials) addMaterialEntry();
  updateLeaveRequestVisibility();
}

function ensureWorkerModuleSelected() {
  const select = $("#wrModuleSelect");
  if (!select || select.value) return true;
  const allowed = getAllowedWorkerModules(currentWorker?.permissions || {});
  if (allowed.length === 1) {
    select.value = allowed[0].value;
    applyWorkerModuleSelection({ addDefaults: true });
    return true;
  }
  return false;
}

function workerSetSections(perms) {
  // Stabilizacija unosa: Direkcija dodeljuje dozvoljene funkcije, ali zaposleni iz menija bira samo jednu rubriku koju sada popunjava.
  // Time se zahtev za odsustvo, kvar, gorivo i radni izveštaj više ne prikazuju i ne šalju zajedno bez potrebe.
  const activeKeys = activeWorkerSectionKeys(perms);

  const dailySection = $("#secDailyWork");
  if (dailySection) {
    dailySection.classList.remove("active");
    dailySection.classList.add("hidden-by-rule");
  }

  const siteSection = $("#secWorkerSite");
  if (siteSection) siteSection.classList.toggle("active", activeKeys.has("daily_work"));

  const map = {
    workers: "#secWorkers",
    machines: "#secMachines",
    vehicles: "#secVehicles",
    lowloader: "#secLowloader",
    water_tanker: "#secWaterTanker",
    fuel: "#secFuel",
    field_tanker: "#secFieldTanker",
    materials: "#secMaterials",
    signature: "#secSignature",
    leave_request: "#secLeaveRequest",
    warehouse: "#secWarehouse",
    defects: "#secDefects"
  };
  Object.entries(map).forEach(([key, sel]) => {
    const el = $(sel);
    if (el) el.classList.toggle("active", activeKeys.has(key));
  });

  const module = getSelectedWorkerModule();
  const draftBtn = $("#saveDraftBtn");
  if (draftBtn) draftBtn.classList.toggle("hidden", module?.value === "field_tanker");
}



function addWorkerEntry(values = {}) {
  const list = $("#workerEntries");
  if (!list) return;
  const idx = list.querySelectorAll(".worker-entry").length + 1;
  const div = document.createElement("div");
  div.className = "entry-card worker-entry";
  div.innerHTML = `
    <h5>Zaposleni ${idx}</h5>
    <div class="grid two">
      <div>
        <label>Ime</label>
        <input class="worker-first" placeholder="Ime zaposlenog" value="${escapeHtml(values.first_name || values.first || "")}" />
      </div>
      <div>
        <label>Prezime</label>
        <input class="worker-last" placeholder="Prezime zaposlenog" value="${escapeHtml(values.last_name || values.last || "")}" />
      </div>
    </div>
    <label>Sati rada tog dana</label>
    <input class="worker-hours numeric-text" type="text" inputmode="decimal" placeholder="8" value="${escapeHtml(values.hours || "")}" />
    <button class="secondary small-btn" type="button" onclick="this.closest('.worker-entry').remove(); renumberWorkerEntries();">Ukloni zaposlenog</button>
  `;
  list.appendChild(div);
}

function renumberWorkerEntries() {
  $$("#workerEntries .worker-entry").forEach((card, i) => {
    const h = card.querySelector("h5");
    if (h) h.textContent = `Zaposleni ${i + 1}`;
  });
}

function getWorkerEntries() {
  return $$("#workerEntries .worker-entry").map(card => {
    const first = card.querySelector(".worker-first")?.value.trim() || "";
    const last = card.querySelector(".worker-last")?.value.trim() || "";
    const hours = card.querySelector(".worker-hours")?.value.trim() || "";
    return {
      first_name: first,
      last_name: last,
      full_name: [first, last].filter(Boolean).join(" "),
      hours
    };
  }).filter(w => w.first_name || w.last_name || w.hours);
}

function addMachineEntry(values = {}) {
  const list = $("#machineEntries");
  if (!list) return;
  const idx = list.querySelectorAll(".machine-entry").length + 1;
  const div = document.createElement("div");
  div.className = "entry-card machine-entry";
  const initialSearch = values.asset_code || values.machine_code || values.code || values.custom || values.machine_custom || values.name || "";
  div.innerHTML = `
    <div class="entry-card-head">
      <strong>Mašina ${idx}</strong>
      <button type="button" class="remove-entry">Ukloni</button>
    </div>

    <label>Mašina / interni broj</label>
    <input class="m-search asset-code-search smart-asset-input" placeholder="upiši broj ili naziv mašine, npr. 1 ili CAT 330" value="${escapeHtml(initialSearch)}" />
    <div class="asset-smart-result m-picked">Upiši broj mašine iz Uprave ili naziv ako nije na listi.</div>
    <button class="secondary small-btn refresh-machine-assets" type="button">Osveži mašine iz Uprave</button>

    <select class="m-name hidden-asset-select" aria-hidden="true" tabindex="-1">${buildMachineOptionsHtml(values.name || "")}</select>
    <input class="m-custom hidden-asset-custom" aria-hidden="true" tabindex="-1" value="${escapeHtml(values.custom || values.machine_custom || "")}" />

    <label>Gradilište za ovu stavku</label>
    <select class="m-site entry-site-select">${buildLowloaderSiteOptionsHtml(values.site_name || values.site || "")}</select>
    <p class="field-hint">Ako si danas radio na više gradilišta, dodaj novu stavku za svako gradilište. MTČ se sabira u jednom dnevnom izveštaju.</p>

    <div class="machine-meter-grid">
      <div class="meter-box meter-box-km">
        <strong>KM / dolazak i odlazak</strong>
        <p class="field-hint">Za dizalicu na točkovima, kamion ili sredstvo koje se obračunava po pređenom kilometru.</p>
        <div class="mini-grid">
          <div>
            <label>KM početak</label>
            <input class="m-km-start numeric-text" type="text" inputmode="decimal" placeholder="npr. 12400" value="${escapeHtml(values.km_start || values.machine_km_start || "")}" />
          </div>
          <div>
            <label>KM kraj</label>
            <input class="m-km-end numeric-text" type="text" inputmode="decimal" placeholder="npr. 12435" value="${escapeHtml(values.km_end || values.machine_km_end || "")}" />
          </div>
        </div>
        <label>Ukupno KM</label>
        <input class="m-km-total numeric-text" type="text" inputmode="decimal" placeholder="automatski ili upiši" value="${escapeHtml(values.km_total || values.machine_km_total || "")}" />
      </div>

      <div class="meter-box meter-box-mtc">
        <strong>MTČ / rad na gradilištu</strong>
        <p class="field-hint">Za stvarni rad mašine na gradilištu. Ovo ne mešamo sa kilometrima.</p>
        <div class="mini-grid">
          <div>
            <label>MTČ početak</label>
            <input class="m-mtc-start m-start numeric-text" type="text" inputmode="decimal" placeholder="npr. 1250.5" value="${escapeHtml(values.mtc_start || values.machine_mtc_start || values.start || "")}" />
          </div>
          <div>
            <label>MTČ kraj</label>
            <input class="m-mtc-end m-end numeric-text" type="text" inputmode="decimal" placeholder="npr. 1258.5" value="${escapeHtml(values.mtc_end || values.machine_mtc_end || values.end || "")}" />
          </div>
        </div>
        <label>Ukupno MTČ / sati rada</label>
        <input class="m-mtc-total m-hours numeric-text" type="text" inputmode="decimal" placeholder="automatski ili upiši" value="${escapeHtml(values.mtc_total || values.machine_mtc_total || values.hours || "")}" />
      </div>
    </div>

    <label>Opis rada za ovu mašinu</label>
    <input class="m-work" placeholder="iskop, utovar, ravnanje..." value="${escapeHtml(values.work || "")}" />
  `;

  const kmStartEl = div.querySelector(".m-km-start");
  const kmEndEl = div.querySelector(".m-km-end");
  const kmTotalEl = div.querySelector(".m-km-total");
  const startEl = div.querySelector(".m-start");
  const endEl = div.querySelector(".m-end");
  const hoursEl = div.querySelector(".m-hours");

  function calcPair(startInput, endInput, totalInput, decimals = 1) {
    const s = parseFloat(String(startInput?.value || "").replace(",", "."));
    const e = parseFloat(String(endInput?.value || "").replace(",", "."));
    if (!Number.isNaN(s) && !Number.isNaN(e) && e >= s && totalInput) {
      const pow = Math.pow(10, decimals);
      const v = Math.round((e - s) * pow) / pow;
      totalInput.value = Number.isInteger(v) ? String(v) : String(v);
    }
  }
  const calcKm = () => calcPair(kmStartEl, kmEndEl, kmTotalEl, 1);
  const calcHours = () => calcPair(startEl, endEl, hoursEl, 1);

  if (kmStartEl) kmStartEl.addEventListener("input", calcKm);
  if (kmEndEl) kmEndEl.addEventListener("input", calcKm);
  startEl.addEventListener("input", calcHours);
  endEl.addEventListener("input", calcHours);

  div.querySelector(".remove-entry").addEventListener("click", () => {
    div.remove();
    refreshFuelMachineOptions();
  });

  const machineSearch = div.querySelector(".m-search");
  const machineSelect = div.querySelector(".m-name");
  const machineCustom = div.querySelector(".m-custom");
  if (machineSearch) machineSearch.addEventListener("input", () => refreshOneMachineSelect(div));
  if (machineSelect) machineSelect.addEventListener("change", refreshFuelMachineOptions);
  if (machineCustom) machineCustom.addEventListener("input", refreshFuelMachineOptions);
  const refreshMachinesBtn = div.querySelector(".refresh-machine-assets");
  if (refreshMachinesBtn) refreshMachinesBtn.addEventListener("click", async () => {
    try {
      refreshMachinesBtn.disabled = true;
      refreshMachinesBtn.textContent = "Učitavam...";
      await loadWorkerAssets();
      refreshOneMachineSelect(div);
      toast(workerAssetOptions.length ? "Mašine/vozila iz Uprave su osvežene." : "Nema učitanih mašina/vozila. Proveri firmu zaposlenog i listu u Upravi.", !workerAssetOptions.length);
    } finally {
      refreshMachinesBtn.disabled = false;
      refreshMachinesBtn.textContent = "Osveži mašine iz Uprave";
    }
  });
  list.appendChild(div);
  preventNumberInputScrollChanges(div);
  refreshOneMachineSelect(div);
  refreshFuelMachineOptions();
}

function getMachineEntries() {
  return $$("#machineEntries .machine-entry").map((el, i) => {
    const select = el.querySelector(".m-name");
    const selected = select?.value.trim() || "";
    const option = select?.options ? select.options[select.selectedIndex] : null;
    const custom = el.querySelector(".m-custom")?.value.trim() || "";
    const kmStart = el.querySelector(".m-km-start")?.value || "";
    const kmEnd = el.querySelector(".m-km-end")?.value || "";
    const kmTotal = el.querySelector(".m-km-total")?.value || "";
    const mtcStart = el.querySelector(".m-start")?.value || "";
    const mtcEnd = el.querySelector(".m-end")?.value || "";
    const mtcTotal = el.querySelector(".m-hours")?.value || "";
    return {
      no: i + 1,
      asset_id: custom ? null : (option?.dataset?.assetId || null),
      asset_code: custom ? "" : (option?.dataset?.assetCode || ""),
      machine_code: custom ? "" : (option?.dataset?.assetCode || ""),
      name: custom || selected,
      machine_custom: custom,
      ...getWorkerSiteOptionPayload(el.querySelector(".m-site")),
      km_start: kmStart,
      km_end: kmEnd,
      km_total: kmTotal,
      mtc_start: mtcStart,
      mtc_end: mtcEnd,
      mtc_total: mtcTotal,
      // Backward compatibility: stari delovi aplikacije i stari izveštaji čitaju start/end/hours kao MTČ.
      start: mtcStart,
      end: mtcEnd,
      hours: mtcTotal,
      work: el.querySelector(".m-work")?.value.trim() || ""
    };
  }).filter(m => m.name || m.site_name || m.km_start || m.km_end || m.km_total || m.mtc_start || m.mtc_end || m.mtc_total || m.start || m.end || m.hours || m.work);
}


function addLowloaderEntry(values = {}) {
  const list = $("#lowloaderEntries");
  if (!list) return;
  const idx = list.querySelectorAll(".lowloader-entry").length + 1;
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}-${idx}`;
  const div = document.createElement("div");
  div.className = "entry-card lowloader-entry";
  const kmStart = values.km_start || values.start_km || values.odometer_start || "";
  const kmEnd = values.km_end || values.end_km || values.odometer_end || "";
  const kmTotal = values.km_total || values.km || "";
  const fromSite = values.from_site || values.from_address || values.from || "";
  const toSite = values.to_site || values.to_address || values.to || "";
  div.innerHTML = `
    <div class="entry-card-head">
      <strong>Selidba mašine ${idx}</strong>
      <button type="button" class="remove-entry">Ukloni</button>
    </div>

    <label>Broj tablica labudice</label>
    <input class="ll-plates" placeholder="npr. BG-123-AA" value="${escapeHtml(values.plates || values.registration || "")}" />

    <div class="grid two">
      <div>
        <label>Gradilište sa kog preuzima mašinu</label>
        <select class="ll-from">${buildLowloaderSiteOptionsHtml(fromSite)}</select>
      </div>
      <div>
        <label>Gradilište gde vozi mašinu</label>
        <select class="ll-to">${buildLowloaderSiteOptionsHtml(toSite)}</select>
      </div>
    </div>

    <div class="grid three">
      <div>
        <label>Početna kilometraža</label>
        <input class="ll-km-start numeric-text" type="text" inputmode="decimal" placeholder="npr. 125000" value="${escapeHtml(kmStart)}" />
      </div>
      <div>
        <label>Završna kilometraža</label>
        <input class="ll-km-end numeric-text" type="text" inputmode="decimal" placeholder="npr. 125042" value="${escapeHtml(kmEnd)}" />
      </div>
      <div>
        <label>Ukupno kilometara</label>
        <input class="ll-km numeric-text" type="text" inputmode="decimal" placeholder="automatski" value="${escapeHtml(kmTotal)}" readonly />
      </div>
    </div>
    <p class="field-hint">Ukupno kilometara se računa automatski: završna kilometraža minus početna kilometraža.</p>

    <label>Mašina koju seliš</label>
    <select class="ll-machine">${buildLowloaderMachineOptionsHtml(values.machine || values.machine_name || values.machine_custom || values.manual_machine || "")}</select>
    <p class="field-hint">Izaberi mašinu iz evidencije Uprave. Ako se mašina ne vidi, prvo proveri da li je dodata u Sredstva rada i da li je tip podešen kao mašina.</p>

    <label>Prateći alat uz mašinu <span class="muted">(opciono)</span></label>
    <textarea class="ll-tools" rows="2" placeholder="npr. kašika 80 cm, pikamer, creva, lanci, nastavci...">${escapeHtml(values.accompanying_tools || values.tools || values.machine_tools || values.note_tools || "")}</textarea>
    <p class="field-hint">Upiši alat ili dodatnu opremu koja ide uz mašinu, da Uprava kasnije zna šta je prevezeno zajedno sa njom.</p>
  `;

  div.querySelector(".remove-entry").addEventListener("click", () => {
    div.remove();
    renumberLowloaderEntries();
  });
  div.querySelectorAll(".ll-km-start, .ll-km-end").forEach(input => {
    input.addEventListener("input", () => updateLowloaderKmTotal(div));
    input.addEventListener("change", () => updateLowloaderKmTotal(div));
  });
  list.appendChild(div);
  preventNumberInputScrollChanges(div);
  updateLowloaderKmTotal(div);
  refreshOneLowloaderMachineSelect(div);
}

function renumberLowloaderEntries() {
  $$("#lowloaderEntries .lowloader-entry").forEach((card, i) => {
    const h = card.querySelector("strong");
    if (h) h.textContent = `Selidba mašine ${i + 1}`;
  });
}

function getLowloaderEntries() {
  return $$("#lowloaderEntries .lowloader-entry").map((el, i) => {
    const plates = el.querySelector(".ll-plates")?.value.trim() || "";
    const from = el.querySelector(".ll-from")?.value.trim() || "";
    const to = el.querySelector(".ll-to")?.value.trim() || "";
    const kmStart = el.querySelector(".ll-km-start")?.value.trim() || "";
    const kmEnd = el.querySelector(".ll-km-end")?.value.trim() || "";
    updateLowloaderKmTotal(el);
    const km = el.querySelector(".ll-km")?.value.trim() || "";
    const machine = el.querySelector(".ll-machine")?.value.trim() || "";
    const tools = el.querySelector(".ll-tools")?.value.trim() || "";
    const customMachine = machine;
    return {
      no: i + 1,
      plates,
      registration: plates,
      from_site: from,
      to_site: to,
      from_address: from,
      to_address: to,
      km_start: kmStart,
      km_end: kmEnd,
      km_total: km,
      machine,
      machine_custom: customMachine,
      accompanying_tools: tools,
      tools
    };
  }).filter(x => x.plates || x.from_address || x.to_address || x.km_start || x.km_end || x.km_total || x.machine || x.accompanying_tools);
}


function buildFieldTankerSiteOptionsHtml(selectedValue = "") {
  const selected = String(selectedValue || "").trim().toLowerCase();
  if (!workerSiteOptions.length) return `<option value="">Nema gradilišta iz Uprave</option>`;
  return `<option value="">Odaberi gradilište</option>` + workerSiteOptions.map(site => {
    const name = site.name || "Gradilište";
    const loc = site.location ? ` · ${site.location}` : "";
    const isSelected = selected && String(name).trim().toLowerCase() === selected ? "selected" : "";
    return `<option value="${escapeHtml(name)}" data-site-id="${escapeHtml(site.id || "")}" ${isSelected}>${escapeHtml(name + loc)}</option>`;
  }).join("");
}

function buildFieldTankerAssetOptionsHtml(kind = "machine", selectedValue = "", searchValue = "") {
  const selected = String(selectedValue || "").trim();
  let allAssets = (workerAssetOptions || [])
    .filter(asset => filterAssetsByFuelKind(asset, kind))
    .filter(asset => getAssetCode(asset) || getAssetName(asset) || getAssetRegistration(asset));
  let assets = allAssets.filter(asset => machineMatchesSearch(asset, searchValue));
  const q = normalizeVehicleSearch(searchValue);

  // v1.19.8: ako je upisan tačan broj, automatski prikaži sredstvo iako je stari filter tipa kočio listu.
  const exact = findAssetByExactCode(searchValue);
  if (exact) {
    const exactKind = getCanonicalAssetKind(exact);
    if (exactKind === kind && !assets.some(a => String(a.id || "") === String(exact.id || ""))) {
      assets = [exact, ...assets];
    }
  }
  if (q && !assets.length) {
    assets = findAssetsByUniversalSearch(searchValue);
  }

  if (!workerAssetOptions.length) {
    return `<option value="">Nema sredstava iz Uprave</option>`;
  }
  if (!assets.length) {
    return `<option value="">Nema sredstva za taj broj/pretragu</option>`;
  }

  return `<option value="">${fuelKindChooseText(kind)}</option>` + assets.map(asset => assetOptionHtml(asset, selected, a => formatFuelKindAssetLabel(a, getCanonicalAssetKind(a)))).join("");
}


function buildFieldTankerCisternVehicleOptionsHtml(selectedValue = "", searchValue = "") {
  const selected = String(selectedValue || "").trim();
  let allVehicles = (workerAssetOptions || [])
    .filter(isVehicleAsset)
    .filter(asset => getAssetCode(asset) || getAssetName(asset) || getAssetRegistration(asset));
  let vehicles = allVehicles.filter(asset => machineMatchesSearch(asset, searchValue));
  const q = normalizeVehicleSearch(searchValue);
  const exact = findAssetByExactCode(searchValue);
  if (exact && isVehicleAsset(exact) && !vehicles.some(a => String(a.id || "") === String(exact.id || ""))) {
    vehicles = [exact, ...vehicles];
  }
  if (q && !vehicles.length) {
    vehicles = findAssetsByUniversalSearch(searchValue).filter(isVehicleAsset);
  }
  if (!workerAssetOptions.length) return `<option value="">Nema vozila iz Uprave</option>`;
  if (!vehicles.length) return `<option value="">Nema cisterne/vozila za taj broj ili tablice</option>`;
  return `<option value="">Odaberi cisternu / vozilo</option>` + vehicles.map(asset => assetOptionHtml(asset, selected, formatAssetLabel)).join("");
}

function findFieldTankerCisternVehicleForSmartInput(searchValue) {
  const q = normalizeVehicleSearch(searchValue);
  if (!q) return null;
  const exactCode = findAssetByExactCode(searchValue);
  if (exactCode && isVehicleAsset(exactCode)) return exactCode;
  const vehicles = (workerAssetOptions || [])
    .filter(isVehicleAsset)
    .filter(asset => getAssetCode(asset) || getAssetName(asset) || getAssetRegistration(asset));
  const exact = vehicles.find(asset => {
    const code = normalizeVehicleSearch(getAssetCode(asset));
    const name = normalizeVehicleSearch(getAssetName(asset));
    const reg = normalizeVehicleSearch(getAssetRegistration(asset));
    const label = normalizeVehicleSearch(formatAssetLabel(asset));
    return code === q || name === q || reg === q || label === q;
  });
  if (exact) return exact;
  const matches = vehicles.filter(asset => machineMatchesSearch(asset, searchValue));
  return matches.length === 1 ? matches[0] : null;
}

function updateFieldTankerCisternSmartResult(entryEl, asset, manualValue) {
  const result = entryEl.querySelector(".ft-cistern-picked");
  if (!result) return;
  if (asset) {
    const reg = getAssetRegistration(asset);
    result.className = "asset-smart-result ft-cistern-picked ok";
    result.textContent = `Pronađena cisterna iz Direkcije: ${formatAssetLabel(asset)}${reg ? ` · tablice ${reg}` : ""}`;
    return;
  }
  const value = String(manualValue || "").trim();
  if (value) {
    result.className = "asset-smart-result ft-cistern-picked warn";
    result.textContent = `Cisterna nije pronađena u vozilima Direkcije. Biće poslato ručno: ${value}`;
    return;
  }
  result.className = "asset-smart-result ft-cistern-picked";
  result.textContent = "Upiši tablice, interni broj ili naziv cisterne iz Direkcije.";
}


function getGlobalFieldTankerCisternSearchValue() {
  return $("#fieldTankerCisternSearch")?.value.trim() || getCurrentFieldTankerCisternSearchValue();
}

function updateGlobalFieldTankerCisternResult(asset, manualValue) {
  const result = $("#fieldTankerCisternPicked");
  if (!result) return;
  if (asset) {
    const reg = getAssetRegistration(asset);
    result.className = "asset-smart-result ok";
    result.textContent = `Pronađena cisterna iz Direkcije: ${formatAssetLabel(asset)}${reg ? ` · tablice ${reg}` : ""}`;
    return;
  }
  const value = String(manualValue || "").trim();
  if (value) {
    result.className = "asset-smart-result warn";
    result.textContent = `Cisterna nije pronađena u vozilima Direkcije. Biće poslato ručno: ${value}`;
    return;
  }
  result.className = "asset-smart-result";
  result.textContent = "Upiši tablice, interni broj ili naziv cisterne iz Direkcije.";
}

function refreshGlobalFieldTankerCisternSelect() {
  const searchInput = $("#fieldTankerCisternSearch");
  const select = $("#fieldTankerCisternSelect");
  const custom = $("#fieldTankerCisternCustom");
  if (!searchInput || !select) return;
  const searchNow = searchInput.value.trim();
  const asset = findFieldTankerCisternVehicleForSmartInput(searchNow);
  const selectedValue = asset ? (getAssetRegistration(asset) || getAssetCode(asset) || getAssetName(asset)) : searchNow;
  select.innerHTML = buildFieldTankerCisternVehicleOptionsHtml(selectedValue, searchNow);
  if (asset) {
    const name = getAssetName(asset) || getAssetRegistration(asset) || getAssetCode(asset) || "";
    if (Array.from(select.options).some(o => o.value === name)) select.value = name;
    if (custom) custom.value = "";
    updateGlobalFieldTankerCisternResult(asset, "");
    writeCurrentFieldTankerCistern({
      tanker_asset_id: asset.id || "",
      tanker_asset_code: getAssetCode(asset) || "",
      tanker_asset_name: getAssetName(asset) || searchNow,
      tanker_registration: getAssetRegistration(asset) || searchNow,
      tanker_vehicle: getAssetName(asset) || searchNow,
      cistern_vehicle: getAssetName(asset) || searchNow,
      cistern_registration: getAssetRegistration(asset) || searchNow
    });
  } else {
    if (custom) custom.value = searchNow;
    updateGlobalFieldTankerCisternResult(null, searchNow);
    if (searchNow) {
      writeCurrentFieldTankerCistern({
        tanker_asset_name: searchNow,
        tanker_registration: searchNow,
        tanker_vehicle: searchNow,
        cistern_vehicle: searchNow,
        cistern_registration: searchNow,
        tanker_manual_vehicle: searchNow
      });
    }
  }
}

function initGlobalFieldTankerCisternBox() {
  const input = $("#fieldTankerCisternSearch");
  if (!input) return;
  const saved = getCurrentFieldTankerCisternSearchValue();
  if (saved && !input.value) input.value = saved;
  refreshGlobalFieldTankerCisternSelect();
  input.addEventListener("input", refreshGlobalFieldTankerCisternSelect);
  input.addEventListener("change", refreshGlobalFieldTankerCisternSelect);
}

function getFieldTankerGlobalCisternData() {
  const sourceType = $("#fieldTankerSourceType")?.value || "fuel_tanker";
  const search = getGlobalFieldTankerCisternSearchValue();
  const select = $("#fieldTankerCisternSelect");
  const option = select?.options ? select.options[select.selectedIndex] : null;
  const manual = $("#fieldTankerCisternCustom")?.value.trim() || "";
  const asset = findFieldTankerCisternVehicleForSmartInput(search);
  const name = asset ? (getAssetName(asset) || search) : (manual || search);
  const reg = asset ? getAssetRegistration(asset) : (option?.dataset?.registration || search);
  return {
    tanker_asset_id: asset?.id || (manual ? null : (option?.dataset?.assetId || null)),
    tanker_asset_code: asset ? (getAssetCode(asset) || "") : (manual ? "" : (option?.dataset?.assetCode || "")),
    tanker_asset_name: name,
    tanker_asset_custom: manual,
    tanker_registration: reg,
    tanker_plates: reg,
    tanker_vehicle: name,
    tanker_vehicle_code: asset ? (getAssetCode(asset) || "") : (manual ? "" : (option?.dataset?.assetCode || "")),
    tanker_manual_vehicle: manual,
    cistern_vehicle: name,
    cistern_registration: reg,
    cistern_plates: reg,
    source_type: sourceType,
    fuel_source_type: sourceType
  };
}

function refreshFieldTankerSelectors() {
  $$("#fieldTankerEntries .field-tanker-entry").forEach(card => {
    const siteSelect = card.querySelector(".ft-site-select");
    if (siteSelect) {
      const old = siteSelect.value;
      siteSelect.innerHTML = buildFieldTankerSiteOptionsHtml(old);
      if (old && Array.from(siteSelect.options).some(o => o.value === old)) siteSelect.value = old;
    }
    const assetSelect = card.querySelector(".ft-asset-select");
    if (assetSelect) {
      const kindEl = card.querySelector(".ft-asset-kind");
      let kind = kindEl?.value || "machine";
      const search = card.querySelector(".ft-asset-search")?.value || "";
      const custom = card.querySelector(".ft-asset-custom");
      const asset = findFuelAssetForSmartInput(search, kind);
      if (asset && kindEl) {
        const exactKind = getCanonicalAssetKind(asset);
        if (exactKind && exactKind !== kind) {
          kindEl.value = exactKind;
          kind = exactKind;
        }
      }
      const selectedValue = asset ? (getAssetName(asset) || getAssetCode(asset) || getAssetRegistration(asset)) : "";
      assetSelect.innerHTML = buildFieldTankerAssetOptionsHtml(kind, selectedValue, search);
      if (asset) {
        const name = getAssetName(asset) || getAssetRegistration(asset) || getAssetCode(asset) || "";
        if (Array.from(assetSelect.options).some(o => o.value === name)) assetSelect.value = name;
        if (custom) custom.value = "";
        updateFieldTankerSmartResult(card, asset, "");
      } else {
        if (custom) custom.value = String(search || "").trim();
        updateFieldTankerSmartResult(card, null, search);
      }
    }
  });
}


function addFieldTankerEntry(values = {}) {
  const list = $("#fieldTankerEntries");
  if (!list) return;
  const savedCistern = readCurrentFieldTankerCistern();
  const hasCisternValue = !!(values.tanker_registration || values.tanker_plates || values.cistern_registration || values.cistern_plates || values.tanker_asset_code || values.tanker_vehicle_code || values.tanker_asset_name || values.tanker_vehicle || values.cistern_vehicle || values.cistern_name || values.tanker_asset_custom || values.tanker_manual_vehicle || values.cistern_custom);
  if (!hasCisternValue && Object.values(savedCistern || {}).some(v => String(v || "").trim())) {
    values = { ...values, ...savedCistern };
  }
  const idx = list.querySelectorAll(".field-tanker-entry").length + 1;
  const selectedSite = values.site_name || values.site || "";
  const selectedAsset = values.asset_name || values.machine || values.vehicle || "";
  const kind = values.asset_kind || values.asset_type || values.kind || (values.other ? "other" : (values.vehicle ? "vehicle" : "machine"));
  const oldReading = values.reading || values.mtc_km || "";
  const kmValue = values.km || values.current_km || values.kilometers || values.odometer || (kind === "vehicle" ? oldReading : "");
  const mtcValue = values.mtc || values.current_mtc || values.machine_mtc || (kind === "machine" ? oldReading : "");
  const manualAsset = values.asset_custom || values.manual_asset || values.machine_custom || values.vehicle_custom || "";
  const selectedCisternVehicle = values.tanker_asset_name || values.tanker_vehicle || values.cistern_vehicle || values.cistern_name || "";
  const manualCisternVehicle = values.tanker_asset_custom || values.tanker_manual_vehicle || values.cistern_custom || "";
  const cisternSearchValue = values.tanker_asset_code || values.tanker_vehicle_code || values.cistern_code || values.tanker_registration || values.tanker_plates || values.cistern_registration || values.cistern_plates || manualCisternVehicle || selectedCisternVehicle || "";
  const globalCisternInput = $("#fieldTankerCisternSearch");
  if (globalCisternInput && !globalCisternInput.value.trim() && cisternSearchValue) {
    globalCisternInput.value = cisternSearchValue;
    setTimeout(refreshGlobalFieldTankerCisternSelect, 0);
  }
  const div = document.createElement("div");
  div.className = "entry-card field-tanker-entry";
  div.innerHTML = `
    <div class="entry-card-head">
      <strong>Sipanje na terenu ${idx}</strong>
      <button type="button" class="remove-entry">Ukloni</button>
    </div>

    <label>Gradilište iz Uprave</label>
    <select class="ft-site-select">${buildFieldTankerSiteOptionsHtml(selectedSite)}</select>
    <p class="field-hint">Ako gradilište nije u evidenciji, upiši naziv ispod.</p>

    <label>Upiši naziv gradilište ako nije u listi</label>
    <input class="ft-site-custom" placeholder="npr. Zemun Zmaj" value="${escapeHtml(values.site_custom || values.manual_site || "")}" />

    <div class="field-tanker-entry-cistern-block hidden" aria-hidden="true">
      <label>Cisterna / vozilo koje sipa gorivo</label>
      <input class="ft-cistern-search asset-code-search smart-asset-input" placeholder="upiši tablice, interni broj ili naziv cisterne" value="${escapeHtml(cisternSearchValue)}" />
      <div class="asset-smart-result ft-cistern-picked">Upiši tablice, interni broj ili naziv cisterne iz Direkcije.</div>
      <select class="ft-cistern-select hidden-asset-select" aria-hidden="true" tabindex="-1">${buildFieldTankerCisternVehicleOptionsHtml(selectedCisternVehicle || cisternSearchValue, cisternSearchValue)}</select>
      <input class="ft-cistern-custom hidden-asset-custom" type="hidden" value="${escapeHtml(manualCisternVehicle)}" />
    </div>

    <label>Vrsta sredstva koje prima gorivo</label>
    <select class="ft-asset-kind">
      <option value="machine" ${kind === "machine" ? "selected" : ""}>Mašina</option>
      <option value="vehicle" ${kind === "vehicle" ? "selected" : ""}>Vozilo</option>
      <option value="other" ${kind === "other" ? "selected" : ""}>Oprema / ostalo</option>
    </select>

    <label>Broj / naziv sredstva koje prima gorivo</label>
    <input class="ft-asset-search asset-code-search smart-asset-input" placeholder="upiši broj, naziv ili tablice" value="${escapeHtml(values.asset_code || values.field_tanker_asset_code || manualAsset || selectedAsset || "")}" />
    <div class="asset-smart-result ft-picked">Upiši interni broj, naziv ili tablice sredstva.</div>
    <select class="ft-asset-select hidden-asset-select" aria-hidden="true" tabindex="-1">${buildFieldTankerAssetOptionsHtml(kind, selectedAsset, values.asset_code || values.field_tanker_asset_code || manualAsset || selectedAsset || "")}</select>
    <input class="ft-asset-custom hidden-asset-custom" type="hidden" value="${escapeHtml(manualAsset)}" />

    <label>KM</label>
    <input class="ft-km numeric-text" type="text" inputmode="decimal" placeholder="npr. 85320" value="${escapeHtml(kmValue)}" />

    <label>MTČ</label>
    <input class="ft-mtc numeric-text" type="text" inputmode="decimal" placeholder="npr. 1250.5" value="${escapeHtml(mtcValue)}" />
    <p class="field-hint">Obavezno upiši KM ili MTČ. Ako je vozilo najčešće se upisuje KM, ako je mašina MTČ. Dovoljno je jedno od ta dva, a možeš popuniti oba ako firma tako traži.</p>

    <label>Litara</label>
    <input class="ft-liters numeric-text" type="text" inputmode="decimal" placeholder="npr. 120" value="${escapeHtml(values.liters || "")}" />

    <label>Primio gorivo</label>
    <input class="ft-receiver" placeholder="ime i prezime vozača / rukovaoca" value="${escapeHtml(values.receiver || values.received_by || "")}" />
  `;
  div.querySelector(".remove-entry").addEventListener("click", () => {
    div.remove();
    renumberFieldTankerEntries();
  });
  function refreshThisFieldTankerCisternSelect() {
    const cisternSelect = div.querySelector(".ft-cistern-select");
    if (!cisternSelect) return;
    const searchNow = div.querySelector(".ft-cistern-search")?.value || "";
    const custom = div.querySelector(".ft-cistern-custom");
    const asset = findFieldTankerCisternVehicleForSmartInput(searchNow);
    const selectedValue = asset ? (getAssetRegistration(asset) || getAssetCode(asset) || getAssetName(asset)) : "";
    cisternSelect.innerHTML = buildFieldTankerCisternVehicleOptionsHtml(selectedValue, searchNow);
    if (asset) {
      const name = getAssetName(asset) || getAssetRegistration(asset) || getAssetCode(asset) || "";
      if (Array.from(cisternSelect.options).some(o => o.value === name)) cisternSelect.value = name;
      if (custom) custom.value = "";
      updateFieldTankerCisternSmartResult(div, asset, "");
    } else {
      if (custom) custom.value = String(searchNow || "").trim();
      updateFieldTankerCisternSmartResult(div, null, searchNow);
    }
    rememberFieldTankerCisternFromInput(div);
  }
  function refreshThisFieldTankerAssetSelect() {
    const assetSelect = div.querySelector(".ft-asset-select");
    if (!assetSelect) return;
    const kindEl = div.querySelector(".ft-asset-kind");
    let kindNow = kindEl?.value || "machine";
    const searchNow = div.querySelector(".ft-asset-search")?.value || "";
    const custom = div.querySelector(".ft-asset-custom");
    const asset = findFuelAssetForSmartInput(searchNow, kindNow);
    if (asset && kindEl) {
      const assetKind = getCanonicalAssetKind(asset);
      if (assetKind && assetKind !== kindNow) {
        kindEl.value = assetKind;
        kindNow = assetKind;
      }
    }
    const selectedValue = asset ? (getAssetName(asset) || getAssetCode(asset) || getAssetRegistration(asset)) : "";
    assetSelect.innerHTML = buildFieldTankerAssetOptionsHtml(kindNow, selectedValue, searchNow);
    if (asset) {
      const name = getAssetName(asset) || getAssetRegistration(asset) || getAssetCode(asset) || "";
      if (Array.from(assetSelect.options).some(o => o.value === name)) assetSelect.value = name;
      if (custom) custom.value = "";
      updateFieldTankerSmartResult(div, asset, "");
    } else {
      if (custom) custom.value = String(searchNow || "").trim();
      updateFieldTankerSmartResult(div, null, searchNow);
    }
  }
  div.querySelector(".ft-cistern-search")?.addEventListener("input", refreshThisFieldTankerCisternSelect);
  div.querySelector(".ft-asset-kind")?.addEventListener("change", refreshThisFieldTankerAssetSelect);
  div.querySelector(".ft-asset-search")?.addEventListener("input", refreshThisFieldTankerAssetSelect);
  list.appendChild(div);
  refreshThisFieldTankerCisternSelect();
  preventNumberInputScrollChanges(div);
  refreshFieldTankerSelectors();
}

function renumberFieldTankerEntries() {
  $$("#fieldTankerEntries .field-tanker-entry").forEach((card, i) => {
    const h = card.querySelector("strong");
    if (h) h.textContent = `Sipanje na terenu ${i + 1}`;
  });
}

function getFieldTankerEntries() {
  const entries = $$("#fieldTankerEntries .field-tanker-entry").map((el, i) => {
    const siteSelect = el.querySelector(".ft-site-select");
    const siteOption = siteSelect?.options ? siteSelect.options[siteSelect.selectedIndex] : null;
    const manualSite = el.querySelector(".ft-site-custom")?.value.trim() || "";
    const site = manualSite || (siteSelect?.value || "").trim();
    const globalCistern = getFieldTankerGlobalCisternData();
    const cisternSearch = getGlobalFieldTankerCisternSearchValue() || el.querySelector(".ft-cistern-search")?.value.trim() || "";
    const cisternSelect = el.querySelector(".ft-cistern-select");
    const cisternOption = cisternSelect?.options ? cisternSelect.options[cisternSelect.selectedIndex] : null;
    const manualCistern = globalCistern.tanker_manual_vehicle || el.querySelector(".ft-cistern-custom")?.value.trim() || "";
    const cisternAsset = findFieldTankerCisternVehicleForSmartInput(cisternSearch);
    const cisternName = globalCistern.tanker_asset_name || (cisternAsset ? (getAssetName(cisternAsset) || cisternSearch) : (manualCistern || cisternSearch));
    const cisternRegistration = globalCistern.tanker_registration || (cisternAsset ? getAssetRegistration(cisternAsset) : (cisternOption?.dataset?.registration || cisternSearch));
    const kind = el.querySelector(".ft-asset-kind")?.value || "machine";
    const assetSelect = el.querySelector(".ft-asset-select");
    const assetOption = assetSelect?.options ? assetSelect.options[assetSelect.selectedIndex] : null;
    const manualAsset = el.querySelector(".ft-asset-custom")?.value.trim() || "";
    const asset = manualAsset || (assetSelect?.value || "").trim();
    const km = el.querySelector(".ft-km")?.value.trim() || "";
    const mtc = el.querySelector(".ft-mtc")?.value.trim() || "";
    const reading = mtc || km; // backward-compatible summary for older report/excel code
    const liters = el.querySelector(".ft-liters")?.value.trim() || "";
    const receiver = el.querySelector(".ft-receiver")?.value.trim() || "";
    return {
      no: i + 1,
      source_type: globalCistern.source_type || "fuel_tanker",
      fuel_source_type: globalCistern.fuel_source_type || globalCistern.source_type || "fuel_tanker",
      site_id: manualSite ? null : (siteOption?.dataset?.siteId || null),
      site_name: site,
      site_custom: manualSite,
      tanker_asset_id: globalCistern.tanker_asset_id || cisternAsset?.id || (manualCistern ? null : (cisternOption?.dataset?.assetId || null)),
      tanker_asset_code: globalCistern.tanker_asset_code || (cisternAsset ? (getAssetCode(cisternAsset) || "") : (manualCistern ? "" : (cisternOption?.dataset?.assetCode || ""))),
      tanker_asset_name: cisternName,
      tanker_asset_custom: globalCistern.tanker_asset_custom || manualCistern,
      tanker_registration: cisternRegistration,
      tanker_plates: cisternRegistration,
      tanker_vehicle: cisternName,
      tanker_vehicle_code: globalCistern.tanker_vehicle_code || (cisternAsset ? (getAssetCode(cisternAsset) || "") : (manualCistern ? "" : (cisternOption?.dataset?.assetCode || ""))),
      tanker_manual_vehicle: globalCistern.tanker_manual_vehicle || manualCistern,
      cistern_vehicle: cisternName,
      cistern_registration: cisternRegistration,
      cistern_plates: cisternRegistration,
      asset_kind: kind,
      asset_type: kind,
      asset_id: manualAsset ? null : (assetOption?.dataset?.assetId || null),
      asset_code: manualAsset ? "" : (assetOption?.dataset?.assetCode || ""),
      asset_name: asset,
      asset_custom: manualAsset,
      machine: kind === "machine" ? asset : "",
      vehicle: kind === "vehicle" ? asset : "",
      other: kind === "other" ? asset : "",
      vehicle_custom: kind === "vehicle" ? manualAsset : "",
      machine_custom: kind === "machine" ? manualAsset : "",
      other_custom: kind === "other" ? manualAsset : "",
      km,
      current_km: km,
      mtc,
      current_mtc: mtc,
      reading,
      mtc_km: reading,
      liters,
      receiver,
      received_by: receiver
    };
  }).filter(x => x.site_name || x.tanker_asset_name || x.tanker_registration || x.asset_name || x.km || x.mtc || x.reading || x.liters || x.receiver);
  const remembered = entries.find(x => x.tanker_asset_name || x.tanker_registration || x.tanker_plates || x.cistern_registration || x.cistern_plates);
  if (remembered) writeCurrentFieldTankerCistern(remembered);
  return entries;
}


function getFieldTankerMemoryKey() {
  const worker = currentWorker || JSON.parse(localStorage.getItem("swp_worker") || "null");
  const companyPart = worker?.company_id || worker?.company_code || "no_company";
  const userPart = worker?.user_id || worker?.id || worker?.access_code || "no_worker";
  return `swp_field_tanker_memory_${companyPart}_${userPart}`;
}

function getFieldTankerCurrentCisternKey() {
  const worker = currentWorker || JSON.parse(localStorage.getItem("swp_worker") || "null");
  const companyPart = worker?.company_id || worker?.company_code || "no_company";
  const userPart = worker?.user_id || worker?.id || worker?.access_code || "no_worker";
  return `swp_field_tanker_current_cistern_${companyPart}_${userPart}`;
}

function readCurrentFieldTankerCistern() {
  try {
    const raw = localStorage.getItem(getFieldTankerCurrentCisternKey());
    const data = raw ? JSON.parse(raw) : null;
    return data && typeof data === "object" ? data : {};
  } catch(e) {
    return {};
  }
}

function writeCurrentFieldTankerCistern(data = {}) {
  const value = {
    tanker_asset_id: data.tanker_asset_id || "",
    tanker_asset_code: data.tanker_asset_code || data.tanker_vehicle_code || "",
    tanker_asset_name: data.tanker_asset_name || data.tanker_vehicle || data.cistern_vehicle || data.cistern_name || "",
    tanker_registration: data.tanker_registration || data.tanker_plates || data.cistern_registration || data.cistern_plates || "",
    tanker_plates: data.tanker_registration || data.tanker_plates || data.cistern_registration || data.cistern_plates || "",
    tanker_vehicle: data.tanker_asset_name || data.tanker_vehicle || data.cistern_vehicle || data.cistern_name || "",
    tanker_vehicle_code: data.tanker_asset_code || data.tanker_vehicle_code || "",
    tanker_manual_vehicle: data.tanker_manual_vehicle || data.tanker_asset_custom || data.cistern_custom || "",
    cistern_vehicle: data.cistern_vehicle || data.tanker_asset_name || data.tanker_vehicle || data.cistern_name || "",
    cistern_registration: data.tanker_registration || data.tanker_plates || data.cistern_registration || data.cistern_plates || "",
    cistern_plates: data.tanker_registration || data.tanker_plates || data.cistern_registration || data.cistern_plates || "",
    source_type: data.source_type || data.fuel_source_type || "fuel_tanker",
    fuel_source_type: data.fuel_source_type || data.source_type || "fuel_tanker"
  };
  const hasValue = Object.values(value).some(v => String(v || "").trim());
  try {
    if (hasValue) localStorage.setItem(getFieldTankerCurrentCisternKey(), JSON.stringify(value));
    else localStorage.removeItem(getFieldTankerCurrentCisternKey());
  } catch(e) {}
}

function clearCurrentFieldTankerCistern() {
  try { localStorage.removeItem(getFieldTankerCurrentCisternKey()); } catch(e) {}
  const input = $("#fieldTankerCisternSearch");
  const select = $("#fieldTankerCisternSelect");
  const custom = $("#fieldTankerCisternCustom");
  const result = $("#fieldTankerCisternPicked");
  if (input) input.value = "";
  if (select) select.innerHTML = "";
  if (custom) custom.value = "";
  if (result) {
    result.className = "asset-smart-result";
    result.textContent = "Upiši tablice, interni broj ili naziv cisterne iz Direkcije.";
  }
}

function getCurrentFieldTankerCisternSearchValue() {
  const d = readCurrentFieldTankerCistern();
  return d.tanker_registration || d.tanker_plates || d.cistern_registration || d.cistern_plates || d.tanker_asset_code || d.tanker_vehicle_code || d.tanker_asset_name || d.tanker_vehicle || d.cistern_vehicle || d.tanker_manual_vehicle || "";
}

function rememberFieldTankerCisternFromInput(entryEl) {
  if (!entryEl) return;
  const searchValue = entryEl.querySelector(".ft-cistern-search")?.value.trim() || "";
  const manualValue = entryEl.querySelector(".ft-cistern-custom")?.value.trim() || "";
  const asset = findFieldTankerCisternVehicleForSmartInput(searchValue);
  if (asset) {
    writeCurrentFieldTankerCistern({
      tanker_asset_id: asset.id || "",
      tanker_asset_code: getAssetCode(asset) || "",
      tanker_asset_name: getAssetName(asset) || searchValue,
      tanker_registration: getAssetRegistration(asset) || searchValue,
      tanker_vehicle: getAssetName(asset) || searchValue,
      cistern_vehicle: getAssetName(asset) || searchValue,
      cistern_registration: getAssetRegistration(asset) || searchValue
    });
  } else if (searchValue || manualValue) {
    writeCurrentFieldTankerCistern({
      tanker_asset_name: manualValue || searchValue,
      tanker_registration: searchValue,
      tanker_vehicle: manualValue || searchValue,
      cistern_vehicle: manualValue || searchValue,
      cistern_registration: searchValue,
      tanker_manual_vehicle: manualValue || searchValue
    });
  }
}

function readStoredFieldTankerEntries() {
  try {
    const raw = localStorage.getItem(getFieldTankerMemoryKey());
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch(e) {
    return [];
  }
}

function writeStoredFieldTankerEntries(entries = []) {
  localStorage.setItem(getFieldTankerMemoryKey(), JSON.stringify(entries));
  renderStoredFieldTankerEntries();
}

function normalizeStoredFieldTankerEntry(entry = {}, index = 0) {
  return {
    ...entry,
    no: index + 1,
    local_id: entry.local_id || `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    saved_at: entry.saved_at || new Date().toISOString(),
    saved_by: entry.saved_by || currentWorker?.full_name || "",
    source: "field_tanker_memory"
  };
}

function validateFieldTankerEntryForMemory(entry) {
  if (!entry.site_name) return "Cisterna goriva: izaberi ili upiši gradilište/lokaciju za svako sipanje.";
  if (!(entry.tanker_asset_name || entry.tanker_registration || entry.tanker_plates)) return "Cisterna goriva: upiši tablice, interni broj ili naziv cisterne iz koje se sipa gorivo.";
  if (!entry.asset_name) return "Cisterna goriva: upiši interni broj, naziv ili tablice sredstva koje prima gorivo.";
  const kmValue = String(entry.km || entry.current_km || "").trim();
  const mtcValue = String(entry.mtc || entry.current_mtc || "").trim();
  if (!kmValue && !mtcValue) return "Cisterna goriva: upiši KM ili MTČ za svako sipanje. Dovoljno je jedno od ta dva polja.";
  if (!entry.liters) return "Cisterna goriva: upiši koliko litara je sipano.";
  if (!entry.receiver) return "Cisterna goriva: upiši ko je primio gorivo.";
  return "";
}

function memorizeCurrentFieldTankerEntries() {
  try {
    const currentEntries = getFieldTankerEntries();
    if (!currentEntries.length) throw new Error("Prvo dodaj bar jedno sipanje goriva cisternom.");

    const firstError = currentEntries.map(validateFieldTankerEntryForMemory).find(Boolean);
    if (firstError) throw new Error(firstError);

    const existing = readStoredFieldTankerEntries();
    const savedNow = new Date().toISOString();
    const prepared = currentEntries.map((entry, index) => normalizeStoredFieldTankerEntry({
      ...entry,
      saved_at: savedNow,
      saved_by: currentWorker?.full_name || ""
    }, existing.length + index));

    writeStoredFieldTankerEntries([...existing, ...prepared].map(normalizeStoredFieldTankerEntry));

    if ($("#fieldTankerEntries")) {
      $("#fieldTankerEntries").innerHTML = "";
      addFieldTankerEntry();
    }

    toast(`Memorisano ${prepared.length} sipanje/a goriva na ovom telefonu ✅`);
  } catch(e) {
    toast(e.message, true);
  }
}

function removeStoredFieldTankerEntry(localId) {
  const remaining = readStoredFieldTankerEntries().filter(entry => entry.local_id !== localId);
  writeStoredFieldTankerEntries(remaining.map(normalizeStoredFieldTankerEntry));
  toast("Sipanje je uklonjeno iz lokalne memorije.");
}

function clearStoredFieldTankerEntries() {
  const count = readStoredFieldTankerEntries().length;
  if (!count) {
    renderStoredFieldTankerEntries();
    toast("Nema memorisanih sipanja za brisanje.");
    return;
  }
  if (!confirm(`Obrisati ${count} memorisano/a sipanje/a sa ovog telefona? Ovo radi samo lokalno, ne briše ništa iz Supabase-a.`)) return;
  writeStoredFieldTankerEntries([]);
  toast("Lokalna memorija sipanja je obrisana.");
}

function renderStoredFieldTankerEntries() {
  const box = $("#storedFieldTankerList");
  if (!box) return;
  const entries = readStoredFieldTankerEntries().map(normalizeStoredFieldTankerEntry);
  if (!entries.length) {
    box.innerHTML = `<p class="hint">Trenutno nema memorisanih sipanja na ovom telefonu.</p>`;
    return;
  }

  const totalLiters = entries.reduce((sum, entry) => sum + parseDecimalInput(entry.liters), 0);
  box.innerHTML = `
    <div class="stored-fuel-summary">
      <strong>${entries.length} memorisano/a sipanje/a</strong>
      <span>${totalLiters ? `${totalLiters.toLocaleString("sr-RS")} L ukupno` : "Litri nisu sabrani"}</span>
    </div>
    ${entries.map((entry, index) => `
      <div class="stored-fuel-item">
        <div>
          <strong>${index + 1}. ${escapeHtml(entry.site_name || "Bez lokacije")}</strong>
          <small>Cisterna: ${escapeHtml(entry.tanker_registration || entry.tanker_plates || entry.tanker_asset_code || entry.tanker_asset_name || "-")}</small>
          <small>${escapeHtml(assetKindLabel(entry.asset_kind))} · ${escapeHtml(entry.asset_name || "")}</small>
          <small>${escapeHtml(entry.liters || "0")} L · KM: ${escapeHtml(entry.km || entry.current_km || "-")} · MTČ: ${escapeHtml(entry.mtc || entry.current_mtc || "-")} · Primio: ${escapeHtml(entry.receiver || "-")}</small>
        </div>
        <button type="button" class="danger-small stored-fuel-remove" data-local-id="${escapeHtml(entry.local_id)}">Ukloni</button>
      </div>
    `).join("")}
  `;

  box.querySelectorAll(".stored-fuel-remove").forEach(btn => {
    btn.addEventListener("click", () => removeStoredFieldTankerEntry(btn.dataset.localId));
  });
}

function buildFieldTankerMemoryReportData(entries = []) {
  const first = entries[0] || {};
  const totalLiters = entries.reduce((sum, entry) => sum + parseDecimalInput(entry.liters), 0);
  return {
    report_type: "field_tanker_daily_batch",
    source: "field_tanker_memory",
    memory_sent_at: new Date().toISOString(),
    report_sections_sent: {
      field_tanker: true,
      tanker_fuel_memory: true
    },
    site_id: first.site_id || null,
    site_name: first.site_name || "Evidencija goriva – cisterna",
    field_tanker_entries: entries.map(normalizeStoredFieldTankerEntry),
    tanker_fuel_entries: entries.map(normalizeStoredFieldTankerEntry),
    fuel_liters: totalLiters || "",
    field_tanker_total_liters: totalLiters || "",
    field_tanker_count: entries.length,
    created_by_worker: currentWorker?.full_name || "",
    employee_number: currentWorkerEmployeeNumber(),
    worker_number: currentWorkerEmployeeNumber(),
    created_by_employee_number: currentWorkerEmployeeNumber(),
    function_title: currentWorker?.function_title || "",
    description: "Memorisana sipanja goriva cisternom poslata kao jedan dnevni izveštaj."
  };
}

async function sendStoredFieldTankerEntries() {
  if (fieldTankerMemorySubmitBusy) {
    toast("Slanje memorisanih sipanja je već u toku. Sačekaj potvrdu.", true);
    return;
  }
  const sendBtn = $("#sendStoredFieldTankerBtn");
  fieldTankerMemorySubmitBusy = true;
  if (sendBtn) { sendBtn.disabled = true; sendBtn.dataset.oldText = sendBtn.textContent || ""; sendBtn.textContent = "Šaljem..."; }
  try {
    if (!navigator.onLine) throw new Error("Nema interneta. Memorisana sipanja ostaju sačuvana na telefonu.");
    const worker = currentWorker || JSON.parse(localStorage.getItem("swp_worker") || "null");
    if (!worker) throw new Error("Zaposleni nije prijavljen.");

    const entries = readStoredFieldTankerEntries().map(normalizeStoredFieldTankerEntry);
    if (!entries.length) throw new Error("Nema memorisanih sipanja za slanje.");

    const firstError = entries.map(validateFieldTankerEntryForMemory).find(Boolean);
    if (firstError) throw new Error(firstError);

    const data = buildFieldTankerMemoryReportData(entries);
    const { error } = await sb.rpc("submit_worker_report", {
      p_company_code: worker.company_code,
      p_access_code: worker.access_code,
      p_report_date: $("#wrDate")?.value || today(),
      p_site_id: data.site_id || null,
      p_data: data
    });

    if (error) throw error;

    localStorage.removeItem(getFieldTankerMemoryKey());
    clearCurrentFieldTankerCistern();
    renderStoredFieldTankerEntries();
    if ($("#fieldTankerEntries")) {
      $("#fieldTankerEntries").innerHTML = "";
      addFieldTankerEntry();
    }
    toast(`Sva memorisana sipanja su poslata Upravi ✅ (${entries.length})`);
  } catch(e) {
    toast(e.message, true);
  } finally {
    fieldTankerMemorySubmitBusy = false;
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = sendBtn.dataset.oldText || "Pošalji memorisana sipanja"; delete sendBtn.dataset.oldText; }
  }
}

function buildFuelAssetOptionsHtml(kind = "machine", selectedValue = "", searchValue = "") {
  const selected = String(selectedValue || "").trim();
  let allAssets = (workerAssetOptions || [])
    .filter(asset => filterAssetsByFuelKind(asset, kind))
    .filter(asset => getAssetCode(asset) || getAssetName(asset) || getAssetRegistration(asset));
  let assets = allAssets.filter(asset => machineMatchesSearch(asset, searchValue));
  const q = normalizeVehicleSearch(searchValue);

  const exact = findAssetByExactCode(searchValue);
  if (exact) {
    const exactKind = getCanonicalAssetKind(exact);
    if (exactKind === kind && !assets.some(a => String(a.id || "") === String(exact.id || ""))) {
      assets = [exact, ...assets];
    }
  }
  if (q && !assets.length) {
    assets = findAssetsByUniversalSearch(searchValue);
  }

  if (!workerAssetOptions.length) {
    return `<option value="">Nema sredstava iz Uprave</option>`;
  }
  if (!assets.length) {
    return `<option value="">Nema sredstva za taj broj/pretragu</option>`;
  }

  return `<option value="">${fuelKindChooseText(kind)}</option>` + assets.map(asset => assetOptionHtml(asset, selected, a => formatFuelKindAssetLabel(a, getCanonicalAssetKind(a)))).join("");
}


function findFuelAssetForSmartInput(searchValue, kind = "machine") {
  const q = normalizeVehicleSearch(searchValue);
  if (!q) return null;
  const exactCode = findAssetByExactCode(searchValue);
  if (exactCode) return exactCode;
  const assets = (workerAssetOptions || [])
    .filter(asset => filterAssetsByFuelKind(asset, kind))
    .filter(asset => getAssetCode(asset) || getAssetName(asset) || getAssetRegistration(asset));
  const exact = assets.find(asset => {
    const code = normalizeVehicleSearch(getAssetCode(asset));
    const name = normalizeVehicleSearch(getAssetName(asset));
    const reg = normalizeVehicleSearch(getAssetRegistration(asset));
    const label = normalizeVehicleSearch(formatFuelKindAssetLabel(asset, kind));
    return code === q || name === q || reg === q || label === q;
  });
  if (exact) return exact;
  const matches = assets.filter(asset => machineMatchesSearch(asset, searchValue));
  return matches.length === 1 ? matches[0] : null;
}

function updateFuelSmartResult(entryEl, asset, manualValue) {
  const result = entryEl.querySelector(".f-picked");
  if (!result) return;
  if (asset) {
    result.className = "asset-smart-result f-picked ok";
    result.textContent = `Pronađeno sredstvo: ${formatFuelKindAssetLabel(asset, getCanonicalAssetKind(asset))}`;
    return;
  }
  const value = String(manualValue || "").trim();
  if (value) {
    result.className = "asset-smart-result f-picked warn";
    result.textContent = `Nije pronađeno u evidenciji. Biće poslato kao dodatni unos: ${value}`;
    return;
  }
  result.className = "asset-smart-result f-picked";
  result.textContent = "Upiši interni broj, naziv ili tablice sredstva.";
}

function updateFieldTankerSmartResult(entryEl, asset, manualValue) {
  const result = entryEl.querySelector(".ft-picked");
  if (!result) return;
  if (asset) {
    result.className = "asset-smart-result ft-picked ok";
    result.textContent = `Pronađeno sredstvo: ${formatFuelKindAssetLabel(asset, getCanonicalAssetKind(asset))}`;
    return;
  }
  const value = String(manualValue || "").trim();
  if (value) {
    result.className = "asset-smart-result ft-picked warn";
    result.textContent = `Nije pronađeno u evidenciji. Biće poslato kao dodatni unos: ${value}`;
    return;
  }
  result.className = "asset-smart-result ft-picked";
  result.textContent = "Upiši interni broj, naziv ili tablice sredstva.";
}

function findDefectAssetForSmartInput(searchValue) {
  const q = normalizeVehicleSearch(searchValue);
  if (!q) return null;
  const exactCode = findAssetByExactCode(searchValue);
  if (exactCode) return exactCode;
  const assets = (workerAssetOptions || []).filter(asset => getAssetCode(asset) || getAssetName(asset) || getAssetRegistration(asset));
  const exact = assets.find(asset => {
    const code = normalizeVehicleSearch(getAssetCode(asset));
    const name = normalizeVehicleSearch(getAssetName(asset));
    const reg = normalizeVehicleSearch(getAssetRegistration(asset));
    const label = normalizeVehicleSearch(formatFuelKindAssetLabel(asset, getCanonicalAssetKind(asset)));
    return code === q || name === q || reg === q || label === q;
  });
  if (exact) return exact;
  const matches = assets.filter(asset => machineMatchesSearch(asset, searchValue));
  return matches.length === 1 ? matches[0] : null;
}

function formatDefectAssetLabel(asset) {
  if (!asset) return "";
  const kind = getCanonicalAssetKind(asset);
  const kindLabel = kind === "vehicle" ? "Vozilo" : kind === "other" ? "Oprema / ostalo" : "Mašina";
  return `${kindLabel}: ${formatFuelKindAssetLabel(asset, kind)}`;
}

function updateDefectAssetSmartResult() {
  const input = $("#wrDefectAssetName");
  const result = $("#wrDefectAssetPicked");
  if (!input || !result) return;
  const value = String(input.value || "").trim();
  const asset = findDefectAssetForSmartInput(value);
  if (asset) {
    result.className = "asset-smart-result defect-picked ok";
    result.textContent = `Pronađeno sredstvo: ${formatDefectAssetLabel(asset)}`;
    return;
  }
  if (value) {
    result.className = "asset-smart-result defect-picked warn";
    result.textContent = `Nije pronađeno u evidenciji. Biće poslato kao dodatni unos: ${value}`;
    return;
  }
  result.className = "asset-smart-result defect-picked";
  result.textContent = "Upiši interni broj, naziv mašine/vozila/opreme ili registraciju.";
}

function getDefectAssetPayload() {
  const raw = String($("#wrDefectAssetName")?.value || "").trim();
  const asset = findDefectAssetForSmartInput(raw);
  if (!asset) {
    return {
      defect_asset_kind: "",
      defect_asset_id: "",
      defect_asset_code: "",
      defect_asset_name: raw,
      defect_asset_registration: "",
      defect_manual_asset_name: raw
    };
  }
  return {
    defect_asset_kind: getCanonicalAssetKind(asset),
    defect_asset_id: asset.id || "",
    defect_asset_code: getAssetCode(asset) || "",
    defect_asset_name: getAssetName(asset) || raw,
    defect_asset_registration: getAssetRegistration(asset) || "",
    defect_manual_asset_name: ""
  };
}

function getDefectImpactPayload() {
  const impact = $("#wrDefectStopsWork")?.value || "";
  return {
    defect_work_impact: impact,
    defect_stops_work: impact === "zaustavlja_rad" ? "da" : impact === "moze_nastaviti" ? "ne" : "",
    defect_can_continue: impact === "moze_nastaviti" ? "da" : impact === "zaustavlja_rad" ? "ne" : ""
  };
}

function refreshOneFuelAssetSelect(entryEl) {
  const sel = entryEl.querySelector(".f-asset-select");
  if (!sel) return;
  const kindEl = entryEl.querySelector(".f-asset-kind");
  let kind = kindEl?.value || "machine";
  const search = entryEl.querySelector(".f-asset-search")?.value || "";
  const custom = entryEl.querySelector(".f-asset-custom");
  const asset = findFuelAssetForSmartInput(search, kind);
  if (asset && kindEl) {
    const assetKind = getCanonicalAssetKind(asset);
    if (assetKind && assetKind !== kind) {
      kindEl.value = assetKind;
      kind = assetKind;
    }
  }
  const selectedValue = asset ? (getAssetName(asset) || getAssetCode(asset) || getAssetRegistration(asset)) : "";
  sel.innerHTML = buildFuelAssetOptionsHtml(kind, selectedValue, search);
  if (asset) {
    const name = getAssetName(asset) || getAssetRegistration(asset) || getAssetCode(asset) || "";
    if (Array.from(sel.options).some(o => o.value === name)) sel.value = name;
    if (custom) custom.value = "";
    updateFuelSmartResult(entryEl, asset, "");
  } else {
    if (custom) custom.value = String(search || "").trim();
    updateFuelSmartResult(entryEl, null, search);
  }
}



function addWaterTankerEntry(values = {}) {
  const list = $("#waterTankerEntries");
  if (!list) return;
  const idx = list.querySelectorAll(".water-tanker-entry").length + 1;
  const selectedVehicle = values.vehicle || values.asset_name || values.tanker_vehicle || "";
  const div = document.createElement("div");
  div.className = "entry-card water-tanker-entry";
  div.innerHTML = `
    <div class="entry-card-head">
      <strong>Cisterna za vodu ${idx}</strong>
      <button type="button" class="remove-entry">Ukloni</button>
    </div>
    <label>Vozilo / cisterna za vodu</label>
    <select class="wt-vehicle">${buildVehicleOptionsHtml(selectedVehicle)}</select>
    <input class="wt-vehicle-custom" placeholder="ako nije u listi, upiši naziv/tablice" value="${escapeHtml(values.vehicle_custom || values.tanker_custom || "")}" />
    <label>Gradilište / lokacija rada</label>
    <select class="wt-site entry-site-select">${buildLowloaderSiteOptionsHtml(values.site_name || values.site || "")}</select>
    <div class="mini-grid">
      <div><label>KM početak</label><input class="wt-km-start numeric-text" inputmode="decimal" value="${escapeHtml(values.km_start || "")}" /></div>
      <div><label>KM kraj</label><input class="wt-km-end numeric-text" inputmode="decimal" value="${escapeHtml(values.km_end || "")}" /></div>
      <div><label>Litara vode</label><input class="wt-liters numeric-text" inputmode="decimal" placeholder="npr. 8000" value="${escapeHtml(values.water_liters || values.liters || "")}" /></div>
      <div><label>Broj punjenja</label><input class="wt-loads numeric-text" inputmode="decimal" placeholder="npr. 2" value="${escapeHtml(values.loads || values.fill_count || "")}" /></div>
    </div>
    <div class="grid two">
      <div><label>Gde je punjena voda</label><input class="wt-fill-location" placeholder="baza, hidrant, bunar..." value="${escapeHtml(values.fill_location || "")}" /></div>
      <div><label>Gde je istovar / prskanje</label><input class="wt-unload-location" placeholder="gradilište, put, deonica..." value="${escapeHtml(values.unload_location || values.spray_location || "")}" /></div>
    </div>
    <label>Namena</label>
    <select class="wt-purpose">
      <option value="prskanje" ${(values.purpose || "") === "prskanje" ? "selected" : ""}>Prskanje puta / prašina</option>
      <option value="zalivanje" ${(values.purpose || "") === "zalivanje" ? "selected" : ""}>Zalivanje / vlaženje</option>
      <option value="dopuna" ${(values.purpose || "") === "dopuna" ? "selected" : ""}>Dopuna vode</option>
      <option value="ciscenje" ${(values.purpose || "") === "ciscenje" ? "selected" : ""}>Čišćenje / pranje</option>
      <option value="ostalo" ${(values.purpose || "") === "ostalo" ? "selected" : ""}>Ostalo</option>
    </select>
    <label>Napomena</label>
    <input class="wt-note" placeholder="npr. prskano zbog prašine" value="${escapeHtml(values.note || "")}" />
  `;
  div.querySelector(".remove-entry")?.addEventListener("click", () => { div.remove(); renumberWaterTankerEntries(); });
  list.appendChild(div);
  preventNumberInputScrollChanges(div);
}

function renumberWaterTankerEntries() {
  $$("#waterTankerEntries .water-tanker-entry").forEach((card, i) => {
    const title = card.querySelector(".entry-card-head strong");
    if (title) title.textContent = `Cisterna za vodu ${i + 1}`;
  });
}

function getWaterTankerEntries() {
  return $$("#waterTankerEntries .water-tanker-entry").map((el, i) => {
    const select = el.querySelector(".wt-vehicle");
    const option = select?.options ? select.options[select.selectedIndex] : null;
    const custom = el.querySelector(".wt-vehicle-custom")?.value.trim() || "";
    const vehicle = custom || select?.value || "";
    return {
      no: i + 1,
      asset_id: custom ? null : (option?.dataset?.assetId || null),
      asset_code: custom ? "" : (option?.dataset?.assetCode || ""),
      vehicle,
      asset_name: vehicle,
      vehicle_custom: custom,
      registration: custom ? "" : (option?.dataset?.registration || ""),
      ...getWorkerSiteOptionPayload(el.querySelector(".wt-site")),
      km_start: el.querySelector(".wt-km-start")?.value || "",
      km_end: el.querySelector(".wt-km-end")?.value || "",
      water_liters: el.querySelector(".wt-liters")?.value || "",
      liters: el.querySelector(".wt-liters")?.value || "",
      loads: el.querySelector(".wt-loads")?.value || "",
      fill_count: el.querySelector(".wt-loads")?.value || "",
      fill_location: el.querySelector(".wt-fill-location")?.value.trim() || "",
      unload_location: el.querySelector(".wt-unload-location")?.value.trim() || "",
      spray_location: el.querySelector(".wt-unload-location")?.value.trim() || "",
      purpose: el.querySelector(".wt-purpose")?.value || "",
      note: el.querySelector(".wt-note")?.value.trim() || ""
    };
  }).filter(x => x.vehicle || x.site_name || x.water_liters || x.loads || x.fill_location || x.unload_location || x.note);
}

function addFuelEntry(values = {}) {
  const list = $("#fuelEntries");
  if (!list) return;
  const idx = list.querySelectorAll(".fuel-entry").length + 1;
  const kind = values.asset_kind || values.asset_type || values.kind || (values.other ? "other" : (values.vehicle ? "vehicle" : "machine"));
  const selectedAsset = values.asset_name || values.machine || values.vehicle || "";
  const manualAsset = values.asset_custom || values.machine_custom || values.vehicle_custom || "";
  const oldReading = values.reading || values.mtc_km || "";
  const kmValue = values.km || values.current_km || values.kilometers || values.odometer || (kind === "vehicle" ? oldReading : "");
  const mtcValue = values.mtc || values.current_mtc || values.machine_mtc || (kind === "machine" ? oldReading : "");
  const div = document.createElement("div");
  div.className = "entry-card fuel-entry";
  div.innerHTML = `
    <div class="entry-card-head">
      <strong>Sipanje goriva ${idx}</strong>
      <button type="button" class="remove-entry">Ukloni</button>
    </div>


    <div class="grid two">
      <div>
        <label>Izvor goriva</label>
        <select class="f-source-type">
          <option value="fixed_pump" ${(values.source_type || values.fuel_source_type || "") === "fixed_pump" ? "selected" : ""}>Fiksna pumpa u bazi</option>
          <option value="small_tanker" ${(values.source_type || values.fuel_source_type || "") === "small_tanker" ? "selected" : ""}>Mala pokretna cisterna</option>
          <option value="fuel_tanker" ${(values.source_type || values.fuel_source_type || "") === "fuel_tanker" ? "selected" : ""}>Cisterna za gorivo</option>
          <option value="gas_station" ${(values.source_type || values.fuel_source_type || "") === "gas_station" ? "selected" : ""}>Benzinska pumpa / račun</option>
          <option value="canister" ${(values.source_type || values.fuel_source_type || "") === "canister" ? "selected" : ""}>Kanister / ručno</option>
          <option value="other" ${(values.source_type || values.fuel_source_type || "") === "other" ? "selected" : ""}>Ostalo</option>
        </select>
      </div>
      <div>
        <label>Naziv izvora / lokacija</label>
        <input class="f-source-name" placeholder="npr. Pumpa baza, mala cisterna 1000 L" value="${escapeHtml(values.source_name || values.fuel_source || values.location || "")}" />
      </div>
    </div>

    <label>Vrsta sredstva</label>
    <select class="f-asset-kind">
      <option value="machine" ${kind === "machine" ? "selected" : ""}>Mašina</option>
      <option value="vehicle" ${kind === "vehicle" ? "selected" : ""}>Vozilo</option>
      <option value="other" ${kind === "other" ? "selected" : ""}>Oprema / ostalo</option>
    </select>

    <label>Sredstvo / interni broj</label>
    <input class="f-asset-search asset-code-search smart-asset-input" placeholder="upiši broj, naziv ili tablice" value="${escapeHtml(values.asset_code || values.fuel_asset_code || manualAsset || selectedAsset || "")}" />
    <div class="asset-smart-result f-picked">Upiši interni broj, naziv ili tablice sredstva.</div>
    <select class="f-asset-select hidden-asset-select" aria-hidden="true" tabindex="-1"></select>
    <input class="f-asset-custom hidden-asset-custom" type="hidden" value="${escapeHtml(manualAsset)}" />

    <div class="mini-grid">
      <div>
        <label>Litara</label>
        <input class="f-liters" type="text" inputmode="decimal" autocomplete="off" placeholder="npr. 120" value="${escapeHtml(values.liters || "")}" />
      </div>
      <div>
        <label>KM</label>
        <input class="f-km numeric-text" type="text" inputmode="decimal" autocomplete="off" placeholder="npr. 85320" value="${escapeHtml(kmValue)}" />
      </div>
      <div>
        <label>MTČ</label>
        <input class="f-mtc numeric-text" type="text" inputmode="decimal" autocomplete="off" placeholder="npr. 1255.0" value="${escapeHtml(mtcValue)}" />
      </div>
    </div>

    <label>Ko je sipao</label>
    <input class="f-by" placeholder="npr. Marko" value="${escapeHtml(values.by || "")}" />

    <p class="hint">Za vozilo upiši KM. Za mašinu ili ostalu opremu upiši MTČ ako postoji. </p>
  `;

  div.querySelector(".remove-entry").addEventListener("click", () => div.remove());
  div.querySelector(".f-asset-kind")?.addEventListener("change", () => refreshOneFuelAssetSelect(div));
  div.querySelector(".f-asset-search")?.addEventListener("input", () => refreshOneFuelAssetSelect(div));
  list.appendChild(div);
  preventNumberInputScrollChanges(div);
  refreshOneFuelAssetSelect(div);

  if (selectedAsset) {
    const sel = div.querySelector(".f-asset-select");
    if (Array.from(sel.options).some(o => o.value === selectedAsset)) sel.value = selectedAsset;
  }
}

function getFuelEntries() {
  return $$("#fuelEntries .fuel-entry").map((el, i) => {
    const kind = el.querySelector(".f-asset-kind")?.value || "machine";
    const selected = el.querySelector(".f-asset-select")?.value || "";
    const custom = el.querySelector(".f-asset-custom")?.value.trim() || "";
    const select = el.querySelector(".f-asset-select");
    const option = select?.options ? select.options[select.selectedIndex] : null;
    const assetName = custom || selected;
    const km = el.querySelector(".f-km")?.value.trim() || "";
    const mtc = el.querySelector(".f-mtc")?.value.trim() || "";
    const oldReading = el.querySelector(".f-reading")?.value.trim() || "";
    const reading = mtc || km || oldReading; // backward-compatible summary for older report/excel code
    return {
      no: i + 1,
      asset_kind: kind,
      asset_type: kind,
      asset_id: custom ? null : (option?.dataset?.assetId || null),
      asset_code: custom ? "" : (option?.dataset?.assetCode || ""),
      asset_name: assetName,
      asset_custom: custom,
      machine: kind === "machine" ? assetName : "",
      machine_custom: kind === "machine" ? custom : "",
      vehicle: kind === "vehicle" ? assetName : "",
      vehicle_custom: kind === "vehicle" ? custom : "",
      other: kind === "other" ? assetName : "",
      other_custom: kind === "other" ? custom : "",
      liters: el.querySelector(".f-liters")?.value || "",
      km,
      current_km: km,
      mtc,
      current_mtc: mtc,
      reading,
      mtc_km: reading,
      by: el.querySelector(".f-by")?.value.trim() || "",
      source_type: el.querySelector(".f-source-type")?.value || "",
      fuel_source_type: el.querySelector(".f-source-type")?.value || "",
      source_name: el.querySelector(".f-source-name")?.value.trim() || "",
      fuel_source: el.querySelector(".f-source-name")?.value.trim() || "",
      fuel_location: el.querySelector(".f-source-name")?.value.trim() || "",
      receiver: currentWorker?.full_name || ""
    };
  }).filter(f => f.asset_name || f.liters || f.km || f.mtc || f.reading || f.by);
}

function refreshFuelMachineOptions() {
  $$("#fuelEntries .fuel-entry").forEach(entryEl => refreshOneFuelAssetSelect(entryEl));
}


// Direktno izlaganje funkcija za onclick fallback
window.addMachineEntry = addMachineEntry;
window.addFuelEntry = addFuelEntry;
window.addVehicleEntry = addVehicleEntry;
window.addFieldTankerEntry = addFieldTankerEntry;
window.memorizeCurrentFieldTankerEntries = memorizeCurrentFieldTankerEntries;
window.sendStoredFieldTankerEntries = sendStoredFieldTankerEntries;
window.clearStoredFieldTankerEntries = clearStoredFieldTankerEntries;
window.addLowloaderEntry = addLowloaderEntry;
window.addWaterTankerEntry = addWaterTankerEntry;
window.addMaterialEntry = addMaterialEntry;
window.renumberLowloaderEntries = renumberLowloaderEntries;
window.refreshFuelMachineOptions = refreshFuelMachineOptions;


async function loadWorkerReturnedReports() {
  const panel = $("#workerReturnedReports");
  const list = $("#workerReturnedList");
  if (!panel || !list || !currentWorker) return;

  list.innerHTML = "";
  panel.classList.add("hidden");

  try {
    const { data, error } = await sb.rpc("worker_list_returned_reports", {
      p_company_code: currentWorker.company_code,
      p_access_code: currentWorker.access_code
    });

    if (error) throw error;
    if (!data || !data.length) return;

    panel.classList.remove("hidden");

    list.innerHTML = data.map(r => {
      const d = r.data || {};
      const title = d.report_type === "site_daily_log" ? "Dnevnik gradilišta" : (d.report_type === "defect_record" || d.report_type === "defect_alert" ? "Evidencija kvara" : "Dnevni radni izveštaj");
      const site = d.site_name || d.defect_site_name || "Bez gradilišta";
      const reason = r.returned_reason || "Uprava nije upisala razlog.";
      const opis = d.defect || d.description || d.note || "";
      return `
        <div class="returned-item">
          <strong>↩️ ${escapeHtml(title)} — ${escapeHtml(r.report_date || "")}</strong>
          <small>${escapeHtml(site)} ${opis ? "· " + escapeHtml(opis) : ""}</small>
          <div class="returned-reason"><b>Razlog ispravke:</b> ${escapeHtml(reason)}</div>
          <div class="returned-actions">
            <button class="secondary" type="button" onclick="loadReturnedReportIntoForm('${r.id}')">Otvori za ispravku</button>
          </div>
        </div>
      `;
    }).join("");
  } catch(e) {
    toast("Vraćeni izveštaji se ne mogu učitati: " + e.message + " Pokreni Supabase SQL za v1.13.7.", true);
  }
}

async function getReturnedReportForWorker(reportId) {
  if (!currentWorker) throw new Error("Zaposleni nije prijavljen.");
  const { data, error } = await sb.rpc("worker_list_returned_reports", {
    p_company_code: currentWorker.company_code,
    p_access_code: currentWorker.access_code
  });
  if (error) throw error;
  return (data || []).find(r => r.id === reportId) || null;
}

window.loadReturnedReportIntoForm = async (reportId) => {
  try {
    if (!currentWorker) throw new Error("Zaposleni nije prijavljen.");

    const r = await getReturnedReportForWorker(reportId);
    if (!r) throw new Error("Izveštaj nije pronađen ili više nije vraćen na ispravku.");

    const d = r.data || {};
    const returnedReportType = d.report_type || d.reportType || "";
    localStorage.setItem("swp_returned_report_type", returnedReportType);
    localStorage.setItem("swp_returned_report_reason", r.returned_reason || d.returned_reason || "");

    const moduleValue = workerModuleValueFromReportType(returnedReportType);
    if (moduleValue && document.getElementById("wrModuleSelect")) {
      document.getElementById("wrModuleSelect").value = moduleValue;
      applyWorkerModuleSelection({ addDefaults: false });
    }

    if (d.report_type === "site_daily_log") {
      loadSiteLogDataIntoForm(d, r);
      localStorage.setItem("swp_returned_report_id", reportId);
      localStorage.setItem("swp_returned_report_type", "site_daily_log");
      updateReturnedCorrectionUi();
      toast("Dnevnik gradilišta je otvoren za ispravku. Ispravi ga i pošalji ponovo Upravi firme.");
      const panel = $("#siteLogPanel");
      if (panel) panel.scrollIntoView({ behavior:"smooth", block:"start" });
      return;
    }
    $("#wrDate").value = r.report_date || today();

    if ($("#wrLeaveType")) $("#wrLeaveType").value = "slobodan_dan";
  updateLeaveRequestVisibility();
  if ($("#workerEntries")) $("#workerEntries").innerHTML = "";
    if ($("#machineEntries")) $("#machineEntries").innerHTML = "";
    if ($("#vehicleEntries")) $("#vehicleEntries").innerHTML = "";
    if ($("#fuelEntries")) $("#fuelEntries").innerHTML = "";
    if ($("#lowloaderEntries")) $("#lowloaderEntries").innerHTML = "";

    (d.workers || d.worker_entries || []).forEach(w => addWorkerEntry(w));
    (d.machines || []).forEach(m => addMachineEntry(m));
    (d.vehicles || []).forEach(v => addVehicleEntry(v));
    (d.lowloader_moves || d.lowloader_entries || []).forEach(x => addLowloaderEntry(x));
    (d.water_tanker_entries || d.water_entries || []).forEach(x => addWaterTankerEntry(x));
    (d.field_tanker_entries || d.tanker_fuel_entries || []).forEach(x => addFieldTankerEntry(x));
    if ((!d.vehicles || !d.vehicles.length) && (d.vehicle || d.km_start || d.km_end || d.route || d.tours)) {
      addVehicleEntry({ name: d.vehicle, km_start: d.km_start, km_end: d.km_end, route: d.route, tours: d.tours });
    }
    (d.fuel_entries || []).forEach(f => addFuelEntry(f));
    (d.material_entries || d.material_movements || []).forEach(m => addMaterialEntry(m));

    Object.entries({
      wrSiteName:"site_name",
      wrDescription:"description",
      wrHours:"hours",
      wrVehicle:"vehicle",
      wrKmStart:"km_start",
      wrKmEnd:"km_end",
      wrRoute:"route",
      wrTours:"tours",
      wrMaterialManual:"material",
      wrWarehouseType:"warehouse_type",
      wrWarehouseItem:"warehouse_item",
      wrWarehouseQty:"warehouse_qty",
      wrDefect:"defect",
      wrDefectStopsWork:"defect_work_impact",
      wrDefectUrgency:"defect_urgency",
      wrDefectCalledMechanic:"called_mechanic_by_phone",
      wrSignatureName:"signature_name"
    }).forEach(([id,key]) => {
      const el = $("#" + id);
      if (el) el.value = d[key] || "";
    });

    const defectAssetEl = document.getElementById("wrDefectAssetName");
    if (defectAssetEl) defectAssetEl.value = d.defect_asset_code || d.defect_asset_name || d.defect_manual_asset_name || d.defect_machine || d.machine || "";
    const defectSiteEl = document.getElementById("wrDefectSiteName");
    if (defectSiteEl) defectSiteEl.value = d.defect_site_name || d.site_name || d.defect_site_manual_location || "";

    defectImagesDraft = normalizeDefectImages(d);
    renderDefectImagesPreview();

    if (d.signature_data_url) setSignatureImage(d.signature_data_url);
    if (moduleValue && document.getElementById("wrModuleSelect")) applyWorkerModuleSelection({ addDefaults: false });

    localStorage.setItem("swp_returned_report_id", reportId);
    localStorage.setItem("swp_returned_report_type", returnedReportType);
    updateReturnedCorrectionUi();
    toast("Izveštaj je otvoren za ispravku. Podaci su vraćeni kako su bili pre slanja — izmeni traženo i pošalji ponovo Upravi.");
    const target = moduleValue === "defect_report" ? document.getElementById("secDefects") : document.getElementById("viewWorkerForm");
    (target || document.body).scrollIntoView?.({ behavior: "smooth", block: "start" });
  } catch(e) {
    toast(e.message, true);
  }
};

function updateLeaveRequestVisibility() {
  const type = $("#wrLeaveType")?.value || "slobodan_dan";
  const single = $("#leaveSingleDayBox");
  const range = $("#leaveRangeBox");
  if (single) single.classList.toggle("hidden", type !== "slobodan_dan");
  if (range) range.classList.toggle("hidden", type !== "godisnji_odmor");
}

function getLeaveRequestData() {
  const type = $("#wrLeaveType")?.value || "slobodan_dan";
  const date = $("#wrLeaveDate")?.value || "";
  const dateFrom = $("#wrLeaveFrom")?.value || "";
  const dateTo = $("#wrLeaveTo")?.value || "";
  const note = $("#wrLeaveNote")?.value.trim() || "";
  const label = type === "godisnji_odmor" ? "Godišnji odmor" : "Slobodan dan";
  return {
    type,
    label,
    leave_type: type,
    leave_label: label,
    date,
    leave_date: date,
    date_from: dateFrom,
    date_to: dateTo,
    note,
    leave_note: note
  };
}

function hasLeaveRequestData(req) {
  if (!req) return false;
  return !!(req.date || req.date_from || req.date_to || req.note);
}

let signaturePadState = { drawing: false, hasInk: false, initialized: false };

function getSignatureCanvas() {
  return document.getElementById("wrSignatureCanvas");
}

function signatureEventPoint(evt, canvas) {
  const rect = canvas.getBoundingClientRect();
  const src = evt.touches && evt.touches.length ? evt.touches[0] : evt;
  return {
    x: (src.clientX - rect.left) * (canvas.width / rect.width),
    y: (src.clientY - rect.top) * (canvas.height / rect.height)
  };
}

function prepareSignatureCanvasBackground(canvas) {
  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function initSignaturePad() {
  const canvas = getSignatureCanvas();
  if (!canvas || signaturePadState.initialized) return;
  signaturePadState.initialized = true;
  prepareSignatureCanvasBackground(canvas);
  const ctx = canvas.getContext("2d");
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#111827";

  const start = (evt) => {
    evt.preventDefault();
    signaturePadState.drawing = true;
    const p = signatureEventPoint(evt, canvas);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (evt) => {
    if (!signaturePadState.drawing) return;
    evt.preventDefault();
    const p = signatureEventPoint(evt, canvas);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    signaturePadState.hasInk = true;
  };
  const end = (evt) => {
    if (!signaturePadState.drawing) return;
    evt.preventDefault();
    signaturePadState.drawing = false;
  };

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);
  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", end, { passive: false });
}

function clearSignatureCanvas(showToast = false) {
  const canvas = getSignatureCanvas();
  if (!canvas) return;
  prepareSignatureCanvasBackground(canvas);
  signaturePadState.hasInk = false;
  if (showToast) toast("Potpis je obrisan.");
}

function setSignatureImage(dataUrl) {
  const canvas = getSignatureCanvas();
  if (!canvas || !dataUrl) return;
  prepareSignatureCanvasBackground(canvas);
  const img = new Image();
  img.onload = () => {
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    signaturePadState.hasInk = true;
  };
  img.src = dataUrl;
}

function getSignatureData() {
  const canvas = getSignatureCanvas();
  const name = ($("#wrSignatureName")?.value || "").trim();
  if (!canvas || !signaturePadState.hasInk) {
    return { signature_data_url: "", signature_name: name, signature_signed_at: "" };
  }
  return {
    signature_data_url: canvas.toDataURL("image/png"),
    signature_name: name || currentWorker?.full_name || "",
    signature_signed_at: new Date().toISOString()
  };
}


/* v1.25.9 — Dnevnik gradilišta za odgovorno lice gradilišta / laptop unos */
let siteLogSignatureState = { initialized:false, drawing:false, hasInk:false };
let siteLogSignedFileData = null;

function getSiteLogCanvas() { return document.getElementById("siteLogSignatureCanvas"); }
function initSiteLogSignaturePad() {
  const canvas = getSiteLogCanvas();
  if (!canvas || siteLogSignatureState.initialized) return;
  siteLogSignatureState.initialized = true;
  prepareSignatureCanvasBackground(canvas);
  const ctx = canvas.getContext("2d");
  ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#111827";
  const start = (evt) => { evt.preventDefault(); siteLogSignatureState.drawing = true; const p = signatureEventPoint(evt, canvas); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const move = (evt) => { if (!siteLogSignatureState.drawing) return; evt.preventDefault(); const p = signatureEventPoint(evt, canvas); ctx.lineTo(p.x, p.y); ctx.stroke(); siteLogSignatureState.hasInk = true; };
  const end = (evt) => { if (!siteLogSignatureState.drawing) return; evt.preventDefault(); siteLogSignatureState.drawing = false; };
  canvas.addEventListener("mousedown", start); canvas.addEventListener("mousemove", move); window.addEventListener("mouseup", end);
  canvas.addEventListener("touchstart", start, { passive:false }); canvas.addEventListener("touchmove", move, { passive:false }); canvas.addEventListener("touchend", end, { passive:false });
}
function clearSiteLogSignature(showToast = false) {
  const canvas = getSiteLogCanvas(); if (!canvas) return;
  prepareSignatureCanvasBackground(canvas); siteLogSignatureState.hasInk = false;
  if (showToast) toast("Potpis dnevnika je obrisan.");
}
function getSiteLogSignatureData() {
  const canvas = getSiteLogCanvas();
  const name = ($("#siteLogSignatureName")?.value || "").trim();
  if (!canvas || !siteLogSignatureState.hasInk) return { site_log_signature_data_url:"", site_log_signature_name:name, site_log_signature_signed_at:"" };
  return { site_log_signature_data_url: canvas.toDataURL("image/png"), site_log_signature_name: name || currentWorker?.full_name || "", site_log_signature_signed_at: new Date().toISOString() };
}
function siteLogSelectSiteOptions(selectedValue = "") {
  const selected = String(selectedValue || "").trim().toLowerCase();
  if (!workerSiteOptions.length) return `<option value="">Nema gradilišta iz Uprave</option>`;
  return `<option value="">Odaberi gradilište</option>` + workerSiteOptions.map(site => {
    const name = site.name || "Gradilište"; const loc = site.location ? ` · ${site.location}` : "";
    const isSelected = selected && String(name).trim().toLowerCase() === selected ? "selected" : "";
    return `<option value="${escapeHtml(name)}" data-site-id="${escapeHtml(site.id || "")}" ${isSelected}>${escapeHtml(name + loc)}</option>`;
  }).join("");
}
function refreshSiteLogSelectors() {
  const site = $("#siteLogSite");
  if (site) { const old = site.value || ""; site.innerHTML = siteLogSelectSiteOptions(old); if (old && Array.from(site.options).some(o => o.value === old)) site.value = old; }
  $$(".site-log-material-select").forEach(sel => {
    const old = sel.value || "";
    sel.innerHTML = buildWorkerMaterialOptionsHtml(old);
    if (old && Array.from(sel.options).some(o => o.value === old)) sel.value = old;
    const card = sel.closest(".site-log-material-entry");
    if (card) fillUnitFromMaterialOption(sel, card.querySelector(".sl-material-unit"));
  });
  refreshSiteLogTruckAssetSelectors();
}
function siteLogMaterialListId(kind) {
  return ({ material_in:"siteLogMaterialIn", material_out:"siteLogMaterialOut", materials_installed:"siteLogMaterialsInstalled", materials_stock_on_site:"siteLogMaterialsStock" })[kind] || "siteLogMaterialIn";
}
function siteLogMaterialLabel(kind) {
  return ({ material_in:"Ulaz", material_out:"Izlaz", materials_installed:"Ugrađeno", materials_stock_on_site:"Lager" })[kind] || "Materijal";
}
window.addSiteLogWorkerEntry = function(values = {}) {
  const list = $("#siteLogWorkers"); if (!list) return;
  const idx = list.querySelectorAll(".site-log-worker-entry").length + 1;
  const div = document.createElement("div");
  div.className = "entry-card site-log-worker-entry";
  div.innerHTML = `
    <h5>Zaposleni ${idx}</h5>
    <div class="grid three">
      <div><label>Ime i prezime</label><input class="sl-worker-name" placeholder="Ime i prezime" value="${escapeHtml(values.full_name || values.name || "")}" /></div>
      <div><label>Sati</label><input class="sl-worker-hours numeric-text" type="text" inputmode="decimal" placeholder="8" value="${escapeHtml(values.hours || "")}" /></div>
      <div><label>Napomena</label><input class="sl-worker-note" placeholder="npr. iskop, nivelacija" value="${escapeHtml(values.note || "")}" /></div>
    </div>
    <div class="site-log-entry-actions">
      <button class="primary small-btn" type="button" onclick="addSiteLogWorkerEntry(); renumberSiteLogEntries('#siteLogWorkers','.site-log-worker-entry','Zaposleni');">+ Dodaj zaposlenog</button>
      <button class="secondary small-btn" type="button" onclick="this.closest('.site-log-worker-entry').remove(); renumberSiteLogEntries('#siteLogWorkers','.site-log-worker-entry','Zaposleni');">Ukloni zaposlenog</button>
    </div>`;
  list.appendChild(div);
};
window.addSiteLogMaterialEntry = function(kind = "material_in", values = {}) {
  const list = document.getElementById(siteLogMaterialListId(kind)); if (!list) return;
  const idx = list.querySelectorAll(".site-log-material-entry").length + 1;
  const div = document.createElement("div");
  div.className = "entry-card site-log-material-entry";
  div.dataset.kind = kind;
  const extraLabel = kind === "materials_installed" ? "Pozicija/rad" : kind === "materials_stock_on_site" ? "Lokacija/napomena" : "Napomena";
  const addLabel = ({ material_in:"+ Dodaj ulaz", material_out:"+ Dodaj izlaz", materials_installed:"+ Dodaj ugrađeni materijal", materials_stock_on_site:"+ Dodaj stanje lagera" })[kind] || "+ Dodaj materijal";
  const removeLabel = ({ material_in:"Ukloni ulaz", material_out:"Ukloni izlaz", materials_installed:"Ukloni ugrađeni materijal", materials_stock_on_site:"Ukloni stavku lagera" })[kind] || "Ukloni materijal";
  div.innerHTML = `
    <h5>${siteLogMaterialLabel(kind)} ${idx}</h5>
    <div class="grid four">
      <div><label>Materijal</label><select class="site-log-material-select sl-material-name">${buildWorkerMaterialOptionsHtml(values.material_name || values.material || "")}</select></div>
      <div><label>Količina</label><input class="sl-material-qty numeric-text" type="text" inputmode="decimal" placeholder="60" value="${escapeHtml(values.quantity || "")}" /></div>
      <div><label>Jedinica</label><input class="sl-material-unit" placeholder="m3, t, kom" value="${escapeHtml(values.unit || "m3")}" /></div>
      <div><label>${extraLabel}</label><input class="sl-material-note" placeholder="${extraLabel}" value="${escapeHtml(values.note || values.work_position || values.location_note || "")}" /></div>
    </div>
    <div class="site-log-entry-actions">
      <button class="primary small-btn" type="button" onclick="addSiteLogMaterialEntry('${kind}'); renumberSiteLogEntries('#${siteLogMaterialListId(kind)}','.site-log-material-entry','${siteLogMaterialLabel(kind)}');">${addLabel}</button>
      <button class="secondary small-btn" type="button" onclick="this.closest('.site-log-material-entry').remove(); renumberSiteLogEntries('#${siteLogMaterialListId(kind)}','.site-log-material-entry','${siteLogMaterialLabel(kind)}');">${removeLabel}</button>
    </div>`;
  div.querySelector(".sl-material-name")?.addEventListener("change", (ev) => fillUnitFromMaterialOption(ev.currentTarget, div.querySelector(".sl-material-unit"), true));
  list.appendChild(div);
  fillUnitFromMaterialOption(div.querySelector(".sl-material-name"), div.querySelector(".sl-material-unit"));
  renumberSiteLogEntries(`#${siteLogMaterialListId(kind)}`, ".site-log-material-entry", siteLogMaterialLabel(kind));
};
function buildSiteLogTruckVehicleOptionsHtml(selectedValue = "", searchValue = "") {
  const selected = String(selectedValue || "").trim();
  let vehicles = (workerAssetOptions || [])
    .filter(isVehicleAsset)
    .filter(asset => getAssetCode(asset) || getAssetName(asset) || getAssetRegistration(asset));
  vehicles = vehicles.filter(asset => vehicleMatchesSearch(asset, searchValue));
  const exact = findAssetByExactCode(searchValue);
  if (exact && !vehicles.some(v => String(v.id || "") === String(exact.id || ""))) vehicles = [exact, ...vehicles];
  if (normalizeVehicleSearch(searchValue) && !vehicles.length) vehicles = findAssetsByUniversalSearch(searchValue);
  if (!workerAssetOptions.length) return `<option value="">Nema sredstava iz Uprave</option>`;
  if (!vehicles.length) return `<option value="">Nema vozila za taj broj/pretragu</option>`;
  return `<option value="">Odaberi vozilo</option>` + vehicles.map(v => assetOptionHtml(v, selected, formatAssetLabel)).join("");
}

function updateSiteLogTruckAssetResult(card, asset, manualValue) {
  const result = card?.querySelector(".sl-truck-picked");
  if (!result) return;
  if (asset) {
    result.className = "asset-smart-result sl-truck-picked ok";
    result.textContent = `Pronađeno vozilo iz Uprave: ${formatAssetLabel(asset)}`;
    return;
  }
  const value = String(manualValue || "").trim();
  if (value) {
    result.className = "asset-smart-result sl-truck-picked warn";
    result.textContent = `Nije pronađeno u evidenciji. Biće poslato kao dodatni unos: ${value}`;
    return;
  }
  result.className = "asset-smart-result sl-truck-picked";
  result.textContent = "Za naše kamione upiši interni broj, registraciju ili naziv iz Uprave.";
}

function refreshOneSiteLogTruckAssetSelect(card) {
  if (!card) return;
  const search = card.querySelector(".sl-truck-asset-search")?.value || "";
  const select = card.querySelector(".sl-truck-asset-select");
  const custom = card.querySelector(".sl-truck-asset-custom");
  if (!select) return;
  const asset = findVehicleAssetForSmartInput(search) || findFuelAssetForSmartInput(search, "vehicle");
  const selectedValue = asset ? (getAssetName(asset) || getAssetCode(asset) || getAssetRegistration(asset)) : "";
  select.innerHTML = buildSiteLogTruckVehicleOptionsHtml(selectedValue, search);
  if (asset) {
    const option = Array.from(select.options || []).find(o => String(o.dataset.assetId || "") === String(asset.id || ""))
      || Array.from(select.options || []).find(o => o.value === getAssetName(asset));
    if (option) select.value = option.value;
    if (custom) custom.value = "";
    updateSiteLogTruckAssetResult(card, asset, "");
  } else {
    if (custom) custom.value = String(search || "").trim();
    updateSiteLogTruckAssetResult(card, null, search);
  }
}

function refreshSiteLogTruckAssetSelectors() {
  $$("#siteLogTrucks .site-log-truck-entry").forEach(card => refreshOneSiteLogTruckAssetSelect(card));
}

function siteLogTruckTypeText(type) {
  return type === "izvoz" ? "Izvoz sa gradilišta" : "Uvoz na gradilište";
}
function siteLogTransportText(source, supplier) {
  if (source === "dobavljac") return supplier ? `Spoljni dobavljač: ${supplier}` : "Spoljni dobavljač";
  return "Vozilo iz evidencije firme";
}
function updateSiteLogSupplierField(card) {
  const source = card?.querySelector(".sl-transport-source")?.value || "nasi_kamioni";
  const supplierWrap = card?.querySelector(".sl-supplier-wrap");
  if (supplierWrap) supplierWrap.style.display = source === "dobavljac" ? "block" : "none";
}
window.addSiteLogTruckEntry = function(values = {}) {
  const list = $("#siteLogTrucks"); if (!list) return;
  const idx = list.querySelectorAll(".site-log-truck-entry").length + 1;
  const div = document.createElement("div");
  div.className = "entry-card site-log-truck-entry";
  const typeVal = values.tour_type === "izvoz" ? "izvoz" : "uvoz";
  const sourceVal = values.transport_source || values.truck_source || values.carrier_type || (values.partner_company ? "dobavljac" : "nasi_kamioni");
  div.innerHTML = `
    <h5>Tura ${idx}</h5>
    <div class="grid four">
      <div><label>Vrsta transporta</label><select class="sl-truck-type"><option value="uvoz" ${typeVal === "uvoz" ? "selected" : ""}>Uvoz na gradilište</option><option value="izvoz" ${typeVal === "izvoz" ? "selected" : ""}>Izvoz sa gradilišta</option></select></div>
      <div><label>Izvor prevoza</label><select class="sl-transport-source"><option value="nasi_kamioni" ${sourceVal !== "dobavljac" ? "selected" : ""}>Vozilo iz evidencije firme</option><option value="dobavljac" ${sourceVal === "dobavljac" ? "selected" : ""}>Spoljni dobavljač</option></select></div>
      <div class="sl-supplier-wrap"><label>Naziv dobavljača / prevoznika</label><input class="sl-partner-company" placeholder="naziv firme" value="${escapeHtml(values.partner_company || values.supplier_name || "")}" /></div>
      <div><label>Vozilo / interni broj</label><input class="sl-truck-asset-search asset-code-search smart-asset-input" placeholder="upiši interni broj, registraciju ili naziv" value="${escapeHtml(values.truck_asset_code || values.asset_code || values.truck_vehicle || values.vehicle || values.truck_plate || "")}" /><div class="asset-smart-result sl-truck-picked">Za naše kamione upiši interni broj, registraciju ili naziv iz Uprave.</div><select class="sl-truck-asset-select hidden-asset-select" aria-hidden="true" tabindex="-1"></select><input class="sl-truck-asset-custom hidden-asset-custom" type="hidden" value="" /></div>
      <div><label>Ime i prezime vozača</label><input class="sl-driver-name" placeholder="ime i prezime" value="${escapeHtml(values.driver_name || "")}" /></div>
      <div><label>Materijal</label><select class="site-log-material-select sl-truck-material">${buildWorkerMaterialOptionsHtml(values.material_name || "")}</select></div>
      <div><label>Broj izvršenih tura</label><input class="sl-truck-tours numeric-text" type="text" inputmode="decimal" placeholder="4" value="${escapeHtml(values.tours || "")}" /></div>
      <div><label>m³</label><input class="sl-truck-m3 numeric-text" type="text" inputmode="decimal" placeholder="32" value="${escapeHtml(values.m3 || "")}" /></div>
      <div><label>Napomena</label><input class="sl-truck-note" placeholder="napomena" value="${escapeHtml(values.note || "")}" /></div>
    </div>
    <div class="site-log-entry-actions">
      <button class="primary small-btn" type="button" onclick="addSiteLogTruckEntry(); renumberSiteLogEntries('#siteLogTrucks','.site-log-truck-entry','Tura');">+ Dodaj kamionsku turu</button>
      <button class="secondary small-btn" type="button" onclick="this.closest('.site-log-truck-entry').remove(); renumberSiteLogEntries('#siteLogTrucks','.site-log-truck-entry','Tura');">Ukloni kamionsku turu</button>
    </div>`;
  list.appendChild(div);
  div.querySelector(".sl-transport-source")?.addEventListener("change", () => updateSiteLogSupplierField(div));
  div.querySelector(".sl-truck-asset-search")?.addEventListener("input", () => refreshOneSiteLogTruckAssetSelect(div));
  div.querySelector(".sl-truck-material")?.addEventListener("change", () => {});
  updateSiteLogSupplierField(div);
  refreshOneSiteLogTruckAssetSelect(div);
};
function renumberSiteLogEntries(listSel, itemSel, label) {
  $$(listSel + " " + itemSel).forEach((card, i) => { const h = card.querySelector("h5"); if (h) h.textContent = `${label} ${i + 1}`; });
}
function getSiteLogSite() {
  const el = $("#siteLogSite"); const option = el?.options ? el.options[el.selectedIndex] : null;
  return { site_id: option?.dataset?.siteId || null, site_name: (el?.value || "").trim() };
}
function collectSiteLogWorkers() {
  return $$("#siteLogWorkers .site-log-worker-entry").map(el => ({ full_name: el.querySelector(".sl-worker-name")?.value.trim() || "", hours: el.querySelector(".sl-worker-hours")?.value.trim() || "", note: el.querySelector(".sl-worker-note")?.value.trim() || "" })).filter(x => x.full_name || x.hours || x.note);
}
function collectSiteLogMaterials(kind) {
  return $$(`#${siteLogMaterialListId(kind)} .site-log-material-entry`).map(el => {
    const sel = el.querySelector(".sl-material-name"); const opt = sel?.options ? sel.options[sel.selectedIndex] : null; const note = el.querySelector(".sl-material-note")?.value.trim() || "";
    const obj = { material_id: opt?.dataset?.materialId || "", material_name: sel?.value.trim() || "", quantity: el.querySelector(".sl-material-qty")?.value.trim() || "", unit: el.querySelector(".sl-material-unit")?.value.trim() || "m3", note };
    if (kind === "materials_installed") obj.work_position = note;
    if (kind === "materials_stock_on_site") obj.location_note = note;
    return obj;
  }).filter(x => x.material_name || x.quantity || x.note);
}
function collectSiteLogTrucks() {
  return $$("#siteLogTrucks .site-log-truck-entry").map(el => {
    const mat = el.querySelector(".sl-truck-material"); const opt = mat?.options ? mat.options[mat.selectedIndex] : null;
    const transport_source = el.querySelector(".sl-transport-source")?.value || "nasi_kamioni";
    const partner_company = transport_source === "dobavljac" ? (el.querySelector(".sl-partner-company")?.value.trim() || "") : "";
    const assetSearch = el.querySelector(".sl-truck-asset-search")?.value.trim() || "";
    const assetSelect = el.querySelector(".sl-truck-asset-select");
    const assetOpt = assetSelect?.options ? assetSelect.options[assetSelect.selectedIndex] : null;
    const manualAsset = el.querySelector(".sl-truck-asset-custom")?.value.trim() || "";
    const asset = findVehicleAssetForSmartInput(assetSearch) || findFuelAssetForSmartInput(assetSearch, "vehicle");
    const truckAssetCode = asset ? getAssetCode(asset) : "";
    const truckAssetName = asset ? getAssetName(asset) : (manualAsset || assetSearch);
    const truckPlate = asset ? (getAssetRegistration(asset) || truckAssetCode || truckAssetName) : (manualAsset || assetSearch);
    return {
      tour_type: el.querySelector(".sl-truck-type")?.value || "uvoz",
      transport_source,
      partner_company,
      supplier_name: partner_company,
      truck_asset_id: asset ? (asset.id || assetOpt?.dataset?.assetId || "") : "",
      truck_asset_code: truckAssetCode || (assetOpt?.dataset?.assetCode || ""),
      truck_vehicle_name: truckAssetName,
      truck_plate: truckPlate,
      driver_name: el.querySelector(".sl-driver-name")?.value.trim() || "",
      material_id: opt?.dataset?.materialId || "",
      material_name: mat?.value.trim() || "",
      tours: el.querySelector(".sl-truck-tours")?.value.trim() || "",
      m3: el.querySelector(".sl-truck-m3")?.value.trim() || "",
      note: el.querySelector(".sl-truck-note")?.value.trim() || ""
    };
  }).filter(x => x.partner_company || x.truck_plate || x.truck_vehicle_name || x.driver_name || x.material_name || x.tours || x.m3 || x.note);
}
function collectSiteLogData() {
  const site = getSiteLogSite();
  const sig = getSiteLogSignatureData();
  return {
    report_type: "site_daily_log",
    report_label: "Dnevnik gradilišta",
    created_by_worker: currentWorker?.full_name || "",
    function_title: currentWorker?.function_title || "",
    site_id: site.site_id,
    site_name: site.site_name,
    report_date_manual: $("#siteLogDate")?.value || today(),
    workers: collectSiteLogWorkers(),
    worker_entries: collectSiteLogWorkers(),
    today_work_description: $("#siteLogDescription")?.value.trim() || "",
    tomorrow_work_plan: $("#siteLogTomorrowPlan")?.value.trim() || "",
    material_in: collectSiteLogMaterials("material_in"),
    material_out: collectSiteLogMaterials("material_out"),
    materials_installed: collectSiteLogMaterials("materials_installed"),
    materials_stock_on_site: collectSiteLogMaterials("materials_stock_on_site"),
    truck_tours: collectSiteLogTrucks(),
    signature_mode: sig.site_log_signature_data_url ? "app_signature" : (siteLogSignedFileData ? "uploaded_signed_file" : "none"),
    signed_file: siteLogSignedFileData,
    ...sig,
    report_sections_sent: { site_daily_log:true }
  };
}
function siteLogTable(headers, rows, cellsFn) {
  if (!rows || !rows.length) return `<p class="report-empty">Nema unosa.</p>`;
  return `<table class="report-mini-table"><thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r,i)=>`<tr>${cellsFn(r,i).map(c=>`<td>${escapeHtml(c || "")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}
function renderSiteLogA4(data = collectSiteLogData()) {
  const signed = data.site_log_signature_data_url ? `<div class="paper-signature-box"><img src="${escapeHtml(data.site_log_signature_data_url)}" alt="Potpis"/><div><b>${escapeHtml(data.site_log_signature_name || data.created_by_worker || "Potpisnik")}</b><span>${escapeHtml(formatDateTimeLocal(data.site_log_signature_signed_at) || "")}</span></div></div>` : `<div class="paper-signature-line">Potpis odgovornog lica gradilišta</div>`;
  const uploaded = data.signed_file ? `<p class="signed-file-note">Dodat potpisan dokument: <b>${escapeHtml(data.signed_file.name || "fajl")}</b>. Fajl se čuva kao dokaz uz izveštaj.</p>` : "";
  return `<section class="report-paper-view site-log-a4" id="site-log-paper">
    <div class="paper-title-block"><h3>DNEVNIK GRADILIŠTA</h3><p>A4 pregled za štampu, potpis i slanje Upravi firme</p></div>
    <table class="paper-meta-table"><tbody>
      <tr><th>Firma</th><td>${escapeHtml(currentWorker?.company_name || "—")}</td><th>Datum izveštaja</th><td>${escapeHtml(data.report_date_manual || today())}</td></tr>
      <tr><th>Gradilište</th><td>${escapeHtml(data.site_name || "—")}</td><th>Uneo</th><td>${escapeHtml(data.created_by_worker || "—")}</td></tr>
      <tr><th>Radno mesto</th><td>${escapeHtml(data.function_title || "—")}</td><th>Vreme pregleda</th><td>${escapeHtml(formatDateTimeLocal(new Date().toISOString()) || "")}</td></tr>
    </tbody></table>
    <div class="report-section"><h4>Evidencija zaposlenih i radnih sati</h4>${siteLogTable(["#","Ime i prezime","Sati","Napomena"], data.workers, (w,i)=>[String(i+1), w.full_name, w.hours, w.note])}</div>
    <div class="report-section"><h4>Opis radova danas</h4><p>${escapeHtml(data.today_work_description || "—")}</p></div>
    <div class="report-section"><h4>Plan radova za naredni dan</h4><p>${escapeHtml(data.tomorrow_work_plan || "—")}</p></div>
    <div class="report-section"><h4>Ulaz materijala</h4>${siteLogTable(["#","Materijal","Količina","Jed.","Napomena"], data.material_in, (m,i)=>[String(i+1), m.material_name, m.quantity, m.unit, m.note])}</div>
    <div class="report-section"><h4>Izlaz materijala</h4>${siteLogTable(["#","Materijal","Količina","Jed.","Napomena"], data.material_out, (m,i)=>[String(i+1), m.material_name, m.quantity, m.unit, m.note])}</div>
    <div class="report-section"><h4>Ugrađeni materijali</h4>${siteLogTable(["#","Materijal","Količina","Jed.","Pozicija/rad"], data.materials_installed, (m,i)=>[String(i+1), m.material_name, m.quantity, m.unit, m.work_position || m.note])}</div>
    <div class="report-section"><h4>Stanje materijala na gradilištu</h4>${siteLogTable(["#","Materijal","Količina","Jed.","Lokacija/napomena"], data.materials_stock_on_site, (m,i)=>[String(i+1), m.material_name, m.quantity, m.unit, m.location_note || m.note])}</div>
    <div class="report-section"><h4>Evidencija kamionskih tura</h4>${siteLogTable(["#","Vrsta transporta","Izvor prevoza","Spoljni dobavljač","Reg. oznake","Ime i prezime vozača","Materijal","Broj tura","m³","Napomena"], data.truck_tours, (t,i)=>[String(i+1), siteLogTruckTypeText(t.tour_type), siteLogTransportText(t.transport_source, t.partner_company), t.partner_company, t.truck_plate, t.driver_name, t.material_name, t.tours, t.m3, t.note])}</div>
    <div class="report-section report-signature-section"><h4>Potpis / overa dokumenta</h4>${signed}${uploaded}</div>
    <div class="paper-footer-note">Dnevnik pripremljen u AskCreate.app · podaci za Excel dolaze iz forme, uploadovani dokument je dokaz.</div>
  </section>`;
}
function previewSiteLog() {
  const box = $("#siteLogPreviewBox"); if (!box) return;
  box.innerHTML = renderSiteLogA4(); box.classList.remove("hidden");
  ["#siteLogEditBtn", "#siteLogPrintBtn", "#siteLogDownloadBtn", "#siteLogSubmitBtn"].forEach(sel => $(sel)?.classList.remove("hidden"));
  $("#siteLogStatusBadge") && ($("#siteLogStatusBadge").textContent = "Pregled");
  box.scrollIntoView({ behavior:"smooth", block:"start" });
}
function editSiteLog() { $("#siteLogPreviewBox")?.classList.add("hidden"); $("#siteLogStatusBadge") && ($("#siteLogStatusBadge").textContent = "Nacrt"); }
function buildSiteLogStandaloneHtml(data = collectSiteLogData()) {
  // v1.26.4: posebna PRINT/PDF verzija. Ne koristi CSS aplikacije niti html2pdf.
  // Cilj: crn tekst, bela pozadina, bez bledih slova i bez prazne strane.
  const title = safeFilePart(`dnevnik-gradilista_${data.report_date_manual || today()}_${data.site_name || "gradiliste"}`);
  const e = (v) => escapeHtml(v == null || v === "" ? "—" : String(v));
  const plain = (v) => escapeHtml(v == null ? "" : String(v));
  const paragraph = (v) => `<div class="text-block">${e(v)}</div>`;
  const table = (heads, rows, mapRow) => {
    if (!rows || !rows.length) return `<div class="empty-row">Nema unosa.</div>`;
    return `<table><thead><tr>${heads.map(h => `<th>${plain(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row, i) => `<tr>${mapRow(row, i).map(c => `<td>${e(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  };
  const section = (name, content) => `<section><h2>${plain(name)}</h2>${content}</section>`;
  const signatureBlock = data.site_log_signature_data_url
    ? `<div class="signature-box"><img src="${plain(data.site_log_signature_data_url)}" alt="Potpis"><div><b>${e(data.site_log_signature_name || data.created_by_worker || "Potpisnik")}</b><br><span>${e(formatDateTimeLocal(data.site_log_signature_signed_at) || "")}</span></div></div>`
    : `<div class="signature-line">Potpis odgovornog lica gradilišta</div>`;
  const uploaded = data.signed_file
    ? `<div class="file-note">Dodat potpisan dokument: <b>${e(data.signed_file.name || "fajl")}</b>. Uploadovani fajl služi kao dokaz; Excel koristi podatke iz forme.</div>`
    : "";

  const html = `
    <main class="paper">
      <header>
        <h1>DNEVNIK GRADILIŠTA</h1>
        <p>A4 pregled za štampu, potpis i slanje Upravi firme</p>
      </header>

      <table class="meta"><tbody>
        <tr><th>Firma</th><td>${e(currentWorker?.company_name || "—")}</td><th>Datum izveštaja</th><td>${e(data.report_date_manual || today())}</td></tr>
        <tr><th>Gradilište</th><td>${e(data.site_name || "—")}</td><th>Uneo</th><td>${e(data.created_by_worker || "—")}</td></tr>
        <tr><th>Radno mesto</th><td>${e(data.function_title || "—")}</td><th>Vreme pregleda</th><td>${e(formatDateTimeLocal(new Date().toISOString()) || "")}</td></tr>
      </tbody></table>

      ${section("1. Evidencija zaposlenih i radnih sati", table(["#", "Ime i prezime", "Sati", "Napomena"], data.workers, (w,i)=>[i+1, w.full_name, w.hours, w.note]))}
      ${section("2. Opis radova danas", paragraph(data.today_work_description))}
      ${section("3. Plan radova za naredni dan", paragraph(data.tomorrow_work_plan))}
      ${section("4. Ulaz materijala", table(["#", "Materijal", "Količina", "Jed.", "Napomena"], data.material_in, (m,i)=>[i+1, m.material_name, m.quantity, m.unit, m.note]))}
      ${section("5. Izlaz materijala", table(["#", "Materijal", "Količina", "Jed.", "Napomena"], data.material_out, (m,i)=>[i+1, m.material_name, m.quantity, m.unit, m.note]))}
      ${section("6. Ugrađeni materijali", table(["#", "Materijal", "Količina", "Jed.", "Pozicija/rad"], data.materials_installed, (m,i)=>[i+1, m.material_name, m.quantity, m.unit, m.work_position || m.note]))}
      ${section("7. Stanje materijala na gradilištu", table(["#", "Materijal", "Količina", "Jed.", "Lokacija/napomena"], data.materials_stock_on_site, (m,i)=>[i+1, m.material_name, m.quantity, m.unit, m.location_note || m.note]))}
      ${section("8. Evidencija kamionskih tura", table(["#", "Vrsta transporta", "Izvor prevoza", "Spoljni dobavljač", "Reg. oznake", "Ime i prezime vozača", "Materijal", "Broj tura", "m³", "Napomena"], data.truck_tours, (t,i)=>[i+1, siteLogTruckTypeText(t.tour_type), siteLogTransportText(t.transport_source, t.partner_company), t.partner_company, t.truck_plate, t.driver_name, t.material_name, t.tours, t.m3, t.note]))}
      ${section("9. Potpis / overa dokumenta", signatureBlock + uploaded)}

      <footer>Dnevnik pripremljen u AskCreate.app · podaci za Excel dolaze iz forme.</footer>
    </main>`;

  return `<!doctype html>
<html lang="sr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 portrait; margin: 11mm; }
    html, body { margin:0; padding:0; background:#fff; color:#000; font-family: Arial, Helvetica, sans-serif; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    *, *::before, *::after { box-sizing:border-box; color:#000 !important; opacity:1 !important; text-shadow:none !important; filter:none !important; }
    .paper { width:188mm; margin:0 auto; background:#fff; color:#000; font-size:13px; line-height:1.32; }
    header { text-align:center; border-bottom:2px solid #000; padding:0 0 7px; margin:0 0 8px; }
    h1 { margin:0; font-size:22px; letter-spacing:.04em; font-weight:900; }
    header p { margin:4px 0 0; font-size:12px; font-weight:700; }
    table { width:100%; border-collapse:collapse; margin:0; page-break-inside:auto; }
    th, td { border:1px solid #111; padding:5px 6px; vertical-align:top; font-size:12.5px; }
    th { background:#e5f0e8 !important; font-weight:900; text-align:left; }
    td { font-weight:700; }
    .meta { margin:7px 0 9px; }
    .meta th { width:18%; }
    .meta td { width:32%; }
    section { margin:8px 0; page-break-inside:avoid; break-inside:avoid; }
    h2 { margin:0 0 4px; padding-bottom:3px; border-bottom:1.5px solid #000; font-size:13px; font-weight:900; text-transform:uppercase; }
    .text-block, .empty-row, .file-note { border:1px solid #111; padding:7px 8px; min-height:28px; white-space:pre-wrap; font-weight:700; background:#fff; }
    .empty-row { color:#000 !important; font-style:normal; }
    .signature-box { border:1px solid #111; min-height:76px; padding:8px; display:flex; align-items:center; gap:14px; page-break-inside:avoid; }
    .signature-box img { max-width:250px; max-height:64px; object-fit:contain; background:#fff; border-bottom:1.5px solid #000; }
    .signature-box b { font-size:12px; }
    .signature-box span { font-size:11px; font-weight:700; }
    .signature-line { margin-top:28px; border-top:1.5px solid #000; width:270px; padding-top:6px; font-size:12px; text-align:center; font-weight:800; }
    .file-note { margin-top:8px; font-size:11.5px; }
    footer { margin-top:10px; padding-top:5px; border-top:1px solid #000; font-size:10.5px; font-weight:700; }
    @media screen { body { padding:12px; background:#e5e7eb; } .paper { padding:10mm; box-shadow:0 0 0 1px #ccc, 0 14px 45px rgba(0,0,0,.18); } }
    @media print { body { background:#fff; } .paper { width:100%; padding:0; box-shadow:none; } }
  </style>
</head>
<body>${html}</body>
</html>`;
}
function openSiteLogPrintWindow(mode = "print") {
  const data = collectSiteLogData();
  const html = buildSiteLogStandaloneHtml(data);
  const w = window.open("", "_blank", "width=950,height=900");
  if (!w) {
    toast("Browser je blokirao novi prozor. Dozvoli pop-up za askcreate.app pa probaj ponovo.", true);
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  const runPrint = () => {
    try { w.focus(); w.print(); }
    catch (err) { console.error(err); toast("Ne mogu da otvorim štampu u ovom browseru.", true); }
  };
  setTimeout(runPrint, 500);
  if (mode === "pdf") {
    toast("Otvoren je čist A4 prikaz. U prozoru za štampu izaberi: Destination/Odredište → Save as PDF.");
  }
}

function printSiteLog() {
  // v1.26.4: štampanje ide iz čistog odvojenog A4 prozora, bez tamne aplikacije u pozadini.
  openSiteLogPrintWindow("print");
}

async function downloadSiteLogA4() {
  // v1.26.4: html2pdf je davao bled/ružan PDF. Stabilnije je browser "Save as PDF" iz čistog A4 prozora.
  openSiteLogPrintWindow("pdf");
}
function saveSiteLogDraft() {
  const data = collectSiteLogData();
  localStorage.setItem(`swp_site_log_draft_${currentWorker?.id || currentWorker?.access_code || "worker"}`, JSON.stringify(data));
  toast("Nacrt dnevnika gradilišta je sačuvan na ovom uređaju.");
}
function drawSiteLogSignatureFromDataUrl(dataUrl) {
  const canvas = getSiteLogCanvas();
  if (!canvas || !dataUrl) return;
  const ctx = canvas.getContext("2d");
  const img = new Image();
  img.onload = () => {
    prepareSignatureCanvasBackground(canvas);
    const ratio = Math.min(canvas.width / img.width, canvas.height / img.height, 1);
    const w = img.width * ratio;
    const h = img.height * ratio;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;
    ctx.drawImage(img, x, y, w, h);
    siteLogSignatureState.hasInk = true;
  };
  img.src = dataUrl;
}

function clearSiteLogFormLists() {
  ["#siteLogWorkers", "#siteLogMaterialIn", "#siteLogMaterialOut", "#siteLogMaterialsInstalled", "#siteLogMaterialsStock", "#siteLogTrucks"].forEach(sel => {
    const el = $(sel);
    if (el) el.innerHTML = "";
  });
}

function loadSiteLogDataIntoForm(d = {}, r = {}) {
  if (!(currentWorker?.permissions || {}).site_daily_log) {
    throw new Error("Ovaj profil nema uključenu rubriku Dnevnik gradilišta.");
  }
  if (typeof initSiteLogPanel === "function") initSiteLogPanel();
  if ($("#siteLogDate")) $("#siteLogDate").value = r.report_date || d.report_date_manual || today();
  if ($("#siteLogDescription")) $("#siteLogDescription").value = d.today_work_description || d.description || "";
  if ($("#siteLogTomorrowPlan")) $("#siteLogTomorrowPlan").value = d.tomorrow_work_plan || "";
  if ($("#siteLogSignatureName")) $("#siteLogSignatureName").value = d.site_log_signature_name || d.created_by_worker || currentWorker?.full_name || "";
  clearSiteLogFormLists();
  (d.workers || d.worker_entries || []).forEach(addSiteLogWorkerEntry);
  (d.material_in || []).forEach(x => addSiteLogMaterialEntry("material_in", x));
  (d.material_out || []).forEach(x => addSiteLogMaterialEntry("material_out", x));
  (d.materials_installed || []).forEach(x => addSiteLogMaterialEntry("materials_installed", x));
  (d.materials_stock_on_site || []).forEach(x => addSiteLogMaterialEntry("materials_stock_on_site", x));
  (d.truck_tours || []).forEach(addSiteLogTruckEntry);
  siteLogSignedFileData = d.signed_file || null;
  updateSiteLogSignedFileInfo();
  refreshSiteLogSelectors();
  if (d.site_name && $("#siteLogSite")) $("#siteLogSite").value = d.site_name;
  clearSiteLogSignature(false);
  if (d.site_log_signature_data_url) drawSiteLogSignatureFromDataUrl(d.site_log_signature_data_url);
  if (!$("#siteLogWorkers")?.children.length) addSiteLogWorkerEntry();
  if (!$("#siteLogMaterialIn")?.children.length) addSiteLogMaterialEntry("material_in");
  if (!$("#siteLogMaterialsStock")?.children.length) addSiteLogMaterialEntry("materials_stock_on_site", { unit:"m3" });
  $("#siteLogPreviewBox")?.classList.add("hidden");
  if ($("#siteLogStatusBadge")) $("#siteLogStatusBadge").textContent = "Vraćeno na ispravku";
}

function loadSiteLogDraft() {
  try {
    const raw = localStorage.getItem(`swp_site_log_draft_${currentWorker?.id || currentWorker?.access_code || "worker"}`); if (!raw) return false;
    const d = JSON.parse(raw); if (!d) return false;
    if ($("#siteLogDate")) $("#siteLogDate").value = d.report_date_manual || today();
    if ($("#siteLogDescription")) $("#siteLogDescription").value = d.today_work_description || "";
    if ($("#siteLogTomorrowPlan")) $("#siteLogTomorrowPlan").value = d.tomorrow_work_plan || "";
    if ($("#siteLogSignatureName")) $("#siteLogSignatureName").value = d.site_log_signature_name || "";
    ["#siteLogWorkers","#siteLogMaterialIn","#siteLogMaterialOut","#siteLogMaterialsInstalled","#siteLogMaterialsStock","#siteLogTrucks"].forEach(sel => { const el = $(sel); if (el) el.innerHTML = ""; });
    (d.workers || []).forEach(addSiteLogWorkerEntry);
    (d.material_in || []).forEach(x => addSiteLogMaterialEntry("material_in", x));
    (d.material_out || []).forEach(x => addSiteLogMaterialEntry("material_out", x));
    (d.materials_installed || []).forEach(x => addSiteLogMaterialEntry("materials_installed", x));
    (d.materials_stock_on_site || []).forEach(x => addSiteLogMaterialEntry("materials_stock_on_site", x));
    (d.truck_tours || []).forEach(addSiteLogTruckEntry);
    siteLogSignedFileData = d.signed_file || null; updateSiteLogSignedFileInfo(); refreshSiteLogSelectors();
    if (d.site_name && $("#siteLogSite")) $("#siteLogSite").value = d.site_name;
    return true;
  } catch { return false; }
}
function updateSiteLogSignedFileInfo() {
  const info = $("#siteLogSignedFileInfo"); if (!info) return;
  if (!siteLogSignedFileData) { info.textContent = "Nije dodat potpisan dokument."; return; }
  info.innerHTML = `Dodat fajl: <b>${escapeHtml(siteLogSignedFileData.name || "potpisan dokument")}</b> · ${(siteLogSignedFileData.size/1024).toFixed(0)} KB`;
}
function initSiteLogPanel() {
  initSiteLogSignaturePad();
  if ($("#siteLogDate") && !$("#siteLogDate").value) $("#siteLogDate").value = today();
  refreshSiteLogSelectors();
  if (!$$("#siteLogWorkers .site-log-worker-entry").length) addSiteLogWorkerEntry();
  if (!$$("#siteLogMaterialIn .site-log-material-entry").length) addSiteLogMaterialEntry("material_in");
  if (!$$("#siteLogMaterialsStock .site-log-material-entry").length) addSiteLogMaterialEntry("materials_stock_on_site", { material_name:"", unit:"m3" });
  const clearBtn = $("#clearSiteLogSignatureBtn"); if (clearBtn && !clearBtn.dataset.bound) { clearBtn.dataset.bound = "1"; clearBtn.addEventListener("click", () => clearSiteLogSignature(true)); }
  const file = $("#siteLogSignedFile"); if (file && !file.dataset.bound) { file.dataset.bound = "1"; file.addEventListener("change", () => {
    const f = file.files && file.files[0]; if (!f) { siteLogSignedFileData = null; updateSiteLogSignedFileInfo(); return; }
    if (f.size > 2 * 1024 * 1024) { file.value = ""; siteLogSignedFileData = null; updateSiteLogSignedFileInfo(); return toast("Fajl je veći od 2 MB. Za sada učitaj manji PDF/sliku.", true); }
    const reader = new FileReader(); reader.onload = () => { siteLogSignedFileData = { name:f.name, type:f.type, size:f.size, data_url:reader.result }; updateSiteLogSignedFileInfo(); toast("Potpisan dokument je dodat kao dokaz."); }; reader.readAsDataURL(f);
  }); }
  const bind = (id, fn) => { const el = $(id); if (el && !el.dataset.bound) { el.dataset.bound = "1"; el.addEventListener("click", fn); } };
  bind("#siteLogSaveDraftBtn", saveSiteLogDraft); bind("#siteLogPreviewBtn", previewSiteLog); bind("#siteLogEditBtn", editSiteLog); bind("#siteLogPrintBtn", printSiteLog); bind("#siteLogDownloadBtn", downloadSiteLogA4); bind("#siteLogSubmitBtn", submitSiteLogToDirector);
  bind("#siteBossRefreshOverviewBtn", refreshSiteBossOverview);
  bind("#siteBossCopySummaryBtn", copySiteBossSummaryToDailyLog);
  const siteLogDate = $("#siteLogDate");
  if (siteLogDate && !siteLogDate.dataset.siteBossBound) { siteLogDate.dataset.siteBossBound = "1"; siteLogDate.addEventListener("change", () => { siteBossOverviewCache = null; siteBossMetricSet(null); }); }
  const siteLogSite = $("#siteLogSite");
  if (siteLogSite && !siteLogSite.dataset.siteBossBound) { siteLogSite.dataset.siteBossBound = "1"; siteLogSite.addEventListener("change", () => { siteBossOverviewCache = null; siteBossMetricSet(null); }); }
}
function hasSiteLogAnyContent(d) {
  return !!(d.site_name || d.today_work_description || d.tomorrow_work_plan || d.workers.length || d.material_in.length || d.material_out.length || d.materials_installed.length || d.materials_stock_on_site.length || d.truck_tours.length);
}

function isStaleReturnedReportError(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  return msg.includes("nije prona") || msg.includes("not found") || msg.includes("statusu returned") || msg.includes("status returned") || msg.includes("returned report") || msg.includes("više nije");
}

function clearReturnedReportContext() {
  try {
    localStorage.removeItem("swp_returned_report_id");
    localStorage.removeItem("swp_returned_report_type");
    localStorage.removeItem("swp_returned_report_reason");
  } catch {}
  updateReturnedCorrectionUi();
}

function updateReturnedCorrectionUi() {
  const returnedId = (() => { try { return localStorage.getItem("swp_returned_report_id") || ""; } catch { return ""; } })();
  const returnedType = (() => { try { return localStorage.getItem("swp_returned_report_type") || ""; } catch { return ""; } })();
  const isCorrection = !!returnedId;
  const isDefectCorrection = isCorrection && ["defect_report", "defect_alert", "defect_record"].includes(returnedType);
  const submitBtn = document.getElementById("submitReportBtn");
  const defectBtn = document.getElementById("sendDefectNowBtn");
  if (submitBtn) submitBtn.textContent = isCorrection ? "Pošalji ispravljen izveštaj" : "Pošalji izveštaj";
  if (defectBtn) defectBtn.textContent = isDefectCorrection ? "Pošalji ispravljen kvar" : "🚨 Evidentiraj kvar odmah";
}

function makeReportEventId(prefix = "evt") {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return prefix + "_" + window.crypto.randomUUID();
  return prefix + "_" + Date.now() + "_" + Math.random().toString(16).slice(2, 8);
}

function buildCorrectionEvent(label, note = "") {
  const worker = currentWorker || {};
  return {
    id: makeReportEventId("defevt"),
    status: "ponovo_poslato",
    label: label || "Radnik ponovo poslao ispravku",
    actor_name: worker.full_name || "Radnik",
    actor_role: worker.function_title || "Radnik",
    note: note || "",
    at: new Date().toISOString()
  };
}

function mergeCorrectionHistoryForResubmit(reportData = {}, returnedReport = null) {
  const oldData = returnedReport?.data || {};
  const reason = returnedReport?.returned_reason || oldData.returned_reason || "";
  const oldTimeline = Array.isArray(oldData.defect_timeline) ? oldData.defect_timeline : (Array.isArray(oldData.defect_history) ? oldData.defect_history : []);
  const newTimeline = Array.isArray(reportData.defect_timeline) ? reportData.defect_timeline : [];
  const correctionEvent = buildCorrectionEvent("Radnik ponovo poslao ispravljen kvar", reason ? `Ispravljeno po razlogu Direkcije: ${reason}` : "");

  reportData.defect_timeline = [...oldTimeline, ...newTimeline, correctionEvent];
  reportData.defect_history = reportData.defect_timeline;
  reportData.correction_history = [
    ...(Array.isArray(oldData.correction_history) ? oldData.correction_history : []),
    {
      id: makeReportEventId("corr"),
      returned_reason: reason,
      returned_at: oldData.returned_at || oldData.returned_for_correction_at || returnedReport?.updated_at || "",
      resubmitted_at: new Date().toISOString(),
      resubmitted_by: currentWorker?.full_name || "Radnik"
    }
  ];
  reportData.returned_reason = reason;
  reportData.resubmitted_after_correction = true;
  reportData.waiting_director_review = true;
  reportData.director_review_required = true;
  reportData.resubmitted_at = new Date().toISOString();
  reportData.defect_status = "ponovo_poslato";
  reportData.mechanic_status = "ponovo_poslato";
  return reportData;
}

async function submitSiteLogToDirector() {
  try {
    if (!navigator.onLine) { saveSiteLogDraft(); throw new Error("Nema interneta. Nacrt dnevnika je sačuvan na ovom uređaju."); }
    const worker = currentWorker || JSON.parse(localStorage.getItem("swp_worker") || "null"); if (!worker) throw new Error("Zaposleni nije prijavljen.");
    const data = collectSiteLogData();
    if (!data.site_name) throw new Error("Odaberi gradilište iz liste Uprave firme.");
    if (!hasSiteLogAnyContent(data)) throw new Error("Popuni bar jedan deo dnevnika pre slanja.");
    if (!data.site_log_signature_data_url && !data.signed_file) throw new Error("Dodaj potpis u aplikaciji ili učitaj potpisan dokument pre slanja Upravi firme.");
    const reportDate = data.report_date_manual || today();
    const returnedId = localStorage.getItem("swp_returned_report_id");
    if (returnedId) {
      let returnedStillExists = null;
      try { returnedStillExists = await getReturnedReportForWorker(returnedId); } catch { returnedStillExists = null; }
      if (!returnedStillExists) {
        clearReturnedReportContext();
        $("#siteLogStatusBadge") && ($("#siteLogStatusBadge").textContent = "Novi dnevnik");
        toast("Stari vraćeni izveštaj više nije aktivan. Ovaj unos šaljem kao novi Dnevnik gradilišta.");
      } else {
        const { error } = await sb.rpc("worker_resubmit_returned_report", {
          p_company_code: worker.company_code,
          p_access_code: worker.access_code,
          p_report_id: returnedId,
          p_report_date: reportDate,
          p_site_id: data.site_id || null,
          p_data: data
        });
        if (error) {
          if (isStaleReturnedReportError(error)) {
            clearReturnedReportContext();
            $("#siteLogStatusBadge") && ($("#siteLogStatusBadge").textContent = "Novi dnevnik");
            toast("Vraćeni izveštaj više nije dostupan. Ovaj unos šaljem kao novi Dnevnik gradilišta.");
          } else {
            throw error;
          }
        } else {
          clearReturnedReportContext();
          localStorage.removeItem(`swp_site_log_draft_${currentWorker?.id || currentWorker?.access_code || "worker"}`);
          $("#siteLogStatusBadge") && ($("#siteLogStatusBadge").textContent = "Ponovo poslato Upravi firme");
          loadWorkerReturnedReports();
          toast("Ispravljen Dnevnik gradilišta je ponovo poslat Upravi firme ✅");
          return;
        }
      }
    }
    const { error } = await sb.rpc("submit_worker_report", { p_company_code: worker.company_code, p_access_code: worker.access_code, p_report_date: reportDate, p_site_id: data.site_id || null, p_data: data });
    if (error) throw error;
    localStorage.removeItem(`swp_site_log_draft_${currentWorker?.id || currentWorker?.access_code || "worker"}`);
    $("#siteLogStatusBadge") && ($("#siteLogStatusBadge").textContent = "Poslato Upravi firme");
    toast("Dnevnik gradilišta je poslat Upravi firme ✅");
  } catch (e) { toast(e.message, true); }
}

function collectWorkerData() {
  const perms = currentWorker?.permissions || {};
  const activeKeys = activeWorkerSectionKeys(perms);
  const selectedModule = getSelectedWorkerModule();
  const machines = activeKeys.has("machines") ? getMachineEntries() : [];
  const vehicles = activeKeys.has("vehicles") ? getVehicleEntries() : [];
  const fuelEntries = activeKeys.has("fuel") ? getFuelEntries() : [];
  const selectedSite = getSelectedWorkerSite();
  const canDaily = activeKeys.has("daily_work");
  const canWorkers = activeKeys.has("workers");
  const canMaterials = activeKeys.has("materials");
  const canSignature = activeKeys.has("signature");
  const canLeaveRequest = activeKeys.has("leave_request");
  const canWarehouse = activeKeys.has("warehouse");
  const canDefects = activeKeys.has("defects");
  const canLowloader = activeKeys.has("lowloader");
  const canWaterTanker = activeKeys.has("water_tanker");
  const canFieldTanker = activeKeys.has("field_tanker");
  const lowloaderMoves = canLowloader ? getLowloaderEntries() : [];
  const waterTankerEntries = canWaterTanker ? getWaterTankerEntries() : [];
  const fieldTankerEntries = canFieldTanker ? getFieldTankerEntries() : [];
  const materialEntries = canMaterials ? getMaterialEntries() : [];
  const dailyItemSiteSummary = summarizeSitesFromDailyItems([...(machines || []), ...(vehicles || []), ...(waterTankerEntries || []), ...(materialEntries || [])]);
  const leaveRequest = canLeaveRequest ? getLeaveRequestData() : null;

  const defectAssetPayload = canDefects ? getDefectAssetPayload() : {
    defect_asset_kind: "",
    defect_asset_id: "",
    defect_asset_code: "",
    defect_asset_name: "",
    defect_asset_registration: "",
    defect_manual_asset_name: ""
  };
  const defectImpactPayload = canDefects ? getDefectImpactPayload() : {
    defect_work_impact: "",
    defect_stops_work: "",
    defect_can_continue: ""
  };

  // v1.17.4: Labudica ne mora imati glavno gradilište iz osnovne rubrike.
  // Ako zaposleni popunjava samo prevoz mašine labudicom, izveštaj dobija radni naziv
  // iz prvog unosa labudice ili generički naziv, a p_site_id ostaje null.
  const firstLowloaderMove = lowloaderMoves.find(m =>
    m.from_site || m.to_site || m.from_address || m.to_address || m.machine || m.plates
  ) || null;
  const lowloaderFallbackSiteName = firstLowloaderMove
    ? (firstLowloaderMove.from_site || firstLowloaderMove.from_address || firstLowloaderMove.to_site || firstLowloaderMove.to_address || "Transport mašine labudicom")
    : "";
  // Odsustvo/godišnji nije gradilište. Zato ga više ne koristimo kao fallback za site_name.
  const firstFieldTankerEntry = fieldTankerEntries.find(x => x.site_name || x.site_id) || null;
  const fieldTankerFallbackSiteName = firstFieldTankerEntry ? (firstFieldTankerEntry.site_name || "Evidencija goriva – cisterna") : "";
  const reportSiteName = selectedSite.site_name || dailyItemSiteSummary.site_name || (canLowloader && lowloaderMoves.length ? lowloaderFallbackSiteName : "") || (canFieldTanker && fieldTankerEntries.length ? fieldTankerFallbackSiteName : "");
  const reportSiteId = selectedSite.site_id || dailyItemSiteSummary.site_id || firstFieldTankerEntry?.site_id || null;

  const reportSectionsSent = {
    workers: canWorkers && getWorkerEntries().length > 0,
    machines: machines.length > 0,
    vehicles: vehicles.length > 0,
    lowloader: lowloaderMoves.length > 0,
    water_tanker: waterTankerEntries.length > 0,
    field_tanker: fieldTankerEntries.length > 0,
    fuel: fuelEntries.length > 0,
    materials: materialEntries.length > 0,
    signature: !!(canSignature && getSignatureData().signature_data_url),
    leave_request: !!(canLeaveRequest && hasLeaveRequestData(leaveRequest)),
    warehouse: !!(canWarehouse && (($("#wrWarehouseItem")?.value || "").trim() || ($("#wrWarehouseQty")?.value || "").trim())),
    defects: !!(canDefects && (($("#wrDefect")?.value || "").trim() || ($("#wrDefectAssetName")?.value || "").trim()))
  };

  return {
    report_type: selectedModule?.reportType || "unknown_worker_report",
    report_type_label: selectedModule?.label || "Radnički izveštaj",
    source: selectedModule?.reportType === "fuel_entry" ? "fuel_immediate" : (selectedModule?.reportType === "field_tanker_daily_batch" ? "field_tanker_memory" : "worker_form"),
    fuel_sent_immediately: selectedModule?.reportType === "fuel_entry" || selectedModule?.reportType === "field_tanker_daily_batch",
    request_title: canLeaveRequest && hasLeaveRequestData(leaveRequest) ? "Zahtev za odsustvo / godišnji odmor" : "",
    report_sections_sent: reportSectionsSent,
    employee_number: currentWorkerEmployeeNumber(),
    worker_number: currentWorkerEmployeeNumber(),
    created_by_employee_number: currentWorkerEmployeeNumber(),
    site_id: reportSiteId,
    site_name: reportSiteName,
    // v1.16.3: Gradilište i datum izveštaja čuva samo datum/godinu kroz report_date i gradilište kroz site_id/site_name.
    // Opis rada i sati rada ne šaljemo pod ovom rubrikom.
    description: "",
    hours: "",
    workers: canWorkers ? getWorkerEntries() : [],
    worker_entries: canWorkers ? getWorkerEntries() : [],
    workers_total_hours: canWorkers ? getWorkerEntries().reduce((sum, w) => sum + parseDecimalInput(w.hours), 0) || "" : "",
    machines,
    vehicles,
    lowloader_moves: lowloaderMoves,
    lowloader_entries: lowloaderMoves,
    water_tanker_entries: waterTankerEntries,
    water_entries: waterTankerEntries,
    water_liters: waterTankerEntries.reduce((sum, w) => sum + parseDecimalInput(w.water_liters || w.liters), 0) || "",
    field_tanker_entries: fieldTankerEntries,
    tanker_fuel_entries: fieldTankerEntries,
    fuel_entries: fuelEntries,

    // Summary fields for older report/CSV display
    machine: machines.map(m => m.name).filter(Boolean).join(" | "),
    machine_km_start: machines.map(m => machineKmStart(m)).filter(Boolean).join(" | "),
    machine_km_end: machines.map(m => machineKmEnd(m)).filter(Boolean).join(" | "),
    machine_km_total: machines.map(m => machineKmTotal(m)).filter(Boolean).join(" | "),
    mtc_start: machines.map(m => machineMtcStart(m)).filter(Boolean).join(" | "),
    mtc_end: machines.map(m => machineMtcEnd(m)).filter(Boolean).join(" | "),
    machine_hours: machines.map(m => machineMtcTotal(m)).filter(Boolean).join(" | "),
    fuel_liters: fuelEntries.reduce((sum, f) => sum + parseDecimalInput(f.liters), 0) || "",
    fuel_km: fuelEntries.map(f => f.km || f.current_km || (f.asset_kind === "vehicle" ? (f.reading || f.mtc_km) : "")).filter(Boolean).join(" | "),
    fuel_mtc: fuelEntries.map(f => f.mtc || f.current_mtc || (f.asset_kind === "machine" ? (f.reading || f.mtc_km) : "")).filter(Boolean).join(" | "),
    fuel_readings: fuelEntries.map(f => f.reading || f.mtc_km).filter(Boolean).join(" | "),
    fuel_by: fuelEntries.map(f => f.by).filter(Boolean).join(" | "),
    fuel_receiver: currentWorker?.full_name || "",

    vehicle: vehicles.map(v => v.name).filter(Boolean).join(" | "),
    km_start: vehicles.map(v => v.km_start).filter(Boolean).join(" | "),
    km_end: vehicles.map(v => v.km_end).filter(Boolean).join(" | "),
    route: vehicles.map(v => v.route).filter(Boolean).join(" | "),
    tours: vehicles.map(v => v.tours).filter(Boolean).join(" | "),
    cubic_m3: vehicles.map(v => v.cubic_m3).filter(Boolean).join(" | "),
    material_entries: materialEntries,
    material_movements: materialEntries,
    ...getSignatureData(),
    material: canMaterials ? materialEntries.map(m => `${m.action || ""}: ${m.material || ""}`.trim()).filter(Boolean).join(" | ") : "",
    material_tours: canMaterials ? materialEntries.map(m => m.tours || m.material_tours).filter(Boolean).join(" | ") : "",
    material_per_tour: canMaterials ? materialEntries.map(m => m.per_tour || m.quantity_per_tour).filter(Boolean).join(" | ") : "",
    quantity: canMaterials ? materialEntries.map(m => materialQuantityValue(m)).filter(Boolean).join(" | ") : "",
    unit: canMaterials ? materialEntries.map(m => materialUnitValue(m)).filter(Boolean).join(" | ") : "",
    material_calc: canMaterials ? materialEntries.map(m => m.calc_text || materialCalcText(m)).filter(Boolean).join(" | ") : "",
    leave_request: canLeaveRequest ? leaveRequest : null,
    leave_request_type: canLeaveRequest && hasLeaveRequestData(leaveRequest) ? leaveRequest.label : "",
    leave_type: canLeaveRequest ? (leaveRequest?.type || "") : "",
    leave_date: canLeaveRequest ? (leaveRequest?.date || "") : "",
    leave_from: canLeaveRequest ? (leaveRequest?.date_from || "") : "",
    leave_to: canLeaveRequest ? (leaveRequest?.date_to || "") : "",
    leave_note: canLeaveRequest ? (leaveRequest?.note || "") : "",
    warehouse_type: canWarehouse ? $("#wrWarehouseType").value : "",
    warehouse_item: canWarehouse ? $("#wrWarehouseItem").value.trim() : "",
    warehouse_qty: canWarehouse ? $("#wrWarehouseQty").value.trim() : "",
    ...defectAssetPayload,
    defect_machine: canDefects ? (defectAssetPayload.defect_asset_name || "") : "",
    defect_site_name: canDefects ? ($("#wrDefectSiteName")?.value.trim() || selectedSite.site_name || "") : "",
    defect_exists: canDefects ? "da" : "ne",
    defect: canDefects ? $("#wrDefect").value.trim() : "",
    ...defectImpactPayload,
    defect_urgency: canDefects ? $("#wrDefectUrgency").value : "",
    called_mechanic_by_phone: canDefects ? ($("#wrDefectCalledMechanic")?.value || "") : "",
    defect_images: canDefects ? defectImagesPayload() : [],
    defectImages: canDefects ? defectImagesPayload() : [],
    defect_photos: canDefects ? defectImagesPayload() : [],
    defect_images_count: canDefects ? defectImagesPayload().length : 0
  };
}

function clearWorkerForm() {
  ["wrSiteName","wrDescription","wrHours","wrVehicle","wrKmStart","wrKmEnd","wrRoute","wrTours","wrLeaveType","wrLeaveDate","wrLeaveFrom","wrLeaveTo","wrLeaveNote","wrWarehouseType","wrWarehouseItem","wrWarehouseQty","wrDefectAssetName","wrDefectSiteName","wrDefect","wrDefectStopsWork","wrDefectUrgency","wrDefectCalledMechanic","wrSignatureName"].forEach(id => {
    const el = $("#" + id);
    if (el) el.value = "";
  });
  if ($("#wrLeaveType")) $("#wrLeaveType").value = "slobodan_dan";
  updateLeaveRequestVisibility();
  if ($("#workerEntries")) $("#workerEntries").innerHTML = "";
  if ($("#machineEntries")) $("#machineEntries").innerHTML = "";
  if ($("#vehicleEntries")) $("#vehicleEntries").innerHTML = "";
  if ($("#fuelEntries")) $("#fuelEntries").innerHTML = "";
  if ($("#lowloaderEntries")) $("#lowloaderEntries").innerHTML = "";
  if ($("#waterTankerEntries")) $("#waterTankerEntries").innerHTML = "";
  if ($("#fieldTankerEntries")) $("#fieldTankerEntries").innerHTML = "";
  if ($("#materialEntries")) $("#materialEntries").innerHTML = "";
  localStorage.removeItem("swp_draft");
  localStorage.removeItem("swp_returned_report_id");
  localStorage.removeItem("swp_returned_report_type");
  localStorage.removeItem("swp_returned_report_reason");
  updateReturnedCorrectionUi();
  clearSignatureCanvas(false);
  clearDefectImagesDraft();
}

function ensureWorkerDefaultEntries() {
  // v2.1: Ne dodajemo više prazne kartice za sve dozvoljene rubrike.
  // Radnik prvo izabere rubriku iz menija, pa se dodaje samo taj obrazac.
  applyWorkerModuleSelection({ addDefaults: true });
  refreshMachineDatalists();
  refreshVehicleSelects();
  refreshFuelMachineOptions();
  refreshFieldTankerSelectors();
  refreshDailyItemSiteSelectors();
  refreshMaterialEntrySelectors();
}

async function prepareWorkerFormForNextReport() {
  clearWorkerForm();
  if ($("#wrDate")) $("#wrDate").value = today();

  // v1.20.1: Posle uspešnog slanja ne smeju nestati liste mašina/vozila/opreme.
  // Zato ponovo učitavamo sredstva i odmah vraćamo po jednu praznu karticu za svaku dozvoljenu rubriku.
  await Promise.allSettled([loadWorkerSites(), loadWorkerAssets(), loadWorkerMaterials()]);
  ensureWorkerDefaultEntries();
  renderStoredFieldTankerEntries();
  updateLeaveRequestVisibility();
}

async function verifyRecentlySubmittedReport(worker, reportDate) {
  // Samo dijagnostika. Ako RLS ne dozvoli direktno čitanje, ne smemo blokirati zaposlenog.
  try {
    if (!worker?.company_id) return;
    const { data, error } = await sb
      .from("reports")
      .select("id,status,report_date,created_at,submitted_at")
      .eq("company_id", worker.company_id)
      .eq("report_date", reportDate)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) {
      console.warn("AskCreate.app: izveštaj je poslat preko RPC, ali direktna provera reports nije dozvoljena ili nije uspela:", error.message);
      return;
    }
    console.log("AskCreate.app: poslednji izveštaji za proveru slanja", data || []);
  } catch (e) {
    console.warn("AskCreate.app: provera poslatog izveštaja nije uspela", e);
  }
}


function clearWorkerValidationHighlights() {
  $$(".worker-section-needs-attention").forEach(el => el.classList.remove("worker-section-needs-attention"));
  $$(".entry-needs-attention").forEach(el => el.classList.remove("entry-needs-attention"));
  $$(".validation-field-missing").forEach(el => el.classList.remove("validation-field-missing"));
  $$(".worker-validation-message").forEach(el => el.remove());
}

function showWorkerValidationMessage(section, message) {
  if (!section) return;
  let box = section.querySelector(":scope > .worker-validation-message");
  if (!box) {
    box = document.createElement("div");
    box.className = "worker-validation-message";
    const head = section.querySelector("h4, label, .hint");
    if (head && head.nextSibling) section.insertBefore(box, head.nextSibling);
    else section.insertBefore(box, section.firstChild || null);
  }
  box.textContent = message;
}

function focusWorkerValidationIssue(issue) {
  if (!issue) return;
  clearWorkerValidationHighlights();
  const section = issue.section ? $(issue.section) : null;
  const entry = issue.entry || (issue.entrySelector ? $(issue.entrySelector) : null);
  const field = issue.field || (issue.fieldSelector ? $(issue.fieldSelector) : null);
  if (section) {
    section.classList.add("active");
    section.classList.add("worker-section-needs-attention");
    showWorkerValidationMessage(section, issue.message || "Popuni označeno polje pre slanja.");
  }
  if (entry) entry.classList.add("entry-needs-attention");
  if (field) field.classList.add("validation-field-missing");
  const scrollTarget = entry || section || field;
  if (scrollTarget?.scrollIntoView) {
    scrollTarget.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  setTimeout(() => {
    try { if (field && typeof field.focus === "function") field.focus({ preventScroll: true }); } catch {}
  }, 350);
}

function getFirstFieldTankerValidationIssue() {
  const section = $("#secFieldTanker");
  if (!section || !section.classList.contains("active")) return null;
  const cards = $$("#fieldTankerEntries .field-tanker-entry");
  if (!cards.length) {
    return { section: "#secFieldTanker", message: "Dodaj bar jedno sipanje u rubrici Evidencija goriva – cisterna." };
  }
  for (let i = 0; i < cards.length; i += 1) {
    const card = cards[i];
    const n = i + 1;
    const siteSelect = card.querySelector(".ft-site-select");
    const siteCustom = card.querySelector(".ft-site-custom");
    const cisternSearch = $("#fieldTankerCisternSearch") || card.querySelector(".ft-cistern-search");
    const assetSearch = card.querySelector(".ft-asset-search");
    const km = card.querySelector(".ft-km");
    const mtc = card.querySelector(".ft-mtc");
    const liters = card.querySelector(".ft-liters");
    const receiver = card.querySelector(".ft-receiver");
    const siteValue = (siteCustom?.value || "").trim() || (siteSelect?.value || "").trim();
    const assetValue = (assetSearch?.value || "").trim();
    if (!siteValue) return { section: "#secFieldTanker", entry: card, field: siteSelect || siteCustom, message: `Cisterna goriva ${n}: izaberi ili upiši gradilište/lokaciju.` };
    if (!(cisternSearch?.value || "").trim()) return { section: "#secFieldTanker", entry: card, field: cisternSearch, message: `Cisterna goriva: prvo gore upiši tablice / cisternu koja sipa gorivo.` };
    if (!assetValue) return { section: "#secFieldTanker", entry: card, field: assetSearch, message: `Cisterna goriva ${n}: upiši interni broj, naziv ili tablice sredstva koje prima gorivo.` };
    const kmValue = (km?.value || "").trim();
    const mtcValue = (mtc?.value || "").trim();
    if (!kmValue && !mtcValue) return { section: "#secFieldTanker", entry: card, field: km || mtc, message: `Cisterna goriva ${n}: upiši KM ili MTČ. Dovoljno je jedno od ta dva polja — vozilo obično KM, mašina obično MTČ.` };
    if (!(liters?.value || "").trim()) return { section: "#secFieldTanker", entry: card, field: liters, message: `Cisterna goriva ${n}: upiši koliko litara je sipano.` };
    if (!(receiver?.value || "").trim()) return { section: "#secFieldTanker", entry: card, field: receiver, message: `Cisterna goriva ${n}: upiši ime osobe koja je primila gorivo.` };
  }
  return null;
}

function getActiveWorkerModuleValidationIssue(data = {}) {
  const module = getSelectedWorkerModule();
  if (!module) return { section: "#workerModuleChooser", field: $("#wrModuleSelect"), message: "Prvo izaberi šta danas popunjavaš." };
  const type = module.reportType;

  if (type === "worker_hours" && !(data.workers || data.worker_entries || []).length) {
    return { section: "#secWorkers", field: $("#addWorkerEntryBtn"), message: "Dodaj bar jednog radnika i sate rada pre slanja radnog izveštaja." };
  }
  if (type === "machine_work_daily" && !(data.machines || []).length) {
    return { section: "#secMachines", field: $("#addMachineBtn"), message: "Dodaj bar jednu mašinu/MTČ stavku pre slanja izveštaja bageriste/rukovaoca." };
  }
  if (type === "truck_tours_daily" && !(data.vehicles || []).length) {
    return { section: "#secVehicles", field: $("#addVehicleBtn"), message: "Dodaj bar jedno vozilo/turu pre slanja izveštaja vozača." };
  }
  if (type === "fuel_entry" && !(data.fuel_entries || []).length) {
    return { section: "#secFuel", field: $("#addFuelBtn"), message: "Dodaj bar jedno sipanje goriva pre slanja evidencije goriva." };
  }
  if (type === "lowloader_transport" && !(data.lowloader_moves || data.lowloader_entries || []).length) {
    return { section: "#secLowloader", field: $("#addLowloaderBtn"), message: "Dodaj bar jedan transport labudicom pre slanja." };
  }
  if (type === "water_tanker_daily" && !(data.water_tanker_entries || data.water_entries || []).length) {
    return { section: "#secWaterTanker", field: $("#addWaterTankerBtn"), message: "Dodaj bar jedan rad cisterne za vodu pre slanja." };
  }
  if (type === "material_movement" && !(data.material_entries || data.material_movements || []).length) {
    return { section: "#secMaterials", field: $("#addWorkerMaterialEntryBtn"), message: "Dodaj bar jednu stavku materijala pre slanja." };
  }
  if (type === "warehouse_movement" && !(data.warehouse_item || data.warehouse_qty)) {
    return { section: "#secWarehouse", field: $("#wrWarehouseItem") || $("#wrWarehouseQty"), message: "Upiši stavku i količinu za magacin pre slanja." };
  }
  if (type === "defect_report" && !(data.defect || data.defect_asset_name || data.defect_asset_code || data.defect_manual_asset_name)) {
    return { section: "#secDefects", field: $("#wrDefect") || $("#wrDefectAssetName"), message: "Upiši sredstvo ili opis kvara pre slanja prijave kvara." };
  }
  if (type === "leave_request" && !hasLeaveRequestData(data.leave_request)) {
    return { section: "#secLeaveRequest", field: $("#wrLeaveDate") || $("#wrLeaveFrom"), message: "Popuni datum slobodnog dana ili period godišnjeg odmora pre slanja zahteva." };
  }
  return null;
}

function validateWorkerReportBeforeSubmit(data) {
  const moduleIssue = getActiveWorkerModuleValidationIssue(data);
  if (moduleIssue) {
    moduleIssue.message = `Izveštaj nije poslat. ${moduleIssue.message}`;
    return moduleIssue;
  }

  const siteSection = $("#secWorkerSite");
  if (siteSection?.classList.contains("active") && !($("#wrSiteName")?.value || "").trim()) {
    return {
      section: "#secWorkerSite",
      field: $("#wrSiteName"),
      message: "Izveštaj nije poslat. Prvo izaberi gradilište iz liste Uprave firme. Označio sam rubriku koju treba popuniti."
    };
  }

  const tankerIssue = getFirstFieldTankerValidationIssue();
  if (tankerIssue) {
    tankerIssue.message = `Izveštaj nije poslat. ${tankerIssue.message}`;
    return tankerIssue;
  }

  const signatureSection = $("#secSignature");
  if (signatureSection?.classList.contains("active") && !data.signature_data_url) {
    return {
      section: "#secSignature",
      field: $("#wrSignatureCanvas"),
      message: "Izveštaj nije poslat. Nedostaje potpis. Potpiši se u označenoj rubrici pa ponovo klikni Pošalji Upravi."
    };
  }

  return null;
}

function saveDraft() {
  const draft = {
    date: $("#wrDate").value,
    data: collectWorkerData()
  };
  localStorage.setItem("swp_draft", JSON.stringify(draft));
  toast("Nacrt je sačuvan na ovom uređaju.");
}

function loadDraft() {
  try {
    const raw = localStorage.getItem("swp_draft");
    if (!raw) return;
    const draft = JSON.parse(raw);
    $("#wrDate").value = draft.date || today();
    const d = draft.data || {};

    const moduleValue = workerModuleValueFromReportType(d.report_type || d.reportType || "");
    if (moduleValue && $("#wrModuleSelect")) {
      $("#wrModuleSelect").value = moduleValue;
      applyWorkerModuleSelection({ addDefaults: false });
    }

    if ($("#wrLeaveType")) $("#wrLeaveType").value = "slobodan_dan";
  updateLeaveRequestVisibility();
  if ($("#workerEntries")) $("#workerEntries").innerHTML = "";
    if ($("#machineEntries")) $("#machineEntries").innerHTML = "";
    if ($("#vehicleEntries")) $("#vehicleEntries").innerHTML = "";
    if ($("#fuelEntries")) $("#fuelEntries").innerHTML = "";
    if ($("#lowloaderEntries")) $("#lowloaderEntries").innerHTML = "";
    if ($("#waterTankerEntries")) $("#waterTankerEntries").innerHTML = "";
    if ($("#fieldTankerEntries")) $("#fieldTankerEntries").innerHTML = "";
    if ($("#materialEntries")) $("#materialEntries").innerHTML = "";
    (d.workers || d.worker_entries || []).forEach(w => addWorkerEntry(w));
    (d.machines || []).forEach(m => addMachineEntry(m));
    (d.vehicles || []).forEach(v => addVehicleEntry(v));
    (d.lowloader_moves || d.lowloader_entries || []).forEach(x => addLowloaderEntry(x));
    (d.water_tanker_entries || d.water_entries || []).forEach(x => addWaterTankerEntry(x));
    (d.field_tanker_entries || d.tanker_fuel_entries || []).forEach(x => addFieldTankerEntry(x));
    if ((!d.vehicles || !d.vehicles.length) && (d.vehicle || d.km_start || d.km_end || d.route || d.tours)) {
      addVehicleEntry({ name: d.vehicle, km_start: d.km_start, km_end: d.km_end, route: d.route, tours: d.tours });
    }
    (d.fuel_entries || []).forEach(f => addFuelEntry(f));
    (d.material_entries || d.material_movements || []).forEach(m => addMaterialEntry(m));

    Object.entries({
      wrSiteName:"site_name", wrDescription:"description", wrHours:"hours", wrVehicle:"vehicle", wrKmStart:"km_start", wrKmEnd:"km_end", wrRoute:"route", wrTours:"tours", wrMaterialManual:"material", wrLeaveType:"leave_type", wrLeaveDate:"leave_date", wrLeaveFrom:"leave_from", wrLeaveTo:"leave_to", wrLeaveNote:"leave_note", wrWarehouseType:"warehouse_type", wrWarehouseItem:"warehouse_item", wrWarehouseQty:"warehouse_qty", wrDefectAssetName:"defect_asset_code", wrDefectSiteName:"defect_site_name", wrDefect:"defect", wrDefectStopsWork:"defect_work_impact", wrDefectUrgency:"defect_urgency", wrDefectCalledMechanic:"called_mechanic_by_phone", wrSignatureName:"signature_name"
    }).forEach(([id,key]) => { if ($("#"+id)) $("#"+id).value = d[key] || ""; });
    if (d.signature_data_url) setSignatureImage(d.signature_data_url);
    if (moduleValue && $("#wrModuleSelect")) applyWorkerModuleSelection({ addDefaults: false });
    updateLeaveRequestVisibility();
  } catch {}
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function parseAssetCapacityParts(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return { value: "", unit: "m3" };
  const lower = raw.toLowerCase();
  const num = raw.replace(/[^0-9.,-]/g, "").replace(",", ".").trim();
  let unit = "m3";
  if (/\bl\b|litar|litara|liter|litre/.test(lower)) unit = "l";
  if (/bez|none|kom|pcs/.test(lower)) unit = "none";
  return { value: num || raw, unit };
}

function buildAssetCapacityText(value, unit) {
  const v = String(value ?? "").trim();
  const u = String(unit || "m3").trim();
  if (!v) return "";
  if (/[a-zA-ZčćšđžČĆŠĐŽ³]/.test(v)) return v;
  if (u === "l") return `${v} L`;
  if (u === "none") return v;
  return `${v} m³`;
}

function formatCapacityM3(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/m\s*(³|3)|kub|kubic|\bl\b|litar|litara|liter|litre/i.test(raw)) return raw;
  return `${raw} m³`;
}

function setAssetCapacityInputs(capacity) {
  const parts = parseAssetCapacityParts(capacity);
  const input = document.querySelector("#assetCapacity");
  const unit = document.querySelector("#assetCapacityUnit");
  if (input) input.value = parts.value || "";
  if (unit) unit.value = parts.unit || "m3";
}



let lastWorkerUiAuditText = "";

const WORKER_UI_PERMISSION_MAP = {
  daily_work: { label: "Gradilište i datum izveštaja", window: "Osnovno: gradilište i datum", worker: true },
  workers: { label: "Evidencija zaposlenih na gradilištu", window: "Evidencija zaposlenih na gradilištu", worker: true },
  machines: { label: "Rad sa mašinom", window: "Evidencija rada mašine", worker: true },
  vehicles: { label: "Rad vozila / kamiona", window: "Vozilo / ture / m³", worker: true },
  lowloader: { label: "Transport mašine labudicom", window: "Labudica / prevoz mašine", worker: true },
  water_tanker: { label: "Cisterna za vodu", window: "Voda / cisterna", worker: true },
  fuel: { label: "Evidencija goriva – korisnik", window: "Sipanje goriva", worker: true },
  field_tanker: { label: "Evidencija goriva – cisterna", window: "Evidencija goriva – cisterna", worker: true },
  materials: { label: "Materijal", window: "Materijal", worker: true },
  signature: { label: "Potpis zaposlenog", window: "Potpis na dnevnom izveštaju", worker: true },
  leave_request: { label: "Zahtev za odsustvo / godišnji odmor", window: "Slobodan dan / godišnji", worker: true },
  warehouse: { label: "Magacin", window: "Magacin", worker: true },
  defects: { label: "Evidencija kvara", window: "Evidencija kvara", worker: true },

  // Upravljačka prava nisu radnički prozori. Ako ih ima običan zaposleni, audit ih označava kao upozorenje.
  view_reports: { label: "Pregled izveštaja", window: "Uprava: pregled izveštaja", worker: false },
  approve_reports: { label: "Odobravanje izveštaja", window: "Uprava: odobravanje", worker: false },
  excel_export: { label: "Izvoz u Excel", window: "Uprava: Excel", worker: false },
  manage_people: { label: "Upravljanje korisnicima", window: "Uprava: osobe", worker: false },
  settings: { label: "Podešavanja firme", window: "Uprava: podešavanja", worker: false }
};

function permissionIsEnabled(value) {
  return value === true || value === "true" || value === 1 || value === "1" || value === "yes";
}

function normalizePermissions(raw) {
  if (!raw) return {};
  if (typeof raw === "string") {
    try { return JSON.parse(raw) || {}; } catch { return {}; }
  }
  if (typeof raw === "object") return raw;
  return {};
}

function isLikelyWorkerUser(person, perms) {
  const title = `${person.function_title || ""} ${person.role || ""}`.toLowerCase();
  const hasWorkerPerm = Object.entries(perms).some(([key, value]) => permissionIsEnabled(value) && WORKER_UI_PERMISSION_MAP[key]?.worker);
  const hasDirectorPerm = Object.entries(perms).some(([key, value]) => permissionIsEnabled(value) && WORKER_UI_PERMISSION_MAP[key] && !WORKER_UI_PERMISSION_MAP[key].worker);
  if (title.includes("direkc") || title.includes("admin") || title.includes("direktor")) return false;
  return hasWorkerPerm || !hasDirectorPerm;
}

async function runWorkerUiAudit() {
  const box = $("#workerUiAuditResult");
  if (!box) return;
  try {
    if (!currentCompany?.id) {
      box.innerHTML = `<p class="muted">Prvo se prijavi kao Uprava i učitaj firmu.</p>`;
      return;
    }

    box.innerHTML = `<p class="muted">Proveravam radničke prozore...</p>`;

    const { data, error } = await sb
      .from("company_users")
      .select("id, first_name, last_name, function_title, access_code, permissions, active")
      .eq("company_id", currentCompany.id)
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const people = data || [];
    if (!people.length) {
      lastWorkerUiAuditText = "Nema aktivnih korisnika za proveru.";
      box.innerHTML = `<p class="muted">Nema aktivnih korisnika za proveru.</p>`;
      return;
    }

    const cards = [];
    const plain = [];
    let warningCount = 0;
    let okCount = 0;

    for (const person of people) {
      const perms = normalizePermissions(person.permissions);
      const fullName = `${person.first_name || ""} ${person.last_name || ""}`.trim() || person.access_code || "Korisnik";
      const enabledKeys = Object.entries(perms)
        .filter(([key, value]) => permissionIsEnabled(value) && key !== "allowed_material_ids" && key !== "allowed_material_names")
        .map(([key]) => key);

      const unknownKeys = enabledKeys.filter(key => !WORKER_UI_PERMISSION_MAP[key]);
      const workerWindows = [];
      const directorPerms = [];
      const duplicateWindows = [];
      const seenWindows = new Map();

      for (const key of enabledKeys) {
        const meta = WORKER_UI_PERMISSION_MAP[key];
        if (!meta) continue;
        if (meta.worker) {
          workerWindows.push(meta.window);
          if (seenWindows.has(meta.window)) duplicateWindows.push(meta.window);
          seenWindows.set(meta.window, true);
        } else {
          directorPerms.push(meta.label);
        }
      }

      const likelyWorker = isLikelyWorkerUser(person, perms);
      const issues = [];
      if (likelyWorker && directorPerms.length) issues.push(`Ima direkcijske dozvole: ${directorPerms.join(", ")}`);
      if (likelyWorker && !workerWindows.length) issues.push("Nema nijednu radničku rubriku za popunjavanje.");
      if (duplicateWindows.length) issues.push(`Duplirani prozori: ${[...new Set(duplicateWindows)].join(", ")}`);
      if (unknownKeys.length) issues.push(`Nepoznate/stare dozvole u profilu: ${unknownKeys.join(", ")}`);

      if (issues.length) warningCount += 1; else okCount += 1;

      const status = issues.length ? "⚠️ Proveriti" : "✅ OK";
      plain.push(`${fullName} (${person.access_code || "bez šifre"}) - ${status}`);
      plain.push(`Radnički prozori: ${workerWindows.join(" | ") || "nema"}`);
      if (issues.length) plain.push(`Upozorenja: ${issues.join("; ")}`);
      plain.push("---");

      cards.push(`
        <div class="item audit-person-card ${issues.length ? "audit-warning" : "audit-ok"}">
          <div class="item-main">
            <strong>${escapeHtml(fullName)}</strong>
            <small>${escapeHtml(person.function_title || "")} · šifra: ${escapeHtml(person.access_code || "")}</small><br/>
            <span class="pill">${status}</span>
            <span class="pill">${workerWindows.length} radnička prozora</span>
          </div>
          <div class="audit-details">
            <b>Treba da vidi:</b>
            <div>${workerWindows.length ? workerWindows.map(w => `<span class="pill">${escapeHtml(w)}</span>`).join(" ") : `<span class="muted">Nema radničkih prozora</span>`}</div>
            ${issues.length ? `<div class="audit-issues"><b>Upozorenja:</b><ul>${issues.map(i => `<li>${escapeHtml(i)}</li>`).join("")}</ul></div>` : `<p class="muted">Nema dupliranih/nebitnih prozora po dozvolama.</p>`}
          </div>
        </div>
      `);
    }

    lastWorkerUiAuditText = `PROVERA RADNIČKIH PROZORA\nFirma: ${currentCompany.name || currentCompany.company_code || ""}\nOK: ${okCount}\nZa proveru: ${warningCount}\n\n${plain.join("\n")}`;
    box.innerHTML = `
      <div class="audit-summary">
        <span class="pill">✅ OK: ${okCount}</span>
        <span class="pill">⚠️ Za proveru: ${warningCount}</span>
      </div>
      <div class="list">${cards.join("")}</div>
    `;
  } catch (e) {
    lastWorkerUiAuditText = `Greška u proveri: ${e.message}`;
    box.innerHTML = `<p class="error-text">Greška u proveri: ${escapeHtml(e.message)}</p>`;
    toast(e.message, true);
  }
}

async function copyWorkerUiAudit() {
  try {
    if (!lastWorkerUiAuditText) await runWorkerUiAudit();
    const text = lastWorkerUiAuditText || "Nema dijagnostike.";
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      toast("Dijagnostika kopirana.");
      return;
    }
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
    toast("Dijagnostika kopirana.");
  } catch (e) {
    toast("Ne mogu da kopiram dijagnostiku: " + e.message, true);
  }
}


function runLocalAppCheck() {
  const box = $("#localAppCheckResult");
  if (!box) return;

  const checks = [];
  const addCheck = (level, title, detail) => checks.push({ level, title, detail });

  const ids = Array.from(document.querySelectorAll("[id]")).map(el => el.id).filter(Boolean);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  addCheck(
    duplicateIds.length ? "bad" : "ok",
    duplicateIds.length ? "Dupli ID pronađen" : "ID provera je čista",
    duplicateIds.length ? `Dupli ID: ${duplicateIds.join(", ")}. Ovo može vezati pogrešno dugme za pogrešnu funkciju.` : "Nema duplih ID vrednosti u trenutno učitanom HTML-u."
  );

  const requiredElements = [
    "directorLoginBtn", "workerLoginBtn", "addPersonBtn", "addSiteBtn", "addAssetBtn", "addMaterialBtn",
    "reportsList", "defectsList", "exportXlsBtn", "exportCsvBtn", "submitReportBtn", "sendDefectNowBtn"
  ];
  const missing = requiredElements.filter(id => !document.getElementById(id));
  addCheck(
    missing.length ? "bad" : "ok",
    missing.length ? "Nedostaju važni elementi" : "Glavna dugmad postoje",
    missing.length ? `Nedostaje: ${missing.join(", ")}. Ne uploaduj dok se ovo ne popravi.` : "Login, izveštaji, kvarovi, materijal i export imaju osnovne HTML elemente."
  );

  addCheck(
    window.supabase && sb ? "ok" : "bad",
    window.supabase && sb ? "Supabase biblioteka je učitana" : "Supabase nije učitan",
    window.supabase && sb ? "Frontend može da napravi Supabase klijent. Ovo ne proverava RLS ni podatke u bazi." : "Proveri CDN skriptu ili internet konekciju."
  );

  addCheck(
    "serviceWorker" in navigator ? "ok" : "warn",
    "serviceWorker" in navigator ? "PWA Service Worker podržan" : "Service Worker nije dostupan",
    "serviceWorker" in navigator ? "Browser podržava PWA/cache. Ako vidiš staru verziju, očisti site data ili otvori cache-bust link." : "Na ovom browseru PWA instalacija/cache možda neće raditi."
  );

  const versionText = typeof APP_VERSION !== "undefined" ? APP_VERSION : "nepoznato";
  addCheck("ok", "Verzija aplikacije", `Učitana verzija: ${versionText}. Test link za ovu verziju: ?v=1235&t=1`);

  const now = new Date();
  addCheck("ok", "Vreme provere", now.toLocaleString("sr-RS"));

  const summary = checks.reduce((acc, c) => {
    acc[c.level] = (acc[c.level] || 0) + 1;
    return acc;
  }, {});

  box.innerHTML = `
    <div class="audit-summary">
      <span class="pill">✅ OK: ${summary.ok || 0}</span>
      <span class="pill">⚠️ Upozorenje: ${summary.warn || 0}</span>
      <span class="pill">⛔ Greška: ${summary.bad || 0}</span>
    </div>
    ${checks.map(c => `
      <div class="audit-card ${c.level}">
        <h4>${c.level === "ok" ? "✅" : c.level === "warn" ? "⚠️" : "⛔"} ${escapeHtml(c.title)}</h4>
        <p class="audit-small">${escapeHtml(c.detail)}</p>
      </div>
    `).join("")}
  `;
}

function csvEscape(v) {
  return `"${String(v ?? "").replaceAll('"','""')}"`;
}

function parseDecimalInput(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  let cleaned = raw.replace(/\s/g, "");
  const hasDot = cleaned.includes(".");
  const hasComma = cleaned.includes(",");

  // 100.000  -> 100000
  // 100,000  -> 100000
  // 100.000,50 -> 100000.50
  // 100,000.50 -> 100000.50
  if (hasDot && hasComma) {
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (hasDot) {
    const parts = cleaned.split('.');
    if (parts.length > 1 && parts.slice(1).every(p => p.length === 3)) {
      cleaned = parts.join('');
    }
  } else if (hasComma) {
    const parts = cleaned.split(',');
    if (parts.length > 1 && parts.slice(1).every(p => p.length === 3)) {
      cleaned = parts.join('');
    } else {
      cleaned = cleaned.replace(',', '.');
    }
  }

  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function preventNumberInputScrollChanges(root = document) {
  // Zaposleni na terenu često skroluje preko forme. Native input[type=number]
  // u Chrome/Edge može sam da promeni vrednost (npr. 4,5 -> 4,51) preko
  // točkića/trackpad-a ili strelica. Zato sva numerička polja zaključavamo
  // kao tekstualni unos sa decimalnom tastaturom. Parsiranje već podržava
  // i zarez i tačku, uključujući formate kao 100.000 ili 100,000.
  root.querySelectorAll('input[type="number"], input.numeric-text').forEach(input => {
    if (input.type === "number") {
      input.type = "text";
      input.inputMode = "decimal";
      input.classList.add("numeric-text");
      input.setAttribute("autocomplete", "off");
      input.setAttribute("data-fixed-number", "1");
    }
    if (input.dataset.noWheelBound === "1") return;
    input.dataset.noWheelBound = "1";
    input.addEventListener("wheel", (event) => {
      event.preventDefault();
      input.blur();
    }, { passive: false });
    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
      }
    });
  });
}

function excelCellText(v) {
  return String(v ?? "").replace(/\r?\n|\r/g, " ").replace(/\s+/g, " ").trim();
}

function downloadBlob(blob, fileName) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 500);
}

const EXPORT_SELECTION_KEY = "swp_export_report_ids";
const EXPORT_COLUMN_KEY = "swp_export_columns";
const SMART_EXPORT_KEY = "swp_smart_export_settings";
const EXPORT_TEMPLATE_KEY = "swp_export_template";

const EXPORT_COLUMNS = [
  { key:"date", label:"Datum" },
  { key:"worker", label:"Zaposleni koji šalje izveštaj" },
  { key:"employee_number", label:"Broj radnika" },
  { key:"function", label:"Radno mesto" },
  { key:"site", label:"Gradilište" },
  { key:"hours", label:"Ukupno sati rada" },
  { key:"description", label:"Šta je rađeno" },
  { key:"crew_worker", label:"Ime zaposlenog na gradilištu" },
  { key:"crew_hours", label:"Sati tog zaposlenog" },
  { key:"machine_code", label:"Broj mašine" },
  { key:"machine", label:"Mašina" },
  { key:"machine_km_start", label:"KM početak mašine" },
  { key:"machine_km_end", label:"KM kraj mašine" },
  { key:"machine_km_total", label:"Ukupno KM mašine" },
  { key:"machine_start", label:"MTČ početak mašine" },
  { key:"machine_end", label:"MTČ kraj mašine" },
  { key:"machine_hours", label:"Ukupno MTČ / sati mašine" },
  { key:"machine_work", label:"Šta je mašina radila" },
  { key:"vehicle_code", label:"Broj vozila" },
  { key:"vehicle", label:"Vozilo / kamion" },
  { key:"registration", label:"Registracija" },
  { key:"capacity", label:"Kapacitet vozila m³" },
  { key:"km_start", label:"Početna kilometraža" },
  { key:"km_end", label:"Krajnja kilometraža" },
  { key:"route", label:"Relacija vožnje" },
  { key:"tours", label:"Broj izvršenih tura" },
  { key:"cubic", label:"Ukupno m³" },
  { key:"lowloader_plates", label:"Tablice labudice" },
  { key:"lowloader_from", label:"Gradilište sa kog je mašina preuzeta" },
  { key:"lowloader_to", label:"Gradilište gde je mašina odvezena" },
  { key:"lowloader_km_start", label:"Početna kilometraža labudice" },
  { key:"lowloader_km_end", label:"Završna kilometraža labudice" },
  { key:"lowloader_km", label:"Kilometara sa labudicom" },
  { key:"lowloader_machine", label:"Prevezena mašina" },
  { key:"lowloader_tools", label:"Prateći alat uz mašinu" },
  { key:"water_site", label:"Gradilište cisterne za vodu" },
  { key:"water_vehicle_code", label:"Broj cisterne za vodu" },
  { key:"water_vehicle", label:"Cisterna za vodu" },
  { key:"water_km_start", label:"KM početak cisterne za vodu" },
  { key:"water_km_end", label:"KM kraj cisterne za vodu" },
  { key:"water_km", label:"Ukupno KM cisterne za vodu" },
  { key:"water_liters", label:"Litara vode" },
  { key:"water_loads", label:"Broj punjenja vode" },
  { key:"water_fill_location", label:"Lokacija punjenja vode" },
  { key:"water_unload_location", label:"Lokacija istovara/prskanja vode" },
  { key:"water_purpose", label:"Namena vode" },
  { key:"water_note", label:"Napomena za vodu" },
  { key:"fuel_type", label:"Kategorija sredstva" },
  { key:"fuel_asset_code", label:"Broj sredstva" },
  { key:"fuel_for", label:"Naziv sredstva" },
  { key:"fuel_registration", label:"Registracija" },
  { key:"fuel_liters", label:"Litara" },
  { key:"fuel_km", label:"KM" },
  { key:"fuel_mtc", label:"MTČ" },
  { key:"fuel_by", label:"Gorivo sipao" },
  { key:"fuel_receiver", label:"Primio gorivo" },
  { key:"fuel_source_type", label:"Tip izvora goriva" },
  { key:"fuel_source", label:"Naziv/lokacija izvora goriva" },
  { key:"field_tanker_site", label:"Gradilište gde je sipano gorivo" },
  { key:"field_tanker_vehicle_code", label:"Broj cisterne" },
  { key:"field_tanker_vehicle", label:"Cisterna koja je sipala gorivo" },
  { key:"field_tanker_vehicle_registration", label:"Tablice cisterne koja je sipala gorivo" },
    { key:"field_tanker_asset_code", label:"Broj primaoca" },
  { key:"field_tanker_asset", label:"Sredstvo koje prima gorivo" },
  { key:"field_tanker_registration", label:"Registracija" },
  { key:"field_tanker_km", label:"KM pri tankovanju cisternom" },
  { key:"field_tanker_mtc", label:"MTČ pri tankovanju cisternom" },
  { key:"field_tanker_liters", label:"Litara iz cisterne" },
  { key:"field_tanker_receiver", label:"Primio gorivo iz cisterne" },
  { key:"field_tanker_source_type", label:"Tip izvora cisterne" },
  { key:"field_tanker_source", label:"Naziv/lokacija izvora cisterne" },
  { key:"material_action", label:"Radnja sa materijalom" },
  { key:"material", label:"Materijal" },
  { key:"material_tours", label:"Ture materijala" },
  { key:"material_per_tour", label:"Količina po turi" },
  { key:"quantity", label:"Ukupna količina materijala" },
  { key:"unit", label:"Jedinica" },
  { key:"material_calc", label:"Obračun materijala" },
  { key:"material_note", label:"Napomena za materijal" },
  { key:"warehouse_type", label:"Magacin tip" },
  { key:"warehouse_item", label:"Magacin stavka" },
  { key:"warehouse_qty", label:"Magacin količina" },
  { key:"leave_type", label:"Vrsta odsustva" },
  { key:"leave_date", label:"Datum slobodnog dana" },
  { key:"leave_from", label:"Godišnji od" },
  { key:"leave_to", label:"Godišnji do" },
  { key:"leave_note", label:"Napomena za odsustvo" },
  { key:"defect_type", label:"Kategorija sredstva u kvaru" },
  { key:"defect_asset_code", label:"Broj sredstva u kvaru" },
  { key:"defect_asset", label:"Naziv sredstva u kvaru" },
  { key:"defect_registration", label:"Registracija sredstva" },
  { key:"defect_site", label:"Lokacija kvara" },
  { key:"defect", label:"Opis kvara" },
  { key:"defect_work_impact", label:"Uticaj na rad" },
  { key:"defect_urgency", label:"Hitnost" },
  { key:"defect_called_mechanic", label:"Pozvan odgovorno lice mehanizacije" },
  { key:"defect_status", label:"Status kvara" },
  { key:"status", label:"Status izveštaja" }
];

const SIMPLE_EXPORT_KEYS = [
  "date", "worker", "site", "description", "hours",
  "machine", "vehicle", "tours", "cubic", "fuel_liters",
  "water_liters", "defect", "status"
];

const EXPORT_GROUPS = [
  {
    id: "basic",
    title: "Osnovni podaci",
    hint: "Ko je poslao izveštaj, gde je radio i šta je urađeno.",
    keys: ["date", "worker", "function", "site", "hours", "description"]
  },
  {
    id: "crew",
    title: "Evidencija zaposlenih na gradilištu",
    hint: "Zaposleni koje je odgovorno lice unelo i koliko su sati radili.",
    keys: ["crew_worker", "crew_hours"]
  },
  {
    id: "machines",
    title: "Mašine",
    hint: "Bager, valjak, buldozer i druga mehanizacija.",
    keys: ["machine_code", "machine", "machine_km_start", "machine_km_end", "machine_km_total", "machine_start", "machine_end", "machine_hours", "machine_work"]
  },
  {
    id: "vehicles",
    title: "Vozila / kamioni",
    hint: "Kamioni, kilometraža, relacija, ture i kubici.",
    keys: ["vehicle_code", "vehicle", "registration", "capacity", "km_start", "km_end", "route", "tours", "cubic"]
  },
  {
    id: "fuel",
    title: "Sipanje goriva",
    hint: "Gorivo koje je zaposleni sipao u svoju mašinu ili vozilo.",
    keys: ["fuel_type", "fuel_asset_code", "fuel_for", "fuel_registration", "fuel_liters", "fuel_km", "fuel_mtc", "fuel_by", "fuel_receiver", "fuel_source_type", "fuel_source"]
  },
  {
    id: "lowloader",
    title: "Transport mašine labudicom",
    hint: "Selidba mašine sa jedne lokacije na drugu.",
    keys: ["lowloader_plates", "lowloader_from", "lowloader_to", "lowloader_km_start", "lowloader_km_end", "lowloader_km", "lowloader_machine", "lowloader_tools"]
  },
  {
    id: "waterTanker",
    title: "Cisterna za vodu",
    hint: "Voda za prskanje, punjenje, istovar i rad na gradilištu.",
    keys: ["water_site", "water_vehicle_code", "water_vehicle", "water_km_start", "water_km_end", "water_km", "water_liters", "water_loads", "water_fill_location", "water_unload_location", "water_purpose", "water_note"]
  },
  {
    id: "fieldTanker",
    title: "Evidencija goriva – cisterna",
    hint: "Cisterna koja na terenu sipa gorivo drugim mašinama/vozilima.",
    keys: ["field_tanker_site", "field_tanker_vehicle_code", "field_tanker_vehicle", "field_tanker_vehicle_registration", "field_tanker_type", "field_tanker_asset_code", "field_tanker_asset", "field_tanker_registration", "field_tanker_km", "field_tanker_mtc", "field_tanker_liters", "field_tanker_receiver", "field_tanker_source_type", "field_tanker_source"]
  },
  {
    id: "material",
    title: "Materijal",
    hint: "Materijal, količina i jedinica mere.",
    keys: ["material_action", "material", "material_tours", "material_per_tour", "quantity", "unit", "material_calc", "material_note"]
  },
  {
    id: "warehouse",
    title: "Magacin",
    hint: "Ulaz/izlaz/stanje u magacinu ako zaposleni ima tu rubriku.",
    keys: ["warehouse_type", "warehouse_item", "warehouse_qty"]
  },
  {
    id: "leave",
    title: "Zahtev za odsustvo / godišnji odmor",
    hint: "Zahtevi zaposlenog za slobodan dan ili godišnji odmor.",
    keys: ["leave_type", "leave_date", "leave_from", "leave_to", "leave_note"]
  },
  {
    id: "defects",
    title: "Kvarovi",
    hint: "Kratak prikaz kvara ako se izvozi zajedno sa dnevnim izveštajem.",
    keys: ["defect_type", "defect_asset_code", "defect_asset", "defect_registration", "defect_site", "defect", "defect_work_impact", "defect_urgency", "defect_called_mechanic", "defect_status"]
  },
  {
    id: "status",
    title: "Status i napomene",
    hint: "Status izveštaja i dodatna napomena.",
    keys: ["status"]
  }
];

function getExportSelectedIds() {
  try { return JSON.parse(localStorage.getItem(EXPORT_SELECTION_KEY) || "[]"); }
  catch { return []; }
}

function setExportSelectedIds(ids) {
  const clean = Array.from(new Set((ids || []).filter(Boolean)));
  localStorage.setItem(EXPORT_SELECTION_KEY, JSON.stringify(clean));
  return clean;
}

function getExportColumnKeys() {
  try {
    const raw = localStorage.getItem(EXPORT_COLUMN_KEY);
    if (raw !== null) {
      const saved = JSON.parse(raw);
      if (Array.isArray(saved)) return saved;
    }
  } catch {}
  return EXPORT_COLUMNS.map(c => c.key);
}

function setExportColumnKeys(keys) {
  localStorage.setItem(EXPORT_COLUMN_KEY, JSON.stringify(keys || []));
}

window.toggleReportExportSelection = (id, checked) => {
  const ids = getExportSelectedIds();
  const next = checked ? [...ids, id] : ids.filter(x => x !== id);
  setExportSelectedIds(next);
  renderExportPanel();
};

window.selectAllReportsForExport = () => {
  const ids = directorReportsCache.map(r => r.id);
  setExportSelectedIds(ids);
  $$(".report-export-check").forEach(cb => cb.checked = true);
  renderExportPanel();
  toast("Svi prikazani izveštaji su označeni za Excel export.");
};

window.clearReportsForExport = () => {
  setExportSelectedIds([]);
  $$(".report-export-check").forEach(cb => cb.checked = false);
  renderExportPanel();
  toast("Označeni izveštaji su poništeni.");
};

window.goToExportTab = () => {
  const tab = document.querySelector('.tab[data-tab="export"]');
  if (tab) tab.click();
  renderExportPanel();
};

window.toggleExportColumn = (key, checked) => {
  const keys = getExportColumnKeys();
  const next = checked ? [...keys, key] : keys.filter(k => k !== key);
  setExportColumnKeys(Array.from(new Set(next)));
  renderExportPanel();
  refreshExportPreviewIfVisible();
};

window.selectAllExportColumns = () => {
  setExportColumnKeys(EXPORT_COLUMNS.map(c => c.key));
  renderExportPanel();
  refreshExportPreviewIfVisible();
  toast("Sve rubrike za Excel su označene.");
};

window.clearExportColumns = () => {
  setExportColumnKeys([]);
  $$("#exportColumnsBox input[type='checkbox']").forEach(cb => cb.checked = false);
  renderExportPanel();
  refreshExportPreviewIfVisible();
  toast("Sve rubrike za Excel su poništene.");
};

window.applySimpleExportColumns = () => {
  setExportColumnKeys(SIMPLE_EXPORT_KEYS);
  renderExportPanel();
  refreshExportPreviewIfVisible();
  toast("Uključen je jednostavan Excel prikaz.");
};

window.applyDetailedExportColumns = () => {
  setExportColumnKeys(EXPORT_COLUMNS.map(c => c.key));
  renderExportPanel();
  refreshExportPreviewIfVisible();
  toast("Uključen je detaljan Excel prikaz.");
};

window.selectExportGroup = (groupId) => {
  const group = EXPORT_GROUPS.find(g => g.id === groupId);
  if (!group) return;
  const current = getExportColumnKeys();
  setExportColumnKeys(Array.from(new Set([...current, ...group.keys])));
  renderExportPanel();
  refreshExportPreviewIfVisible();
};

window.clearExportGroup = (groupId) => {
  const group = EXPORT_GROUPS.find(g => g.id === groupId);
  if (!group) return;
  const remove = new Set(group.keys);
  setExportColumnKeys(getExportColumnKeys().filter(k => !remove.has(k)));
  renderExportPanel();
  refreshExportPreviewIfVisible();
};

function getSelectedReportsForExport() {
  const ids = getExportSelectedIds();
  if (!ids.length) return [];
  const set = new Set(ids);
  return directorReportsCache.filter(r => set.has(r.id));
}

function reportPersonName(r) {
  return r.company_users ? `${r.company_users.first_name || ""} ${r.company_users.last_name || ""}`.trim() : ((r.data || {}).created_by_worker || (r.data || {}).worker_name || "");
}

function flattenReportRowsForExport(r) {
  const d = r.data || {};
  const workers = Array.isArray(d.workers) ? d.workers : (Array.isArray(d.worker_entries) ? d.worker_entries : []);
  const machines = Array.isArray(d.machines) ? d.machines : [];
  const vehicles = Array.isArray(d.vehicles) ? d.vehicles : [];
  const lowloaders = officeLowloaderEntries(d);
  const waters = officeWaterEntries(d);
  const fuels = Array.isArray(d.fuel_entries) ? d.fuel_entries : [];
  const fieldTankers = Array.isArray(d.field_tanker_entries) ? d.field_tanker_entries : (Array.isArray(d.tanker_fuel_entries) ? d.tanker_fuel_entries : []);
  const materials = Array.isArray(d.material_entries) ? d.material_entries : (Array.isArray(d.material_movements) ? d.material_movements : (Array.isArray(d.materials) ? d.materials : []));
  const leaveRequest = d.leave_request || {};
  const rows = [];

  const base = {
    date: r.report_date || "",
    worker: reportPersonName(r),
    employee_number: reportEmployeeNumber(r),
    function: r.company_users?.function_title || "",
    site: d.site_name || "",
    hours: d.hours || "",
    description: d.description || "",
    status: r.status || "",
    note: d.note || ""
  };
  const pushRow = (extra = {}) => rows.push({ ...base, ...extra });

  // v1.25.0 važno pravilo:
  // Ne spajati različite evidencije po istom indeksu niza.
  // Svaka mašina, svako vozilo, svako sipanje goriva i svaki materijal mora biti svoj zaseban Excel red.
  // Tako litri goriva nikad ne mogu da završe u redu materijala/mašine, niti ture materijala u redu goriva.

  workers.forEach(w => pushRow({
    crew_worker: w.full_name || [w.first_name, w.last_name].filter(Boolean).join(" ") || "",
    crew_hours: w.hours || ""
  }));

  machines.forEach(m => pushRow({
    machine_code: m.asset_code || m.machine_code || "",
    machine: m.name || "",
    machine_km_start: machineKmStart(m),
    machine_km_end: machineKmEnd(m),
    machine_km_total: machineKmTotal(m),
    machine_start: machineMtcStart(m),
    machine_end: machineMtcEnd(m),
    machine_hours: machineMtcTotal(m),
    machine_work: m.work || ""
  }));

  vehicles.forEach(v => pushRow({
    vehicle_code: v.asset_code || v.vehicle_code || "",
    vehicle: v.name || v.vehicle || "",
    registration: v.registration || "",
    capacity: v.capacity || "",
    km_start: v.km_start || "",
    km_end: v.km_end || "",
    route: v.route || "",
    tours: v.tours || "",
    cubic: v.cubic_m3 || v.cubic_auto || ""
  }));

  lowloaders.forEach(ll => pushRow({
    lowloader_plates: ll.plates || ll.registration || "",
    lowloader_from: ll.from_site || ll.from_address || "",
    lowloader_to: ll.to_site || ll.to_address || "",
    lowloader_km_start: ll.km_start || "",
    lowloader_km_end: ll.km_end || "",
    lowloader_km: lowloaderKmTotal(ll),
    lowloader_machine: ll.machine || ll.machine_name || ll.transported_machine || "",
    lowloader_tools: ll.accompanying_tools || ll.tools || ""
  }));

  waters.forEach(wt => pushRow({
    water_site: officeEntrySiteName(wt, d.site_name || ""),
    water_vehicle_code: wt.asset_code || wt.vehicle_code || "",
    water_vehicle: wt.vehicle || wt.asset_name || wt.tanker_vehicle || "",
    water_km_start: wt.km_start || "",
    water_km_end: wt.km_end || "",
    water_km: waterTankerKmTotal(wt),
    water_liters: waterTankerLiters(wt) || "",
    water_loads: waterTankerLoads(wt) || "",
    water_fill_location: wt.fill_location || "",
    water_unload_location: wt.unload_location || wt.spray_location || "",
    water_purpose: waterTankerPurposeLabel(wt.purpose),
    water_note: wt.note || ""
  }));

  fuels.forEach(f => pushRow({
    fuel_type: assetKindLabel(f.asset_kind),
    fuel_asset_code: f.asset_code || "",
    fuel_for: f.asset_name || f.machine || f.vehicle || f.other || f.manual_asset_name || "",
    fuel_registration: f.asset_registration || f.registration || "",
    fuel_liters: f.liters || "",
    fuel_km: f.km || f.current_km || (f.asset_kind === "vehicle" ? (f.reading || f.mtc_km) : "") || "",
    fuel_mtc: f.mtc || f.current_mtc || (f.asset_kind === "machine" ? (f.reading || f.mtc_km) : "") || "",
    fuel_by: f.by || "",
    fuel_receiver: f.receiver || d.fuel_receiver || "",
    fuel_source_type: fuelSourceTypeLabel(f.fuel_source_type || f.source_type),
    fuel_source: fuelSourceName(f)
  }));

  fieldTankers.forEach(ft => pushRow({
    field_tanker_site: ft.site_name || "",
    field_tanker_vehicle_code: ft.tanker_asset_code || ft.tanker_vehicle_code || "",
    field_tanker_vehicle: ft.tanker_asset_name || ft.tanker_vehicle || ft.cistern_vehicle || "",
    field_tanker_vehicle_registration: ft.tanker_registration || ft.tanker_plates || ft.cistern_registration || ft.cistern_plates || "",
    field_tanker_type: assetKindLabel(ft.asset_kind),
    field_tanker_asset_code: ft.asset_code || "",
    field_tanker_asset: ft.asset_name || ft.machine || ft.vehicle || ft.other || ft.manual_asset_name || "",
    field_tanker_registration: ft.asset_registration || ft.registration || "",
    field_tanker_km: ft.km || ft.current_km || (ft.asset_kind === "vehicle" ? (ft.reading || ft.mtc_km) : ""),
    field_tanker_mtc: ft.mtc || ft.current_mtc || (ft.asset_kind === "machine" ? (ft.reading || ft.mtc_km) : ""),
    field_tanker_liters: ft.liters || "",
    field_tanker_receiver: ft.receiver || ft.received_by || "",
    field_tanker_source_type: fuelSourceTypeLabel(ft.fuel_source_type || ft.source_type),
    field_tanker_source: fuelSourceName(ft)
  }));

  materials.forEach(mat => pushRow({
    material_action: mat.action || mat.material_action || "",
    material: mat.material || mat.name || "",
    material_tours: mat.tours || mat.material_tours || "",
    material_per_tour: mat.per_tour || mat.quantity_per_tour || mat.material_per_tour || "",
    quantity: materialQuantityValue(mat),
    unit: materialUnitValue(mat),
    material_calc: mat.calc_text || materialCalcText(mat),
    material_note: mat.note || ""
  }));

  if (d.warehouse_type || d.warehouse_item || d.warehouse_qty) {
    pushRow({
      warehouse_type: d.warehouse_type || "",
      warehouse_item: d.warehouse_item || "",
      warehouse_qty: d.warehouse_qty || ""
    });
  }

  if (d.leave_request_type || d.leave_date || d.leave_from || d.leave_to || leaveRequest.label || leaveRequest.leave_label) {
    pushRow({
      leave_type: d.leave_request_type || leaveRequest.leave_label || leaveRequest.label || "",
      leave_date: d.leave_date || leaveRequest.leave_date || leaveRequest.date || "",
      leave_from: d.leave_from || leaveRequest.date_from || "",
      leave_to: d.leave_to || leaveRequest.date_to || "",
      leave_note: d.leave_note || leaveRequest.leave_note || leaveRequest.note || ""
    });
  }

  if (d.defect || d.defect_description || d.problem_description || d.defect_asset_name || d.defect_asset_code) {
    pushRow({
      defect_type: assetKindLabel(d.defect_asset_kind),
      defect_asset_code: d.defect_asset_code || "",
      defect_asset: d.defect_asset_name || d.defect_machine || d.machine || d.vehicle || "",
      defect_registration: d.defect_asset_registration || "",
      defect_site: d.defect_site_name || d.site_name || "",
      defect: d.defect || d.defect_description || d.problem_description || "",
      defect_work_impact: defectImpactLabel(d.defect_work_impact),
      defect_urgency: d.defect_urgency || "",
      defect_called_mechanic: d.called_mechanic_by_phone || d.defect_called_mechanic || "",
      defect_status: d.defect_status || ""
    });
  }

  if (!rows.length) pushRow({});
  return rows;
}


const SMART_EXPORT_PRESETS = {
  all: {
    title: "Sve iz izabranih izveštaja",
    keys: EXPORT_COLUMNS.map(c => c.key)
  },
  fuel_all: {
    title: "Sva sipanja goriva",
    keys: ["date","worker","site","fuel_type","fuel_asset_code","fuel_for","fuel_registration","fuel_liters","fuel_km","fuel_mtc","fuel_by","fuel_receiver","field_tanker_site","field_tanker_vehicle_code","field_tanker_vehicle","field_tanker_vehicle_registration","field_tanker_type","field_tanker_asset_code","field_tanker_asset","field_tanker_registration","field_tanker_km","field_tanker_mtc","field_tanker_liters","field_tanker_receiver","status"]
  },
  fuel_own: {
    title: "Evidencija goriva – korisnik/vozilo/opremu",
    keys: ["date","worker","site","fuel_type","fuel_asset_code","fuel_for","fuel_registration","fuel_liters","fuel_km","fuel_mtc","fuel_by","fuel_receiver","status"]
  },
  fuel_tanker: {
    title: "Evidencija goriva – cisterna",
    keys: ["date","worker","site","field_tanker_site","field_tanker_vehicle_code","field_tanker_vehicle","field_tanker_vehicle_registration","field_tanker_type","field_tanker_asset_code","field_tanker_asset","field_tanker_registration","field_tanker_km","field_tanker_mtc","field_tanker_liters","field_tanker_receiver","status"]
  },
  hours_workers: {
    title: "Radni sati zaposlenog",
    keys: ["date","site","worker","function","hours","description","crew_worker","crew_hours","status"]
  },
  machines: {
    title: "Rad mašina / MTČ",
    keys: ["date","site","worker","machine_code","machine","machine_km_start","machine_km_end","machine_km_total","machine_start","machine_end","machine_hours","machine_work","status"]
  },
  vehicles: {
    title: "Vozila / ture / m³",
    keys: ["date","site","worker","vehicle_code","vehicle","registration","capacity","km_start","km_end","route","tours","cubic","status"]
  },
  lowloader: {
    title: "Transport mašine labudicom",
    keys: ["date","site","worker","lowloader_plates","lowloader_from","lowloader_to","lowloader_km_start","lowloader_km_end","lowloader_km","lowloader_machine","status"]
  },
  materials: {
    title: "Materijal",
    keys: ["date","site","worker","material_action","material","material_tours","material_per_tour","quantity","unit","material_calc","material_note","status"]
  },
  warehouse: {
    title: "Magacin",
    keys: ["date","site","worker","warehouse_type","warehouse_item","warehouse_qty","status"]
  },
  leave: {
    title: "Slobodni dani / godišnji",
    keys: ["date","site","worker","leave_type","leave_date","leave_from","leave_to","leave_note","status"]
  },
  defects: {
    title: "Kvarovi",
    keys: ["date","site","worker","defect_type","defect_asset_code","defect_asset","defect_registration","defect_site","defect","defect_work_impact","defect_urgency","defect_called_mechanic","defect_status","status"]
  }
};

function getSmartExportSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SMART_EXPORT_KEY) || "{}");
    return {
      type: saved.type || "all",
      from: saved.from || "",
      to: saved.to || "",
      site: saved.site || "",
      worker: saved.worker || "",
      item: saved.item || ""
    };
  } catch {
    return { type:"all", from:"", to:"", site:"", worker:"", item:"" };
  }
}

function setSmartExportSettings(settings) {
  const clean = {
    type: settings.type || "all",
    from: settings.from || "",
    to: settings.to || "",
    site: settings.site || "",
    worker: settings.worker || "",
    item: settings.item || ""
  };
  localStorage.setItem(SMART_EXPORT_KEY, JSON.stringify(clean));
  return clean;
}

function getExportTemplateType() {
  return localStorage.getItem(EXPORT_TEMPLATE_KEY) || "classic";
}

function setExportTemplateType(type) {
  const clean = ["classic", "summary"].includes(type) ? type : "classic";
  localStorage.setItem(EXPORT_TEMPLATE_KEY, clean);
  return clean;
}

function exportTemplateLabel(type = getExportTemplateType()) {
  if (type === "summary") return "Obračunski kalup sa ukupnim zbirom";
  return "Klasični Excel kalup";
}

function getSmartExportUiText(type) {
  const t = type || "all";
  const map = {
    hours_workers: {
      workerLabel: "Zaposleni",
      workerPlaceholder: "npr. Marko ili prazno za sve zaposlene",
      itemLabel: "Dodatno",
      itemPlaceholder: "nije obavezno za radne sate",
      hideItem: true,
      hint: "Radni sati: izaberi gradilište i period. Zaposlenog upiši samo ako tražiš pojedinca."
    },
    machines: {
      workerLabel: "Operator / zaposleni",
      workerPlaceholder: "npr. Marko ili prazno za sve operatore",
      itemLabel: "Mašina",
      itemPlaceholder: "npr. CAT 330, bager, valjak",
      hideItem: false,
      hint: "Mašine / MTČ: u polje Mašina možeš upisati broj ili naziv mašine."
    },
    vehicles: {
      workerLabel: "Ime i prezime vozača",
      workerPlaceholder: "npr. Jovan ili prazno za sve vozače",
      itemLabel: "Vozilo / tablice",
      itemPlaceholder: "npr. MAN, BG123, kiper",
      hideItem: false,
      hint: "Vozila: koristi za ture, kilometražu i m³."
    },
    fuel_all: {
      workerLabel: "Sipao / primio",
      workerPlaceholder: "npr. Milan ili prazno za sve",
      itemLabel: "Mašina / vozilo",
      itemPlaceholder: "npr. CAT 330, MAN, BG123",
      hideItem: false,
      hint: "Gorivo: prikazuje samo sipanja goriva. Ne spaja se sa materijalom, satima ili MTČ radom."
    },
    fuel_tanker: {
      workerLabel: "Primio gorivo",
      workerPlaceholder: "npr. Marko ili prazno za sve",
      itemLabel: "Tankovano sredstvo",
      itemPlaceholder: "npr. bager, kamion, registracija",
      hideItem: false,
      hint: "Cisterna: prikazuje sipanja iz cisterne po gradilištu i datumu."
    },
    water_tanker: {
      workerLabel: "Vozač / zaposleni",
      workerPlaceholder: "npr. Jovan ili prazno za sve",
      itemLabel: "Cisterna / voda",
      itemPlaceholder: "npr. cisterna, tablice, Makiš, prskanje",
      hideItem: false,
      hint: "Cisterna za vodu: prikazuje litre vode, punjenja, lokacije punjenja i prskanja."
    },
    materials: {
      workerLabel: "Ime i prezime vozača / zaposleni",
      workerPlaceholder: "npr. Marko ili prazno za sve",
      itemLabel: "Materijal",
      itemPlaceholder: "npr. kamen 0-31, pesak, zemlja",
      hideItem: false,
      hint: "Materijal: svako ime materijala računa se posebno. Ture i količina ostaju materijal-only."
    }
  };
  return map[t] || {
    workerLabel: "Zaposleni / ime",
    workerPlaceholder: "npr. Marko ili prazno za sve",
    itemLabel: "Stavka / naziv",
    itemPlaceholder: "npr. CAT 330, MAN, kamen 0-31",
    hideItem: false,
    hint: "Izaberi filtere i klikni Prikaži pregled."
  };
}

function exportOptionHtml(value, label = "") {
  const v = String(value || "").trim();
  if (!v) return "";
  const l = String(label || "").trim();
  return `<option value="${escapeHtml(v)}"${l ? ` label="${escapeHtml(l)}"` : ""}></option>`;
}

function activeDirectorSites() {
  return (directorSitesCache || []).filter(s => s && s.active !== false && (s.name || s.location));
}

function activeDirectorAssets() {
  return (directorAssetsCache || []).filter(a => a && a.active !== false && (getAssetCode(a) || getAssetName(a) || getAssetRegistration(a)));
}

function activeDirectorMaterials() {
  return (directorMaterialsCache || []).filter(m => m && m.active !== false && m.name);
}

function activeDirectorPeople() {
  return (directorPeopleCache || []).filter(p => p && p.active !== false && (p.first_name || p.last_name || p.access_code));
}

function buildAssetExportOptions(assets) {
  const options = [];
  const seen = new Set();
  (assets || []).forEach(a => {
    const code = getAssetCode(a);
    const name = getAssetName(a);
    const reg = getAssetRegistration(a);
    const label = [code ? `broj ${code}` : "", name, reg ? `reg. ${reg}` : ""].filter(Boolean).join(" · ");
    [code, name, reg].filter(Boolean).forEach(value => {
      const key = normalizeSearch(value);
      if (!key || seen.has(key)) return;
      seen.add(key);
      options.push(exportOptionHtml(value, label));
    });
  });
  return options.join("");
}

function updateSmartExportDatalists(type = $("#smartExportType")?.value || getSmartExportSettings().type || "all") {
  const siteList = $("#smartExportSiteList");
  if (siteList) {
    siteList.innerHTML = activeDirectorSites().map(s => exportOptionHtml(s.name, [s.location, "gradilište iz Uprave"].filter(Boolean).join(" · "))).join("");
  }

  const workerList = $("#smartExportWorkerList");
  if (workerList) {
    workerList.innerHTML = activeDirectorPeople().map(p => {
      const full = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
      return exportOptionHtml(full || p.access_code, [p.function_title, p.access_code ? `kod ${p.access_code}` : ""].filter(Boolean).join(" · "));
    }).join("");
  }

  const itemList = $("#smartExportItemList");
  if (!itemList) return;
  let html = "";
  if (type === "materials") {
    html = activeDirectorMaterials().map(m => exportOptionHtml(m.name, [m.unit, m.category].filter(Boolean).join(" · "))).join("");
  } else if (type === "vehicles") {
    html = buildAssetExportOptions(activeDirectorAssets().filter(isVehicleAsset));
  } else if (type === "machines") {
    html = buildAssetExportOptions(activeDirectorAssets().filter(isMachineAsset));
  } else if (type === "fuel_all" || type === "fuel_own" || type === "fuel_tanker" || type === "lowloader" || type === "water_tanker") {
    html = buildAssetExportOptions(activeDirectorAssets());
  } else {
    html = [
      buildAssetExportOptions(activeDirectorAssets()),
      activeDirectorMaterials().map(m => exportOptionHtml(m.name, [m.unit, m.category].filter(Boolean).join(" · "))).join("")
    ].join("");
  }
  itemList.innerHTML = html || `<option value="Nema učitanih stavki iz Uprave"></option>`;
}

function updateSmartExportFieldLabels(type) {
  const text = getSmartExportUiText(type);
  const workerLabel = $("#smartExportWorkerLabel");
  const workerInput = $("#smartExportWorker");
  const itemWrap = $("#smartExportItemWrap");
  const itemLabel = $("#smartExportItemLabel");
  const itemInput = $("#smartExportItem");
  if (workerLabel) workerLabel.textContent = text.workerLabel;
  if (workerInput) workerInput.placeholder = text.workerPlaceholder;
  if (itemLabel) itemLabel.textContent = text.itemLabel;
  if (itemInput) itemInput.placeholder = text.itemPlaceholder;
  if (itemWrap) itemWrap.classList.toggle("hidden", !!text.hideItem);
  updateSmartExportDatalists(type);
}

function showExportPreviewMessage(message, isError = false) {
  const box = $("#exportPreviewBox");
  if (!box) return;
  box.innerHTML = `<div class="export-preview-empty ${isError ? "error" : ""}">
    <b>${isError ? "⚠️ Nema spremne tabele" : "ℹ️ Pregled"}</b>
    <p>${escapeHtml(message)}</p>
  </div>`;
  box.classList.remove("hidden");
  const actions = $("#exportPreviewActions");
  if (actions) actions.classList.add("hidden");
}

function refreshExportPreviewIfVisible() {
  const box = $("#exportPreviewBox");
  if (!box || box.classList.contains("hidden") || !box.innerHTML.trim()) return;
  try {
    box.innerHTML = buildExportPreviewHtml();
    const actions = $("#exportPreviewActions");
    if (actions) actions.classList.remove("hidden");
  } catch (e) {
    showExportPreviewMessage(e.message, true);
  }
}

function smartExportReportMatches(r, settings) {
  const d = r.data || {};
  const date = String(r.report_date || "").slice(0, 10);
  if (settings.from && date && date < settings.from) return false;
  if (settings.to && date && date > settings.to) return false;
  const siteQ = normalizeSearch(settings.site || "");
  if (siteQ) {
    const siteText = normalizeSearch([
      d.site_name,
      d.site,
      r.site_name,
      ...(Array.isArray(d.machines) ? d.machines.map(x => officeEntrySiteName(x, "")) : []),
      ...(Array.isArray(d.vehicles) ? d.vehicles.map(x => officeEntrySiteName(x, "")) : []),
      ...officeLowloaderEntries(d).map(x => lowloaderSiteLabel(x, "")),
      ...officeWaterEntries(d).map(x => officeEntrySiteName(x, "")),
      ...(Array.isArray(d.field_tanker_entries) ? d.field_tanker_entries.map(x => officeEntrySiteName(x, "")) : [])
    ].filter(Boolean).join(" "));
    if (!siteText.includes(siteQ)) return false;
  }
  const workerQ = normalizeSearch(settings.worker || "");
  if (workerQ) {
    const workerText = normalizeSearch([
      reportPersonName(r),
      r.company_users?.first_name,
      r.company_users?.last_name,
      r.company_users?.function_title,
      reportEmployeeNumber(r),
      d.created_by_worker,
      d.worker_name,
      d.access_code,
      d.worker_code
    ].filter(Boolean).join(" "));
    if (!workerText.includes(workerQ)) return false;
  }
  return true;
}



function smartRowsForReport(r, type) {
  if (!type || type === "all") return flattenReportRowsForExport(r);
  const d = r.data || {};
  const base = baseExportRow(r);
  const rows = [];
  const workers = Array.isArray(d.workers) ? d.workers : (Array.isArray(d.worker_entries) ? d.worker_entries : []);
  const machines = Array.isArray(d.machines) ? d.machines : [];
  const vehicles = Array.isArray(d.vehicles) ? d.vehicles : [];
  const lowloaders = officeLowloaderEntries(d);
  const waters = officeWaterEntries(d);
  const fuels = Array.isArray(d.fuel_entries) ? d.fuel_entries : [];
  const fieldTankers = Array.isArray(d.field_tanker_entries) ? d.field_tanker_entries : (Array.isArray(d.tanker_fuel_entries) ? d.tanker_fuel_entries : []);
  const materials = Array.isArray(d.material_entries) ? d.material_entries : (Array.isArray(d.material_movements) ? d.material_movements : []);
  const leaveRequest = d.leave_request || {};

  if (type === "fuel_all" || type === "fuel_own") {
    fuels.forEach(f => rows.push({
      ...base,
      fuel_type: assetKindLabel(f.asset_kind),
      fuel_asset_code: f.asset_code || "",
      fuel_for: f.asset_name || f.machine || f.vehicle || f.other || f.manual_asset_name || "",
      fuel_registration: f.asset_registration || f.registration || "",
      fuel_liters: f.liters || "",
      fuel_km: f.km || f.current_km || (f.asset_kind === "vehicle" ? (f.reading || f.mtc_km) : "") || "",
      fuel_mtc: f.mtc || f.current_mtc || (f.asset_kind === "machine" ? (f.reading || f.mtc_km) : "") || "",
      fuel_by: f.by || "",
      fuel_receiver: f.receiver || d.fuel_receiver || "",
      fuel_source_type: fuelSourceTypeLabel(f.fuel_source_type || f.source_type),
      fuel_source: fuelSourceName(f)
    }));
  }

  if (type === "fuel_all" || type === "fuel_tanker") {
    fieldTankers.forEach(ft => rows.push({
      ...base,
      field_tanker_site: ft.site_name || d.site_name || "",
      field_tanker_vehicle_code: ft.tanker_asset_code || ft.tanker_vehicle_code || "",
      field_tanker_vehicle: ft.tanker_asset_name || ft.tanker_vehicle || ft.cistern_vehicle || "",
      field_tanker_vehicle_registration: ft.tanker_registration || ft.tanker_plates || ft.cistern_registration || ft.cistern_plates || "",
      field_tanker_type: assetKindLabel(ft.asset_kind),
      field_tanker_asset_code: ft.asset_code || "",
      field_tanker_asset: ft.asset_name || ft.machine || ft.vehicle || ft.other || ft.manual_asset_name || "",
      field_tanker_registration: ft.asset_registration || ft.registration || "",
      field_tanker_km: ft.km || ft.current_km || (ft.asset_kind === "vehicle" ? (ft.reading || ft.mtc_km) : ""),
      field_tanker_mtc: ft.mtc || ft.current_mtc || (ft.asset_kind === "machine" ? (ft.reading || ft.mtc_km) : ""),
      field_tanker_liters: ft.liters || "",
      field_tanker_receiver: ft.receiver || ft.received_by || "",
      field_tanker_source_type: fuelSourceTypeLabel(ft.fuel_source_type || ft.source_type),
      field_tanker_source: fuelSourceName(ft)
    }));
  }

  if (type === "hours_workers") {
    if (workers.length) {
      workers.forEach(w => rows.push({
        ...base,
        crew_worker: w.full_name || [w.first_name, w.last_name].filter(Boolean).join(" ") || "",
        crew_hours: w.hours || ""
      }));
    } else if (base.hours || base.description) {
      rows.push(base);
    }
  }

  if (type === "machines") {
    machines.forEach(m => rows.push({
      ...base,
      machine_code: m.asset_code || m.machine_code || "",
      machine: m.name || d.machine || "",
      machine_km_start: machineKmStart(m) || d.machine_km_start || "",
      machine_km_end: machineKmEnd(m) || d.machine_km_end || "",
      machine_km_total: machineKmTotal(m) || d.machine_km_total || "",
      machine_start: machineMtcStart(m) || d.mtc_start || "",
      machine_end: machineMtcEnd(m) || d.mtc_end || "",
      machine_hours: machineMtcTotal(m) || d.machine_hours || "",
      machine_work: m.work || ""
    }));
  }

  if (type === "vehicles") {
    vehicles.forEach(v => rows.push({
      ...base,
      vehicle_code: v.asset_code || v.vehicle_code || "",
      vehicle: v.name || v.vehicle || d.vehicle || "",
      registration: v.registration || "",
      capacity: v.capacity || "",
      km_start: v.km_start || d.km_start || "",
      km_end: v.km_end || d.km_end || "",
      route: v.route || d.route || "",
      tours: v.tours || d.tours || "",
      cubic: v.cubic_m3 || v.cubic_auto || ""
    }));
  }

  if (type === "lowloader") {
    lowloaders.forEach(ll => rows.push({
      ...base,
      lowloader_plates: ll.plates || ll.registration || "",
      lowloader_from: ll.from_site || ll.from_address || "",
      lowloader_to: ll.to_site || ll.to_address || "",
      lowloader_km_start: ll.km_start || "",
      lowloader_km_end: ll.km_end || "",
      lowloader_km: ll.km_total || "",
      lowloader_machine: ll.machine || "",
      lowloader_tools: ll.accompanying_tools || ll.tools || ""
    }));
  }

  if (type === "water_tanker") {
    waters.forEach(wt => rows.push({
      ...base,
      water_site: officeEntrySiteName(wt, d.site_name || ""),
      water_vehicle_code: wt.asset_code || wt.vehicle_code || "",
      water_vehicle: wt.vehicle || wt.asset_name || wt.tanker_vehicle || "",
      water_km_start: wt.km_start || "",
      water_km_end: wt.km_end || "",
      water_km: waterTankerKmTotal(wt),
      water_liters: waterTankerLiters(wt) || "",
      water_loads: waterTankerLoads(wt) || "",
      water_fill_location: wt.fill_location || "",
      water_unload_location: wt.unload_location || wt.spray_location || "",
      water_purpose: waterTankerPurposeLabel(wt.purpose),
      water_note: wt.note || ""
    }));
  }

  if (type === "materials") {
    materials.forEach(mat => rows.push({
      ...base,
      material_action: mat.action || mat.material_action || "",
      material: mat.material || mat.name || "",
      material_tours: mat.tours || mat.material_tours || "",
      material_per_tour: mat.per_tour || mat.quantity_per_tour || mat.material_per_tour || "",
      quantity: materialQuantityValue(mat),
      unit: materialUnitValue(mat),
      material_calc: mat.calc_text || materialCalcText(mat),
      material_note: mat.note || ""
    }));
  }

  if (type === "warehouse") {
    if (d.warehouse_type || d.warehouse_item || d.warehouse_qty) {
      rows.push({
        ...base,
        warehouse_type: d.warehouse_type || "",
        warehouse_item: d.warehouse_item || "",
        warehouse_qty: d.warehouse_qty || ""
      });
    }
  }

  if (type === "leave") {
    if (d.leave_request_type || d.leave_date || d.leave_from || d.leave_to || leaveRequest.label || leaveRequest.leave_label) {
      rows.push({
        ...base,
        leave_type: d.leave_request_type || leaveRequest.leave_label || leaveRequest.label || "",
        leave_date: d.leave_date || leaveRequest.leave_date || leaveRequest.date || "",
        leave_from: d.leave_from || leaveRequest.date_from || "",
        leave_to: d.leave_to || leaveRequest.date_to || "",
        leave_note: d.leave_note || leaveRequest.leave_note || leaveRequest.note || ""
      });
    }
  }

  if (type === "defects") {
    if (d.defect || d.defect_description || d.problem_description || d.defect_asset_name || d.defect_asset_code) {
      rows.push({
        ...base,
        defect_type: assetKindLabel(d.defect_asset_kind),
        defect_asset_code: d.defect_asset_code || "",
        defect_asset: d.defect_asset_name || d.defect_machine || d.machine || d.vehicle || "",
        defect_registration: d.defect_asset_registration || "",
        defect_site: d.defect_site_name || d.site_name || "",
        defect: d.defect || d.defect_description || d.problem_description || "",
        defect_work_impact: defectImpactLabel(d.defect_work_impact),
        defect_urgency: d.defect_urgency || "",
        defect_called_mechanic: d.called_mechanic_by_phone || d.defect_called_mechanic || "",
        defect_status: d.defect_status || ""
      });
    }
  }

  return rows;
}


function smartExportRowMatches(row, settings) {
  const siteQ = normalizeSearch(settings.site || "");
  if (siteQ) {
    const siteText = normalizeSearch([
      row.site,
      row.field_tanker_site,
      row.defect_site,
      row.lowloader_from,
      row.lowloader_to,
      row.lowloader_tools,
      row.water_site,
      row.water_fill_location,
      row.water_unload_location
    ].filter(Boolean).join(" "));
    if (!siteText.includes(siteQ)) return false;
  }

  const workerQ = normalizeSearch(settings.worker || "");
  if (workerQ) {
    const workerText = normalizeSearch([
      row.worker,
      row.crew_worker,
      row.function,
      row.fuel_by,
      row.fuel_receiver,
      row.field_tanker_receiver,
      row.fuel_source,
      row.field_tanker_source
    ].filter(Boolean).join(" "));
    if (!workerText.includes(workerQ)) return false;
  }

  const itemQ = normalizeSearch(settings.item || "");
  if (itemQ) {
    const itemText = normalizeSearch([
      row.machine_code,
      row.machine,
      row.vehicle_code,
      row.vehicle,
      row.registration,
      row.fuel_asset_code,
      row.fuel_for,
      row.fuel_registration,
      row.field_tanker_asset_code,
      row.field_tanker_asset,
      row.field_tanker_registration,
      row.material,
      row.material_action,
      row.defect_asset_code,
      row.defect_asset,
      row.defect_registration,
      row.lowloader_machine,
      row.lowloader_tools,
      row.lowloader_plates,
      row.water_vehicle_code,
      row.water_vehicle,
      row.water_purpose,
      row.water_note,
      row.fuel_source,
      row.field_tanker_source
    ].filter(Boolean).join(" "));
    if (!itemText.includes(itemQ)) return false;
  }

  return true;
}

function getSmartRowsForReport(r, settings) {
  return smartRowsForReport(r, settings.type || "all").filter(row => smartExportRowMatches(row, settings));
}

function highlightSmartExportCards(type) {
  const cleanType = SMART_EXPORT_PRESETS[type] ? type : "all";
  $$(".smart-export-card").forEach(btn => {
    const clickCode = btn.getAttribute("onclick") || "";
    btn.classList.toggle("active", clickCode.includes(`'${cleanType}'`) || clickCode.includes(`"${cleanType}"`));
  });
}

window.setSmartExportType = (type) => {
  const cleanType = SMART_EXPORT_PRESETS[type] ? type : "all";
  const el = $("#smartExportType");
  if (el) el.value = cleanType;
  const preset = SMART_EXPORT_PRESETS[cleanType] || SMART_EXPORT_PRESETS.all;
  highlightSmartExportCards(cleanType);
  const current = getSmartExportSettings();
  setSmartExportSettings({ ...current, type: cleanType });
  // Namerno biramo rubrike samo kada korisnik menja grupu.
  // Render panela više ne sme sam da vraća štiklirano, jer tada “Poništi sve rubrike” izgleda kao da ne radi.
  setExportColumnKeys(preset.keys);
  updateSmartExportFieldLabels(cleanType);
  const info = $("#smartExportInfo");
  if (info) info.textContent = getSmartExportUiText(cleanType).hint;
  showExportPreviewMessage("Izabrana je grupa: " + preset.title + ". Upiši filtere ako treba, pa klikni Prikaži pregled.");
  renderExportPanel();
};

window.applySmartExportFilters = () => {
  const settings = setSmartExportSettings({
    type: $("#smartExportType")?.value || "all",
    from: $("#smartExportFrom")?.value || "",
    to: $("#smartExportTo")?.value || "",
    site: $("#smartExportSite")?.value || "",
    worker: $("#smartExportWorker")?.value || "",
    item: $("#smartExportItem")?.value || ""
  });
  setExportTemplateType($("#exportTemplateType")?.value || "classic");
  const preset = SMART_EXPORT_PRESETS[settings.type] || SMART_EXPORT_PRESETS.all;
  const reports = directorReportsCache
    .filter(r => !isDefectOnlyReport(r) && !isFuelDashboardOnlyReport(r) && hasDailyReportData(r))
    .filter(r => smartExportReportMatches(r, settings))
    .filter(r => getSmartRowsForReport(r, settings).length > 0);
  setExportSelectedIds(reports.map(r => r.id));
  setExportColumnKeys(preset.keys);
  renderExportPanel();
  const info = $("#smartExportInfo");
  const rowsCount = reports.flatMap(r => getSmartRowsForReport(r, settings)).length;
  if (info) info.textContent = `${preset.title}: izabrano ${reports.length} izveštaja, ${rowsCount} redova za Excel.`;
  toast(`Pripremljen export: ${preset.title}. Izveštaja: ${reports.length}.`);
};

window.clearSmartExportFilters = () => {
  setSmartExportSettings({ type:"all", from:"", to:"", site:"", worker:"", item:"" });
  setExportTemplateType("classic");
  ["#smartExportType", "#smartExportFrom", "#smartExportTo", "#smartExportSite", "#smartExportWorker", "#smartExportItem"].forEach(sel => {
    const el = $(sel);
    if (!el) return;
    el.value = sel === "#smartExportType" ? "all" : "";
  });
  const tpl = $("#exportTemplateType");
  if (tpl) tpl.value = "classic";
  updateSmartExportFieldLabels("all");
  const info = $("#smartExportInfo");
  if (info) info.textContent = "Filter je očišćen. Izaberi grupu i klikni Prikaži pregled.";
  showExportPreviewMessage("Filteri su očišćeni. Izaberi grupu izveštaja i prikaži pregled.");
  toast("Filter za poseban Excel je očišćen.");
};

function restoreSmartExportControls() {
  const settings = getSmartExportSettings();
  if ($("#smartExportType")) $("#smartExportType").value = settings.type;
  if ($("#smartExportFrom")) $("#smartExportFrom").value = settings.from;
  if ($("#smartExportTo")) $("#smartExportTo").value = settings.to;
  if ($("#smartExportSite")) $("#smartExportSite").value = settings.site;
  if ($("#smartExportWorker")) $("#smartExportWorker").value = settings.worker;
  if ($("#smartExportItem")) $("#smartExportItem").value = settings.item;
  if ($("#exportTemplateType")) $("#exportTemplateType").value = getExportTemplateType();
  highlightSmartExportCards(settings.type || "all");
  updateSmartExportFieldLabels(settings.type || "all");
}

function getExportRowsAndColumns() {
  const reports = getSelectedReportsForExport();
  const settings = getSmartExportSettings();
  const type = settings.type || "all";
  const keys = getExportColumnKeys();
  const columns = EXPORT_COLUMNS.filter(c => keys.includes(c.key));
  const rows = reports
    .filter(r => smartExportReportMatches(r, settings))
    .flatMap(r => getSmartRowsForReport(r, { ...settings, type }));
  return { reports, columns, rows };
}

function renderExportPanel() {
  const box = $("#exportSelectedReportsBox");
  const colsBox = $("#exportColumnsBox");
  const countBox = $("#exportSelectedCount");
  if (!box || !colsBox) return;

  restoreSmartExportControls();
  const selected = getSelectedReportsForExport();
  const selectedIds = new Set(selected.map(r => r.id));
  const keys = getExportColumnKeys();
  const settings = getSmartExportSettings();
  const preset = SMART_EXPORT_PRESETS[settings.type] || SMART_EXPORT_PRESETS.all;
  const exportRowsCount = selected.filter(r => smartExportReportMatches(r, settings)).flatMap(r => getSmartRowsForReport(r, settings)).length;

  if (countBox) countBox.textContent = `${selected.length} izveštaja označeno · ${exportRowsCount} redova · ${preset.title}`;

  box.innerHTML = selected.length ? selected.map(r => {
    const d = r.data || {};
    return `<div class="export-selected-item">
      <b>${escapeHtml(r.report_date || "bez datuma")}</b>
      <span>${escapeHtml(reportPersonName(r) || "Nepoznat zaposleni")}</span>
      <small>${escapeHtml(reportPrimaryLocationLabel(r))} · ${escapeHtml(r.status || "")}</small>
      <button class="secondary small-btn" type="button" onclick="toggleReportExportSelection('${r.id}', false); const cb=document.querySelector('[onchange*=\'${r.id}\']'); if(cb) cb.checked=false;">Ukloni</button>
    </div>`;
  }).join("") : `<p class="muted">Nema izabranih izveštaja. Idi u tab Izveštaji i štikliraj šta želiš za Excel.</p>`;

  const columnByKey = Object.fromEntries(EXPORT_COLUMNS.map(c => [c.key, c]));
  colsBox.innerHTML = EXPORT_GROUPS.map(group => {
    const selectedInGroup = group.keys.filter(k => keys.includes(k)).length;
    const totalInGroup = group.keys.length;
    const checks = group.keys.map(key => {
      const c = columnByKey[key];
      if (!c) return "";
      return `<label class="export-column-check">
        <input type="checkbox" ${keys.includes(c.key) ? "checked" : ""} onchange="toggleExportColumn('${c.key}', this.checked)" />
        ${escapeHtml(c.label)}
      </label>`;
    }).join("");
    return `<div class="export-column-group">
      <div class="export-group-head">
        <div>
          <h5>${escapeHtml(group.title)}</h5>
          <p>${escapeHtml(group.hint)}</p>
          <small>${selectedInGroup}/${totalInGroup} rubrika označeno</small>
        </div>
        <div class="row compact">
          <button class="secondary small-btn" type="button" onclick="selectExportGroup('${group.id}')">Označi grupu</button>
          <button class="secondary small-btn" type="button" onclick="clearExportGroup('${group.id}')">Poništi grupu</button>
        </div>
      </div>
      <div class="export-columns-grid">${checks}</div>
    </div>`;
  }).join("");

  $$(".report-export-check").forEach(cb => {
    const m = cb.getAttribute("onchange") || "";
    const id = (m.match(/toggleReportExportSelection\('([^']+)'/) || [])[1];
    if (id) cb.checked = selectedIds.has(id);
  });
}


function numericValue(value) {
  if (value === null || value === undefined || value === "") return 0;
  const n = parseFloat(String(value).replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function sumRowsByKey(rows, key) {
  return rows.reduce((sum, row) => sum + numericValue(row[key]), 0);
}

function getExportSummaryLines(type, rows) {
  const lines = [];
  if (!rows.length) return lines;
  if (type === "hours_workers") {
    lines.push(["Ukupno sati", sumRowsByKey(rows, "hours") + sumRowsByKey(rows, "crew_hours")]);
  }
  if (type === "machines") lines.push(["Ukupno MTČ", sumRowsByKey(rows, "machine_hours")]);
  if (type === "vehicles") {
    lines.push(["Ukupno tura", sumRowsByKey(rows, "tours")]);
    lines.push(["Ukupno m³", sumRowsByKey(rows, "cubic")]);
  }
  if (type === "fuel_all" || type === "fuel_own") lines.push(["Ukupno litara", sumRowsByKey(rows, "fuel_liters")]);
  if (type === "fuel_tanker") lines.push(["Ukupno litara iz cisterne", sumRowsByKey(rows, "field_tanker_liters")]);
  if (type === "materials") {
    lines.push(["Ukupno tura materijala", sumRowsByKey(rows, "material_tours")]);
    lines.push(["Ukupna količina", sumRowsByKey(rows, "quantity")]);
  }
  return lines.filter(line => line[1] !== 0 && line[1] !== "");
}

function currentCompanyExportName() {
  return currentCompany?.company_name || currentCompany?.name || currentCompany?.approved_email || "Firma";
}

function exportFilterSummary(settings) {
  return [
    settings.site ? `Gradilište: ${settings.site}` : "Gradilište: sva",
    settings.from ? `Od: ${settings.from}` : "Od: —",
    settings.to ? `Do: ${settings.to}` : "Do: —",
    settings.worker ? `Zaposleni: ${settings.worker}` : "Zaposleni: svi",
    settings.item ? `Stavka: ${settings.item}` : "Stavka: sve"
  ];
}

function buildExportPreviewHtml() {
  const { columns, rows } = getExportRowsAndColumns();
  const settings = getSmartExportSettings();
  const preset = SMART_EXPORT_PRESETS[settings.type] || SMART_EXPORT_PRESETS.all;
  const template = getExportTemplateType();
  if (!columns.length) throw new Error("Štikliraj bar jednu rubriku za pregled.");
  if (!rows.length) throw new Error("Nema redova za pregled. Proveri filtere ili izabrane izveštaje.");

  const filters = exportFilterSummary(settings).map(x => `<span>${escapeHtml(x)}</span>`).join("");
  const head = `<tr>${columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join("")}</tr>`;
  const body = rows.map((row) => `<tr>${columns.map(c => `<td>${escapeHtml(excelCellText(row[c.key]))}</td>`).join("")}</tr>`).join("");
  const summaryLines = getExportSummaryLines(settings.type, rows);
  const summaryHtml = summaryLines.length ? `<div class="export-preview-summary"><h4>Ukupno</h4>${summaryLines.map(([label, value]) => `<p><b>${escapeHtml(label)}:</b> ${escapeHtml(value)}</p>`).join("")}</div>` : "";
  const className = template === "summary" ? "export-preview-paper summary-template" : "export-preview-paper classic-template";
  return `<div class="${className}">
    <div class="export-preview-head">
      <div>
        <small>ASKCREATE.APP</small>
        <h2>${escapeHtml(preset.title)}</h2>
        <p>Firma: ${escapeHtml(currentCompanyExportName())}</p>
      </div>
      <div class="export-preview-stamp">
        <b>${escapeHtml(exportTemplateLabel(template))}</b>
        <span>${escapeHtml(today())}</span>
      </div>
    </div>
    <div class="export-preview-filters">${filters}</div>
    ${template === "summary" ? summaryHtml : ""}
    <div class="export-preview-table-wrap">
      <table class="export-preview-table">
        <thead>${head}</thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    ${template === "classic" ? summaryHtml : ""}
    <div class="export-preview-signatures">
      <span>Pripremio: ____________________</span>
      <span>Kontrolisao: ____________________</span>
    </div>
  </div>`;
}

window.renderExportPreview = () => {
  try {
    const settings = setSmartExportSettings({
      type: $("#smartExportType")?.value || "all",
      from: $("#smartExportFrom")?.value || "",
      to: $("#smartExportTo")?.value || "",
      site: $("#smartExportSite")?.value || "",
      worker: $("#smartExportWorker")?.value || "",
      item: $("#smartExportItem")?.value || ""
    });
    const preset = SMART_EXPORT_PRESETS[settings.type] || SMART_EXPORT_PRESETS.all;
    const reports = directorReportsCache
      .filter(r => !isDefectOnlyReport(r) && !isFuelDashboardOnlyReport(r) && hasDailyReportData(r))
      .filter(r => smartExportReportMatches(r, settings))
      .filter(r => getSmartRowsForReport(r, settings).length > 0);
    setExportSelectedIds(reports.map(r => r.id));
    setExportColumnKeys(preset.keys);
    setExportTemplateType($("#exportTemplateType")?.value || "classic");
    const box = $("#exportPreviewBox");
    if (!box) return;
    renderExportPanel();
    box.innerHTML = buildExportPreviewHtml();
    box.classList.remove("hidden");
    const actions = $("#exportPreviewActions");
    if (actions) actions.classList.remove("hidden");
    const info = $("#smartExportInfo");
    if (info) info.textContent = `${preset.title}: prikazan je pregled. Ako želiš manje kolona, skini štikle u delu “Kolone u tabeli”.`;
    toast("Tabela je prikazana. Možeš štampati, preuzeti Excel ili skinuti višak kolona.");
  } catch(e) {
    const info = $("#smartExportInfo");
    if (info) info.textContent = e.message;
    showExportPreviewMessage(e.message + " Proveri datum, gradilište ili izaberi drugu grupu.", true);
    toast(e.message, true);
  }
};
window.applySmartExportAndPreview = () => {
  applySmartExportFilters();
  setTimeout(() => renderExportPreview(), 0);
};

window.printExportPreview = () => {
  try {
    if (!$("#exportPreviewBox")?.innerHTML.trim()) renderExportPreview();
    document.body.classList.add("printing-export-preview");
    setTimeout(() => window.print(), 50);
    setTimeout(() => document.body.classList.remove("printing-export-preview"), 700);
  } catch(e) {
    toast(e.message, true);
  }
};

function buildCsvContent(delimiter = ";") {
  const { columns, rows } = getExportRowsAndColumns();
  if (!columns.length) throw new Error("Štikliraj bar jednu rubriku za Excel export.");
  if (!rows.length) throw new Error("Nema izabranih izveštaja za export.");
  const header = columns.map(c => csvEscape(c.label)).join(delimiter);
  const body = rows.map(row => columns.map(c => csvEscape(excelCellText(row[c.key]))).join(delimiter));
  return [header, ...body].join("\r\n");
}

function buildExcelHtmlTable() {
  const { columns, rows } = getExportRowsAndColumns();
  if (!columns.length) throw new Error("Štikliraj bar jednu rubriku za Excel export.");
  if (!rows.length) throw new Error("Nema izabranih izveštaja za export.");

  const cleanColumns = columns.filter(c => rows.some(row => excelNonEmpty(row[c.key])) || ["date", "worker", "function", "site", "status"].includes(c.key));
  const head = `<tr>${cleanColumns.map(c => `<th>${escapeHtml(c.label)}</th>`).join("")}</tr>`;
  const body = rows.map((row, index) => `<tr class="${index % 2 ? "even" : "odd"}">${cleanColumns.map(c => `<td>${escapeHtml(excelDisplayValue(c.key, row[c.key]))}</td>`).join("")}</tr>`).join("");
  const summary = `<p class="doc-subtitle">Izabrano redova: ${rows.length}. Status je prikazan ljudski, a prazne kolone su automatski sklonjene.</p>`;

  return cleanExcelShell("DNEVNI RADNI IZVEŠTAJI SA TERENA", `${summary}<table>${head}${body}</table>`, `Firma: ${currentCompanyExportName()} · Datum izvoza: ${formatDateOnlyLocal(today())}`);
}

async function exportCsv() {
  try {
    const csv = buildCsvContent(";");
    const blob = new Blob(["﻿" + csv], {type:"text/csv;charset=utf-8"});
    downloadBlob(blob, `dnevni-izvestaji-${today()}.csv`);
    toast("CSV fajl je preuzet. Za tvoj Excel koristi se tačka-zarez da kolone budu lepo razdvojene.");
  } catch(e) {
    toast(e.message, true);
  }
}

async function exportExcelFile() {
  try {
    const html = buildExcelHtmlTable();
    const blob = new Blob(["﻿" + html], {type:"application/vnd.ms-excel;charset=utf-8"});
    downloadBlob(blob, `dnevni-izvestaji-${today()}.xls`);
    toast("Čist Excel fajl je preuzet — kolone su sređene i prazne kolone su sklonjene.");
  } catch(e) {
    toast(e.message, true);
  }
}

async function copyExportTableForExcel() {
  try {
    const { columns, rows } = getExportRowsAndColumns();
    if (!columns.length) throw new Error("Štikliraj bar jednu rubriku za kopiranje.");
    if (!rows.length) throw new Error("Nema izabranih izveštaja za kopiranje.");
    const text = [
      columns.map(c => c.label).join("\t"),
      ...rows.map(row => columns.map(c => excelCellText(row[c.key])).join("\t"))
    ].join("\n");
    await navigator.clipboard.writeText(text);
    toast("Tabela je kopirana. Otvori Excel i pritisni Ctrl + V.");
  } catch(e) {
    toast(e.message, true);
  }
}


async function sendDefectNow() {
  if (defectSubmitBusy) return;
  const btn = document.getElementById("sendDefectNowBtn");
  defectSubmitBusy = true;
  if (btn) { btn.disabled = true; btn.dataset.originalText = btn.textContent; btn.textContent = "Slanje kvara..."; }
  try {
    if (!navigator.onLine) {
      saveDraft();
      throw new Error("Nema interneta. Kvar nije poslat, nacrt je sačuvan na ovom uređaju.");
    }

    const worker = currentWorker || JSON.parse(localStorage.getItem("swp_worker") || "null");
    if (!worker) throw new Error("Zaposleni nije prijavljen.");

    const defectText = $("#wrDefect")?.value.trim() || "";
    const defectAsset = getDefectAssetPayload();
    const defectAssetName = defectAsset.defect_asset_name || defectAsset.defect_manual_asset_name || "";
    const defectImpact = getDefectImpactPayload();
    const selectedDefectSite = getSelectedDefectSite ? getSelectedDefectSite() : (getSelectedWorkerSite ? getSelectedWorkerSite() : {});
    const fallbackMainSite = getSelectedWorkerSite ? getSelectedWorkerSite() : {};
    const defectSiteName = selectedDefectSite.site_name || fallbackMainSite.site_name || "";

    if (!defectText && !defectAssetName) {
      throw new Error("Upiši sredstvo u kvaru ili opis kvara.");
    }

    const machines = getMachineEntries ? getMachineEntries() : [];
    const firstMachine = defectAssetName || machines[0]?.name || "";
    const defectNow = new Date().toISOString();
    const defectReporterName = worker.full_name || "Radnik";
    const defectReporterRole = worker.function_title || "Radnik";

    const urgentData = {
      report_type: "defect_alert",
      sent_immediately: true,
      defect_channel: "immediate_button",
      visible_to_director: true,
      visible_to_mechanic_boss: true,
      sent_to: "direkcija_i_sef_mehanizacije",
      defect_status: "prijavljen",
      defect_reported_at: defectNow,
      site_id: selectedDefectSite.site_id || fallbackMainSite.site_id || null,
      site_name: defectSiteName || fallbackMainSite.site_name || "",
      defect_site_name: defectSiteName || fallbackMainSite.site_name || "",
      defect_site_manual_location: selectedDefectSite.manual_location || "",
      defect_site_selected_name: selectedDefectSite.selected_site_name || "",
      machine: firstMachine,
      ...defectAsset,
      defect_machine: defectAssetName,
      defect_site_name: defectSiteName,
      machines,
      defect_exists: "da",
      defect: defectText,
      ...defectImpact,
      defect_urgency: $("#wrDefectUrgency")?.value || "",
      created_by_worker: worker.full_name,
      employee_number: getPersonEmployeeNumber(worker),
      worker_number: getPersonEmployeeNumber(worker),
      created_by_employee_number: getPersonEmployeeNumber(worker),
      function_title: worker.function_title,
      called_mechanic_by_phone: $("#wrDefectCalledMechanic")?.value || "",
      defect_images: defectImagesPayload(),
      defectImages: defectImagesPayload(),
      defect_photos: defectImagesPayload(),
      defect_images_count: defectImagesPayload().length,
      defect_timeline: [{
        id: makeDefectImageId().replace("defimg_", "defevt_"),
        status: "prijavljen",
        label: "Kvar prijavljen",
        actor_name: defectReporterName,
        actor_role: defectReporterRole,
        note: defectText,
        at: defectNow
      }]
    };
    urgentData.defect_history = urgentData.defect_timeline;

    const returnedId = localStorage.getItem("swp_returned_report_id");
    let wasCorrection = false;
    if (returnedId) {
      const returnedStillExists = await getReturnedReportForWorker(returnedId).catch(() => null);
      if (returnedStillExists) {
        const oldType = returnedStillExists?.data?.report_type || returnedStillExists?.data?.reportType || "";
        if (oldType) urgentData.report_type = oldType;
        mergeCorrectionHistoryForResubmit(urgentData, returnedStillExists);
        const { error } = await sb.rpc("worker_resubmit_returned_report", {
          p_company_code: worker.company_code,
          p_access_code: worker.access_code,
          p_report_id: returnedId,
          p_report_date: $("#wrDate").value || today(),
          p_site_id: selectedDefectSite.site_id || fallbackMainSite.site_id || null,
          p_data: urgentData
        });
        if (error) throw error;
        wasCorrection = true;
      } else {
        clearReturnedReportContext();
      }
    }

    if (!wasCorrection) {
      const { error } = await sb.rpc("submit_worker_report", {
        p_company_code: worker.company_code,
        p_access_code: worker.access_code,
        p_report_date: $("#wrDate").value || today(),
        p_site_id: selectedDefectSite.site_id || fallbackMainSite.site_id || null,
        p_data: urgentData
      });
      if (error) throw error;
    }

    await sendMechanicPushAfterDefect(worker, urgentData);
    clearReturnedReportContext();
    clearDefectImagesDraft();
    try { await prepareWorkerFormForNextReport(); } catch {}
    loadWorkerReturnedReports();
    toast(wasCorrection ? "Ispravljen kvar je ponovo poslat Upravi ✅" : "Kvar je poslat odmah 🚨 Vide ga Uprava/Direkcija i Šef mehanizacije.");
  } catch(e) {
    toast(e.message, true);
  } finally {
    defectSubmitBusy = false;
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.originalText || "🚨 Evidentiraj kvar odmah"; }
  }
}


async function loginWorkerByCode() {
  try {
    if (!initSupabase()) return;

    const companyInput = $("#workerCompanyCode");
    const codeInput = $("#workerAccessCode");

    if (!companyInput) throw new Error("Nedostaje polje Šifra firme.");
    if (!codeInput) throw new Error("Nedostaje polje Pristupni kod zaposlenog.");

    const companyCode = normalizeLoginCode(companyInput.value);
    const accessCode = normalizeLoginCode(codeInput.value);

    if (!companyCode) throw new Error("Unesi šifru firme.");
    if (!accessCode) throw new Error("Unesi šifru zaposlenog.");

    // Zaposleni se ne loguje emailom. Login mora proći samo preko para:
    // šifra firme + šifra zaposlenog. Ovo ide kroz Supabase RPC worker_login.
    const { data, error } = await sb.rpc("worker_login", {
      p_company_code: companyCode,
      p_access_code: accessCode
    });

    if (error) {
      throw new Error("Worker login SQL nije aktivan ili je star. Pokreni SQL ispravku iz ZIP-a, pa probaj opet. Detalj: " + error.message);
    }

    const expectedPersonId = getWorkerPersonIdFromUrl();
    const row = selectWorkerLoginRow(data, companyCode, accessCode, expectedPersonId);
    if (!row || !row.user_id || !row.company_id) {
      throw new Error("Neispravna šifra firme ili šifra zaposlenog. Link ne odgovara ovoj osobi ili je SQL vratio pogrešan nalog. Proveri da je zaposleni AKTIVAN i da koristi svoj lični link/kod.");
    }
    if (expectedPersonId) {
      const returnedIds = [row.user_id, row.id, row.person_id, row.worker_id, row.company_user_id].map(v => String(v || "").trim()).filter(Boolean);
      if (!returnedIds.includes(expectedPersonId)) {
        throw new Error("Zaštita login-a: ovaj link pripada drugoj osobi. Aplikacija neće otvoriti pogrešan panel.");
      }
    }

    currentWorker = {
      ...row,
      company_code: row.company_code || companyCode,
      access_code: row.access_code || accessCode
    };

    localStorage.setItem("swp_worker", JSON.stringify(currentWorker));
    localStorage.setItem("swp_worker_company_code", currentWorker.company_code || companyCode);
    const keepMechanic = !!$("#workerKeepLogin")?.checked && isMechanicBossWorker(currentWorker);
    if (keepMechanic) localStorage.setItem("swp_mechanic_keep_login", "1");
    else localStorage.removeItem("swp_mechanic_keep_login");
    openWorkerForm();
    toast(isMechanicBossWorker(currentWorker) ? "Šef mehanizacije je prijavljen." : "Zaposleni je prijavljen.");
  } catch(e) {
    toast(e.message, true);
  }
}


function installNavigationFallback() {
  if (window.__swpNavFallbackInstalled) return;
  window.__swpNavFallbackInstalled = true;
  document.addEventListener("click", (e) => {
    const btn = e.target.closest && e.target.closest("[data-goto]");
    if (!btn) return;
    e.preventDefault();
    show(btn.dataset.goto);
  });
}


// === AskCreate v10.1: Kontrola tokova za stabilizaciono testiranje ===
function safeArrayCount(fn) {
  try {
    const value = typeof fn === "function" ? fn() : fn;
    return Array.isArray(value) ? value.length : 0;
  } catch (e) {
    return 0;
  }
}

function testStatusBadge(ok, labelOk = "spremno", labelBad = "proveriti") {
  return `<span class="test-status ${ok ? "ok" : "warn"}">${ok ? "✅" : "⚠️"} ${escapeHtml(ok ? labelOk : labelBad)}</span>`;
}

function buildFlowTestData() {
  const reports = Array.isArray(directorReportsCache) ? directorReportsCache : [];
  const peopleCount = safeArrayCount(() => activeDirectorPeople());
  const sitesCount = safeArrayCount(() => activeDirectorSites());
  const assetsCount = safeArrayCount(() => activeDirectorAssets());
  const materialsCount = safeArrayCount(() => activeDirectorMaterials ? activeDirectorMaterials() : (directorMaterialsCache || []));
  const reportTypes = new Set(reports.map(r => String((r.data || {}).report_type || r.report_type || "").trim()).filter(Boolean));
  const multiSiteReports = reports.filter(r => {
    const d = r.data || {};
    return (Array.isArray(d.work_items) && d.work_items.length > 1)
      || (Array.isArray(d.vehicle_items) && d.vehicle_items.length > 1)
      || (Array.isArray(d.machine_items) && d.machine_items.length > 1)
      || (Array.isArray(d.vehicles) && d.vehicles.filter(x => x.site_name || x.site_id).length > 1)
      || (Array.isArray(d.machines) && d.machines.filter(x => x.site_name || x.site_id).length > 1);
  }).length;
  const fuelReports = reports.filter(r => {
    const d = r.data || {};
    return String(d.report_type || r.report_type || "").includes("fuel") || Array.isArray(d.fuel_entries) && d.fuel_entries.length || Array.isArray(d.field_tanker_entries) && d.field_tanker_entries.length;
  }).length;
  const waterReports = reports.filter(r => {
    const d = r.data || {};
    return String(d.report_type || r.report_type || "").includes("water") || officeWaterEntries(d).length;
  }).length;
  const lowloaderReports = reports.filter(r => {
    const d = r.data || {};
    return String(d.report_type || r.report_type || "").includes("lowloader") || officeLowloaderEntries(d).length;
  }).length;
  const defectReports = reports.filter(r => {
    const d = r.data || {};
    return String(d.report_type || r.report_type || "").includes("defect") || Array.isArray(d.defects) && d.defects.length;
  }).length;
  return { reports, peopleCount, sitesCount, assetsCount, materialsCount, reportTypes, multiSiteReports, fuelReports, waterReports, lowloaderReports, defectReports };
}


function renderFlowTestPanel() {
  const box = document.getElementById("flowTestPreview");
  if (!box) return;
  const d = buildFlowTestData();
  const rows = [
    ["Radnici / korisnici", d.peopleCount, "Direkcija treba da ima bar vozača, bageristu, šefa gradilišta, šefa mehanizacije i gazdu.", d.peopleCount >= 5],
    ["Gradilišta", d.sitesCount, "Potrebna su bar 2–3 gradilišta za proveru multi-gradilište izveštaja.", d.sitesCount >= 2],
    ["Mašine / vozila", d.assetsCount, "Potrebno je bar jedno vozilo i jedna mašina, sa normom goriva ako testiraš potrošnju.", d.assetsCount >= 2],
    ["Materijali", d.materialsCount, "Potrebno je bar jedan materijal za ture i pregled materijala po gradilištu.", d.materialsCount >= 1],
    ["Poslati izveštaji", d.reports.length, "Za Dnevnik, Karnet, Gazdu i šefove trebaju poslati test izveštaji.", d.reports.length >= 1],
    ["Različiti tipovi unosa", d.reportTypes.size, "Cilj je da tipovi ostanu odvojeni: ture, mašina, gorivo, kvar, odsustvo.", d.reportTypes.size >= 2],
    ["Multi-gradilište izveštaji", d.multiSiteReports, "Vozač/bagerista treba da pošalje jedan izveštaj sa više stavki/gradilišta.", d.multiSiteReports >= 1],
    ["Gorivo", d.fuelReports, "Treba bar jedan unos goriva za proveru potrošnje i izvora goriva.", d.fuelReports >= 1],
    ["Cisterna za vodu", d.waterReports || 0, "Treba bar jedan unos vode za proveru litara i Dnevnika/Karneta.", (d.waterReports || 0) >= 1],
    ["Labudica", d.lowloaderReports || 0, "Treba bar jedan transport mašine za proveru Karneta i Excel izvoza.", (d.lowloaderReports || 0) >= 1],
    ["Kvarovi", d.defectReports, "Treba bar jedan kvar za proveru Šefa mehanizacije i Dnevnika.", d.defectReports >= 1]
  ];
  const htmlRows = rows.map(r => `<tr><td><b>${escapeHtml(r[0])}</b></td><td>${escapeHtml(String(r[1]))}</td><td>${escapeHtml(r[2])}</td><td>${testStatusBadge(r[3])}</td></tr>`).join("");
  const steps = [
    "1. Direkcija: dodaj/izaberi vozača i primeni preporučene funkcije.",
    "2. Vozač: izaberi 'Vožnja / ture / materijal' i unesi 3 stavke za 3 gradilišta, pa pošalji jedan dnevni izveštaj.",
    "3. Direkcija: proveri da je stigao jedan izveštaj, a unutra više gradilišta.",
    "4. Bagerista: izaberi 'Rad mašine / MTČ' i unesi 2 stavke za 2 gradilišta, pa pošalji jedan dnevni izveštaj.",
    "5. Radnik: probaj 'Slobodan dan / godišnji' i proveri da se ne pojavljuje kao gradilište.",
    "6. Radnik/vozač/bagerista: pošalji gorivo i kvar kroz posebne rubrike.",
    "7. Vozač: pošalji 'Cisterna za vodu' i proveri litre vode u Dnevniku/Karnetu.",
    "8. Vozač labudice: pošalji transport mašine labudicom i proveri Karnet/Excel.",
    "9. Direkcija: otvori Dnevnik rada za svako gradilište i proveri da uzima samo svoje stavke.",
    "10. Direkcija: otvori Karnet i proveri radnike, mašine, vozila, MTČ, KM, ture, materijal i m³.",
    "11. Šef gradilišta: proveri da vidi pregled svog datuma/gradilišta.",
    "12. Šef mehanizacije: proveri kvarove, potrošnju i sredstva bez norme.",
    "13. Vlasnik/Direktor: proveri zbir firme po danu/mesecu i po gradilištu."
  ];
  box.innerHTML = `
    <div class="test-flow-head">
      <div><b>Kontrolna lista verzije ${escapeHtml(APP_VERSION)}</b><span>${escapeHtml(formatRefreshTime())}</span></div>
      <small>Ovaj ekran ne odobrava i ne menja izveštaje — samo pomaže da test ide redom.</small>
    </div>
    <div class="office-table-wrap"><table class="office-table"><thead><tr><th>Oblast</th><th>Broj</th><th>Šta proveriti</th><th>Status</th></tr></thead><tbody>${htmlRows}</tbody></table></div>
    <section class="test-step-list"><h4>Redosled ručnog testa</h4>${steps.map(step => `<label><input type="checkbox" /> <span>${escapeHtml(step)}</span></label>`).join("")}</section>
    <div class="site-boss-warning"><b>Pravilo stabilizacije:</b> ako ovde nešto ne prođe, ne dodavati novi modul. Prvo ispraviti taj tok, pa tek onda nastaviti dalje.</div>
  `;
}

function flowTestPlainText() {
  const steps = Array.from(document.querySelectorAll("#flowTestPreview .test-step-list span")).map(x => x.textContent.trim()).filter(Boolean);
  return [
    `AskCreate kontrolna lista v${APP_VERSION}`,
    "",
    ...steps,
    "",
    "Napomena: prvo popraviti tok koji ne prođe, ne dodavati novi modul preko greške."
  ].join("\n");
}

async function copyFlowTestChecklist() {
  if (!document.getElementById("flowTestPreview")?.innerHTML) renderFlowTestPanel();
  const text = flowTestPlainText();
  try {
    await navigator.clipboard.writeText(text);
    toast("Lista za test je kopirana.");
  } catch (e) {
    toast("Kopiranje nije uspelo. Možeš ručno označiti stavke na ekranu.", true);
  }
}

function bindEvents() {
  preventNumberInputScrollChanges(document);

  ["workerCompanyCode","workerAccessCode"].forEach(id => {
    const el = $("#" + id);
    if (el) el.addEventListener("keydown", e => {
      if (e.key === "Enter") loginWorkerByCode();
    });
  });

  $$("[data-goto]").forEach(btn => btn.addEventListener("click", () => show(btn.dataset.goto)));
  if ($("#logoutBtn")) $("#logoutBtn").addEventListener("click", signOut);
  if ($("#internalLogoutBtn")) $("#internalLogoutBtn").addEventListener("click", signOut);

  $("#adminSignupBtn").addEventListener("click", async () => {
    try {
      await signUp($("#adminEmail").value.trim(), $("#adminPassword").value);
      toast("Admin nalog registrovan. Ako stigne email potvrda, potvrdi ga pa se prijavi.");
    } catch(e) { toast(e.message, true); }
  });
  $("#adminLoginBtn").addEventListener("click", async () => {
    try {
      await signIn($("#adminEmail").value.trim(), $("#adminPassword").value);
      await loadAdmin();
    } catch(e) { toast(e.message, true); }
  });
  $("#refreshAdminBtn").addEventListener("click", loadAdmin);
  if ($("#adminHomeVisualFile")) $("#adminHomeVisualFile").addEventListener("change", handleAdminHomeVisualFileChange);
  if ($("#saveAdminHomeVisualBtn")) $("#saveAdminHomeVisualBtn").addEventListener("click", saveAdminHomeVisualSettings);
  if ($("#removeAdminHomeVisualBtn")) $("#removeAdminHomeVisualBtn").addEventListener("click", removeAdminHomeVisualSettings);
  if ($("#adminCompanySearch")) {
    $("#adminCompanySearch").addEventListener("input", e => renderAdminCompanies(e.target.value));
    $("#adminCompanySearch").addEventListener("keydown", e => { if (e.key === "Enter") renderAdminCompanies(e.target.value); });
  }
  if ($("#adminCompanySearchBtn")) $("#adminCompanySearchBtn").addEventListener("click", () => renderAdminCompanies($("#adminCompanySearch")?.value || ""));
  if ($("#adminCompanyClearSearchBtn")) $("#adminCompanyClearSearchBtn").addEventListener("click", () => { if ($("#adminCompanySearch")) $("#adminCompanySearch").value = ""; renderAdminCompanies(""); });
  if ($("#acCompanyCode")) {
    $("#acCompanyCode").addEventListener("input", scheduleAdminCompanyCodeAvailabilityCheck);
    $("#acCompanyCode").addEventListener("blur", () => checkAdminCompanyCodeAvailability(true).catch(() => {}));
  }
  $("#addApprovedCompanyBtn").addEventListener("click", async () => {
    if (adminCompanySaveBusy) {
      toast("Čuvanje firme je već u toku. Sačekaj završetak.", true);
      return;
    }
    const adminSaveBtn = $("#addApprovedCompanyBtn");
    adminCompanySaveBusy = true;
    if (adminSaveBtn) { adminSaveBtn.disabled = true; adminSaveBtn.dataset.oldText = adminSaveBtn.textContent || ""; adminSaveBtn.textContent = "Čuvam..."; }
    try {
      const paidUntil = $("#acPaidUntil")?.value || null;
      const companyCode = normalizeLoginCode($("#acCompanyCode").value);
      const payload = {
        company_name: $("#acCompanyName").value.trim(),
        approved_email: $("#acEmail").value.trim(),
        company_code: companyCode,
        invite_code: $("#acInviteCode").value.trim(),
        contact_name: $("#acContactName")?.value.trim() || null,
        contact_phone: $("#acContactPhone")?.value.trim() || null,
        status: "trial",
        plan: $("#acPlan")?.value || "trial",
        paid_from: $("#acPaidFrom")?.value || null,
        paid_until: paidUntil,
        trial_until: paidUntil,
        brand_color: $("#acBrandColor")?.value || "green",
        note: $("#acNote").value.trim()
      };
      if (!payload.company_name || !payload.approved_email || !payload.company_code || !payload.invite_code) throw new Error("Popuni naziv, email, šifru firme i aktivacioni kod.");
      const codeFree = await checkAdminCompanyCodeAvailability(false);
      if (!codeFree) {
        const codeInput = $("#acCompanyCode");
        if (codeInput) codeInput.scrollIntoView({ behavior: "smooth", block: "center" });
        throw new Error("Šifra firme nije slobodna. Unesi jedinstvenu šifru da se firme ne mogu mešati.");
      }
      const { error } = await sb.from("approved_companies").insert(payload);
      if (error) {
        const msg = String(error.message || "").toLowerCase();
        if (msg.includes("duplicate") || msg.includes("unique")) {
          setAdminCompanyCodeStatus("Crveno: ova šifra firme već postoji u bazi. Unesi drugi kod.", "bad");
          throw new Error("Ova šifra firme već postoji. Firma ne može biti sačuvana sa duplim kodom.");
        }
        if (msg.includes("column")) {
          throw new Error("Bazi fale nove kolone za Admin CRM. Prvo pokreni SQL koji sam ti dao u poruci, pa ponovo sačuvaj firmu.");
        }
        throw error;
      }
      ["acCompanyName","acEmail","acContactName","acContactPhone","acCompanyCode","acInviteCode","acPaidFrom","acPaidUntil","acNote"].forEach(id => { const el = $("#"+id); if (el) el.value = ""; });
      if ($("#acPlan")) $("#acPlan").value = "trial";
      if ($("#acBrandColor")) $("#acBrandColor").value = "green";
      setAdminCompanyCodeStatus("Šifra firme mora biti jedinstvena. Crveno znači zauzeto, zeleno znači slobodno.", "info");
      toast("Firma je sačuvana u Admin CRM.");
      loadApprovedCompanies();
    } catch(e) {
      toast(e.message, true);
    } finally {
      adminCompanySaveBusy = false;
      if (adminSaveBtn) { adminSaveBtn.disabled = false; adminSaveBtn.textContent = adminSaveBtn.dataset.oldText || "Sačuvaj firmu"; delete adminSaveBtn.dataset.oldText; }
    }
  });

  $("#directorSignupBtn").addEventListener("click", async () => {
    try {
      await signUp($("#directorEmail").value.trim(), $("#directorPassword").value);
      toast("Uprava email registrovan. Ako stigne potvrda, potvrdi email pa se prijavi.");
    } catch(e) { toast(e.message, true); }
  });
  $("#directorLoginBtn").addEventListener("click", async () => {
    try {
      await signIn($("#directorEmail").value.trim(), $("#directorPassword").value);
      await loadDirectorCompany();
    } catch(e) { toast(e.message, true); }
  });
  $("#activateCompanyBtn").addEventListener("click", async () => {
    try {
      if (!sb) initSupabase();
      const { data: userData } = await sb.auth.getUser();
      if (!userData?.user) {
        await signIn($("#directorEmail").value.trim(), $("#directorPassword").value);
      }
      const { data, error } = await sb.rpc("activate_company", {
        p_company_code: $("#directorCompanyCode").value.trim(),
        p_invite_code: $("#directorInviteCode").value.trim()
      });
      if (error) throw error;
      toast("Firma je aktivirana.");
      await loadDirectorCompany();
    } catch(e) { toast(e.message, true); }
  });
  if ($("#refreshDirectorBtn")) $("#refreshDirectorBtn").addEventListener("click", loadDirectorCompany);
  if ($("#directorManualRefreshBtn")) $("#directorManualRefreshBtn").addEventListener("click", manualDirectorRefresh);
  if ($("#refreshArchiveBtn")) $("#refreshArchiveBtn").addEventListener("click", manualDirectorRefresh);
  if ($("#refreshFuelReportsBtn")) $("#refreshFuelReportsBtn").addEventListener("click", manualDirectorRefresh);
  if ($("#refreshFuelAnalysisBtn")) $("#refreshFuelAnalysisBtn").addEventListener("click", () => renderFuelConsumptionAnalysis());
  if ($("#fuelAnalysisFrom")) $("#fuelAnalysisFrom").addEventListener("change", () => renderFuelConsumptionAnalysis());
  if ($("#fuelAnalysisTo")) $("#fuelAnalysisTo").addEventListener("change", () => renderFuelConsumptionAnalysis());
  if ($("#refreshMaterialOverviewBtn")) $("#refreshMaterialOverviewBtn").addEventListener("click", () => renderMaterialOverview());
  if ($("#renderMaterialOverviewBtn")) $("#renderMaterialOverviewBtn").addEventListener("click", () => renderMaterialOverview());
  if ($("#downloadMaterialOverviewCsvBtn")) $("#downloadMaterialOverviewCsvBtn").addEventListener("click", downloadMaterialOverviewCsv);
  ["materialOverviewFrom", "materialOverviewTo", "materialOverviewSite"].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener("change", renderMaterialOverview); });
  if ($("#refreshOwnerDashboardBtn")) $("#refreshOwnerDashboardBtn").addEventListener("click", () => renderOwnerDashboard());
  if ($("#renderOwnerDashboardBtn")) $("#renderOwnerDashboardBtn").addEventListener("click", () => renderOwnerDashboard());
  if ($("#printOwnerDefectsReportBtn")) $("#printOwnerDefectsReportBtn").addEventListener("click", () => printOwnerDefectsReport("ownerDashboard"));
  ["ownerDashboardFrom", "ownerDashboardTo", "ownerDashboardSite"].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener("change", renderOwnerDashboard); });
  if ($("#refreshDailyLogBtn")) $("#refreshDailyLogBtn").addEventListener("click", manualDirectorRefresh);
  if ($("#refreshCarnetBtn")) $("#refreshCarnetBtn").addEventListener("click", manualDirectorRefresh);
  if ($("#renderDailyLogBtn")) $("#renderDailyLogBtn").addEventListener("click", renderDailyLogPreview);
  if ($("#renderCarnetBtn")) $("#renderCarnetBtn").addEventListener("click", renderCarnetPreview);
  if ($("#printDailyLogBtn")) $("#printDailyLogBtn").addEventListener("click", printDailyLogPreview);
  if ($("#printCarnetBtn")) $("#printCarnetBtn").addEventListener("click", printCarnetPreview);
  if ($("#downloadDailyLogCsvBtn")) $("#downloadDailyLogCsvBtn").addEventListener("click", downloadDailyLogCsv);
  if ($("#downloadCarnetCsvBtn")) $("#downloadCarnetCsvBtn").addEventListener("click", downloadCarnetCsv);
  if ($("#directorShowWorkerQrBtn")) $("#directorShowWorkerQrBtn").addEventListener("click", directorShowWorkerQr);
  if ($("#directorShowMechanicQrBtn")) $("#directorShowMechanicQrBtn").addEventListener("click", directorShowMechanicQr);
  if ($("#ownerPanelRefreshBtn")) $("#ownerPanelRefreshBtn").addEventListener("click", () => refreshOwnerDashboardPanel({ silent: false }));
  if ($("#ownerPanelRenderBtn")) $("#ownerPanelRenderBtn").addEventListener("click", () => renderOwnerDashboard("ownerPanelDashboard", "ownerPanelDashboardPreview"));
  if ($("#ownerPanelArchiveBtn")) $("#ownerPanelArchiveBtn").addEventListener("click", openOwnerPanelArchive);
  if ($("#ownerPanelArchiveRefreshBtn")) $("#ownerPanelArchiveRefreshBtn").addEventListener("click", openOwnerPanelArchive);
  if ($("#ownerPanelDefectsReportBtn")) $("#ownerPanelDefectsReportBtn").addEventListener("click", () => printOwnerDefectsReport("ownerPanelDashboard"));
  if ($("#ownerPanelLogoutBtn")) $("#ownerPanelLogoutBtn").addEventListener("click", logoutOwnerDashboardPanel);
  ["ownerPanelDashboardFrom", "ownerPanelDashboardTo", "ownerPanelDashboardSite"].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener("change", () => renderOwnerDashboard("ownerPanelDashboard", "ownerPanelDashboardPreview")); });

  if ($("#refreshFlowTestBtn")) $("#refreshFlowTestBtn").addEventListener("click", renderFlowTestPanel);
  if ($("#copyFlowTestBtn")) $("#copyFlowTestBtn").addEventListener("click", copyFlowTestChecklist);

  $$(".tab").forEach(btn => btn.addEventListener("click", () => {
    $$(".tab").forEach(b => b.classList.remove("active"));
    $$(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    $("#tab" + btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)).classList.add("active");
    if (btn.dataset.tab === "export") renderExportPanel();
    if (btn.dataset.tab === "defects") renderDefectsList();
    if (btn.dataset.tab === "fuel") { renderFuelReportsList(); renderFuelConsumptionAnalysis(); }
    if (btn.dataset.tab === "materials") renderMaterialOverview();
    if (btn.dataset.tab === "owner") renderOwnerDashboard();
    if (btn.dataset.tab === "archive") renderArchiveList();
    if (btn.dataset.tab === "dailyLog") renderDailyLogPreview();
    if (btn.dataset.tab === "carnet") renderCarnetPreview();
    if (btn.dataset.tab === "test") renderFlowTestPanel();
  }));

  $$('[data-business-tab]').forEach(btn => btn.addEventListener('click', () => {
    const target = btn.dataset.businessTab;
    const tab = document.querySelector(`.tab[data-tab="${target}"]`);
    if (tab) tab.click();
  }));
  $("#addPersonBtn").addEventListener("click", savePersonForm);
  if ($("#cancelEditPersonBtn")) $("#cancelEditPersonBtn").addEventListener("click", clearPersonForm);
  bindPersonPreviewEvents();

  $("#addSiteBtn").addEventListener("click", saveSiteForm);
  if ($("#cancelEditSiteBtn")) $("#cancelEditSiteBtn").addEventListener("click", clearSiteForm);
  if ($("#siteName")) $("#siteName").addEventListener("input", scheduleSiteNameAvailabilityCheck);

  $("#addAssetBtn").addEventListener("click", saveAssetForm);
  if ($("#assetType")) $("#assetType").addEventListener("change", () => {
    applyDefaultAssetFeaturesFromType({ onlyIfEmpty: true });
    const fuelUnit = $("#assetFuelUnit");
    if (fuelUnit && !(fuelUnit.dataset.userChanged === "1")) fuelUnit.value = defaultFuelUnitForAssetType($("#assetType").value);
  });
  if ($("#assetFuelUnit")) $("#assetFuelUnit").addEventListener("change", () => { $("#assetFuelUnit").dataset.userChanged = "1"; });
  if ($("#cancelEditAssetBtn")) $("#cancelEditAssetBtn").addEventListener("click", clearAssetForm);
  if ($("#assetCode")) $("#assetCode").addEventListener("input", scheduleAssetCodeAvailabilityCheck);
  if ($("#assetListFilter")) $("#assetListFilter").addEventListener("change", (e) => handleAssetListFilterChange(e.target.value));


  if ($("#directorSearchBtn")) $("#directorSearchBtn").addEventListener("click", () => runDirectorGlobalSearch(true));
  if ($("#directorClearSearchBtn")) $("#directorClearSearchBtn").addEventListener("click", () => {
    $("#directorGlobalSearch").value = "";
    $("#directorSearchResults").classList.add("hidden");
    $("#directorSearchResultsList").innerHTML = "";
  });
  if ($("#directorGlobalSearch")) $("#directorGlobalSearch").addEventListener("keydown", (e) => {
    if (e.key === "Enter") runDirectorGlobalSearch(true);
  });

  if ($("#addMaterialBtn")) $("#addMaterialBtn").addEventListener("click", saveMaterialForm);
  if ($("#cancelEditMaterialBtn")) $("#cancelEditMaterialBtn").addEventListener("click", clearMaterialForm);
  if ($("#materialName")) $("#materialName").addEventListener("input", scheduleMaterialNameAvailabilityCheck);

  if ($("#selectAllReportsBtn")) $("#selectAllReportsBtn").addEventListener("click", selectAllReportsForExport);
  if ($("#clearReportsBtn")) $("#clearReportsBtn").addEventListener("click", clearReportsForExport);
  if ($("#goExportBtn")) $("#goExportBtn").addEventListener("click", goToExportTab);
  if ($("#refreshDefectsBtn")) $("#refreshDefectsBtn").addEventListener("click", loadReports);
  if ($("#exportCsvBtn")) $("#exportCsvBtn").addEventListener("click", exportCsv);
  if ($("#exportXlsBtn")) $("#exportXlsBtn").addEventListener("click", exportExcelFile);
  if ($("#copyExcelBtn")) $("#copyExcelBtn").addEventListener("click", copyExportTableForExcel);
  if ($("#applySmartExportBtn")) $("#applySmartExportBtn").addEventListener("click", applySmartExportFilters);
  if ($("#previewExportBtn")) $("#previewExportBtn").addEventListener("click", applySmartExportAndPreview);
  if ($("#printExportBtn")) $("#printExportBtn").addEventListener("click", printExportPreview);
  if ($("#clearSmartExportBtn")) $("#clearSmartExportBtn").addEventListener("click", clearSmartExportFilters);
  if ($("#smartExportType")) $("#smartExportType").addEventListener("change", (e) => setSmartExportType(e.target.value));
  if ($("#exportTemplateType")) $("#exportTemplateType").addEventListener("change", (e) => setExportTemplateType(e.target.value));
  ["#smartExportFrom", "#smartExportTo", "#smartExportSite", "#smartExportWorker", "#smartExportItem"].forEach(sel => {
    const el = $(sel);
    if (el) el.addEventListener("keydown", (e) => { if (e.key === "Enter") applySmartExportFilters(); });
  });
  if ($("#simpleExportBtn")) $("#simpleExportBtn").addEventListener("click", applySimpleExportColumns);
  if ($("#detailedExportBtn")) $("#detailedExportBtn").addEventListener("click", applyDetailedExportColumns);
  if ($("#selectAllColumnsBtn")) $("#selectAllColumnsBtn").addEventListener("click", selectAllExportColumns);
  if ($("#clearColumnsBtn")) $("#clearColumnsBtn").addEventListener("click", clearExportColumns);
  if ($("#runLocalAppCheckBtn")) $("#runLocalAppCheckBtn").addEventListener("click", runLocalAppCheck);
  if ($("#runWorkerUiAuditBtn")) $("#runWorkerUiAuditBtn").addEventListener("click", runWorkerUiAudit);
  if ($("#copyWorkerUiAuditBtn")) $("#copyWorkerUiAuditBtn").addEventListener("click", copyWorkerUiAudit);

  // Add mašina / gorivo koriste onclick direktno u HTML-u zbog pouzdanosti na mobilnom/PWA cache-u.
  if ($("#sendDefectNowBtn")) $("#sendDefectNowBtn").addEventListener("click", sendDefectNow);
  if ($("#wrDefectImages")) $("#wrDefectImages").addEventListener("change", handleDefectImagesInput);
  renderDefectImagesPreview();
  updateReturnedCorrectionUi();
  if ($("#memorizeFieldTankerBtn")) $("#memorizeFieldTankerBtn").addEventListener("click", memorizeCurrentFieldTankerEntries);
  if ($("#sendStoredFieldTankerBtn")) $("#sendStoredFieldTankerBtn").addEventListener("click", sendStoredFieldTankerEntries);
  if ($("#clearStoredFieldTankerBtn")) $("#clearStoredFieldTankerBtn").addEventListener("click", clearStoredFieldTankerEntries);
  initGlobalFieldTankerCisternBox();

  if ($("#workerLoginBtn")) $("#workerLoginBtn").addEventListener("click", loginWorkerByCode);
  if ($("#workerInstallBtn")) $("#workerInstallBtn").addEventListener("click", installWorkerApp);
  if ($("#homeInstallBtn")) $("#homeInstallBtn").addEventListener("click", installWorkerApp);
  if ($("#refreshMechanicDefectsBtn")) $("#refreshMechanicDefectsBtn").addEventListener("click", async () => { await loadMechanicBossDefects({ silent: false }); await loadMechanicBossOperations({ silent: true }); });
  if ($("#refreshMechanicOpsBtn")) $("#refreshMechanicOpsBtn").addEventListener("click", () => loadMechanicBossOperations({ silent: false }));
  if ($("#mechanicFuelFrom")) $("#mechanicFuelFrom").addEventListener("change", renderMechanicFuelAnalysis);
  if ($("#mechanicFuelTo")) $("#mechanicFuelTo").addEventListener("change", renderMechanicFuelAnalysis);
  if ($("#enableMechanicPushBtn")) $("#enableMechanicPushBtn").addEventListener("click", enableMechanicPushNotifications);
  if ($("#mechanicLogoutBtn")) $("#mechanicLogoutBtn").addEventListener("click", logoutMechanicBoss);

  $("#workerLogoutBtn").addEventListener("click", () => {
    stopMechanicBossWatcher();
    localStorage.removeItem("swp_worker");
    localStorage.removeItem("swp_draft");
    localStorage.removeItem("swp_mechanic_keep_login");
    currentWorker = null;
    const workerLogout = $("#workerLogoutBtn");
    if (workerLogout) {
      workerLogout.classList.add("hidden");
      workerLogout.setAttribute("aria-hidden", "true");
    }
    clearCompanyBrandFromBody();
    setInternalHeader("", "", false);
    show("WorkerLogin");
  });

  $("#saveDraftBtn").addEventListener("click", saveDraft);
  if ($("#wrLeaveType")) $("#wrLeaveType").addEventListener("change", updateLeaveRequestVisibility);
  if ($("#wrModuleSelect")) $("#wrModuleSelect").addEventListener("change", () => applyWorkerModuleSelection({ addDefaults: true }));
  initSignaturePad();
  if ($("#clearSignatureBtn")) $("#clearSignatureBtn").addEventListener("click", () => clearSignatureCanvas(true));
  if ($("#wrDefectAssetName")) {
    $("#wrDefectAssetName").addEventListener("input", updateDefectAssetSmartResult);
    $("#wrDefectAssetName").addEventListener("change", updateDefectAssetSmartResult);
  }

  $("#submitReportBtn").addEventListener("click", async () => {
    if (workerReportSubmitBusy) {
      toast("Slanje izveštaja je već u toku. Ne pritiskaj dugme više puta.", true);
      return;
    }
    const submitBtn = $("#submitReportBtn");
    workerReportSubmitBusy = true;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.dataset.oldText = submitBtn.textContent || ""; submitBtn.textContent = "Šaljem..."; }
    try {
      if (!navigator.onLine) {
        saveDraft();
        throw new Error("Nema interneta. Nacrt je sačuvan na ovom telefonu.");
      }
      const worker = currentWorker || JSON.parse(localStorage.getItem("swp_worker") || "null");
      if (!worker) throw new Error("Zaposleni nije prijavljen.");
      if (!ensureWorkerModuleSelected()) {
        const chooser = $("#workerModuleChooser") || $("#wrModuleSelect");
        if (chooser?.scrollIntoView) chooser.scrollIntoView({ behavior: "smooth", block: "center" });
        throw new Error("Prvo izaberi šta sada šalješ. Dnevni izveštaj, gorivo i kvarovi se ne mešaju.");
      }
      const data = collectWorkerData();
      const validationIssue = validateWorkerReportBeforeSubmit(data);
      if (validationIssue) {
        focusWorkerValidationIssue(validationIssue);
        throw new Error(validationIssue.message);
      }
      const mainSiteSection = $("#secWorkerSite");
      if (mainSiteSection?.classList.contains("active") && !data.site_name) {
        throw new Error("Odaberi gradilište iz liste. Gradilište prvo dodaje Uprava.");
      }
      if (await submitReturnedCorrectionIfNeeded(data)) {
        clearCurrentFieldTankerCistern();
        return;
      }
      const reportDate = $("#wrDate").value || today();
      const { error } = await sb.rpc("submit_worker_report", {
        p_company_code: worker.company_code,
        p_access_code: worker.access_code,
        p_report_date: reportDate,
        p_site_id: data.site_id || null,
        p_data: data
      });
      if (error) throw error;
      rememberVehicleEndKilometersAfterSubmit(data.vehicles || []);
      await verifyRecentlySubmittedReport(worker, reportDate);
      clearCurrentFieldTankerCistern();
      try {
        await prepareWorkerFormForNextReport();
        const sentType = data.report_type === "fuel_entry" ? "Gorivo radnika je poslato odmah u karticu Gorivo radnici ✅" : (data.report_type === "field_tanker_daily_batch" ? "Gorivo cisterne je poslato odmah u karticu Gorivo cisterna ✅" : (data.report_type === "defect_report" ? "Kvar je poslat odmah u karticu Kvarovi ✅" : "Izveštaj je poslat Upravi ✅"));
        toast(`${sentType} Forma je spremna za sledeći unos.`);
      } catch (resetError) {
        console.warn("AskCreate.app: izveštaj je poslat, ali priprema sledeće forme nije uspela:", resetError);
        toast("Izveštaj je poslat Upravi ✅ Ako forma ne izgleda prazno, odjavi se i uđi ponovo.");
      }
    } catch(e) {
      toast(e.message, true);
    } finally {
      workerReportSubmitBusy = false;
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = submitBtn.dataset.oldText || "Pošalji izveštaj"; delete submitBtn.dataset.oldText; }
    }
  });
}



let mechanicBossTimer = null;
let mechanicBossLastNewCount = 0;
let mechanicBossLastSignature = "";
let mechanicBossReportsCache = [];
let mechanicBossAllReportsCache = [];
let mechanicBossAssetsCache = [];

function isMechanicBossWorker(worker = currentWorker) {
  const perms = worker?.permissions || {};
  return !!(perms.mechanic_boss || perms.mechanicBoss || perms.mechanic_manager || perms.head_mechanic);
}

function isOwnerDashboardWorker(worker = currentWorker) {
  const perms = worker?.permissions || {};
  const title = `${worker?.function_title || ""} ${worker?.role || ""}`.toLowerCase();
  return !!(perms.owner_dashboard || perms.ownerDashboard || perms.owner_panel || title.includes("vlasnik") || title.includes("gazda") || title.includes("direktor"));
}

async function safeOwnerSelect(table, select = "*") {
  try {
    if (!currentWorker?.company_id || !sb) return [];
    if (table === "reports") {
      // Vlasnik/Direktor: najpre čitaj aktivne izveštaje preko stvarno prijavljenog linka.
      const workerReports = await listActiveReportsForLoggedWorkerRpc();
      if (Array.isArray(workerReports)) return workerReports;
      // Ako SQL još nije dodat, pokušaj stari Direkcija RPC pa direktan select sa strogim filterom.
      try {
        const oldCompany = currentCompany;
        currentCompany = currentCompany || { id: currentWorker.company_id };
        const rpcReports = await directorRpcListReports();
        currentCompany = oldCompany || currentCompany;
        return filterOperationalReportsForAnalytics(rpcReports || []);
      } catch (_) {}
    }
    const { data, error } = await sb.from(table).select(select).eq("company_id", currentWorker.company_id);
    if (error) throw error;
    return table === "reports" ? filterOperationalReportsForAnalytics(data || []) : (data || []);
  } catch (e) {
    console.warn(`Vlasnik/Direktor panel: ${table} nije učitan`, e?.message || e);
    return [];
  }
}

async function loadOwnerPanelData() {
  if (!currentWorker?.company_id || !sb) throw new Error("Vlasnik/Direktor nije prijavljen.");
  currentCompany = {
    id: currentWorker.company_id,
    name: currentWorker.company_name || "Firma",
    company_code: currentWorker.company_code || "",
    brand_color: currentWorker.brand_color || "green",
    status: "active"
  };
  const [people, sites, assets, reports] = await Promise.all([
    safeOwnerSelect("company_users", "*"),
    safeOwnerSelect("sites", "*"),
    safeOwnerSelect("assets", "*"),
    safeOwnerSelect("reports", "*")
  ]);
  directorPeopleCache = people.filter(p => p.active !== false);
  directorSitesCache = sites.filter(x => x.active !== false);
  directorAssetsCache = assets.filter(x => x.active !== false);
  directorReportsCache = await attachReportUsersFallback(filterOperationalReportsForAnalytics(reports || []));
  try {
    const { data, error } = await sb.rpc("director_list_materials", { p_company_id: currentWorker.company_id });
    if (!error) directorMaterialsCache = data || [];
  } catch (e) {
    directorMaterialsCache = [];
  }
  ensureOverviewDatalists();
}

async function refreshOwnerDashboardPanel({ silent = false } = {}) {
  try {
    const connectionOk = await probeRealConnection();
    if (!connectionOk) throw new Error("Proverite internet konekciju. Trenutno ste offline.");
    await loadOwnerPanelData();
    renderOwnerDashboard("ownerPanelDashboard", "ownerPanelDashboardPreview");
    if (!document.getElementById("ownerPanelArchiveBox")?.classList.contains("hidden")) renderOwnerPanelArchiveList();
    markAutoRefreshOnline("Direktor");
  } catch (e) {
    markAutoRefreshOffline("Direktor", e);
    const box = document.getElementById("ownerPanelDashboardPreview");
    if (box && !silent) box.innerHTML = `<div class="site-boss-warning"><b>Vlasnik/Direktor pregled nije učitan.</b><br>${escapeHtml(e.message || e)}<br><span class="muted">Ako Supabase RLS ne dozvoljava vlasniku da čita izveštaje firme, treba dodati posebnu RPC/SQL dozvolu za vlasnički pregled.</span></div>`;
    if (!silent) toast(e.message || "Vlasnik/Direktor pregled nije učitan.", true);
  }
}

async function ownerAutoRefreshTick() {
  if (!currentWorker?.company_id || ownerAutoRefreshBusy) return;
  const panel = document.getElementById("viewOwnerDashboardPanel");
  if (!panel || !panel.classList.contains("active")) return;
  ownerAutoRefreshBusy = true;
  try {
    await refreshOwnerDashboardPanel({ silent: true });
  } finally {
    ownerAutoRefreshBusy = false;
  }
}

function startOwnerAutoRefresh() {
  stopOwnerAutoRefresh();
  startAutoRefreshHeartbeat("Direktor");
  ownerAutoRefreshTick();
  ownerAutoRefreshTimer = setInterval(ownerAutoRefreshTick, AUTO_REFRESH_INTERVAL_MS);
}

function stopOwnerAutoRefresh() {
  if (ownerAutoRefreshTimer) clearInterval(ownerAutoRefreshTimer);
  ownerAutoRefreshTimer = null;
  ownerAutoRefreshBusy = false;
}

async function openOwnerDashboardPanel() {
  stopMechanicBossWatcher();
  stopDirectorAutoRefresh();
  await applyWorkerCompanyBrand();
  setInternalHeader("Vlasnik/Direktor pregled", `${currentWorker?.full_name || "Vlasnik"} · ${currentWorker?.company_name || currentWorker?.company_code || ""}`, true);
  const name = document.getElementById("ownerPanelName");
  const label = document.getElementById("ownerPanelCompanyLabel");
  if (name) name.textContent = currentWorker?.full_name || "Vlasnik / Direktor";
  if (label) label.textContent = `${currentWorker?.company_name || "Firma"} · pregled bez izmena`;
  show("OwnerDashboardPanel");
  await refreshOwnerDashboardPanel({ silent: true });
  startOwnerAutoRefresh();
}

function logoutOwnerDashboardPanel() {
  stopOwnerAutoRefresh();
  localStorage.removeItem("swp_worker");
  currentWorker = null;
  clearCompanyBrandFromBody();
  setInternalHeader("", "", false);
  show("WorkerLogin");
}

function stopMechanicBossWatcher() {
  if (mechanicBossTimer) clearInterval(mechanicBossTimer);
  mechanicBossTimer = null;
  mechanicBossAutoRefreshBusy = false;
}


async function registerAskCreateServiceWorker(forceUpdate = false) {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.register("./sw.js?v=1693", { updateViaCache: "none" });
  if (forceUpdate && reg.update) {
    try { await reg.update(); } catch (e) { console.warn("SW update failed:", e); }
  }
  try {
    if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
    if (navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: "SKIP_WAITING" });
  } catch (e) {}
  return reg;
}

function mechanicPushSupported() {
  return !!("serviceWorker" in navigator && "PushManager" in window && "Notification" in window);
}

function mechanicVapidKeyReady() {
  return !!(MECHANIC_VAPID_PUBLIC_KEY && !String(MECHANIC_VAPID_PUBLIC_KEY).includes("PASTE_") && String(MECHANIC_VAPID_PUBLIC_KEY).length > 30);
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function setMechanicPushUi(status, detail = "") {
  const card = $("#mechanicPushCard");
  const box = $("#mechanicPushStatus");
  const btn = $("#enableMechanicPushBtn");
  const isReady = status === "ready";

  // Kada su obaveštenja uspešno uključena, sklanjamo ceo veliki blok da ne zauzima ekran.
  // Ako obaveštenja nisu uključena ili postoji greška, blok ostaje vidljiv da šef zna šta treba da uradi.
  if (card) card.classList.toggle("hidden", isReady);

  if (box) {
    box.className = "mechanic-push-status " + (status || "idle");
    const labels = {
      ready: "✅ Obaveštenja su uključena na ovom telefonu.",
      off: "🔕 Obaveštenja nisu uključena na ovom telefonu.",
      missing: "⚠️ VAPID public key nije upisan u frontend.",
      unsupported: "⚠️ Ovaj browser/telefon ne podržava Web Push za PWA.",
      denied: "🚫 Obaveštenja su blokirana u podešavanjima browsera/telefona.",
      error: "⚠️ Obaveštenja nisu sačuvana."
    };
    box.textContent = (labels[status] || "Status obaveštenja") + (detail ? " " + detail : "");
  }
  if (btn) btn.disabled = isReady || status === "unsupported";
}

async function refreshMechanicPushUi() {
  if (!isMechanicBossWorker(currentWorker)) return;
  if (!mechanicPushSupported()) return setMechanicPushUi("unsupported");
  if (!mechanicVapidKeyReady()) return setMechanicPushUi("missing", "Zalepi VAPID_PUBLIC_KEY u script.js pa uploaduj novu verziju.");
  if (Notification.permission === "denied") return setMechanicPushUi("denied");
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    setMechanicPushUi(sub ? "ready" : "off");
  } catch (e) {
    setMechanicPushUi("error", e.message || "");
  }
}

async function enableMechanicPushNotifications() {
  try {
    if (!currentWorker || !isMechanicBossWorker(currentWorker)) throw new Error("Obaveštenja može uključiti samo prijavljeni Šef mehanizacije.");
    if (!mechanicPushSupported()) throw new Error("Ovaj telefon/browser ne podržava Web Push za PWA. Na Androidu koristi Chrome i instaliranu PWA prečicu.");
    if (!mechanicVapidKeyReady()) throw new Error("Nedostaje VAPID_PUBLIC_KEY u script.js. To je javni ključ, nije tajna. Zalepi ga pa uploaduj novu verziju.");

    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Obaveštenja nisu dozvoljena. Uključi ih u podešavanjima browsera/telefona.");

    const reg = await registerAskCreateServiceWorker(true);
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(MECHANIC_VAPID_PUBLIC_KEY)
      });
    }

    const { data, error } = await sb.rpc("save_mechanic_push_subscription", {
      p_company_code: currentWorker.company_code,
      p_access_code: currentWorker.access_code,
      p_subscription: sub.toJSON(),
      p_device_info: navigator.userAgent || "unknown"
    });
    if (error) throw error;
    const row = readRpcSingleRow(data);
    if (row && row.success === false) throw new Error(row.message || "Pretplata nije sačuvana.");

    localStorage.setItem("swp_mechanic_push_enabled", "1");
    setMechanicPushUi("ready");
    toast("Obaveštenja za kvarove su uključena na ovom uređaju 🔔");
  } catch (e) {
    console.warn("Mechanic push enable failed:", e);
    setMechanicPushUi("error", e.message || String(e));
    toast(e.message || "Obaveštenja nisu uključena.", true);
  }
}

async function sendMechanicPushAfterDefect(worker, defectPayload) {
  try {
    if (!worker?.company_code || !worker?.access_code) {
      console.warn("Push za Šefa mehanizacije preskočen: nema company_code ili access_code.");
      return;
    }

    const body = {
      company_code: worker.company_code,
      access_code: worker.access_code,
      defect: {
        asset: defectPayload.defect_asset_name || defectPayload.defect_machine || defectPayload.machine || "Sredstvo u kvaru",
        site: defectPayload.defect_site_name || defectPayload.site_name || "Lokacija nije upisana",
        text: defectPayload.defect || "Novi kvar je prijavljen.",
        urgency: defectPayload.defect_urgency || "",
        reporter: defectPayload.created_by_worker || worker.full_name || "Zaposleni"
      }
    };

    const fnUrl = `${SUPABASE_URL}/functions/v1/send-mechanic-defect-push`;
    const res = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify(body)
    });

    let json = null;
    try { json = await res.json(); } catch (_) {}

    if (!res.ok || (json && json.ok === false)) {
      throw new Error((json && json.error) || `Edge Function greška: HTTP ${res.status}`);
    }

    console.log("Push za Šefa mehanizacije pozvan:", json || { ok: true });
  } catch (e) {
    console.warn("Push za Šefa mehanizacije nije poslat. Kvar je ipak sačuvan:", e?.message || e);
  }
}

function mechanicStatusRaw(report) {
  const d = report?.data || {};
  return String(d.defect_status || "novo").toLowerCase().trim();
}

function mechanicStatusGroup(report) {
  const s = mechanicStatusRaw(report).replace(/\s+/g, "_");
  if (["reseno", "rešeno", "resolved", "done"].includes(s)) return "resolved";
  if (["preuzeto", "u_radu", "u_popravci", "primljeno", "active"].includes(s)) return "active";
  return "new";
}

function mechanicStatusLabel(report) {
  const g = mechanicStatusGroup(report);
  const s = mechanicStatusRaw(report);
  if (g === "resolved") return "Rešeno";
  if (["u_radu", "u popravci", "u_popravci"].includes(s)) return "U radu";
  if (["preuzeto", "primljeno"].includes(s)) return "Preuzeto";
  return "Novo";
}

function mechanicDefectAssetName(report) {
  const d = report?.data || {};
  return [
    d.defect_asset_code,
    d.defect_asset_name || d.defect_machine || d.machine || d.vehicle || d.defect_manual_asset_name,
    d.defect_asset_registration
  ].filter(Boolean).join(" · ") || "—";
}

function mechanicDefectSiteName(report) {
  const d = report?.data || {};
  return d.defect_site_name || d.site_name || d.location || "—";
}

function mechanicDefectReporter(report) {
  const d = report?.data || {};
  if (report?.company_users) return `${report.company_users.first_name || ""} ${report.company_users.last_name || ""}`.trim() || "—";
  return d.created_by_worker || d.worker_name || d.created_by || "—";
}

function mechanicDefectText(report) {
  const d = report?.data || {};
  return d.defect || d.defect_description || d.problem || "Bez opisa kvara";
}

function mechanicDefectTime(report) {
  const d = report?.data || {};
  return d.defect_reported_at || report?.submitted_at || report?.created_at || report?.report_date || "";
}

function mechanicDefectUrgency(report) {
  const d = report?.data || {};
  return d.defect_urgency || d.urgency || "—";
}

function mechanicDefectImpact(report) {
  const d = report?.data || {};
  const v = d.defect_work_impact || d.defect_stops_work || "";
  if (v === "zaustavlja_rad" || v === "da") return "Zaustavlja rad";
  if (v === "moze_nastaviti" || v === "ne") return "Može nastaviti rad";
  return v || "—";
}

function mechanicCalledPhoneLabel(report) {
  const d = report?.data || {};
  const v = d.called_mechanic_by_phone || d.defect_called_mechanic || "";
  if (v === "da") return "Da";
  if (v === "ne") return "Ne";
  return v || "—";
}

function dedupeMechanicDefects(reports = []) {
  const seen = new Set();
  const out = [];
  for (const r of Array.isArray(reports) ? reports : []) {
    const d = r?.data || {};
    const key = String(r?.id || [d.defect_reported_at, d.defect_asset_code, d.defect_asset_name, d.defect, d.defect_site_name].join("|"));
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function mechanicHiddenWorkerKey(worker = currentWorker) {
  return String(worker?.id || worker?.user_id || worker?.access_code || worker?.full_name || "mechanic").trim();
}

function mechanicHiddenDefectsStorageKey(worker = currentWorker) {
  return `askcreate_mechanic_hidden_defects_${worker?.company_id || worker?.company_code || "no_company"}_${mechanicHiddenWorkerKey(worker)}`;
}

function getLocalMechanicHiddenDefectIds(worker = currentWorker) {
  try {
    return JSON.parse(localStorage.getItem(mechanicHiddenDefectsStorageKey(worker)) || "[]").map(String);
  } catch (_) {
    return [];
  }
}

function saveLocalMechanicHiddenDefectId(id, worker = currentWorker) {
  const key = mechanicHiddenDefectsStorageKey(worker);
  const ids = new Set(getLocalMechanicHiddenDefectIds(worker));
  ids.add(String(id));
  localStorage.setItem(key, JSON.stringify(Array.from(ids)));
}

function isMechanicDefectHiddenForCurrentWorker(report) {
  const id = String(report?.id || "");
  const workerKey = mechanicHiddenWorkerKey();
  const d = report?.data || {};
  const dbList = Array.isArray(d.mechanic_hidden_for) ? d.mechanic_hidden_for.map(String) : [];
  const localList = getLocalMechanicHiddenDefectIds();
  return (!!id && localList.includes(id)) || (!!workerKey && dbList.includes(workerKey));
}

function isDefectCorrectionWaitingDirectorReview(report) {
  const d = report?.data || {};
  const status = String(d.defect_status || d.mechanic_status || report?.status || "").toLowerCase().trim().replace(/\s+/g, "_");
  const correctionStatuses = [
    "ponovo_poslato",
    "ponovo_poslat",
    "ispravljeno",
    "ispravljen",
    "resubmitted",
    "resubmitted_after_correction",
    "correction_resubmitted",
    "returned_resubmitted"
  ];
  return !!(
    d.resubmitted_after_correction === true ||
    d.waiting_director_review === true ||
    d.director_review_required === true ||
    correctionStatuses.includes(status)
  );
}

function mechanicShouldShowDefect(report) {
  if (!report || !hasDefectData(report) || isArchivedReport(report)) return false;
  if (isMechanicDefectHiddenForCurrentWorker(report)) return false;
  // Kada radnik pošalje ispravljen kvar posle vraćanja, taj izveštaj ide prvo Direkciji na proveru.
  // Šef mehanizacije ga ne obrađuje ponovo dok Direkcija ne odluči šta dalje, da se ne meša tok ispravke sa aktivnim kvarovima.
  if (isDefectCorrectionWaitingDirectorReview(report)) return false;
  return true;
}

function mechanicActionButtonsHtml(r) {
  const id = escapeHtml(r.id);
  const group = mechanicStatusGroup(r);
  const buttons = [];

  if (isDefectCorrectionWaitingDirectorReview(r)) {
    buttons.push(`<button class="secondary small-action mechanic-hide-btn" type="button" onclick="hideMechanicDefectFromPanel('${id}')">Skloni kod mene</button>`);
    return `<div class="mechanic-actions"><small class="muted">Ispravka čeka proveru Direkcije.</small>${buttons.join("")}</div>`;
  }

  if (group === "new") {
    buttons.push(`<button class="secondary small-action" type="button" onclick="updateMechanicDefectStatus('${id}','preuzeto')">Preuzmi kvar</button>`);
  } else if (mechanicStatusRaw(r).replace(/\s+/g, "_") === "preuzeto" || mechanicStatusRaw(r) === "primljeno") {
    buttons.push(`<button class="secondary small-action" type="button" onclick="updateMechanicDefectStatus('${id}','u_radu')">U radu</button>`);
  }
  if (group !== "resolved") {
    buttons.push(`<button class="primary small-action" type="button" onclick="updateMechanicDefectStatus('${id}','reseno')">Rešeno</button>`);
  } else {
    buttons.push(`<button class="secondary small-action mechanic-hide-btn" type="button" onclick="hideMechanicDefectFromPanel('${id}')">Skloni kod mene</button>`);
  }
  buttons.push(`<button class="secondary small-action" type="button" onclick="addMechanicDefectNote('${id}')">Napomena</button>`);
  return `<div class="mechanic-actions">${buttons.join("")}</div>`;
}

function mechanicDefectCardHtml(r, compact = false) {
  const d = r.data || {};
  const group = mechanicStatusGroup(r);
  const icon = group === "new" ? "🔴" : group === "active" ? "🟠" : "🟢";
  const internal = d.defect_asset_code ? `<span><b>Interni broj:</b> ${escapeHtml(d.defect_asset_code)}</span>` : "";
  const reg = d.defect_asset_registration ? `<span><b>Registracija:</b> ${escapeHtml(d.defect_asset_registration)}</span>` : "";
  return `<article class="mechanic-card mechanic-${group} ${compact ? "mechanic-card-compact" : ""}">
    <div class="mechanic-card-head"><strong>${icon} ${escapeHtml(mechanicStatusLabel(r))}</strong><span>${escapeHtml(formatDateTimeLocal(mechanicDefectTime(r)) || "")}</span></div>
    ${d.sent_immediately ? `<p class="mechanic-immediate-badge">🚨 Evidentirano odmah</p>` : ""}
    <h4>${escapeHtml(mechanicDefectAssetName(r))}</h4>
    <div class="mechanic-detail-grid">
      ${internal}
      ${reg}
      <span><b>Gradilište/lokacija:</b> ${escapeHtml(mechanicDefectSiteName(r))}</span>
      <span><b>Prijavio:</b> ${escapeHtml(mechanicDefectReporter(r))}</span>
      <span><b>Hitnost:</b> ${escapeHtml(mechanicDefectUrgency(r))}</span>
      <span><b>Uticaj:</b> ${escapeHtml(mechanicDefectImpact(r))}</span>
      <span><b>Pozvan telefonom:</b> ${escapeHtml(mechanicCalledPhoneLabel(r))}</span>
    </div>
    <p><b>Problem:</b> ${escapeHtml(mechanicDefectText(r))}</p>
    ${defectImagesHtml(d, { compact: true })}
    ${defectTimelineHtml(d, { compact: true })}
    ${d.mechanic_note ? `<p class="mechanic-note"><b>Napomena šefa mehanizacije:</b> ${escapeHtml(d.mechanic_note)}</p>` : ""}
    ${mechanicActionButtonsHtml(r)}
  </article>`;
}


async function attachReportUsersFallback(reports = []) {
  try {
    if (typeof enrichReportsWithUsers === "function") return await enrichReportsWithUsers(reports);
  } catch (e) {
    console.warn("Ne mogu povezati prijavioce kvarova, prikazujem osnovne podatke:", e);
  }
  return Array.isArray(reports) ? reports : [];
}

function renderMechanicBossError(message) {
  const safeMsg = escapeHtml(message || "Ne mogu učitati kvarove za šefa mehanizacije.");
  const tableBody = $("#mechanicBossTableBody");
  const cards = $("#mechanicBossCards");
  const newBox = $("#mechanicNewDefects");
  const activeBox = $("#mechanicActiveDefects");
  const resolvedBox = $("#mechanicResolvedDefects");
  const badge = $("#mechanicNewBadge");
  if (badge) badge.textContent = "0 novih · 0 aktivnih · 0 rešenih";
  if (tableBody) tableBody.innerHTML = `<tr><td colspan="7" class="muted">${safeMsg}</td></tr>`;
  if (cards) cards.innerHTML = `<p class="muted">${safeMsg}</p>`;
  if (newBox) newBox.innerHTML = `<p class="muted tiny">${safeMsg}</p>`;
  if (activeBox) activeBox.innerHTML = `<p class="muted tiny">Nema aktivnih kvarova.</p>`;
  if (resolvedBox) resolvedBox.innerHTML = `<p class="muted tiny">Nema rešenih kvarova.</p>`;
}

async function mechanicListDefectsSafe() {
  // Prvo pokušavamo sigurni RPC za šefa mehanizacije. Ako SQL još nije dodat,
  // vraćamo se na stari direktan select da ne pokvarimo postojeći MVP.
  try {
    const { data, error } = await sb.rpc("mechanic_list_defects", {
      p_company_code: currentWorker.company_code,
      p_access_code: currentWorker.access_code
    });
    if (!error) return filterOperationalReportsForAnalytics(data || []);
    const msg = String(error.message || "").toLowerCase();
    if (!msg.includes("mechanic_list_defects") && !msg.includes("function") && !msg.includes("schema cache")) {
      throw error;
    }
    console.warn("mechanic_list_defects RPC ne postoji još, koristim direktan select:", error.message);
  } catch (e) {
    const msg = String(e.message || "").toLowerCase();
    if (!msg.includes("mechanic_list_defects") && !msg.includes("function") && !msg.includes("schema cache")) {
      throw e;
    }
  }

  const rpcReports = await listActiveReportsForLoggedWorkerRpc();
  if (Array.isArray(rpcReports)) return rpcReports.filter(hasDefectData);

  const { data, error } = await sb
    .from("reports")
    .select("id, company_id, user_id, report_date, status, submitted_at, created_at, data")
    .eq("company_id", currentWorker.company_id)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .limit(200);
  if (error) throw error;
  return filterOperationalReportsForAnalytics(data || []).filter(hasDefectData);
}


function toggleMechanicSection(bodyId) {
  const body = document.getElementById(bodyId);
  if (!body) return;
  const isHidden = body.classList.contains("hidden");
  body.classList.toggle("hidden", !isHidden);
  const card = body.closest(".mechanic-collapsible");
  if (card) card.classList.toggle("is-collapsed", !isHidden);
  const toggle = document.querySelector(`[aria-controls="${bodyId}"]`);
  if (toggle) toggle.setAttribute("aria-expanded", String(isHidden));
}

function setMechanicSectionCount(id, count, suffix = "") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = `${count}${suffix}`;
}


async function mechanicListCompanyReportsSafe() {
  if (!currentWorker?.company_id || !sb) return [];
  const rpcReports = await listActiveReportsForLoggedWorkerRpc();
  if (Array.isArray(rpcReports)) {
    return attachReportUsersFallback ? await attachReportUsersFallback(rpcReports) : rpcReports;
  }
  const { data, error } = await sb
    .from("reports")
    .select("id, company_id, user_id, report_date, status, submitted_at, created_at, data")
    .eq("company_id", currentWorker.company_id)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .limit(500);
  if (error) throw error;
  const clean = filterOperationalReportsForAnalytics(data || []);
  return attachReportUsersFallback ? await attachReportUsersFallback(clean) : clean;
}

async function mechanicListAssetsSafe() {
  if (!currentWorker?.company_id || !sb) return [];
  const { data, error } = await sb
    .from("assets")
    .select("*")
    .eq("company_id", currentWorker.company_id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

function mechanicEnsureFuelDates() {
  const fromEl = document.getElementById("mechanicFuelFrom");
  const toEl = document.getElementById("mechanicFuelTo");
  const from = today().slice(0, 8) + "01";
  const to = today();
  if (fromEl && !fromEl.value) fromEl.value = from;
  if (toEl && !toEl.value) toEl.value = to;
  return { from: fromEl?.value || from, to: toEl?.value || to };
}

function mechanicFuelRowCells(row) {
  const expected = expectedFuelForRow(row);
  const diff = row.liters - expected;
  const status = fuelConsumptionStatus(row);
  return [
    row.label,
    assetTypeLabel(row.type),
    formatAssetFuelNorm(row.asset) || "Nema norme",
    row.mtc ? `${round2(row.mtc)} MTČ` : "—",
    row.km ? `${round2(row.km)} km` : "—",
    expected ? `${round2(expected)} L` : "—",
    row.liters ? `${round2(row.liters)} L` : "—",
    expected ? `${diff >= 0 ? "+" : ""}${round2(diff)} L` : "—",
    `<span class="${status.cls}">${escapeHtml(status.label)}</span>`
  ];
}

function renderMechanicFuelAnalysis() {
  const box = document.getElementById("mechanicFuelOverview");
  if (!box) return;
  const { from, to } = mechanicEnsureFuelDates();

  // Mehaničar koristi iste računske funkcije kao Direkcija, ali samo sa podacima svoje firme.
  directorReportsCache = Array.isArray(mechanicBossAllReportsCache) ? mechanicBossAllReportsCache : [];
  directorAssetsCache = Array.isArray(mechanicBossAssetsCache) ? mechanicBossAssetsCache : [];

  const rows = buildFuelConsumptionRows(from, to);
  const badRows = rows.filter(row => fuelConsumptionStatus(row).cls === "consumption-status-bad");
  const warnRows = rows.filter(row => fuelConsumptionStatus(row).cls === "consumption-status-warn");
  const noNormAssets = (directorAssetsCache || [])
    .filter(a => a && a.active !== false && !assetFuelNormValue(a))
    .slice(0, 40);
  const totalLiters = round2(rows.reduce((sum, row) => sum + Number(row.liters || 0), 0));
  const totalExpected = round2(rows.reduce((sum, row) => sum + Number(expectedFuelForRow(row) || 0), 0));

  const table = (headers, bodyRows, empty) => bodyRows.length
    ? `<div class="mechanic-table-wrap"><table class="mechanic-table"><thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${bodyRows.map(row => `<tr>${row.map((v, idx) => idx === row.length - 1 && String(v).includes("<span") ? `<td>${v}</td>` : `<td>${escapeHtml(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
    : `<p class="muted tiny">${escapeHtml(empty)}</p>`;

  box.innerHTML = `
    <div class="owner-kpi-grid mechanic-kpi-grid">
      <div class="owner-kpi"><b>${rows.length}</b><span>sredstava u analizi</span></div>
      <div class="owner-kpi"><b>${totalLiters} L</b><span>stvarno sipano</span></div>
      <div class="owner-kpi"><b>${totalExpected} L</b><span>očekivano po normi</span></div>
      <div class="owner-kpi"><b>${badRows.length}</b><span>povećana potrošnja</span></div>
      <div class="owner-kpi"><b>${noNormAssets.length}</b><span>sredstva bez norme</span></div>
    </div>
    <section><h4>🚨 Povećana potrošnja</h4>${table(["Sredstvo","Tip","Norma","MTČ","KM","Očekivano","Sipano","Razlika","Status"], badRows.map(mechanicFuelRowCells), "Nema povećane potrošnje u izabranom periodu.")}</section>
    <section><h4>⚠️ Proveriti / manje od norme</h4>${table(["Sredstvo","Tip","Norma","MTČ","KM","Očekivano","Sipano","Razlika","Status"], warnRows.map(mechanicFuelRowCells), "Nema sredstava za proveru.")}</section>
    <section><h4>🧾 Sva sredstva sa gorivom/radom</h4>${table(["Sredstvo","Tip","Norma","MTČ","KM","Očekivano","Sipano","Razlika","Status"], rows.map(mechanicFuelRowCells), "Nema dovoljno podataka za potrošnju. Potrebni su MTČ/KM i sipanja goriva.")}</section>
    <section><h4>📌 Sredstva bez upisane norme</h4>${table(["Sredstvo","Tip","Interni broj","Registracija","Šta fali"], noNormAssets.map(a => [formatAssetTitleWithCode(a), assetTypeLabel(normalizeAssetType(a.asset_type)), getAssetCode(a) || "—", getAssetRegistration(a) || "—", "Uneti normu potrošnje u Direkciji"]), "Sva aktivna sredstva imaju upisanu normu ili nema aktivnih sredstava.")}</section>`;
}

async function loadMechanicBossOperations({ silent = false } = {}) {
  if (!currentWorker?.company_id || !sb) return;
  try {
    const [reports, assets] = await Promise.all([mechanicListCompanyReportsSafe(), mechanicListAssetsSafe()]);
    mechanicBossAllReportsCache = reports || [];
    mechanicBossAssetsCache = assets || [];
    renderMechanicFuelAnalysis();
    markAutoRefreshOnline("Šef mehanizacije");
    if (!silent) toast("Potrošnja i sredstva su osveženi.");
  } catch (e) {
    const box = document.getElementById("mechanicFuelOverview");
    markAutoRefreshOffline("Šef mehanizacije", e);
    if (box) box.innerHTML = `<p class="muted">Ne mogu učitati potrošnju: ${escapeHtml(e.message || String(e))}</p>`;
    if (!silent) toast(e.message || "Ne mogu učitati potrošnju.", true);
  }
}

function renderMechanicBossDefects() {
  const tableBody = $("#mechanicBossTableBody");
  const cards = $("#mechanicBossCards");
  const newBox = $("#mechanicNewDefects");
  const activeBox = $("#mechanicActiveDefects");
  const resolvedBox = $("#mechanicResolvedDefects");
  const badge = $("#mechanicNewBadge");
  const list = Array.isArray(mechanicBossReportsCache) ? mechanicBossReportsCache : [];

  const countNew = list.filter(r => mechanicStatusGroup(r) === "new").length;
  const countActive = list.filter(r => mechanicStatusGroup(r) === "active").length;
  const countResolved = list.filter(r => mechanicStatusGroup(r) === "resolved").length;
  if (badge) badge.textContent = `${countNew} novih · ${countActive} aktivnih · ${countResolved} rešenih`;
  setMechanicSectionCount("mechanicNewCountMini", countNew);
  setMechanicSectionCount("mechanicActiveCountMini", countActive);
  setMechanicSectionCount("mechanicResolvedCountMini", countResolved);
  setMechanicSectionCount("mechanicAllCountMini", list.length, " ukupno");

  const actionsHtml = (r) => mechanicActionButtonsHtml(r);

  const rowHtml = list.map(r => {
    const d = r.data || {};
    return `<tr class="mechanic-row mechanic-${mechanicStatusGroup(r)}">
      <td>${escapeHtml(formatDateTimeLocal(mechanicDefectTime(r)) || mechanicDefectTime(r))}</td>
      <td><b>${escapeHtml(mechanicDefectAssetName(r))}</b>${d.defect_asset_code ? `<small>Interni broj: ${escapeHtml(d.defect_asset_code)}</small>` : ""}${d.defect_asset_registration ? `<small>Reg: ${escapeHtml(d.defect_asset_registration)}</small>` : ""}</td>
      <td>${escapeHtml(mechanicDefectSiteName(r))}</td>
      <td>${escapeHtml(mechanicDefectText(r))}${d.mechanic_note ? `<small>Napomena: ${escapeHtml(d.mechanic_note)}</small>` : ""}</td>
      <td>${escapeHtml(mechanicDefectReporter(r))}</td>
      <td><span class="mechanic-status-pill status-${mechanicStatusGroup(r)}">${escapeHtml(mechanicStatusLabel(r))}</span></td>
      <td>${actionsHtml(r)}</td>
    </tr>`;
  }).join("");

  if (tableBody) tableBody.innerHTML = rowHtml || `<tr><td colspan="7" class="muted">Nema prijavljenih kvarova za ovu firmu.</td></tr>`;

  const cardHtml = list.map(r => mechanicDefectCardHtml(r)).join("");
  if (cards) cards.innerHTML = cardHtml || `<p class="muted">Nema prijavljenih kvarova.</p>`;

  const renderGroup = (box, group, empty) => {
    if (!box) return;
    const groupRows = list.filter(r => mechanicStatusGroup(r) === group);
    box.innerHTML = groupRows.map(r => mechanicDefectCardHtml(r, true)).join("") || `<p class="muted tiny">${empty}</p>`;
  };
  renderGroup(newBox, "new", "Nema novih kvarova.");
  renderGroup(activeBox, "active", "Nema aktivnih kvarova.");
  renderGroup(resolvedBox, "resolved", "Nema rešenih kvarova u listi.");
}

async function loadMechanicBossDefects({ silent = false } = {}) {
  if (!currentWorker?.company_id || !sb) return;
  try {
    const defects = await mechanicListDefectsSafe();
    mechanicBossReportsCache = dedupeMechanicDefects(await attachReportUsersFallback(defects)).filter(mechanicShouldShowDefect);
    const newReports = mechanicBossReportsCache.filter(r => mechanicStatusGroup(r) === "new");
    const signature = newReports.map(r => r.id).join("|");
    if (signature && mechanicBossLastSignature && signature !== mechanicBossLastSignature && newReports.length >= mechanicBossLastNewCount) {
      showMechanicNewDefectSignal();
    }
    mechanicBossLastSignature = signature;
    mechanicBossLastNewCount = newReports.length;
    renderMechanicBossDefects();
    markAutoRefreshOnline("Šef mehanizacije");
    if (!silent) toast("Kvarovi su osveženi.");
  } catch (e) {
    console.warn("Ne mogu učitati kvarove za šefa mehanizacije:", e);
    markAutoRefreshOffline("Šef mehanizacije", e);
    renderMechanicBossError(e.message || "Ne mogu učitati kvarove. Ako se ovo ponavlja, treba dodati mechanic_list_defects SQL RPC.");
    if (!silent) toast(e.message || "Ne mogu učitati kvarove.", true);
  }
}

function showMechanicNewDefectSignal() {
  const signal = $("#mechanicNewSignal");
  if (signal) {
    signal.classList.remove("hidden");
    signal.textContent = "🔴 Novi kvar prijavljen";
  }
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.04;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close?.(); }, 180);
    }
  } catch {}
  toast("Novi kvar prijavljen 🚨");
}

async function mechanicBossAutoRefreshTick() {
  if (!currentWorker?.company_id || mechanicBossAutoRefreshBusy) return;
  const panel = document.getElementById("viewMechanicBossPanel");
  if (!panel || !panel.classList.contains("active")) return;
  const connectionOk = await probeRealConnection();
  if (!connectionOk) {
    markAutoRefreshOffline("Šef mehanizacije");
    return;
  }
  mechanicBossAutoRefreshBusy = true;
  try {
    await loadMechanicBossDefects({ silent: true });
    await loadMechanicBossOperations({ silent: true });
    markAutoRefreshOnline("Šef mehanizacije");
  } finally {
    mechanicBossAutoRefreshBusy = false;
  }
}

async function openMechanicBossPanel() {
  stopOwnerAutoRefresh();
  stopDirectorAutoRefresh();
  stopMechanicBossWatcher();
  await applyWorkerCompanyBrand();
  setInternalHeader("Šef mehanizacije", `${currentWorker?.full_name || "Zaposleni"} · ${currentWorker?.company_name || currentWorker?.company_code || ""}`, true);
  const name = $("#mechanicBossName");
  const label = $("#mechanicBossCompanyLabel");
  if (name) name.textContent = currentWorker?.full_name || "Šef mehanizacije";
  if (label) label.textContent = `${currentWorker?.company_name || "Firma"} · panel kvarova`;
  show("MechanicBossPanel");
  await loadMechanicBossDefects({ silent: true });
  await loadMechanicBossOperations({ silent: true });
  refreshMechanicPushUi();
  startAutoRefreshHeartbeat("Šef mehanizacije");
  mechanicBossAutoRefreshTick();
  mechanicBossTimer = setInterval(mechanicBossAutoRefreshTick, AUTO_REFRESH_INTERVAL_MS);
}

window.updateMechanicDefectStatus = async (id, newStatus) => {
  try {
    if (!currentWorker?.company_id) throw new Error("Šef mehanizacije nije prijavljen.");
    const { data: row, error: readError } = await sb.from("reports").select("data, company_id").eq("id", id).eq("company_id", currentWorker.company_id).maybeSingle();
    if (readError) throw readError;
    const d = row?.data || {};
    const nowIso = new Date().toISOString();
    const actorName = currentWorker.full_name || "Šef mehanizacije";
    const actorRole = currentWorker.function_title || "Šef mehanizacije";
    d.defect_status = newStatus;
    d.mechanic_status = newStatus;
    d.mechanic_updated_by = actorName;
    d.mechanic_updated_at = nowIso;
    d.defect_last_change_at = nowIso;
    d.defect_last_change_by = actorName;
    d.defect_last_change_role = actorRole;
    if (newStatus === "preuzeto") {
      d.defect_received_at = d.defect_received_at || nowIso;
      d.defect_received_by = d.defect_received_by || actorName;
      d.defect_received_role = d.defect_received_role || actorRole;
    }
    if (newStatus === "u_radu") {
      d.defect_repair_started_at = d.defect_repair_started_at || nowIso;
      d.defect_repair_started_by = d.defect_repair_started_by || actorName;
      d.defect_repair_started_role = d.defect_repair_started_role || actorRole;
    }
    if (newStatus === "reseno") {
      d.defect_resolved_at = d.defect_resolved_at || nowIso;
      d.defect_resolved_by = d.defect_resolved_by || actorName;
      d.defect_resolved_role = d.defect_resolved_role || actorRole;
    }
    appendDefectTimelineEvent(d, makeDefectTimelineEvent(newStatus, actorName, actorRole));
    const { error } = await sb.from("reports").update({ data: d }).eq("id", id).eq("company_id", currentWorker.company_id);
    if (error) throw error;
    toast("Status kvara je promenjen i upisan u dnevnik promena.");
    await loadMechanicBossDefects({ silent: true });
  } catch(e) {
    toast(e.message || String(e), true);
  }
};

window.addMechanicDefectNote = async (id) => {
  try {
    if (!currentWorker?.company_id) throw new Error("Šef mehanizacije nije prijavljen.");
    const current = mechanicBossReportsCache.find(r => String(r.id) === String(id));
    const oldNote = current?.data?.mechanic_note || "";
    const note = prompt("Napomena mehanizacije za ovaj kvar:", oldNote);
    if (note === null) return;
    const { data: row, error: readError } = await sb.from("reports").select("data, company_id").eq("id", id).eq("company_id", currentWorker.company_id).maybeSingle();
    if (readError) throw readError;
    const d = row?.data || {};
    const nowIso = new Date().toISOString();
    const actorName = currentWorker.full_name || "Šef mehanizacije";
    const actorRole = currentWorker.function_title || "Šef mehanizacije";
    d.mechanic_note = note.trim();
    d.mechanic_note_by = actorName;
    d.mechanic_note_at = nowIso;
    d.defect_last_change_at = nowIso;
    d.defect_last_change_by = actorName;
    d.defect_last_change_role = actorRole;
    if (note.trim()) appendDefectTimelineEvent(d, makeDefectTimelineEvent("napomena", actorName, actorRole, note.trim()));
    const { error } = await sb.from("reports").update({ data: d }).eq("id", id).eq("company_id", currentWorker.company_id);
    if (error) throw error;
    toast("Napomena je sačuvana.");
    await loadMechanicBossDefects({ silent: true });
  } catch(e) {
    toast(e.message || String(e), true);
  }
};

window.hideMechanicDefectFromPanel = async (id) => {
  try {
    if (!currentWorker?.company_id) throw new Error("Šef mehanizacije nije prijavljen.");
    const current = mechanicBossReportsCache.find(r => String(r.id) === String(id));
    if (!current) return toast("Kvar nije pronađen u panelu šefa mehanizacije.", true);
    const label = mechanicDefectAssetName(current) || "kvar";
    const isCorrection = isDefectCorrectionWaitingDirectorReview(current);
    const msg = isCorrection
      ? `Skloniti ovu ISPRAVKU samo iz panela šefa mehanizacije?

${label}

Ispravka ostaje kod Direkcije na proveri.`
      : `Skloniti ovaj kvar samo iz panela šefa mehanizacije?

${label}

Kvar ostaje vidljiv Direkciji i Direktor ga vidi dok Direkcija ne klikne Arhiviraj.`;
    if (!confirm(msg)) return;

    const workerKey = mechanicHiddenWorkerKey();
    try {
      const { data: row, error: readError } = await sb
        .from("reports")
        .select("data, company_id")
        .eq("id", id)
        .eq("company_id", currentWorker.company_id)
        .maybeSingle();
      if (readError) throw readError;
      const d = row?.data || {};
      const hiddenFor = Array.isArray(d.mechanic_hidden_for) ? d.mechanic_hidden_for.map(String) : [];
      if (!hiddenFor.includes(workerKey)) hiddenFor.push(workerKey);
      d.mechanic_hidden_for = hiddenFor;
      d.mechanic_hidden_at = new Date().toISOString();
      d.mechanic_hidden_by = currentWorker.full_name || "Šef mehanizacije";
      const { error } = await sb
        .from("reports")
        .update({ data: d })
        .eq("id", id)
        .eq("company_id", currentWorker.company_id);
      if (error) throw error;
    } catch (dbError) {
      console.warn("Sakrij kvar za šefa mehanizacije: baza nije dozvolila upis, koristim lokalno skrivanje na ovom uređaju.", dbError?.message || dbError);
      saveLocalMechanicHiddenDefectId(id);
      toast("Kvar je sklonjen samo na ovom uređaju. Direkcija i Arhiva nisu dirnute.");
    }

    mechanicBossReportsCache = mechanicBossReportsCache.filter(r => String(r.id) !== String(id));
    renderMechanicBossDefects();
    toast(isCorrection ? "Ispravka je sklonjena iz panela šefa mehanizacije. Direkcija je i dalje vidi." : "Kvar je sklonjen iz panela šefa mehanizacije. Direkcija i Arhiva ostaju sačuvane.");
  } catch(e) {
    toast(e.message || String(e), true);
  }
};

window.hideResolvedMechanicDefect = window.hideMechanicDefectFromPanel;

function logoutMechanicBoss() {
  stopMechanicBossWatcher();
  localStorage.removeItem("swp_worker");
  localStorage.removeItem("swp_mechanic_keep_login");
  currentWorker = null;
  clearCompanyBrandFromBody();
  setInternalHeader("", "", false);
  show("WorkerLogin");
}

async function applyWorkerCompanyBrand() {
  try {
    if (!currentWorker?.company_id || !sb) {
      applyCompanyBrandToBody("green");
      return;
    }
    const { data, error } = await sb
      .from("companies")
      .select("brand_color")
      .eq("id", currentWorker.company_id)
      .maybeSingle();
    if (error) throw error;
    const safeColor = normalizeCompanyBrandColor(data?.brand_color || currentWorker?.brand_color || "green");
    currentWorker.brand_color = safeColor;
    applyCompanyBrandToBody(safeColor);
  } catch (e) {
    console.warn("AskCreate.app: boja firme za zaposlenog nije učitana", e?.message || e);
    applyCompanyBrandToBody(currentWorker?.brand_color || "green");
  }
}

async function openWorkerForm() {
  await applyWorkerCompanyBrand();
  if (isMechanicBossWorker(currentWorker)) {
    return openMechanicBossPanel();
  }
  if (isOwnerDashboardWorker(currentWorker)) {
    return openOwnerDashboardPanel();
  }
  $("#wrDate").value = today();
  $("#workerHello").textContent = `Dobrodošli, ${currentWorker.full_name}`;
  $("#workerCompanyLabel").textContent = `${currentWorker.company_name} · ${currentWorker.function_title}`;
  refreshWorkerModuleSelector(currentWorker.permissions || {});
  const siteLogEnabled = !!(currentWorker.permissions || {}).site_daily_log;
  const siteLogPanel = $("#siteLogPanel");
  const normalWorkerFormCard = $("#normalWorkerFormCard");
  if (siteLogPanel) {
    siteLogPanel.classList.toggle("hidden", !siteLogEnabled);
    siteLogPanel.setAttribute("aria-hidden", siteLogEnabled ? "false" : "true");
  }
  const returnedPanel = $("#workerReturnedReports");
  if (siteLogEnabled && returnedPanel && siteLogPanel && returnedPanel.parentElement !== $("#viewWorkerForm")) {
    siteLogPanel.insertAdjacentElement("afterend", returnedPanel);
  }
  if (!siteLogEnabled && returnedPanel && normalWorkerFormCard && returnedPanel.parentElement !== normalWorkerFormCard) {
    normalWorkerFormCard.insertBefore(returnedPanel, normalWorkerFormCard.firstChild);
  }
  if (normalWorkerFormCard) normalWorkerFormCard.classList.toggle("hidden", siteLogEnabled);
  document.body.classList.toggle("site-log-mode", siteLogEnabled);
  setInternalHeader(siteLogEnabled ? "Dnevnik gradilišta" : "Terenski radni unos", `${currentWorker?.full_name || "Zaposleni"} · ${currentWorker?.company_name || currentWorker?.company_code || ""}`, true);
  const workerLogout = $("#workerLogoutBtn");
  if (workerLogout) {
    workerLogout.classList.remove("hidden");
    workerLogout.setAttribute("aria-hidden", "false");
  }
  show("WorkerForm");
  await Promise.all([loadWorkerSites(), loadWorkerAssets(), loadWorkerMaterials()]);
  const perms = currentWorker.permissions || {};
  if (perms.site_daily_log) {
    initSiteLogPanel();
    loadSiteLogDraft();
  } else {
    loadDraft();
  }
  loadWorkerReturnedReports();
  const useDesktopPanel = !!(perms.desktop_panel || perms.laptop_view || perms.desktop_worker_panel);
  document.body.classList.toggle("worker-desktop-panel", useDesktopPanel);
  if (useDesktopPanel && !perms.site_daily_log) {
    setInternalHeader("Terenski radni unos - laptop prikaz", `${currentWorker?.full_name || "Zaposleni"} · ${currentWorker?.company_name || currentWorker?.company_code || ""}`, true);
  }
  refreshWorkerModuleSelector(perms);
  applyWorkerModuleSelection({ addDefaults: true });
  renderStoredFieldTankerEntries();
  updateLeaveRequestVisibility();
}


async function boot() {
  installNavigationFallback();
  bindEvents();
  hideAutoRefreshManualButtons();
  initSupabase();
  loadPublicHomeVisualSettings().catch(() => {});
  $("#wrDate").value = today();

  const params = new URLSearchParams(window.location.search || "");
  const clearWorkerSession = params.get("clearWorker") === "1" || params.get("resetWorker") === "1" || params.get("ulaz") === "pocetna";
  if (clearWorkerSession) {
    localStorage.removeItem("swp_worker");
    localStorage.removeItem("swp_worker_company_code");
    localStorage.removeItem("swp_worker_entry_mode");
    localStorage.removeItem("swp_mechanic_keep_login");
  }

  const qrCompanyCode = getWorkerCompanyCodeFromUrl();
  const storedCompanyCode = getSavedWorkerCompanyCode();
  const stored = localStorage.getItem("swp_worker");
  const isStandalonePwa = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
  const isIosStandalone = window.navigator && window.navigator.standalone === true;
  const isInstalledWorkerShortcut = !!storedCompanyCode && (isStandalonePwa || isIosStandalone);

  // QR/PWA radnički režim:
  // - Ako URL nosi ?ulaz=radnik&firma=..., otvara se zaključani radnički ulaz za tu firmu.
  // - Ako je aplikacija instalirana kao PWA za radnika, prečica i dalje otvara radnički ulaz.
  // - Ako korisnik ručno ukuca askcreate.app u običnom browser tabu, sačuvana radnička firma više ne sme da zaključa Upravu.
  if (!clearWorkerSession && (qrCompanyCode || isInstalledWorkerShortcut)) {
    if (qrCompanyCode) localStorage.setItem("swp_worker_company_code", qrCompanyCode);
    const keepMechanic = localStorage.getItem("swp_mechanic_keep_login") === "1";
    if (stored && keepMechanic) {
      try {
        currentWorker = JSON.parse(stored);
        if (isMechanicBossWorker(currentWorker)) {
          openWorkerForm();
          if ("serviceWorker" in navigator) registerAskCreateServiceWorker(true).catch(() => {});
          return;
        }
      } catch {}
    }
    localStorage.removeItem("swp_worker");
    localStorage.removeItem("swp_mechanic_keep_login");
    updateWorkerEntryModeUi();
    show("WorkerLogin");
    applyWorkerCompanyContextFromUrlOrStorage();
    if ("serviceWorker" in navigator) registerAskCreateServiceWorker(true).catch(() => {});
    return;
  }

  if (!clearWorkerSession && stored && !storedCompanyCode) {
    try {
      currentWorker = JSON.parse(stored);
      openWorkerForm();
      return;
    } catch {}
  }

  currentWorker = null;
  show("Home");
  if ("serviceWorker" in navigator) {
    registerAskCreateServiceWorker(true).catch(() => {});
  }
  const installMode = new URLSearchParams(window.location.search || "").get("install") === "1";
  if (installMode && !isAppInstalledMode()) {
    setTimeout(() => installWorkerApp().catch(() => {}), 1200);
  }
}

document.addEventListener("DOMContentLoaded", boot);

// Default: public landing keeps big brand header.
try { setInternalHeader('', '', false); } catch(e) {}


async function submitReturnedCorrectionIfNeeded(reportData) {
  const returnedId = localStorage.getItem("swp_returned_report_id");
  if (!returnedId || !currentWorker) return false;

  let returnedStillExists = null;
  try { returnedStillExists = await getReturnedReportForWorker(returnedId); } catch { returnedStillExists = null; }
  if (!returnedStillExists) {
    clearReturnedReportContext();
    toast("Stari vraćeni izveštaj više nije aktivan. Ovaj unos šaljem kao novi izveštaj.");
    return false;
  }

  const oldType = returnedStillExists?.data?.report_type || returnedStillExists?.data?.reportType || "";
  if (["defect_report", "defect_alert", "defect_record"].includes(oldType) || (reportData.defect || reportData.defect_images_count)) {
    if (oldType && !reportData.report_type) reportData.report_type = oldType;
    mergeCorrectionHistoryForResubmit(reportData, returnedStillExists);
    reportData.visible_to_director = true;
    reportData.visible_to_mechanic_boss = true;
  }

  const { error } = await sb.rpc("worker_resubmit_returned_report", {
    p_company_code: currentWorker.company_code,
    p_access_code: currentWorker.access_code,
    p_report_id: returnedId,
    p_report_date: $("#wrDate").value || today(),
    p_site_id: reportData.site_id || null,
    p_data: reportData
  });

  if (error) {
    if (isStaleReturnedReportError(error)) {
      clearReturnedReportContext();
      toast("Vraćeni izveštaj više nije dostupan. Ovaj unos šaljem kao novi izveštaj.");
      return false;
    }
    throw error;
  }

  clearReturnedReportContext();
  try {
    await prepareWorkerFormForNextReport();
  } catch (resetError) {
    console.warn("AskCreate.app: ispravka je poslata, ali priprema sledeće forme nije uspela:", resetError);
  }
  loadWorkerReturnedReports();
  toast("Ispravljen izveštaj je ponovo poslat Upravi ✅ Forma je spremna za sledeći unos.");
  return true;
}

function copySupportEmail() {
  const email = "duskomacak@gmail.com";
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(email).then(() => showToast("Email podrške je kopiran.")).catch(() => showToast(email));
  } else {
    showToast(email);
  }
}
