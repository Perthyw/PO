import {randomBytes,createCipheriv,createDecipheriv,createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
const [input,encrypted,recovery]=process.argv.slice(2);
if(!input||!encrypted||!recovery||new Set([input,encrypted,recovery].map(p=>resolve(p))).size!==3)throw new Error('Use distinct resolved input, encrypted backup and recovery-key file paths');
const plaintext=await readFile(input),key=randomBytes(32),iv=randomBytes(12);
const cipher=createCipheriv('aes-256-gcm',key,iv);
const ciphertext=Buffer.concat([cipher.update(plaintext),cipher.final()]),tag=cipher.getAuthTag();
const payload={format:'PO-auth-backup-v1',algorithm:'AES-256-GCM',iv:iv.toString('base64'),tag:tag.toString('base64'),ciphertext:ciphertext.toString('base64'),plaintext_sha256:createHash('sha256').update(plaintext).digest('hex')};
await writeFile(encrypted,JSON.stringify(payload),{mode:0o600,flag:'wx'});
await writeFile(recovery,JSON.stringify({format:'PO-auth-recovery-key-v1',algorithm:'AES-256-GCM',key_base64:key.toString('base64'),encrypted_file:encrypted.split('/').at(-1)}),{mode:0o600,flag:'wx'});
const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAuthTag(tag);
assert.deepEqual(Buffer.concat([decipher.update(ciphertext),decipher.final()]),plaintext);
// A recovery key is deliberately never printed or included in an archive with its ciphertext.
console.log(JSON.stringify({algorithm:'AES-256-GCM',roundtrip_verified:true,encrypted_sha256:createHash('sha256').update(await readFile(encrypted)).digest('hex'),bytes:plaintext.length}));
