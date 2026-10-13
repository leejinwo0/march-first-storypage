/* =======================================================
   Mobile Card 4: 함성의 궤적 시위 경로 카드
   - 데이터·그룹·필드 매핑: pc-sections/section3.js와 동일 (스마트서울맵 테마 API 11100550)
   - 경로 영역: 스마트서울맵 지도 + 경로 라인 (카드가 화면에 들어올 때 지도 생성)
   - 지도 API 로드 실패 시 SVG 경로 그림으로 대체 표시
   - 경유지(val1) 세로 스텝 표시, 상세 설명(val2) 접기/펼치기
======================================================= */
import { fetchTimeTravelData, MAP_ENDPOINTS } from "/api/mapService.js";

// SVG 뷰박스 크기 (CSS에서 width 100%)
const SVG_W = 320;
const SVG_H = 140;
const SVG_PAD = 22;

/**
 * @param {Promise} mapApiReady - loadSeoulMapAPI() 반환 Promise (index.js에서 전달)
 */
export async function initMobileSection3(mapApiReady = Promise.reject()) {
  const routeList = document.getElementById("mobile-s3-routes");
  if (!routeList) return;

  // 스텝 구성: pc-sections/section3.js sc3Groups와 동일
  const sc3Groups = [
    { id: "east-1", targetIds: ["22"] },
    { id: "east-2", targetIds: ["14"] },
    { id: "west-1", targetIds: ["21"] },
    { id: "west-2", targetIds: ["20"] },
    { id: "west-3", targetIds: ["19"] },
    { id: "march5-1", targetIds: ["8"] },
    { id: "march5-2", targetIds: ["4"] },
  ];

  try {
    const sc3Data = await fetchTimeTravelData();

    // 1. 그룹 순서대로 경로 Feature 수집 (PC와 동일 ID 매칭: feature.id 또는 RNUM)
    const targetFeatures = [];
    sc3Groups.forEach((group) => {
      const feature = sc3Data.features.find(
        (f) =>
          String(f.id) === group.targetIds[0] ||
          String(f.properties.RNUM) === group.targetIds[0],
      );
      if (feature && feature.geometry.type === "LineString")
        targetFeatures.push(feature);
    });

    if (targetFeatures.length === 0) throw new Error("경로 데이터 없음");

    // 2. 카드 데이터 구성 (PC timelineData와 동일 필드)
    const timelineData = targetFeatures.map((feature) => {
      const props = feature.properties;
      return {
        id: String(feature.id || props.RNUM),
        title: props.COT_CONTS_NAME || "제목 없음",
        val1: props.COT_VALUE_01 || "",
        val2: props.COT_VALUE_03
          ? String(props.COT_VALUE_03).replace(/\n/g, "<br>")
          : "",
        coords: feature.geometry.coordinates,
      };
    });

    routeList.innerHTML = "";

    // 3. 경로 카드 렌더링
    timelineData.forEach((item, index) => {
      const stops = parseStops(item.val1);
      const svg = buildRouteSketch(timelineData, index);

      const stopsHTML = stops.length
        ? `<ol class="route-stops">${stops
            .map(
              (s, i) => `
            <li class="route-stop${i === 0 ? " is-start" : ""}${i === stops.length - 1 ? " is-end" : ""}">
              <span class="route-stop-name">${s}</span>
              ${i === 0 ? '<span class="route-stop-tag">출발</span>' : ""}
              ${i === stops.length - 1 ? '<span class="route-stop-tag">도착</span>' : ""}
            </li>`,
            )
            .join("")}
          </ol>`
        : "";

      const descHTML = item.val2
        ? `<details class="route-desc">
            <summary>상세 설명</summary>
            <p>${item.val2}</p>
          </details>`
        : "";

      const card = document.createElement("article");
      card.className = "mobile-route-card";
      card.dataset.featureId = item.id;
      card.innerHTML = `
        <header class="route-head">
          <span class="route-num">${String(index + 1).padStart(2, "0")}</span>
          <h3 class="route-title">${item.title}</h3>
          ${stops.length ? `<span class="route-count">${stops.length}곳 경유</span>` : ""}
        </header>
        <div class="route-map">
          ${svg}
          <div class="route-map-canvas"></div>
        </div>
        ${stopsHTML}
        ${descHTML}
      `;
      routeList.appendChild(card);
    });

    // 4. 지도 API 로드 완료 시 카드별 지도 지연 생성 (화면 진입 시점)
    mapApiReady
      .then(() => {
        if (typeof getCrsEx !== "function" || !L.TileLayer.DAWULGIS_EX) return; // API 키 미설정
        observeRouteMaps(routeList, timelineData);
      })
      .catch((err) => console.warn("모바일 경로 지도 미표시 (SVG 대체):", err));
  } catch (error) {
    console.error("모바일 Section 3 데이터를 불러오는 중 오류 발생:", error);
    routeList.innerHTML =
      '<p class="mobile-empty-msg">데이터를 불러올 수 없습니다.</p>';
  }
}

/* -------------------------------------------------------
   카드별 스마트서울맵 지도 지연 생성
   - IntersectionObserver: 카드가 화면에 들어올 때 1회 생성 (지도 7개 동시 로드 방지)
   - 조작 비활성(정적 지도): Swiper 스와이프·목록 스크롤 제스처 충돌 방지
------------------------------------------------------- */
function observeRouteMaps(routeList, timelineData) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);

        const index = [...routeList.children].indexOf(entry.target);
        const canvas = entry.target.querySelector(".route-map-canvas");
        if (canvas && timelineData[index])
          createRouteMap(canvas, timelineData, index);
      });
    },
    { rootMargin: "120px 0px" },
  );

  routeList
    .querySelectorAll(".mobile-route-card")
    .forEach((card) => observer.observe(card));
}

function createRouteMap(canvas, timelineData, activeIndex) {
  const toLatLngs = (coords) => coords.map(([lng, lat]) => [lat, lng]);
  const active = toLatLngs(timelineData[activeIndex].coords);

  const map = L.map(canvas, {
    crs: getCrsEx(),
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    touchZoom: false,
    doubleClickZoom: false,
    scrollWheelZoom: false,
    boxZoom: false,
    keyboard: false,
    tap: false,
  });

  new L.TileLayer.DAWULGIS_EX(MAP_ENDPOINTS.seoulBaseMap_kor, {
    minZoom: 1,
    maxZoom: 15,
  }).addTo(map);

  // 다른 경로: 반투명 검정 (PC section3 비활성 경로 스타일과 동일)
  timelineData.forEach((d, i) => {
    if (i === activeIndex) return;
    L.polyline(toLatLngs(d.coords), {
      color: "#000000",
      weight: 3,
      opacity: 0.2,
      interactive: false,
    }).addTo(map);
  });

  // 해당 경로: 빨간 점선 + dash 흐름 애니메이션 (CSS .route-map-line)
  L.polyline(active, {
    color: "#ff0000",
    weight: 4,
    dashArray: "10, 8",
    lineCap: "round",
    className: "route-map-line",
    interactive: false,
  }).addTo(map);

  // 출발(골드)·도착(레드) 지점
  const pointStyle = {
    radius: 6,
    color: "#ffffff",
    weight: 2,
    fillOpacity: 1,
    interactive: false,
  };
  L.circleMarker(active[0], { ...pointStyle, fillColor: "#b8922e" }).addTo(map);
  L.circleMarker(active[active.length - 1], {
    ...pointStyle,
    fillColor: "#a83228",
  }).addTo(map);

  map.fitBounds(L.latLngBounds(active), { padding: [24, 24], maxZoom: 13 });
  canvas.closest(".route-map").classList.add("is-map-ready");
}

/* -------------------------------------------------------
   경유지 문자열 → 배열
   예: "파고다 공원 - 동쪽 - 창덕궁 앞" → ['파고다 공원', '동쪽', '창덕궁 앞']
------------------------------------------------------- */
function parseStops(raw) {
  if (!raw) return [];
  return String(raw)
    .replace(/^"|"$/g, "")
    .split(/\s+-\s+|→|->|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/* -------------------------------------------------------
   경로 형태 SVG 생성 (지도 로드 전 자리 표시 / API 실패 시 대체)
   - 배경: 다른 경로(회색, 같은 축척으로 그려 뷰박스 밖 영역 잘림)
   - 전경: 해당 경로(빨간 점선) + 출발점(골드)·도착점(레드)
------------------------------------------------------- */
function buildRouteSketch(timelineData, activeIndex) {
  const coords = timelineData[activeIndex].coords;
  const project = createProjector(coords);
  const toPath = (line) =>
    line
      .map((c, i) => {
        const [x, y] = project(c);
        return `${i === 0 ? "M" : "L"}${x} ${y}`;
      })
      .join(" ");

  const [sx, sy] = project(coords[0]);
  const [ex, ey] = project(coords[coords.length - 1]);

  return `
    <svg class="route-sketch" viewBox="0 0 ${SVG_W} ${SVG_H}" aria-hidden="true">
      ${timelineData.map((d, i) => (i === activeIndex ? "" : `<path d="${toPath(d.coords)}" class="route-sketch-bg" />`)).join("")}
      <path d="${toPath(coords)}" class="route-sketch-active" />
      <circle cx="${sx}" cy="${sy}" r="5" class="route-sketch-start" />
      <circle cx="${ex}" cy="${ey}" r="5" class="route-sketch-end" />
    </svg>
  `;
}

/* -------------------------------------------------------
   경도·위도 → SVG 좌표 변환 함수 생성
   - 기준 경로 범위를 뷰박스(여백 SVG_PAD 제외)에 맞춤
   - 위도 보정(cos φ)으로 동서 방향 왜곡 최소화
------------------------------------------------------- */
function createProjector(pts) {
  const lngs = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  const minLng = Math.min(...lngs),
    maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats),
    maxLat = Math.max(...lats);
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);

  const spanX = (maxLng - minLng) * kx || 1e-6;
  const spanY = maxLat - minLat || 1e-6;
  const scale = Math.min(
    (SVG_W - SVG_PAD * 2) / spanX,
    (SVG_H - SVG_PAD * 2) / spanY,
  );
  const offX = (SVG_W - spanX * scale) / 2;
  const offY = (SVG_H - spanY * scale) / 2;

  return ([lng, lat]) => [
    +(offX + (lng - minLng) * kx * scale).toFixed(1),
    +(offY + (maxLat - lat) * scale).toFixed(1),
  ];
}