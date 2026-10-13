/* =======================================================
   앱 진입점 (Entry Point)
   - 768px 기준 PC(스크롤 + 지도) / 모바일(Swiper 카드) 분기
   - 모듈 경로: 사이트 루트 기준 절대경로
======================================================= */
import { loadSeoulMapAPI } from "/js/utils/mapUtils.js";
import { initGlobalUI } from "/js/utils/uiUtils.js";

// PC 섹션 모듈
import { initSection1 } from "/js/pc-sections/section1.js";
import { initSection2 } from "/js/pc-sections/section2.js";
import { initSection3 } from "/js/pc-sections/section3.js";
import { initSection4 } from "/js/pc-sections/section4.js";
import { initSection5 } from "/js/pc-sections/section5.js";
import { initSection6 } from "/js/pc-sections/section6.js";

// 모바일 섹션 모듈
import { initMobileSection1 } from "/js/mobile-sections/section1.js";
import { initMobileSection2 } from "/js/mobile-sections/section2.js";
import { initMobileSection3 } from "/js/mobile-sections/section3.js";
import { initMobileSection4 } from "/js/mobile-sections/section4.js";
import { initMobileSection5 } from "/js/mobile-sections/section5.js";
import { initMobileSection6 } from "/js/mobile-sections/section6.js";

/* =======================================================
   전역 이미지 확대 모달 (섹션 공통)
   - 섹션 JS에서 window.openGlobalModal(이미지 URL, 캡션 HTML) 호출
======================================================= */
window.openGlobalModal = function (imgUrl, caption) {
  const modal = document.getElementById("image-modal");
  const modalImg = document.getElementById("img-in-modal");
  const captionText = document.getElementById("caption-modal");

  if (modal && modalImg && captionText) {
    modal.style.display = "block";
    modalImg.src = imgUrl;
    modalImg.alt = caption;
    captionText.innerHTML = caption;
  }
};

window.closeGlobalModal = function () {
  const modal = document.getElementById("image-modal");
  if (modal) modal.style.display = "none";
};

// 모달 닫기 이벤트 등록 (닫기 버튼 / 배경 클릭 / ESC 키)
function setupGlobalModalEvents() {
  const modal = document.getElementById("image-modal");
  const closeBtn = document.querySelector(".close-modal");

  if (closeBtn) {
    closeBtn.addEventListener("click", window.closeGlobalModal);
  }

  window.addEventListener("click", function (event) {
    if (event.target === modal) {
      window.closeGlobalModal();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && modal && modal.style.display === "block") {
      window.closeGlobalModal();
    }
  });
}

/* =======================================================
   앱 초기화
======================================================= */
async function initApp() {
  setupGlobalModalEvents();

  const isMobile = window.innerWidth <= 768;

  // 모바일: Swiper 카드 UI 초기화
  // 지도 API는 카드 4(경로 지도) 전용으로 비동기 로드, 다른 카드 렌더링은 대기 없이 진행
  if (isMobile) {
    console.log("모바일 모드 진입: Swiper 슬라이더 실행");

    new Swiper(".mySwiper", {
      pagination: {
        el: ".swiper-pagination",
        clickable: true,
      },
      grabCursor: true,
    });

    initMobileSection1();
    initMobileSection2();
    initMobileSection3(loadSeoulMapAPI());
    initMobileSection4();
    initMobileSection5();
    initMobileSection6();
    return;
  }

  // PC: 스마트서울맵 API 스크립트 로드 완료 후 섹션별 지도 초기화
  try {
    console.log("PC 모드 진입: 지도 API 부팅 시작...");

    await loadSeoulMapAPI();
    console.log("스마트서울맵 API 로드 완료! 화면을 그립니다.");

    initGlobalUI();
    initSection1();
    initSection2();
    initSection3();
    initSection4();
    initSection5();
    initSection6();

    console.log("모든 히스토리맵 섹션 로딩 완료!");
  } catch (error) {
    console.error("웹 초기화 에러:", error);
  }
}

document.addEventListener("DOMContentLoaded", initApp);

/* =======================================================
   PC ↔ 모바일 기준폭(768px) 교차 시 새로고침
   - 두 모드의 DOM·초기화 로직이 달라 런타임 전환 대신 재로드 처리
======================================================= */
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const currentIsMobile = window.innerWidth <= 768;
    const initialIsMobile =
      document.body.getAttribute("data-mobile-init") === "true";

    if (currentIsMobile !== initialIsMobile) {
      location.reload();
    }
  }, 250);
});

// 최초 로드 시점의 모드 기록 (resize 비교 기준)
document.body.setAttribute("data-mobile-init", window.innerWidth <= 768);
