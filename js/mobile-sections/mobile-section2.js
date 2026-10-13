/* =======================================================
   Mobile Card 3: 거사의 맹세 세로 타임라인
   - PC section2와 동일 데이터·순서, 지도 없이 카드 리스트 렌더링
======================================================= */
import { fetchTimeTravelData } from "/api/mapService.js";

export async function initMobileSection2() {
  const timelineContainer = document.getElementById("mobile-s2-timeline");
  if (!timelineContainer) return;

  try {
    const geojsonData = await fetchTimeTravelData();

    // 표시 순서 (pc-sections/section2.js와 동일)
    const targetIds = [
      "start_01",
      "start_02",
      "start_03",
      "start_04",
      "start_08",
      "start_05",
      "start_09",
      "start_07",
      "start_13",
    ];

    timelineContainer.innerHTML = "";

    targetIds.forEach((targetId, index) => {
      const feature = geojsonData.features.find(
        (f) => f.properties.COT_CONTS_ID === targetId,
      );

      if (feature) {
        const props = feature.properties;
        const title = props.COT_CONTS_NAME || "지명 없음";
        const addrNew = props.COT_ADDR_FULL_NEW || "현재 주소 정보 없음";
        const addrOld = props.COT_ADDR_FULL_OLD || "옛 주소 정보 없음";

        // 이미지 처리
        let imgUrl = props.COT_IMG_MAIN_URL || "";
        if (imgUrl && !imgUrl.startsWith("http")) {
          imgUrl =
            "https://map.seoul.go.kr" +
            (imgUrl.startsWith("/") ? "" : "/") +
            imgUrl;
        }
        if (imgUrl.startsWith("http://")) {
          imgUrl =
            "https://images.weserv.nl/?url=" + encodeURIComponent(imgUrl);
        }

        // 상세 설명 처리
        let rawVal01 = (props.COT_VALUE_01 || "").trim().replace(/^"|"$/g, "");
        let rawVal03 = (props.COT_VALUE_03 || "").trim().replace(/^"|"$/g, "");
        let val01 = rawVal01
          ? rawVal01.replace(/\n/g, "<br>").replace(/ - /g, "<br>- ")
          : "";
        let val03 = rawVal03
          ? rawVal03.replace(/\n/g, "<br>").replace(/ - /g, "<br>- ")
          : "";

        let combinedDesc = "";
        if (val01) combinedDesc += val01;
        if (val01 && val03) combinedDesc += "<br><br>";
        if (val03) combinedDesc += val03;
        if (!combinedDesc) combinedDesc = "상세 설명이 없습니다.";

        const stepNum = index + 1;
        const stepNumFormatted = stepNum < 10 ? `0${stepNum}` : stepNum;

        const itemNode = document.createElement("div");
        itemNode.className = "mobile-timeline-item";

        itemNode.innerHTML = `
          <div class="timeline-step">
            <span class="step-num">${stepNumFormatted}</span>
            <div class="step-line"></div>
          </div>
          <div class="timeline-content">
            <h3 class="timeline-title">${title}</h3>
            ${imgUrl ? `<img src="${imgUrl}" alt="${title}" class="timeline-img" onerror="this.style.display='none'">` : ""}
            <div class="timeline-addr">
              <p><strong>현재:</strong> ${addrNew}</p>
              <p><strong>옛지명:</strong> ${addrOld}</p>
            </div>
            <div class="timeline-desc">${combinedDesc}</div>
          </div>
        `;

        timelineContainer.appendChild(itemNode);
      }
    });
  } catch (error) {
    console.error("모바일 Section 2 데이터를 불러오는 중 오류 발생:", error);
    timelineContainer.innerHTML =
      '<p class="mobile-empty-msg">데이터를 불러올 수 없습니다.</p>';
  }
}
