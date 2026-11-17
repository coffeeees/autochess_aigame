(function(root){'use strict';
// Registered source files are unchanged. Frame cropping only excludes transparent
// padding; logical tracks follow measured line centres, including 1–3px variation.
const assets={background:'assets/ChatGPT 이미지 2026년 11월 13일 오전 02_49_09-1.png',board:'assets/석조 아치형 7×8 빛나는 격자 보드.png'};
const calibration={source:{width:1659,height:948},frame:{left:0,top:0,width:1659,height:948},columns:[283.5,443.5,600,754.5,909.5,1063,1215,1375.5],rows:[94,186.5,277,366,453,542,628,719.5,813]};
function layout(){const c=calibration,f=c.frame,x=c.columns,y=c.rows,tracks=a=>a.slice(1).map((v,i)=>(v-a[i])+'fr').join(' ');return {'--frame-ratio':f.width+'/'+f.height,'--frame-ratio-number':f.width/f.height,'--art-image-width':c.source.width/f.width*100+'%','--art-image-height':c.source.height/f.height*100+'%','--art-image-left':-f.left/f.width*100+'%','--art-image-top':-f.top/f.height*100+'%','--grid-left':(x[0]-f.left)/f.width*100+'%','--grid-top':(y[0]-f.top)/f.height*100+'%','--grid-width':(x.at(-1)-x[0])/f.width*100+'%','--grid-height':(y.at(-1)-y[0])/f.height*100+'%','--grid-columns':tracks(x),'--grid-rows':tracks(y)};}
function mount(doc){const art=doc.querySelector('.battle-art'),back=doc.querySelector('.battle-backdrop'),board=doc.querySelector('.battle-board-artwork');if(!art||!back||!board)return;for(const [key,value]of Object.entries(layout()))art.style.setProperty(key,value);back.src=assets.background;board.src=assets.board;}
const api={assets,calibration,layout,mount};if(typeof module!=='undefined'&&module.exports)module.exports=api;else{root.AutoBattleArt=api;mount(document);}
})(typeof globalThis!=='undefined'?globalThis:this);
