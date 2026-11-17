const fs=require('node:fs');const path=require('node:path');
const out=path.resolve('../../outputs');
const portraits={};
for(const folder of ['portraits-v4','faces-v5']){portraits[folder]={};for(const file of fs.readdirSync('dist/'+folder))portraits[folder][file.replace('.webp','')]='data:image/webp;base64,'+fs.readFileSync('dist/'+folder+'/'+file).toString('base64');}
const css=fs.readFileSync('dist/style.css','utf8')+'\n'+fs.readFileSync('dist/cards.css','utf8');
const script='const EMBEDDED_PORTRAITS='+JSON.stringify(portraits)+';\n'+fs.readFileSync('dist/game.js','utf8').replace('src="${folder}/${t.id}.webp"','src="${EMBEDDED_PORTRAITS[folder][t.id]}"');
const html=fs.readFileSync('dist/index.html','utf8').replace('<link rel="stylesheet" href="style.css"><link rel="stylesheet" href="cards.css">',`<style>${css}</style>`).replace('<script src="game.js"></script>',`<script>${script}</script>`);
fs.writeFileSync(path.join(out,'starlight-expedition.html'),html);
fs.copyFileSync(path.join(out,'starlight-character-lineup-v4-preview.png'),path.join(out,'starlight-card-portraits.png'));
