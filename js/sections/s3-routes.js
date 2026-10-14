/* =======================================================
   03 함성의 궤적: 구분 탭 + 경로 카드 + 평면 지도(유리 패널) + 경로 재생
   - 데이터: 스마트서울맵 테마 11100550 경로(LineString) 7종
   - 구분 탭(3월 1일 동부 / 3월 1일 서부 / 3월 5일): 탭별 경로 수 표시, 전환 시 첫 경로 활성화
   - 경로 카드 클릭 → 활성 경로 강조(빨간 점선 흐름) + 출발/도착 마커 + 경로 범위로 이동
   - 활성 카드: 경유지 세로 타임라인 + 경로 설명 펼침/접힘
   - 경로 재생: 경로선 좌표를 따라 표시점 이동, 진행률 막대 연동 (경유지별 좌표 미제공 → 진행률만 표시)
   - 크게 보기: 지도 프레임(정보·재생 패널 포함)을 화면 전체 팝업으로 확대, 닫기 버튼·Esc·배경 클릭으로 복귀
======================================================= */
import { fetchTimeTravelData } from "/services/mapService.js";
import { createStoryMap } from "/js/utils/mapUtils.js";
import { setStat } from "/js/utils/uiUtils.js";

// 경로 구성: 구분 key(탭 버튼 data-group 값과 일치) · 표시명 · 테마 콘텐츠 ID
const ROUTE_GROUPS = [
  { key: "east", label: "3월 1일 · 동부", ids: ["22", "14"] },
  { key: "west", label: "3월 1일 · 서부", ids: ["21", "20", "19"] },
  { key: "0305", label: "3월 5일", ids: ["8", "4"] },
];

// 경로 맞춤 최대 줌: 12 초과 시 타일 미제공 가능성 → 12 고정 (섹션2 확대 줌과 동일)
const FIT_MAX_ZOOM = 12;
// 재생 속도: 경로 1km당 소요 시간(ms), 최소·최대 재생 시간
const PLAY_MS_PER_KM = 2200;
const PLAY_MIN_MS = 5000;
const PLAY_MAX_MS = 14000;

const INACTIVE_STYLE = {
  color: "#000000",
  weight: 4,
  opacity: 0.18,
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

const pad2 = (n) => String(n).padStart(2, "0");

export async function initRoutes() {
  const list = document.getElementById("s3-list");
  const tabs = document.querySelectorAll("#s3-tabs .route-seg-btn");
  const info = document.getElementById("s3-info");
  const mapEl = document.getElementById("map-s3");
  const playBtn = document.getElementById("s3-play");
  const playLabel = document.getElementById("s3-play-label");
  const playPct = document.getElementById("s3-play-pct");
  const bar = document.getElementById("s3-bar");
  if (!list || !mapEl) return;

  // 평면 지도: 드래그 이동만 허용, 줌 조작 비활성
  // (사용자 줌 변경 시 일부 단계 기본지도 타일 미표시 → 경로 맞춤 줌으로 고정)
  const { map } = createStoryMap("map-s3", {
    zoom: 11,
    mapOptions: {
      // 정수 줌 고정: 소수 줌 단계에서 기본지도 타일 미표시 방지
      zoomSnap: 1,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
      zoomAnimation: false,
    },
  });

  const geojson = await fetchTimeTravelData();
  const findFeature = (id) =>
    geojson.features.find(
      (f) => String(f.id) === id || String(f.properties.RNUM) === id,
    );

  const routes = [];
  ROUTE_GROUPS.forEach((group) => {
    let order = 0;
    group.ids.forEach((id) => {
      const feature = findFeature(id);
      if (!feature || feature.geometry.type !== "LineString") return;
      const props = feature.properties;
      const layer = L.geoJSON(feature, {
        style: INACTIVE_STYLE,
        interactive: false,
      }).addTo(map);
      const coords = feature.geometry.coordinates.map(([x, y]) =>
        L.latLng(y, x),
      );
      order += 1;
      routes.push({
        id,
        group: group.key,
        groupLabel: group.label,
        order,
        title: props.COT_CONTS_NAME || "제목 없음",
        stops: toStops(props.COT_VALUE_01),
        desc: props.COT_VALUE_03
          ? String(props.COT_VALUE_03).replace(/\n/g, "<br>")
          : "",
        coords,
        layer,
      });
    });
  });

  setStat("route", routes.length);

  // 탭별 경로 수 표시
  ROUTE_GROUPS.forEach((g) => {
    const el = document.querySelector(`#s3-tabs [data-count="${g.key}"]`);
    if (el) el.textContent = routes.filter((r) => r.group === g.key).length;
  });

  if (routes.length === 0) {
    list.innerHTML =
      '<p class="status-text">경로 정보를 불러올 수 없습니다.</p>';
    return;
  }

  // 1. 경로 카드 렌더링 (구분별 묶음, 탭으로 표시 전환)
  const stopsOf = (route) =>
    route.stops.length ? route.stops : ["출발지", "도착지"];
  list.innerHTML = ROUTE_GROUPS.map((g) => {
    const cards = routes
      .map((route, i) => ({ route, i }))
      .filter(({ route }) => route.group === g.key)
      .map(({ route, i }) => {
        const stops = stopsOf(route);
        const timeline = stops
          .map((s, si) => {
            const cls =
              si === 0 ? "is-start" : si === stops.length - 1 ? "is-end" : "";
            const tagText =
              si === 0 ? "출발" : si === stops.length - 1 ? "도착" : "";
            return `<li class="${cls}">${s}${tagText ? `<small>${tagText}</small>` : ""}</li>`;
          })
          .join("");
        return `
          <article class="route-card" data-index="${i}">
            <button type="button" class="route-card-head" aria-expanded="false" aria-controls="route-card-body-${i}">
              <span class="route-num">${pad2(route.order)}</span>
              <span class="route-card-text">
                <span class="route-card-title">${route.title}</span>
                <span class="route-card-meta">경유지 ${stops.length}곳 · ${stops[0]} → ${stops[stops.length - 1]}</span>
              </span>
              <span class="route-card-arrow" aria-hidden="true">›</span>
            </button>
            <div class="route-card-body" id="route-card-body-${i}">
              <div class="route-card-inner">
                <ol class="route-timeline">${timeline}</ol>
                <div class="route-card-actions">
                  <button type="button" class="route-desc-btn" aria-expanded="false">경로 설명 보기</button>
                </div>
                <p class="route-desc" hidden>${route.desc || "경로 설명이 없습니다."}</p>
              </div>
            </div>
          </article>`;
      })
      .join("");
    return `<div class="route-group" data-group="${g.key}">${cards}</div>`;
  }).join("");

  const cards = [...list.querySelectorAll(".route-card")];
  let endpointMarkers = [];
  let currentIndex = -1;

  const pointIcon = (type, label) =>
    L.divIcon({
      className: `route-point route-point-${type}`,
      html: `<span class="route-point-label">${label}</span><span class="route-point-dot"></span>`,
      iconSize: [40, 40],
      iconAnchor: [20, 34],
    });

  // 재생 표시점
  const runner = L.marker(routes[0].coords[0], {
    icon: L.divIcon({
      className: "route-runner",
      html: '<span class="route-runner-dot"></span>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    }),
    interactive: false,
    zIndexOffset: 1000,
  });

  const fitPadding = () =>
    window.matchMedia("(min-width: 1025px)").matches
      ? { paddingTopLeft: [60, 150], paddingBottomRight: [60, 120] }
      : { paddingTopLeft: [30, 110], paddingBottomRight: [30, 100] };
  const fitRoute = (route) =>
    map.fitBounds(L.latLngBounds(route.coords), {
      ...fitPadding(),
      maxZoom: FIT_MAX_ZOOM,
      animate: false,
    });

  // 2. 경로 활성화
  function activate(index) {
    if (index === currentIndex) return;
    stopPlay(true);
    currentIndex = index;
    const route = routes[index];

    cards.forEach((card, i) => {
      const on = i === index;
      card.classList.toggle("is-active", on);
      card
        .querySelector(".route-card-head")
        .setAttribute("aria-expanded", String(on));
      if (!on) setDesc(card, false);
    });

    // Leaflet setStyle의 className은 최초 생성 시에만 반영 → SVG path에 classList 직접 적용
    routes.forEach((r, i) => {
      const on = i === index;
      r.layer.setStyle(on ? ACTIVE_STYLE : INACTIVE_STYLE);
      r.layer.eachLayer((l) =>
        l.getElement?.()?.classList.toggle("route-flow", on),
      );
    });
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

    // 유리 패널: 현재 경로 정보
    if (info) {
      info.innerHTML = `
        <p class="route-info-kicker">${route.groupLabel} · ${pad2(route.order)}</p>
        <h3 class="route-info-title">${route.title}</h3>`;
    }

    // 구분 탭 동기화
    tabs.forEach((t) =>
      t.setAttribute("aria-selected", String(t.dataset.group === route.group)),
    );
    filterByGroup(route.group);

    fitRoute(route);
  }

  // 3. 구분 탭: 해당 구분 카드만 표시
  function filterByGroup(group) {
    list.querySelectorAll(".route-group").forEach((g) => {
      g.hidden = g.dataset.group !== group;
    });
  }

  // 3-1. 경로 설명 펼침/접힘
  function setDesc(card, open) {
    const btn = card.querySelector(".route-desc-btn");
    const desc = card.querySelector(".route-desc");
    btn.setAttribute("aria-expanded", String(open));
    btn.textContent = open ? "경로 설명 접기" : "경로 설명 보기";
    desc.hidden = !open;
  }

  cards.forEach((card) => {
    const index = Number(card.dataset.index);
    card
      .querySelector(".route-card-head")
      .addEventListener("click", () => activate(index));
    card.querySelector(".route-desc-btn").addEventListener("click", () => {
      setDesc(card, card.querySelector(".route-desc").hidden);
    });
  });

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const first = routes.findIndex((r) => r.group === tab.dataset.group);
      if (first >= 0) activate(first);
    });
  });

  // 4. 크게 보기 팝업: 지도 프레임을 body로 이동 후 고정 배치 (상위 요소 transform 영향 회피)
  //    원래 위치에는 같은 높이의 자리 표시 요소를 두어 레이아웃 유지
  const frame = mapEl.closest(".routes-map");
  const expandBtn = document.getElementById("s3-expand");
  const placeholder = document.createElement("div");
  placeholder.className = "routes-map-placeholder";
  const backdrop = document.createElement("div");
  backdrop.className = "routes-map-backdrop";
  let expanded = false;

  const refitMap = () =>
    requestAnimationFrame(() => {
      map.invalidateSize({ animate: false });
      if (currentIndex >= 0) fitRoute(routes[currentIndex]);
    });

  function setExpanded(on) {
    if (!frame || on === expanded) return;
    expanded = on;
    if (on) {
      placeholder.style.height = `${frame.offsetHeight}px`;
      frame.before(placeholder);
      document.body.append(backdrop, frame);
    } else {
      placeholder.replaceWith(frame);
      backdrop.remove();
    }
    frame.classList.toggle("is-expanded", on);
    document.body.style.overflow = on ? "hidden" : "";
    if (expandBtn) {
      expandBtn.textContent = on ? "✕" : "⤢";
      expandBtn.setAttribute(
        "aria-label",
        on ? "크게 보기 닫기" : "지도 크게 보기",
      );
    }
    refitMap();
  }

  expandBtn?.addEventListener("click", () => setExpanded(!expanded));
  backdrop.addEventListener("click", () => setExpanded(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && expanded) setExpanded(false);
  });

  // 5. 경로 재생: 누적 거리 기준 위치 보간 (requestAnimationFrame)
  let playing = false;
  let rafId = 0;
  let progress = 0; // 0 ~ 1
  let lastTime = 0;
  let track = null; // { coords, cum, total, duration }

  const buildTrack = (route) => {
    const cum = [0];
    for (let i = 1; i < route.coords.length; i++)
      cum.push(cum[i - 1] + map.distance(route.coords[i - 1], route.coords[i]));
    const total = cum[cum.length - 1] || 1;
    const duration = Math.min(
      PLAY_MAX_MS,
      Math.max(PLAY_MIN_MS, (total / 1000) * PLAY_MS_PER_KM),
    );
    return { coords: route.coords, cum, total, duration };
  };

  const pointAt = (t) => {
    const target = t * track.total;
    let i = 1;
    while (i < track.cum.length - 1 && track.cum[i] < target) i++;
    const seg = track.cum[i] - track.cum[i - 1] || 1;
    const r = Math.min(1, Math.max(0, (target - track.cum[i - 1]) / seg));
    const a = track.coords[i - 1];
    const b = track.coords[i];
    return L.latLng(a.lat + (b.lat - a.lat) * r, a.lng + (b.lng - a.lng) * r);
  };

  const render = () => {
    const pct = Math.round(progress * 100);
    bar?.style.setProperty("--progress", `${progress * 100}%`);
    if (playPct) playPct.textContent = `${pct}%`;
    if (track) runner.setLatLng(pointAt(progress));
  };

  const setPlayUi = (on) => {
    playBtn?.classList.toggle("is-playing", on);
    playBtn?.setAttribute("aria-label", on ? "일시정지" : "경로 재생");
    if (playLabel && currentIndex >= 0) {
      const stops = stopsOf(routes[currentIndex]);
      playLabel.textContent =
        on || progress > 0
          ? `${stops[0]} → ${stops[stops.length - 1]}`
          : "▶ 눌러 경로 따라가기";
    }
  };

  const step = (time) => {
    if (!playing) return;
    const dt = lastTime ? time - lastTime : 0;
    lastTime = time;
    progress = Math.min(1, progress + dt / track.duration);
    render();
    if (progress >= 1) {
      playing = false;
      setPlayUi(false);
      return;
    }
    rafId = requestAnimationFrame(step);
  };

  function startPlay() {
    if (currentIndex < 0) return;
    if (!track) track = buildTrack(routes[currentIndex]);
    if (progress >= 1) progress = 0;
    if (!map.hasLayer(runner)) runner.addTo(map);
    playing = true;
    lastTime = 0;
    setPlayUi(true);
    rafId = requestAnimationFrame(step);
  }

  function stopPlay(reset = false) {
    playing = false;
    cancelAnimationFrame(rafId);
    if (reset) {
      progress = 0;
      track = null;
      if (map.hasLayer(runner)) map.removeLayer(runner);
      render();
    }
    setPlayUi(false);
  }

  playBtn?.addEventListener("click", () =>
    playing ? stopPlay() : startPlay(),
  );

  // 진행 막대 클릭: 해당 위치로 이동
  bar?.addEventListener("click", (e) => {
    if (currentIndex < 0) return;
    if (!track) track = buildTrack(routes[currentIndex]);
    const rect = bar.getBoundingClientRect();
    progress = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    if (!map.hasLayer(runner)) runner.addTo(map);
    render();
    setPlayUi(playing);
  });

  // 6. 초기 표시 + 섹션 진입 시 크기 재계산 (숨김 상태 초기화 대응, 1회)
  setTimeout(() => {
    map.invalidateSize({ animate: false });
    activate(0);
  }, 300);

  new IntersectionObserver(
    (entries, observer) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      map.invalidateSize({ animate: false });
      if (currentIndex >= 0) fitRoute(routes[currentIndex]);
    },
    { threshold: 0.1 },
  ).observe(mapEl);
}
