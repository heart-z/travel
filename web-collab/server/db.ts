import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
export function openDb(filename:string){
 if(filename!==':memory:')mkdirSync(dirname(filename),{recursive:true});
 const db=new DatabaseSync(filename);db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS trips(id TEXT PRIMARY KEY,title TEXT NOT NULL,start_date TEXT NOT NULL,end_date TEXT NOT NULL,time_zone TEXT NOT NULL,archived INTEGER NOT NULL DEFAULT 0,version INTEGER NOT NULL DEFAULT 1,seq INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS memberships(trip_id TEXT NOT NULL REFERENCES trips(id),user_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL CHECK(role IN ('owner','editor','viewer')),PRIMARY KEY(trip_id,user_id));
 CREATE TABLE IF NOT EXISTS invites(hash TEXT PRIMARY KEY,id TEXT NOT NULL UNIQUE,trip_id TEXT NOT NULL REFERENCES trips(id),role TEXT NOT NULL,expires INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0,revoked INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS entities(id TEXT PRIMARY KEY,trip_id TEXT NOT NULL REFERENCES trips(id),kind TEXT NOT NULL,data TEXT NOT NULL,version INTEGER NOT NULL,updated_at TEXT NOT NULL,updated_by TEXT NOT NULL REFERENCES users(id));
 CREATE INDEX IF NOT EXISTS entities_trip ON entities(trip_id);
 CREATE TABLE IF NOT EXISTS day_plans(trip_id TEXT NOT NULL REFERENCES trips(id),date TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,item_ids TEXT NOT NULL DEFAULT '[]',PRIMARY KEY(trip_id,date));
 CREATE TABLE IF NOT EXISTS mutation_receipts(user_id TEXT NOT NULL,trip_id TEXT NOT NULL,mutation_id TEXT NOT NULL,digest TEXT NOT NULL,PRIMARY KEY(user_id,trip_id,mutation_id));
 CREATE TABLE IF NOT EXISTS trip_events(trip_id TEXT NOT NULL REFERENCES trips(id),seq INTEGER NOT NULL,kind TEXT NOT NULL,ids TEXT NOT NULL,PRIMARY KEY(trip_id,seq));
 CREATE TABLE IF NOT EXISTS legacy_payloads(trip_id TEXT PRIMARY KEY REFERENCES trips(id),payload TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS imports(user_id TEXT NOT NULL,fingerprint TEXT NOT NULL,trip_id TEXT NOT NULL,PRIMARY KEY(user_id,fingerprint));`);
 return {exec:(sql:string)=>db.exec(sql),run:(sql:string,...args:SQLInputValue[])=>db.prepare(sql).run(...args),get:(sql:string,...args:SQLInputValue[])=>db.prepare(sql).get(...args) as any,all:(sql:string,...args:SQLInputValue[])=>db.prepare(sql).all(...args) as any[],transaction<T>(fn:()=>T):T{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e}},close:()=>db.close()};
}
export type AppDb=ReturnType<typeof openDb>;

