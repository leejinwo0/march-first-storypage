/* =======================================================
   02 거사의 맹세: 단계 버튼 + 상세 카드 + 지도
   - 데이터: 스마트서울맵 테마 11100550 (start_xx 거점 9곳)
   - 단계 버튼·마커 클릭 → 카드 갱신, 해당 마커로 이동, 경로선 해당 단계까지 표시
   - 경성대지도 전환 시 줌 1.5단계 보정
======================================================= */
import { fetchTimeTravelData } from "/api/mapService.js";
import { createStoryMap, generateCurvedPath } from "/js/utils/mapUtils.js";
import {
  getImageCandidates,
  attachImageFallback,
  setStat,
} from "/js/utils/uiUtils.js";

// 타임라인 표시 순서 (테마 콘텐츠 ID)
const TARGET_IDS = [
  "start_01",
  "start_02",
  "start_03",
  "start_04",
  "start_08",
  "start_05",
  "start_09",
  "start_07",
  "start_13",
];

const DEFAULT_ZOOM = 10;
const TARGET_ZOOM = 12;

// COT_VALUE 텍스트 정리: 앞뒤 따옴표 제거, " - " 항목 구분 → 줄 단위 배열
const toLines = (value) =>
  String(value || "")
    .trim()
    .replace(/^"|"$/g, "")
    .replace(/ - /g, "\n- ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

export async function initPledge() {
  const nav = document.getElementById("s2-nav");
  const card = document.getElementById("s2-card");
  if (!nav || !card || !document.getElementById("map-s2")) return;

  const { map, zoomFor } = createStoryMap("map-s2", {
    center: [37.5759, 126.985],
    zoom: DEFAULT_ZOOM,
    zoomOffset: 1.5,
    mapOptions: { closePopupOnClick: false },
  });

  const pathLine = L.polyline([], {
    color: "#a83228",
    weight: 3,
    dashArray: "8, 8",
    lineJoin: "round",
  }).addTo(map);

  const geojson = await fetchTimeTravelData();

  const steps = TARGET_IDS.map((id) => {
    const feature = geojson.features.find(
      (f) => f.properties.COT_CONTS_ID === id,
    );
    if (!feature) return null;
    const props = feature.properties;
    const coords =
      feature.geometry.type === "Point" ? feature.geometry.coordinates : null;
    return {
      id,
      title: props.COT_CONTS_NAME || "지명 없음",
      infoLines: toLines(props.COT_VALUE_01),
      bodyLines: toLines(props.COT_VALUE_03),
      addrNew: props.COT_ADDR_FULL_NEW || "현재 주소 정보 없음",
      addrOld: props.COT_ADDR_FULL_OLD || "옛 주소 정보 없음",
      images: getImageCandidates(props),
      pos: coords ? [coords[1], coords[0]] : null,
    };
  }).filter(Boolean);

  // 수치 띠 '3.1운동 준비' 갱신
  setStat("pledge", steps.length);

  if (steps.length === 0) {
    card.innerHTML =
      '<p class="status-text">거점 정보를 불러올 수 없습니다.</p>';
    return;
  }

  // 1. 단계 버튼
  nav.innerHTML = steps
    .map(
      (step, i) =>
        `<button type="button" class="step-btn" data-index="${i}" aria-label="${i + 1}번째 장소: ${step.title}">${i + 1}</button>`,
    )
    .join("");
  const navBtns = [...nav.querySelectorAll(".step-btn")];

  // 2. 지도 마커 (번호 원형)
  const markers = steps.map((step, i) => {
    if (!step.pos) return null;
    const icon = L.divIcon({
      className: "step-marker-wrap",
      html: `<span class="step-marker" data-index="${i}">${i + 1}</span>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
    const marker = L.marker(step.pos, { icon }).addTo(map);
    marker.bindPopup(`<p class="popup-mini-title">${step.title}</p>`, {
      className: "story-popup story-popup-mini",
      offset: [0, -14],
      closeButton: false,
      autoClose: false,
      closeOnClick: false,
    });
    marker.on("click", () => activate(i, true));
    return marker;
  });

  let currentIndex = -1;

  // 3. 상세 카드 렌더링
  function renderCard(step, index) {
    const mapLink = `https://map.seoul.go.kr/smgis2/poiViewMap?ti=11100550&pi=${step.id}&lang=ko`;
    const sajeokLink = `http://sajeok.i815.or.kr/i815/search_list?keyword=${encodeURIComponent(step.title)}`;
    const info = step.infoLines.length
      ? `<ul class="pledge-info">${step.infoLines.map((l) => `<li>${l.replace(/^-\s*/, "")}</li>`).join("")}</ul>`
      : "";
    const body = step.bodyLines.length
      ? `<p class="pledge-body">${step.bodyLines.join("<br>")}</p>`
      : "";

    card.innerHTML = `
      <p class="pledge-step">STEP ${String(index + 1).padStart(2, "0")} / ${String(steps.length).padStart(2, "0")}</p>
      <h3 class="pledge-title">${step.title}</h3>
      ${step.images.length ? `<button type="button" class="pledge-photo"><img src="${step.images[0]}" alt="${step.title}"></button>` : ""}
      <dl class="addr-box">
        <div><dt>현재</dt><dd>${step.addrNew}</dd></div>
        <div><dt>옛지명</dt><dd>${step.addrOld}</dd></div>
      </dl>
      ${info}
      ${body}
      ${!info && !body ? '<p class="pledge-body">상세 설명이 없습니다.</p>' : ""}
      <div class="btn-pair">
        <a class="line-btn line-btn-red" href="${mapLink}" target="_blank" rel="noopener noreferrer">스마트서울맵</a>
        <a class="line-btn line-btn-gold" href="${sajeokLink}" target="_blank" rel="noopener noreferrer">독립운동 사적지</a>
      </div>
    `;
    card.scrollTop = 0;

    // 이미지: 후보 URL 순차 시도, 전체 실패 시 사진 영역 제거 / 클릭 시 확대 모달
    const photo = card.querySelector(".pledge-photo");
    if (photo) {
      const img = photo.querySelector("img");
      attachImageFallback(img, step.images, () => photo.remove());
      photo.addEventListener("click", () =>
        window.openGlobalModal?.(img.src, step.title),
      );
    }
  }

  // 4. 단계 활성화: 카드·버튼·마커·경로선·지도 위치 갱신
  function activate(index, fromMarker = false) {
    const step = steps[index];
    const isSame = index === currentIndex;

    if (!isSame) {
      currentIndex = index;
      renderCard(step, index);
      navBtns.forEach((btn, i) => btn.classList.toggle("active", i === index));
      document.querySelectorAll("#map-s2 .step-marker").forEach((el) => {
        el.classList.toggle("is-active", Number(el.dataset.index) === index);
      });
      markers.forEach((m, i) => {
        if (!m) return;
        if (i === index) m.openPopup();
        else m.closePopup();
      });
      const visible = steps
        .slice(0, index + 1)
        .map((s) => s.pos)
        .filter(Boolean);
      pathLine.setLatLngs(generateCurvedPath(visible));
    }

    if (!step.pos) return;
    // 같은 마커 재클릭 시 기본 줌 복귀, 그 외 확대 줌
    const zoomValue =
      fromMarker && isSame && map.getZoom() > zoomFor(DEFAULT_ZOOM)
        ? zoomFor(DEFAULT_ZOOM)
        : zoomFor(TARGET_ZOOM);
    map.setView(step.pos, zoomValue, { animate: true, duration: 0.8 });
  }

  navBtns.forEach((btn) =>
    btn.addEventListener("click", () => activate(Number(btn.dataset.index))),
  );

  // 키보드: 방향키로 단계 이동 (단계 버튼 포커스 상태)
  nav.addEventListener("keydown", (e) => {
    if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key))
      return;
    e.preventDefault();
    const dir = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
    const next = Math.min(steps.length - 1, Math.max(0, currentIndex + dir));
    activate(next);
    navBtns[next].focus();
  });

  activate(0);
}
