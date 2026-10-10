import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export async function grade(modulePath) {
  const { mergeIntervals } = await import(pathToFileURL(resolve(modulePath)).href);
  const cases = [
    ['empty', () => assert.deepEqual(mergeIntervals([]), [])],
    ['touching', () => assert.deepEqual(mergeIntervals([[1,2],[2,3]]), [[1,2],[2,3]])],
    ['transitive', () => assert.deepEqual(mergeIntervals([[8,11],[1,4],[3,9]]), [[1,11]])],
    ['nested', () => assert.deepEqual(mergeIntervals([[1,10],[3,4],[2,7]]), [[1,10]])],
    ['negative and fractional', () => assert.deepEqual(mergeIntervals([[-1,0.5],[-4,-2],[-2,-1]]), [[-4,-2],[-2,-1],[-1,0.5]])],
    ['input unchanged', () => { const input=[[4,8],[1,5]], before=structuredClone(input); mergeIntervals(input); assert.deepEqual(input,before); }],
    ['output detached', () => { const input=[[1,3]], out=mergeIntervals(input); out[0][0]=0; assert.deepEqual(input,[[1,3]]); }],
  ];
  const results=cases.map(([name,check]) => { try { check(); return { name, passed:true }; } catch { return { name, passed:false }; } });
  return { fixture:'merge-intervals-v1', graderVersion:1, sourceSha256:createHash('sha256').update(await readFile(modulePath)).digest('hex'), passed:results.filter(r=>r.passed).length, total:results.length, results };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2]) throw new Error('Usage: node evals/grade.mjs <candidate intervals.mjs>');
  const report=await grade(process.argv[2]); console.log(JSON.stringify(report,null,2));
  process.exitCode=report.passed===report.total?0:1;
}
