const assert=require('node:assert/strict');
const elements=new Map();const el=()=>({textContent:'',innerHTML:'',dataset:{},classList:{add(){}},addEventListener(){},append(){},showModal(){this.open=true},close(){this.open=false}});
global.document={getElementById(id){if(!elements.has(id))elements.set(id,el());return elements.get(id)},querySelector(){return null},createElement:el};global.localStorage={getItem(){return null},setItem(){}};
let callback;global.setInterval=fn=>{callback=fn;return 1};global.clearInterval=()=>{};
const g=require('./dist/game.js');
const base=()=>({version:1,wave:1,health:100,gold:50,units:[],shop:['oak','moss','moon','comet'],done:false});
let s=base();s.units=[g.make('oak','board',17),g.make('oak'),g.make('oak')];g.setState(s);g.merge();assert.equal(s.units.length,1);assert.equal(s.units[0].star,2);assert.equal(s.units[0].pos,17);
assert.equal(g.synergy([g.make('oak'),g.make('oak')]).forest,1);assert.equal(g.synergy([g.make('oak'),g.make('fern')]).forest,2);
s=base();s.units=[g.make('oak','board',17),g.make('fern')];g.setState(s);g.buy(1);assert.equal(s.gold,48);assert.equal(s.units.length,3);
assert.equal(g.distance(4,5),5);assert.equal(g.enemies(10).filter(x=>x.boss).length,1);
// A strong squad must finish each wave without overlapping living positions or hanging.
for(let wave=1;wave<=10;wave++){s=base();s.wave=wave;s.units=['oak','fern','moss','sun','moon','comet'].map((id,i)=>g.make(id,'board',[15,25,26,19,28,29][i],3));g.setState(s);g.startBattle();let ticks=0;while(g.getBattle()&&ticks++<160){callback();const b=g.getBattle();if(b){const positions=b.units.filter(u=>u.hp>0).map(u=>u.pos);assert.equal(new Set(positions).size,positions.length);assert(positions.every(p=>p>=0&&p<30));}}assert(!g.getBattle(),`wave ${wave} hung`);assert.equal(s.health,100,`strong team lost wave ${wave}`);if(wave===10)assert(s.done);else assert.equal(s.wave,wave+1);}
// A defeated squad loses health, earns supplies, and can advance.
s=base();s.wave=9;s.units=[g.make('fern','board',29)];g.setState(s);g.startBattle();let n=0;while(g.getBattle()&&n++<160)callback();assert(s.health<100);assert.equal(s.wave,10);assert(s.gold>50);
for(const [gold,interest] of [[0,0],[9,0],[10,1],[49,4],[50,5],[60,5],[120,5]]){
 for(const win of [true,false]){s=base();s.gold=gold;g.setState(s);g.finish(win);const r=g.getLastResult();assert.equal(r.interest,interest);assert.equal(r.total,(win?7:5)+interest);assert.equal(s.gold,gold+r.total);assert.equal(s.lastResult.gold,s.gold);assert(elements.get('modalContent').innerHTML.includes('이번 전투 획득 골드'));assert(elements.get('modalContent').innerHTML.includes(`+${r.total}`));assert(elements.get('modal').open);}
}
s=base();s.health=1;g.setState(s);g.finish(false);assert(s.done);assert.equal(s.health,0);assert(elements.get('modalContent').innerHTML.includes('원정 종료'));
s=base();s.wave=10;g.setState(s);g.finish(true);assert(elements.get('modalContent').innerHTML.includes('별빛 원정, 완주!'));
for(const t of g.TYPES){const markup=g.unitMarkup(g.make(t.id));assert(markup.includes(g.COST_COLORS[t.cost]));assert(markup.includes('card-art'));assert(markup.includes(`${t.cost}G`));}
console.log('PASS: merge, purchase, synergies, 10-wave combat, loss, interest boundaries/cap, reward totals, victory/defeat/final popups, cost-colored illustrated cards.');
