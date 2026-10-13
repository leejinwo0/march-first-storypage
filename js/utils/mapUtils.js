import { MAP_ENDPOINTS, HISTORICAL_MAPS } from "/api/mapService.js";

/* =======================================================
   1. 스마트서울맵 OpenAPI V5 동적 로드 (Leaflet 확장팩)
======================================================= */
export function loadSeoulMapAPI() {
  return new Promise((resolve, reject) => {
    if (typeof CONFIG === "undefined" || !CONFIG.MAP_API_KEY) {
      console.warn("API 키가 없습니다. config.js를 확인하세요.");
      resolve();
      return;
    }

    const key = CONFIG.MAP_API_KEY;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://map.seoul.go.kr/openapi/v5/${key}/public/map/css/5.0`;
    document.head.appendChild(link);

    const script1 = document.createElement("script");
    script1.src = `https://map.seoul.go.kr/openapi/v5/${key}/public/map/js/5.0`;
    document.head.appendChild(script1);

    script1.onload = () => {
      const script2 = document.createElement("script");
      script2.src = `https://map.seoul.go.kr/openapi/v5/${key}/public/map/base/js/5179/5.0`;

      script2.onload = () => resolve();
      script2.onerror = () => reject(new Error("좌표계 스크립트 로드 실패"));

      document.head.appendChild(script2);
    };

    script1.onerror = () =>
      reject(new Error("서울맵 V5 메인 스크립트 로드 실패"));
  });
}

/* =======================================================
   2. 지도 전환(일반/위성 등) 컨트롤 생성
======================================================= */
// secondaryLabel: 보조 레이어 버튼 라벨 (기본값 '위성지도')
export function addMapToggleControl(
  map,
  baseMapLayer,
  secondaryMapLayer,
  secondaryLabel = "위성지도",
) {
  const ToggleControl = L.Control.extend({
    options: { position: "topright" },
    onAdd: function (map) {
      const container = L.DomUtil.create("div", "custom-map-toggle");

      container.innerHTML = `
        <span class="map-type-label active" data-type="base">일반지도</span>
        <span class="map-type-divider">/</span>
        <span class="map-type-label" data-type="secondary">${secondaryLabel}</span>
      `;

      let isSecondary = false;

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(container, "click", function (e) {
        e.preventDefault();

        const baseLabel = container.querySelector('[data-type="base"]');
        const secondaryDOM = container.querySelector('[data-type="secondary"]');

        if (isSecondary) {
          map.removeLayer(secondaryMapLayer);
          map.addLayer(baseMapLayer);
          baseLabel.classList.add("active");
          secondaryDOM.classList.remove("active");
        } else {
          map.removeLayer(baseMapLayer);
          map.addLayer(secondaryMapLayer);
          secondaryDOM.classList.add("active");
          baseLabel.classList.remove("active");
        }
        isSecondary = !isSecondary;
      });

      return container;
    },
  });
  map.addControl(new ToggleControl());
}

/* =======================================================
   3. 스토리 지도 생성 (섹션 2~5 공용)
   - 스마트서울맵 일반지도 + 경성대지도(WMS) 전환 컨트롤
   - 경성대지도 전환 시 줌 보정(zoomOffset 단계만큼 축소, 복귀 시 복원)
   - 컨테이너 크기 변경 시 invalidateSize 자동 호출
======================================================= */
export function createStoryMap(containerId, options = {}) {
  const {
    center = [37.5759, 126.985],
    zoom = 10,
    zoomOffset = 0,
    mapOptions = {},
  } = options;

  const container = document.getElementById(containerId);
  const map = L.map(containerId, {
    zoomControl: false,
    scrollWheelZoom: false,
    zoomSnap: 0.5,
    crs: getCrsEx(),
    ...mapOptions,
  }).setView(center, zoom);

  const baseLayer = new L.TileLayer.DAWULGIS_EX(
    MAP_ENDPOINTS.seoulBaseMap_kor,
    {
      minZoom: 1,
      maxZoom: 15,
    },
  );
  const gyeongseongLayer = L.tileLayer.wms(HISTORICAL_MAPS.wmsUrl, {
    layers: HISTORICAL_MAPS.gyeongseong,
    format: "image/png",
    transparent: true,
    maxZoom: 18,
    attribution: "경성대지도",
  });

  baseLayer.addTo(map);
  addMapToggleControl(map, baseLayer, gyeongseongLayer, "경성대지도");

  if (zoomOffset) {
    map.on("layeradd", (e) => {
      if (e.layer === gyeongseongLayer)
        map.setZoom(map.getZoom() - zoomOffset, { animate: false });
      if (e.layer === baseLayer)
        map.setZoom(map.getZoom() + zoomOffset, { animate: false });
    });
  }

  if (container)
    new ResizeObserver(() => map.invalidateSize()).observe(container);

  // 현재 레이어 기준 줌 값 반환 (경성대지도 표시 중이면 보정값 차감)
  const zoomFor = (value) =>
    map.hasLayer(gyeongseongLayer) ? value - zoomOffset : value;

  return { map, baseLayer, gyeongseongLayer, zoomFor };
}

/* =======================================================
   4. 곡선 경로 생성기 (섹션 2 용)
======================================================= */
export function generateCurvedPath(coords) {
  if (coords.length < 2) return coords;
  let curvedCoords = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const start = coords[i],
      end = coords[i + 1];
    const lat1 = start[0],
      lng1 = start[1],
      lat2 = end[0],
      lng2 = end[1];
    const midLat = (lat1 + lat2) / 2,
      midLng = (lng1 + lng2) / 2;
    const intensity = 0.2,
      direction = i === 0 || i === 1 || i === 4 ? 1 : -1;
    const cpLat = midLat - (lng2 - lng1) * (intensity * direction);
    const cpLng = midLng + (lat2 - lat1) * (intensity * direction);

    for (let step = 0; step <= 20; step++) {
      const t = step / 20;
      const lat =
        (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * cpLat + t * t * lat2;
      const lng =
        (1 - t) * (1 - t) * lng1 + 2 * (1 - t) * t * cpLng + t * t * lng2;
      if (i > 0 && step === 0) continue;
      curvedCoords.push([lat, lng]);
    }
  }
  return curvedCoords;
}
