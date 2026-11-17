const fs=require('fs');let s=fs.readFileSync('dist/prototype.js','utf8');
s=s.replace("const hair=['#383139'","const hair=['#383139'").replace("'#d2c9b7'][index-1]","'#d2c9b7'][(index-1)%12]");
s=s.replace("<span class=\"id\">${u.id}</span>","${costOrb(u.id)}");
s=s.replace("if(!free&&state.gold<1)","if(!free&&state.gold<D.byId(id).cost)").replace("if(!free)state.gold--;","if(!free)state.gold-=D.byId(id).cost;");
s=s.replace("state.gold+=3**(u.star-1)","state.gold+=D.byId(u.id).cost*3**(u.star-1)");
s=s.replace('${D.byId(id).name} 구매 1G','${D.byId(id).name} 구매 ${D.byId(id).cost}G').replace('${icon(id)}<span><b class="name">','${costOrb(id)}${icon(id)}<span><b class="name">').replace('<b class="cost">1 G</b>','<b class="cost">${D.byId(id).cost} G</b>');
s=s.replace('C01–C12의 이름·능력치·스킬','C01–C23의 이름·능력치·스킬').replace('2~5코스트의 이름·능력치·스킬 설명도 신규 초안으로 등록되어 있습니다.','1·2코스트는 영입·전투 가능하며 3~5코스트는 초안으로 등록되어 있습니다.').replace('2–5코스트 · 33종 초안 등록 / 비활성','3–5코스트 · 22종 초안 등록 / 비활성').replace('${icon(t.id)}<div><b>','<div class="roster-portrait">${costOrb(t.id)}${icon(t.id)}</div><div><b>');
s=s.replace('상점에서 1G로 동료를 구매','상점에서 코스트에 맞는 골드로 동료를 구매');
s=s.replace('현재 1코스트 풀 최대','현재 해금 풀 최대').replace('현재 1코스트 풀로 달성 불가능한 단계','현재 1·2코스트 풀로 달성 불가능한 단계').replace('1코스트 테스트 플레이','AUTOCHESS 플레이 방법').replace('원하는 1코스트 동료','원하는 동료');
s=s.replace("<button data-free=\"${t.id}\" ${battle||state.done?'disabled':''}>","<button data-free=\"${t.id}\" ${battle||state.done||!V.shopPool(state).includes(t.id)?'disabled':''}>");
s=s.replace("$('recruitGold').textContent=state.gold+' G';","$('recruitGold').textContent=state.gold+' G';renderOdds();");
fs.writeFileSync('dist/prototype.js',s);
s=fs.readFileSync('dist/interaction-ui.js','utf8');s=s.replace("let dragAction=null,ignoreClickUntil=0,selectedItem=null;",`let dragAction=null,ignoreClickUntil=0,selectedItem=null;
function costOrb(id){const spec=W.combatSpec(id),cost=spec.cost||1;return \`<span class="cost-orb cost-\${cost}" style="--cost-color:\${D.costColors[cost]}" title="\${cost}코스트" aria-label="\${cost}코스트">\${cost}</span>\`;}
function renderOdds(){const odds=V.shopOdds(state);$('shopOdds').innerHTML=\`<b>Lv.\${state.level}</b> \${odds.slice(0,2).map((n,i)=>\`<span>\${i+1}G <strong>\${Number(n.toFixed(2))}%</strong></span>\`).join('')}<details><summary>원본 확률표</summary><p>화폐전쟁 기본표를 참고하고 현재 해금된 코스트만 합계100%로 환산합니다. 해당 코스트의 모든 캐릭터가3성이면 남은 코스트에 재분배합니다.</p><table><thead><tr><th>Lv</th>\${[1,2,3,4,5].map(c=>\`<th>\${c}G</th>\`).join('')}</tr></thead><tbody>\${Object.entries(V.baseOdds).map(([level,row])=>\`<tr><td>\${level}</td>\${row.map(n=>\`<td>\${n}%</td>\`).join('')}</tr>\`).join('')}</tbody></table><a href="\${V.oddsSource}" target="_blank" rel="noopener">확률표 출처: BWIKI ↗</a></details>\`;}
`);
fs.writeFileSync('dist/interaction-ui.js',s);
s=fs.readFileSync('dist/shell-ui.js','utf8').replace("color=summonKind==='fire'?'#d68c59':summonKind==='plague'?'#98ad72':t.color","color=summonKind==='fire'?'#d68c59':summonKind==='lightning'?'#dfc966':summonKind==='plague'?'#98ad72':t.color");fs.writeFileSync('dist/shell-ui.js',s);
for(const f of ['index.html','prototype.html']){let h=fs.readFileSync('dist/'+f,'utf8').replace('PROTOTYPE 0.8','PROTOTYPE 0.9').replace('1코스트 테스트','1·2코스트 테스트').replace('<div id="shop"></div>','<div id="shopOdds" class="shop-odds"></div><div id="shop"></div>');fs.writeFileSync('dist/'+f,h);}
fs.appendFileSync('.gitignore','\nupdate-costs.cjs\n');
