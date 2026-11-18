# KSTQB 모의시험 Alti

Vite + React + Tailwind CSS v4 기반 1인용 CTFL 모의시험 (정적 SPA, 저장 기능 없음)

## 실행
npm install
npm run dev      # 개발 서버
npm run build    # dist/ 정적 빌드

## 문제 은행: src/data/questions.json (405문항)
- KSTQB 공식 샘플문제 A·B·C·D 166문항 + 샘플 A 추가문제 26문항(정답: 공식 정답표, 해설: 공식 해설 원문)
  ※ 정답·해설은 별도 문서인 정답/해설집 페이지에서 가져왔습니다.
- 덤프 문항 219문항 (CTFL Foundation 범위만, 실러버스 v4.0.1 용어로 정리, 한글 해설 새로 작성)
  - 덤프 1~65번(CTAL 테스트 관리자 시나리오 문항)은 CTFL 범위 밖이라 제외
  - 번역 훼손·정답 불명확·중복·구 실러버스 전용 개념 54문항 제외
  - 덤프 정답이 틀린 22문항은 실러버스 근거로 정답 수정(해설에 표시)
- 필드: id, source, num, chapter, lo, question({{IMG}} 위치에 그림), options, answer(정답 인덱스 배열, 복수정답 지원), images(data URI), explanation

## 재생성
scripts/extract/ — parse_samples.py(샘플 A~D 파싱), parse_dump.py(덤프 파싱),
normalize.py(용어 정리), dump_decisions.py(덤프 검토 결과·해설), build_final.py(병합)
(pdfplumber 필요, PDF 경로는 스크립트 상단에서 수정)
