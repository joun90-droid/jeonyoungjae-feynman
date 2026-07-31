(function () {
  var data = window.FEYNMAN_DATA;
  var params = new URLSearchParams(location.search);
  var chapterId = params.get("id") || "I_01";
  var CACHE_PREFIX = "feyn_ko_v3_";
  var SEPARATOR = "\n\n¶¶¶\n\n";
  var MAX_PACK = 1400;
  var CONCURRENCY = 16;

  var article = document.getElementById("article");
  var progress = document.getElementById("progress");
  var progressBar = document.getElementById("progressBar");
  var progressText = document.getElementById("progressText");

  function findChapter(id) {
    for (var i = 0; i < data.books.length; i++) {
      var book = data.books[i];
      for (var j = 0; j < book.chapters.length; j++) {
        if (book.chapters[j].id === id) {
          return { book: book, chapter: book.chapters[j], index: j };
        }
      }
    }
    return null;
  }

  function neighbor(id, dir) {
    var found = findChapter(id);
    if (!found) return null;
    return found.book.chapters[found.index + dir] || null;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setProgress(done, total, label) {
    progress.hidden = false;
    var pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
    progressBar.style.width = pct + "%";
    progressText.textContent = label || ("번역 중… " + pct + "%");
  }

  function hideProgress() {
    progress.hidden = true;
  }

  function cacheGet(key) {
    try {
      var cached = localStorage.getItem(key);
      if (!cached) return null;
      var parsed = JSON.parse(cached);
      return parsed && parsed.blocks && parsed.blocks.length ? parsed.blocks : null;
    } catch (e) {
      return null;
    }
  }

  function cacheSet(key, blocks) {
    try {
      localStorage.setItem(key, JSON.stringify({ at: Date.now(), blocks: blocks }));
    } catch (e) {
      // quota full: drop oldest feyn keys
      try {
        Object.keys(localStorage)
          .filter(function (k) { return k.indexOf("feyn_ko_") === 0; })
          .slice(0, 5)
          .forEach(function (k) { localStorage.removeItem(k); });
        localStorage.setItem(key, JSON.stringify({ at: Date.now(), blocks: blocks }));
      } catch (e2) {}
    }
  }

  async function translateOnce(text) {
    var q = text.trim();
    if (!q) return "";
    var url =
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=" +
      encodeURIComponent(q);
    var res = await fetch(url);
    if (!res.ok) throw new Error("번역 실패 " + res.status);
    var json = await res.json();
    if (!json || !json[0]) return q;
    return json[0].map(function (row) { return row[0] || ""; }).join("");
  }

  async function translateText(text) {
    var q = text.trim();
    if (!q) return "";
    if (q.length <= MAX_PACK) return translateOnce(q);

    var parts = [];
    var rest = q;
    while (rest.length) {
      if (rest.length <= MAX_PACK) {
        parts.push(rest);
        break;
      }
      var mid = rest.lastIndexOf(". ", MAX_PACK);
      if (mid < MAX_PACK * 0.4) mid = rest.lastIndexOf(" ", MAX_PACK);
      if (mid < MAX_PACK * 0.3) mid = MAX_PACK;
      parts.push(rest.slice(0, mid + 1));
      rest = rest.slice(mid + 1);
    }

    var out = await mapPool(parts, CONCURRENCY, translateOnce, true);
    return out.join(" ").trim();
  }

  function cleanMarkdown(md) {
    var text = md || "";
    var marker = "Markdown Content:";
    var idx = text.indexOf(marker);
    if (idx !== -1) text = text.slice(idx + marker.length);

    return text
      .replace(/\r/g, "")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
      .replace(/\[[^\]]*\]\([^)]+\)/g, "")
      .replace(/^#{1,6}\s*/gm, "")
      .replace(/^\s*>\s?/gm, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function toBlocks(text) {
    return text
      .split(/\n{2,}/)
      .map(function (b) { return b.replace(/\n/g, " ").trim(); })
      .filter(function (b) {
        if (!b || b.length < 8) return false;
        if (/^(Title:|URL Source:|Published Time:|Warning:)/i.test(b)) return false;
        if (/LOADING PAGE|Dear Reader|javascript must be supported/i.test(b)) return false;
        if (/Copyright ©/i.test(b)) return false;
        return true;
      });
  }

  function packBlocks(blocks) {
    var packs = [];
    var cur = [];
    var len = 0;
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      var add = b.length + (cur.length ? SEPARATOR.length : 0);
      if (cur.length && len + add > MAX_PACK) {
        packs.push(cur);
        cur = [];
        len = 0;
      }
      if (b.length > MAX_PACK) {
        if (cur.length) {
          packs.push(cur);
          cur = [];
          len = 0;
        }
        packs.push([b]);
        continue;
      }
      cur.push(b);
      len += add;
    }
    if (cur.length) packs.push(cur);
    return packs;
  }

  async function mapPool(items, limit, worker, silent) {
    var results = new Array(items.length);
    var next = 0;
    var done = 0;

    async function run() {
      while (next < items.length) {
        var i = next++;
        try {
          results[i] = await worker(items[i], i);
        } catch (err) {
          results[i] = null;
        }
        done++;
        if (!silent) {
          setProgress(done, items.length, "한글 번역 중… " + done + "/" + items.length);
        }
      }
    }

    var runners = [];
    var n = Math.min(limit, items.length) || 1;
    for (var r = 0; r < n; r++) runners.push(run());
    await Promise.all(runners);
    return results;
  }

  async function fetchEnglish(officialUrl) {
    var res = await fetch("https://r.jina.ai/" + officialUrl, {
      headers: { Accept: "text/plain" }
    });
    if (!res.ok) throw new Error("원문 불러오기 실패");
    var md = await res.text();
    if (!md || md.length < 200) throw new Error("원문이 비어 있습니다.");
    return md;
  }

  async function translatePack(pack) {
    var joined = pack.join(SEPARATOR);
    var translated = await translateText(joined);
    var parts = translated.split(/\n*\s*¶¶¶\s*\n*/);
    if (parts.length === pack.length) {
      return parts.map(function (p) { return p.trim(); });
    }
    // separator mangled: fall back to per-block parallel
    return mapPool(pack, CONCURRENCY, function (b) {
      return translateText(b).catch(function () { return b; });
    }, true);
  }

  async function buildKorean(officialUrl, cacheKey) {
    var cached = cacheGet(cacheKey);
    if (cached) return cached;

    setProgress(0, 1, "원문 불러오는 중…");
    var md = await fetchEnglish(officialUrl);
    var blocks = toBlocks(cleanMarkdown(md));
    if (!blocks.length) throw new Error("본문을 찾지 못했습니다.");

    var packs = packBlocks(blocks);
    setProgress(0, packs.length, "한글 번역 중… 0/" + packs.length);

    var packResults = await mapPool(packs, CONCURRENCY, function (pack) {
      return translatePack(pack);
    });

    var translated = [];
    for (var i = 0; i < packResults.length; i++) {
      var part = packResults[i];
      if (!part) {
        // whole pack failed → keep English
        translated = translated.concat(packs[i]);
      } else {
        translated = translated.concat(part);
      }
    }

    cacheSet(cacheKey, translated);
    return translated;
  }

  function renderBlocks(blocks, lead) {
    var html = "";
    if (lead) {
      html += '<p class="reader-lead">' + escapeHtml(lead) + "</p>";
    }
    html += blocks
      .map(function (b) {
        var isHeading = b.length < 80 && !/[.!?。！？]$/.test(b) && /^(\d|[가-힣A-Za-z])/.test(b);
        if (isHeading && b.length < 60) return "<h2>" + escapeHtml(b) + "</h2>";
        return "<p>" + escapeHtml(b) + "</p>";
      })
      .join("");
    article.innerHTML = html;
  }

  function wireNav(found) {
    var ch = found.chapter;
    document.getElementById("rTitle").textContent = ch.titleKo;
    document.getElementById("rSub").textContent = found.book.title + " · Ch." + ch.no;
    document.title = ch.titleKo + " (한글) | 영재 파인만 물리학";

    document.getElementById("officialLink").href = ch.official;
    document.getElementById("btnOfficialBottom").href = ch.official;

    var prev = neighbor(ch.id, -1);
    var next = neighbor(ch.id, 1);

    function go(target) {
      if (!target) return;
      location.href = "read.html?id=" + encodeURIComponent(target.id);
    }

    document.getElementById("btnPrev").disabled = !prev;
    document.getElementById("btnNext").disabled = !next;
    document.getElementById("btnNextBottom").disabled = !next;
    document.getElementById("btnPrev").onclick = function () { go(prev); };
    document.getElementById("btnNext").onclick = function () { go(next); };
    document.getElementById("btnNextBottom").onclick = function () { go(next); };

    // 다음 챕터 미리 번역 캐시
    if (next) {
      setTimeout(function () {
        var key = CACHE_PREFIX + next.id;
        if (cacheGet(key)) return;
        buildKorean(next.official, key).catch(function () {});
      }, 300);
    }
  }

  async function main() {
    if (!data) {
      article.innerHTML = '<p class="error">데이터를 불러오지 못했습니다.</p>';
      return;
    }
    var found = findChapter(chapterId);
    if (!found) {
      article.innerHTML = '<p class="error">챕터를 찾을 수 없습니다. <a href="index.html">목록으로</a></p>';
      return;
    }

    wireNav(found);

    try {
      var blocks = await buildKorean(found.chapter.official, CACHE_PREFIX + found.chapter.id);
      hideProgress();
      renderBlocks(blocks, found.chapter.summary);
    } catch (err) {
      hideProgress();
      article.innerHTML =
        '<p class="error">한글 번역을 불러오지 못했습니다.<br>' +
        escapeHtml(err && err.message ? err.message : String(err)) +
        '</p><p><a class="btn" href="' +
        escapeHtml(found.chapter.official) +
        '" target="_blank" rel="noopener">영문 원문 직접 열기</a></p>';
    }
  }

  main();
})();
