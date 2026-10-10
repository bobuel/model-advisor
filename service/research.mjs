import {createHash} from 'node:crypto';
import {z} from 'zod';

export const researchHash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const text=z.string().min(1).max(600),id=z.string().regex(/^[a-z0-9.-]+$/).max(100);
export const findingSchema=z.object({
  id,kind:z.enum(['provider-guidance','research-synthesis']),topic:z.enum(['model-fit','effort','pricing','speed']),
  statement:text,models:z.array(id).min(1).max(30),
  citations:z.array(z.object({sourceId:id,section:text}).strict()).min(1).max(5),
  limitations:z.array(text).min(1).max(5)
}).strict();
export const draftSchema=z.object({
  schemaVersion:z.literal(1),asOf:z.string().datetime(),expiresAt:z.string().datetime(),
  sources:z.array(z.object({id,url:z.string().url().startsWith('https://'),observedAt:z.string().datetime(),contentHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict()).min(1).max(8),
  findings:z.array(findingSchema).min(1).max(12),gaps:z.array(text).max(12)
}).strict();
export function validateResearch(draft,{now=Date.now(),ledger,allowStale=false}={}){
  const d=draftSchema.parse(draft),start=Date.parse(d.asOf),end=Date.parse(d.expiresAt);
  if(start>now+60000||(!allowStale&&end<=now)||end<=start||end-start>7*86400000)throw Error('Research dates are stale or invalid');
  if(new Set(d.sources.map(s=>s.id)).size!==d.sources.length||new Set(d.findings.map(f=>f.id)).size!==d.findings.length)throw Error('Duplicate research identifiers');
  for(const s of d.sources){
    const observed=Date.parse(s.observedAt);
    if(observed>start+60000||start-observed>7*86400000)throw Error('Research source date is invalid');
    if(ledger&&!ledger.some(x=>x.id===s.id&&x.url===s.url&&x.contentHash===s.contentHash&&x.observedAt===s.observedAt))throw Error('Research source was not fetched');
  }
  for(const f of d.findings)if(f.citations.some(c=>!d.sources.some(s=>s.id===c.sourceId)))throw Error('Research citation is unknown');
  return d;
}
export function validatePublishedResearch(report,options={}){
  if(!report)throw Error('Published research is required');
  const {review,...draft}=report,d=validateResearch(draft,options);
  if(review?.status!=='reviewed'||!review.reviewer||review.draftHash!==researchHash(draft)||!Number.isFinite(Date.parse(review.reviewedAt))||Date.parse(review.reviewedAt)<Date.parse(d.asOf)||Date.parse(review.reviewedAt)>(options.now??Date.now())+60000)throw Error('Research needs a separate review of this exact draft');
  return d;
}
