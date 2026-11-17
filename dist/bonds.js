(function(root){'use strict';
const pairs=`종언 흑월,심연 금단,철혈 윤회,월하 무극,생명 운명,월하 무극,아르카나 운명,심연 금단,천명 무극,철혈 왕권,공명 심연,성약 천명,공명 왕권,혈광 무극,성약 윤회,공명 운명,혈광 금단,생명 윤회,생명 왕권,혈광 금단,아르카나 심연,철혈 천명,철혈 왕권,성약 흑월,아르카나 공명,흑월 윤회,월하 종언,종언 흑월,종언 천명,성약 생명,혈광 월하,아르카나 공명,아르카나 운명,생명 윤회,심연 금단,철혈 성약,월하 천명,윤회 금단,생명 왕권,종언 흑월,혈광 무극,공명 운명,무극 금단,혈광 흑월,종언 흑월`.split(',').map(s=>s.split(' '));
// Temporary mixed balance v1. Every row is the complete replacement tier.
const rules={
 혈광:[{AD:.10},{AD:.15,low:.5,lowAS:.25},{AD:.20,low:.6,lowAS:.4,leech:.1}],
 월하:[{AS:.10},{AS:.15,chain:.05,chainCap:4}],
 종언:[{AD:.10},{AD:.15,execute:.3,executeDamage:.2},{AD:.20,execute:.4,executeDamage:.35,killMP:20}],
 흑월:[{CTC:10},{CTC:15,critExtra:.3},{CTC:20,critExtra:.5,critKill:true}],
 무극:[{AS:.10},{AS:.15,stackAS:.03,stackCap:5},{AS:.20,stackAS:.04,stackCap:8,fullBasic:.2}],
 철혈:[{GD:10},{GD:15,startShield:.15}],
 성약:[{HP:.10},{HP:.15,share:.15}],
 생명:[{healing:.15},{healing:.25,pulse:.05},{healing:.35,pulse:.08,pulseShield:.08}],
 윤회:[{HP:.10},{HP:.15,deathPower:.05,deathCap:4},{HP:.20,deathPower:.07,deathCap:5,revive:.3}],
 천명:[{GD:10},{GD:15,adjacentGD:10}],
 왕권:[{HP:.10},{HP:.15,ccAmp:.1}],
 아르카나:[{AP:.10},{AP:.15,castMP:15}],
 공명:[{AP:.10},{AP:.15,resonance:.3},{AP:.20,resonance:.5,splash:.5}],
 심연:[{AP:.10},{AP:.15,antiheal:.3}],
 운명:[{AD:.08,AP:.08},{AD:.12,AP:.12,fate:true}],
 금단:[{skill:.10},{skill:.20,hpCost:.04,nextSkill:.15},{skill:.30,hpCost:.05,nextSkill:.25,skillLeech:.1}]
};
function text(r){const a=[];for(const k of ['HP','AD','AP','AS'])if(r[k])a.push(k+' +'+Math.round(r[k]*100)+'%');if(r.GD)a.push('GD +'+r.GD);if(r.CTC)a.push('치명타 +'+r.CTC+'%p');if(r.low)a.push('HP '+r.low*100+'% 이하 AS +'+r.lowAS*100+'%');if(r.leech)a.push('가한 피해 10% 흡혈');if(r.chain)a.push('동일 대상 연속 기본 공격 +5%p · 최대 4중첩');if(r.execute)a.push('대상 HP '+r.execute*100+'% 이하 피해 +'+r.executeDamage*100+'%');if(r.killMP)a.push('처치 MP +20');if(r.critExtra)a.push('치명타 추가 물리 피해 AD '+r.critExtra*100+'%');if(r.critKill)a.push('치명타 처치 후 다음 기본 공격 확정 치명타');if(r.stackAS)a.push('기본 공격마다 AS +'+r.stackAS*100+'%p · 최대 '+r.stackCap+'중첩');if(r.fullBasic)a.push('최대 중첩 기본 공격 피해 +20%');if(r.startShield)a.push('시작 시 최대 HP 15% 보호막 · 8초');if(r.share)a.push('인접 아군 피해 15% 분담 · 1회 전달');if(r.healing)a.push('제공 회복·보호막 +'+r.healing*100+'%');if(r.pulse)a.push('유대 전체 5초마다 최저 HP 비율 아군 최대 HP '+r.pulse*100+'% 회복');if(r.pulseShield)a.push('같은 대상 최대 HP 8% 보호막 · 5초');if(r.deathPower)a.push('아군 사망 시 AD/AP +'+r.deathPower*100+'% · 최대 '+r.deathCap+'중첩');if(r.revive)a.push('각 유닛 첫 사망 시 HP 30% 즉시 부활 · 전투당 1회');if(r.adjacentGD)a.push('시작 인접 아군 GD +10 · 중복 미중첩');if(r.ccAmp)a.push('자신의 군중제어 대상 받는 피해 +10% · 3초');if(r.castMP)a.push('시전 후 MP +15');if(r.resonance)a.push('직접 스킬 명중 대상당 시전당 1회 AP '+r.resonance*100+'% 추가 마법 피해');if(r.splash)a.push('인접 적 1명에 추가 피해의 50%');if(r.antiheal)a.push('스킬 명중 대상 받는 회복 -30% · 4초');if(r.fate)a.push('시작 시 유대 공통 무작위: AD/AP +10% / GD +15 / 시작 MP +20');if(r.skill)a.push('스킬 피해 +'+r.skill*100+'%');if(r.hpCost)a.push('시전 시 현재 HP '+r.hpCost*100+'% 소모 · 최소 HP 1');if(r.nextSkill)a.push('다음 스킬 피해 +'+r.nextSkill*100+'% · 중복 미중첩');if(r.skillLeech)a.push('실제 스킬 피해 10% 회복');return a.join(' · ');}
const definitions=Object.entries(rules).map(([name,tiers])=>({id:name,name,category:'bond',thresholds:tiers.map((_,i)=>(i+1)*2),concept:text(tiers.at(-1)),effects:tiers.map(text),confirmedEffect:false,balanceVersion:1}));
const api={pairs,rules,definitions,text,has:(u,name)=>!!u?.bonds?.includes(name)};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AutoBonds=api;
})(typeof globalThis!=='undefined'?globalThis:this);
