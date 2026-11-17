const fs=require('node:fs');
let js=fs.readFileSync('dist/game.js','utf8');
js=js.replace('function unitMarkup(u,enemy=false,combat=false){','function unitMarkup(u,enemy=false,combat=false,full=false){').replace('${portrait(t)}<span class="stars">','${portrait(t,full)}<span class="stars">').replace("unitMarkup({id:t.id,uid:-1,star:1})","unitMarkup({id:t.id,uid:-1,star:1},false,false,true)");
fs.writeFileSync('dist/game.js',js);
let html=fs.readFileSync('dist/index.html','utf8').replace('조합의 힘','조합').replace('프로토타입 0.3','프로토타입 0.4').replace('content="#101a19"','content="#09090b"');
fs.writeFileSync('dist/index.html',html);
