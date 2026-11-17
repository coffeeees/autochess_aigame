(function(root){'use strict';
// AUTOCHESS_02.md: proposed data only, never added to playableIds.
const records=[
  {
    "id": "C13",
    "cost": 2,
    "name": "서리룬 바르딘",
    "race": "드워프",
    "job": "마법사",
    "trait": "빙결",
    "stats": {
      "HP": 665,
      "MP": 70,
      "AD": 52,
      "AP": 84,
      "GD": 23,
      "CTH": 150,
      "CTC": 5,
      "AS": 0.69,
      "RNG": 4,
      "DOD": 0
    },
    "provisional": true,
    "skill": {
      "name": "빙결 폭발",
      "coefficient": "AP",
      "text": "대상과 인접 적에게 190% AP 마법 피해, 3초간 공격속도 20% 감소",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현."
      ]
    }
  },
  {
    "id": "C14",
    "cost": 2,
    "name": "홍린권 카르곤",
    "race": "용족",
    "job": "무도가",
    "trait": "화염",
    "stats": {
      "HP": 835,
      "MP": 90,
      "AD": 77,
      "AP": 49,
      "GD": 33,
      "CTH": 150,
      "CTC": 10,
      "AS": 0.89,
      "RNG": 1,
      "DOD": 5
    },
    "provisional": true,
    "skill": {
      "name": "화염 연타",
      "coefficient": "AD / AP",
      "text": "대상에게 85% AD 물리 피해 3회, 마지막 타격에 3초 화상(초당 15% AP)",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현."
      ]
    }
  },
  {
    "id": "C15",
    "cost": 2,
    "name": "그늘사제 모르딘",
    "race": "드워프",
    "job": "사제",
    "trait": "암흑",
    "stats": {
      "HP": 715,
      "MP": 70,
      "AD": 52,
      "AP": 79,
      "GD": 26,
      "CTH": 150,
      "CTC": 5,
      "AS": 0.69,
      "RNG": 3,
      "DOD": 0
    },
    "provisional": true,
    "skill": {
      "name": "어둠의 봉합",
      "coefficient": "AP",
      "text": "체력 비율이 가장 낮은 아군을 200% AP 회복, 대상에게 4초간 GD +15%",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현."
      ]
    }
  },
  {
    "id": "C16",
    "cost": 2,
    "name": "뇌수 조련사 라크",
    "race": "수인",
    "job": "소환사",
    "trait": "번개",
    "stats": {
      "HP": 735,
      "MP": 80,
      "AD": 57,
      "AP": 79,
      "GD": 29,
      "CTH": 150,
      "CTC": 5,
      "AS": 0.69,
      "RNG": 3,
      "DOD": 0
    },
    "provisional": true,
    "skill": {
      "name": "전격 늑대",
      "coefficient": "AP",
      "text": "8초간 전격 늑대 1마리 소환, 공격마다 55% AP 마법 피해, 최대 2마리",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현.",
        "소환물 HP/AS/RNG·AI와 고유 소환 동작 미정."
      ]
    }
  },
  {
    "id": "C17",
    "cost": 2,
    "name": "혈검사 엘리온",
    "race": "엘프",
    "job": "전사",
    "trait": "혈마법",
    "stats": {
      "HP": 895,
      "MP": 100,
      "AD": 72,
      "AP": 44,
      "GD": 37,
      "CTH": 150,
      "CTC": 5,
      "AS": 0.73,
      "RNG": 1,
      "DOD": 0
    },
    "provisional": true,
    "skill": {
      "name": "핏빛 참격",
      "coefficient": "AD",
      "text": "자신 현재 HP 8% 소모, 대상에게 230% AD 물리 피해, 준 피해의 20% 회복",
      "draft": true,
      "implemented": false,
      "hpCostBasis": "currentHP",
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현."
      ]
    }
  },
  {
    "id": "C18",
    "cost": 2,
    "name": "광휘정령 루미아",
    "race": "정령",
    "job": "사제",
    "trait": "신성",
    "stats": {
      "HP": 715,
      "MP": 70,
      "AD": 52,
      "AP": 79,
      "GD": 26,
      "CTH": 150,
      "CTC": 5,
      "AS": 0.69,
      "RNG": 3,
      "DOD": 0
    },
    "provisional": true,
    "skill": {
      "name": "정화의 빛",
      "coefficient": "AP",
      "text": "HP 비율이 가장 낮은 아군에게 180% AP 회복과 120% AP 보호막(4초)",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현."
      ]
    }
  },
  {
    "id": "C19",
    "cost": 2,
    "name": "설익의 세라핀",
    "race": "천족",
    "job": "주술사",
    "trait": "빙결",
    "stats": {
      "HP": 725,
      "MP": 80,
      "AD": 57,
      "AP": 79,
      "GD": 27,
      "CTH": 150,
      "CTC": 5,
      "AS": 0.69,
      "RNG": 3,
      "DOD": 0
    },
    "provisional": true,
    "skill": {
      "name": "서리 속박",
      "coefficient": "AP",
      "text": "대상에게 150% AP 마법 피해, 1.5초 속박(이동 불가)",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현.",
        "기존 기절과 구분되는 이동 불가 상태 구현 필요."
      ]
    }
  },
  {
    "id": "C20",
    "cost": 2,
    "name": "적권의 하란",
    "race": "인간",
    "job": "무도가",
    "trait": "혈마법",
    "stats": {
      "HP": 835,
      "MP": 90,
      "AD": 77,
      "AP": 49,
      "GD": 33,
      "CTH": 150,
      "CTC": 10,
      "AS": 0.89,
      "RNG": 1,
      "DOD": 5
    },
    "provisional": true,
    "skill": {
      "name": "혈기 폭주",
      "coefficient": "AD",
      "text": "자신 현재 HP 6% 소모, 5초간 AS +30%, 기본 공격에 20% AD 추가 물리 피해",
      "draft": true,
      "implemented": false,
      "hpCostBasis": "currentHP",
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현."
      ]
    }
  },
  {
    "id": "C21",
    "cost": 2,
    "name": "역광술사 벨라크",
    "race": "마족",
    "job": "마법사",
    "trait": "신성",
    "stats": {
      "HP": 665,
      "MP": 70,
      "AD": 52,
      "AP": 84,
      "GD": 23,
      "CTH": 150,
      "CTC": 5,
      "AS": 0.69,
      "RNG": 4,
      "DOD": 0
    },
    "provisional": true,
    "skill": {
      "name": "타락한 광휘",
      "coefficient": "AP",
      "text": "대상에게 230% AP 마법 피해, 가장 가까운 아군에게 100% AP 보호막(4초)",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현."
      ]
    }
  },
  {
    "id": "C22",
    "cost": 2,
    "name": "암석정령 그란",
    "race": "정령",
    "job": "전사",
    "trait": "대지",
    "stats": {
      "HP": 895,
      "MP": 100,
      "AD": 72,
      "AP": 44,
      "GD": 37,
      "CTH": 150,
      "CTC": 5,
      "AS": 0.73,
      "RNG": 1,
      "DOD": 0
    },
    "provisional": true,
    "skill": {
      "name": "지각 강타",
      "coefficient": "AD",
      "text": "대상에게 170% AD 물리 피해, 4초간 자신 GD +20%",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현."
      ]
    }
  },
  {
    "id": "C23",
    "cost": 2,
    "name": "적엽기사 피오라",
    "race": "엘프",
    "job": "기사",
    "trait": "화염",
    "stats": {
      "HP": 935,
      "MP": 100,
      "AD": 62,
      "AP": 49,
      "GD": 45,
      "CTH": 150,
      "CTC": 5,
      "AS": 0.66,
      "RNG": 1,
      "DOD": 0
    },
    "provisional": true,
    "skill": {
      "name": "불꽃 방벽",
      "coefficient": "AP",
      "text": "자신과 인접 아군에게 4초간 140% AP 보호막, 근접 공격자에게 50% AP 마법 피해",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현.",
        "공격자 대상 선정·반격 트리거·범위 규칙 미정."
      ]
    }
  },
  {
    "id": "C24",
    "cost": 3,
    "name": "설화사제 이셀",
    "race": "엘프",
    "job": "사제",
    "trait": "빙결",
    "stats": {
      "HP": 860,
      "MP": 70,
      "AD": 69,
      "AP": 98,
      "GD": 33,
      "CTH": 150,
      "CTC": 5,
      "AS": 0.72,
      "RNG": 3,
      "DOD": 0
    },
    "provisional": true,
    "skill": {
      "name": "겨울의 기도",
      "coefficient": "AP",
      "text": "체력 비율이 낮은 아군 2명 각각 210% AP 회복, 공격자에게 2초간 AS -20%",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현.",
        "공격자 대상 선정·반격 트리거·범위 규칙 미정."
      ]
    }
  },
  {
    "id": "C25",
    "cost": 3,
    "name": "폭뢰정령 볼테아",
    "race": "정령",
    "job": "마법사",
    "trait": "번개",
    "stats": {
      "HP": 810,
      "MP": 70,
      "AD": 69,
      "AP": 103,
      "GD": 30,
      "CTH": 150,
      "CTC": 5,
      "AS": 0.72,
      "RNG": 4,
      "DOD": 0
    },
    "provisional": true,
    "skill": {
      "name": "연쇄 뇌격",
      "coefficient": "AP",
      "text": "최대 3명의 적에게 순차적으로 220%/150%/100% AP 마법 피해",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현."
      ]
    }
  },
  {
    "id": "C26",
    "cost": 3,
    "name": "동토기사 모르그",
    "race": "언데드",
    "job": "전사",
    "trait": "빙결",
    "stats": {
      "HP": 1040,
      "MP": 100,
      "AD": 89,
      "AP": 63,
      "GD": 44,
      "CTH": 150,
      "CTC": 5,
      "AS": 0.77,
      "RNG": 1,
      "DOD": 0
    },
    "provisional": true,
    "skill": {
      "name": "냉기의 처형",
      "coefficient": "AD",
      "text": "대상에게 220% AD 물리 피해, 대상 HP가 40% 이하이면 추가 70% AD 피해",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현."
      ]
    }
  },
  {
    "id": "C27",
    "cost": 3,
    "name": "독시위 나엘",
    "race": "엘프",
    "job": "궁수",
    "trait": "독",
    "stats": {
      "HP": 830,
      "MP": 80,
      "AD": 94,
      "AP": 63,
      "GD": 32,
      "CTH": 150,
      "CTC": 10,
      "AS": 0.92,
      "RNG": 4,
      "DOD": 5
    },
    "provisional": true,
    "skill": {
      "name": "독비 화살",
      "coefficient": "AD / AP",
      "text": "대상에게 170% AD 물리 피해, 5초간 초당 20% AP 독 피해",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현."
      ]
    }
  },
  {
    "id": "C28",
    "cost": 3,
    "name": "야영자 베르스",
    "race": "언데드",
    "job": "암살자",
    "trait": "암흑",
    "stats": {
      "HP": 850,
      "MP": 80,
      "AD": 99,
      "AP": 63,
      "GD": 34,
      "CTH": 150,
      "CTC": 15,
      "AS": 0.97,
      "RNG": 1,
      "DOD": 10
    },
    "provisional": true,
    "skill": {
      "name": "그림자 급습",
      "coefficient": "AD",
      "text": "적 후방 대상에게 돌진해 250% AD 물리 피해, 3초간 대상 AD -15%",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현.",
        "방향·범위·우선 대상 선정 규칙 확정 및 개별 연결 필요."
      ]
    }
  },
  {
    "id": "C29",
    "cost": 3,
    "name": "암석궁수 드레온",
    "race": "마족",
    "job": "궁수",
    "trait": "대지",
    "stats": {
      "HP": 830,
      "MP": 80,
      "AD": 94,
      "AP": 63,
      "GD": 32,
      "CTH": 150,
      "CTC": 10,
      "AS": 0.92,
      "RNG": 4,
      "DOD": 5
    },
    "provisional": true,
    "skill": {
      "name": "파쇄 사격",
      "coefficient": "AD",
      "text": "대상에게 200% AD 물리 피해, 4초간 GD -20%",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현."
      ]
    }
  },
  {
    "id": "C30",
    "cost": 3,
    "name": "심해기사 발로스",
    "race": "마족",
    "job": "기사",
    "trait": "물",
    "stats": {
      "HP": 1080,
      "MP": 100,
      "AD": 79,
      "AP": 68,
      "GD": 52,
      "CTH": 150,
      "CTC": 5,
      "AS": 0.69,
      "RNG": 1,
      "DOD": 0
    },
    "provisional": true,
    "skill": {
      "name": "조류의 방패",
      "coefficient": "AP",
      "text": "자신에게 250% AP 보호막(5초), 주변 아군 2명에게 100% AP 회복",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현."
      ]
    }
  },
  {
    "id": "C31",
    "cost": 3,
    "name": "화조의 키라",
    "race": "수인",
    "job": "암살자",
    "trait": "화염",
    "stats": {
      "HP": 850,
      "MP": 80,
      "AD": 99,
      "AP": 63,
      "GD": 34,
      "CTH": 150,
      "CTC": 15,
      "AS": 0.97,
      "RNG": 1,
      "DOD": 10
    },
    "provisional": true,
    "skill": {
      "name": "작열 도약",
      "coefficient": "AD / AP",
      "text": "대상에게 230% AD 물리 피해, 3초간 초당 20% AP 화상",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현."
      ]
    }
  },
  {
    "id": "C32",
    "cost": 3,
    "name": "풍술사 아르덴",
    "race": "인간",
    "job": "마법사",
    "trait": "바람",
    "stats": {
      "HP": 810,
      "MP": 70,
      "AD": 69,
      "AP": 103,
      "GD": 30,
      "CTH": 150,
      "CTC": 5,
      "AS": 0.72,
      "RNG": 4,
      "DOD": 0
    },
    "provisional": true,
    "skill": {
      "name": "회오리 폭발",
      "coefficient": "AP",
      "text": "대상과 인접 적에게 200% AP 마법 피해, 1초간 띄우기",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현.",
        "띄우기 상태의 동작·면역 규칙 미정."
      ]
    }
  },
  {
    "id": "C33",
    "cost": 3,
    "name": "잿불주술사 로한",
    "race": "인간",
    "job": "주술사",
    "trait": "화염",
    "stats": {
      "HP": 870,
      "MP": 80,
      "AD": 74,
      "AP": 98,
      "GD": 34,
      "CTH": 150,
      "CTC": 5,
      "AS": 0.72,
      "RNG": 3,
      "DOD": 0
    },
    "provisional": true,
    "skill": {
      "name": "화염 저주",
      "coefficient": "AP",
      "text": "적 2명에게 160% AP 마법 피해, 4초간 받는 회복량 -30%",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현.",
        "기간제 받는 회복량 감소 상태 연결 필요."
      ]
    }
  },
  {
    "id": "C34",
    "cost": 4,
    "name": "성수사제 미레나",
    "race": "인간",
    "job": "사제",
    "trait": "물",
    "stats": {
      "HP": 1005,
      "MP": 70,
      "AD": 86,
      "AP": 117,
      "GD": 40,
      "CTH": 150,
      "CTC": 5,
      "AS": 0.76,
      "RNG": 3,
      "DOD": 0
    },
    "provisional": true,
    "skill": {
      "name": "생명의 샘",
      "coefficient": "AP",
      "text": "아군 전체 140% AP 회복, 가장 체력이 낮은 아군 추가 160% AP 회복",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현."
      ]
    }
  },
  {
    "id": "C35",
    "cost": 4,
    "name": "독안개술사 샤르",
    "race": "수인",
    "job": "마법사",
    "trait": "독",
    "stats": {
      "HP": 955,
      "MP": 70,
      "AD": 86,
      "AP": 122,
      "GD": 37,
      "CTH": 150,
      "CTC": 5,
      "AS": 0.76,
      "RNG": 4,
      "DOD": 0
    },
    "provisional": true,
    "skill": {
      "name": "맹독 폭풍",
      "coefficient": "AP",
      "text": "적 최대 4명에게 210% AP 마법 피해, 4초간 초당 25% AP 독 피해",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현."
      ]
    }
  },
  {
    "id": "C36",
    "cost": 4,
    "name": "균열칼날 브락",
    "race": "드워프",
    "job": "암살자",
    "trait": "대지",
    "stats": {
      "HP": 995,
      "MP": 80,
      "AD": 116,
      "AP": 82,
      "GD": 41,
      "CTH": 150,
      "CTC": 15,
      "AS": 1.01,
      "RNG": 1,
      "DOD": 10
    },
    "provisional": true,
    "skill": {
      "name": "지맥 절단",
      "coefficient": "AD",
      "text": "대상에게 300% AD 물리 피해, 4초간 GD -25%",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현."
      ]
    }
  },
  {
    "id": "C37",
    "cost": 4,
    "name": "혈익궁수 아리엘",
    "race": "천족",
    "job": "궁수",
    "trait": "혈마법",
    "stats": {
      "HP": 975,
      "MP": 80,
      "AD": 111,
      "AP": 82,
      "GD": 39,
      "CTH": 150,
      "CTC": 10,
      "AS": 0.95,
      "RNG": 4,
      "DOD": 5
    },
    "provisional": true,
    "skill": {
      "name": "붉은 성광",
      "coefficient": "AD",
      "text": "자신 현재 HP 8% 소모, 적 3명에게 각각 210% AD 물리 피해",
      "draft": true,
      "implemented": false,
      "hpCostBasis": "currentHP",
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현."
      ]
    }
  },
  {
    "id": "C38",
    "cost": 4,
    "name": "망령지휘관 세른",
    "race": "언데드",
    "job": "소환사",
    "trait": "신성",
    "stats": {
      "HP": 1025,
      "MP": 80,
      "AD": 91,
      "AP": 117,
      "GD": 43,
      "CTH": 150,
      "CTC": 5,
      "AS": 0.76,
      "RNG": 3,
      "DOD": 0
    },
    "provisional": true,
    "skill": {
      "name": "영혼의 파수꾼",
      "coefficient": "AP",
      "text": "10초간 수호 망령 2기 소환, 각각 공격 시 70% AP 마법 피해, 최대 2기",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현.",
        "소환물 HP/AS/RNG·AI와 고유 소환 동작 미정."
      ]
    }
  },
  {
    "id": "C39",
    "cost": 4,
    "name": "빙벽정령 크리스",
    "race": "정령",
    "job": "기사",
    "trait": "빙결",
    "stats": {
      "HP": 1225,
      "MP": 100,
      "AD": 96,
      "AP": 87,
      "GD": 59,
      "CTH": 150,
      "CTC": 5,
      "AS": 0.72,
      "RNG": 1,
      "DOD": 0
    },
    "provisional": true,
    "skill": {
      "name": "절대 방벽",
      "coefficient": "AP",
      "text": "자신과 인접 아군에게 5초간 220% AP 보호막, 공격자 AS -20%(3초)",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현.",
        "공격자 대상 선정·반격 트리거·범위 규칙 미정."
      ]
    }
  },
  {
    "id": "C40",
    "cost": 4,
    "name": "월영권사 시엘",
    "race": "엘프",
    "job": "무도가",
    "trait": "암흑",
    "stats": {
      "HP": 1125,
      "MP": 90,
      "AD": 111,
      "AP": 87,
      "GD": 47,
      "CTH": 150,
      "CTC": 10,
      "AS": 0.95,
      "RNG": 1,
      "DOD": 5
    },
    "provisional": true,
    "skill": {
      "name": "그림자 연격",
      "coefficient": "AD",
      "text": "대상에게 100% AD 물리 피해 4회, 마지막 타격은 치명타 확률 +30%p",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현."
      ]
    }
  },
  {
    "id": "C41",
    "cost": 4,
    "name": "뇌검장 라그나",
    "race": "마족",
    "job": "전사",
    "trait": "번개",
    "stats": {
      "HP": 1185,
      "MP": 100,
      "AD": 106,
      "AP": 82,
      "GD": 51,
      "CTH": 150,
      "CTC": 5,
      "AS": 0.8,
      "RNG": 1,
      "DOD": 0
    },
    "provisional": true,
    "skill": {
      "name": "폭뢰 참격",
      "coefficient": "AD",
      "text": "전방 최대 3명에게 240% AD 물리 피해, 1초 기절",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현.",
        "방향·범위·우선 대상 선정 규칙 확정 및 개별 연결 필요."
      ]
    }
  },
  {
    "id": "C42",
    "cost": 5,
    "name": "폭풍현자 토르간",
    "race": "드워프",
    "job": "주술사",
    "trait": "바람",
    "stats": {
      "HP": 1160,
      "MP": 80,
      "AD": 108,
      "AP": 136,
      "GD": 48,
      "CTH": 150,
      "CTC": 5,
      "AS": 0.79,
      "RNG": 3,
      "DOD": 0
    },
    "provisional": true,
    "skill": {
      "name": "태풍의 문장",
      "coefficient": "AP",
      "text": "적 전체에게 230% AP 마법 피해, 3초간 AS -25%",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현."
      ]
    }
  },
  {
    "id": "C43",
    "cost": 5,
    "name": "뇌혼권왕 제르반",
    "race": "언데드",
    "job": "무도가",
    "trait": "번개",
    "stats": {
      "HP": 1270,
      "MP": 90,
      "AD": 128,
      "AP": 106,
      "GD": 54,
      "CTH": 150,
      "CTC": 10,
      "AS": 0.99,
      "RNG": 1,
      "DOD": 5
    },
    "provisional": true,
    "skill": {
      "name": "천둥 백격",
      "coefficient": "AD / AP",
      "text": "대상에게 90% AD 물리 피해 6회, 마지막 타격은 주변 적에게 150% AP 마법 피해",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현."
      ]
    }
  },
  {
    "id": "C44",
    "cost": 5,
    "name": "빙영검 아스란",
    "race": "인간",
    "job": "암살자",
    "trait": "빙결",
    "stats": {
      "HP": 1140,
      "MP": 80,
      "AD": 133,
      "AP": 101,
      "GD": 48,
      "CTH": 150,
      "CTC": 15,
      "AS": 1.04,
      "RNG": 1,
      "DOD": 10
    },
    "provisional": true,
    "skill": {
      "name": "영점 처형",
      "coefficient": "AD",
      "text": "가장 먼 적에게 돌진해 350% AD 물리 피해, 2초 기절",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현.",
        "방향·범위·우선 대상 선정 규칙 확정 및 개별 연결 필요."
      ]
    }
  },
  {
    "id": "C45",
    "cost": 5,
    "name": "흑룡궁주 네르칸",
    "race": "용족",
    "job": "궁수",
    "trait": "암흑",
    "stats": {
      "HP": 1120,
      "MP": 80,
      "AD": 128,
      "AP": 101,
      "GD": 46,
      "CTH": 150,
      "CTC": 10,
      "AS": 0.99,
      "RNG": 4,
      "DOD": 5
    },
    "provisional": true,
    "skill": {
      "name": "멸망의 화살",
      "coefficient": "AD",
      "text": "일직선 적 최대 4명에게 300% AD 물리 피해, 4초간 받는 피해 +15%",
      "draft": true,
      "implemented": false,
      "todo": [
        "초안 데이터 등록만 완료. 전투 실행·활성화는 별도 승인 후 구현.",
        "방향·범위·우선 대상 선정 규칙 확정 및 개별 연결 필요.",
        "기간제 받는 피해 증폭 상태 연결 필요."
      ]
    }
  }
];
if(typeof module!=='undefined'&&module.exports)module.exports=records;else root.AutoHigherDrafts=records;
})(typeof globalThis!=='undefined'?globalThis:this);
