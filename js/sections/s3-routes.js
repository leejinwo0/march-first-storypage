/* =======================================================
   03 함성의 궤적: 날짜별 경로 목록 + 기울어진 지도 레이어
   - 데이터: 스마트서울맵 테마 11100550 경로(LineString) 7종
   - 목록 클릭 → 활성 경로 강조(빨간 점선 흐름 애니메이션) + 출발/도착 마커 + 경유지 칩
   - 날짜 탭 전환 → 해당 날짜 첫 경로 활성화
======================================================= */
import { fetchTimeTravelData } from "/api/mapService.js";
import { createStoryMap } from "/js/utils/mapUtils.js";
import { setStat } from "/js/utils/uiUtils.js";

// 경로 구성: 날짜 · 구분 · 테마 콘텐츠 ID
const ROUTE_GROUPS = [
  { date: "0301", group: "3월 1일 · 동부", ids: ["22", "14"] },
  { date: "0301", group: "3월 1일 · 서부", ids: ["21", "20", "19"] },
  { date: "0305", group: "3월 5일 · 학생 시위", ids: ["8", "4"] },
];

const INACTIVE_STYLE = {
  color: "#000000",
  weight: 4,
  opacity: 0.2,
  dashArray: null,
};
const ACTIVE_STYLE = {
  color: "#ff3b2f",
  weight: 6,
  opacity: 1,
  dashArray: "15, 15",
};

// "출발지 - 경유지 - 도착지" 문자열 → 경유지 배열
const toStops = (value) =>
  String(value || "")
    .split(/\s*[-–→]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

export async function initRoutes() {
  const list = document.getElementById("s3-list");
  const tabs = document.querySelectorAll("#s3-tabs .seg-tab");
  const tag = document.getElementById("s3-tag");
  if (!list || !document.getElementById("map-s3")) return;

  // 기울어진 레이어 안 지도: 드래그·줌 비활성 (표시 전용), 레이어 전환 컨트롤만 사용
  const { map } = createStoryMap("map-s3", {
    zoom: 11,
    mapOptions: {
      dragging: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
      zoomSnap: 1,
    },
  });

  const geojson = await fetchTimeTravelData();
  const findFeature = (id) =>
    geojson.features.find(
      (f) => String(f.id) === id || String(f.properties.RNUM) === id,
    );

  const routes = [];
  ROUTE_GROUPS.forEach((group) => {
    group.ids.forEach((id) => {
      const feature = findFeature(id);
      if (!feature || feature.geometry.type !== "LineString") return;
      const props = feature.properties;
      const layer = L.geoJSON(feature, {
        style: INACTIVE_STYLE,
        interactive: false,
      }).addTo(map);
      routes.push({
        id,
        date: group.date,
        group: group.group,
        title: props.COT_CONTS_NAME || "제목 없음",
        stops: toStops(props.COT_VALUE_01),
        desc: props.COT_VALUE_03
          ? String(props.COT_VALUE_03).replace(/\n/g, "<br>")
          : "",
        coords: feature.geometry.coordinates.map(([x, y]) => [y, x]),
        layer,
      });
    });
  });

  setStat("route", routes.length);

  if (routes.length === 0) {
    list.innerHTML =
      '<p class="status-text">경로 정보를 불러올 수 없습니다.</p>';
    return;
  }

  // 1. 목록 렌더링 (구분 제목 + 경로 행)
  let html = "";
  let lastGroup = "";
  routes.forEach((route, i) => {
    if (route.group !== lastGroup) {
      if (lastGroup) html += "</div>";
      html += `<div class="route-group" data-date="${route.date}"><h3 class="route-group-title">${route.group}</h3>`;
      lastGroup = route.group;
    }
    html += `
      <div class="route-row" data-index="${i}">
        <button type="button" class="route-row-head" aria-expanded="false">
          <span class="route-row-title">${route.title}</span>
          <span class="route-row-step">STEP ${i + 1}</span>
        </button>
        <div class="route-row-body">
          ${route.stops.length ? `<div class="stop-chips">${route.stops.map((s, si) => `<span class="stop-chip${si === 0 ? " is-start" : si === route.stops.length - 1 ? " is-end" : ""}">${s}</span>`).join('<i aria-hidden="true">→</i>')}</div>` : ""}
          ${route.desc ? `<p class="route-desc">${route.desc}</p>` : ""}
        </div>
      </div>`;
  });
  html += "</div>";
  list.innerHTML = html;

  const rows = [...list.querySelectorAll(".route-row")];
  let endpointMarkers = [];
  let trail = null;
  let currentIndex = -1;

  const pointIcon = (type, label) =>
    L.divIcon({
      className: `route-point route-point-${type}`,
      html: `<span class="route-point-label">${label}</span><span class="route-point-dot"></span>`,
      iconSize: [40, 40],
      iconAnchor: [20, 34],
    });

  // 2. 경로 활성화
  function activate(index) {
    if (index === currentIndex) return;
    currentIndex = index;
    const route = routes[index];

    rows.forEach((row, i) => {
      const on = i === index;
      row.classList.toggle("active", on);
      row
        .querySelector(".route-row-head")
        .setAttribute("aria-expanded", String(on));
    });

    // Leaflet setStyle의 className은 최초 생성 시에만 반영 → SVG path에 classList 직접 적용
    routes.forEach((r, i) => {
      const on = i === index;
      r.layer.setStyle(on ? ACTIVE_STYLE : INACTIVE_STYLE);
      r.layer.eachLayer((l) =>
        l.getElement?.()?.classList.toggle("route-flow", on),
      );
    });

    if (trail) map.removeLayer(trail);
    trail = L.polyline(route.coords, {
      color: "#ff3b2f",
      weight: 6,
      opacity: 0.2,
      interactive: false,
    }).addTo(map);
    route.layer.bringToFront();

    endpointMarkers.forEach((m) => map.removeLayer(m));
    endpointMarkers = [
      L.marker(route.coords[0], { icon: pointIcon("start", "출발") }).addTo(
        map,
      ),
      L.marker(route.coords[route.coords.length - 1], {
        icon: pointIcon("end", "도착"),
      }).addTo(map),
    ];
    if (tag) tag.textContent = route.title;

    // 날짜 탭 동기화
    tabs.forEach((t) =>
      t.setAttribute("aria-selected", String(t.dataset.date === route.date)),
    );
    filterByDate(route.date);
  }

  // 3. 날짜 탭: 해당 날짜 구분만 표시
  function filterByDate(date) {
    list.querySelectorAll(".route-group").forEach((g) => {
      g.hidden = g.dataset.date !== date;
    });
  }

  rows.forEach((row) => {
    row
      .querySelector(".route-row-head")
      .addEventListener("click", () => activate(Number(row.dataset.index)));
  });

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const first = routes.findIndex((r) => r.date === tab.dataset.date);
      if (first >= 0) activate(first);
    });
  });

  // 전체 경로 범위로 화면 1회 고정
  const allBounds = L.latLngBounds(routes.flatMap((r) => r.coords));
  const fixView = () => {
    map.invalidateSize({ animate: false });
    map.fitBounds(allBounds, {
      padding: [40, 40],
      maxZoom: 11,
      animate: false,
    });
  };

  setTimeout(() => {
    fixView();
    activate(0);
  }, 300);

  // 섹션 진입 시 크기 재계산 (숨김 상태 초기화 대응, 1회)
  new IntersectionObserver(
    (entries, observer) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      fixView();
    },
    { threshold: 0.1 },
  ).observe(document.getElementById("map-s3"));
}
