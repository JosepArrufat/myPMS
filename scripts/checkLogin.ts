import 'dotenv/config';
import { findUserByEmail } from '../src/db/queries/identity/users.js';
import { checkPasswordHash } from '../src/auth.js';

async function run(){
  const [user] = await findUserByEmail('admin@hotel.com');
  console.log('user found?', !!user);
  if(user){
    console.log('user.id', user.id, 'passwordHash length', (user.passwordHash||'').slice(0,10));
    const ok = await checkPasswordHash('admin123', user.passwordHash);
    console.log('password matches?', ok);
  }
}

run().catch((e)=>{console.error('error', e); process.exit(1)}).then(()=>process.exit(0));
