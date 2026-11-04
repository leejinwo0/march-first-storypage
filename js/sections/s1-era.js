/* 01 시대의 부름: 배경 카드 4종 + 세계지도(OSM) */
// 데이터: /js/data/history-data.js S1_ERA
// 카드: 제목 · 영문/장소 → 사진 → 설명 순, 이미지 클릭 시 전역 확대 모달, 이미지 로드 실패 시 사진 영역 숨김
// 세계지도: OpenStreetMap 타일, 카드 4곳 번호 마커 + 장소명·주소 상시 라벨 (PC) (서울 2곳 상자 좌우 분리·꼬리 마커 위, 도쿄 아래 배치, 모바일 미표시)
// 마커·카드 클릭: 해당 위치 확대 + 카드·마커 강조(빨간색), 선택된 카드·마커 재클릭 시 팝업 표시 중이면 선택 해제 + 전체 보기 복귀 / 팝업 닫힌 상태면 팝업만 다시 표시
// 선택 팝업(장소명 + 주소, 모바일은 장소명만): 지도 클릭 시 유지, 우측 상단 X 클릭 시 팝업만 닫힘 (확대·선택 유지)
// 확대 상태(전체 보기 줌 초과): 상시 라벨 숨김 + 보기 컨트롤 표시 (전체 보기 화면에서는 보기 컨트롤 숨김, PC·모바일 공통) / 전체 보기 축척: 서울 마커 2개(남산·대한문) 좌우 분리 표시
// 전체 보기 줌 이하로 축소 시 처음 화면(선택 해제 + 전체 보기) 복귀
// 서울 확대: 서울 지점(1·2번) 선택 또는 서울 범위 확대 시 스마트서울맵(현재지도만, 옛지도 전환 버튼 숨김, 상시 라벨 없음)으로 전환, 일정 줌 미만 축소·전체 보기 시 세계지도 복귀
// 우측 상단 보기 컨트롤: 전체 보기(선택 해제 + 세계지도 전체 범위 복귀) + 확대/축소 (mapUtils.js), OSM 저작권 표기는 우측 하단
// 모바일(560px 이하): 카드 설명 숨김, 선택 마커를 지도 아래쪽(76% 지점)에 배치 + 팝업 축소 (세계지도·스마트서울맵 공통), 보기 컨트롤 축소 표시
// 모바일 확대·축소 범위: 장소 선택 줌 기준 ±3단계 (선택 해제·다른 장소 선택 시 해제)
// 모바일 사진 클릭: 확대 모달에 제목 → 위치(장소명·주소) → 상세 지도(서울 1·2번 스마트서울맵 / 3·4번 OSM, 처음 줌 기준 -4단계까지 확대/축소 버튼) → 사진 → 설명 순 표시, 모달 닫힘 시 지도 제거
import { S1_ERA } from "/js/data/history-data.js";
import { addMapViewControl, createStoryMap } from "/js/utils/mapUtils.js";
import { MAP_ENDPOINTS } from "/services/mapService.js";

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
// 스마트서울맵 장소 선택 줌 (모바일): 낮은 지도 높이 → PC보다 2단계 축소
const SEOUL_FOCUS_ZOOM_MOBILE = 8;
const SEOUL_VIEW_ZOOM = 8;
const SEOUL_EXIT_ZOOM = 6;
// 모바일 선택 마커 세로 위치 보정: 지도 높이의 26% 아래로 이동 (중앙 50% → 76%, 위쪽 팝업 공간 확보)
const MOBILE_MARKER_SHIFT = 0.26;
// 모바일 확대·축소 허용 범위: 장소 선택 줌 기준 ±단계
const MOBILE_ZOOM_RANGE = 3;
// 오픈스트리트맵 타일 · 저작권 표기 (세계지도 · 모바일 모달 상세 지도 3·4번 공통)
const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';
// 모바일 모달 상세 지도 (모달 닫힘 시 제거), 축소 허용 범위: 처음 줌 기준 -단계 (처음 줌 초과 확대 불가)
let modalMap = null;
const MODAL_ZOOM_RANGE = 4;

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

    // 사진 클릭: 확대 모달 (사진 로드 실패 카드 제외), 모바일은 상세 지도 포함 모달
    grid.querySelectorAll(".era-photo").forEach((btn) => {
        btn.addEventListener("click", () => {
            if (typeof window.openGlobalModal !== "function" || btn.classList.contains("is-empty")) return;
            const index = Number(btn.dataset.index);
            const item = S1_ERA[index];
            if (MOBILE_QUERY.matches) return openEraModal(item, index);
            window.openGlobalModal(item.imgUrl, `${item.caption}<br><small>${item.place}</small>`);
        });
    });
    // 모달 닫힘(.is-open 해제) 시 모바일 모달 표시 상태 해제 + 상세 지도 제거 (다른 섹션 모달 표시에 영향 방지)
    // is-era 없으면 종료: classList.remove는 클래스가 없어도 class 속성 변경 기록 발생 → 감시 콜백 무한 반복 방지
    const modal = document.getElementById("image-modal");
    if (modal) {
        new MutationObserver(() => {
            if (modal.classList.contains("is-open") || !modal.classList.contains("is-era")) return;
            modal.classList.remove("is-era");
            if (modalMap) modalMap.remove();
            modalMap = null;
        }).observe(modal, { attributes: true, attributeFilter: ["class"] });
    }

    initEraMap(grid);
}

/* ---------- 2. 모바일 사진 확대 모달: 제목 → 위치 → 상세 지도 → 사진 → 설명 ---------- */
// 기본 모달 이미지는 숨김(.is-era → s1-era.css), 사진은 캡션 영역 안 지도 아래에 배치
function openEraModal(item, index) {
    const modal = document.getElementById("image-modal");
    const place = `<small class="era-modal-place">${item.place}</small>${item.address ? `<small class="era-modal-addr">${item.address}</small>` : ""}`;
    // 지도 틀(.era-modal-frame): 확대/축소 버튼 배치 기준 (mapUtils.js addMapViewControl → 지도 부모 요소에 추가)
    const mapHtml = item.latlng && typeof L !== "undefined" ? '<div class="era-modal-frame"><div class="era-modal-map" id="era-modal-map"></div></div>' : "";
    window.openGlobalModal(item.imgUrl, `<p class="era-modal-title">${item.caption}</p>${place}${mapHtml}<img class="era-modal-img" src="${item.imgUrl}" alt="${item.caption}"><span class="modal-desc">${item.body}</span>`);
    if (modal) {
        modal.classList.add("is-era");
        modal.scrollTop = 0;
    }
    const mapEl = document.getElementById("era-modal-map");
    if (!mapEl) return;
    // 상세 지도 종류: 서울 지점(1·2번) 스마트서울맵 (API 로드 전이면 OSM 대체), 그 외 OSM
    const isSeoulMap = SEOUL_INDEXES.includes(index) && typeof getCrsEx === "function" && !!L.TileLayer.DAWULGIS_EX;
    // 상세 지도: 드래그·손가락 확대 비활성 (모달 스크롤 우선), 확대/축소 버튼으로만 줌 변경, 스마트서울맵은 EPSG:5179 좌표계 + 정수 줌
    const startZoom = isSeoulMap ? SEOUL_FOCUS_ZOOM : FOCUS_ZOOM;
    const options = {
        minZoom: startZoom - MODAL_ZOOM_RANGE,
        maxZoom: startZoom,
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
    };
    if (isSeoulMap) Object.assign(options, { crs: getCrsEx(), zoomSnap: 1 });
    modalMap = L.map(mapEl, options).setView(item.latlng, startZoom);
    if (isSeoulMap) {
        new L.TileLayer.DAWULGIS_EX(MAP_ENDPOINTS.seoulBaseMap_kor, { minZoom: 1, maxZoom: 15 }).addTo(modalMap);
    } else {
        // OSM 최대 제공 줌 18 초과 단계: 18단계 타일 확대 표시 (maxNativeZoom)
        L.tileLayer(OSM_TILE_URL, { maxZoom: 18 }).addTo(modalMap);
        // OSM 이용 조건: 저작권 표기 필수 (우측 하단)
        const attribution = L.control.attribution({ prefix: false, position: "bottomright" });
        attribution.addAttribution(OSM_ATTRIBUTION);
        attribution.addTo(modalMap);
    }
    L.marker(item.latlng, {
        icon: L.divIcon({
            className: "era-marker-wrap",
            html: `<span class="era-marker is-active" data-index="${index}">${index + 1}</span>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
        }),
        interactive: false,
    }).addTo(modalMap);
    // 확대/축소 버튼: 마커 중심 기준 1단계씩 이동, 스마트서울맵은 애니메이션 미사용 (줌 애니메이션 중 기본지도 타일 미표시 방지), 전체 보기 버튼은 CSS 숨김
    const created = modalMap;
    addMapViewControl(created, {
        onStep: (dir) => created.setView(item.latlng, created.getZoom() + dir, { animate: !isSeoulMap }),
    });
    // 모달 표시 직후 크기 재계산 (타일 위치 보정)
    requestAnimationFrame(() => {
        if (modalMap === created) created.invalidateSize();
    });
}

/* ---------- 3. 세계지도 (OSM) + 서울 확대 시 스마트서울맵 ---------- */
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
    L.tileLayer(OSM_TILE_URL, { maxZoom: 18 }).addTo(map);

    // OSM 이용 조건: 저작권 표기 필수 (우측 하단)
    const attribution = L.control.attribution({ prefix: false, position: "bottomright" });
    attribution.addAttribution(OSM_ATTRIBUTION);
    attribution.addTo(map);

    const cards = [...grid.querySelectorAll(".era-card")];
    const bounds = L.latLngBounds(items.map((item) => item.latlng));
    const seoulArea = L.latLngBounds(SEOUL_AREA);
    // 전체 보기 여백: PC 상시 라벨(장소명 + 주소) 표시 공간 확보 (좌 160px · 위 85px 파리 라벨 / 우 200px · 아래 85px 도쿄 라벨, 주소 한 줄 표시 기준) / 모바일 좌우 24px·상하 22px (라벨 미표시, 마커 여유)
    const fitPadding = () => (MOBILE_QUERY.matches ? { padding: [24, 22] } : { paddingTopLeft: [160, 85], paddingBottomRight: [200, 85] });
    // 전체 보기 줌: fitBounds와 같은 계산 (여백 반영 + FIT_MAX_ZOOM 상한), 확대 상태·축소 복귀 판단 기준
    let homeZoom = 0;
    const calcHomeZoom = () => {
        const p = fitPadding();
        const padding = L.point(p.paddingTopLeft || p.padding).add(L.point(p.paddingBottomRight || p.padding));
        return Math.min(map.getBoundsZoom(bounds, false, padding), FIT_MAX_ZOOM);
    };
    const showAll = (animate = true) => {
        homeZoom = calcHomeZoom();
        map.fitBounds(bounds, Object.assign({ maxZoom: FIT_MAX_ZOOM, animate }, fitPadding()));
    };
    // 모바일 확대·축소 범위 제한: zoom 전달 시 zoom ±MOBILE_ZOOM_RANGE, 미전달 시 지도 생성 시 범위 복원 (PC 제한 없음)
    const baseRanges = new Map();
    const setZoomRange = (target, zoom) => {
        if (!baseRanges.has(target)) baseRanges.set(target, [target.options.minZoom, target.options.maxZoom]);
        const base = baseRanges.get(target);
        const limited = zoom !== undefined && MOBILE_QUERY.matches;
        target.setMinZoom(limited ? zoom - MOBILE_ZOOM_RANGE : base[0]);
        target.setMaxZoom(limited ? zoom + MOBILE_ZOOM_RANGE : base[1]);
    };

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
    // 팝업 내용: 장소명 + 주소 (주소 없으면 장소명만)
    const popupHtml = (item) => `<p class="era-popup-title">${item.place}</p>${item.address ? `<p class="era-popup-addr">${item.address}</p>` : ""}`;
    // 팝업: 지도 클릭 시 유지, 우측 상단 X 클릭 시에만 닫힘 (다른 장소 선택 시 교체, 닫혀도 선택 유지)
    const POPUP_OPTIONS = {
        className: "story-popup era-popup",
        offset: [0, -14],
        closeButton: true,
        closeOnClick: false,
        autoPan: false, // 확대 이동(flyTo) 중 autoPan 충돌 방지 (마커가 지도 중앙으로 이동)
    };

    // 선택 해제: 강조 해제 + 팝업 닫기 + 모바일 줌 범위 복원 + 세계지도 복귀 + 전체 보기
    const clearSelection = () => {
        setActive(-1);
        map.closePopup();
        setZoomRange(map);
        if (seoul) {
            seoul.map.closePopup();
            setZoomRange(seoul.map);
        }
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
            // 상시 라벨 없음: 팝업만 표시 (X 클릭 시 팝업만 닫힘, 확대·선택 유지)
            marker.bindPopup(popupHtml(item), POPUP_OPTIONS);
            marker.off("click", marker._openPopup, marker);
            marker.on("click", () => toggle(index));
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
    // shift: 모바일 장소 선택 시 마커를 지도 아래쪽(76% 지점)에 배치 → 낮은 지도 높이에서 위쪽 팝업 잘림 방지
    const moveSeoul = (latlng, zoom, animate, shift) => {
        const target = seoul.zoomFor(zoom);
        if (Math.abs(seoul.map.getZoom() - target) > 0.01) seoul.map.setZoom(target, { animate: false });
        let center = L.latLng(latlng);
        if (shift && MOBILE_QUERY.matches) {
            const point = seoul.map.project(center, target);
            point.y -= seoul.map.getContainer().clientHeight * MOBILE_MARKER_SHIFT;
            center = seoul.map.unproject(point, target);
        }
        seoul.map.panTo(center, { animate, duration: 0.8 });
    };

    // 장소 선택 줌: 모바일 PC보다 축소
    const seoulFocusZoom = () => (MOBILE_QUERY.matches ? SEOUL_FOCUS_ZOOM_MOBILE : SEOUL_FOCUS_ZOOM);

    // 선택: 카드·마커 강조 + 팝업 열기 + 해당 위치 확대 (서울 지점: 세계지도 확대 후 스마트서울맵 전환), 모바일은 이동 완료 후 줌 범위 제한
    function focus(index) {
        const item = S1_ERA[index];
        if (!item || !item.latlng) return;
        setActive(index);
        // 이전 선택 줌 범위 해제 (이동 목표 줌 제한 방지)
        setZoomRange(map);
        if (seoul) setZoomRange(seoul.map);
        if (SEOUL_INDEXES.includes(index) && getSeoul()) {
            if (isSeoul) {
                moveSeoul(item.latlng, seoulFocusZoom(), true, true);
                setZoomRange(seoul.map, seoulFocusZoom());
                seoul.markers[index].openPopup();
                return;
            }
            map.closePopup();
            map.flyTo(item.latlng, SEOUL_ENTER_ZOOM, { duration: 1.4 });
            map.once("moveend", () => {
                if (activeIndex !== index) return;
                moveSeoul(item.latlng, seoulFocusZoom(), false, true);
                setSeoulView(true);
                setZoomRange(seoul.map, seoulFocusZoom());
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
        map.once("moveend", () => {
            if (activeIndex === index && !isSeoul) setZoomRange(map, FOCUS_ZOOM);
        });
    }

    // 현재 표시 중인 지도의 마커 (스마트서울맵 표시 중 서울 지점 → 스마트서울맵 마커)
    const markerOf = (index) => (isSeoul && SEOUL_INDEXES.includes(index) ? seoul.markers[index] : markers[index]);

    // 카드·마커 클릭: 선택된 장소 재클릭 시 팝업 표시 중이면 선택 해제 + 전체 보기, X로 닫은 상태면 팝업만 다시 표시 / 그 외 해당 장소 선택
    function toggle(index) {
        if (index !== activeIndex) return focus(index);
        const marker = markerOf(index);
        if (marker && !marker.isPopupOpen()) return marker.openPopup();
        clearSelection();
    }

    const markers = []; // 카드 index → 세계지도 마커

    // 번호 마커 + 상시 라벨(장소명 + 주소, 주소 없으면 날짜) / 클릭: 해당 위치 확대 + 팝업
    S1_ERA.forEach((item, index) => {
        if (!item.latlng) return;
        const marker = L.marker(item.latlng, { icon: markerIcon(index, SPLIT_DIR[index] || 0), riseOnHover: true }).addTo(map);
        const label = LABEL_POS[index] || { direction: "top", offset: [0, -16] };
        // 서울 2곳: era-tooltip-to-right / era-tooltip-to-left 클래스로 상자만 좌우 이동 (s1-era.css)
        const shiftClass = label.shift ? ` era-tooltip-to-${label.shift}` : "";
        marker.bindTooltip(`${item.place}<small>${item.address || item.date}</small>`, {
            className: `place-tooltip era-tooltip${shiftClass}`,
            direction: label.direction,
            offset: label.offset,
            permanent: true,
        });
        marker.bindPopup(popupHtml(item), POPUP_OPTIONS);
        // 마커 클릭: Leaflet 기본 팝업 토글(재클릭 시 닫힘) 해제 → focus에서 열기
        marker.off("click", marker._openPopup, marker);
        marker.on("click", () => toggle(index));
        markers[index] = marker;
    });

    // 카드 클릭 → 지도 위치 이동, 선택된 카드 재클릭 → toggle 규칙 적용 (사진 클릭은 확대 모달 유지)
    cards.forEach((card) => {
        card.addEventListener("click", (e) => {
            if (e.target.closest(".era-photo, a")) return;
            toggle(Number(card.dataset.index));
        });
    });

    // 낮은 줌: 서울 마커 좌우 분리 / 확대 상태(전체 보기 줌 초과): 상시 라벨 숨김 + 보기 컨트롤 표시 / 전체 보기 줌 이하 축소: 처음 화면 복귀 / 선택 없이 서울 범위 확대 시 스마트서울맵 전환
    const update = () => {
        const zoom = map.getZoom();
        mapEl.classList.toggle("is-split", zoom < SPLIT_ZOOM);
        mapEl.classList.toggle("is-zoomed", zoom > homeZoom + 0.05);
        if (!isSeoul && (zoom < homeZoom - 0.05 || (activeIndex !== -1 && zoom <= homeZoom + 0.05))) return clearSelection();
        if (activeIndex !== -1 || isSeoul || zoom < SEOUL_ENTER_ZOOM || !seoulArea.contains(map.getCenter()) || !getSeoul()) return;
        moveSeoul(map.getCenter(), SEOUL_VIEW_ZOOM, false, false);
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