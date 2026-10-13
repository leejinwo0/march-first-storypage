/* =======================================================
   Mobile Card 7: 남겨진 유산 의의 목록 + 헌법 전문
   - 데이터: /js/data/history-data.js S6_LEGACY, S6_QUOTE (PC section6 기준)
   - 목록 2그룹: 역사적 의의(01~03) / 헌법 속 3·1운동(헌법 전문)
   - 항목 탭 시 하단 시트 모달 표시 (공통 .mobile-modal-* 스타일: index-mobile.css)
======================================================= */
import { S6_LEGACY, S6_LEGACY_LINK, S6_QUOTE } from "/js/data/history-data.js";

const LAW_LINK = "https://www.law.go.kr/법령/대한민국헌법";

// 헌법 전문 모달·목록용 데이터 (S6_LEGACY와 동일 구조)
const QUOTE_ITEM = {
  num: "憲",
  title: S6_QUOTE.source,
  en: "Preamble of the Constitution",
  preview: "3·1운동으로 건립된 대한민국임시정부의 법통",
  html: S6_QUOTE.html,
  link: LAW_LINK,
  linkLabel: "국가법령정보센터 원문",
};

export function initMobileSection6() {
  const container = document.getElementById("mobile-s6-legacy");
  if (!container) return;

  const modal = createLegacyModal();
  const modalBody = modal.querySelector(".mobile-modal-body");

  const legacyItems = S6_LEGACY.map((item) => ({
    ...item,
    html: item.detail,
    link: S6_LEGACY_LINK,
    linkLabel: "한국민족문화대백과사전 원문",
  }));

  // 목록 행 마크업 (번호 · 제목 · 영문 · 화살표)
  const renderRow = (item, index, group) => `
    <li>
      <button type="button" class="legacy-row" data-group="${group}" data-index="${index}">
        <span class="legacy-num">${item.num}</span>
        <span class="legacy-title">
          <strong>${item.title}</strong>
          <em>${item.preview || item.en}</em>
        </span>
        <span class="legacy-arrow" aria-hidden="true">›</span>
      </button>
    </li>
  `;

  container.innerHTML = `
    <p class="legacy-group-label">역사적 의의</p>
    <ul class="legacy-list">
      ${legacyItems.map((item, i) => renderRow(item, i, "legacy")).join("")}
    </ul>

    <p class="legacy-group-label">헌법 속 3·1운동</p>
    <ul class="legacy-list legacy-list--quote">
      ${renderRow(QUOTE_ITEM, 0, "quote")}
    </ul>
  `;

  // 상세 모달 열기
  const openDetail = (item, isQuote) => {
    modalBody.innerHTML = `
      <article class="legacy-detail${isQuote ? " is-quote" : ""}">
        <span class="legacy-detail-num">${item.num}</span>
        <h3 class="mobile-modal-title">${item.title}</h3>
        <p class="legacy-detail-en">${item.en}</p>
        <div class="legacy-detail-text">${item.html}</div>
        <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="legacy-detail-link">${item.linkLabel} ↗</a>
      </article>
    `;
    modal.classList.add("active");
    modal.querySelector(".mobile-modal-container").scrollTop = 0;
  };

  container.addEventListener("click", (e) => {
    const row = e.target.closest(".legacy-row");
    if (!row) return;
    const isQuote = row.dataset.group === "quote";
    openDetail(
      isQuote ? QUOTE_ITEM : legacyItems[Number(row.dataset.index)],
      isQuote,
    );
  });
}

/* -------------------------------------------------------
   상세 모달(하단 시트) 마크업 1회 생성
   - 닫기: 닫기 버튼 / 시트 바깥 탭 / Esc 키
------------------------------------------------------- */
function createLegacyModal() {
  let modal = document.getElementById("mobile-legacy-modal");
  if (modal) return modal;

  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div id="mobile-legacy-modal" class="mobile-modal-overlay">
      <div class="mobile-modal-container" role="dialog" aria-modal="true">
        <button type="button" class="mobile-modal-close" aria-label="닫기">&times;</button>
        <div class="mobile-modal-body"></div>
      </div>
    </div>
  `,
  );
  modal = document.getElementById("mobile-legacy-modal");

  const close = () => modal.classList.remove("active");
  modal.querySelector(".mobile-modal-close").addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  return modal;
}
