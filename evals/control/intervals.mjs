// Evaluator control only. Never include this file in a candidate's task workspace.
export function mergeIntervals(intervals) {
  const sorted=intervals.map(pair=>[...pair]).sort((a,b)=>a[0]-b[0]);
  const result=[];
  for(const range of sorted) {
    const last=result.at(-1);
    if(last && range[0]<last[1]) last[1]=Math.max(last[1],range[1]);
    else result.push(range);
  }
  return result;
}
