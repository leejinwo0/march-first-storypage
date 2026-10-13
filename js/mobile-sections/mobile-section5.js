/* =======================================================
   Mobile Card 6: 독립의 별들 인물 아카이브
   - 데이터: 생활 속 현장 테마(100173) 중 COT_THEME_SUB_ID '5' (pc-sections/section5.js와 동일)
   - 상단 도구 영역: 이름 검색 + 초성 필터 + 인원 수
   - 인물 카드: 초상 사진 + 이름 오버레이, 사진 누락 시 이름 첫 글자 모노그램 표시
   - 상세 모달: 상세 API 1회 호출 후 캐시, 로딩 중 스켈레톤 표시
======================================================= */
import { fetchDailyLifeData, MAP_ENDPOINTS } from "/api/mapService.js";
import { getInitialConsonant } from "/js/utils/uiUtils.js";

const CONSONANTS = [
  "ㄱ",
  "ㄴ",
  "ㄷ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅅ",
  "ㅇ",
  "ㅈ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
];

// 상세 API 응답 캐시 (poiId → 상세 정보)
const detailCache = new Map();

export async function initMobileSection5() {
  const grid = document.getElementById("mobile-activist-grid");
  if (!grid) return;

  const searchInput = document.getElementById("mobile-activist-search");
  const filterBar = document.getElementById("mobile-activist-filters");
  const countLabel = document.getElementById("mobile-activist-count");

  const modal = createActivistModal();
  const modalBody = modal.querySelector(".mobile-modal-body");

  try {
    const geojsonData = await fetchDailyLifeData();
    const activists = geojsonData.features
      .filter((f) => String(f.properties.COT_THEME_SUB_ID) === "5")
      .map((f) => toActivist(f.properties))
      .sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));

    // 1. 초성 필터: 데이터에 존재하는 초성만 버튼 생성
    const usedInitials = new Set(activists.map((a) => a.initial));
    const filters = ["all", ...CONSONANTS.filter((c) => usedInitials.has(c))];
    filterBar.innerHTML = filters
      .map(
        (f) => `
      <button type="button" class="activist-filter" data-filter="${f}" aria-pressed="${f === "all"}">${f === "all" ? "전체" : f}</button>
    `,
      )
      .join("");

    // 상세 모달 열기: 스켈레톤 즉시 표시 → 상세 API 응답 후 교체
    const openProfile = async (person) => {
      modalBody.dataset.poiId = person.poiId; // 비동기 응답 경합 방지용 대상 식별
      modalBody.innerHTML = renderProfile(person, null);
      modal.classList.add("active");

      if (!person.poiId) {
        modalBody.innerHTML = renderProfile(person, {});
        return;
      }

      try {
        const detail = await fetchActivistDetail(person.poiId);
        // 응답 전 다른 인물로 전환된 경우 갱신 생략
        if (modalBody.dataset.poiId === person.poiId)
          modalBody.innerHTML = renderProfile(person, detail);
      } catch (error) {
        console.error(`상세 API 호출 실패 (${person.name}):`, error);
        if (modalBody.dataset.poiId === person.poiId)
          modalBody.innerHTML = renderProfile(person, { error: true });
      }
    };

    // 2. 인물 카드 렌더링 (전체 1회 생성 후 필터 시 hidden 토글)
    grid.innerHTML = "";
    activists.forEach((person) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "mobile-activist-card";
      card.innerHTML = `
        <span class="activist-portrait">
          <span class="activist-monogram" aria-hidden="true">${person.name.charAt(0)}</span>
          ${
            person.imgUrl
              ? `<img src="${person.imgUrl}" alt="" loading="lazy" decoding="async"
            onerror="this.closest('.mobile-activist-card').classList.add('is-noimg'); this.remove();">`
              : ""
          }
        </span>
        <span class="activist-name">${person.name}</span>
      `;
      if (!person.imgUrl) card.classList.add("is-noimg");
      card.addEventListener("click", () => openProfile(person));
      person.card = card;
      grid.appendChild(card);
    });

    // 3. 검색·초성 필터 적용
    let activeFilter = "all";
    const emptyMsg = document.createElement("p");
    emptyMsg.className = "mobile-empty-msg";
    emptyMsg.textContent = "검색 결과가 없습니다.";

    const applyFilter = () => {
      const keyword = searchInput.value.trim();
      let visible = 0;
      activists.forEach((person) => {
        const match =
          (activeFilter === "all" || person.initial === activeFilter) &&
          (!keyword || person.name.includes(keyword));
        person.card.hidden = !match;
        if (match) visible++;
      });
      countLabel.textContent = `${visible}명`;
      if (visible === 0) grid.appendChild(emptyMsg);
      else emptyMsg.remove();
    };

    filterBar.addEventListener("click", (e) => {
      const btn = e.target.closest(".activist-filter");
      if (!btn) return;
      activeFilter = btn.dataset.filter;
      filterBar
        .querySelectorAll(".activist-filter")
        .forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      applyFilter();
    });
    searchInput.addEventListener("input", applyFilter);

    applyFilter();
  } catch (error) {
    console.error("모바일 독립운동가 데이터를 불러오는 중 오류 발생:", error);
    grid.innerHTML =
      '<p class="mobile-empty-msg">데이터를 불러올 수 없습니다.</p>';
  }
}

/* -------------------------------------------------------
   API 속성 → 인물 데이터 변환
   - 이미지: 상대경로 → 절대경로, http → 이미지 프록시(weserv) 경유
   - 사료 링크: COT_EXTRA_DATA_02 미존재 시 한국근대사료DB 이름 검색 링크
------------------------------------------------------- */
function toActivist(props) {
  const name = props.COT_CONTS_NAME || "무명 열사";

  let imgUrl = props.COT_IMG_MAIN_URL || props.IMG_MAIN_URL || "";
  if (imgUrl && !imgUrl.startsWith("http")) {
    imgUrl =
      "https://map.seoul.go.kr" + (imgUrl.startsWith("/") ? "" : "/") + imgUrl;
  }
  if (imgUrl.startsWith("http://")) {
    imgUrl = "https://images.weserv.nl/?url=" + encodeURIComponent(imgUrl);
  }

  let historyUrl = props.COT_EXTRA_DATA_02 || props.EXTRA_DATA_02 || "";
  if (!historyUrl || !historyUrl.startsWith("http")) {
    historyUrl = `https://db.history.go.kr/modern/ia/level.do?nameKr=${encodeURIComponent(name)}&orderColumn=person_id&recordCountPerPage=20&pageIndex=1`;
  } else {
    historyUrl = historyUrl.replace("http://", "https://");
  }

  return {
    name,
    initial: getInitialConsonant(name),
    poiId: props.COT_CONTS_ID || "",
    imgUrl,
    historyUrl,
  };
}

/* -------------------------------------------------------
   상세 API 호출 (poiId 기준 캐시)
   - NAME_xx 라벨 매칭 → 대응 VALUE_xx, 미매칭 시 COT_VALUE_xx 직접 조회
------------------------------------------------------- */
async function fetchActivistDetail(poiId) {
  if (detailCache.has(poiId)) return detailCache.get(poiId);

  const baseUrl = MAP_ENDPOINTS.themeData_100173.split("/public/")[0];
  const response = await fetch(
    `${baseUrl}/public/themes/contents/detail?theme_id=100173&conts_id=${poiId}`,
  );
  const detailData = await response.json();
  const dProps = detailData?.body?.[0] || {};

  const getSafeValue = (labelKw, directCotKey) => {
    for (const key in dProps) {
      if (key.includes("NAME_") && String(dProps[key]).includes(labelKw)) {
        const val = dProps[key.replace("NAME_", "VALUE_")];
        if (val && val !== "null" && String(val).trim() !== "") return val;
      }
    }
    const directVal = dProps[directCotKey];
    return directVal && directVal !== "null" && String(directVal).trim() !== ""
      ? directVal
      : "";
  };

  const detail = {
    sinbun: getSafeValue("신분", "COT_VALUE_02"),
    sagun: getSafeValue("사건개요", "COT_VALUE_03"),
    pangyul: getSafeValue("판결날", "COT_VALUE_04"),
    joemyung: getSafeValue("죄명", "COT_VALUE_05"),
  };
  detailCache.set(poiId, detail);
  return detail;
}

/* -------------------------------------------------------
   상세 모달 마크업
   - detail null: 로딩 스켈레톤 / error: 오류 문구 / 그 외: 상세 정보
------------------------------------------------------- */
function renderProfile(person, detail) {
  const photo = `
    <div class="activist-profile-photo${person.imgUrl ? "" : " is-noimg"}">
      <span class="activist-monogram" aria-hidden="true">${person.name.charAt(0)}</span>
      ${person.imgUrl ? `<img src="${person.imgUrl}" alt="${person.name} 사진" onerror="this.parentNode.classList.add('is-noimg'); this.remove();">` : ""}
    </div>
  `;

  let body;
  if (detail === null) {
    body = `
      <div class="activist-skeleton" aria-label="상세 정보를 불러오는 중">
        <span></span><span></span><span></span>
      </div>
    `;
  } else if (detail.error) {
    body =
      '<p class="mobile-modal-status is-error">정보를 불러올 수 없습니다.</p>';
  } else {
    const rows = [
      ["사건 개요", detail.sagun],
      ["판결일", detail.pangyul],
      ["죄명", detail.joemyung],
    ].filter(([, v]) => v);
    body = rows.length
      ? `<dl class="activist-profile-info">${rows.map(([k, v]) => `<div class="info-row"><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`
      : '<p class="mobile-modal-status">등록된 상세 정보가 없습니다.</p>';
  }

  const sinbun =
    detail && detail.sinbun
      ? `<p class="activist-profile-role">${detail.sinbun}</p>`
      : "";

  return `
    <article class="activist-profile">
      <header class="activist-profile-head">
        ${photo}
        <div class="activist-profile-meta">
          <span class="activist-profile-label">독립운동가</span>
          <h3 class="mobile-modal-title">${person.name}</h3>
          ${sinbun}
        </div>
      </header>
      ${body}
      <a href="${person.historyUrl}" target="_blank" rel="noopener noreferrer" class="mobile-btn nikh-btn activist-profile-link">한국근대사료DB 기록 보기</a>
    </article>
  `;
}

/* -------------------------------------------------------
   상세 모달(하단 시트) 마크업 1회 생성
   - 공통 모달 클래스(.mobile-modal-*) 사용, 시트 바깥 탭 시 닫기
------------------------------------------------------- */
function createActivistModal() {
  let modal = document.getElementById("mobile-activist-modal");
  if (modal) return modal;

  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div id="mobile-activist-modal" class="mobile-modal-overlay">
      <div class="mobile-modal-container">
        <button type="button" class="mobile-modal-close" aria-label="닫기">&times;</button>
        <div class="mobile-modal-body"></div>
      </div>
    </div>
  `,
  );
  modal = document.getElementById("mobile-activist-modal");

  const close = () => modal.classList.remove("active");
  modal.querySelector(".mobile-modal-close").addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  return modal;
}