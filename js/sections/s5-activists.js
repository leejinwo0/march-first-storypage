/* =======================================================
   05 독립의 별들: 인물 지도 + 프로필 + 검색 바 + 인물 카드
   - 데이터: 생활 속 현장 테마(100173) 중 COT_THEME_SUB_ID '5'
   - 카드·마커 클릭 → 지도 이동 + 프로필 표시 (상세 API 1회 호출 후 캐시)
   - 이름 검색 + 초성 필터 → 카드·마커 동시 필터링, 인원 수 갱신
   - 전체 보기 버튼: 인물 선택 상태 또는 기본 줌보다 확대된 상태에서 표시
======================================================= */
import { fetchDailyLifeData, MAP_ENDPOINTS } from "/services/mapService.js";
import { createStoryMap } from "/js/utils/mapUtils.js";
import {
  getInitialConsonant,
  setStat,
  toSafeImageUrl,
} from "/js/utils/uiUtils.js";

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
const DEFAULT_MAX_ZOOM = 10;
const FOCUS_ZOOM = 10;
const detailCache = new Map();

// 상세 API: NAME_xx 라벨 매칭 → 대응 VALUE_xx, 미매칭 시 COT_VALUE_xx 직접 조회
async function fetchDetail(poiId) {
  if (detailCache.has(poiId)) return detailCache.get(poiId);
  const baseUrl = MAP_ENDPOINTS.themeData_100173.split("/public/")[0];
  const res = await fetch(
    `${baseUrl}/public/themes/contents/detail?theme_id=100173&conts_id=${poiId}`,
  );
  const data = await res.json();
  const d = data?.body?.[0] || {};
  const pick = (label, directKey) => {
    for (const key in d) {
      if (key.includes("NAME_") && String(d[key]).includes(label)) {
        const val = d[key.replace("NAME_", "VALUE_")];
        if (val && val !== "null" && String(val).trim()) return val;
      }
    }
    const direct = d[directKey];
    return direct && direct !== "null" && String(direct).trim() ? direct : "";
  };
  const detail = {
    sinbun: pick("신분", "COT_VALUE_02"),
    sagun: pick("사건개요", "COT_VALUE_03"),
    pangyul: pick("판결날", "COT_VALUE_04"),
    joemyung: pick("죄명", "COT_VALUE_05"),
  };
  detailCache.set(poiId, detail);
  return detail;
}

export async function initActivists() {
  const rail = document.getElementById("s5-rail");
  const profile = document.getElementById("s5-profile");
  const searchInput = document.getElementById("s5-search");
  const filterBar = document.getElementById("s5-filters");
  const countEl = document.getElementById("s5-count");
  const resetBtn = document.getElementById("s5-reset");
  if (!rail || !profile || !document.getElementById("map-s5")) return;

  // 정수 줌 고정 / 더블클릭 확대 비활성: 마커 연속 클릭 시 추가 확대 방지
  const { map } = createStoryMap("map-s5", {
    center: [37.577613, 126.976897],
    zoom: DEFAULT_MAX_ZOOM,
    mapOptions: { zoomSnap: 1, doubleClickZoom: false },
  });

  const geojson = await fetchDailyLifeData();
  const people = geojson.features
    .filter((f) => String(f.properties.COT_THEME_SUB_ID) === "5")
    .map((f) => f.properties)
    .filter((p) => p.COT_COORD_Y && p.COT_COORD_X)
    .map((p) => {
      const name = p.COT_CONTS_NAME || "무명 열사";
      let historyUrl = p.COT_EXTRA_DATA_02 || p.EXTRA_DATA_02 || "";
      historyUrl = historyUrl.startsWith("http")
        ? historyUrl.replace("http://", "https://")
        : `https://db.history.go.kr/modern/ia/level.do?nameKr=${encodeURIComponent(name)}&orderColumn=person_id&recordCountPerPage=20&pageIndex=1`;
      return {
        name,
        initial: getInitialConsonant(name),
        address: p.COT_ADDR_FULL_NEW || p.COT_ADDR_FULL_OLD || "활동 지역 불명",
        imgUrl: toSafeImageUrl(p.COT_IMG_MAIN_URL || p.IMG_MAIN_URL),
        poiId: p.COT_CONTS_ID || "",
        latlng: [parseFloat(p.COT_COORD_Y), parseFloat(p.COT_COORD_X)],
        historyUrl,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));

  setStat("activist", people.length);
  if (countEl) countEl.textContent = people.length;

  const defaultBounds = people.length
    ? L.latLngBounds(people.map((p) => p.latlng))
    : null;
  const showAll = (animate = true) => {
    if (defaultBounds)
      map.fitBounds(defaultBounds, {
        padding: [40, 40],
        maxZoom: DEFAULT_MAX_ZOOM,
        animate,
      });
    map.closePopup();
  };

  let activePerson = null;

  // 전체 보기 버튼: 인물 선택 상태 또는 기본 줌보다 확대된 상태에서 표시
  const updateReset = () =>
    resetBtn?.classList.toggle(
      "show",
      !!activePerson || map.getZoom() > DEFAULT_MAX_ZOOM,
    );

  // 선택 해제 + 전체 보기
  const clearSelection = () => {
    activePerson = null;
    people.forEach((p) => p.card.classList.remove("active"));
    showAll();
    updateReset();
  };

  // 프로필 패널 렌더링 (detail: null 로딩 / error / 데이터)
  function renderProfile(person, detail) {
    const photo = person.imgUrl
      ? `<img src="${person.imgUrl}" alt="${person.name} 사진" onerror="this.parentNode.classList.add('is-empty'); this.remove();">`
      : "";
    let rows;
    if (detail === null) {
      rows =
        '<div class="profile-skeleton" aria-label="상세 정보를 불러오는 중"><span></span><span></span><span></span></div>';
    } else if (detail.error) {
      rows = '<p class="status-text">상세 정보를 불러올 수 없습니다.</p>';
    } else {
      const items = [
        ["신분", detail.sinbun],
        ["사건 개요", detail.sagun],
        ["판결일", detail.pangyul],
        ["죄명", detail.joemyung],
      ].filter(([, v]) => v);
      rows = items.length
        ? `<dl class="profile-info">${items.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`
        : '<p class="status-text">등록된 상세 정보가 없습니다.</p>';
    }
    const mapLink = `https://map.seoul.go.kr/smgis2/poiViewMap?ti=100173&pi=${person.poiId}&lang=ko`;
    profile.innerHTML = `
      <div class="profile-head">
        <div class="profile-photo${person.imgUrl ? "" : " is-empty"}"><span aria-hidden="true">${person.name.charAt(0)}</span>${photo}</div>
        <div>
          <p class="profile-label">독립운동가</p>
          <h3 class="profile-name">${person.name}</h3>
          <p class="profile-addr">${person.address}</p>
        </div>
      </div>
      ${rows}
      <div class="profile-btns">
        <a class="line-btn line-btn-red" href="${mapLink}" target="_blank" rel="noopener noreferrer">스마트서울맵</a>
        <a class="line-btn line-btn-red" href="${person.historyUrl}" target="_blank" rel="noopener noreferrer">일제감시대상인물카드 보기 ↗</a>
      </div>
    `;
  }

  async function select(person) {
    // 재클릭: 선택 해제 + 전체 보기
    if (activePerson === person) return clearSelection();

    activePerson = person;
    people.forEach((p) => p.card.classList.toggle("active", p === person));
    person.card.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
    map.setView(person.latlng, FOCUS_ZOOM, { animate: true });
    person.marker.openPopup();
    updateReset();

    renderProfile(person, null);
    if (!person.poiId) return renderProfile(person, {});
    try {
      const detail = await fetchDetail(person.poiId);
      if (activePerson === person) renderProfile(person, detail);
    } catch (error) {
      console.error(`상세 API 호출 실패 (${person.name}):`, error);
      if (activePerson === person) renderProfile(person, { error: true });
    }
  }

  // 1. 카드 + 마커 생성
  people.forEach((person) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "person-card";
    card.innerHTML = `
      <span class="person-photo${person.imgUrl ? "" : " is-empty"}">
        <span class="person-mono" aria-hidden="true">${person.name.charAt(0)}</span>
        ${person.imgUrl ? `<img src="${person.imgUrl}" alt="" loading="lazy" onerror="this.parentNode.classList.add('is-empty'); this.remove();">` : ""}
      </span>
      <span class="person-name">${person.name}</span>
    `;
    card.addEventListener("click", () => select(person));
    rail.appendChild(card);
    person.card = card;

    person.marker = L.marker(person.latlng, {
      icon: L.divIcon({
        className: "person-pin-wrap",
        html: '<span class="person-pin"></span>',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      }),
    }).addTo(map);
    person.marker.bindTooltip(person.name, {
      className: "place-tooltip",
      direction: "top",
      offset: [0, -34],
    });
    person.marker.on("popupopen", () => person.marker.closeTooltip());
    person.marker.bindPopup(`<p class="popup-mini-title">${person.name}</p>`, {
      className: "story-popup story-popup-mini",
      offset: [0, -30],
      closeButton: false,
      autoPan: false,
    });
    person.marker.on("click", () => select(person));
  });

  if (people.length === 0)
    rail.innerHTML =
      '<p class="status-text">인물 정보를 불러올 수 없습니다.</p>';

  // 2. 초성 필터 칩 (ㄱ~ㅎ 14종 전체 생성)
  filterBar.innerHTML = ["all", ...CONSONANTS]
    .map(
      (c) =>
        `<button type="button" class="consonant-chip" data-filter="${c}" aria-pressed="${c === "all"}">${c === "all" ? "전체" : c}</button>`,
    )
    .join("");

  let activeFilter = "all";
  function applyFilter() {
    const keyword = searchInput.value.trim();
    let visible = 0;
    people.forEach((p) => {
      const match =
        (activeFilter === "all" || p.initial === activeFilter) &&
        (!keyword || p.name.includes(keyword));
      p.card.hidden = !match;
      if (match) {
        visible++;
        if (!map.hasLayer(p.marker)) p.marker.addTo(map);
      } else if (map.hasLayer(p.marker)) {
        map.removeLayer(p.marker);
      }
    });
    countEl.textContent = visible;
    rail.scrollTo({ left: 0, behavior: "smooth" });
  }

  filterBar.addEventListener("click", (e) => {
    const btn = e.target.closest(".consonant-chip");
    if (!btn) return;
    activeFilter = btn.dataset.filter;
    filterBar
      .querySelectorAll(".consonant-chip")
      .forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    searchInput.value = "";
    applyFilter();
  });
  searchInput.addEventListener("input", () => {
    activeFilter = "all";
    filterBar
      .querySelectorAll(".consonant-chip")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.filter === "all")),
      );
    applyFilter();
  });

  // 3. 카드 이동 버튼 · 전체 보기
  document
    .getElementById("s5-prev")
    ?.addEventListener("click", () =>
      rail.scrollBy({ left: -rail.clientWidth * 0.8, behavior: "smooth" }),
    );
  document
    .getElementById("s5-next")
    ?.addEventListener("click", () =>
      rail.scrollBy({ left: rail.clientWidth * 0.8, behavior: "smooth" }),
    );

  map.on("zoomend", updateReset);
  resetBtn?.addEventListener("click", clearSelection);

  setTimeout(() => {
    map.invalidateSize();
    showAll(false);
  }, 400);
}
