import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
const files=execFileSync('git',['ls-files'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
if(!files.length)throw Error('Stage the intended public files before checking');
const forbidden=files.filter(f=>/(^|\/)\.env($|\.)|\.local\.json$|^evals\/runs\/|\.sqlite|deployment-map-preview|(^|\/)node_modules\//.test(f));
if(forbidden.length)throw Error(`Private runtime files staged: ${forbidden.join(', ')}`);
for(const file of files){
  const content=await readFile(file,'utf8');
  if(/(?:sk-proj-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----)/.test(content))throw Error(`Possible credential in ${file}`);
}
console.log(JSON.stringify({publicFiles:files.length,credentialPatternCheck:'passed',limitation:'Pattern checks supplement an explicit file allowlist and review; they are not a complete secret detector.'}));
