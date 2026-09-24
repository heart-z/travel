import {it,expect} from 'vitest';
import {openDb} from '../server/db.ts';
it('rolls back transactions and persists successful writes',()=>{const db=openDb(':memory:');expect(()=>db.transaction(()=>{db.run('INSERT INTO users(id,username,password_hash) VALUES(?,?,?)','a','alice','test');throw Error('abort')})).toThrow('abort');expect(db.get('SELECT count(*) AS n FROM users')).toMatchObject({n:0});db.close()});
