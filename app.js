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
  "British", "Irish", "Polish", "Romanian", "Bulgarian", "Lithuanian", "Latvian",
  "Estonian", "Czech", "Slovak", "Hungarian", "Portuguese", "Spanish", "Italian",
  "French", "German", "Dutch", "Belgian", "Greek", "Albanian", "Ukrainian", "Russian",
  "Turkish", "Nigerian", "Ghanaian", "Kenyan", "South African", "Zimbabwean", "Somali",
  "Egyptian", "Indian", "Pakistani", "Bangladeshi", "Sri Lankan", "Nepalese", "Chinese",
  "Filipino", "Vietnamese", "Thai", "Malaysian", "Indonesian", "Jamaican", "Trinidadian",
  "Brazilian", "American", "Canadian", "Australian", "New Zealander", "Afghan", "Iranian",
  "Iraqi", "Syrian", "Other",
];

(function populateNationalities() {
  const sel = document.getElementById("reg-nationality");
  for (const n of NATIONALITIES) {
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = n;
    sel.appendChild(opt);
  }
})();

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

// ── Courses: load once, populate every select, and drive autofill ─────

async function loadCourses() {
  try {
    state.courses = await apiJson("/courses");
  } catch (err) {
    state.courses = [];
  }
  populateCourseSelect("reg-course-select");
  populateCourseSelect("inv-course-select");
  populateCourseSelect("rec-course-select");
  renderCourseEditor();
}

function populateCourseSelect(selectId) {
  const sel = document.getElementById(selectId);
  const placeholder = sel.querySelector("option[value='']");
  sel.innerHTML = "";
  if (placeholder) sel.appendChild(placeholder);
  for (const c of state.courses) {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = c.name;
    sel.appendChild(opt);
  }
}

document.getElementById("reg-course-select").addEventListener("change", (e) => {
  if (e.target.value) document.getElementById("reg-course-title").value = e.target.value;
});

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

document.getElementById("inv-course-select").addEventListener("change", (e) => {
  if (e.target.value) applyCourseAutofill("inv", e.target.value);
});
document.getElementById("rec-course-select").addEventListener("change", (e) => {
  if (e.target.value) applyCourseAutofill("rec", e.target.value);
});

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
    dob: val("reg-dob"),
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
    reg_date: val("reg-date") || null,
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
    showStatus("reg-status", "Enrolment form generated.", "success");
  } catch (err) {
    showStatus("reg-status", err.message, "error");
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("reg-clear-btn").addEventListener("click", () => {
  document.querySelectorAll("#panel-register input[type=text], #panel-register input[type=email], #panel-register input[type=tel], #panel-register textarea")
    .forEach((el) => (el.value = ""));
  document.querySelectorAll("#panel-register select").forEach((el) => (el.value = ""));
  document.querySelectorAll("#panel-register input[type=checkbox]").forEach((el) => (el.checked = false));
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
    date: val("inv-date"),
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
    date: val("rec-date"),
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
    const rows = entries
      .map((e) => {
        const dt = new Date(e.generated_at);
        const when = isNaN(dt) ? e.generated_at : dt.toLocaleString("en-GB");
        const name = e.data?.client_name || `${e.data?.forename || ""} ${e.data?.surname || ""}`.trim() || "—";
        const ref = e.data?.number || "—";
        return `
          <tr data-id="${e.id}">
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
      btn.addEventListener("click", () => deleteHistoryEntry(btn.dataset.id));
    });
  } catch (err) {
    wrap.innerHTML = `<div class="empty-state">Could not load history: ${escapeHtml(err.message)}</div>`;
  }
}

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
    populateCourseSelect("reg-course-select");
    populateCourseSelect("inv-course-select");
    populateCourseSelect("rec-course-select");
    showStatus("course-status", "Course list saved.", "success");
  } catch (err) {
    showStatus("course-status", err.message, "error");
  }
});
