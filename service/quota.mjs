import {DatabaseSync} from 'node:sqlite';
export class Quota {
  constructor(path,{dailyLimit=0,now=()=>Date.now()}={}){
    if(!Number.isInteger(dailyLimit)||dailyLimit<0||dailyLimit>10000)throw Error('Invalid daily decision cap');
    if(dailyLimit>0&&!path)throw Error('A persistent quota database is required before enabling provider calls');
    this.limit=dailyLimit;this.now=now;this.db=new DatabaseSync(path??':memory:');
    this.db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS quota(day TEXT PRIMARY KEY, attempts INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS state(key TEXT PRIMARY KEY,value INTEGER NOT NULL);');
  }
  reserve(){
    if(!this.limit)return {allowed:false,reason:'provider_disabled'};
    if((this.db.prepare("SELECT value FROM state WHERE key='cooldown'").get()?.value??0)>this.now())return {allowed:false,reason:'provider_cooldown'};
    const day=new Date(this.now()).toISOString().slice(0,10);
    const r=this.db.prepare('INSERT INTO quota(day,attempts) SELECT ?,1 WHERE ?>0 ON CONFLICT(day) DO UPDATE SET attempts=attempts+1 WHERE attempts<? RETURNING attempts').get(day,this.limit,this.limit);
    return r?{allowed:true,attempt:r.attempts}:{allowed:false,reason:'daily_limit_reached'};
  }
  cooldown(ms=60000){this.db.prepare("INSERT INTO state(key,value) VALUES ('cooldown',?) ON CONFLICT(key) DO UPDATE SET value=max(value,excluded.value)").run(this.now()+ms);}
  count(){return this.db.prepare('SELECT attempts FROM quota WHERE day=?').get(new Date(this.now()).toISOString().slice(0,10))?.attempts??0;}
  close(){this.db.close();}
}
