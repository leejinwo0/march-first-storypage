/* 01 시대의 부름: 배경 카드 4종 + 세계지도(OSM) */
// 데이터: /js/data/history-data.js S1_ERA
// 카드: 제목 · 영문/장소 → 사진 → 설명 순 (인용문 미표시), 이미지 클릭 시 전역 확대 모달, 이미지 로드 실패 시 사진 영역 숨김
// 세계지도: OpenStreetMap 타일, 카드 4곳 번호 마커 + 장소명·날짜 상시 라벨 (서울 2곳 상자 좌우 분리·꼬리 마커 위, 도쿄 아래 배치, 모바일 미표시)
// 마커·카드 클릭: 해당 위치 확대 + 카드·마커 강조(빨간색), 선택된 카드 재클릭 시 선택 해제 + 전체 보기 복귀
// 선택 팝업(장소명·날짜): 지도 클릭 시 유지, 우측 상단 X 클릭 시 닫힘 + 선택 해제 + 전체 보기 복귀
// 확대 상태(전체 보기 줌 초과): 상시 라벨 숨김 / 전체 보기 축척: 서울 마커 2개(남산·대한문) 좌우 분리 표시
// 서울 확대: 서울 지점(1·2번) 선택 또는 서울 범위 확대 시 스마트서울맵(현재지도/옛지도 전환 포함)으로 전환, 일정 줌 미만 축소·전체 보기 시 세계지도 복귀
// 우측 상단 보기 컨트롤: 전체 보기(선택 해제 + 세계지도 전체 범위 복귀) + 확대/축소 (mapUtils.js), OSM 저작권 표기는 우측 하단
// 모바일(560px 이하): 카드 설명 숨김, 사진 클릭 시 확대 모달에 설명 함께 표시, 선택 마커를 지도 아래쪽(76% 지점)에 배치 + 팝업 축소
import { S1_ERA } from "/js/data/history-data.js";
import { addMapViewControl, createStoryMap } from "/js/utils/mapUtils.js";

// 마커·카드 클릭 시 장소 확대 줌
const FOCUS_ZOOM = 15;
// 이 줌 미만이면 서울 마커 2개 좌우 분리 (실제 거리 약 1km → 낮은 줌에서 겹침)
const SPLIT_ZOOM = 12;
// 겹침 분리 방향: 카드 index → -1 왼쪽 / 1 오른쪽
const SPLIT_DIR = { 0: 1, 1: -1 };
// 전체 보기 최대 줌
const FIT_MAX_ZOOM = 5;
// 모바일 기준: 카드 설명 → 사진 확대 모달 표시, 세계지도 여백 축소
const MOBILE_QUERY = window.matchMedia("(max-width: 560px)");
// 상시 라벨 위치: 카드 index → 방향 · 위치 보정 (서울 2곳: 라벨 기준점은 좌우 분리된 마커 바로 위 ±17px, 상자만 shift 방향으로 이동 → s1-era.css)
const LABEL_POS = {
    0: { direction: "top", offset: [17, -16], shift: "right" },
    1: { direction: "top", offset: [-17, -16], shift: "left" },
    2: { direction: "bottom", offset: [0, 16] },
    3: { direction: "top", offset: [0, -16] },
};
// 스마트서울맵 전환 대상 (카드 index: 0 남산 통감관저 터 · 1 덕수궁 대한문)
const SEOUL_INDEXES = [0, 1];
// 서울 범위 (세계지도 중심이 이 범위 안 + SEOUL_ENTER_ZOOM 이상 확대 시 스마트서울맵 전환)
const SEOUL_AREA = [
    [37.42, 126.76],
    [37.7, 127.18],
];
// 세계지도(OSM) 기준 스마트서울맵 전환 줌 (서울 지점 선택 시 이 줌까지 확대 후 전환)
const SEOUL_ENTER_ZOOM = 11;
// 스마트서울맵 줌: 장소 선택 시 / 세계지도 확대로 전환 시 / 이 줌 미만 축소 시 세계지도 복귀 (정수 줌)
const SEOUL_FOCUS_ZOOM = 10;
const SEOUL_VIEW_ZOOM = 8;
const SEOUL_EXIT_ZOOM = 6;
// 모바일 선택 마커 세로 위치 보정: 지도 높이의 26% 아래로 이동 (중앙 50% → 76%, 위쪽 팝업 공간 확보)
const MOBILE_MARKER_SHIFT = 0.26;

/* ---------- 1. 카드 4종 렌더링 + 사진 확대 ---------- */
export function initEra() {
    const grid = document.getElementById("s1-era");
    if (!grid) return;

    grid.innerHTML = S1_ERA.map(
        (item, index) => `
        <article class="era-card reveal" style="--delay:${index * 80}ms" data-index="${index}">
        <h3 class="era-title"><span class="era-num" aria-hidden="true">${index + 1}</span>${item.title}</h3>
        <p class="era-en">${item.en} · ${item.place}</p>
        <button type="button" class="era-photo" data-index="${index}" aria-label="${item.caption} 확대 보기">
          <img src="${item.imgUrl}" alt="${item.caption}" loading="lazy" onerror="this.closest('.era-photo').classList.add('is-empty'); this.remove();">
          <span class="era-date">${item.date}</span>
          <span class="era-more" aria-hidden="true">눌러서 설명 보기</span>
        </button>
        <p class="era-body">${item.body}</p>
      </article>`,
    ).join("");

    // 사진 클릭: 확대 모달 (사진 로드 실패 카드 제외)
    grid.querySelectorAll(".era-photo").forEach((btn) => {
        btn.addEventListener("click", () => {
            if (typeof window.openGlobalModal !== "function" || btn.classList.contains("is-empty")) return;
            const item = S1_ERA[Number(btn.dataset.index)];
            // 모바일: 카드에서 숨긴 설명을 캡션 아래 표시
            const detail = MOBILE_QUERY.matches ? `<span class="modal-desc">${item.body}</span>` : "";
            window.openGlobalModal(item.imgUrl, `${item.caption}<br><small>${item.place}</small>${detail}`);
        });
    });

    initEraMap(grid);
}

/* ---------- 2. 세계지도 (OSM) + 서울 확대 시 스마트서울맵 ---------- */
function initEraMap(grid) {
    const mapEl = document.getElementById("map-s1");
    if (!mapEl || typeof L === "undefined") return;
    const frame = mapEl.parentElement;

    const items = S1_ERA.filter((item) => item.latlng);
    if (!items.length) return;

    const map = L.map(mapEl, {
        zoomControl: false,
        scrollWheelZoom: false,
        attributionControl: false,
        worldCopyJump: true,
        zoomSnap: 0, // 소수 줌 허용: 화면 크기와 관계없이 파리~도쿄 범위를 지도 가로폭에 맞춤
        minZoom: 0,
    });

    // 오픈스트리트맵 타일 (흑백 필터: base.css .map-canvas .leaflet-tile-pane)
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(map);

    // OSM 이용 조건: 저작권 표기 필수 (우측 하단)
    const attribution = L.control.attribution({ prefix: false, position: "bottomright" });
    attribution.addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>');
    attribution.addTo(map);

    const cards = [...grid.querySelectorAll(".era-card")];
    const bounds = L.latLngBounds(items.map((item) => item.latlng));
    const seoulArea = L.latLngBounds(SEOUL_AREA);
    // 전체 보기 여백: PC 좌우 70px·상하 40px / 모바일 좌우 24px·상하 22px (마커 여유)
    const fitPadding = () => (MOBILE_QUERY.matches ? [24, 22] : [70, 40]);
    const showAll = (animate = true) => map.fitBounds(bounds, { maxZoom: FIT_MAX_ZOOM, padding: fitPadding(), animate });

    let activeIndex = -1; // 선택 카드 번호 (-1: 선택 없음)
    let isSeoul = false; // 스마트서울맵 표시 여부
    let seoul = null; // 스마트서울맵 { map, zoomFor, markers, control } (API 로드 후 첫 전환 시 생성)

    // 카드·마커 선택 강조 동기화 (세계지도 · 스마트서울맵 마커 공통)
    const setActive = (index) => {
        activeIndex = index;
        cards.forEach((card) => card.classList.toggle("is-active", Number(card.dataset.index) === index));
        frame.querySelectorAll(".era-marker").forEach((el) => el.classList.toggle("is-active", Number(el.dataset.index) === index));
    };

    // 번호 마커 아이콘 (split: 세계지도 서울 2곳 좌우 분리 방향)
    const markerIcon = (index, split) =>
        L.divIcon({
            className: "era-marker-wrap",
            html: `<span class="era-marker" data-index="${index}" style="--split:${split}">${index + 1}</span>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
        });
    const popupHtml = (item) => `<p class="era-popup-title">${item.place}</p><p class="era-popup-date">${item.date}</p>`;
    // 팝업: 지도 클릭 시 유지, 우측 상단 X 클릭 시에만 닫힘 (다른 장소 선택 시 교체)
    const POPUP_OPTIONS = {
        className: "story-popup era-popup",
        offset: [0, -14],
        closeButton: true,
        closeOnClick: false,
        autoPan: false, // 확대 이동(flyTo) 중 autoPan 충돌 방지 (마커가 지도 중앙으로 이동)
    };

    // 선택 해제: 강조 해제 + 팝업 닫기 + 세계지도 복귀 + 전체 보기
    const clearSelection = () => {
        setActive(-1);
        map.closePopup();
        if (seoul) seoul.map.closePopup();
        setSeoulView(false);
        showAll();
    };

    // 보기 컨트롤: 전체 보기(선택 해제 + 전체 범위 복귀) + 확대/축소 (스마트서울맵 표시 중에는 스마트서울맵 컨트롤로 교체)
    const worldControl = addMapViewControl(map, { onHome: clearSelection });

    // 스마트서울맵 생성: 스마트서울맵 API 로드 전이면 미생성 (세계지도로 계속 표시)
    const getSeoul = () => {
        if (seoul) return seoul;
        if (typeof getCrsEx !== "function" || !L.TileLayer.DAWULGIS_EX) return null;
        const el = document.createElement("div");
        el.id = "map-s1-seoul";
        el.className = "map-canvas era-seoul-map";
        mapEl.after(el);
        const created = createStoryMap(el.id, {
            center: S1_ERA[SEOUL_INDEXES[0]].latlng,
            zoom: SEOUL_FOCUS_ZOOM,
            mapOptions: { zoomSnap: 1, doubleClickZoom: false }, // 정수 줌 고정 / 더블클릭 확대 비활성 (기본지도 타일 미표시 방지)
        });
        created.setHomeView(clearSelection);
        created.viewControl.hidden = true; // 세계지도 표시 중 숨김 (base.css [hidden])
        const markers = [];
        SEOUL_INDEXES.forEach((index) => {
            const item = S1_ERA[index];
            const marker = L.marker(item.latlng, { icon: markerIcon(index, 0), riseOnHover: true }).addTo(created.map);
            marker.bindTooltip(`${item.place}<small>${item.date}</small>`, { className: "place-tooltip era-tooltip", direction: "top", offset: [0, -16], permanent: true });
            marker.bindPopup(popupHtml(item), POPUP_OPTIONS);
            marker.off("click", marker._openPopup, marker);
            marker.on("click", () => focus(index));
            // 팝업 표시 중 상시 라벨 숨김, 닫히면 다시 표시
            marker.on("popupopen", () => marker.closeTooltip());
            marker.on("popupclose", () => {
                marker.openTooltip();
                if (activeIndex === index) clearSelection();
            });
            markers[index] = marker;
        });
        // 일정 줌 미만으로 축소 시 세계지도 복귀
        created.map.on("zoomend", () => {
            if (isSeoul && created.map.getZoom() < SEOUL_EXIT_ZOOM) clearSelection();
        });
        seoul = { map: created.map, zoomFor: created.zoomFor, control: created.viewControl, markers };
        return seoul;
    };

    // 세계지도 ↔ 스마트서울맵 전환 (같은 위치에 겹친 보기 컨트롤도 표시 지도 기준으로 교체)
    function setSeoulView(on) {
        if (!seoul || on === isSeoul) return;
        isSeoul = on;
        frame.classList.toggle("is-seoul", on);
        worldControl.hidden = on;
        seoul.control.hidden = !on;
        if (on) seoul.map.invalidateSize({ animate: false });
    }

    // 스마트서울맵 위치 이동: 줌 변경은 애니메이션 없이 먼저 적용 후 이동 (줌 애니메이션 중 기본지도 타일 미표시 방지)
    const moveSeoul = (latlng, zoom, animate) => {
        const target = seoul.zoomFor(zoom);
        if (Math.abs(seoul.map.getZoom() - target) > 0.01) seoul.map.setZoom(target, { animate: false });
        seoul.map.panTo(latlng, { animate, duration: 0.8 });
    };

    // 선택: 카드·마커 강조 + 팝업 열기 + 해당 위치 확대 (서울 지점: 세계지도 확대 후 스마트서울맵 전환)
    function focus(index) {
        const item = S1_ERA[index];
        if (!item || !item.latlng) return;
        setActive(index);
        if (SEOUL_INDEXES.includes(index) && getSeoul()) {
            if (isSeoul) {
                moveSeoul(item.latlng, SEOUL_FOCUS_ZOOM, true);
                seoul.markers[index].openPopup();
                return;
            }
            map.closePopup();
            map.flyTo(item.latlng, SEOUL_ENTER_ZOOM, { duration: 1.4 });
            map.once("moveend", () => {
                if (activeIndex !== index) return;
                moveSeoul(item.latlng, SEOUL_FOCUS_ZOOM, false);
                setSeoulView(true);
                seoul.markers[index].openPopup();
            });
            return;
        }
        // 서울 외 지점: 스마트서울맵 표시 중이면 세계지도 복귀 후 이동
        if (seoul) seoul.map.closePopup();
        setSeoulView(false);
        if (markers[index]) markers[index].openPopup();
        // 모바일: 지도 높이가 낮아 중앙 배치 시 팝업 상단 잘림 → 지도 중심을 위로 옮겨 마커를 아래쪽에 배치
        let center = L.latLng(item.latlng);
        if (MOBILE_QUERY.matches) {
            const point = map.project(center, FOCUS_ZOOM);
            point.y -= mapEl.clientHeight * MOBILE_MARKER_SHIFT;
            center = map.unproject(point, FOCUS_ZOOM);
        }
        map.flyTo(center, FOCUS_ZOOM, { duration: 1.4 });
    }

    const markers = []; // 카드 index → 세계지도 마커

    // 번호 마커 + 상시 라벨(장소명·날짜) / 클릭: 해당 위치 확대 + 팝업
    S1_ERA.forEach((item, index) => {
        if (!item.latlng) return;
        const marker = L.marker(item.latlng, { icon: markerIcon(index, SPLIT_DIR[index] || 0), riseOnHover: true }).addTo(map);
        const label = LABEL_POS[index] || { direction: "top", offset: [0, -16] };
        // 서울 2곳: era-tooltip-to-right / era-tooltip-to-left 클래스로 상자만 좌우 이동 (s1-era.css)
        const shiftClass = label.shift ? ` era-tooltip-to-${label.shift}` : "";
        marker.bindTooltip(`${item.place}<small>${item.date}</small>`, {
            className: `place-tooltip era-tooltip${shiftClass}`,
            direction: label.direction,
            offset: label.offset,
            permanent: true,
        });
        marker.bindPopup(popupHtml(item), POPUP_OPTIONS);
        // 마커 클릭: Leaflet 기본 팝업 토글(재클릭 시 닫힘) 해제 → focus에서 열기
        marker.off("click", marker._openPopup, marker);
        marker.on("click", () => focus(index));
        // X 클릭으로 닫힘 → 선택 해제 + 전체 보기 복귀 (다른 마커 선택으로 교체된 경우 제외)
        marker.on("popupclose", () => {
            if (activeIndex === index) clearSelection();
        });
        markers[index] = marker;
    });

    // 카드 클릭 → 지도 위치 이동, 선택된 카드 재클릭 → 선택 해제 + 전체 보기 (사진 클릭은 확대 모달 유지)
    cards.forEach((card) => {
        card.addEventListener("click", (e) => {
            if (e.target.closest(".era-photo, a")) return;
            const index = Number(card.dataset.index);
            if (index === activeIndex) clearSelection();
            else focus(index);
        });
    });

    // 낮은 줌: 서울 마커 좌우 분리 / 확대 상태: 상시 라벨 숨김 / 선택 없이 서울 범위 확대 시 스마트서울맵 전환
    const update = () => {
        const zoom = map.getZoom();
        mapEl.classList.toggle("is-split", zoom < SPLIT_ZOOM);
        mapEl.classList.toggle("is-zoomed", zoom > FIT_MAX_ZOOM);
        if (activeIndex !== -1 || isSeoul || zoom < SEOUL_ENTER_ZOOM || !seoulArea.contains(map.getCenter()) || !getSeoul()) return;
        moveSeoul(map.getCenter(), SEOUL_VIEW_ZOOM, false);
        setSeoulView(true);
    };
    map.on("zoomend", update);

    // 섹션 진입 전 크기 0 대비: 크기 확정 후 전체 보기
    new ResizeObserver(() => {
        map.invalidateSize();
        if (activeIndex === -1 && !isSeoul) showAll(false);
    }).observe(mapEl);

    showAll(false);
    update();
}
