/**
 * iPhone: single self-contained HTML (inline css + js + data).
 * node scripts/build-iphone.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const css = readFileSync(join(root, "styles.css"), "utf8").replace(
  /@import url\([^)]+\);\s*/,
  ""
);

const data = readFileSync(join(root, "data.js"), "utf8");
const app = readFileSync(join(root, "app.js"), "utf8").replace(
  "'<a class=\"btn\" href=\"read.html?id=' + encodeURIComponent(ch.id) + '\">한글 번역으로 읽기</a>'",
  "'<a class=\"btn\" href=\"#read/' + encodeURIComponent(ch.id) + '\">한글 번역으로 읽기</a>'"
);

const read = readFileSync(join(root, "read.js"), "utf8")
  .replace(/var params = new URLSearchParams\(location\.search\);\s*var chapterId = params\.get\("id"\) \|\| "I_01";\s*/, "")
  .replace(/async function main\(\)/, "async function runReader(chapterId)")
  .replace(/location\.href = "read\.html\?id=" \+ encodeURIComponent\(target\.id\);/g, 'location.hash = "#read/" + encodeURIComponent(target.id);')
  .replace('<a href="index.html">목록으로</a>', '<a href="#">목록으로</a>')
  .replace(/\s*main\(\);\s*\}\)\(\);/, "");

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>영재 파인만 물리학</title>
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="theme-color" content="#070b14">
  <style>${css}
.view-hidden{display:none!important}
  </style>
</head>
<body>
  <noscript><p style="padding:20px;color:#fff">JavaScript가 필요합니다. Safari에서 열어주세요.</p></noscript>

  <div id="view-home">
    <div class="bg-orbit" aria-hidden="true"><span class="orbit o1"></span><span class="orbit o2"></span><span class="orbit o3"></span></div>
    <div class="app">
      <header class="topbar">
        <div class="brand">
          <div class="logo" aria-hidden="true"><span class="logo-core">F</span><span class="logo-ring"></span></div>
          <div><h1>영재 파인만 물리학</h1><p>1·2·3권 한글 챕터 가이드</p></div>
        </div>
        <a class="link pill-link" href="#privacy">개인정보</a>
      </header>
      <section class="hero">
        <div class="hero-badge">The Feynman Lectures on Physics</div>
        <h2>챕터를 눌러<br><span class="hero-accent">한글로 쉽게</span> 찾아보세요</h2>
        <p class="sub">Safari에서 열면 챕터 목록이 표시됩니다.</p>
        <div class="hero-chips"><span class="chip">3권 · 52+ 챕터</span><span class="chip">한글 자동 번역</span><span class="chip">Caltech 원문</span></div>
        <div class="notice"><span class="notice-icon">ℹ</span><span>미리보기에서는 목록이 0으로 보일 수 있습니다. ↗ 공유 → Safari에서 열기</span></div>
      </section>
      <div class="vol-tabs" id="volTabs" role="tablist"></div>
      <label class="search">
        <span class="search-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg></span>
        <input id="q" type="search" placeholder="챕터 제목 검색 (한글 / 영어)" autocomplete="off">
      </label>
      <div class="stats">
        <div class="stat"><div class="k">현재 권</div><div class="v" id="statVol">-</div></div>
        <div class="stat"><div class="k">챕터 수</div><div class="v" id="statCount">-</div></div>
        <div class="stat"><div class="k">검색</div><div class="v" id="statFilter">-</div></div>
      </div>
      <section class="list" id="list"></section>
      <footer class="footer"><div class="footer-inner"><p>원문: <a href="https://www.feynmanlectures.caltech.edu/" target="_blank" rel="noopener">feynmanlectures.caltech.edu</a></p></div></footer>
    </div>
  </div>

  <div id="view-read" class="view-hidden reader-body">
    <div class="bg-orbit reader-bg" aria-hidden="true"><span class="orbit o1"></span><span class="orbit o2"></span></div>
    <header class="reader-bar">
      <a class="rb-btn" href="#" id="btnBack">← 목록</a>
      <div class="rb-mid"><strong id="rTitle">…</strong><span id="rSub"></span></div>
      <div class="rb-actions"><button type="button" class="rb-btn" id="btnPrev">이전</button><button type="button" class="rb-btn primary" id="btnNext">다음</button></div>
    </header>
    <div class="reader-note"><span class="notice-icon">ℹ</span> 자동 번역 · <a id="officialLink" href="#" target="_blank" rel="noopener">영문 원문</a></div>
    <main class="reader-main">
      <div class="reader-progress" id="progress" hidden><div class="bar"><i id="progressBar"></i></div><p id="progressText">준비 중…</p></div>
      <article class="reader-article" id="article"><p class="loading">불러오는 중…</p></article>
    </main>
    <footer class="reader-footer"><a class="btn" id="btnOfficialBottom" href="#" target="_blank" rel="noopener">영문 원문</a><button type="button" class="btn ghost" id="btnNextBottom">다음</button></footer>
  </div>

  <div id="view-privacy" class="view-hidden">
    <div class="bg-orbit" aria-hidden="true"><span class="orbit o1"></span><span class="orbit o2"></span></div>
    <main class="app">
      <header class="topbar"><a class="link pill-link" href="#">← 홈</a></header>
      <section class="hero hero-compact"><div class="hero-badge">Privacy</div><h2>개인정보처리방침</h2></section>
      <section class="legal-card"><p>회원가입 없음 · 번역 캐시용 localStorage · 원문 저작권 Caltech</p></section>
    </main>
  </div>

  <script>
${data}
${read}
window.__feynmanReadRoute = function () {
  var m = location.hash.match(/^#read\\/([^/?#]+)/);
  runReader(m ? decodeURIComponent(m[1]) : "I_01");
};
${app.replace("(function () {", "function bootHome() {").replace(/}\)\(\);\s*$/, "}")}

(function () {
  var home = document.getElementById("view-home");
  var readView = document.getElementById("view-read");
  var privacy = document.getElementById("view-privacy");

  function show(which) {
    home.classList.toggle("view-hidden", which !== "home");
    readView.classList.toggle("view-hidden", which !== "read");
    privacy.classList.toggle("view-hidden", which !== "privacy");
    document.body.classList.toggle("reader-body", which === "read");
    window.scrollTo(0, 0);
    if (which === "home") bootHome();
    if (which === "read" && window.__feynmanReadRoute) window.__feynmanReadRoute();
  }

  function route() {
    var h = location.hash || "";
    if (h.indexOf("#read/") === 0) { show("read"); return; }
    if (h === "#privacy") { show("privacy"); return; }
    show("home");
  }

  document.getElementById("btnBack").onclick = function (e) { e.preventDefault(); location.hash = ""; };
  privacy.querySelector("a").onclick = function (e) { e.preventDefault(); location.hash = ""; };
  window.addEventListener("hashchange", route);
  route();
})();
  </script>
</body>
</html>`;

writeFileSync(join(root, "iphone.html"), html, "utf8");
console.log("OK iphone.html (" + Math.round(html.length / 1024) + " KB)");
