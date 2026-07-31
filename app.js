(function () {
  var data = window.FEYNMAN_DATA;
  if (!data || !data.books || !data.books.length) {
    document.getElementById("list").innerHTML = '<div class="empty">데이터를 불러오지 못했습니다. 새로고침 해주세요.</div>';
    return;
  }

  var volId = data.books[0].id;
  var query = "";
  var openId = null;

  var listEl = document.getElementById("list");
  var tabsEl = document.getElementById("volTabs");
  var qEl = document.getElementById("q");

  function currentBook() {
    return data.books.find(function (b) { return b.id === volId; }) || data.books[0];
  }

  function filteredChapters() {
    var book = currentBook();
    var qq = query.trim().toLowerCase();
    if (!qq) return book.chapters.slice();
    return book.chapters.filter(function (c) {
      return (
        c.titleKo.toLowerCase().indexOf(qq) !== -1 ||
        c.titleEn.toLowerCase().indexOf(qq) !== -1 ||
        String(c.no).indexOf(qq) !== -1
      );
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderTabs() {
    tabsEl.innerHTML = data.books.map(function (b) {
      var active = b.id === volId ? " active" : "";
      return (
        '<button type="button" class="vol-tab' + active + '" data-vol="' + b.id + '" role="tab" aria-selected="' + (b.id === volId) + '">' +
          "<b>" + escapeHtml(b.title) + "</b>" +
          "<span>" + escapeHtml(b.subtitle) + " · " + b.chapters.length + "챕터</span>" +
        "</button>"
      );
    }).join("");
  }

  function renderList() {
    var book = currentBook();
    var items = filteredChapters();

    document.getElementById("statVol").textContent = book.title.split("·")[0].trim();
    document.getElementById("statCount").textContent = String(items.length);
    document.getElementById("statFilter").textContent = query.trim() ? "검색중" : "전체";

    if (!items.length) {
      listEl.innerHTML = '<div class="empty">검색 결과가 없습니다.</div>';
      return;
    }

    listEl.innerHTML = items.map(function (ch) {
      var isOpen = openId === ch.id;
      var no = String(ch.no).padStart(2, "0");
      return (
        '<article class="item' + (isOpen ? " open" : "") + '" data-id="' + escapeHtml(ch.id) + '">' +
          '<button type="button" class="item-btn" data-id="' + escapeHtml(ch.id) + '" aria-expanded="' + isOpen + '">' +
            '<div class="no">' + no + "</div>" +
            '<div class="meta">' +
              '<div class="t">' + escapeHtml(ch.titleKo) + "</div>" +
              '<div class="s">' + escapeHtml(ch.titleEn) + "</div>" +
            "</div>" +
            '<div class="go">' + (isOpen ? "닫기" : "보기 →") + "</div>" +
          "</button>" +
          '<div class="panel">' +
            "<p>" + escapeHtml(ch.summary) + "\n\n한글 자동 번역으로 읽거나, 영문 원문을 열 수 있습니다.</p>" +
            '<div class="panel-actions">' +
              '<a class="btn" href="read.html?id=' + encodeURIComponent(ch.id) + '">한글 번역으로 읽기</a>' +
              '<a class="btn ghost" href="' + escapeHtml(ch.official) + '" target="_blank" rel="noopener noreferrer">영문 원문</a>' +
              '<button type="button" class="btn ghost next-btn" data-id="' + escapeHtml(ch.id) + '">다음 챕터</button>' +
            "</div>" +
          "</div>" +
        "</article>"
      );
    }).join("");
  }

  function render() {
    renderTabs();
    renderList();
  }

  function openChapter(id) {
    openId = openId === id ? null : id;
    renderList();
    if (openId) {
      var el = listEl.querySelector('.item[data-id="' + openId + '"]');
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function openNext(id) {
    var book = currentBook();
    var idx = book.chapters.findIndex(function (c) { return c.id === id; });
    var next = book.chapters[idx + 1] || book.chapters[0];
    if (!next) return;
    openId = next.id;
    query = "";
    qEl.value = "";
    render();
    var el = listEl.querySelector('.item[data-id="' + openId + '"]');
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  tabsEl.addEventListener("click", function (e) {
    var btn = e.target.closest(".vol-tab");
    if (!btn) return;
    volId = btn.getAttribute("data-vol");
    openId = null;
    query = "";
    qEl.value = "";
    render();
  });

  listEl.addEventListener("click", function (e) {
    var nextBtn = e.target.closest(".next-btn");
    if (nextBtn) {
      e.preventDefault();
      openNext(nextBtn.getAttribute("data-id"));
      return;
    }

    // 공식 원문 링크는 기본 동작(새 탭) 그대로 둠
    if (e.target.closest("a.btn")) return;

    var btn = e.target.closest(".item-btn");
    if (!btn) return;
    openChapter(btn.getAttribute("data-id"));
  });

  qEl.addEventListener("input", function () {
    query = qEl.value;
    openId = null;
    renderList();
  });

  render();
})();
