(function(root){'use strict';
const traitPalette=Object.freeze({화염:'#ff8457',빙결:'#a8e8ff',번개:'#ffe45c',대지:'#b48755',바람:'#86dfb6',물:'#55baff',신성:'#fff4c6',암흑:'#b18aff',독:'#abd85e',혈마법:'#ed718d'});
function effectStyle(trait){return {trait:trait||'무속성',color:traitPalette[trait]||'#d5cbe3'};}
const B=typeof module!=='undefined'&&module.exports?require('./board.js'):root.AutoBoard;
const point=B.point,distance=B.distance;
function numberText(amount){if(!(amount>0))return '0';return amount<1?'<1':Math.round(amount).toLocaleString('ko-KR');}
function plan(events,units){const byId=new Map(units.map(u=>[u.uid,u])),out=[];for(const e of events||[]){const source=byId.get(e.source),target=byId.get(e.target),base={eventId:e.visual?.id,eventAt:e.visual?.atMs,source:e.source??e.visual?.source,target:e.target,sourcePos:e.sourcePos??e.visual?.sourcePos??source?.pos,targetPos:e.visual?.targetPos??target?.pos,skillVisual:e.visual?.skillVisual,sourceId:e.visual?.sourceId??source?.id,sourceSummon:e.visual?.sourceSummon??!!source?.summon,sourceTrait:source?.summonKind==='fire'?'화염':source?.summonKind==='lightning'?'번개':source?.summonKind==='plague'?'독':source?.trait,targetTeam:target?.team,critical:!!e.critical};
 if(e.kind==='damage'&&target){const ranged=source&&(source.stats.RNG>1||distance(source.pos,target.pos)>1),kind=e.attackKind||'skill';out.push({...base,kind:'damage',amount:Math.max(0,e.amount||0),text:e.amount>0?(e.critical?'치명타 ':'')+'−'+numberText(e.amount):'흡수',tone:kind==='dot'?'dot':e.critical?'critical':target.team==='ally'?'incoming':e.damageType==='magic'?'magic':'physical',ranged:e.visual?.ranged??!!ranged,attackKind:kind,damageType:e.damageType,itemProc:e.sourceTag==='ITEM_PROC'});}
 else if(e.kind==='heal'&&target&&e.amount>0)out.push({...base,kind:'heal',text:'+'+numberText(e.amount),amount:e.amount,tone:'healing'});
 else if(e.kind==='shield'&&target&&e.amount>0)out.push({...base,kind:'shield',text:'보호막 +'+numberText(e.amount),amount:e.amount,tone:'shielding'});
 else if(e.kind==='evade'&&target)out.push({...base,kind:'evade',text:'회피',tone:'evade',ranged:!!e.visual?.ranged,attackKind:e.visual?.attackKind});
 else if(e.kind==='chainLightning'&&source)out.push({...base,kind:'chainLightning',primary:e.primary,chains:e.chains});
 else if(e.kind==='skill'&&source)out.push({...base,kind:'cast'});
 else if(e.kind==='summon'&&target)out.push({...base,kind:'spawn'});
 else if(e.kind==='death'&&target)out.push({...base,kind:'death'});
 }return out;}
const api={plan,point,distance,numberText,traitPalette,effectStyle};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AutoCombatVisuals=api;
})(typeof globalThis!=='undefined'?globalThis:this);
