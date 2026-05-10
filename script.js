// v1.22.0_UI_CLEANUP - jedno dugme odjave i uklonjena kontrola sistema
/* ASKCREATE.APP by AskCreate - AskCreate.app
   VAŽNO:
   1) SUPABASE_URL je već upisan.
   2) SUPABASE_KEY zameni tvojim Publishable key iz supabase-podaci.txt.
   3) Nikad ne ubacuj Secret key u ovaj fajl.
*/

const SUPABASE_URL = "https://kzwawwrewakjbfhgrbdt.supabase.co";
const SUPABASE_KEY = "sb_publishable_tounvJXNQqJmmkeEfm84Ow_rncVTr3V";
const APP_VERSION = "1.30.9";


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
let directorAutoRefreshTimer = null;
let directorAutoRefreshBusy = false;
let directorKnownReportIds = new Set();

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

function businessUpdateReportsMetrics(list) {
  const reports = Array.isArray(list) ? list : [];
  const pending = reports.filter(r => {
    const status = String(r.status || "").toLowerCase();
    return status && !["approved", "odobreno", "archived", "arhivirano"].includes(status);
  }).length;
  businessSetText("directorMetricPendingReports", String(pending));
  const todayIso = today();
  const todayReports = reports.filter(r => String(r.report_date || "").slice(0, 10) === todayIso);
  const fuel = Math.round(todayReports.reduce((sum, r) => sum + businessCollectFuelLiters(r.data || {}), 0));
  businessSetText("directorMetricFuel", fuel > 0 ? `${fuel} L` : "— L");
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
  document.body.classList.toggle("worker-field-theme", view === "WorkerForm" || view === "MechanicBossPanel");
  document.body.classList.toggle("mechanic-boss-mode", view === "MechanicBossPanel");
  if (view !== "WorkerForm") document.body.classList.remove("worker-desktop-panel");
  if (publicViews.includes(view)) {
    clearCompanyBrandFromBody();
    setInternalHeader("", "", false);
  }

  $$(".view").forEach(v => v.classList.remove("active"));
  const el = $("#view" + view);
  if (el) el.classList.add("active");
  if (view === "WorkerLogin") setTimeout(applyWorkerCompanyContextFromUrlOrStorage, 0);

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
  await Promise.all([loadApprovedCompanies(), loadCompanies()]);
}

let adminApprovedCompaniesCache = [];
let adminRegisteredCompaniesCache = [];

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
  if (!box) return;
  const lockedToCompany = !!(getWorkerCompanyCodeFromUrl() || getSavedWorkerCompanyCode() || document.body.classList.contains("worker-company-locked"));
  // Radnički QR/PWA ulaz treba da ostane čist:
  // pre unosa koda može da stoji samo dugme za instalaciju app-a i polje za kod.
  if (lockedToCompany && !isAppInstalledMode()) {
    box.classList.remove("hidden");
  } else {
    box.classList.add("hidden");
  }
}

async function installWorkerApp() {
  try {
    if (deferredPwaInstallPrompt) {
      deferredPwaInstallPrompt.prompt();
      const choice = await deferredPwaInstallPrompt.userChoice;
      deferredPwaInstallPrompt = null;
      updateWorkerInstallBox();
      if (choice?.outcome === "accepted") return toast("Radnička app prečica je dodata na telefon.");
      return toast("Instalacija nije završena. Možeš probati ponovo iz menija browsera.");
    }
    const ua = navigator.userAgent || "";
    if (/iphone|ipad|ipod/i.test(ua)) {
      return alert("Za iPhone/iPad:\n\n1. Otvori ovaj link u Safari browseru.\n2. Dodirni Share / Podeli.\n3. Izaberi Add to Home Screen / Dodaj na početni ekran.\n\nPosle toga zaposleni otvara ikonicu app-a i vidi samo polje: Unesite svoj kod.");
    }
    alert("Ako se instalacija ne otvori automatski:\n\n1. Otvori meni browsera ⋮\n2. Izaberi Install app ili Add to Home screen\n3. Potvrdi dodavanje prečice.\n\nPosle toga zaposleni otvara ikonicu app-a i vidi samo polje: Unesite svoj kod.");
  } catch (e) {
    toast("Instalacija nije uspela: " + (e?.message || e), true);
  }
}

window.installWorkerApp = installWorkerApp;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPwaInstallPrompt = event;
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
  $("#directorCompanyLabel").textContent = `${data.name} · ${data.company_code} · ${data.status}`;
  businessUpdateCompanyName();
  setInternalHeader("Uprava", "", true);
  show("DirectorDashboard");
  showDirectorPackageNotice(approvedSource || currentCompany);
  showCurrentCompanyLoginInfo();
  await Promise.all([loadPeople(), loadSites(), loadAssets(), loadMaterials(), loadReports()]);
  startDirectorAutoRefresh();
  return data;
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
  ["personFirst", "personLast", "personFunction", "personCode"].forEach(id => {
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
  { key: "view_reports", group: "office", title: "Pregled izveštaja", lines: ["Kancelarijsko ovlašćenje - nije polje u terenskom izveštaju"] },
  { key: "approve_reports", group: "office", title: "Odobravanje izveštaja", lines: ["Kancelarijsko ovlašćenje - odobravanje ili vraćanje izveštaja"] },
  { key: "excel_export", group: "office", title: "Izvoz u Excel", lines: ["Kancelarijsko ovlašćenje - priprema i preuzimanje Excel/CSV izvoza"] },
  { key: "manage_people", group: "office", title: "Upravljanje korisnicima", lines: ["Kancelarijsko ovlašćenje - dodavanje i izmena ljudi u firmi"] },
  { key: "settings", group: "office", title: "Podešavanja firme", lines: ["Kancelarijsko ovlašćenje - osnovna podešavanja firme"] }
];

function getPersonPreviewData() {
  const first = $("#personFirst")?.value.trim() || "Zaposleni";
  const last = $("#personLast")?.value.trim() || "";
  const role = $("#personFunction")?.value.trim() || "terenski radni unos";
  const code = $("#personCode")?.value.trim() || "šifra zaposlenog";
  const selectedKeys = $$(".perm:checked").map(ch => ch.value);
  const materialNames = $$(".material-perm:checked").map(ch => ch.dataset.name || ch.value).filter(Boolean);
  return { first, last, role, code, selectedKeys, materialNames };
}

function renderWorkerPreview(show = true) {
  const card = $("#workerPreviewCard");
  const body = $("#workerPreviewBody");
  if (!card || !body) return;

  const d = getPersonPreviewData();
  const hasAnyFormValue = ["personFirst", "personLast", "personFunction", "personCode"].some(id => ($("#" + id)?.value || "").trim());
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
        <h4>Dobrodošli, ${escapeHtml((d.first + " " + d.last).trim())}</h4>
        <p>${escapeHtml(currentCompany?.name || "Firma")} · ${escapeHtml(d.role)}</p>
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
  ["personFirst", "personLast", "personFunction", "personCode"].forEach(id => {
    const el = $("#" + id);
    if (el) el.addEventListener("input", () => {
      renderWorkerPreview(true);
      if (id === "personCode") schedulePersonCodeAvailabilityCheck();
    });
  });
  document.addEventListener("change", (e) => {
    if (e.target?.classList?.contains("perm") || e.target?.classList?.contains("material-perm")) {
      renderWorkerPreview(true);
    }
  });
  const hideBtn = $("#hideWorkerPreviewBtn");
  if (hideBtn) hideBtn.addEventListener("click", hideWorkerPreview);
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
    $("#personFirst").value = person.first_name || "";
    $("#personLast").value = person.last_name || "";
    $("#personFunction").value = person.function_title || "";
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

    const payload = {
      company_id: currentCompany.id,
      first_name: firstName,
      last_name: lastName,
      function_title: functionTitle,
      access_code: code,
      permissions: collectPermissions(),
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

window.deleteReportPermanently = async (id) => {
  try {
    if (!currentCompany) throw new Error("Nema aktivne firme.");
    if (!confirm("TRAJNO obrisati ovaj izveštaj iz baze?\n\nOvo se ne može vratiti.")) return;

    const { error } = await sb
      .from("reports")
      .delete()
      .eq("id", id)
      .eq("company_id", currentCompany.id);
    if (error) throw error;

    toast("Izveštaj je trajno obrisan iz baze.");
    loadReports();
    if (typeof runDirectorGlobalSearch === "function") runDirectorGlobalSearch(false);
  } catch (e) {
    toast(e.message, true);
  }
};

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
  ["assetCode", "assetName", "assetReg", "assetCapacity"].forEach(id => {
    const el = document.querySelector("#" + id);
    if (el) el.value = "";
  });
  const type = document.querySelector("#assetType");
  if (type) type.value = "machine";
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
    document.querySelector("#assetType").value = asset.asset_type || "machine";
    document.querySelector("#assetReg").value = asset.registration || "";
    document.querySelector("#assetCapacity").value = asset.capacity || "";
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
    const capacity = document.querySelector("#assetCapacity").value.trim();

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
      capacity
    };

    if (editingAssetId) {
      const { error } = await sb
        .from("assets")
        .update(payload)
        .eq("id", editingAssetId)
        .eq("company_id", currentCompany.id);
      if (error) throw error;
      toast("Sredstvo je izmenjeno.");
    } else {
      const { error } = await sb.from("assets").insert(payload);
      if (error) throw error;
      toast("Sredstvo dodato.");
    }

    clearAssetForm();
    loadAssets();
    if (typeof runDirectorGlobalSearch === "function") runDirectorGlobalSearch(false);
  } catch (e) {
    toast(e.message, true);
  }
}

function renderPersonItem(p) {
  const permissionCount = Object.keys(p.permissions || {}).filter(k => p.permissions[k]).length;
  const fullName = `${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)}`;
  return `
    <div class="director-table-row person-card-v1116" data-person-id="${escapeHtml(p.id)}">
      <div class="dt-cell dt-name"><strong>${fullName}</strong><small>Pristupni kod: ${escapeHtml(p.access_code || "—")}</small></div>
      <div class="dt-cell"><span>${escapeHtml(p.function_title || "—")}</span><small>Radno mesto</small></div>
      <div class="dt-cell"><span class="dt-status dt-ok">Aktivan</span><small>${permissionCount} rubrika</small></div>
      <div class="dt-actions person-actions-v1116">
        <button class="edit-btn" type="button" onclick="editPerson('${p.id}')">✏️ Izmeni</button>
        <button class="delete-btn" type="button" onclick="deletePerson('${p.id}')">Deaktiviraj</button>
      </div>
    </div>
  `;
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
  const list = $("#peopleList");
  if (!list) return;
  list.innerHTML = (data || []).map(renderPersonItem).join("") || `<p class="muted">Nema dodatih osoba.</p>`;
}

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
  const activeAssets = (data || []).filter(a => a.active !== false);
  $("#assetsList").innerHTML = activeAssets.map(a => `
    <div class="director-table-row management-item">
      <div class="dt-cell dt-name"><strong>${escapeHtml(formatAssetTitleWithCode(a))}</strong><small>Interni broj / naziv</small></div>
      <div class="dt-cell"><span>${escapeHtml(a.asset_type || "—")}</span><small>Tip sredstva</small></div>
      <div class="dt-cell"><span>${escapeHtml(a.registration || "—")}</span><small>Reg. oznaka</small></div>
      <div class="dt-cell"><span>${escapeHtml(formatCapacityM3(a.capacity))}</span><small>Kapacitet</small></div>
      <div class="dt-actions management-actions asset-actions-v1117">
        <button class="edit-btn" type="button" onclick="editAsset('${a.id}')">✏️ Izmeni</button>
        <button class="delete-btn" type="button" onclick="deleteAsset('${a.id}', '${escapeHtml(a.name || '')}')">Skloni</button>
      </div>
    </div>
  `).join("") || `<p class="muted">Nema mašina/vozila.</p>`;
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
      const text = `${p.first_name} ${p.last_name} ${p.function_title} ${p.access_code} ${p.active ? "aktivan" : "neaktivan"}`;
      if (searchMatch(text, q)) results.push({
        type:"Zaposleni / osoba",
        title:`${p.first_name} ${p.last_name}`,
        subtitle:`${p.function_title} · kod: ${p.access_code} · ${p.active ? "aktivan" : "neaktivan"}`,
        actions:`${p.active ? `<button class="edit-btn" onclick="editPerson('${p.id}')">✏️ Izmeni</button><button class="delete-btn" onclick="deletePerson('${p.id}')">❌ Obriši sa spiska</button>` : `<span class="pill">sklonjeno iz aktivnog spiska</span>`}`
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

function hasDailyReportData(r) {
  // v1.18.5: Uprava ne sme da izgubi prikaz izveštaja zato što filter
  // ne prepoznaje novu rubriku. Sve što nije poseban kvar i nije arhivirano
  // mora ostati vidljivo u Dnevnim izveštajima.
  const d = r?.data || {};
  if (!d || typeof d !== "object") return true;

  const arraysToCheck = [
    d.workers, d.worker_entries, d.machines, d.vehicles,
    d.lowloader_moves, d.lowloader_entries,
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
      .select("id, first_name, last_name, function_title")
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
  directorAutoRefreshBusy = true;
  try {
    await loadReports({ silent: true, auto: true });
  } finally {
    directorAutoRefreshBusy = false;
  }
}

function startDirectorAutoRefresh() {
  stopDirectorAutoRefresh();
  updateDirectorRefreshStatus(`Automatsko osvežavanje uključeno · poslednja provera ${formatRefreshTime()}`);
  directorAutoRefreshTimer = setInterval(directorAutoRefreshTick, 30000);
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
    data = await directorRpcListReports();
  } catch (error) {
    if (silent) console.warn("Automatsko osvežavanje izveštaja preko RPC nije uspelo:", error.message);
    else toast(error.message, true);
    updateDirectorRefreshStatus(`Greška pri osvežavanju · ${formatRefreshTime()}`);
    return;
  }

  directorReportsCache = await enrichReportsWithUsers(data || []);
  updateDirectorKnownReports(directorReportsCache, silent);
  updateDirectorRefreshStatus(`Automatsko osvežavanje uključeno · poslednja provera ${formatRefreshTime()}`);
  businessUpdateReportsMetrics(directorReportsCache);
  const dailyReports = directorReportsCache.filter(r => !isDefectOnlyReport(r) && hasDailyReportData(r));
  $("#reportsList").innerHTML = dailyReports.map(r => reportHtml(r)).join("") || `<p class="muted">Nema dnevnih izveštaja. Ako je zaposleni poslao kvar, pogledaj tab Kvarovi.</p>`;
  renderDefectsList();
  renderDirectorDefectNoticeInReports();
  renderExportPanel();
}


function renderDirectorDefectNoticeInReports() {
  const listBox = $("#reportsList");
  if (!listBox) return;
  const defects = directorReportsCache.filter(hasDefectData);
  if (!defects.length) return;
  const dailyReports = directorReportsCache.filter(r => !isDefectOnlyReport(r) && hasDailyReportData(r));
  const notice = document.createElement("div");
  notice.className = "item report-item defect-alert-notice";
  notice.innerHTML = `<strong>🚨 Ima ${defects.length} prijavljenih kvarova</strong><p class="muted">Kvarovi nisu u listi dnevnih izveštaja. Klikni podtab <b>Kvarovi</b> u ovom ekranu da vidiš prijave kvarova.</p><button class="secondary small-action" type="button" data-business-tab="defects">Otvori kvarove</button>`;
  if (dailyReports.length) listBox.prepend(notice);
  else listBox.innerHTML = notice.outerHTML;
}

function defectHtml(r) {
  const d = r.data || {};
  const person = r.company_users ? `${r.company_users.first_name} ${r.company_users.last_name}` : (d.created_by_worker || "Nepoznat zaposleni");
  const status = d.defect_status || "prijavljen";
  const reportedAt = d.defect_reported_at || r.submitted_at || r.created_at;
  const assetName = [d.defect_asset_code, d.defect_asset_name || d.defect_machine || d.machine || d.vehicle || (Array.isArray(d.machines) && d.machines[0]?.name) || (Array.isArray(d.vehicles) && d.vehicles[0]?.name)].filter(Boolean).join(" · ") || "—";

  return `
    <div class="item report-item defect-item">
      <strong>🚨 KVAR · ${escapeHtml(d.defect_urgency || "prijavljen")}</strong>
      <small>${escapeHtml(person)} · ${escapeHtml(r.company_users?.function_title || d.function_title || "")} · ${escapeHtml(r.report_date || "")}</small><br/>
      <span class="pill">Prijavljeno: ${escapeHtml(formatDateTimeLocal(reportedAt))}</span>
      <span class="pill">Status: ${escapeHtml(status)}</span>
      <span class="pill">Gradilište/lokacija: ${escapeHtml(d.defect_site_name || d.site_name || "bez gradilišta")}</span>
      <span class="pill">Sredstvo: ${escapeHtml(assetName)}</span>
      ${d.defect_work_impact ? `<span class="pill">Uticaj na rad: ${escapeHtml(d.defect_work_impact === "zaustavlja_rad" ? "Zaustavlja rad" : d.defect_work_impact === "moze_nastaviti" ? "Može nastaviti rad" : d.defect_work_impact)}</span>` : ""}
      ${d.called_mechanic_by_phone ? `<span class="pill">Odgovorno lice mehanizacije pozvano: ${escapeHtml(d.called_mechanic_by_phone)}</span>` : ""}
      <p>${escapeHtml(d.defect || "Bez opisa kvara")}</p>
      <div class="report-kv">
        <b>Primljeno</b><span>${escapeHtml(formatDateTimeLocal(d.defect_received_at))}</span>
        <b>Početak popravke</b><span>${escapeHtml(formatDateTimeLocal(d.defect_repair_started_at))}</span>
        <b>Rešeno</b><span>${escapeHtml(formatDateTimeLocal(d.defect_resolved_at))}</span>
      </div>
      <div class="actions">
        <button class="secondary" onclick="setDefectRecordStatus('${r.id}','primljeno')">Primljeno</button>
        <button class="secondary" onclick="setDefectRecordStatus('${r.id}','u_popravci')">U popravci</button>
        <button class="secondary" onclick="setDefectRecordStatus('${r.id}','reseno')">Rešeno</button>
        <button class="secondary" onclick="openReportDocumentCenter('${r.id}')">Otvori dokument</button>
        <button class="archive-report-btn" onclick="archiveReport('${r.id}')">📦 Arhiviraj kvar</button>
      </div>
    </div>`;
}

function renderDefectsList() {
  const box = $("#defectsList");
  if (!box) return;
  const defects = directorReportsCache.filter(hasDefectData);
  box.innerHTML = defects.map(defectHtml).join("") || `<p class="muted">Nema prijavljenih kvarova.</p>`;
}


function renderReportReadableDetails(d = {}, options = {}) {
  const esc = escapeHtml;
  const safe = (x) => (x === undefined || x === null || x === "" ? "" : String(x));
  const val = (x) => safe(x) ? esc(safe(x)) : "<span class='report-empty'>—</span>";
  const rows = (pairs) => pairs.map(([k, v]) => `<b>${esc(k)}</b><span>${val(v)}</span>`).join("");

  const workers = Array.isArray(d.workers) ? d.workers : (Array.isArray(d.worker_entries) ? d.worker_entries : []);
  const machines = Array.isArray(d.machines) ? d.machines : [];
  const vehicles = Array.isArray(d.vehicles) ? d.vehicles : [];
  const lowloaders = Array.isArray(d.lowloader_moves) ? d.lowloader_moves : (Array.isArray(d.lowloader_entries) ? d.lowloader_entries : []);
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

  const maxRows = Math.max(1, workers.length, machines.length, vehicles.length, lowloaders.length, fuels.length, fieldTankers.length, materialEntries.length, previewHasLeave ? 1 : 0, previewHasWarehouse ? 1 : 0)
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
        <td>${val(ll.km_total)}</td>
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
    addPreview("Evidencija rada mašine", row, "MTČ/KM početak", m.start);
    addPreview("Evidencija rada mašine", row, "MTČ/KM kraj", m.end);
    addPreview("Evidencija rada mašine", row, "Ukupno sati", m.hours);
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

  fuels.forEach((f, i) => {
    const row = `Gorivo ${i + 1}`;
    addPreview("Evidencija goriva", row, "Tip sredstva", assetKindLabel(f.asset_kind));
    addPreview("Evidencija goriva", row, "Broj sredstva", f.asset_code);
    addPreview("Evidencija goriva", row, "Sredstvo", f.asset_name || f.machine || f.vehicle || f.other);
    addPreview("Evidencija goriva", row, "Litara", f.liters);
    addPreview("Evidencija goriva", row, "KM", f.km || f.current_km || (f.asset_kind === "vehicle" ? (f.reading || f.mtc_km) : ""));
    addPreview("Evidencija goriva", row, "MTČ", f.mtc || f.current_mtc || (f.asset_kind === "machine" ? (f.reading || f.mtc_km) : ""));
    addPreview("Evidencija goriva", row, "Sipao", f.by);
    addPreview("Evidencija goriva", row, "Primio", f.receiver || d.fuel_receiver);
  });

  fieldTankers.forEach((ft, i) => {
    const row = `Cisterna ${i + 1}`;
    addPreview("Evidencija goriva – cisterna", row, "Gradilište", ft.site_name);
    addPreview("Evidencija goriva – cisterna", row, "Tip sredstva", assetKindLabel(ft.asset_kind));
    addPreview("Evidencija goriva – cisterna", row, "Broj sredstva", ft.asset_code);
    addPreview("Evidencija goriva – cisterna", row, "Sredstvo", ft.asset_name || ft.machine || ft.vehicle || ft.other);
    addPreview("Evidencija goriva – cisterna", row, "KM", ft.km || ft.current_km || (ft.asset_kind === "vehicle" ? (ft.reading || ft.mtc_km) : ""));
    addPreview("Evidencija goriva – cisterna", row, "MTČ", ft.mtc || ft.current_mtc || (ft.asset_kind === "machine" ? (ft.reading || ft.mtc_km) : ""));
    addPreview("Evidencija goriva – cisterna", row, "Litara", ft.liters);
    addPreview("Evidencija goriva – cisterna", row, "Primio gorivo", ft.receiver || ft.received_by);
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
    <table class="report-mini-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Broj</th>
          <th>Mašina</th>
          <th>MTČ/KM početak</th>
          <th>MTČ/KM kraj</th>
          <th>Ukupno sati</th>
          <th>Rad</th>
        </tr>
      </thead>
      <tbody>
        ${machines.map((m, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${val(m.asset_code || m.machine_code)}</td>
            <td>${val(m.name)}</td>
            <td>${val(m.start)}</td>
            <td>${val(m.end)}</td>
            <td>${val(m.hours)}</td>
            <td>${val(m.work)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>` : `<p class="report-empty">Nema unetih mašina.</p>`;

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

  const fuelTable = fuels.length ? `
    <table class="report-mini-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Tip sredstva</th>
          <th>Broj</th>
          <th>Sredstvo</th>
          <th>Litara</th>
          <th>KM</th>
          <th>MTČ</th>
          <th>Sipao</th>
          <th>Primio</th>
        </tr>
      </thead>
      <tbody>
        ${fuels.map((f, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${val(assetKindLabel(f.asset_kind))}</td>
            <td>${val(f.asset_code)}</td>
            <td>${val(f.asset_name || f.machine || f.vehicle || f.other)}</td>
            <td>${val(f.liters)}</td>
            <td>${val(f.km || f.current_km || (f.asset_kind === "vehicle" ? (f.reading || f.mtc_km) : ""))}</td>
            <td>${val(f.mtc || f.current_mtc || (f.asset_kind === "machine" ? (f.reading || f.mtc_km) : ""))}</td>
            <td>${val(f.by)}</td>
            <td>${val(f.receiver || d.fuel_receiver)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>` : `<p class="report-empty">Nema sipanja goriva.</p>`;

  const fieldTankerTable = fieldTankers.length ? `
    <table class="report-mini-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Gradilište</th>
          <th>Tip sredstva</th>
          <th>Broj</th>
          <th>Sredstvo</th>
          <th>KM</th>
          <th>MTČ</th>
          <th>Litara</th>
          <th>Primio gorivo</th>
        </tr>
      </thead>
      <tbody>
        ${fieldTankers.map((ft, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${val(ft.site_name)}</td>
            <td>${val(assetKindLabel(ft.asset_kind))}</td>
            <td>${val(ft.asset_code)}</td>
            <td>${val(ft.asset_name || ft.machine || ft.vehicle || ft.other)}</td>
            <td>${val(ft.km || ft.current_km || (ft.asset_kind === "vehicle" ? (ft.reading || ft.mtc_km) : ""))}</td>
            <td>${val(ft.mtc || ft.current_mtc || (ft.asset_kind === "machine" ? (ft.reading || ft.mtc_km) : ""))}</td>
            <td>${val(ft.liters)}</td>
            <td>${val(ft.receiver || ft.received_by)}</td>
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

  const showDefectSection = options.showDefect === true;
  const hasDefect = showDefectSection && (safe(d.defect) || safe(d.defect_exists) === "da" || safe(d.defect_urgency) || safe(d.defect_status));
  const hasMaterialEntries = materialEntries.some(entry => entry && Object.values(entry).some(v => v !== undefined && v !== null && String(v).trim() !== ""));
  const hasMaterial = hasMaterialEntries || safe(d.material) || safe(d.quantity) || safe(d.unit) || safe(d.warehouse_type) || safe(d.warehouse_item) || safe(d.warehouse_qty);
  const hasLeaveRequest = safe(d.leave_request_type) || safe(d.leave_type) || safe(d.leave_date) || safe(d.leave_from) || safe(d.leave_to) || safe(d.leave_note) || (leaveRequest && Object.values(leaveRequest).some(v => v !== undefined && v !== null && String(v).trim() !== ""));

  const hasUsefulEntry = (entry) => entry && Object.values(entry).some(v => v !== undefined && v !== null && String(v).trim() !== "");
  const hasWorkers = workers.some(hasUsefulEntry);
  const hasMachines = machines.some(hasUsefulEntry);
  const hasVehicles = vehicles.some(hasUsefulEntry);
  const hasLowloaders = lowloaders.some(hasUsefulEntry);
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

      ${hasFuels ? `<div class="report-section">
        <h4>Evidencija goriva</h4>
        ${fuelTable}
      </div>` : ""}

      ${hasFieldTankers ? `<div class="report-section">
        <h4>Evidencija goriva – cisterna</h4>
        ${fieldTankerTable}
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
              ["Status kvara", d.defect_status]
            ])}
          </div>
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

      <details class="report-section report-excel-section report-excel-details">
        <summary>📊 Prikaži Excel pregled izveštaja</summary>
        <p class="field-hint">Ovo je kompaktan Excel pregled ovog izveštaja: sekcija, red, polje i vrednost. Za preuzimanje fajla koristi glavni izvoz u Excel.</p>
        ${excelTable}
      </details>
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
<title>${escapeHtml(title)}</title>
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
  return `
    <section class="report-paper-view document-center-paper" id="${paperIdPrefix}-${r.id}" style="--report-zoom:1">
      <div class="paper-title-block">
        <h3>${escapeHtml(title)}</h3>
        <p>Papirni pregled dnevnog izveštaja za kontrolu, potpis, štampu i arhivu</p>
      </div>

      <table class="paper-meta-table">
        <tbody>
          <tr><th>Datum izveštaja</th><td>${escapeHtml(r.report_date || d.report_date_manual || d.report_date || "—")}</td><th>Status</th><td>${escapeHtml(statusLabel)}</td></tr>
          <tr><th>Gradilište</th><td>${escapeHtml(d.site_name || "—")}</td><th>Vreme slanja</th><td>${escapeHtml(submitted || "—")}</td></tr>
          <tr><th>Zaposleni / odgovorno lice</th><td>${escapeHtml(person)}</td><th>Radno mesto</th><td>${escapeHtml(r.company_users?.function_title || d.function_title || "—")}</td></tr>
          <tr><th>Firma</th><td>${escapeHtml(currentCompany?.company_name || currentCompany?.name || "—")}</td><th>Broj dokumenta</th><td>${escapeHtml(reportDocumentNumber(r))}</td></tr>
        </tbody>
      </table>

      ${r.returned_reason ? `<div class="paper-returned-reason"><b>Razlog vraćanja na ispravku:</b> ${escapeHtml(r.returned_reason)}</div>` : ""}

      ${renderReportReadableDetails(d)}

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
          <p>${escapeHtml(person)} · ${escapeHtml(d.site_name || "Bez gradilišta")} · ${escapeHtml(r.report_date || "")}</p>
        </div>
        <button class="secondary report-doc-close" type="button" onclick="closeReportDocumentCenter()">Nazad</button>
      </header>

      <div class="report-doc-actions no-print">
        <button class="primary" type="button" onclick="saveReportDocumentAsPdf('${r.id}')">Sačuvaj kao PDF</button>
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

window.printReportDocument = function(id) {
  const r = directorReportsCache.find(x => String(x.id) === String(id));
  if (!r) return toast("Izveštaj nije pronađen.", true);
  const html = buildStandaloneReportPrintHtml(r);
  const w = window.open("", "_blank");
  if (!w) return toast("Browser je blokirao novi prozor. Dozvoli pop-up za askcreate.app.", true);
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch(e) {} }, 350);
};

window.saveReportDocumentAsPdf = function(id) {
  // Najstabilnije u browseru/PWA: isti čist A4 prozor, korisnik bira Save as PDF.
  printReportDocument(id);
  toast("U prozoru za štampu izaberi: Destination/Odredište → Save as PDF.");
};

window.addReportToExcelSelection = function(id) {
  toggleReportExportSelection(id, true);
  const cb = Array.from(document.querySelectorAll(".report-export-check")).find(x => String(x.dataset.reportId || "") === String(id));
  if (cb) cb.checked = true;
  renderExportPanel();
  toast("Izveštaj je dodat u Excel izbor.");
};

window.exportSingleReportToExcel = function(id) {
  const r = directorReportsCache.find(x => String(x.id) === String(id));
  if (!r) return toast("Izveštaj nije pronađen.", true);
  const settings = { type: "all", from: "", to: "", site: "", worker: "", item: "" };
  const rows = getSmartRowsForReport(r, settings);
  if (!rows.length) return toast("Ovaj izveštaj nema redove za Excel export.", true);
  const columns = EXPORT_COLUMNS.filter(c => rows.some(row => String(row[c.key] ?? "").trim() !== "") || ["date","worker","function","site","status"].includes(c.key));
  const head = `<tr>${columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join("")}</tr>`;
  const body = rows.map((row, index) => `<tr class="${index % 2 ? "even" : "odd"}">${columns.map(c => `<td>${escapeHtml(excelCellText(row[c.key]))}</td>`).join("")}</tr>`).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <style>body{font-family:Arial,Helvetica,sans-serif;color:#111827;}table{border-collapse:collapse;width:100%;font-size:12px;}th{background:#0f7a3b;color:#fff;font-weight:700;border:1px solid #0b5f2e;padding:8px 10px;text-align:left;white-space:nowrap;}td{border:1px solid #cfd8dc;padding:7px 9px;vertical-align:top;mso-number-format:"\\@";}tr.even td{background:#f6fbf7;}</style>
  </head><body><h3>${escapeHtml(reportDocumentTitle(r))}</h3><p>Firma: ${escapeHtml(currentCompanyExportName())}</p><table>${head}${body}</table></body></html>`;
  const blob = new Blob(["﻿" + html], {type:"application/vnd.ms-excel;charset=utf-8"});
  const name = safeFilePart(`${reportDocumentTitle(r)}_${r.report_date || today()}_${(r.data || {}).site_name || "izvestaj"}`) + ".xls";
  downloadBlob(blob, name);
  toast("Excel fajl za ovaj izveštaj je preuzet.");
};

function reportHtml(r) {
  const d = r.data || {};
  const person = reportDocumentPerson(r);
  const title = reportDocumentTitle(r);
  const checked = getExportSelectedIds().includes(r.id) ? "checked" : "";
  const sections = getReportFilledSections(d);
  const sectionsHtml = sections.slice(0, 6).map(x => `<span class="pill report-section-pill">${escapeHtml(x)}</span>`).join("") + (sections.length > 6 ? `<span class="pill report-section-pill">+${sections.length - 6}</span>` : "");
  const submitted = formatDateTimeLocal(r.submitted_at || r.created_at);
  const statusText = r.status || "novo";
  const statusLabel = reportStatusLabel(statusText);

  return `
    <article class="report-row-item report-document-card">
      <div class="report-list-grid">
        <label class="export-select-row report-export-cell" title="Izaberi izveštaj za Excel export">
          <input type="checkbox" class="report-export-check" data-report-id="${escapeHtml(r.id)}" ${checked} onchange="toggleReportExportSelection('${r.id}', this.checked)" />
        </label>
        <div class="report-list-date">
          <strong>${escapeHtml(r.report_date || "")}</strong>
          <small>${escapeHtml(submitted || "")}</small>
        </div>
        <div class="report-list-site">
          <strong>${escapeHtml(d.site_name || "Bez gradilišta")}</strong>
          <small>${escapeHtml(title)}</small>
        </div>
        <div class="report-list-worker">
          <strong>${escapeHtml(person)}</strong>
          <small>${escapeHtml(r.company_users?.function_title || d.function_title || "")}</small>
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
  if (!confirm("Arhivirati izveštaj?\n\nIzveštaj ostaje u bazi, ali se sklanja iz aktivne liste.")) return;
  try {
    await directorRpcArchiveReport(id);
  } catch (error) {
    return toast(error.message || String(error), true);
  }
  toast("Izveštaj je arhiviran. Podaci ostaju sačuvani u bazi.");
  closeReportDocumentCenter?.();
  loadReports();
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

window.setDefectRecordStatus = async (id, newStatus) => {
  const { data: row, error: readError } = await sb.from("reports").select("data").eq("id", id).eq("company_id", currentCompany.id).maybeSingle();
  if (readError) return toast(readError.message, true);
  const d = row?.data || {};
  d.defect_status = newStatus;
  if (newStatus === "primljeno") d.defect_received_at = new Date().toISOString();
  if (newStatus === "u_popravci") d.defect_repair_started_at = new Date().toISOString();
  if (newStatus === "reseno") d.defect_resolved_at = new Date().toISOString();
  const { error } = await sb.from("reports").update({ data: d }).eq("id", id).eq("company_id", currentCompany.id);
  if (error) return toast(error.message, true);
  toast("Status kvara promenjen.");
  loadReports();
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
  const list = $("#defectSiteList");
  if (!list) return;
  list.innerHTML = buildLowloaderSiteDatalistOptionsHtml();
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
  result.textContent = "Upiši broj vozila, tablice ili naziv ako nije na listi.";
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

function updateVehicleCubic(entryEl) {
  const selected = getSelectedVehicleFromEntry(entryEl);
  const tours = entryEl.querySelector(".v-tours")?.value || "";
  const auto = calculateVehicleCubic(selected.capacity, tours);
  const autoEl = entryEl.querySelector(".v-cubic-auto");
  if (autoEl) autoEl.value = auto;
  const hint = entryEl.querySelector(".v-cubic-hint");
  if (hint) {
    hint.textContent = auto
      ? `Automatski: ${selected.capacity || 0} m³ × ${tours || 0} tura = ${auto} m³`
      : "Ako vozilo ima kapacitet i upišeš broj tura, aplikacija računa m³ automatski.";
  }
}

function addVehicleEntry(values = {}) {
  const list = $("#vehicleEntries");
  if (!list) return;
  const idx = list.querySelectorAll(".vehicle-entry").length + 1;
  const selectedName = values.name || values.vehicle || values.asset_id || "";
  const initialSearch = values.asset_code || values.vehicle_code || values.code || values.custom || values.vehicle_custom || selectedName || values.registration || "";
  const div = document.createElement("div");
  div.className = "entry-card vehicle-entry";
  div.innerHTML = `
    <div class="entry-card-head">
      <strong>Vozilo ${idx}</strong>
      <button type="button" class="remove-entry">Ukloni</button>
    </div>

    <label>Vozilo / interni broj</label>
    <input class="v-search asset-code-search smart-asset-input" placeholder="upiši broj, tablice ili naziv vozila, npr. 2 ili KAM-05" value="${escapeHtml(initialSearch)}" />
    <div class="asset-smart-result v-picked">Upiši broj vozila, tablice ili naziv ako nije na listi.</div>
    <button class="secondary small-btn refresh-vehicle-assets" type="button">Osveži vozila iz Uprave</button>

    <select class="v-name hidden-asset-select" aria-hidden="true" tabindex="-1">${buildVehicleOptionsHtml(selectedName)}</select>
    <input class="v-custom hidden-asset-custom" aria-hidden="true" tabindex="-1" value="${escapeHtml(values.custom || values.vehicle_custom || "")}" />

    <div class="mini-grid">
      <div>
        <label>KM početak</label>
        <input class="v-km-start" type="number" step="1" value="${escapeHtml(values.km_start || values.start || "")}" />
      </div>
      <div>
        <label>KM kraj</label>
        <input class="v-km-end" type="number" step="1" value="${escapeHtml(values.km_end || values.end || "")}" />
      </div>
    </div>

    <label>Relacija</label>
    <input class="v-route" placeholder="Od - do" value="${escapeHtml(values.route || "")}" />

    <div class="mini-grid">
      <div>
        <label>Broj izvršenih tura</label>
        <input class="v-tours" type="number" step="0.5" value="${escapeHtml(values.tours || "")}" />
      </div>
      <div>
        <label>Automatski m³</label>
        <input class="v-cubic-auto" type="number" step="0.01" readonly value="${escapeHtml(values.cubic_auto || values.cubic_m3 || "")}" />
      </div>
    </div>
    <p class="field-hint v-cubic-hint">Ako vozilo ima kapacitet i upišeš broj tura, aplikacija računa m³ automatski.</p>
  `;

  div.querySelector(".remove-entry").addEventListener("click", () => {
    div.remove();
    refreshFuelMachineOptions();
  });
  div.querySelector(".v-search").addEventListener("input", () => {
    refreshOneVehicleSelect(div);
    updateVehicleCubic(div);
  });
  div.querySelector(".v-name").addEventListener("change", () => {
    updateVehicleCubic(div);
    refreshFuelMachineOptions();
  });
  div.querySelector(".v-custom").addEventListener("input", refreshFuelMachineOptions);
  div.querySelector(".v-tours").addEventListener("input", () => updateVehicleCubic(div));
  const refreshVehiclesBtn = div.querySelector(".refresh-vehicle-assets");
  if (refreshVehiclesBtn) refreshVehiclesBtn.addEventListener("click", async () => {
    try {
      refreshVehiclesBtn.disabled = true;
      refreshVehiclesBtn.textContent = "Učitavam...";
      await loadWorkerAssets();
      refreshOneVehicleSelect(div);
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
  updateVehicleCubic(div);
  refreshFuelMachineOptions();
}

function getVehicleEntries() {
  return $$("#vehicleEntries .vehicle-entry").map((el, i) => {
    const selected = getSelectedVehicleFromEntry(el);
    const tours = el.querySelector(".v-tours")?.value || "";
    const autoCubic = calculateVehicleCubic(selected.capacity, tours);
    const manualCubic = "";
    const finalCubic = autoCubic;
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
      km_start: el.querySelector(".v-km-start")?.value || "",
      km_end: el.querySelector(".v-km-end")?.value || "",
      route: el.querySelector(".v-route")?.value.trim() || "",
      tours,
      cubic_auto: autoCubic,
      cubic_manual: manualCubic,
      cubic_m3: finalCubic
    };
  }).filter(v => v.name || v.km_start || v.km_end || v.route || v.tours || v.cubic_m3);
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

function workerSetSections(perms) {
  // v1.16.5 pravilo:
  // "Gradilište i datum izveštaja" kod zaposlenog prikazuje samo Datum/godinu + Gradilište iz liste Uprave.
  // Opis rada i sati rada više se ne otvaraju pod ovom rubrikom.
  const dailyAllowed = !!(perms.daily_work || perms.daily_work_site);

  const dailySection = $("#secDailyWork");
  if (dailySection) {
    dailySection.classList.remove("active");
    dailySection.classList.add("hidden-by-rule");
  }

  const siteSection = $("#secWorkerSite");
  if (siteSection) siteSection.classList.toggle("active", dailyAllowed);

  const map = {
    workers: "#secWorkers",
    machines: "#secMachines",
    vehicles: "#secVehicles",
    lowloader: "#secLowloader",
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
    if (el) el.classList.toggle("active", !!perms[key]);
  });
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

    <div class="mini-grid">
      <div>
        <label>Početni sati / MTČ</label>
        <input class="m-start numeric-text" type="text" inputmode="decimal" placeholder="npr. 1250.5" value="${escapeHtml(values.start || "")}" />
      </div>
      <div>
        <label>Završni sati / MTČ</label>
        <input class="m-end numeric-text" type="text" inputmode="decimal" placeholder="npr. 1258.5" value="${escapeHtml(values.end || "")}" />
      </div>
    </div>

    <label>Ukupno sati rada</label>
    <input class="m-hours numeric-text" type="text" inputmode="decimal" placeholder="automatski ili upiši" value="${escapeHtml(values.hours || "")}" />

    <label>Opis rada za ovu mašinu</label>
    <input class="m-work" placeholder="iskop, utovar, ravnanje..." value="${escapeHtml(values.work || "")}" />
  `;

  const startEl = div.querySelector(".m-start");
  const endEl = div.querySelector(".m-end");
  const hoursEl = div.querySelector(".m-hours");

  function calcHours() {
    const s = parseFloat(String(startEl.value || "").replace(",", "."));
    const e = parseFloat(String(endEl.value || "").replace(",", "."));
    if (!Number.isNaN(s) && !Number.isNaN(e) && e >= s) {
      hoursEl.value = (Math.round((e - s) * 10) / 10).toString();
    }
  }

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
    return {
      no: i + 1,
      asset_id: custom ? null : (option?.dataset?.assetId || null),
      asset_code: custom ? "" : (option?.dataset?.assetCode || ""),
      machine_code: custom ? "" : (option?.dataset?.assetCode || ""),
      name: custom || selected,
      machine_custom: custom,
      start: el.querySelector(".m-start")?.value || "",
      end: el.querySelector(".m-end")?.value || "",
      hours: el.querySelector(".m-hours")?.value || "",
      work: el.querySelector(".m-work")?.value.trim() || ""
    };
  }).filter(m => m.name || m.start || m.end || m.hours || m.work);
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
  const idx = list.querySelectorAll(".field-tanker-entry").length + 1;
  const selectedSite = values.site_name || values.site || "";
  const selectedAsset = values.asset_name || values.machine || values.vehicle || "";
  const kind = values.asset_kind || values.asset_type || values.kind || (values.other ? "other" : (values.vehicle ? "vehicle" : "machine"));
  const oldReading = values.reading || values.mtc_km || "";
  const kmValue = values.km || values.current_km || values.kilometers || values.odometer || (kind === "vehicle" ? oldReading : "");
  const mtcValue = values.mtc || values.current_mtc || values.machine_mtc || (kind === "machine" ? oldReading : "");
  const manualAsset = values.asset_custom || values.manual_asset || values.machine_custom || values.vehicle_custom || "";
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

    <label>Vrsta sredstva</label>
    <select class="ft-asset-kind">
      <option value="machine" ${kind === "machine" ? "selected" : ""}>Mašina</option>
      <option value="vehicle" ${kind === "vehicle" ? "selected" : ""}>Vozilo</option>
      <option value="other" ${kind === "other" ? "selected" : ""}>Oprema / ostalo</option>
    </select>

    <label>Sredstvo / interni broj</label>
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
  div.querySelector(".ft-asset-kind")?.addEventListener("change", refreshThisFieldTankerAssetSelect);
  div.querySelector(".ft-asset-search")?.addEventListener("input", refreshThisFieldTankerAssetSelect);
  list.appendChild(div);
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
  return $$("#fieldTankerEntries .field-tanker-entry").map((el, i) => {
    const siteSelect = el.querySelector(".ft-site-select");
    const siteOption = siteSelect?.options ? siteSelect.options[siteSelect.selectedIndex] : null;
    const manualSite = el.querySelector(".ft-site-custom")?.value.trim() || "";
    const site = manualSite || (siteSelect?.value || "").trim();
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
      site_id: manualSite ? null : (siteOption?.dataset?.siteId || null),
      site_name: site,
      site_custom: manualSite,
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
  }).filter(x => x.site_name || x.asset_name || x.km || x.mtc || x.reading || x.liters || x.receiver);
}


function getFieldTankerMemoryKey() {
  const worker = currentWorker || JSON.parse(localStorage.getItem("swp_worker") || "null");
  const companyPart = worker?.company_id || worker?.company_code || "no_company";
  const userPart = worker?.user_id || worker?.id || worker?.access_code || "no_worker";
  return `swp_field_tanker_memory_${companyPart}_${userPart}`;
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
  if (!entry.asset_name) return "Cisterna goriva: upiši interni broj, naziv ili tablice sredstva koje je tankovano.";
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
    function_title: currentWorker?.function_title || "",
    description: "Memorisana sipanja goriva cisternom poslata kao jedan dnevni izveštaj."
  };
}

async function sendStoredFieldTankerEntries() {
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
    renderStoredFieldTankerEntries();
    if ($("#fieldTankerEntries")) {
      $("#fieldTankerEntries").innerHTML = "";
      addFieldTankerEntry();
    }
    toast(`Sva memorisana sipanja su poslata Upravi ✅ (${entries.length})`);
  } catch(e) {
    toast(e.message, true);
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

    <p class="hint">Za vozilo upiši KM. Za mašinu ili ostalu opremu upiši MTČ ako postoji. Primalac goriva je automatski prijavljeni zaposleni koji šalje izveštaj.</p>
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
    if (d.report_type === "site_daily_log") {
      loadSiteLogDataIntoForm(d, r);
      localStorage.setItem("swp_returned_report_id", reportId);
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
      wrDefectAssetName:"defect_asset_code",
      wrDefectSiteName:"defect_site_name",
      wrDefect:"defect",
      wrDefectStopsWork:"defect_work_impact",
      wrDefectUrgency:"defect_urgency",
      wrDefectCalledMechanic:"called_mechanic_by_phone", wrSignatureName:"signature_name",}).forEach(([id,key]) => {
      const el = $("#" + id);
      if (el) el.value = d[key] || "";
    });

    localStorage.setItem("swp_returned_report_id", reportId);
    toast("Izveštaj je otvoren. Ispravi ga i pošalji ponovo Upravi.");
    window.scrollTo({ top: 0, behavior: "smooth" });
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
  } catch {}
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
  const machines = perms.machines ? getMachineEntries() : [];
  const vehicles = perms.vehicles ? getVehicleEntries() : [];
  const fuelEntries = perms.fuel ? getFuelEntries() : [];
  const selectedSite = getSelectedWorkerSite();
  const canDaily = !!(perms.daily_work || perms.daily_work_site);
  const canWorkers = !!perms.workers;
  const canMaterials = !!perms.materials;
  const canSignature = !!perms.signature;
  const canLeaveRequest = !!perms.leave_request;
  const canWarehouse = !!perms.warehouse;
  const canDefects = !!perms.defects;
  const canLowloader = !!perms.lowloader;
  const canFieldTanker = !!perms.field_tanker;
  const lowloaderMoves = canLowloader ? getLowloaderEntries() : [];
  const fieldTankerEntries = canFieldTanker ? getFieldTankerEntries() : [];
  const materialEntries = canMaterials ? getMaterialEntries() : [];
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
  const leaveFallbackSiteName = canLeaveRequest && hasLeaveRequestData(leaveRequest) ? "Zahtev za odsustvo / godišnji odmor" : "";
  const firstFieldTankerEntry = fieldTankerEntries.find(x => x.site_name || x.site_id) || null;
  const fieldTankerFallbackSiteName = firstFieldTankerEntry ? (firstFieldTankerEntry.site_name || "Evidencija goriva – cisterna") : "";
  const reportSiteName = selectedSite.site_name || (canLowloader && lowloaderMoves.length ? lowloaderFallbackSiteName : "") || (canFieldTanker && fieldTankerEntries.length ? fieldTankerFallbackSiteName : "") || leaveFallbackSiteName;
  const reportSiteId = selectedSite.site_id || firstFieldTankerEntry?.site_id || null;

  const reportSectionsSent = {
    workers: canWorkers && getWorkerEntries().length > 0,
    machines: machines.length > 0,
    vehicles: vehicles.length > 0,
    lowloader: lowloaderMoves.length > 0,
    field_tanker: fieldTankerEntries.length > 0,
    fuel: fuelEntries.length > 0,
    materials: materialEntries.length > 0,
    signature: !!(canSignature && getSignatureData().signature_data_url),
    leave_request: !!(canLeaveRequest && hasLeaveRequestData(leaveRequest)),
    warehouse: !!(canWarehouse && (($("#wrWarehouseItem")?.value || "").trim() || ($("#wrWarehouseQty")?.value || "").trim())),
    defects: !!(canDefects && (($("#wrDefect")?.value || "").trim() || ($("#wrDefectAssetName")?.value || "").trim()))
  };

  return {
    report_sections_sent: reportSectionsSent,
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
    field_tanker_entries: fieldTankerEntries,
    tanker_fuel_entries: fieldTankerEntries,
    fuel_entries: fuelEntries,

    // Summary fields for older report/CSV display
    machine: machines.map(m => m.name).filter(Boolean).join(" | "),
    mtc_start: machines.map(m => m.start).filter(Boolean).join(" | "),
    mtc_end: machines.map(m => m.end).filter(Boolean).join(" | "),
    machine_hours: machines.map(m => m.hours).filter(Boolean).join(" | "),
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
    called_mechanic_by_phone: canDefects ? ($("#wrDefectCalledMechanic")?.value || "") : ""
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
  if ($("#fieldTankerEntries")) $("#fieldTankerEntries").innerHTML = "";
  if ($("#materialEntries")) $("#materialEntries").innerHTML = "";
  localStorage.removeItem("swp_draft");
  localStorage.removeItem("swp_returned_report_id");
  clearSignatureCanvas(false);
}

function ensureWorkerDefaultEntries() {
  const perms = currentWorker?.permissions || {};

  // Ne pozivati ovu funkciju samu iz sebe. To je pravilo ranije pravilo
  // beskonačnu petlju posle slanja izveštaja i zaposleni je dobijao grešku
  // iako je RPC slanje možda već prošlo.
  if (perms.workers && $("#workerEntries") && !$("#workerEntries").children.length) addWorkerEntry();
  if (perms.machines && $("#machineEntries") && !$("#machineEntries").children.length) addMachineEntry();
  if (perms.vehicles && $("#vehicleEntries") && !$("#vehicleEntries").children.length) addVehicleEntry();
  if (perms.lowloader && $("#lowloaderEntries") && !$("#lowloaderEntries").children.length) addLowloaderEntry();
  if (perms.fuel && $("#fuelEntries") && !$("#fuelEntries").children.length) addFuelEntry();
  if (perms.field_tanker && $("#fieldTankerEntries") && !$("#fieldTankerEntries").children.length) addFieldTankerEntry();
  if (perms.materials && $("#materialEntries") && !$("#materialEntries").children.length) addMaterialEntry();

  refreshMachineDatalists();
  refreshVehicleSelects();
  refreshFuelMachineOptions();
  refreshFieldTankerSelectors();
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
    const assetSearch = card.querySelector(".ft-asset-search");
    const km = card.querySelector(".ft-km");
    const mtc = card.querySelector(".ft-mtc");
    const liters = card.querySelector(".ft-liters");
    const receiver = card.querySelector(".ft-receiver");
    const siteValue = (siteCustom?.value || "").trim() || (siteSelect?.value || "").trim();
    const assetValue = (assetSearch?.value || "").trim();
    if (!siteValue) return { section: "#secFieldTanker", entry: card, field: siteSelect || siteCustom, message: `Cisterna goriva ${n}: izaberi ili upiši gradilište/lokaciju.` };
    if (!assetValue) return { section: "#secFieldTanker", entry: card, field: assetSearch, message: `Cisterna goriva ${n}: upiši interni broj, naziv ili tablice sredstva koje je tankovano.` };
    const kmValue = (km?.value || "").trim();
    const mtcValue = (mtc?.value || "").trim();
    if (!kmValue && !mtcValue) return { section: "#secFieldTanker", entry: card, field: km || mtc, message: `Cisterna goriva ${n}: upiši KM ili MTČ. Dovoljno je jedno od ta dva polja — vozilo obično KM, mašina obično MTČ.` };
    if (!(liters?.value || "").trim()) return { section: "#secFieldTanker", entry: card, field: liters, message: `Cisterna goriva ${n}: upiši koliko litara je sipano.` };
    if (!(receiver?.value || "").trim()) return { section: "#secFieldTanker", entry: card, field: receiver, message: `Cisterna goriva ${n}: upiši ime osobe koja je primila gorivo.` };
  }
  return null;
}

function validateWorkerReportBeforeSubmit(data) {
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

    if ($("#wrLeaveType")) $("#wrLeaveType").value = "slobodan_dan";
  updateLeaveRequestVisibility();
  if ($("#workerEntries")) $("#workerEntries").innerHTML = "";
    if ($("#machineEntries")) $("#machineEntries").innerHTML = "";
    if ($("#vehicleEntries")) $("#vehicleEntries").innerHTML = "";
    if ($("#fuelEntries")) $("#fuelEntries").innerHTML = "";
    if ($("#lowloaderEntries")) $("#lowloaderEntries").innerHTML = "";
    if ($("#fieldTankerEntries")) $("#fieldTankerEntries").innerHTML = "";
    if ($("#materialEntries")) $("#materialEntries").innerHTML = "";
    (d.workers || d.worker_entries || []).forEach(w => addWorkerEntry(w));
    (d.machines || []).forEach(m => addMachineEntry(m));
    (d.vehicles || []).forEach(v => addVehicleEntry(v));
    (d.lowloader_moves || d.lowloader_entries || []).forEach(x => addLowloaderEntry(x));
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
    updateLeaveRequestVisibility();
  } catch {}
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function formatCapacityM3(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/m\s*(³|3)|kub|kubic/i.test(raw)) return raw;
  return `${raw} m³`;
}



let lastWorkerUiAuditText = "";

const WORKER_UI_PERMISSION_MAP = {
  daily_work: { label: "Gradilište i datum izveštaja", window: "Osnovno: gradilište i datum", worker: true },
  workers: { label: "Evidencija zaposlenih na gradilištu", window: "Evidencija zaposlenih na gradilištu", worker: true },
  machines: { label: "Rad sa mašinom", window: "Evidencija rada mašine", worker: true },
  vehicles: { label: "Rad vozila / kamiona", window: "Vozilo / ture / m³", worker: true },
  lowloader: { label: "Transport mašine labudicom", window: "Labudica / prevoz mašine", worker: true },
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
  const cleaned = String(value ?? "").trim().replace(/\s/g, "").replace(",", ".");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function preventNumberInputScrollChanges(root = document) {
  // Zaposleni na terenu često skroluje preko forme. Native input[type=number]
  // u Chrome/Edge može sam da promeni vrednost (npr. 4,5 -> 4,51) preko
  // točkića/trackpad-a ili strelica. Zato sva numerička polja zaključavamo
  // kao tekstualni unos sa decimalnom tastaturom. Parsiranje već podržava
  // i zarez i tačku preko parseDecimalInput().
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
  { key:"function", label:"Radno mesto" },
  { key:"site", label:"Gradilište" },
  { key:"hours", label:"Ukupno sati rada" },
  { key:"description", label:"Šta je rađeno" },
  { key:"crew_worker", label:"Ime zaposlenog na gradilištu" },
  { key:"crew_hours", label:"Sati tog zaposlenog" },
  { key:"machine_code", label:"Broj mašine" },
  { key:"machine", label:"Mašina" },
  { key:"machine_start", label:"Početno stanje MTČ/KM" },
  { key:"machine_end", label:"Krajnje stanje MTČ/KM" },
  { key:"machine_hours", label:"Ukupno sati mašine" },
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
  { key:"fuel_type", label:"Kategorija sredstva" },
  { key:"fuel_asset_code", label:"Broj sredstva" },
  { key:"fuel_for", label:"Naziv sredstva" },
  { key:"fuel_registration", label:"Registracija" },
  { key:"fuel_liters", label:"Litara" },
  { key:"fuel_km", label:"KM" },
  { key:"fuel_mtc", label:"MTČ" },
  { key:"fuel_by", label:"Gorivo sipao" },
  { key:"fuel_receiver", label:"Primio gorivo" },
  { key:"field_tanker_site", label:"Gradilište gde je sipano gorivo" },
  { key:"field_tanker_type", label:"Kategorija tankovanog sredstva" },
  { key:"field_tanker_asset_code", label:"Broj tankovanog sredstva" },
  { key:"field_tanker_asset", label:"Naziv tankovanog sredstva" },
  { key:"field_tanker_registration", label:"Registracija" },
  { key:"field_tanker_km", label:"KM pri tankovanju cisternom" },
  { key:"field_tanker_mtc", label:"MTČ pri tankovanju cisternom" },
  { key:"field_tanker_liters", label:"Litara iz cisterne" },
  { key:"field_tanker_receiver", label:"Primio gorivo iz cisterne" },
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
  "defect", "status"
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
    keys: ["machine_code", "machine", "machine_start", "machine_end", "machine_hours", "machine_work"]
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
    keys: ["fuel_type", "fuel_asset_code", "fuel_for", "fuel_registration", "fuel_liters", "fuel_km", "fuel_mtc", "fuel_by", "fuel_receiver"]
  },
  {
    id: "lowloader",
    title: "Transport mašine labudicom",
    hint: "Selidba mašine sa jedne lokacije na drugu.",
    keys: ["lowloader_plates", "lowloader_from", "lowloader_to", "lowloader_km_start", "lowloader_km_end", "lowloader_km", "lowloader_machine", "lowloader_tools"]
  },
  {
    id: "fieldTanker",
    title: "Evidencija goriva – cisterna",
    hint: "Cisterna koja na terenu sipa gorivo drugim mašinama/vozilima.",
    keys: ["field_tanker_site", "field_tanker_type", "field_tanker_asset_code", "field_tanker_asset", "field_tanker_registration", "field_tanker_km", "field_tanker_mtc", "field_tanker_liters", "field_tanker_receiver"]
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
  const lowloaders = Array.isArray(d.lowloader_moves) ? d.lowloader_moves : (Array.isArray(d.lowloader_entries) ? d.lowloader_entries : []);
  const fuels = Array.isArray(d.fuel_entries) ? d.fuel_entries : [];
  const fieldTankers = Array.isArray(d.field_tanker_entries) ? d.field_tanker_entries : (Array.isArray(d.tanker_fuel_entries) ? d.tanker_fuel_entries : []);
  const materials = Array.isArray(d.material_entries) ? d.material_entries : (Array.isArray(d.material_movements) ? d.material_movements : (Array.isArray(d.materials) ? d.materials : []));
  const leaveRequest = d.leave_request || {};
  const rows = [];

  const base = {
    date: r.report_date || "",
    worker: reportPersonName(r),
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
    machine_start: m.start || "",
    machine_end: m.end || "",
    machine_hours: m.hours || "",
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
    lowloader_km: ll.km_total || "",
    lowloader_machine: ll.machine || "",
    lowloader_tools: ll.accompanying_tools || ll.tools || ""
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
    fuel_receiver: f.receiver || d.fuel_receiver || ""
  }));

  fieldTankers.forEach(ft => pushRow({
    field_tanker_site: ft.site_name || "",
    field_tanker_type: assetKindLabel(ft.asset_kind),
    field_tanker_asset_code: ft.asset_code || "",
    field_tanker_asset: ft.asset_name || ft.machine || ft.vehicle || ft.other || ft.manual_asset_name || "",
    field_tanker_registration: ft.asset_registration || ft.registration || "",
    field_tanker_km: ft.km || ft.current_km || (ft.asset_kind === "vehicle" ? (ft.reading || ft.mtc_km) : ""),
    field_tanker_mtc: ft.mtc || ft.current_mtc || (ft.asset_kind === "machine" ? (ft.reading || ft.mtc_km) : ""),
    field_tanker_liters: ft.liters || "",
    field_tanker_receiver: ft.receiver || ft.received_by || ""
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
    keys: ["date","worker","site","fuel_type","fuel_asset_code","fuel_for","fuel_registration","fuel_liters","fuel_km","fuel_mtc","fuel_by","fuel_receiver","field_tanker_site","field_tanker_type","field_tanker_asset_code","field_tanker_asset","field_tanker_registration","field_tanker_km","field_tanker_mtc","field_tanker_liters","field_tanker_receiver","status"]
  },
  fuel_own: {
    title: "Evidencija goriva – korisnik/vozilo/opremu",
    keys: ["date","worker","site","fuel_type","fuel_asset_code","fuel_for","fuel_registration","fuel_liters","fuel_km","fuel_mtc","fuel_by","fuel_receiver","status"]
  },
  fuel_tanker: {
    title: "Evidencija goriva – cisterna",
    keys: ["date","worker","site","field_tanker_site","field_tanker_type","field_tanker_asset_code","field_tanker_asset","field_tanker_registration","field_tanker_km","field_tanker_mtc","field_tanker_liters","field_tanker_receiver","status"]
  },
  hours_workers: {
    title: "Radni sati zaposlenog",
    keys: ["date","site","worker","function","hours","description","crew_worker","crew_hours","status"]
  },
  machines: {
    title: "Rad mašina / MTČ",
    keys: ["date","site","worker","machine_code","machine","machine_start","machine_end","machine_hours","machine_work","status"]
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
  } else if (type === "fuel_all" || type === "fuel_own" || type === "fuel_tanker" || type === "lowloader") {
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
    const siteText = normalizeSearch([d.site_name, d.site, r.site_name].filter(Boolean).join(" "));
    if (!siteText.includes(siteQ)) return false;
  }
  const workerQ = normalizeSearch(settings.worker || "");
  if (workerQ) {
    const workerText = normalizeSearch([
      reportPersonName(r),
      r.company_users?.first_name,
      r.company_users?.last_name,
      r.company_users?.function_title,
      d.created_by_worker,
      d.worker_name,
      d.access_code,
      d.worker_code
    ].filter(Boolean).join(" "));
    if (!workerText.includes(workerQ)) return false;
  }
  return true;
}

function baseExportRow(r) {
  const d = r.data || {};
  return {
    date: r.report_date || "",
    worker: reportPersonName(r),
    function: r.company_users?.function_title || "",
    site: d.site_name || "",
    hours: d.hours || "",
    description: d.description || "",
    status: r.status || "",
    note: d.note || ""
  };
}

function smartRowsForReport(r, type) {
  if (!type || type === "all") return flattenReportRowsForExport(r);
  const d = r.data || {};
  const base = baseExportRow(r);
  const rows = [];
  const workers = Array.isArray(d.workers) ? d.workers : (Array.isArray(d.worker_entries) ? d.worker_entries : []);
  const machines = Array.isArray(d.machines) ? d.machines : [];
  const vehicles = Array.isArray(d.vehicles) ? d.vehicles : [];
  const lowloaders = Array.isArray(d.lowloader_moves) ? d.lowloader_moves : (Array.isArray(d.lowloader_entries) ? d.lowloader_entries : []);
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
      fuel_receiver: f.receiver || d.fuel_receiver || ""
    }));
  }

  if (type === "fuel_all" || type === "fuel_tanker") {
    fieldTankers.forEach(ft => rows.push({
      ...base,
      field_tanker_site: ft.site_name || d.site_name || "",
      field_tanker_type: assetKindLabel(ft.asset_kind),
      field_tanker_asset_code: ft.asset_code || "",
      field_tanker_asset: ft.asset_name || ft.machine || ft.vehicle || ft.other || ft.manual_asset_name || "",
      field_tanker_registration: ft.asset_registration || ft.registration || "",
      field_tanker_km: ft.km || ft.current_km || (ft.asset_kind === "vehicle" ? (ft.reading || ft.mtc_km) : ""),
      field_tanker_mtc: ft.mtc || ft.current_mtc || (ft.asset_kind === "machine" ? (ft.reading || ft.mtc_km) : ""),
      field_tanker_liters: ft.liters || "",
      field_tanker_receiver: ft.receiver || ft.received_by || ""
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
      machine_start: m.start || d.mtc_start || "",
      machine_end: m.end || d.mtc_end || "",
      machine_hours: m.hours || d.machine_hours || "",
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
      row.lowloader_tools
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
      row.field_tanker_receiver
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
      row.lowloader_plates
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
    .filter(r => !isDefectOnlyReport(r) && hasDailyReportData(r))
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
      <small>${escapeHtml(d.site_name || "bez gradilišta")} · ${escapeHtml(r.status || "")}</small>
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
      .filter(r => !isDefectOnlyReport(r) && hasDailyReportData(r))
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

  const head = `<tr>${columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join("")}</tr>`;
  const body = rows.map((row, index) => `<tr class="${index % 2 ? "even" : "odd"}">${columns.map(c => `<td>${escapeHtml(excelCellText(row[c.key]))}</td>`).join("")}</tr>`).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #111827; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th {
    background: #0f7a3b;
    color: #ffffff;
    font-weight: 700;
    border: 1px solid #0b5f2e;
    padding: 8px 10px;
    text-align: left;
    white-space: nowrap;
  }
  td {
    border: 1px solid #cfd8dc;
    padding: 7px 9px;
    vertical-align: top;
    mso-number-format: "\@";
  }
  tr.odd td { background: #ffffff; }
  tr.even td { background: #f6fbf7; }
</style>
</head>
<body>
<table>
  ${head}
  ${body}
</table>
</body>
</html>`;
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
    toast("Excel tabela je preuzeta. Otvori fajl u Excelu.");
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
    const selectedDefectSite = getSelectedWorkerSite ? getSelectedWorkerSite() : {};
    const defectSiteName = $("#wrDefectSiteName")?.value.trim() || selectedDefectSite.site_name || "";

    if (!defectText && !defectAssetName) {
      throw new Error("Upiši sredstvo u kvaru ili opis kvara.");
    }

    const machines = getMachineEntries ? getMachineEntries() : [];
    const firstMachine = defectAssetName || machines[0]?.name || "";

    const urgentData = {
      report_type: "defect_record",
      sent_immediately: true,
      defect_status: "prijavljen",
      defect_reported_at: new Date().toISOString(),
      site_id: selectedDefectSite.site_id || getSelectedWorkerSite().site_id,
      site_name: defectSiteName || getSelectedWorkerSite().site_name,
      defect_site_name: defectSiteName || getSelectedWorkerSite().site_name,
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
      function_title: worker.function_title,
      called_mechanic_by_phone: $("#wrDefectCalledMechanic")?.value || "",
      sent_to: "direkcija_mehanizacija_direktor"
    };

    const { error } = await sb.rpc("submit_worker_report", {
      p_company_code: worker.company_code,
      p_access_code: worker.access_code,
      p_report_date: $("#wrDate").value || today(),
      p_site_id: getSelectedWorkerSite().site_id,
      p_data: urgentData
    });

    if (error) throw error;

    toast("Kvar je evidentiran odmah 🚨 Uprava i direktor mogu pratiti vreme rešavanja.");
  } catch(e) {
    toast(e.message, true);
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

    const row = readRpcSingleRow(data);
    if (!row || !row.user_id || !row.company_id) {
      throw new Error("Neispravna šifra firme ili šifra zaposlenog. Proveri da je zaposleni AKTIVAN i da unosiš baš šifru firme + šifru zaposlenog.");
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
  if ($("#adminCompanySearch")) {
    $("#adminCompanySearch").addEventListener("input", e => renderAdminCompanies(e.target.value));
    $("#adminCompanySearch").addEventListener("keydown", e => { if (e.key === "Enter") renderAdminCompanies(e.target.value); });
  }
  if ($("#adminCompanySearchBtn")) $("#adminCompanySearchBtn").addEventListener("click", () => renderAdminCompanies($("#adminCompanySearch")?.value || ""));
  if ($("#adminCompanyClearSearchBtn")) $("#adminCompanyClearSearchBtn").addEventListener("click", () => { if ($("#adminCompanySearch")) $("#adminCompanySearch").value = ""; renderAdminCompanies(""); });
  $("#addApprovedCompanyBtn").addEventListener("click", async () => {
    try {
      const paidUntil = $("#acPaidUntil")?.value || null;
      const payload = {
        company_name: $("#acCompanyName").value.trim(),
        approved_email: $("#acEmail").value.trim(),
        company_code: $("#acCompanyCode").value.trim(),
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
      const { error } = await sb.from("approved_companies").insert(payload);
      if (error) {
        if (String(error.message || "").toLowerCase().includes("column")) {
          throw new Error("Bazi fale nove kolone za Admin CRM. Prvo pokreni SQL koji sam ti dao u poruci, pa ponovo sačuvaj firmu.");
        }
        throw error;
      }
      ["acCompanyName","acEmail","acContactName","acContactPhone","acCompanyCode","acInviteCode","acPaidFrom","acPaidUntil","acNote"].forEach(id => { const el = $("#"+id); if (el) el.value = ""; });
      if ($("#acPlan")) $("#acPlan").value = "trial";
      if ($("#acBrandColor")) $("#acBrandColor").value = "green";
      toast("Firma je sačuvana u Admin CRM.");
      loadApprovedCompanies();
    } catch(e) { toast(e.message, true); }
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
  if ($("#directorShowWorkerQrBtn")) $("#directorShowWorkerQrBtn").addEventListener("click", directorShowWorkerQr);
  if ($("#directorShowMechanicQrBtn")) $("#directorShowMechanicQrBtn").addEventListener("click", directorShowMechanicQr);

  $$(".tab").forEach(btn => btn.addEventListener("click", () => {
    $$(".tab").forEach(b => b.classList.remove("active"));
    $$(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    $("#tab" + btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)).classList.add("active");
    if (btn.dataset.tab === "export") renderExportPanel();
    if (btn.dataset.tab === "defects") renderDefectsList();
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
  if ($("#cancelEditAssetBtn")) $("#cancelEditAssetBtn").addEventListener("click", clearAssetForm);
  if ($("#assetCode")) $("#assetCode").addEventListener("input", scheduleAssetCodeAvailabilityCheck);


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
  if ($("#memorizeFieldTankerBtn")) $("#memorizeFieldTankerBtn").addEventListener("click", memorizeCurrentFieldTankerEntries);
  if ($("#sendStoredFieldTankerBtn")) $("#sendStoredFieldTankerBtn").addEventListener("click", sendStoredFieldTankerEntries);
  if ($("#clearStoredFieldTankerBtn")) $("#clearStoredFieldTankerBtn").addEventListener("click", clearStoredFieldTankerEntries);

  if ($("#workerLoginBtn")) $("#workerLoginBtn").addEventListener("click", loginWorkerByCode);
  if ($("#workerInstallBtn")) $("#workerInstallBtn").addEventListener("click", installWorkerApp);
  if ($("#refreshMechanicDefectsBtn")) $("#refreshMechanicDefectsBtn").addEventListener("click", () => loadMechanicBossDefects({ silent: false }));
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
  initSignaturePad();
  if ($("#clearSignatureBtn")) $("#clearSignatureBtn").addEventListener("click", () => clearSignatureCanvas(true));
  if ($("#wrDefectAssetName")) {
    $("#wrDefectAssetName").addEventListener("input", updateDefectAssetSmartResult);
    $("#wrDefectAssetName").addEventListener("change", updateDefectAssetSmartResult);
  }

  $("#submitReportBtn").addEventListener("click", async () => {
    try {
      if (!navigator.onLine) {
        saveDraft();
        throw new Error("Nema interneta. Nacrt je sačuvan na ovom telefonu.");
      }
      const worker = currentWorker || JSON.parse(localStorage.getItem("swp_worker") || "null");
      if (!worker) throw new Error("Zaposleni nije prijavljen.");
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
      if (await submitReturnedCorrectionIfNeeded(data)) return;
      const reportDate = $("#wrDate").value || today();
      const { error } = await sb.rpc("submit_worker_report", {
        p_company_code: worker.company_code,
        p_access_code: worker.access_code,
        p_report_date: reportDate,
        p_site_id: data.site_id || null,
        p_data: data
      });
      if (error) throw error;
      await verifyRecentlySubmittedReport(worker, reportDate);
      try {
        await prepareWorkerFormForNextReport();
        toast("Izveštaj je poslat Upravi ✅ Forma je spremna za sledeći unos.");
      } catch (resetError) {
        console.warn("AskCreate.app: izveštaj je poslat, ali priprema sledeće forme nije uspela:", resetError);
        toast("Izveštaj je poslat Upravi ✅ Ako forma ne izgleda prazno, odjavi se i uđi ponovo.");
      }
    } catch(e) { toast(e.message, true); }
  });
}



let mechanicBossTimer = null;
let mechanicBossLastNewCount = 0;
let mechanicBossLastSignature = "";
let mechanicBossReportsCache = [];

function isMechanicBossWorker(worker = currentWorker) {
  const perms = worker?.permissions || {};
  return !!(perms.mechanic_boss || perms.mechanicBoss || perms.mechanic_manager || perms.head_mechanic);
}

function stopMechanicBossWatcher() {
  if (mechanicBossTimer) clearInterval(mechanicBossTimer);
  mechanicBossTimer = null;
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
    if (!error) return data || [];
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

  const { data, error } = await sb
    .from("reports")
    .select("id, company_id, user_id, report_date, status, submitted_at, created_at, data")
    .eq("company_id", currentWorker.company_id)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .limit(200);
  if (error) throw error;
  return (data || []).filter(hasDefectData);
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

  const actionsHtml = (r) => `
    <div class="mechanic-actions">
      <button class="secondary small-action" type="button" onclick="updateMechanicDefectStatus('${escapeHtml(r.id)}','preuzeto')">Preuzmi kvar</button>
      <button class="secondary small-action" type="button" onclick="updateMechanicDefectStatus('${escapeHtml(r.id)}','u_radu')">U radu</button>
      <button class="primary small-action" type="button" onclick="updateMechanicDefectStatus('${escapeHtml(r.id)}','reseno')">Rešeno</button>
      <button class="secondary small-action" type="button" onclick="addMechanicDefectNote('${escapeHtml(r.id)}')">Napomena</button>
    </div>`;

  const rowHtml = list.map(r => {
    const d = r.data || {};
    return `<tr class="mechanic-row mechanic-${mechanicStatusGroup(r)}">
      <td>${escapeHtml(formatDateTimeLocal(mechanicDefectTime(r)) || mechanicDefectTime(r))}</td>
      <td><b>${escapeHtml(mechanicDefectAssetName(r))}</b>${d.defect_asset_code ? `<small>Interni broj: ${escapeHtml(d.defect_asset_code)}</small>` : ""}</td>
      <td>${escapeHtml(mechanicDefectSiteName(r))}</td>
      <td>${escapeHtml(mechanicDefectText(r))}${d.mechanic_note ? `<small>Napomena: ${escapeHtml(d.mechanic_note)}</small>` : ""}</td>
      <td>${escapeHtml(mechanicDefectReporter(r))}</td>
      <td><span class="mechanic-status-pill status-${mechanicStatusGroup(r)}">${escapeHtml(mechanicStatusLabel(r))}</span></td>
      <td>${actionsHtml(r)}</td>
    </tr>`;
  }).join("");

  if (tableBody) tableBody.innerHTML = rowHtml || `<tr><td colspan="7" class="muted">Nema prijavljenih kvarova za ovu firmu.</td></tr>`;

  const cardHtml = list.map(r => {
    const d = r.data || {};
    const group = mechanicStatusGroup(r);
    const icon = group === "new" ? "🔴" : group === "active" ? "🟠" : "🟢";
    return `<article class="mechanic-card mechanic-${group}">
      <div class="mechanic-card-head"><strong>${icon} ${escapeHtml(mechanicStatusLabel(r))}</strong><span>${escapeHtml(formatDateTimeLocal(mechanicDefectTime(r)) || "")}</span></div>
      <h4>${escapeHtml(mechanicDefectAssetName(r))}</h4>
      <p><b>Gradilište:</b> ${escapeHtml(mechanicDefectSiteName(r))}</p>
      <p><b>Problem:</b> ${escapeHtml(mechanicDefectText(r))}</p>
      <p><b>Prijavio:</b> ${escapeHtml(mechanicDefectReporter(r))}</p>
      ${d.mechanic_note ? `<p><b>Napomena:</b> ${escapeHtml(d.mechanic_note)}</p>` : ""}
      ${actionsHtml(r)}
    </article>`;
  }).join("");
  if (cards) cards.innerHTML = cardHtml || `<p class="muted">Nema prijavljenih kvarova.</p>`;

  const renderGroup = (box, group, empty) => {
    if (!box) return;
    const groupRows = list.filter(r => mechanicStatusGroup(r) === group);
    box.innerHTML = groupRows.map(r => `<div class="mechanic-mini-line"><b>${escapeHtml(mechanicDefectAssetName(r))}</b><span>${escapeHtml(mechanicDefectSiteName(r))}</span><small>${escapeHtml(mechanicDefectText(r))}</small></div>`).join("") || `<p class="muted tiny">${empty}</p>`;
  };
  renderGroup(newBox, "new", "Nema novih kvarova.");
  renderGroup(activeBox, "active", "Nema aktivnih kvarova.");
  renderGroup(resolvedBox, "resolved", "Nema rešenih kvarova u listi.");
}

async function loadMechanicBossDefects({ silent = false } = {}) {
  if (!currentWorker?.company_id || !sb) return;
  try {
    const defects = await mechanicListDefectsSafe();
    mechanicBossReportsCache = await attachReportUsersFallback(defects);
    const newReports = mechanicBossReportsCache.filter(r => mechanicStatusGroup(r) === "new");
    const signature = newReports.map(r => r.id).join("|");
    if (signature && mechanicBossLastSignature && signature !== mechanicBossLastSignature && newReports.length >= mechanicBossLastNewCount) {
      showMechanicNewDefectSignal();
    }
    mechanicBossLastSignature = signature;
    mechanicBossLastNewCount = newReports.length;
    renderMechanicBossDefects();
    if (!silent) toast("Kvarovi su osveženi.");
  } catch (e) {
    console.warn("Ne mogu učitati kvarove za šefa mehanizacije:", e);
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

async function openMechanicBossPanel() {
  stopMechanicBossWatcher();
  await applyWorkerCompanyBrand();
  setInternalHeader("Šef mehanizacije", `${currentWorker?.full_name || "Zaposleni"} · ${currentWorker?.company_name || currentWorker?.company_code || ""}`, true);
  const name = $("#mechanicBossName");
  const label = $("#mechanicBossCompanyLabel");
  if (name) name.textContent = currentWorker?.full_name || "Šef mehanizacije";
  if (label) label.textContent = `${currentWorker?.company_name || "Firma"} · panel kvarova`;
  show("MechanicBossPanel");
  await loadMechanicBossDefects({ silent: true });
  mechanicBossTimer = setInterval(() => loadMechanicBossDefects({ silent: true }), 30000);
}

window.updateMechanicDefectStatus = async (id, newStatus) => {
  try {
    if (!currentWorker?.company_id) throw new Error("Šef mehanizacije nije prijavljen.");
    const { data: row, error: readError } = await sb.from("reports").select("data, company_id").eq("id", id).eq("company_id", currentWorker.company_id).maybeSingle();
    if (readError) throw readError;
    const d = row?.data || {};
    d.defect_status = newStatus;
    d.mechanic_status = newStatus;
    d.mechanic_updated_by = currentWorker.full_name || "Šef mehanizacije";
    d.mechanic_updated_at = new Date().toISOString();
    if (newStatus === "preuzeto") d.defect_received_at = d.defect_received_at || new Date().toISOString();
    if (newStatus === "u_radu") d.defect_repair_started_at = d.defect_repair_started_at || new Date().toISOString();
    if (newStatus === "reseno") d.defect_resolved_at = d.defect_resolved_at || new Date().toISOString();
    const { error } = await sb.from("reports").update({ data: d }).eq("id", id).eq("company_id", currentWorker.company_id);
    if (error) throw error;
    toast("Status kvara je promenjen.");
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
    d.mechanic_note = note.trim();
    d.mechanic_note_by = currentWorker.full_name || "Šef mehanizacije";
    d.mechanic_note_at = new Date().toISOString();
    const { error } = await sb.from("reports").update({ data: d }).eq("id", id).eq("company_id", currentWorker.company_id);
    if (error) throw error;
    toast("Napomena je sačuvana.");
    await loadMechanicBossDefects({ silent: true });
  } catch(e) {
    toast(e.message || String(e), true);
  }
};

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
  $("#wrDate").value = today();
  $("#workerHello").textContent = `Dobrodošli, ${currentWorker.full_name}`;
  $("#workerCompanyLabel").textContent = `${currentWorker.company_name} · ${currentWorker.function_title}`;
  workerSetSections(currentWorker.permissions || {});
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
  if (perms.workers && $("#workerEntries") && !$("#workerEntries").children.length) addWorkerEntry();
  if (perms.machines && $("#machineEntries") && !$("#machineEntries").children.length) addMachineEntry();
  if (perms.vehicles && $("#vehicleEntries") && !$("#vehicleEntries").children.length) addVehicleEntry();
  if (perms.lowloader && $("#lowloaderEntries") && !$("#lowloaderEntries").children.length) addLowloaderEntry();
  if (perms.fuel && $("#fuelEntries") && !$("#fuelEntries").children.length) addFuelEntry();
  if (perms.field_tanker && $("#fieldTankerEntries") && !$("#fieldTankerEntries").children.length) addFieldTankerEntry();
  renderStoredFieldTankerEntries();
  updateLeaveRequestVisibility();
}


async function boot() {
  installNavigationFallback();
  bindEvents();
  initSupabase();
  $("#wrDate").value = today();
  const qrCompanyCode = getWorkerCompanyCodeFromUrl();
  const storedCompanyCode = getSavedWorkerCompanyCode();
  const stored = localStorage.getItem("swp_worker");

  // QR/PWA radnički režim: telefon pamti firmu, ali ne otvara Upravu firme i ne prikazuje javni meni.
  // Zaposleni uvek vidi samo unos svog radničkog koda, pa tek onda ulazi u svoje štiklirane rubrike.
  if (qrCompanyCode || storedCompanyCode) {
    if (qrCompanyCode) localStorage.setItem("swp_worker_company_code", qrCompanyCode);
    const keepMechanic = localStorage.getItem("swp_mechanic_keep_login") === "1";
    if (stored && keepMechanic) {
      try {
        currentWorker = JSON.parse(stored);
        if (isMechanicBossWorker(currentWorker)) {
          openWorkerForm();
          if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
          return;
        }
      } catch {}
    }
    localStorage.removeItem("swp_worker");
    localStorage.removeItem("swp_mechanic_keep_login");
    updateWorkerEntryModeUi();
    show("WorkerLogin");
    applyWorkerCompanyContextFromUrlOrStorage();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
    return;
  }

  if (stored) {
    try {
      currentWorker = JSON.parse(stored);
      openWorkerForm();
      return;
    } catch {}
  }
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
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
