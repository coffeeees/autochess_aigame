(function(root){'use strict';
class StepClock{
 constructor(now,step,speed=1){this.last=now;this.step=step;this.speed=speed;this.credit=0;this.paused=false;}
 advance(now){const elapsed=Math.max(0,now-this.last);this.last=now;if(this.paused)return 0;this.credit+=elapsed*this.speed;const ticks=Math.floor((this.credit+1e-7)/this.step);this.credit-=ticks*this.step;return ticks;}
}
const api={StepClock};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AutoCombatClock=api;
})(typeof globalThis!=='undefined'?globalThis:this);
