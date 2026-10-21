/* =======================================================
   03 함성의 궤적: 구분 탭 + 경로 카드 + 평면 지도(유리 패널) + 경로 재생
   - 데이터: 스마트서울맵 테마 11100550 경로(LineString) 7종
   - 구분 탭(3월 1일 동부 / 3월 1일 서부 / 3월 5일): 탭별 경로 수 표시, 전환 시 첫 경로 활성화
   - 경로 카드 클릭 → 활성 경로 강조(빨간 점선 흐름) + 출발/도착 마커 + 경로 범위로 이동
   - 경로 7종 공통 배율: 경로별 맞춤 배율 최솟값 + 보정(PC ZOOM_UP / 모바일 ZOOM_UP_MOBILE)
     → 기본지도는 정수 줌(스마트서울맵 제공 레벨)으로 표시, 남는 배율은 지도 영역 CSS 확대·축소로 보정
   - 모바일(1024px 이하): 좌상단 경로 정보 패널 숨김
   - 활성 카드: 경유지 세로 타임라인 + 경로 설명 펼침/접힘
   - 경로 재생: 경로선 좌표를 따라 표시점 이동, 진행률 막대·퍼센트 연동 (경유지별 좌표 미제공 → 진행률만 표시)
   - 크게 보기: 지도 프레임(정보·재생 패널 포함)을 화면 전체 팝업으로 확대, 닫기 버튼·Esc·배경 클릭으로 복귀
   - 지도 프레임 크기 변경 시 현재 경로 다시 맞춤 (모니터·창 크기와 관계없이 같은 화면 구성)
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
// 공통 줌 보정: PC / 모바일 별도 (맞춤 배율 기준 추가 확대 단계, 0 = 가장 넓은 경로가 여백 안에 꽉 참)
const ZOOM_UP = 0;
const ZOOM_UP_MOBILE = 0;
// 재생 속도: 경로 1km당 소요 시간(ms), 최소·최대 재생 시간
const PLAY_MS_PER_KM = 2200;
const PLAY_MIN_MS = 5000;
const PLAY_MAX_MS = 14000;

// 경로선 스타일: 비활성(흐린 검정 실선) / 활성(빨간 점선, CSS route-flow 흐름 애니메이션)
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

// 번호 두 자리 표기 (1 → "01")
const pad2 = (n) => String(n).padStart(2, "0");

export async function initRoutes() {
    const list = document.getElementById("s3-list");
    const tabs = document.querySelectorAll("#s3-tabs .route-seg-btn");
    const info = document.getElementById("s3-info");
    const mapEl = document.getElementById("map-s3");
    const playBtn = document.getElementById("s3-play");
    const playPct = document.getElementById("s3-play-pct");
    const bar = document.getElementById("s3-bar");
    if (!list || !mapEl) return;

    // 평면 지도: 드래그 이동만 허용, 줌 조작 비활성
    // (사용자 줌 변경 시 일부 단계 기본지도 타일 미표시 → 경로 맞춤 줌으로 고정)
    const { map } = createStoryMap("map-s3", {
        zoom: 11,
        mapOptions: {
            // 정수 줌 고정: 스마트서울맵 좌표계 소수 줌 미지원 (소수 줌 적용 시 기본지도 미표시)
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

    // 경로 데이터: 구분·순서별 추출 + 비활성 경로선 생성 (좌표 [경도, 위도] → LatLng)
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

    // 경로 수 → 수치 띠 '3.1운동 이동경로' 갱신 / 탭별 경로 수 표시
    setStat("route", routes.length);
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
                            si === 0
                                ? "is-start"
                                : si === stops.length - 1
                                  ? "is-end"
                                  : "";
                        const tagText =
                            si === 0
                                ? "출발"
                                : si === stops.length - 1
                                  ? "도착"
                                  : "";
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

    // 출발/도착 아이콘: 점 중심(7, 7)을 경로 좌표에 고정, 라벨은 CSS로 점 위 배치
    const pointIcon = (type, label) =>
        L.divIcon({
            className: `route-point route-point-${type}`,
            html: `<span class="route-point-dot"></span><span class="route-point-label">${label}</span>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
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

    // 경로 맞춤 여백: PC 상단 150px(정보 패널)
    // 모바일 상단 64px(정보 패널 숨김, 지도 전환 토글 영역) / 모바일 크게 보기 상단 140px(정보 패널 표시)
    const isMobile = () => !window.matchMedia("(min-width: 1025px)").matches;
    const isExpanded = () =>
        mapEl.closest(".routes-map")?.classList.contains("is-expanded");
    const fitPadding = () => {
        if (!isMobile())
            return { paddingTopLeft: [60, 150], paddingBottomRight: [60, 100] };
        return {
            paddingTopLeft: [24, isExpanded() ? 140 : 64],
            paddingBottomRight: [24, 80],
        };
    };

    // 경로 표시 배율 통일: 7개 경로 공통 배율 적용
    // - 정수 기준 줌(BASE)에서 경로 픽셀 크기 측정 → 여백 안에 꽉 차는 배율 계산 (로그 2 = 줌 단계 차이)
    // - 경로별 맞춤 값 중 최솟값 → 가장 넓은 경로가 여백 안에 꽉 차는 값, 나머지 경로 동일 값
    // - 결과 = 소수 줌 값 (예: 10.8) → 정수 줌 + CSS 배율로 분리 적용
    const BASE_ZOOM = 10;
    const fitValue = (W, H) => {
        const { paddingTopLeft: tl, paddingBottomRight: br } = fitPadding();
        const availW = Math.max(1, W - tl[0] - br[0]);
        const availH = Math.max(1, H - tl[1] - br[1]);
        const fits = routes.map((r) => {
            const b = L.latLngBounds(r.coords);
            const p1 = map.project(b.getNorthWest(), BASE_ZOOM);
            const p2 = map.project(b.getSouthEast(), BASE_ZOOM);
            const w = Math.max(1, Math.abs(p2.x - p1.x));
            const h = Math.max(1, Math.abs(p2.y - p1.y));
            return BASE_ZOOM + Math.log2(Math.min(availW / w, availH / h));
        });
        const up = isMobile() ? ZOOM_UP_MOBILE : ZOOM_UP;
        return Math.min(FIT_MAX_ZOOM, Math.min(...fits) + up);
    };

    // 지도 영역 CSS 배율 적용: 확대 배율 s → 지도 요소 크기 1/s, transform scale(s)
    // (Leaflet은 배율 적용 전 크기 기준으로 타일·좌표 계산, 화면에는 s배로 표시)
    const setMapScale = (scale) => {
        mapEl.style.setProperty("--map-scale", scale);
        mapEl.style.transformOrigin = "0 0";
        mapEl.style.transform = scale === 1 ? "" : `scale(${scale})`;
        mapEl.style.right = "auto";
        mapEl.style.bottom = "auto";
        mapEl.style.width = `${100 / scale}%`;
        mapEl.style.height = `${100 / scale}%`;
        map.invalidateSize({ animate: false });
    };

    // 경로 범위 중심 기준 배치, 상단 정보 패널·하단 재생 바 여백 차이만큼 중심 보정
    const fitRoute = (route) => {
        const frameEl = mapEl.parentElement;
        const W = frameEl.clientWidth;
        const H = frameEl.clientHeight;
        if (!W || !H) return;
        const target = fitValue(W, H);
        const zoom = Math.round(target);
        const scale = 2 ** (target - zoom);
        setMapScale(scale);

        // 여백: 화면 px → Leaflet px (배율 역산)
        const { paddingTopLeft: tl, paddingBottomRight: br } = fitPadding();
        const center = map.project(
            L.latLngBounds(route.coords).getCenter(),
            zoom,
        );
        center.x -= (tl[0] - br[0]) / 2 / scale;
        center.y -= (tl[1] - br[1]) / 2 / scale;
        map.setView(map.unproject(center, zoom), zoom, { animate: false });
    };

    // 2. 경로 활성화
    function activate(index) {
        if (index === currentIndex) return;
        stopPlay(true);
        currentIndex = index;
        const route = routes[index];

        cards.forEach((card, i) => {
            const on = i === index;
            card.classList.toggle("is-active", on);
            card.querySelector(".route-card-head").setAttribute(
                "aria-expanded",
                String(on),
            );
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
            L.marker(route.coords[0], {
                icon: pointIcon("start", "출발"),
            }).addTo(map),
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
            t.setAttribute(
                "aria-selected",
                String(t.dataset.group === route.group),
            ),
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
        card.querySelector(".route-card-head").addEventListener("click", () =>
            activate(index),
        );
        card.querySelector(".route-desc-btn").addEventListener("click", () => {
            setDesc(card, card.querySelector(".route-desc").hidden);
        });
    });

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            const first = routes.findIndex(
                (r) => r.group === tab.dataset.group,
            );
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
            cum.push(
                cum[i - 1] + map.distance(route.coords[i - 1], route.coords[i]),
            );
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
        return L.latLng(
            a.lat + (b.lat - a.lat) * r,
            a.lng + (b.lng - a.lng) * r,
        );
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
        progress = Math.min(
            1,
            Math.max(0, (e.clientX - rect.left) / rect.width),
        );
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

    // 7. 지도 프레임 크기 변경(브라우저 창 크기 조절 등) 시 현재 경로 다시 맞춤 → 같은 화면 구성 유지
    //    (지도 요소는 배율 적용으로 크기 변경 → 프레임 기준 감지)
    let lastSize = "";
    const frameEl = mapEl.parentElement;
    new ResizeObserver(() => {
        const size = `${frameEl.clientWidth}x${frameEl.clientHeight}`;
        if (!frameEl.clientWidth || size === lastSize) return;
        lastSize = size;
        if (currentIndex >= 0) fitRoute(routes[currentIndex]);
    }).observe(frameEl);
}
