/* =======================================================
   스마트서울맵 OpenAPI 데이터 서비스
   - 지도 타일 · 경성대지도(WMS) 주소
   - 테마 데이터 호출 → GeoJSON 변환
     · 3·1운동 시간여행 테마(11100550): 섹션 2·3·4
     · 3·1운동 생활 속 현장 테마(100173): 섹션 5
   - API 키: /services/config.js (CONFIG.MAP_API_KEY · CONFIG.THEMA_API_KEY)
======================================================= */

/* ---------- 1. 경성대지도 (WMS) ---------- */
export const HISTORICAL_MAPS = {
    wmsUrl: "https://map.seoul.go.kr/smgis2/proxy?url=prop/tileMapGeoserver/wms?",
    gyeongseong: "tile_map:g_old_capital_tms", // 경성대지도 레이어명
};

/* ---------- 2. API 주소 ---------- */
const OPENAPI = "https://map.seoul.go.kr/openapi/v5";
// 테마 콘텐츠 목록 조회 주소 (전체 건수 · 전체 범위 조회)
const themeUrl = (themeId) =>
    `${OPENAPI}/${CONFIG.THEMA_API_KEY}/public/themes/contents/ko?page_size=999&page_no=1&coord_x=126.974695&coord_y=37.564150&distance=999999&search_type=0&search_name=&theme_id=${themeId}&content_id=&subcate_id=`;

export const MAP_ENDPOINTS = {
    // 한글 일반지도 타일
    seoulBaseMap_kor: `${OPENAPI}/${CONFIG.MAP_API_KEY}/public/map/base/dawul_kor_normal/{z}/{j}/{k}/{x}/{y}/png`,
    themeData_11100550: themeUrl(11100550), // 3·1운동 시간여행
    themeData_100173: themeUrl(100173), // 3·1운동 생활 속 현장
};

/* ---------- 3. API 응답 → GeoJSON 변환 ---------- */
// COT_COORD_DATA: 좌표 배열의 배열이면 LineString(경로), 그 외 Point(COT_COORD_X·Y)
function transformToGeoJSON(apiData) {
    const items = apiData.body || [];

    const features = items.map((item) => {
        let geomType = "Point";
        let coords = [
            parseFloat(item.COT_COORD_X || 0),
            parseFloat(item.COT_COORD_Y || 0),
        ];

        if (item.COT_COORD_DATA && item.COT_COORD_DATA !== "[]") {
            try {
                const parsedPath = JSON.parse(item.COT_COORD_DATA);
                if (Array.isArray(parsedPath) && Array.isArray(parsedPath[0])) {
                    geomType = "LineString";
                    coords = parsedPath;
                }
            } catch (e) {
                console.warn("경로 데이터 파싱 실패:", e);
            }
        }

        return {
            type: "Feature",
            id: item.COT_CONTS_ID,
            properties: item,
            geometry: { type: geomType, coordinates: coords },
        };
    });

    return { type: "FeatureCollection", features };
}

/* ---------- 4. 테마 데이터 호출 (실패 시 빈 FeatureCollection 반환) ---------- */
async function fetchTheme(url, label) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`${label} 테마 API 통신 에러`);
        return transformToGeoJSON(await response.json());
    } catch (error) {
        console.error("데이터 로드 실패:", error);
        return { type: "FeatureCollection", features: [] };
    }
}

// 3·1운동 시간여행 테마 (거점 · 경로 · 중요 지점 · 시위 장소)
export const fetchTimeTravelData = () =>
    fetchTheme(MAP_ENDPOINTS.themeData_11100550, "시간여행");

// 3·1운동 생활 속 현장 테마 (독립운동가)
export const fetchDailyLifeData = () =>
    fetchTheme(MAP_ENDPOINTS.themeData_100173, "생활속현장");
