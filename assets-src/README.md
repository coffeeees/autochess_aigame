# 배포하지 않는 원본 에셋

`public/`에 두지 않아 빌드(`dist/`)에 들어가지 않는 원본 파일입니다.

| 파일 | 내용 |
| --- | --- |
| `fonts/pretendard-variable.woff2` | Pretendard 가변 글꼴 전체(2MB). `tools/subset-font.py`가 여기서 `public/assets/fonts/pretendard-subset.woff2`를 만듭니다. |
| `images/battlefield.png`, `images/battlefield-bg-alt.png` | 지금 화면에서 쓰지 않는 전장 배경 그림(7단계에서 빌드에서 뺌). |
