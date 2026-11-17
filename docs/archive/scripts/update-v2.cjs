const fs=require('node:fs');
let js=fs.readFileSync('dist/game.js','utf8');
js=js.replace("const FACTIONS=", "const COST_COLORS={1:'#999da7',2:'#58ba7c',3:'#5599ef'};\nfunction cardStyle(t){const i=TYPES.indexOf(t);return `--unit:${COST_COLORS[t.cost]};--art-x:${(i%5)*25}%;--art-y:${Math.floor(i/5)*100}%`;}\nfunction portrait(t){return `<span class=\"card-art\" style=\"${cardStyle(t)}\" aria-hidden=\"true\"></span>`;}\nconst FACTIONS=");
js=js.replace("let state,selected=null", "let lastResult=null;\nlet state,selected=null");
js=js.replace("function unitMarkup(u,enemy=false,combat=false){", "function unitMarkup(u,enemy=false,combat=false){");
const unitStart=js.indexOf('function unitMarkup('),unitEnd=js.indexOf('\nfunction enemies(',unitStart);
js=js.slice(0,unitStart)+`function unitMarkup(u,enemy=false,combat=false){const t=type(u.id),health=combat?Math.max(0,u.hp/u.maxHp*100):100;return \`<div class="unit illustrated \${enemy?'enemy':''} \${selected===u.uid?'selected':''}" data-unit="\${u.uid}" style="\${cardStyle(t)}">\${portrait(t)}<span class="stars">\${'★'.repeat(u.star)}</span><span class="card-cost">\${t.cost}G</span><span class="faction-mark">\${enemy?'敵':FACTIONS[t.faction].icon}</span><span class="name">\${u.boss?'別 포식자'.replace('別','별'):t.name}</span><span class="hpbar"><i style="width:\${health}%"></i></span></div>\`;}`+js.slice(unitEnd);
js=js.replace('<span class="portrait" style="--unit:${type(id).color}">${type(id).icon}</span>', '<span class="portrait illustrated" style="${cardStyle(type(id))}">${portrait(type(id))}</span>');
js=js.replace('<button class="recruit" data-buy="${i}"', '<button class="recruit" style="${cardStyle(type(id))}" data-buy="${i}"');
js=js.replace('style="color:${t.color}"','style="color:${COST_COLORS[t.cost]}"');
const start=js.indexOf('function finish(win)'),end=js.indexOf('\nfunction showModal',start);
js=js.slice(0,start)+`function finish(win){
 clearInterval(timer);timer=null;battle=null;
 const wave=state.wave,before=state.gold,interest=Math.min(5,Math.floor(before/10)),base=win?7:5,total=base+interest,damage=win?0:Math.min(state.health,10+wave*2);
 state.gold+=total;state.health=Math.max(0,state.health-damage);
 state.done=state.health<=0||wave===10;
 lastResult={wave,win,before,interest,base,total,damage,gold:state.gold,health:state.health,done:state.done};
 const msg=win?\`✦ 승리! +\${total}G 보급을 받았습니다.\`:\`원정대 후퇴. 체력 −\${damage}, +\${total}G 보급.\`;
 log(\`\${wave} 웨이브 · \${msg}\`);
 if(!state.done){state.wave++;shopRoll();}
 state.lastResult=lastResult;save();render();notify(msg);$('clock').textContent=state.done?'원정 종료':'다음 전투를 준비하세요';showResult(lastResult);
}
function showResult(r){
 const title=r.done?(r.health>0?'별빛 원정, 완주!':'원정 종료'):(r.win?'전투 승리':'전투 패배');
 showModal(\`<div class="result \${r.win?'victory':'defeat'}"><span class="eyebrow">WAVE \${String(r.wave).padStart(2,'0')} · \${r.done?'EXPEDITION RESULT':'BATTLE RESULT'}</span><div class="result-symbol">\${r.win?'✦':'◇'}</div><h2>\${title}</h2><p>\${STAGES[r.wave-1]} · \${r.win?'동료들이 승리를 가져왔습니다.':'원정대가 후퇴했습니다.'}</p><div class="reward-total"><span>이번 전투 획득 골드</span><strong>+\${r.total}<small> G</small></strong></div><div class="reward-breakdown"><div><span>\${r.win?'승리':'패배'} 기본 보상</span><b>+\${r.base} G</b></div><div><span>보유 골드 이자 <small>전투 전 \${r.before}G · 최대 5G</small></span><b>+\${r.interest} G</b></div><div class="reward-balance"><span>현재 보유 골드</span><b>\${r.gold} G</b></div><div><span>남은 체력</span><b>♥ \${r.health}\${r.damage?\` <small class="health-loss">−\${r.damage}</small>\`:''}</b></div></div><button class="primary full result-continue" id="resultContinue">\${r.done?'결과 확인':'다음 웨이브 준비 →'}</button></div>\`);
}
`+js.slice(end);
const gs=js.indexOf('function graphics()'),ge=js.indexOf("\n$('board')",gs);
js=js.slice(0,gs)+`function graphics(){showModal(\`<span class="eyebrow">ILLUSTRATED COLLECTION</span><h2>별빛 원정대 도감</h2><p>캐릭터 일러스트 카드를 적용했습니다. 테두리는 코스트, 문양은 속성을 나타냅니다.</p><div class="cost-legend"><span style="--unit:\${COST_COLORS[1]}">1G · 회색</span><span style="--unit:\${COST_COLORS[2]}">2G · 초록</span><span style="--unit:\${COST_COLORS[3]}">3G · 파랑</span></div><div class="collection">\${TYPES.map(t=>\`<div class="collection-card">\${unitMarkup({id:t.id,uid:-1,star:1})}<small>\${FACTIONS[t.faction].name} · \${t.role}</small></div>\`).join('')}</div><p>같은 캐릭터의 성급이 올라가도 기본 코스트의 테두리 색상은 유지됩니다.</p>\`);}`+js.slice(ge);
js=js.replace("if(e.target.closest('.close'))$('modal').close();", "if(e.target.closest('.close')||e.target.id==='resultContinue')$('modal').close();");
js=js.replace("fresh();save();render();$('clock')", "fresh();lastResult=null;save();render();$('clock')");
js=js.replace("if(state.done)notify('종료된 원정입니다. 새 원정으로 다시 시작하세요.');", "if(state.done){notify('종료된 원정입니다. 새 원정으로 다시 시작하세요.');if(state.lastResult)showResult(state.lastResult);}");
js=js.replace('getBattle:()=>battle','getBattle:()=>battle,getLastResult:()=>lastResult,COST_COLORS,unitMarkup');
fs.writeFileSync('dist/game.js',js);
let html=fs.readFileSync('dist/index.html','utf8').replace('그래픽 실험실 ↗','캐릭터 도감 ↗').replace('(최대 3G)','(최대 5G)').replace('프로토타입 0.1','프로토타입 0.2');
fs.writeFileSync('dist/index.html',html);
