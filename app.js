// ─────────────────────────────────────────────────────────────────────────
// Alex D&D Training — Document Generator frontend
//
// Plain JS, no build step, no framework. Talks to the FastAPI backend
// over its documented endpoints (see backend/main.py). The bearer
// token (APP_PASSWORD) and server URL are kept only in memory for
// this tab's lifetime — never written to localStorage/sessionStorage,
// so closing the tab signs you out. That is a deliberate trade-off for
// a single shared internal password: convenience of "stay signed in"
// is not worth the risk of the token sitting in browser storage.
// ─────────────────────────────────────────────────────────────────────────

const state = {
  serverUrl: "",
  token: "",
  courses: [],
};

// Default server URL — replace with your deployed Render URL once live.
// Left blank deliberately so the login screen prompts for it rather
// than silently pointing at a placeholder.
const DEFAULT_SERVER_URL = "https://alexdd-backend.onrender.com";

// ── Auth ───────────────────────────────────────────────────────────────

const loginScreen = document.getElementById("login-screen");
const appShell = document.getElementById("app");
const loginPasswordInput = document.getElementById("login-password");
const serverUrlInput = document.getElementById("server-url");
const loginError = document.getElementById("login-error");

serverUrlInput.value = DEFAULT_SERVER_URL;

document.getElementById("login-btn").addEventListener("click", attemptLogin);
loginPasswordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") attemptLogin();
});

async function attemptLogin() {
  const url = serverUrlInput.value.trim().replace(/\/$/, "");
  const password = loginPasswordInput.value;
  loginError.textContent = "";

  if (!url) {
    loginError.textContent = "Enter the server URL first.";
    return;
  }
  if (!password) {
    loginError.textContent = "Enter the password.";
    return;
  }

  state.serverUrl = url;
  state.token = password;

  try {
    // /history is a cheap authenticated endpoint — use it purely to
    // confirm the password + URL actually work before entering the app.
    const res = await apiFetch("/history", { method: "GET" });
    if (res.status === 401) {
      loginError.textContent = "Incorrect password.";
      return;
    }
    if (res.status === 503) {
      loginError.textContent = "Server is not configured (APP_PASSWORD missing).";
      return;
    }
    if (!res.ok) {
      loginError.textContent = `Server returned an unexpected error (${res.status}).`;
      return;
    }
    enterApp();
  } catch (err) {
    loginError.textContent =
      "Could not reach the server. Check the URL, and note the free tier can take up to a minute to wake up — try again in a moment.";
  }
}

document.getElementById("logout-btn").addEventListener("click", () => {
  state.token = "";
  appShell.classList.remove("visible");
  loginScreen.classList.remove("hidden");
  loginPasswordInput.value = "";
  loginPasswordInput.focus();
});

function enterApp() {
  loginScreen.classList.add("hidden");
  appShell.classList.add("visible");
  loadCourses();
  refreshHistory();
  loadSmtpSettings();
}

// ── API helper ─────────────────────────────────────────────────────────

async function apiFetch(path, opts = {}) {
  const headers = Object.assign({}, opts.headers, {
    Authorization: `Bearer ${state.token}`,
  });
  if (opts.body && !(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(state.serverUrl + path, Object.assign({}, opts, { headers }));
}

async function apiJson(path, opts = {}) {
  const res = await apiFetch(path, opts);
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body.detail) detail = body.detail;
    } catch (_) {}
    throw new Error(detail);
  }
  return res.json();
}

// ── Reference data: nationalities (verified against the desktop app's
// own dropdown, not approximated) ──────────────────────────────────────

const NATIONALITIES = [
  "Afghan", "Albanian", "Algerian", "American", "Andorran", "Angolan",
  "Antiguan", "Argentine", "Armenian", "Australian", "Austrian",
  "Azerbaijani", "Bahamian", "Bahraini", "Bangladeshi", "Barbadian",
  "Belarusian", "Belgian", "Belizean", "Beninese", "Bhutanese",
  "Bolivian", "Bosnian", "Botswanan", "Brazilian", "British",
  "Bruneian", "Bulgarian", "Burkinabe", "Burmese", "Burundian",
  "Cambodian", "Cameroonian", "Canadian", "Cape Verdean",
  "Central African", "Chadian", "Chilean", "Chinese", "Colombian",
  "Comoran", "Congolese", "Costa Rican", "Croatian", "Cuban",
  "Cypriot", "Czech", "Danish", "Djiboutian", "Dominican",
  "Dutch", "East Timorese", "Ecuadorian", "Egyptian",
  "Emirati", "Equatorial Guinean", "Eritrean", "Estonian",
  "Eswatini", "Ethiopian", "Fijian", "Filipino", "Finnish",
  "French", "Gabonese", "Gambian", "Georgian", "German",
  "Ghanaian", "Greek", "Grenadian", "Guatemalan", "Guinean",
  "Guinea-Bissauan", "Guyanese", "Haitian", "Honduran",
  "Hungarian", "Icelandic", "Indian", "Indonesian", "Iranian",
  "Iraqi", "Irish", "Israeli", "Italian", "Ivorian", "Jamaican",
  "Japanese", "Jordanian", "Kazakh", "Kenyan", "Kiribati",
  "Kosovan", "Kuwaiti", "Kyrgyz", "Laotian", "Latvian",
  "Lebanese", "Lesothan", "Liberian", "Libyan", "Liechtensteiner",
  "Lithuanian", "Luxembourgish", "Macedonian", "Malagasy",
  "Malawian", "Malaysian", "Maldivian", "Malian", "Maltese",
  "Marshallese", "Mauritanian", "Mauritian", "Mexican",
  "Micronesian", "Moldovan", "Monacan", "Mongolian",
  "Montenegrin", "Moroccan", "Mosotho", "Mozambican", "Namibian",
  "Nauruan", "Nepalese", "New Zealander", "Nicaraguan",
  "Nigerian", "Nigerien", "North Korean", "North Macedonian",
  "Norwegian", "Omani", "Pakistani", "Palauan", "Palestinian",
  "Panamanian", "Papua New Guinean", "Paraguayan", "Peruvian",
  "Polish", "Portuguese", "Qatari", "Romanian", "Russian",
  "Rwandan", "Saint Lucian", "Salvadoran", "Samoan",
  "San Marinese", "Sao Tomean", "Saudi Arabian",
  "Scottish", "Senegalese", "Serbian", "Seychellois",
  "Sierra Leonean", "Singaporean", "Slovak", "Slovenian",
  "Solomon Islander", "Somali", "South African", "South Korean",
  "South Sudanese", "Spanish", "Sri Lankan", "Sudanese",
  "Surinamese", "Swazi", "Swedish", "Swiss", "Syrian",
  "Taiwanese", "Tajik", "Tanzanian", "Thai", "Togolese",
  "Tongan", "Trinidadian", "Tunisian", "Turkish", "Turkmen",
  "Tuvaluan", "Ugandan", "Ukrainian", "Uruguayan", "Uzbek",
  "Vanuatuan", "Venezuelan", "Vietnamese", "Welsh", "Yemeni",
  "Zambian", "Zimbabwean",
  "Other",
];

// ── Generic searchable combobox ─────────────────────────────────────────
// Backs the course pickers (Register/Invoice/Receipt) and the nationality
// picker. `searchInputId` is the visible text box; `hiddenInputId` is the
// element other code reads the chosen value from via val(id) — kept as an
// <input type="hidden"> with the SAME id the old <select> used to have,
// so collectEnrolmentData() / autofill handlers elsewhere needed no change.
function initCombobox({ searchInputId, hiddenInputId, listId, options, onSelect, getLabel }) {
  const searchInput = document.getElementById(searchInputId);
  const hiddenInput = document.getElementById(hiddenInputId);
  const list = document.getElementById(listId);
  getLabel = getLabel || ((opt) => opt);
  let highlighted = -1;
  let filtered = [];

  function render(query) {
    const q = (query || "").trim().toLowerCase();
    filtered = !q
      ? options.slice()
      : options.filter((opt) => getLabel(opt).toLowerCase().includes(q));
    highlighted = -1;
    if (!filtered.length) {
      list.innerHTML = `<div class="combobox-empty">No matches</div>`;
    } else {
      list.innerHTML = filtered
        .map((opt, i) => `<div class="combobox-option" data-index="${i}">${escapeHtml(getLabel(opt))}</div>`)
        .join("");
    }
  }

  function open(query) {
    render(query);
    list.classList.add("open");
  }
  function close() {
    list.classList.remove("open");
  }
  function choose(opt) {
    hiddenInput.value = getLabel(opt);
    searchInput.value = getLabel(opt);
    close();
    if (onSelect) onSelect(opt);
  }

  searchInput.addEventListener("input", () => {
    hiddenInput.value = "";
    open(searchInput.value);
  });
  searchInput.addEventListener("focus", () => open(searchInput.value));
  searchInput.addEventListener("keydown", (e) => {
    if (!list.classList.contains("open")) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlighted = Math.min(highlighted + 1, filtered.length - 1);
      updateHighlight();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlighted = Math.max(highlighted - 1, 0);
      updateHighlight();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlighted >= 0 && filtered[highlighted]) choose(filtered[highlighted]);
    } else if (e.key === "Escape") {
      close();
    }
  });
  list.addEventListener("mousedown", (e) => {
    const row = e.target.closest(".combobox-option");
    if (!row) return;
    const opt = filtered[Number(row.dataset.index)];
    if (opt) choose(opt);
  });
  document.addEventListener("click", (e) => {
    if (!searchInput.parentElement.contains(e.target)) close();
  });

  function updateHighlight() {
    list.querySelectorAll(".combobox-option").forEach((el, i) => {
      el.classList.toggle("highlighted", i === highlighted);
    });
    const el = list.querySelector(".highlighted");
    if (el) el.scrollIntoView({ block: "nearest" });
  }

  return {
    setOptions(newOptions) { options = newOptions; },
    setValue(value) {
      hiddenInput.value = value || "";
      searchInput.value = value || "";
    },
  };
}

// ── Reference data: nationalities — full global demonym list, "Other" last

const nationalityCombobox = initCombobox({
  searchInputId: "reg-nationality-search",
  hiddenInputId: "reg-nationality",
  listId: "reg-nationality-list",
  options: NATIONALITIES,
});

// ── Tabs ───────────────────────────────────────────────────────────────

document.querySelectorAll("nav.tabs button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("nav.tabs button").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`panel-${btn.dataset.tab}`).classList.add("active");
    if (btn.dataset.tab === "history") refreshHistory();
  });
});

// ── Courses: load once, populate every combobox, and drive autofill ────

const courseComboboxes = {};

async function loadCourses() {
  try {
    state.courses = await apiJson("/courses");
  } catch (err) {
    state.courses = [];
  }
  ensureCourseComboboxesInit();
  for (const cb of Object.values(courseComboboxes)) cb.setOptions(state.courses);
  renderCourseEditor();
}

function ensureCourseComboboxesInit() {
  if (courseComboboxes.reg) return; // already initialised
  courseComboboxes.reg = initCombobox({
    searchInputId: "reg-course-search",
    hiddenInputId: "reg-course-select",
    listId: "reg-course-list",
    options: state.courses,
    getLabel: (c) => c.name,
    onSelect: (course) => {
      document.getElementById("reg-course-title").value = course.name;
    },
  });
  courseComboboxes.inv = initCombobox({
    searchInputId: "inv-course-search",
    hiddenInputId: "inv-course-select",
    listId: "inv-course-list",
    options: state.courses,
    getLabel: (c) => c.name,
    onSelect: (course) => applyCourseAutofill("inv", course.name),
  });
  courseComboboxes.rec = initCombobox({
    searchInputId: "rec-course-search",
    hiddenInputId: "rec-course-select",
    listId: "rec-course-list",
    options: state.courses,
    getLabel: (c) => c.name,
    onSelect: (course) => applyCourseAutofill("rec", course.name),
  });
}

// Course → description/amount/VAT autofill for Invoice and Receipt,
// replicating the desktop app's exact price_inc -> amount_exc formula:
// exc = price_inc / (1 + rate/100) when rate > 0, else exc = price_inc.
// This matters because courses are stored VAT-inclusive but the PDF
// line-items table needs the VAT-exclusive amount as its starting figure.
function applyCourseAutofill(prefix, courseName) {
  const course = state.courses.find((c) => c.name === courseName);
  if (!course) return;
  const rate = parseFloat(course.vat_rate) || 0;
  const priceInc = parseFloat(course.price_inc) || 0;
  const exc = rate > 0 ? priceInc / (1 + rate / 100) : priceInc;
  document.getElementById(`${prefix}-description`).value = course.name;
  document.getElementById(`${prefix}-amount-exc`).value = exc.toFixed(2);
  document.getElementById(`${prefix}-vat-rate`).value = String(Math.round(rate));
}

// ── Live preview chips: customer ID + document number ──────────────────
// Debounced so we are not firing a request on every keystroke.

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function setChip(chipEl, text, pending) {
  chipEl.classList.toggle("pending", pending);
  chipEl.querySelector(".value").textContent = text;
}

const updateInvCustomerIdPreview = debounce(async () => {
  const name = document.getElementById("inv-client-name").value.trim();
  const email = document.getElementById("inv-email").value.trim();
  const chip = document.getElementById("inv-customer-id-chip");
  if (!name && !email) { setChip(chip, "—", true); return; }
  try {
    const res = await apiJson("/preview/customer-id", {
      method: "POST",
      body: JSON.stringify({ name, email }),
    });
    setChip(chip, res.customer_id, false);
  } catch (_) { setChip(chip, "—", true); }
}, 400);

const updateRecCustomerIdPreview = debounce(async () => {
  const name = document.getElementById("rec-client-name").value.trim();
  const email = document.getElementById("rec-email").value.trim();
  const chip = document.getElementById("rec-customer-id-chip");
  if (!name && !email) { setChip(chip, "—", true); return; }
  try {
    const res = await apiJson("/preview/customer-id", {
      method: "POST",
      body: JSON.stringify({ name, email }),
    });
    setChip(chip, res.customer_id, false);
  } catch (_) { setChip(chip, "—", true); }
}, 400);

["inv-client-name", "inv-email"].forEach((id) =>
  document.getElementById(id).addEventListener("input", updateInvCustomerIdPreview)
);
["rec-client-name", "rec-email"].forEach((id) =>
  document.getElementById(id).addEventListener("input", updateRecCustomerIdPreview)
);

async function updateInvNumberPreview() {
  const chip = document.getElementById("inv-number-chip");
  const dateStr = document.getElementById("inv-date").value.trim();
  try {
    const qs = dateStr ? `?date_str=${encodeURIComponent(dateStr)}` : "";
    const res = await apiJson(`/preview/doc-number/invoice${qs}`);
    setChip(chip, res.number, false);
  } catch (_) { setChip(chip, "—", true); }
}
async function updateRecNumberPreview() {
  const chip = document.getElementById("rec-number-chip");
  const dateStr = document.getElementById("rec-date").value.trim();
  try {
    const qs = dateStr ? `?date_str=${encodeURIComponent(dateStr)}` : "";
    const res = await apiJson(`/preview/doc-number/receipt${qs}`);
    setChip(chip, res.number, false);
  } catch (_) { setChip(chip, "—", true); }
}
document.getElementById("inv-date").addEventListener("input", debounce(updateInvNumberPreview, 400));
document.getElementById("rec-date").addEventListener("input", debounce(updateRecNumberPreview, 400));

// ── Status message helper ───────────────────────────────────────────────

function showStatus(elId, message, kind) {
  const el = document.getElementById(elId);
  el.textContent = message;
  el.classList.remove("hidden", "error", "success");
  el.classList.add(kind);
}
function hideStatus(elId) {
  document.getElementById(elId).classList.add("hidden");
}

// ── PDF preview rendering ───────────────────────────────────────────────

function showPdfBlob(framePrefix, blob) {
  const url = URL.createObjectURL(blob);
  const frame = document.getElementById(`${framePrefix}-pdf-frame`);
  const wrap = document.getElementById(`${framePrefix}-pdf-wrap`);
  frame.src = url;
  frame.classList.add("visible");
  wrap.querySelector(".pdf-placeholder").style.display = "none";
  return url;
}

// ── Generic field collectors ────────────────────────────────────────────

function val(id) { return document.getElementById(id).value; }
function num(id) { return parseFloat(document.getElementById(id).value) || 0; }
function checked(id) { return document.getElementById(id).checked; }

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// <input type="date"> always yields "YYYY-MM-DD" (or "" if empty). The PDFs
// and doc-number minting expect a human-readable display string instead —
// this converts without touching pdf_generator.py or db.py, both of which
// already accept several date string formats (including "YYYY-MM-DD" for
// minting) and treat the date as an opaque display string for the PDF body.
function formatDateLong(isoDate) {
  // "DD Month YYYY", matching the original invoice/receipt placeholder convention.
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}
function formatDateSlash(isoDate) {
  // "DD/MM/YYYY", matching the original Register tab (dob, reg_date) convention.
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

// Reverse of formatDateLong: "D Month YYYY" -> "YYYY-MM-DD" for re-loading
// a history entry into a native <input type="date">. Returns "" if the
// stored string doesn't match (e.g. it was generated before this format
// existed, or was left blank) rather than guessing.
function parseDateLongToIso(display) {
  if (!display) return "";
  const m = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(display.trim());
  if (!m) return "";
  const day = Number(m[1]);
  const monthIndex = MONTH_NAMES.findIndex((name) => name.toLowerCase() === m[2].toLowerCase());
  const year = Number(m[3]);
  if (monthIndex === -1) return "";
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Reverse of formatDateSlash: "DD/MM/YYYY" -> "YYYY-MM-DD".
function parseDateSlashToIso(display) {
  if (!display) return "";
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(display.trim());
  if (!m) return "";
  const [, d, mo, y] = m;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// ── REGISTER (Enrolment) ────────────────────────────────────────────────

let lastEnrolmentData = null;
let lastEnrolmentBlobUrl = null;

function collectEnrolmentData() {
  return {
    course_title: val("reg-course-title") || val("reg-course-select"),
    title: val("reg-title"),
    forename: val("reg-forename"),
    surname: val("reg-surname"),
    address: val("reg-address"),
    postcode: val("reg-postcode"),
    dob: formatDateSlash(val("reg-dob")),
    ni_number: val("reg-ni"),
    client_email: val("reg-email"),
    client_phone: val("reg-phone"),
    nationality: val("reg-nationality"),
    edu_college_0: val("reg-edu-college-0"),
    edu_qual_0: val("reg-edu-qual-0"),
    edu_college_1: val("reg-edu-college-1"),
    edu_qual_1: val("reg-edu-qual-1"),
    edu_college_2: val("reg-edu-college-2"),
    edu_qual_2: val("reg-edu-qual-2"),
    employed: val("reg-employed"),
    employer_name: val("reg-employer-name"),
    employer_address: val("reg-employer-address"),
    employer_phone: val("reg-employer-phone"),
    job_title: val("reg-job-title"),
    emergency_name: val("reg-emergency-name"),
    emergency_phone: val("reg-emergency-phone"),
    emergency_relationship: val("reg-emergency-relationship"),
    ethnicity: val("reg-ethnicity"),
    agree_data_protection: checked("reg-agree-dp"),
    agree_equality: checked("reg-agree-eq"),
    reg_date: formatDateSlash(val("reg-date")) || null,
  };
}

document.getElementById("reg-generate-btn").addEventListener("click", async () => {
  hideStatus("reg-status");
  const btn = document.getElementById("reg-generate-btn");
  btn.disabled = true;
  try {
    const data = collectEnrolmentData();
    const res = await apiFetch("/generate/enrolment", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Failed (${res.status})`);
    }
    const blob = await res.blob();
    lastEnrolmentData = data;
    if (lastEnrolmentBlobUrl) URL.revokeObjectURL(lastEnrolmentBlobUrl);
    lastEnrolmentBlobUrl = showPdfBlob("reg", blob);
    document.getElementById("reg-email-btn").disabled = false;
    document.getElementById("reg-to-invoice-btn").disabled = false;
    document.getElementById("reg-to-receipt-btn").disabled = false;
    // Silently carry the enrolment's contact + course details into Invoice
    // and Receipt so they're already prefilled if the user switches tabs —
    // the explicit "Create Invoice/Receipt from this…" buttons below do the
    // same prefill on demand, for when the user edited those tabs since.
    applyEnrolmentToBillingForm("inv");
    applyEnrolmentToBillingForm("rec");
    showStatus("reg-status", "Enrolment form generated.", "success");
  } catch (err) {
    showStatus("reg-status", err.message, "error");
  } finally {
    btn.disabled = false;
  }
});

// Carries the most recently generated enrolment's contact details and
// course onto the Invoice or Receipt tab (prefix "inv" / "rec"). Does NOT
// touch amount/VAT/description beyond what the course autofill sets, and
// never overwrites a course the user picked manually if no course was set
// on Register — it only fills what the enrolment actually specified.
function applyEnrolmentToBillingForm(prefix) {
  if (!lastEnrolmentData) return;
  const fullName = `${lastEnrolmentData.title || ""} ${lastEnrolmentData.forename || ""} ${lastEnrolmentData.surname || ""}`
    .replace(/\s+/g, " ")
    .trim();
  if (fullName) document.getElementById(`${prefix}-client-name`).value = fullName;
  if (lastEnrolmentData.address) document.getElementById(`${prefix}-address`).value = lastEnrolmentData.address;
  if (lastEnrolmentData.client_phone) document.getElementById(`${prefix}-phone`).value = lastEnrolmentData.client_phone;
  if (lastEnrolmentData.client_email) document.getElementById(`${prefix}-email`).value = lastEnrolmentData.client_email;

  const courseName = lastEnrolmentData.course_title;
  if (courseName) {
    courseComboboxes[prefix].setValue(courseName);
    applyCourseAutofill(prefix, courseName);
  }

  if (prefix === "inv") updateInvCustomerIdPreview();
  if (prefix === "rec") updateRecCustomerIdPreview();
}

document.getElementById("reg-to-invoice-btn").addEventListener("click", () => {
  applyEnrolmentToBillingForm("inv");
  document.querySelector('nav.tabs button[data-tab="invoice"]').click();
});
document.getElementById("reg-to-receipt-btn").addEventListener("click", () => {
  applyEnrolmentToBillingForm("rec");
  document.querySelector('nav.tabs button[data-tab="receipt"]').click();
});

document.getElementById("reg-clear-btn").addEventListener("click", () => {
  document.querySelectorAll(
    "#panel-register input[type=text], #panel-register input[type=email], " +
    "#panel-register input[type=tel], #panel-register input[type=date], " +
    "#panel-register input[type=hidden], #panel-register textarea"
  ).forEach((el) => (el.value = ""));
  document.querySelectorAll("#panel-register select").forEach((el) => (el.value = ""));
  document.querySelectorAll("#panel-register input[type=checkbox]").forEach((el) => (el.checked = false));
  document.getElementById("reg-to-invoice-btn").disabled = true;
  document.getElementById("reg-to-receipt-btn").disabled = true;
  hideStatus("reg-status");
});

document.getElementById("reg-email-btn").addEventListener("click", () => {
  if (!lastEnrolmentData) return;
  openEmailModal({
    docType: "enrolment",
    data: lastEnrolmentData,
    toDefault: lastEnrolmentData.client_email,
    subjectDefault: "Alex D&D Training – Your Enrolment Form",
    bodyDefault:
      `Dear ${lastEnrolmentData.forename || "Student"},\n\n` +
      `Please find attached your Candidate Enrolment Form from Alex D&D Training Ltd.\n\n` +
      `If you have any questions, please do not hesitate to contact us.\n\n` +
      `Kind regards,\nAlex D&D Training Ltd`,
    filename: `Enrolment_${lastEnrolmentData.forename || "candidate"}_${lastEnrolmentData.surname || ""}.pdf`.replace(/ /g, "_"),
  });
});

// ── INVOICE ──────────────────────────────────────────────────────────────

let lastInvoiceData = null;
let lastInvoiceBlobUrl = null;

function collectInvoiceData() {
  return {
    client_name: val("inv-client-name"),
    company_name: val("inv-company-name"),
    client_address: val("inv-address"),
    client_phone: val("inv-phone"),
    client_email: val("inv-email"),
    date: formatDateLong(val("inv-date")),
    order_number: val("inv-order-number"),
    description: val("inv-description"),
    amount_exc: num("inv-amount-exc"),
    vat_rate: num("inv-vat-rate"),
    deposit: num("inv-deposit"),
    status: val("inv-status"),
  };
}

document.getElementById("inv-generate-btn").addEventListener("click", async () => {
  hideStatus("inv-status-msg");
  const btn = document.getElementById("inv-generate-btn");
  btn.disabled = true;
  try {
    const data = collectInvoiceData();
    if (!data.date) throw new Error("Date is required.");
    const res = await apiFetch("/generate/invoice", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Failed (${res.status})`);
    }
    // Pull the minted number/customer ID back from the response headers
    // so the chips reflect what was actually committed, not just the preview.
    const disposition = res.headers.get("content-disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    const blob = await res.blob();
    lastInvoiceData = data;
    if (lastInvoiceBlobUrl) URL.revokeObjectURL(lastInvoiceBlobUrl);
    lastInvoiceBlobUrl = showPdfBlob("inv", blob);
    document.getElementById("inv-email-btn").disabled = false;
    if (match) setChip(document.getElementById("inv-number-chip"), match[1].replace(".pdf", ""), false);
    updateInvCustomerIdPreview();
    showStatus("inv-status-msg", "Invoice generated.", "success");
  } catch (err) {
    showStatus("inv-status-msg", err.message, "error");
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("inv-clear-btn").addEventListener("click", () => {
  document.querySelectorAll("#panel-invoice input, #panel-invoice textarea")
    .forEach((el) => { if (el.type !== "number") el.value = ""; });
  document.getElementById("inv-vat-rate").value = "0";
  document.getElementById("inv-deposit").value = "0";
  setChip(document.getElementById("inv-customer-id-chip"), "—", true);
  setChip(document.getElementById("inv-number-chip"), "—", true);
  hideStatus("inv-status-msg");
});

document.getElementById("inv-email-btn").addEventListener("click", () => {
  if (!lastInvoiceData) return;
  openEmailModal({
    docType: "invoice",
    data: lastInvoiceData,
    toDefault: lastInvoiceData.client_email,
    subjectDefault: "Alex D&D Training – Invoice",
    bodyDefault:
      `Dear ${lastInvoiceData.client_name || "Client"},\n\n` +
      `Please find your invoice from Alex D&D Training Ltd attached to this email.\n\n` +
      `For payment queries, please contact us.\n\n` +
      `Kind regards,\nAlex D&D Training Ltd`,
    filename: `${lastInvoiceData.number || "invoice"}.pdf`,
  });
});

// ── RECEIPT ──────────────────────────────────────────────────────────────

let lastReceiptData = null;
let lastReceiptBlobUrl = null;

function collectReceiptData() {
  return {
    client_name: val("rec-client-name"),
    company_name: val("rec-company-name"),
    client_address: val("rec-address"),
    client_phone: val("rec-phone"),
    client_email: val("rec-email"),
    date: formatDateLong(val("rec-date")),
    order_number: val("rec-order-number"),
    description: val("rec-description"),
    amount_exc: num("rec-amount-exc"),
    vat_rate: num("rec-vat-rate"),
    deposit: num("rec-deposit"),
    status: val("rec-status"),
  };
}

document.getElementById("rec-generate-btn").addEventListener("click", async () => {
  hideStatus("rec-status-msg");
  const btn = document.getElementById("rec-generate-btn");
  btn.disabled = true;
  try {
    const data = collectReceiptData();
    if (!data.date) throw new Error("Date is required.");
    const res = await apiFetch("/generate/receipt", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Failed (${res.status})`);
    }
    const disposition = res.headers.get("content-disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    const blob = await res.blob();
    lastReceiptData = data;
    if (lastReceiptBlobUrl) URL.revokeObjectURL(lastReceiptBlobUrl);
    lastReceiptBlobUrl = showPdfBlob("rec", blob);
    document.getElementById("rec-email-btn").disabled = false;
    if (match) setChip(document.getElementById("rec-number-chip"), match[1].replace(".pdf", ""), false);
    updateRecCustomerIdPreview();
    showStatus("rec-status-msg", "Receipt generated.", "success");
  } catch (err) {
    showStatus("rec-status-msg", err.message, "error");
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("rec-clear-btn").addEventListener("click", () => {
  document.querySelectorAll("#panel-receipt input, #panel-receipt textarea")
    .forEach((el) => { if (el.type !== "number") el.value = ""; });
  document.getElementById("rec-vat-rate").value = "0";
  document.getElementById("rec-deposit").value = "0";
  setChip(document.getElementById("rec-customer-id-chip"), "—", true);
  setChip(document.getElementById("rec-number-chip"), "—", true);
  hideStatus("rec-status-msg");
});

document.getElementById("rec-email-btn").addEventListener("click", () => {
  if (!lastReceiptData) return;
  openEmailModal({
    docType: "receipt",
    data: lastReceiptData,
    toDefault: lastReceiptData.client_email,
    subjectDefault: "Alex D&D Training – Receipt",
    bodyDefault:
      `Dear ${lastReceiptData.client_name || "Client"},\n\n` +
      `Thank you for your payment. Please find your receipt attached.\n\n` +
      `Kind regards,\nAlex D&D Training Ltd`,
    filename: `${lastReceiptData.number || "receipt"}.pdf`,
  });
});

// ── Email modal (shared by all three tabs) ──────────────────────────────

let emailModalContext = null;

function openEmailModal({ docType, data, toDefault, subjectDefault, bodyDefault, filename }) {
  emailModalContext = { docType, data, filename };
  document.getElementById("email-modal-title").textContent = `Send ${docType} via Email`;
  document.getElementById("email-to").value = toDefault || "";
  document.getElementById("email-subject").value = subjectDefault || "";
  document.getElementById("email-body").value = bodyDefault || "";
  hideStatus("email-modal-status");
  document.getElementById("email-modal").classList.add("visible");
}

document.getElementById("email-cancel-btn").addEventListener("click", () => {
  document.getElementById("email-modal").classList.remove("visible");
});

document.getElementById("email-send-btn").addEventListener("click", async () => {
  if (!emailModalContext) return;
  const btn = document.getElementById("email-send-btn");
  btn.disabled = true;
  hideStatus("email-modal-status");
  try {
    const payload = {
      doc_type: emailModalContext.docType,
      to_email: val("email-to"),
      subject: val("email-subject"),
      body: val("email-body"),
      data: emailModalContext.data,
      filename: emailModalContext.filename,
    };
    const result = await apiJson("/email", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (result.success) {
      showStatus("email-modal-status", "Email sent.", "success");
      setTimeout(() => document.getElementById("email-modal").classList.remove("visible"), 1200);
    } else {
      showStatus("email-modal-status", result.error || "Send failed.", "error");
    }
  } catch (err) {
    showStatus("email-modal-status", err.message, "error");
  } finally {
    btn.disabled = false;
  }
});

// ── HISTORY ──────────────────────────────────────────────────────────────

async function refreshHistory() {
  const wrap = document.getElementById("history-table-wrap");
  wrap.innerHTML = `<div class="empty-state">Loading…</div>`;
  try {
    const entries = await apiJson("/history");
    if (!entries.length) {
      wrap.innerHTML = `<div class="empty-state">No documents generated yet. Documents you generate on the Register, Invoice, and Receipt tabs will appear here.</div>`;
      return;
    }
    historyEntriesById.clear();
    for (const e of entries) historyEntriesById.set(String(e.id), e);
    const rows = entries
      .map((e) => {
        const dt = new Date(e.generated_at);
        const when = isNaN(dt) ? e.generated_at : dt.toLocaleString("en-GB");
        const name = e.data?.client_name || `${e.data?.forename || ""} ${e.data?.surname || ""}`.trim() || "—";
        const ref = e.data?.number || "—";
        return `
          <tr data-id="${e.id}" title="Double-click to view this ${e.doc_type}">
            <td><span class="doc-type-badge ${e.doc_type}">${e.doc_type}</span></td>
            <td>${escapeHtml(name)}</td>
            <td style="font-family: var(--mono); font-size:12px;">${escapeHtml(ref)}</td>
            <td>${escapeHtml(when)}</td>
            <td>
              <div class="row-actions">
                <button class="delete" data-action="delete" data-id="${e.id}" title="Delete">Delete</button>
              </div>
            </td>
          </tr>`;
      })
      .join("");
    wrap.innerHTML = `
      <table class="history-table">
        <thead><tr><th>Type</th><th>Client</th><th>Reference</th><th>Generated</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    wrap.querySelectorAll("button[data-action='delete']").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteHistoryEntry(btn.dataset.id);
      });
    });
    wrap.querySelectorAll("tr[data-id]").forEach((row) => {
      row.addEventListener("dblclick", () => {
        const entry = historyEntriesById.get(row.dataset.id);
        if (entry) loadHistoryEntryIntoForm(entry);
      });
    });
  } catch (err) {
    wrap.innerHTML = `<div class="empty-state">Could not load history: ${escapeHtml(err.message)}</div>`;
  }
}

const historyEntriesById = new Map();

// ── Loading a history entry back into its form, read-only first ────────
//
// Maps each doc_type to the prefix used throughout this file, the panel's
// data-tab name, and which stored field maps to which input id. Kept as
// one table rather than three near-duplicate functions so adding a field
// later only means adding one line here.
const HISTORY_FIELD_MAP = {
  enrolment: {
    prefix: "reg", tab: "register", fieldsetId: "reg-fieldset", bannerId: "reg-history-banner",
    apply(data) {
      setVal("reg-course-title", data.course_title);
      courseComboboxes.reg.setValue(data.course_title || "");
      setVal("reg-title", data.title);
      setVal("reg-forename", data.forename);
      setVal("reg-surname", data.surname);
      setVal("reg-address", data.address);
      setVal("reg-postcode", data.postcode);
      setVal("reg-dob", parseDateSlashToIso(data.dob));
      setVal("reg-ni", data.ni_number);
      setVal("reg-email", data.client_email);
      setVal("reg-phone", data.client_phone);
      nationalityCombobox.setValue(data.nationality || "");
      setVal("reg-edu-college-0", data.edu_college_0);
      setVal("reg-edu-qual-0", data.edu_qual_0);
      setVal("reg-edu-college-1", data.edu_college_1);
      setVal("reg-edu-qual-1", data.edu_qual_1);
      setVal("reg-edu-college-2", data.edu_college_2);
      setVal("reg-edu-qual-2", data.edu_qual_2);
      setVal("reg-employed", data.employed);
      setVal("reg-employer-name", data.employer_name);
      setVal("reg-employer-address", data.employer_address);
      setVal("reg-employer-phone", data.employer_phone);
      setVal("reg-job-title", data.job_title);
      setVal("reg-emergency-name", data.emergency_name);
      setVal("reg-emergency-phone", data.emergency_phone);
      setVal("reg-emergency-relationship", data.emergency_relationship);
      setVal("reg-ethnicity", data.ethnicity);
      setChecked("reg-agree-dp", data.agree_data_protection);
      setChecked("reg-agree-eq", data.agree_equality);
      setVal("reg-date", parseDateSlashToIso(data.reg_date));
    },
  },
  invoice: {
    prefix: "inv", tab: "invoice", fieldsetId: "inv-fieldset", bannerId: "inv-history-banner",
    apply(data) {
      setVal("inv-client-name", data.client_name);
      setVal("inv-company-name", data.company_name);
      setVal("inv-address", data.client_address);
      setVal("inv-phone", data.client_phone);
      setVal("inv-email", data.client_email);
      setVal("inv-date", parseDateLongToIso(data.date));
      courseComboboxes.inv.setValue(data.description || "");
      setVal("inv-order-number", data.order_number);
      setVal("inv-description", data.description);
      setVal("inv-amount-exc", data.amount_exc != null ? String(data.amount_exc) : "");
      setVal("inv-vat-rate", data.vat_rate != null ? String(data.vat_rate) : "");
      setVal("inv-deposit", data.deposit != null ? String(data.deposit) : "");
      setVal("inv-status", data.status);
      setChip(document.getElementById("inv-customer-id-chip"), data.customer_id || "—", !data.customer_id);
      setChip(document.getElementById("inv-number-chip"), data.number || "—", !data.number);
    },
  },
  receipt: {
    prefix: "rec", tab: "receipt", fieldsetId: "rec-fieldset", bannerId: "rec-history-banner",
    apply(data) {
      setVal("rec-client-name", data.client_name);
      setVal("rec-company-name", data.company_name);
      setVal("rec-address", data.client_address);
      setVal("rec-phone", data.client_phone);
      setVal("rec-email", data.client_email);
      setVal("rec-date", parseDateLongToIso(data.date));
      courseComboboxes.rec.setValue(data.description || "");
      setVal("rec-order-number", data.order_number);
      setVal("rec-description", data.description);
      setVal("rec-amount-exc", data.amount_exc != null ? String(data.amount_exc) : "");
      setVal("rec-vat-rate", data.vat_rate != null ? String(data.vat_rate) : "");
      setVal("rec-deposit", data.deposit != null ? String(data.deposit) : "");
      setVal("rec-status", data.status);
      setChip(document.getElementById("rec-customer-id-chip"), data.customer_id || "—", !data.customer_id);
      setChip(document.getElementById("rec-number-chip"), data.number || "—", !data.number);
    },
  },
};

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? "";
}
function setChecked(id, value) {
  const el = document.getElementById(id);
  if (el) el.checked = !!value;
}

function loadHistoryEntryIntoForm(entry) {
  const cfg = HISTORY_FIELD_MAP[entry.doc_type];
  if (!cfg) return;
  cfg.apply(entry.data || {});

  document.getElementById(cfg.fieldsetId).disabled = true;
  document.getElementById(cfg.fieldsetId).classList.add("form-readonly");
  const banner = document.getElementById(cfg.bannerId);
  banner.classList.remove("hidden");
  const ref = entry.data?.number
    ? `Reference: ${entry.data.number}`
    : `Generated ${new Date(entry.generated_at).toLocaleString("en-GB")}`;
  document.getElementById(`${cfg.prefix}-history-banner-ref`).textContent = ref;

  document.querySelector(`nav.tabs button[data-tab="${cfg.tab}"]`).click();
}

function exitHistoryReadOnly(prefix) {
  const fieldsetId = `${prefix}-fieldset`;
  document.getElementById(fieldsetId).disabled = false;
  document.getElementById(fieldsetId).classList.remove("form-readonly");
  document.getElementById(`${prefix}-history-banner`).classList.add("hidden");
}

document.getElementById("reg-history-edit-btn").addEventListener("click", () => exitHistoryReadOnly("reg"));
document.getElementById("reg-history-dismiss-btn").addEventListener("click", () => exitHistoryReadOnly("reg"));
document.getElementById("inv-history-edit-btn").addEventListener("click", () => exitHistoryReadOnly("inv"));
document.getElementById("inv-history-dismiss-btn").addEventListener("click", () => exitHistoryReadOnly("inv"));
document.getElementById("rec-history-edit-btn").addEventListener("click", () => exitHistoryReadOnly("rec"));
document.getElementById("rec-history-dismiss-btn").addEventListener("click", () => exitHistoryReadOnly("rec"));

async function deleteHistoryEntry(id) {
  if (!confirm("Delete this history entry? This cannot be undone.")) return;
  try {
    await apiFetch(`/history/${id}`, { method: "DELETE" });
    refreshHistory();
  } catch (err) {
    alert(`Could not delete: ${err.message}`);
  }
}

document.getElementById("history-refresh-btn").addEventListener("click", refreshHistory);
document.getElementById("history-clear-all-btn").addEventListener("click", async () => {
  if (!confirm("Clear ALL history? This cannot be undone.")) return;
  try {
    await apiFetch("/history", { method: "DELETE" });
    refreshHistory();
  } catch (err) {
    alert(`Could not clear history: ${err.message}`);
  }
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── SETTINGS: SMTP ──────────────────────────────────────────────────────

async function loadSmtpSettings() {
  try {
    const s = await apiJson("/settings/smtp");
    document.getElementById("smtp-host").value = s.host || "";
    document.getElementById("smtp-port").value = s.port || 465;
    document.getElementById("smtp-from").value = s.from_email || "";
    document.getElementById("smtp-username").value = s.username || "";
    document.getElementById("smtp-password").value = s.password || "";
  } catch (_) {}
}

document.getElementById("smtp-save-btn").addEventListener("click", async () => {
  hideStatus("smtp-status");
  try {
    await apiFetch("/settings/smtp", {
      method: "PUT",
      body: JSON.stringify({
        host: val("smtp-host"),
        port: parseInt(val("smtp-port"), 10) || 465,
        username: val("smtp-username"),
        password: val("smtp-password"),
        from_email: val("smtp-from"),
      }),
    });
    showStatus("smtp-status", "Email settings saved.", "success");
  } catch (err) {
    showStatus("smtp-status", err.message, "error");
  }
});

// ── SETTINGS: Courses ───────────────────────────────────────────────────

function renderCourseEditor() {
  const wrap = document.getElementById("course-rows");
  wrap.innerHTML = "";
  state.courses.forEach((c, i) => addCourseRow(c, i));
}

function addCourseRow(course, index) {
  const wrap = document.getElementById("course-rows");
  const row = document.createElement("div");
  row.className = "course-row";
  row.innerHTML = `
    <input type="text" class="course-name" value="${escapeHtml(course?.name || "")}" placeholder="Course name">
    <input type="number" step="0.01" class="course-price" value="${course?.price_inc ?? ""}" placeholder="Price inc.">
    <input type="number" step="1" class="course-vat" value="${course?.vat_rate ?? 0}" placeholder="VAT %">
    <button class="remove" title="Remove">&times;</button>
  `;
  row.querySelector(".remove").addEventListener("click", () => row.remove());
  wrap.appendChild(row);
}

document.getElementById("course-add-btn").addEventListener("click", () => addCourseRow(null));

document.getElementById("course-save-btn").addEventListener("click", async () => {
  hideStatus("course-status");
  const rows = document.querySelectorAll("#course-rows .course-row");
  const courses = Array.from(rows)
    .map((row) => ({
      name: row.querySelector(".course-name").value.trim(),
      price_inc: parseFloat(row.querySelector(".course-price").value) || 0,
      vat_rate: parseFloat(row.querySelector(".course-vat").value) || 0,
    }))
    .filter((c) => c.name);
  try {
    await apiFetch("/courses", { method: "PUT", body: JSON.stringify(courses) });
    state.courses = courses;
    for (const cb of Object.values(courseComboboxes)) cb.setOptions(state.courses);
    showStatus("course-status", "Course list saved.", "success");
  } catch (err) {
    showStatus("course-status", err.message, "error");
  }
});
