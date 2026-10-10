import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { tasks, publicTask, suiteVersion } from './catalog.mjs';
export const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
export const suiteHash=hash(tasks);
// A timeout/clean context improves repeatability; node:vm is NOT a security sandbox.
// Only trusted controls or explicitly reviewed candidate code may reach this function.
export function grade(task,source){
  const results=task.cases.map((c,index)=>{
    try{
      const script=`${source.replace(/^export\s+(?=(?:async\s+)?function|const|let|var)/gm,'')}\nconst input=JSON.parse(${JSON.stringify(JSON.stringify(c.input))});const before=JSON.stringify(input);const output=solve(input);JSON.stringify({output,unchanged:JSON.stringify(input)===before});`;
      const result=JSON.parse(vm.runInNewContext(script,Object.create(null),{timeout:300,contextCodeGeneration:{strings:false,wasm:false}}));
      assert.deepEqual(result.output,c.expected);assert.equal(result.unchanged,true);
      return {index,passed:true};
    }catch{return {index,passed:false};}
  });
  return {taskId:task.id,suiteVersion,suiteHash,sourceHash:hash(source),passed:results.every(x=>x.passed),checksPassed:results.filter(x=>x.passed).length,checksTotal:results.length,results};
}
export function validateSuite(){
  assert.equal(new Set(tasks.map(x=>x.id)).size,tasks.length);
  const families=new Map();
  for(const task of tasks){
    if(families.has(task.family))assert.equal(families.get(task.family),task.split,'Related tasks crossed split');
    families.set(task.family,task.split);
    assert.ok(task.cases.length>=3);
    assert.equal(grade(task,task.reference).passed,true,`Invalid control or ambiguous expected output: ${task.id}`);
    for(const mutant of ['export function solve(){return null;}',`export function solve(){return ${JSON.stringify(task.cases[0].expected)};}`])assert.equal(grade(task,mutant).passed,false,`Weak controls: ${task.id}`);
    const visible=publicTask(task);assert.equal('reference' in visible,false);assert.equal('cases' in visible,false);
  }
  return {suiteVersion,suiteHash,tasks:tasks.length,families:families.size,checks:tasks.reduce((n,t)=>n+t.cases.length,0),controlsPassed:tasks.length,brokenControlsRejected:tasks.length*2,splits:Object.fromEntries(['development','selection','heldout'].map(s=>[s,tasks.filter(t=>t.split===s).length]))};
}
if(process.argv.includes('--validate'))console.log(JSON.stringify(validateSuite(),null,2));
