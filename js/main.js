/* =======================================================
   앱 진입점 (Entry Point)
   - PC·모바일 단일 반응형 페이지 (스와이프 레이아웃 미사용)
   - 정적 섹션(01·06) 즉시 렌더링 → 스마트서울맵 API 로드 후 지도 섹션(02~05) 초기화
   - 모듈 경로: 사이트 루트 기준 절대경로
======================================================= */
import { loadSeoulMapAPI } from "/js/utils/mapUtils.js";
import { initGlobalUI, initGlobalModal } from "/js/utils/uiUtils.js";
import { initHero } from "/js/sections/s0-hero.js";
import { initEra } from "/js/sections/s1-era.js";
import { initPledge } from "/js/sections/s2-pledge.js";
import { initRoutes } from "/js/sections/s3-routes.js";
import { initPlaces } from "/js/sections/s4-places.js";
import { initActivists } from "/js/sections/s5-activists.js";
import { initLegacy } from "/js/sections/s6-legacy.js";

document.addEventListener("DOMContentLoaded", async () => {
  initGlobalModal();
  initHero();
  initEra();
  initLegacy();
  initGlobalUI();

  try {
    await loadSeoulMapAPI();
  } catch (error) {
    console.error("스마트서울맵 스크립트 로드 실패:", error);
    // 스마트서울맵 사용 지도만 오류 표시 (섹션1 세계지도는 OSM → 유지)
    document.querySelectorAll(".map-canvas:not(#map-s1)").forEach((el) => {
      el.innerHTML =
        '<p class="status-text map-error">지도를 불러올 수 없습니다.</p>';
    });
    return;
  }

  // 지도 섹션: 섹션별 오류가 다른 섹션 초기화를 막지 않도록 개별 실행
  const results = await Promise.allSettled([
    initPledge(),
    initRoutes(),
    initPlaces(),
    initActivists(),
  ]);
  results.forEach((result, index) => {
    if (result.status === "rejected")
      console.error(`지도 섹션 ${index + 2} 초기화 오류:`, result.reason);
  });
});
