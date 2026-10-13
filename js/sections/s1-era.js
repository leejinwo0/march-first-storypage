/* =======================================================
   01 시대의 부름: 배경 카드 4종 + 참고 링크 칩
   - 데이터: /js/data/history-data.js S1_ERA
   - 이미지 클릭 시 전역 확대 모달, 이미지 로드 실패 시 사진 영역 숨김
======================================================= */
import { S1_ERA } from "/js/data/history-data.js";

export function initEra() {
  const grid = document.getElementById("s1-era");
  if (!grid) return;

  grid.innerHTML = S1_ERA.map(
    (item, index) => `
      <article class="era-card reveal" style="--delay:${index * 80}ms">
        <button type="button" class="era-photo" data-index="${index}" aria-label="${item.caption} 확대 보기">
          <img src="${item.imgUrl}" alt="${item.caption}" loading="lazy" onerror="this.closest('.era-photo').classList.add('is-empty'); this.remove();">
          <span class="era-chip">${item.label}</span>
          <span class="era-date">${item.date}</span>
        </button>
        <h3 class="era-title">${item.title}</h3>
        <p class="era-en">${item.en} · ${item.place}</p>
        <p class="era-body">${item.body}</p>
        ${item.quote ? `<p class="era-quote">${item.quote}</p>` : ""}
      </article>
    `,
  ).join("");

  grid.querySelectorAll(".era-photo").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = S1_ERA[Number(btn.dataset.index)];
      if (window.openGlobalModal && !btn.classList.contains("is-empty")) {
        window.openGlobalModal(
          item.imgUrl,
          `${item.caption}<br><small>${item.place}</small>`,
        );
      }
    });
  });
}
