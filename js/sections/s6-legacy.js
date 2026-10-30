/* 06 남겨진 유산: 헌법 전문 인용 + 역사적 의의 3종(펼침) */
// 데이터: /js/data/history-data.js S6_QUOTE, S6_LEGACY, S6_LEGACY_LINK
// 의의 항목: 제목 행 클릭 시 상세 내용 펼침/접힘 (여러 항목 동시 펼침 가능)
import { S6_QUOTE, S6_LEGACY, S6_LEGACY_LINK } from "/js/data/history-data.js";

export function initLegacy() {
    const quote = document.getElementById("s6-quote");
    const list = document.getElementById("s6-legacy");

    // 1. 헌법 전문 인용 (배경 연도 · 출처 · 본문)
    if (quote) {
        quote.innerHTML = `
      <span class="legacy-quote-year" aria-hidden="true">1919</span>
      <p class="legacy-quote-src"><span class="legacy-quote-mark" aria-hidden="true">憲</span>${S6_QUOTE.source} · The Constitution of the Republic of Korea</p>
      <p class="legacy-quote-text">${S6_QUOTE.html}</p>`;
    }

    if (!list) return;

    // 2. 역사적 의의 목록 (번호 · 제목 · 요약 → 펼침 시 상세 + 원문 링크)
    list.innerHTML = S6_LEGACY.map(
        (item, i) => `
        <div class="legacy-item reveal" style="--delay:${i * 80}ms">
          <button type="button" class="legacy-head" aria-expanded="false" aria-controls="legacy-body-${i}">
            <span class="legacy-num">${item.num}</span>
            <span class="legacy-text">
              <span class="legacy-title">${item.title}<em>${item.en}</em></span>
              <span class="legacy-summary">${item.summary}</span>
            </span>
            <span class="legacy-sign" aria-hidden="true"></span>
          </button>
          <div class="legacy-body" id="legacy-body-${i}">
            <div class="legacy-body-inner">
              <p>${item.detail}</p>
              <a href="${S6_LEGACY_LINK}" target="_blank" rel="noopener noreferrer">한국민족문화대백과사전 원문 ↗</a>
            </div>
          </div>
        </div>`,
    ).join("");

    // 제목 행 클릭: 펼침/접힘 전환 (.is-open → CSS 높이 전환)
    list.querySelectorAll(".legacy-head").forEach((head) => {
        head.addEventListener("click", () => {
            const item = head.closest(".legacy-item");
            const open = !item.classList.contains("is-open");
            item.classList.toggle("is-open", open);
            head.setAttribute("aria-expanded", String(open));
        });
    });
}
