const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const available = () => ['medium','bold'].every(w => ['woff2','woff'].some(ext => {try {const b=fs.readFileSync(path.join(root,'src','fonts',`title-${w}.${ext}`));return b.length>100 && b.subarray(0,4).toString() === (ext==='woff2'?'wOF2':'wOFF');}catch{return false;}}));
if (!available()) {
  console.log('KAKA: preparing official local fonts...');
  const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(root,'setup-fonts.ps1')],{cwd:root,stdio:'inherit',timeout:120000});
  if (r.error || r.status!==0 || !available()) {
    console.error('Font preparation failed. '+(process.argv.includes('--required')?'Build stopped.':'Starting with fallback font; next launch will retry.'));
    if(process.argv.includes('--required')) process.exitCode=1;
  }
}
