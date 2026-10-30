/* 05 독립의 별들: 인물 지도 + 프로필 + 검색 바 + 인물 카드 */
// 데이터: 생활 속 현장 테마(100173) 중 COT_THEME_SUB_ID '5'
// 카드·마커 클릭 → 지도 이동 + 프로필 표시 (상세 API 1회 호출 후 캐시)
// 일제감시대상인물카드 버튼: API COT_EXTRA_DATA_02 주소(목록 → 상세 순 확인), 주소 없으면 이름 검색 주소
// 이름 검색 + 초성 필터 → 카드·마커 동시 필터링, 인원 수 갱신
// 배치: 검색 바 → 인물 카드 줄 → 지도 | 프로필
// 마커: 기본 노란색, 선택 인물만 파란색 (선택 해제 시 노란색 복귀) / 호버: 인물명 툴팁 (확대 상태에서는 미표시)
// 선택 팝업(인물명): 우측 상단 X 클릭 시 팝업만 닫힘, 같은 인물 재클릭 시 팝업 표시 중이면 전체 보기 / 닫힌 상태면 팝업 재표시
// 전체 보기 버튼: 인물 선택 상태 또는 기본 줌보다 확대된 상태에서 표시
// 우측 하단 보기 컨트롤: 전체 보기(선택 해제 + 전체 범위 복귀) + 확대/축소 (mapUtils.js)
// 지도 크기 변경(모바일 배치 전환 등) 시 선택 인물 없으면 전체 보기 재적용
import { fetchDailyLifeData, MAP_ENDPOINTS } from "/services/mapService.js";
import { createStoryMap } from "/js/utils/mapUtils.js";
import { getInitialConsonant, setStat, toSafeImageUrl } from "/js/utils/uiUtils.js";

// 초성 필터 칩 목록 (쌍자음은 기본 자음으로 통합: uiUtils.js getInitialConsonant)
const CONSONANTS = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
// 전체 보기 최대 줌 / 인물 선택 시 줌
const DEFAULT_MAX_ZOOM = 10;
const FOCUS_ZOOM = 10;
// 인물 상세 API 결과 캐시 (poiId → 상세 정보)
const detailCache = new Map();

// 일제감시대상인물카드 주소: API COT_EXTRA_DATA_02 값 그대로 사용 (http 주소 포함, 링크 이동은 혼합 콘텐츠 차단 대상 아님), http/https로 시작하지 않는 값(빈 값 · "null")은 미사용
const toCardUrl = (raw) => {
    const url = String(raw || "").trim();
    return /^https?:\/\//.test(url) ? url : "";
};
// 카드 주소 없을 때: 한국사데이터베이스 일제감시대상인물카드 이름 검색
const toCardSearchUrl = (name) => `https://db.history.go.kr/modern/ia/level.do?nameKr=${encodeURIComponent(name)}&orderColumn=person_id&recordCountPerPage=20&pageIndex=1`;

// 상세 API: NAME_xx 라벨 매칭 → 대응 VALUE_xx, 미매칭 시 COT_VALUE_xx 직접 조회
async function fetchDetail(poiId) {
    if (detailCache.has(poiId)) return detailCache.get(poiId);
    const baseUrl = MAP_ENDPOINTS.themeData_100173.split("/public/")[0];
    const res = await fetch(`${baseUrl}/public/themes/contents/detail?theme_id=100173&conts_id=${poiId}`);
    const data = await res.json();
    // 옵셔널 체이닝 미사용: 에디터 자동 정렬 시 물음표와 점이 분리되어 문법 오류 발생 방지
    const d = (data && Array.isArray(data.body) && data.body[0]) || {};
    const pick = (label, directKey) => {
        for (const key in d) {
            if (key.includes("NAME_") && String(d[key]).includes(label)) {
                const val = d[key.replace("NAME_", "VALUE_")];
                if (val && val !== "null" && String(val).trim()) return val;
            }
        }
        const direct = d[directKey];
        return direct && direct !== "null" && String(direct).trim() ? direct : "";
    };
    const detail = {
        sinbun: pick("신분", "COT_VALUE_02"),
        sagun: pick("사건개요", "COT_VALUE_03"),
        pangyul: pick("판결날", "COT_VALUE_04"),
        joemyung: pick("죄명", "COT_VALUE_05"),
        cardUrl: toCardUrl(d.COT_EXTRA_DATA_02 || d.EXTRA_DATA_02),
    };
    detailCache.set(poiId, detail);
    return detail;
}

export async function initActivists() {
    const rail = document.getElementById("s5-rail");
    const profile = document.getElementById("s5-profile");
    const searchInput = document.getElementById("s5-search");
    const filterBar = document.getElementById("s5-filters");
    const countEl = document.getElementById("s5-count");
    if (!rail || !profile || !document.getElementById("map-s5")) return;

    const { map, setHomeView } = createStoryMap("map-s5", {
        center: [37.577613, 126.976897],
        zoom: DEFAULT_MAX_ZOOM,
        mapOptions: { zoomSnap: 1, doubleClickZoom: false }, // 정수 줌 고정 / 더블클릭 확대 비활성: 마커 연속 클릭 시 추가 확대 방지
    });

    // 인물 마커 아이콘: 기본(노란색) / 선택(파란색, .is-active), setIcon 교체 방식: 필터로 마커 제거 후 재추가 시에도 선택 상태 유지
    const makePinIcon = (active) =>
        L.divIcon({
            className: "person-pin-wrap",
            html: `<span class="person-pin${active ? " is-active" : ""}"></span>`,
            iconSize: [36, 36],
            iconAnchor: [18, 36],
        });
    const PIN_ICON = makePinIcon(false);
    const PIN_ICON_ACTIVE = makePinIcon(true);

    const geojson = await fetchDailyLifeData();
    const people = geojson.features
        .filter((f) => String(f.properties.COT_THEME_SUB_ID) === "5")
        .map((f) => f.properties)
        .filter((p) => p.COT_COORD_Y && p.COT_COORD_X)
        .map((p) => {
            const name = p.COT_CONTS_NAME || "무명 열사";
            return {
                name,
                initial: getInitialConsonant(name),
                address: p.COT_ADDR_FULL_NEW || p.COT_ADDR_FULL_OLD || "활동 지역 불명",
                imgUrl: toSafeImageUrl(p.COT_IMG_MAIN_URL || p.IMG_MAIN_URL),
                poiId: p.COT_CONTS_ID || "",
                latlng: [parseFloat(p.COT_COORD_Y), parseFloat(p.COT_COORD_X)],
                cardUrl: toCardUrl(p.COT_EXTRA_DATA_02 || p.EXTRA_DATA_02), // 목록 API 카드 주소 (없으면 상세 API 응답에서 보완)
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));

    setStat("activist", people.length);
    if (countEl) countEl.textContent = people.length;

    const defaultBounds = people.length ? L.latLngBounds(people.map((p) => p.latlng)) : null;
    const showAll = (animate = true) => {
        if (defaultBounds) map.fitBounds(defaultBounds, { padding: [40, 40], maxZoom: DEFAULT_MAX_ZOOM, animate });
        map.closePopup();
    };

    let activePerson = null;

    // 프로필 패널 초기 화면 (index.html 안내 문구, 선택 해제 시 복원)
    const EMPTY_PROFILE = profile.innerHTML;

    // 프로필 상세 항목 HTML (detail: null 로딩 / error / 데이터)
    const profileRows = (detail) => {
        if (detail === null) return '<div class="profile-skeleton" aria-label="상세 정보를 불러오는 중"><span></span><span></span><span></span></div>';
        if (detail.error) return '<p class="status-text">상세 정보를 불러올 수 없습니다.</p>';
        const items = [
            ["신분", detail.sinbun],
            ["사건 개요", detail.sagun],
            ["판결일", detail.pangyul],
            ["죄명", detail.joemyung],
        ].filter(([, v]) => v);
        if (!items.length) return '<p class="status-text">등록된 상세 정보가 없습니다.</p>';
        return `<dl class="profile-info">${items.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
    };

    // 프로필 패널 렌더링
    function renderProfile(person, detail) {
        const photo = person.imgUrl ? `<img src="${person.imgUrl}" alt="${person.name} 사진" onerror="this.parentNode.classList.add('is-empty'); this.remove();">` : "";
        const mapLink = `https://map.seoul.go.kr/smgis2/poiViewMap?ti=100173&pi=${person.poiId}&lang=ko`;
        // 카드 주소 있으면 인물카드 바로가기, 없으면 이름 검색
        const cardLink = person.cardUrl || toCardSearchUrl(person.name);
        profile.innerHTML = `
      <div class="profile-head">
        <div class="profile-photo${person.imgUrl ? "" : " is-empty"}"><span aria-hidden="true">${person.name.charAt(0)}</span>${photo}</div>
        <div>
          <p class="profile-label">독립운동가</p>
          <h3 class="profile-name">${person.name}</h3>
          <p class="profile-addr">${person.address}</p>
        </div>
      </div>
      ${profileRows(detail)}
      <div class="profile-btns">
        <a class="line-btn line-btn-red" href="${mapLink}" target="_blank" rel="noopener noreferrer">스마트서울맵</a>
        <a class="line-btn line-btn-red" href="${cardLink}" target="_blank" rel="noopener noreferrer">일제감시대상인물카드</a>
      </div>`;
    }

    // 확대 상태(인물 선택 또는 기본 줌보다 확대): 호버 툴팁 숨김(.is-zoomed)
    const updateReset = () => {
        map.getContainer().classList.toggle("is-zoomed", !!activePerson || map.getZoom() > DEFAULT_MAX_ZOOM);
    };

    // 마커 색상: 선택 인물 파란색 + 다른 마커 위 표시, 이전 선택 인물 노란색 복귀
    const setPinActive = (person, on) => {
        if (!person) return;
        person.marker.setIcon(on ? PIN_ICON_ACTIVE : PIN_ICON);
        person.marker.setZIndexOffset(on ? 1000 : 0);
    };

    // 선택 해제 + 프로필 패널 초기 화면 복원 + 전체 보기
    const clearSelection = () => {
        setPinActive(activePerson, false);
        activePerson = null;
        people.forEach((p) => p.card.classList.remove("active"));
        profile.innerHTML = EMPTY_PROFILE;
        showAll();
        updateReset();
    };

    async function select(person) {
        // 재클릭: 팝업 표시 중이면 선택 해제 + 전체 보기, X로 닫은 상태면 팝업만 다시 표시
        if (activePerson === person) {
            if (person.marker.isPopupOpen()) return clearSelection();
            return person.marker.openPopup();
        }

        setPinActive(activePerson, false);
        activePerson = person;
        setPinActive(person, true);
        people.forEach((p) => p.card.classList.toggle("active", p === person));
        person.card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        map.setView(person.latlng, FOCUS_ZOOM, { animate: true });
        person.marker.openPopup();
        updateReset();

        renderProfile(person, null);
        if (!person.poiId) return renderProfile(person, {});
        try {
            const detail = await fetchDetail(person.poiId);
            // 목록 API에 카드 주소 없으면 상세 API 주소로 보완
            if (!person.cardUrl && detail.cardUrl) person.cardUrl = detail.cardUrl;
            if (activePerson === person) renderProfile(person, detail);
        } catch (error) {
            console.error(`상세 API 호출 실패 (${person.name}):`, error);
            if (activePerson === person) renderProfile(person, { error: true });
        }
    }

    // 1. 카드 + 마커 생성
    people.forEach((person) => {
        const photo = person.imgUrl ? `<img src="${person.imgUrl}" alt="" loading="lazy" onerror="this.parentNode.classList.add('is-empty'); this.remove();">` : "";
        const card = document.createElement("button");
        card.type = "button";
        card.className = "person-card";
        card.innerHTML = `
      <span class="person-photo${person.imgUrl ? "" : " is-empty"}">
        <span class="person-mono" aria-hidden="true">${person.name.charAt(0)}</span>
        ${photo}
      </span>
      <span class="person-name">${person.name}</span>`;
        card.addEventListener("click", () => select(person));
        rail.appendChild(card);
        person.card = card;

        person.marker = L.marker(person.latlng, { icon: PIN_ICON }).addTo(map);
        // 호버 툴팁: 인물명 (선택 시 이름 팝업 표시 중에는 툴팁 숨김)
        person.marker.bindTooltip(person.name, { className: "place-tooltip", direction: "top", offset: [0, -34] });
        person.marker.on("popupopen", () => person.marker.closeTooltip());
        person.marker.bindPopup(`<p class="popup-mini-title">${person.name}</p>`, {
            className: "story-popup story-popup-mini",
            offset: [0, -30],
            closeButton: true, // X 버튼: 팝업만 닫기 (인물 선택·프로필·확대 상태 유지)
            autoPan: false,
        });
        // 마커 클릭: Leaflet 기본 팝업 토글(재클릭 시 닫힘) 해제 → select에서 열기
        person.marker.off("click", person.marker._openPopup, person.marker);
        person.marker.on("click", () => select(person));
    });

    if (people.length === 0) rail.innerHTML = '<p class="status-text">인물 정보를 불러올 수 없습니다.</p>';

    // 2. 초성 필터 칩 (ㄱ~ㅎ 14종 전체 생성)
    filterBar.innerHTML = ["all", ...CONSONANTS].map((c) => `<button type="button" class="consonant-chip" data-filter="${c}" aria-pressed="${c === "all"}">${c === "all" ? "전체" : c}</button>`).join("");

    let activeFilter = "all";
    function applyFilter() {
        const keyword = searchInput.value.trim();
        let visible = 0;
        people.forEach((p) => {
            const match = (activeFilter === "all" || p.initial === activeFilter) && (!keyword || p.name.includes(keyword));
            p.card.hidden = !match;
            if (match) {
                visible++;
                if (!map.hasLayer(p.marker)) p.marker.addTo(map);
            } else if (map.hasLayer(p.marker)) {
                map.removeLayer(p.marker);
            }
        });
        countEl.textContent = visible;
        rail.scrollTo({ left: 0, behavior: "smooth" });
    }

    // 초성 칩 선택 표시 (선택 칩 aria-pressed true)
    const setChip = (filter) => {
        filterBar.querySelectorAll(".consonant-chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === filter)));
    };

    filterBar.addEventListener("click", (e) => {
        const btn = e.target.closest(".consonant-chip");
        if (!btn) return;
        activeFilter = btn.dataset.filter;
        setChip(activeFilter);
        searchInput.value = "";
        applyFilter();
    });
    searchInput.addEventListener("input", () => {
        activeFilter = "all";
        setChip("all");
        applyFilter();
    });

    // 3. 카드 이동 버튼 · 전체 보기
    const prevBtn = document.getElementById("s5-prev");
    const nextBtn = document.getElementById("s5-next");
    if (prevBtn) prevBtn.addEventListener("click", () => rail.scrollBy({ left: -rail.clientWidth * 0.8, behavior: "smooth" }));
    if (nextBtn) nextBtn.addEventListener("click", () => rail.scrollBy({ left: rail.clientWidth * 0.8, behavior: "smooth" }));

    map.on("zoomend", updateReset);
    // 우측 하단 전체 보기: 선택 해제 + 전체 범위 복귀
    setHomeView(clearSelection);

    // 4. 지도 크기 변경 시 전체 보기 재적용 (선택 인물 없을 때, 초기 fitBounds가 모바일 배치 확정 전 크기로 계산 → 마커 범위 잘림 방지)
    let lastSize = "";
    new ResizeObserver(() => {
        const el = map.getContainer();
        const size = `${el.clientWidth}x${el.clientHeight}`;
        if (!el.clientWidth || size === lastSize) return;
        lastSize = size;
        map.invalidateSize();
        if (!activePerson) showAll(false);
    }).observe(map.getContainer());

    // 섹션 진입 시 1회 크기 재계산 + 전체 보기
    new IntersectionObserver(
        (entries, observer) => {
            if (!entries.some((e) => e.isIntersecting)) return;
            observer.disconnect();
            map.invalidateSize();
            if (!activePerson) showAll(false);
        },
        { threshold: 0.1 },
    ).observe(map.getContainer());

    // 첫 표시 보정 (레이아웃 확정 후 1회)
    setTimeout(() => {
        map.invalidateSize();
        showAll(false);
    }, 400);
}
