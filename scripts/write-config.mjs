/* =======================================================
   배포 빌드 스크립트: 환경 변수 → services/config.js 생성
   - Vercel 환경 변수 MAP_API_KEY, THEMA_API_KEY 사용
   - services/config.js는 .gitignore 대상 (저장소 미포함)
======================================================= */
import { writeFileSync } from "node:fs";

const { MAP_API_KEY, THEMA_API_KEY } = process.env;

if (!MAP_API_KEY || !THEMA_API_KEY) {
    console.error("MAP_API_KEY, THEMA_API_KEY 환경 변수 누락");
    process.exit(1);
}

const config = { MAP_API_KEY, THEMA_API_KEY };
writeFileSync(
    "services/config.js",
    `const CONFIG = ${JSON.stringify(config)};\n`,
);
console.log("services/config.js 생성 완료");