/* =======================================================
   Mobile Card 2: 시대의 부름 세로 연표
   - 데이터: /js/data/history-data.js S1_TIMELINE (PC section1 장소·사료 기준)
   - 사료 썸네일 탭 → 전역 이미지 모달(window.openGlobalModal) 표시
======================================================= */
import { S1_TIMELINE } from "/js/data/history-data.js";

export function initMobileSection1() {
  const list = document.getElementById("mobile-s1-timeline");
  if (!list) return;

  list.innerHTML =
    S1_TIMELINE.map(
      (item, index) => `
    <li class="era-item">
      <p class="era-year">${item.year}<small>${item.date}</small></p>
      <div class="era-body">
        <div class="era-text">
          <p class="era-label">${item.label}</p>
          <h3 class="era-title">${item.title}</h3>
          <p class="era-place">${item.place}</p>
        </div>
        <button type="button" class="era-thumb" data-index="${index}" aria-label="${item.caption} 확대 보기">
          <img src="${item.imgUrl}" alt="" loading="lazy" decoding="async"
            onerror="this.closest('.era-thumb').hidden = true;">
        </button>
      </div>
    </li>
  `,
    ).join("") +
    `
  `;

  // 썸네일 탭 → 전역 모달 (캡션: 사료명 + 설명, PC section1 모달과 동일 구성)
  list.addEventListener("click", (e) => {
    const thumb = e.target.closest(".era-thumb");
    if (!thumb || !window.openGlobalModal) return;

    const item = S1_TIMELINE[Number(thumb.dataset.index)];
    window.openGlobalModal(
      item.imgUrl,
      `
      <div class="sc1-modal-caption">
        <strong class="sc1-modal-title">${item.caption}</strong>
        <p class="sc1-modal-desc">${item.desc}</p>
      </div>
    `,
    );
  });
}
