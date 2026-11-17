const fs=require('node:fs');
let js=fs.readFileSync('dist/prototype.js','utf8');
function replaceFn(name,nextName,text){const start=js.indexOf('function '+name+'('),end=js.indexOf('\nfunction '+nextName+'(',start);if(start<0||end<0)throw Error('Function boundary: '+name);js=js.slice(0,start)+text.trim()+'\n'+js.slice(end);}
js=js.replace('C=D.prototypeConfig,$=', 'C=D.prototypeConfig,P=AutoProgression,$=');
replaceFn('fresh','load',`function fresh(){state=P.initialize({health:C.run.startingHealth,gold:C.economy.startingGold,units:[make('C03','board',43),make('C01','board',59),make('C05','board',60)],shop:['C02','C04','C09','C10','C11']});}`);
js=js.replace('s?.version===1','(s?.version===1||s?.version===2)').replace('s.wave>=1&&s.wave<=10','s.wave>=1');
js=js.replace('state=s;nextUid=',"state=P.migrate(s);if(state.roundPhase==='combat')state.roundPhase='prepare';P.ensureAugment(state);nextUid=");
js=js.replace('function enemyFormation(){const n=',"function enemyFormation(){if(P.roundType(state.stage,state.round)==='SUPPLY')return [];const n=");
js=js.replace('star:1,scale:C.run.enemyScaleBase','star:1,boss:P.roundType(state.stage,state.round)===\'BOSS\'&&i===0,scale:C.run.enemyScaleBase');
js=js.replace("${u.summon?'◆':'★'.repeat(u.star||1)}","${u.boss?'BOSS':u.summon?'◆':'★'.repeat(u.star||1)}");
js=js.replace('function bondMarkup(s){','function bondMarkup(s,withRecommend=false){').replace('<b>${s.name}</b><span class="count">','<b>${s.name}</b>${withRecommend?`<button class="bond-recommend" data-recommend="${s.id}">${state.recommendedBond===s.id?\'추천 중\':\'추천\'}</button>`:\'\'}<span class="count">');
js=js.replace('entries.filter(s=>s.category===category).map(bondMarkup)','entries.filter(s=>s.category===category).map(s=>bondMarkup(s,true))');
js=js.replace("const t=D.byId(u.id),s=battle&&u.stats?battle.stats(u):{...t.stats};if(!battle||!u.stats){const mult=C.economy.starMultiplier**((u.star||1)-1);for(const k of ['HP','AD','AP'])s[k]*=mult;}","const t=D.byId(u.id),s=battle&&u.stats?battle.stats(u):P.previewStats(state,u);");
js=js.replace('<p class="skill-copy"><strong>${D.skills[u.id].name}', '<p class="hint">장비: ${state.inventory.filter(i=>i.equippedTo===u.uid).map(i=>P.itemById(i.id).name).join(\' · \')||\'없음\'}</p><p class="skill-copy"><strong>${D.skills[u.id].name}');
js=js.replace("$('wave').textContent=\u0060${String(state.wave).padStart(2,'0')} / ${C.run.waves}\u0060;", "$('wave').textContent=P.label(state);");
js=js.replace("state.done?'원정 종료':'배치 준비'","state.done?'원정 종료':state.roundPhase==='augment'?'증강 선택':P.roundType(state.stage,state.round)==='SUPPLY'?'안전 보급':'배치 준비'");
js=js.replace("deployed().length+' / '+C.board.maxDeployed", "deployed().length+' / '+P.capacity(state)");
js=js.replace("$('opponent').textContent=enemyFormation().length+'명';", "$('opponent').textContent=P.roundType(state.stage,state.round)==='SUPPLY'?'안전 보급':P.roundType(state.stage,state.round)==='BOSS'?'보스 · '+enemyFormation().length+'명':enemyFormation().length+'명';");
js=js.replace('<button class="recruit" data-buy="${i}"','<button class="recruit ${P.recommendedMembers(state.recommendedBond).includes(id)?\'recommended\':\'\'}" data-buy="${i}"');
js=js.replace('<b class="cost">1 G</b></button>', '<b class="cost">${P.recommendedMembers(state.recommendedBond).includes(id)?\'<small>추천</small>\':\'\'}1 G</b></button>');
js=js.replace("$('message').textContent=message;renderDebug();", "$('message').textContent=message;renderDebug();renderProgression();");
js=js.replace('state.units=state.units.filter(u=>!remove.includes(u));keep.star++;','P.releaseEquipment(state,remove.map(u=>u.uid));state.units=state.units.filter(u=>!remove.includes(u));keep.star++;');
js=js.replace('deployed().length>=10','deployed().length>=P.capacity(state)').replace("tell('최대 10명까지 배치합니다. 다른 유닛과 교체해 주세요.');","tell('현재 레벨에서는 '+P.capacity(state)+'명까지 배치합니다. 레벨을 올리거나 교체해 주세요.');");
js=js.replace('state.units=state.units.filter(x=>x!==u);selected=null;', 'P.releaseEquipment(state,[u.uid]);state.units=state.units.filter(x=>x!==u);selected=null;');
// Mutating preparation actions stay locked while a receipt or augment is pending.
js=js.replaceAll('if(battle||state.done',"if(battle||state.done||state.roundPhase!=='prepare'");
js=js.replaceAll('if(!selected||battle||state.done)',"if(!selected||battle||state.done||state.roundPhase!=='prepare')");
replaceFn('startBattle','runTimer',`function startBattle(){
 if(state.roundPhase==='result'){showResult(state.lastResult);return;}
 if(state.roundPhase==='augment'){showAugment();return;}
 if(battle||state.done||state.roundPhase!=='prepare')return;
 if(P.roundType(state.stage,state.round)==='SUPPLY'){lastBattle=null;lastResult=P.settleRound(state);save();render();showResult(lastResult);return;}
 if(!deployed().length||deployed().length>P.capacity(state))return;
 selected=null;selectedBattle=null;lastBattle=null;
 battle=new E.Battle(deployed().map(u=>({...u,bonuses:P.unitBonuses(state,u.uid)})),enemyFormation(),{quickMana:$('quickMana').checked,experimental:$('experimental').checked,allyModifiers:P.allyModifiers(state)});
 state.roundPhase='combat';save();tell('자동 전투 중 · 기존 캐릭터 스킬과 유대 판정은 유지됩니다.');render();runTimer();
}`);
replaceFn('endBattle','showResult',`function endBattle(result){
 if(!battle)return;
 clearInterval(timer);timer=null;lastBattle=battle;battle=null;selectedBattle=null;
 lastResult=P.settleRound(state,{...result,survivingEnemies:lastBattle.alive('enemy').filter(u=>!u.summon).length,skillUses:{...lastBattle.skillUses}});
 save();tell((lastResult.win?'승리':'후퇴')+' · 총 보상 +'+lastResult.total+'G');render();$('clock').textContent='직전 전투 '+result.time+'초';showResult(lastResult);
}`);
replaceFn('showResult','resetRun',`function showResult(r){if(!r)return;const supply=r.type==='SUPPLY',title=r.done?'원정 종료':supply?'안전 보급 완료':r.type==='BOSS'?(r.win?'보스 전투 승리':'보스 전투 패배'):(r.win?'전투 승리':'전투 패배');showModal(\
\`<div class="result"><span class="eyebrow">라운드 \${r.key} · \${r.type}</span><br><strong>\${supply?'▣':r.win?'✦':'◇'}</strong><h2>\${title}</h2><p>\${supply?'전투 없이 아이템 1개를 획득했습니다. HP 피해 없음.':r.reason==='timeout'?'시간초과 · 기존 패배 규칙 적용':r.reason==='draw'?'동시 전멸 · 기존 패배 규칙 적용':r.time+'초 전투 종료'}</p><div class="reward-total"><span>이번 라운드 획득 골드</span><b>+\${r.total} G</b></div><div class="reward-row"><span>\${r.type==='BOSS'?'보스 ':''}기본 보상</span><b>+\${r.base} G</b></div><div class="reward-row"><span>이자 · 보상 전 \${r.before}G / 최대 5G</span><b>+\${r.interest} G</b></div>\${r.extra?\`<div class="loot-reward">\${r.type==='BOSS'?'보스 추가 보상':'보급 아이템'} · \${r.extra.kind==='item'?P.itemById(r.extra.itemId).icon+' '+P.itemById(r.extra.itemId).name:'추가 골드 +'+r.bonusGold+'G'}</div>\`:''}<div class="reward-row"><span>현재 골드</span><b>\${r.gold} G</b></div><div class="reward-row"><span>남은 체력</span><b>♥ \${r.health}\${r.loss?' (−'+r.loss+')':''}</b></div><div class="reward-row"><span>라운드 XP <small>임시</small></span><b>+\${r.xpGained} XP\${r.levelAfter>r.levelBefore?' · 레벨 '+r.levelAfter+' 달성':''}</b></div><div class="skills-observed"><b>\${supply?'보급 규칙':'사용된 스킬'}</b><br>\${supply?'기본 골드·이자 없음 · 설정 가능한 임시 규칙':Object.entries(r.skillUses).map(([id,n])=>id+' '+D.skills[id].name+' ×'+n).join('<br>')||'스킬 사용 없음'}</div><button class="primary" data-continue>\${r.done?'결과 확인':'다음 라운드 →'}</button></div>\`);}`);
// Correct template escaping in the generated function source.
js=js.replaceAll('\\${','${');
js=js.replace("if(e.target.closest('[data-continue]'))$('modal').close();", "if(e.target.closest('[data-continue]'))continueRound();");
js=js.replace("fresh();save();$('quickMana')", "fresh();save();$('quickMana')");
js=js.replace("진행을 새 원정으로 교체합니다.","진행·장비·증강·레벨을 새 원정으로 교체합니다.");
js=js.replace("load();tell('1코스트 12종 테스트 · 상점 또는 도감에서 동료를 영입하세요.');render();if(state.done&&state.lastResult)showResult(state.lastResult);", "load();tell(state.migrationNotice||'1-1과 1-2는 안전 보급입니다. 동료를 준비하고 아이템을 받아보세요.');render();if(state.roundPhase==='augment')showAugment();else if(state.roundPhase==='result'||state.done)showResult(state.lastResult);");
js=js.replace('C.run.waves','P.config.roundsPerStage');
// Add event routing to the existing delegated modal handler.
js=js.replace("const free=e.target.closest('[data-free]'),inspectButton", "const recommend=e.target.closest('[data-recommend]'),augment=e.target.closest('[data-augment]');if(recommend){state.recommendedBond=recommend.dataset.recommend;save();render();$('modal').close();tell(state.recommendedBond+' 조합 추천을 동료 영입에 표시합니다.');return;}if(augment){if(P.chooseAugment(state,augment.dataset.augment)){save();$('modal').close();render();tell('증강 선택 완료 · '+P.augmentById(augment.dataset.augment).name);}return;}const free=e.target.closest('[data-free]'),inspectButton");
fs.writeFileSync('dist/prototype.js',js);
let html=fs.readFileSync('dist/index.html','utf8');
html=html.replace('PROTOTYPE 0.5','PROTOTYPE 0.6').replace('<div><span>이번 전투</span><b id="opponent"></b></div>','<div><span>이번 전투</span><b id="opponent"></b></div><div class="level-stat"><span id="levelLabel"></span><b id="xpLabel"></b><button id="buyXpBtn">4G → 4XP</button></div>');
html=html.replace('<div class="workspace">','<div id="roundTrack" class="round-track"></div><div class="workspace">');
html=html.replace('<div id="shop"></div>','<div id="recommendPanel"></div><div id="shop"></div>');
html=html.replace('<div class="economy"><b>테스트용 임시 규칙</b>', '<section class="inventory-panel"><div class="section-heading"><h3>아이템 보관함</h3><span>유닛당 1개 · 임시</span></div><div id="inventory"></div><h3>선택 증강</h3><div id="chosenAugments"></div></section><div class="economy"><b>테스트용 임시 규칙</b>');
html=html.replace('승리 +7G · 패배 +5G','일반 5G / 3G · 보스 7G / 5G').replace('최대 10명 배치 · 최대 3성','레벨 = 배치 인원 · 최대 10명 / 3성');
html=html.replace('<script src="prototype.js"></script>','<script src="progression.js"></script><script src="prototype.js"></script><script src="stage-ui.js"></script>');
fs.writeFileSync('dist/index.html',html);fs.writeFileSync('dist/prototype.html',html);
