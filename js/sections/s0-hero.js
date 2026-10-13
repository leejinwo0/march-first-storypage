/* =======================================================
   00 인트로: 기미독립선언서 전체 화면 팝업
   - 지도 카드 · 라벨 카드(.js-doc-zoom) 클릭 시 전역 모달 전체 화면 모드 호출
======================================================= */
const DOC_IMG =
  "/assets/images/history/march-first-walk/declaration-of-independence.jpg";

export function initHero() {
  document.querySelectorAll(".js-doc-zoom").forEach((el) => {
    el.addEventListener("click", () => {
      window.openGlobalModal?.(
        DOC_IMG,
        "기미독립선언서<br><small>1919년 3월 1일 · 서울역사편찬원</small>",
        { full: true },
      );
    });
  });
}
