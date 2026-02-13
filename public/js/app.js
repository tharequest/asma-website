if (!localStorage.getItem("asmaLogin")) {
  window.location.href = "/login.html";
}

console.log("ASMA Web UI Ready 🌐");

// ===============================
// ⏰ JAM REALTIME HEADER
// ===============================
function updateClock() {
  const el = document.getElementById("datetime");
  if (!el) return;

  el.textContent = new Date().toLocaleString("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

updateClock();               // render pertama
setInterval(updateClock, 1000); // update tiap detik

function showLoading() {
  document.getElementById("loading-overlay").style.display = "flex";
}

function hideLoading() {
  document.getElementById("loading-overlay").style.display = "none";
}

let selectedFiles = [];
let currentJenis = "aktif_kuliah";

// ===============================
// ELEMEN UI 
// ===============================
const fileInput = document.getElementById("file-input");
const btnChoose = document.getElementById("btn-choose");
const btnUpload = document.getElementById("btn-upload");
const fileInfo = document.getElementById("file-info");
const tableBody = document.getElementById("table-body");
const statusBar = document.getElementById("status-bar");
const uploadSummary = document.getElementById("upload-summary");
const tahunSelect = document.getElementById("tahun-select");
const sheetLabel = document.getElementById("sheet-label");

const jenisWithYear = ["cuti_kuliah", "undur_diri", "pindah_kuliah"];

// ===============================
// STATUS BAR
// ===============================
function setStatus(msg) {
  statusBar.textContent = "Status: " + msg;
}

// ===============================
// FILE PICKER WEB
// ===============================
btnChoose.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  selectedFiles = Array.from(fileInput.files);

  if (selectedFiles.length) {
    fileInfo.textContent = `${selectedFiles.length} file dipilih`;

    if (!jenisWithYear.includes(currentJenis)) {
      // menu tanpa tahun → langsung bisa upload
      btnUpload.disabled = false;
    } else {
      // menu dengan tahun → tunggu pilih tahun
      btnUpload.disabled = !tahunSelect.value;
    }

  } else {
    // 👇 INI FUNGSI `else` YANG KITA BAHAS
    fileInfo.textContent = "Belum ada file dipilih.";
    btnUpload.disabled = true;
  }
});

tahunSelect.addEventListener("change", () => {
  if (tahunSelect.value && selectedFiles.length) {
    btnUpload.disabled = false;
  }
});
// ===============================
// LOAD DATA TABLE
// ===============================
async function loadTable() {
  setStatus("Mengambil data...");

  try {
    const res = await fetch(`/api/get-status?jenis=${currentJenis}`);
    const json = await res.json();

    if (!json.success) throw new Error("Gagal load");

    let rows = json.data || [];

    const tableContainer = document.querySelector(".table-container");

// reset dulu
tableContainer.classList.remove("scroll");

// jika data lebih dari  → aktifkan scroll
if (rows.length > 8) {
  tableContainer.classList.add("scroll");
}
    
    const header = document.getElementById("table-header");
    header.innerHTML = `
      <th style="width:4rem;">No</th>
      <th>Nama</th>
      <th style="width:9rem;">NIM</th>
      <th style="width:11rem;">Link Surat</th>
      ${jenisWithYear.includes(currentJenis) ? `<th style="width:6rem;">Tahun</th>` : ""}
    `;

    if (jenisWithYear.includes(currentJenis) && tahunSelect.value) {
      rows = rows.filter(r => r.tahun == tahunSelect.value);
    }

    if (!rows.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-row">Belum ada data.</td>
        </tr>
      `;
    } else {
      tableBody.innerHTML = rows.map((r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${r.nama}</td>
          <td>${r.nim}</td>
          <td><a class="link" href="${r.link}" target="_blank">Lihat</a>
          <button onclick="hapusData(${i + 1}, '${r.link}')" class="btn-delete">Hapus</button>
          </td>
          ${jenisWithYear.includes(currentJenis) ? `<td>${r.tahun || "-"}</td>` : ""}
        </tr>
      `).join("");
    }

    setStatus("Siap.");
  } catch (err) {
    console.error(err);
    setStatus("Gagal mengambil data!");
  }
}

// ===============================
// ✅ UPLOAD PDF — FINAL & BENAR
// ===============================
btnUpload.addEventListener("click", async () => {
  if (!selectedFiles.length) return;

  const tahunVal = jenisWithYear.includes(currentJenis)
    ? tahunSelect.value
    : "";

  // 🔐 VALIDASI TAHUN
  if (jenisWithYear.includes(currentJenis) && !tahunVal) {
    alert("Silakan pilih tahun terlebih dahulu");
    return;
  }

  btnUpload.disabled = true;
  setStatus("Mengupload...");
  showLoading(); // ⬅️ LOADING ON

  let sukses = [];
  let duplikat = [];
  let gagal = [];

  try {
    for (const file of selectedFiles) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(
          `/api/upload?jenis=${currentJenis}&tahun=${tahunVal}`,
          {
            method: "POST",
            body: formData
          }
        );

        const json = await res.json();

        if (json.success && !json.duplicate) {
          sukses.push(file.name);
        } else if (json.duplicate) {
          duplikat.push(file.name);
        } else {
          gagal.push(file.name);
        }

      } catch (err) {
        console.error(err);
        gagal.push(file.name);
      }
    }
  } finally {
    hideLoading(); // ⬅️ LOADING OFF
  }

  // ===============================
  // UPLOAD SUMMARY
  // ===============================
  uploadSummary.style.display = "block";
  uploadSummary.className = "upload-summary";

  let html = `<strong>Upload selesai</strong><br>`;
  if (sukses.length) html += `✔ ${sukses.length} berhasil<br>`;
  if (duplikat.length) html += `⚠ ${duplikat.length} duplikat<br>`;
  if (gagal.length) html += `❌ ${gagal.length} gagal<br>`;

  uploadSummary.innerHTML = html;

  if (gagal.length) uploadSummary.classList.add("error");
  else if (duplikat.length) uploadSummary.classList.add("duplicate");
  else uploadSummary.classList.add("success");

  fileInput.value = "";
  selectedFiles = [];
  btnUpload.disabled = true;
  fileInfo.textContent = "Belum ada file dipilih.";

  loadTable();
  setStatus("Siap.");
});


// ===============================
// MENU NAV
// ===============================
document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", () => {
    document.querySelector(".nav-item.active")?.classList.remove("active");
    item.classList.add("active");

    currentJenis = item.dataset.jenis;
    tahunSelect.value = "";
    btnUpload.disabled = true;

    sheetLabel.textContent = currentJenis;

    document.getElementById("card-title").textContent =
      item.dataset.label || "Judul";

    const selectWrap = document.querySelector(".select-wrapper");

    if (jenisWithYear.includes(currentJenis)) {
      selectWrap.style.display = "inline-flex";
    } else {
      selectWrap.style.display = "none";
      tahunSelect.value = "";
    }

    loadTable();
  });
});

// ===============================
// INIT
// ===============================
loadTable();
setStatus("Siap.");

//fungsi hapus
async function hapusData(rowIndex, link) {
  if (!confirm("Yakin mau hapus surat ini?")) return;

  const res = await fetch("/api/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jenis: currentJenis,
      rowIndex: rowIndex,
      link: link
    })
  });

  const json = await res.json();

  if (json.success) {
    alert("Berhasil dihapus");
    loadTable();
  } else {
    alert("Gagal hapus");
  }
}
//untuk keluar
function logout() {
  localStorage.removeItem("asmaLogin");
  window.location.href = "/login.html";
}