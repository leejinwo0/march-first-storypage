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
   3. 곡선 경로 생성기 (섹션 2, 3 용)
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
