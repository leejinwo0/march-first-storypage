/* =======================================================
   03 함성의 궤적: 구분별 경로 목록 + 기울어진 지도 레이어
   - 데이터: 스마트서울맵 테마 11100550 경로(LineString) 7종
   - 경로명 클릭 → 활성 경로 강조(빨간 점선 흐름 애니메이션) + 출발/도착 마커
   - '자세히 보기' 클릭 → 해당 경로 활성화 + 경유지 칩·설명 펼침/접힘 (한 번에 1개만 펼침)
   - 구분 탭(3월 1일 동부 / 3월 1일 서부 / 3월 5일) 전환 → 해당 구분 첫 경로 활성화
   - 지도 화면 고정: 전체 경로 범위로 맞춤, 경로 전환 시 이동·줌 없음
   - 큰 화면 확대 표시: 카드 너비가 기준 너비(MAP_BASE_W) 초과 시 기준 너비로 렌더링 후 CSS scale 확대
======================================================= */
import { fetchTimeTravelData } from "/services/mapService.js";
import { createStoryMap } from "/js/utils/mapUtils.js";
import { setStat } from "/js/utils/uiUtils.js";

// 경로 구성: 구분 key(탭 버튼 data-group 값과 일치) · 테마 콘텐츠 ID
const ROUTE_GROUPS = [
  { key: "east", ids: ["22", "14"] },
  { key: "west", ids: ["21", "20", "19"] },
  { key: "0305", ids: ["8", "4"] },
];

// 지도 렌더링 기준 너비(px): 카드가 이보다 넓으면 이 너비로 렌더링 후 확대 → 큰 화면에서도 같은 범위 표시
const MAP_BASE_W = 680;

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
  const mapEl = document.getElementById("map-s3");
  if (!list || !mapEl) return;

  // 기울어진 레이어 안 지도: 드래그·줌·애니메이션 비활성 (고정 표시 전용)
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
      // 정수 줌 고정: 소수 줌 단계에서 기본지도 타일 미표시 방지
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
        group: group.key,
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

  // 1. 목록 렌더링 (구분 묶음 + 경로 행, 구분명은 탭에 표시하므로 묶음 제목 생략)
  let html = "";
  let lastGroup = "";
  routes.forEach((route, i) => {
    if (route.group !== lastGroup) {
      if (lastGroup) html += "</div>";
      html += `<div class="route-group" data-group="${route.group}">`;
      lastGroup = route.group;
    }
    html += `
      <div class="route-row" data-index="${i}">
        <div class="route-row-head">
          <button type="button" class="route-row-title">${route.title}</button>
          <button type="button" class="route-more" aria-expanded="false" aria-controls="route-body-${i}">
            <span class="route-more-label">자세히 보기</span><span class="route-more-sign" aria-hidden="true"></span>
          </button>
        </div>
        <div class="route-row-body" id="route-body-${i}">
          <div class="route-row-inner">
            ${route.stops.length ? `<div class="stop-chips">${route.stops.map((s, si) => `<span class="stop-chip${si === 0 ? " is-start" : si === route.stops.length - 1 ? " is-end" : ""}">${s}</span>`).join('<i aria-hidden="true">→</i>')}</div>` : ""}
            ${route.desc ? `<p class="route-desc">${route.desc}</p>` : '<p class="route-desc">경로 설명이 없습니다.</p>'}
          </div>
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

    rows.forEach((row, i) => row.classList.toggle("active", i === index));

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

    // 구분 탭 동기화
    tabs.forEach((t) =>
      t.setAttribute("aria-selected", String(t.dataset.group === route.group)),
    );
    filterByGroup(route.group);
  }

  // 3. 구분 탭: 해당 구분 경로만 표시
  function filterByGroup(group) {
    list.querySelectorAll(".route-group").forEach((g) => {
      g.hidden = g.dataset.group !== group;
    });
  }

  // 3-1. 상세 펼침/접힘: 한 번에 1개 행만 펼침
  function setOpen(targetRow, open) {
    rows.forEach((row) => {
      const on = row === targetRow && open;
      row.classList.toggle("is-open", on);
      const btn = row.querySelector(".route-more");
      btn.setAttribute("aria-expanded", String(on));
      btn.querySelector(".route-more-label").textContent = on
        ? "접기"
        : "자세히 보기";
    });
  }

  rows.forEach((row) => {
    const index = Number(row.dataset.index);
    // 경로명: 지도 경로 활성화만 수행
    row
      .querySelector(".route-row-title")
      .addEventListener("click", () => activate(index));
    // 자세히 보기: 경로 활성화 + 상세 토글
    row.querySelector(".route-more").addEventListener("click", () => {
      activate(index);
      setOpen(row, !row.classList.contains("is-open"));
    });
  });

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const first = routes.findIndex((r) => r.group === tab.dataset.group);
      if (first >= 0) {
        activate(first);
        setOpen(null, false);
      }
    });
  });

  // 4. 지도 배율 보정: 카드 너비 > 기준 너비이면 기준 너비로 렌더링 → 카드 너비 / 기준 너비 비율로 확대
  //    (표시 전용 지도라 scale 적용 시 마우스 좌표 보정 불필요)
  const frame = mapEl.parentElement;
  const applyScale = () => {
    const w = frame.clientWidth;
    const h = frame.clientHeight;
    if (!w || !h) return;
    // 기준 너비 이하(작은 화면·모바일): 원래 크기 유지 / 초과(큰 화면): 확대만 적용
    const scale = Math.max(1, w / MAP_BASE_W);
    mapEl.style.right = "auto";
    mapEl.style.bottom = "auto";
    mapEl.style.width = `${w / scale}px`;
    mapEl.style.height = `${h / scale}px`;
    mapEl.style.transformOrigin = "0 0";
    mapEl.style.transform = `scale(${scale})`;
  };

  // 5. 전체 경로 범위로 화면 고정
  // maxZoom 11: 상위 줌에서 타일 미제공(검은 화면) 방지 (기존 storymap section3 기준값)
  const allBounds = L.latLngBounds(routes.flatMap((r) => r.coords));
  const fixView = () => {
    applyScale();
    map.invalidateSize({ animate: false });
    map.fitBounds(allBounds, {
      padding: [40, 40],
      maxZoom: 11,
      animate: false,
    });
  };

  // 카드 크기 변경(창 크기 조절·반응형 전환) 시 배율 재계산
  new ResizeObserver(() => fixView()).observe(frame);

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
  ).observe(mapEl);
}
