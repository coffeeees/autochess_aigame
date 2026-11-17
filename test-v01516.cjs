'use strict';
const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('./dist/data'),P=require('./dist/progression'),V=require('./dist/preparation'),W=require('./dist/encounters');
const E=require('./dist/engine'),Events=require('./dist/vfx-events'),Visuals=require('./dist/combat-visuals'),Pixels=require('./dist/pixel-vfx');
let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
function rng(){let seed=412;return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function simulate(id){
 const battle=new E.Battle([{id,pos:31,itemIds:['I27','I39'],bonuses:{HP:200}}],[{id:'E06',pos:3,star:2},{id:'E01',pos:4}],{rng:rng(),quickMana:true});
 while(!battle.result)battle.tick();
 return {result:battle.result,units:battle.units,logs:battle.logs.map(({visual,...row})=>row)};
}
const before=D.playableIds.map(simulate);
Events.install(E.Battle);
test('visual metadata preserves all33 deterministic battles including damage, RNG, final units and log ordering',()=>{
 D.playableIds.forEach((id,index)=>a.deepEqual(simulate(id),before[index],id));
});
test('event geometry and ranged MISS attribution survive later unit movement without inventing a hit',()=>{
 const battle=new E.Battle([{id:'C01',pos:31}],[{id:'E01',pos:3}],{rng:()=>0});
 const [source,target]=battle.units;target.stats.DOD=100;
 battle.deal(source,target,100,'physical',{kind:'basic'});
 const event=battle.events.find(row=>row.kind==='evade');
 a.equal(event.visual.source,source.uid);a.equal(event.visual.sourcePos,31);a.equal(event.visual.targetPos,3);
 source.pos=32;target.pos=4;
 const command=Visuals.plan([event],battle.units)[0];
 a.equal(command.sourcePos,31);a.equal(command.targetPos,3);
 a.deepEqual(Pixels.mapping(command),{theme:'gray',flight:true,hit:false});
});
test('gray basic and instant yellow C01 skill have disjoint mapping; DOT/item/melee/other skills stay unchanged',()=>{
 const base={sourceId:'C01',kind:'damage',attackKind:'basic',ranged:true};
 a.deepEqual(Pixels.mapping(base),{theme:'gray',flight:true,hit:true});
 a.equal(Pixels.mapping({...base,ranged:false}),null);
 a.deepEqual(Pixels.mapping({...base,attackKind:'skill'}),{theme:'yellow',flight:false,hit:true});
 for(const patch of [{attackKind:'dot'},{attackKind:'item'},{kind:'cast'},{attackKind:'skill',sourceId:'C05'},{attackKind:'skill',sourceSummon:true}])a.equal(Pixels.mapping({...base,...patch}),null);
});
test('pixel lifetime is opaque until deletion, flight has one impact, MISS has none, repeated event is ignored',()=>{
 const previous={document:global.document,requestAnimationFrame:global.requestAnimationFrame,cancelAnimationFrame:global.cancelAnimationFrame};
 const rectangles=[];
 const context={globalAlpha:1,setTransform(){},clearRect(){},save(){},restore(){},translate(){},rotate(){},createRadialGradient(){return {addColorStop(){}};},fillRect(...args){rectangles.push({alpha:this.globalAlpha,color:this.fillStyle,args});}};
 const canvas={style:{},setAttribute(){},getContext:()=>context,remove(){}};
 global.document={createElement:()=>canvas};global.requestAnimationFrame=()=>1;global.cancelAnimationFrame=()=>{};
 try{
  const layer=new Pixels.PixelVfx({appendChild(){},clientWidth:700,clientHeight:800},{random:()=>.5});
  const source={x:80,y:80,w:100},target={x:180,y:250,w:100};
  layer.burst(source,'gray','launch',0);a.equal(layer.particles.length,14);
  layer.draw(150);a.equal(layer.particles.length,14);
  for(const rect of rectangles.filter(row=>Pixels.themes.gray.particles.includes(row.color)))a.equal(rect.alpha,1);
  layer.draw(220);a.equal(layer.particles.length,0);layer.clear();
  let hits=0;
  const command={eventId:'shot',sourceId:'C01',kind:'damage',attackKind:'basic',ranged:true};
  a(layer.play(command,source,target,100,1,()=>hits++));
  a(!layer.play(command,source,target,100,1,()=>hits++));
  const time=performance.now()+120;layer.draw(time);a.equal(hits,1);a.equal(layer.particles.length,36);layer.draw(time+400);a.equal(hits,1);a.equal(layer.particles.length,0);
  a(layer.play({...command,eventId:'miss',kind:'evade'},source,target,100,1,()=>hits++));
  layer.draw(performance.now()+500);a.equal(hits,1);a.equal(layer.shots.length,0);a.equal(layer.particles.length,0);
  layer.play({...command,eventId:'skill',attackKind:'skill'},source,target,100,1,()=>hits++);
  a.equal(layer.shots.length,0);a.equal(layer.particles.length,22);a.equal(hits,2);
  layer.resize(400,500);a.equal(layer.particles.length,0);a.equal(layer.frame,null);
  for(let i=0;i<200;i++)layer.play({...command,eventId:'load'+i},source,target,100,1,()=>{});
  a(layer.shots.length<=Pixels.limits.shots);a(layer.particles.length<=Pixels.limits.particles);a(layer.bursts.length<=Pixels.limits.bursts);
  layer.clear();layer.draw(performance.now()+1000);a.equal(layer.particles.length,0);a.equal(layer.shots.length,0);
  a(!layer.play({...command,eventId:'stale',eventAt:Date.now()-1000},source,target,100,1,()=>hits++));a.equal(hits,2);layer.destroy();
 }finally{Object.assign(global,previous);}
});
function uiFixture(){
 const elements=new Map();
 const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',open:false,style:{},classList:{toggle(){},add(){},remove(){}},addEventListener(){},setAttribute(){},close(){this.open=false;},showModal(){this.open=true;}});return elements.get(id);};
 const document={getElementById:element,addEventListener(){},querySelectorAll:()=>[]};
 const context=vm.createContext({AutoData:D,AutoEngine:{},AutoProgression:P,AutoWorld:W,AutoPreparation:V,document,clearInterval(){},console,setTimeout,clearTimeout,localStorage:{setItem(){}}});
 const script=fs.readFileSync('dist/prototype.js','utf8');
 vm.runInContext(script.slice(0,script.lastIndexOf('\nload();')),context);
 vm.runInContext(fs.readFileSync('dist/stage-ui.js','utf8'),context);
 vm.runInContext("var enemyCalls=0,resets=0,openedDuringEnemy=[];var combatView={reset(){resets++;}};function enemyFormation(){enemyCalls++;openedDuringEnemy.push($('modal').open);return [{id:'E01',uid:-1,pos:3,team:'enemy'}];}function pawn(u){return 'ENEMY_'+u.id;}function render(){renderBoard();}function save(){}function notify(){}",context);
 return {context,element,run:source=>vm.runInContext(source,context)};
}
test('result/reloaded supply/normal/boss boards suppress enemies, and confirmed next stage closes before placement once',()=>{
 const ui=uiFixture();
 for(const [stage,round] of [[1,1],[2,1],[2,5]]){
  const state=P.initialize({units:[],health:100,gold:7,shop:[]});Object.assign(state,{stage,round,roundPhase:'combat'});
  if(P.roundType(stage,round)==='SUPPLY'){state.roundPhase='prepare';P.beginSupply(state);P.toggleSupply(state,0);P.toggleSupply(state,1);P.confirmSupply(state);}else P.settleRound(state,{winner:'ally'});
  ui.context.seed=JSON.parse(JSON.stringify(state));
  ui.run("state=P.migrate(seed);battle=null;combatView=null;enemyCalls=0;renderBoard();");
  a.equal(ui.run('enemyCalls'),0);a(!ui.element('board').innerHTML.includes('ENEMY_'));
 }
 ui.context.seed=P.initialize({units:[],health:100,gold:7,shop:[]});
 Object.assign(ui.context.seed,{stage:2,round:1,roundPhase:'combat'});P.settleRound(ui.context.seed,{winner:'ally'});
 ui.run("state=seed;combatView={reset(){resets++;}};$('modal').open=true;enemyCalls=0;resets=0;continueRound();continueRound();");
 a.equal(ui.run('state.round'),2);a.equal(ui.run('enemyCalls'),1);a.equal(ui.run('resets'),2);a.equal(ui.run('openedDuringEnemy[0]'),false);
});
console.log('\n'+count+' v0.15.16 regression tests passed.');
