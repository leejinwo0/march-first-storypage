/* =======================================================
   지도 공용 유틸 (섹션 1~5)
   1. 스마트서울맵 OpenAPI 스크립트 동적 로드
   2. 현재지도 / 옛지도 전환 컨트롤
   3. 지도 보기 컨트롤 (우측 하단 '전체 보기' + 확대/축소, 섹션 1~5 공통)
   4. 스토리 지도 생성 (현재지도 + 옛지도 + 전환 컨트롤 + 보기 컨트롤)
      · 전환 버튼 이름: '현재지도' / '옛지도' 고정 (섹션 공통)
      · 옛지도 종류: historicalMap 옵션
        - "modernKorea": 근세 한국 오만분지일 지형도 (섹션 2·3·5, 기본값)
        - "gyeongseong": 경성대지도 (섹션 4)
   5. 곡선 경로 좌표 생성 (섹션2 경로선)
======================================================= */
import { MAP_ENDPOINTS, HISTORICAL_MAPS } from "/services/mapService.js";

// 옛지도 전환 버튼 이름 (경성대지도 · 근세 지형도 공통)
const HISTORICAL_LABEL = "옛지도";
// 사용 가능한 옛지도 종류 (HISTORICAL_MAPS 레이어 키)
const HISTORICAL_KEYS = ["gyeongseong", "modernKorea"];

/* =======================================================
   1. 스마트서울맵 OpenAPI V5 스크립트 로드
   - 메인 스크립트 → 좌표계 스크립트(5179) 순차 로드
   - 로드 완료 후 전역 getCrsEx(), L.TileLayer.DAWULGIS_EX 사용 가능
======================================================= */
export function loadSeoulMapAPI() {
    return new Promise((resolve, reject) => {
        if (typeof CONFIG === "undefined" || !CONFIG.MAP_API_KEY) {
            console.warn("API 키가 없습니다. config.js를 확인하세요.");
            resolve();
            return;
        }

        const key = CONFIG.MAP_API_KEY;
        const base = `https://map.seoul.go.kr/openapi/v5/${key}/public/map`;

        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = `${base}/css/5.0`;
        document.head.appendChild(link);

        const mainScript = document.createElement("script");
        mainScript.src = `${base}/js/5.0`;
        mainScript.onerror = () => reject(new Error("서울맵 V5 메인 스크립트 로드 실패"));
        mainScript.onload = () => {
            const crsScript = document.createElement("script");
            crsScript.src = `${base}/base/js/5179/5.0`;
            crsScript.onload = () => resolve();
            crsScript.onerror = () => reject(new Error("좌표계 스크립트 로드 실패"));
            document.head.appendChild(crsScript);
        };
        document.head.appendChild(mainScript);
    });
}

/* =======================================================
   2. 지도 전환 컨트롤 (우측 상단 '현재지도 / 옛지도' 토글)
   - secondaryLabel: 보조 레이어 버튼 이름
======================================================= */
export function addMapToggleControl(map, baseMapLayer, secondaryMapLayer, secondaryLabel) {
    const ToggleControl = L.Control.extend({
        options: { position: "topright" },
        onAdd() {
            const container = L.DomUtil.create("div", "custom-map-toggle");
            container.innerHTML = `
        <span class="map-type-label active" data-type="base">현재지도</span>
        <span class="map-type-label" data-type="secondary">${secondaryLabel}</span>
      `;
            const baseLabel = container.querySelector('[data-type="base"]');
            const secondaryLabelEl = container.querySelector('[data-type="secondary"]');
            let isSecondary = false;

            // 토글 클릭이 지도 클릭으로 전달되지 않도록 차단
            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.on(container, "click", (e) => {
                e.preventDefault();
                isSecondary = !isSecondary;
                map.removeLayer(isSecondary ? baseMapLayer : secondaryMapLayer);
                map.addLayer(isSecondary ? secondaryMapLayer : baseMapLayer);
                baseLabel.classList.toggle("active", !isSecondary);
                secondaryLabelEl.classList.toggle("active", isSecondary);
            });

            return container;
        },
    });
    map.addControl(new ToggleControl());
}

/* =======================================================
   3. 지도 보기 컨트롤 (우측 하단: '전체 보기' 버튼 + 확대/축소 버튼)
   - 지도 틀(.map-frame)에 직접 배치 → 섹션3 지도 CSS 배율 영향 없음
   - onHome: 전체 보기 클릭 시 실행 (섹션별 기본 화면 복귀)
   - onStep: 확대(1)/축소(-1) 실행 (미지정 시 Leaflet zoomIn/zoomOut)
   - 최대·최소 줌 도달 시 해당 버튼 비활성
======================================================= */
export function addMapViewControl(map, options = {}) {
    const onHome = options.onHome || (() => {});
    const onStep = options.onStep || ((dir) => (dir > 0 ? map.zoomIn() : map.zoomOut()));
    const container = map.getContainer();
    const frame = container.parentElement || container;

    const control = document.createElement("div");
    control.className = "map-view-ctrl";
    control.innerHTML = `
        <button type="button" class="map-view-home" aria-label="전체 보기"><span class="icon icon-expand" aria-hidden="true"></span>전체 보기</button>
        <div class="map-view-zoom">
            <button type="button" data-step="1" aria-label="지도 확대">+</button>
            <button type="button" data-step="-1" aria-label="지도 축소">−</button>
        </div>`;
    frame.appendChild(control);

    const zoomInBtn = control.querySelector('[data-step="1"]');
    const zoomOutBtn = control.querySelector('[data-step="-1"]');
    control.querySelector(".map-view-home").addEventListener("click", () => onHome());
    [zoomInBtn, zoomOutBtn].forEach((btn) => btn.addEventListener("click", () => onStep(Number(btn.dataset.step))));

    // 줌 한계 도달 시 버튼 비활성 (줌 변경 · 레이어 전환 시 갱신)
    const updateDisabled = () => {
        const zoom = map.getZoom();
        zoomInBtn.disabled = zoom >= map.getMaxZoom();
        zoomOutBtn.disabled = zoom <= map.getMinZoom();
    };
    map.on("zoomend layeradd layerremove", updateDisabled);
    map.whenReady(updateDisabled);

    return control;
}

/* =======================================================
   4. 스토리 지도 생성 (섹션 2~5 공용)
   - 스마트서울맵 한글 일반지도 + 옛지도(WMS) 전환 컨트롤 + 우측 하단 보기 컨트롤
   - historicalMap: 옛지도 종류 ("modernKorea" 기본 / "gyeongseong")
   - zoomOffset: 옛지도 전환 시 줌 축소 단계 (복귀 시 복원)
   - onHome: 전체 보기 동작 (미지정 시 생성 위치·줌 복귀, 생성 후 setHomeView로 교체 가능)
   - 확대/축소: 일반지도 기준 정수 줌 단계 이동 (스마트서울맵 좌표계 소수 줌 미지원 → 기본지도 미표시 방지)
   - 지도 컨테이너 크기 변경 시 invalidateSize 자동 호출
   - 반환: map, zoomFor(현재 레이어 기준 줌 값 변환), setHomeView(전체 보기 동작 교체), viewControl(보기 컨트롤 요소)
======================================================= */
export function createStoryMap(containerId, options = {}) {
    const center = options.center || [37.5759, 126.985];
    const zoom = options.zoom !== undefined ? options.zoom : 10;
    const zoomOffset = options.zoomOffset || 0;
    const mapOptions = options.mapOptions || {};
    // 옛지도 종류: 등록되지 않은 값이면 근세 지형도 사용
    const historicalKey = HISTORICAL_KEYS.includes(options.historicalMap) ? options.historicalMap : "modernKorea";

    const container = document.getElementById(containerId);
    const map = L.map(
        containerId,
        Object.assign(
            {
                zoomControl: false,
                scrollWheelZoom: false,
                zoomSnap: 0.5,
                crs: getCrsEx(), // 스마트서울맵 좌표계 (EPSG:5179)
            },
            mapOptions,
        ),
    ).setView(center, zoom);

    const baseLayer = new L.TileLayer.DAWULGIS_EX(MAP_ENDPOINTS.seoulBaseMap_kor, { minZoom: 1, maxZoom: 15 });
    const historicalLayer = L.tileLayer.wms(HISTORICAL_MAPS.wmsUrl, {
        layers: HISTORICAL_MAPS[historicalKey],
        format: "image/png",
        transparent: true,
        maxZoom: 18,
    });

    baseLayer.addTo(map);
    addMapToggleControl(map, baseLayer, historicalLayer, HISTORICAL_LABEL);

    // 옛지도 전환 시 줌 보정 (옛지도 축척 차이)
    if (zoomOffset) {
        map.on("layeradd", (e) => {
            if (e.layer === historicalLayer) map.setZoom(map.getZoom() - zoomOffset, { animate: false });
            if (e.layer === baseLayer) map.setZoom(map.getZoom() + zoomOffset, { animate: false });
        });
    }

    if (container) new ResizeObserver(() => map.invalidateSize()).observe(container);

    // 현재 레이어 기준 줌 값 (옛지도 표시 중이면 보정값 차감)
    const zoomFor = (value) => (map.hasLayer(historicalLayer) ? value - zoomOffset : value);

    // 전체 보기: 기본값 생성 위치·줌 복귀, 애니메이션 없이 이동 (스마트서울맵 기본지도 줌 애니메이션 중 타일 미표시 방지)
    let homeView = options.onHome || (() => map.setView(center, zoomFor(zoom), { animate: false }));
    const setHomeView = (fn) => {
        homeView = fn;
    };

    // 확대/축소: 일반지도 기준 줌으로 환산 후 다음 정수 단계 이동 → 옛지도 보정값 반영, 애니메이션 없이 이동 (줌 애니메이션 중 기본지도 타일 미표시 방지)
    const stepZoom = (dir) => {
        const offset = map.hasLayer(historicalLayer) ? zoomOffset : 0;
        const baseZoom = map.getZoom() + offset;
        const next = dir > 0 ? Math.floor(baseZoom + 0.01) + 1 : Math.ceil(baseZoom - 0.01) - 1;
        map.setZoom(next - offset, { animate: false });
    };
    const viewControl = addMapViewControl(map, { onHome: () => homeView(), onStep: stepZoom });

    return { map, zoomFor, setHomeView, viewControl };
}

/* =======================================================
   5. 곡선 경로 좌표 생성 (섹션2 거점 연결선)
   - 두 지점 사이를 2차 베지어 곡선(구간당 20분할)으로 변환
   - 구간별 휘는 방향: 1·2·5번째 구간 한쪽, 나머지 반대쪽 (경로선 겹침 방지)
======================================================= */
const CURVE_INTENSITY = 0.2; // 휘는 정도
const CURVE_STEPS = 20; // 구간당 분할 수
const CURVE_FORWARD_SEGMENTS = [0, 1, 4]; // 정방향으로 휘는 구간 번호

export function generateCurvedPath(coords) {
    if (coords.length < 2) return coords;
    const curved = [];
    for (let i = 0; i < coords.length - 1; i++) {
        const [lat1, lng1] = coords[i];
        const [lat2, lng2] = coords[i + 1];
        const midLat = (lat1 + lat2) / 2;
        const midLng = (lng1 + lng2) / 2;
        const direction = CURVE_FORWARD_SEGMENTS.includes(i) ? 1 : -1;
        // 제어점: 두 지점 중간에서 수직 방향으로 이동
        const cpLat = midLat - (lng2 - lng1) * CURVE_INTENSITY * direction;
        const cpLng = midLng + (lat2 - lat1) * CURVE_INTENSITY * direction;

        for (let step = 0; step <= CURVE_STEPS; step++) {
            if (i > 0 && step === 0) continue; // 구간 연결점 중복 제외
            const t = step / CURVE_STEPS;
            const lat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * cpLat + t * t * lat2;
            const lng = (1 - t) * (1 - t) * lng1 + 2 * (1 - t) * t * cpLng + t * t * lng2;
            curved.push([lat, lng]);
        }
    }
    return curved;
}
