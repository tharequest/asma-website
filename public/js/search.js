function searchTable() {
  const query = document.getElementById("searchInput").value.toLowerCase();
  const rows = document.querySelectorAll("#table-body tr");

  rows.forEach(row => {
    const text = row.innerText.toLowerCase();
    row.style.display = text.includes(query) ? "" : "none";
  });
}

// trig realtime ketika ketik
document.getElementById("searchInput").addEventListener("keyup", searchTable);
