import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile,writeFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
function build(environment){const result=spawnSync(process.execPath,['scripts/prepare-deploy.mjs'],{cwd:root,env:{...process.env,VERCEL_ENV:environment},encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout);}
test('preview build alone enables demo bootstrap/mobile harness; production files stay canonical and stale preview outputs clear',async()=>{
 const web=path.join(root,'web-build'),dist=path.join(root,'dist');build('preview');
 const previewConfig=await readFile(path.join(web,'config.js'),'utf8'),previewIndex=await readFile(path.join(web,'index.html'),'utf8'),mobile=await readFile(path.join(web,'mobile-check.html'),'utf8');
 assert.match(previewConfig,/previewWorkflow:true/);assert.doesNotMatch(previewConfig,/supabase\.co|sb_publishable/);assert.match(previewIndex,/preview-bootstrap\.js/);assert.doesNotMatch(previewIndex,/src="app\.js/);assert.match(mobile,/width:390px;height:844px/);assert.match(mobile,/<iframe[^>]+src="index\.html"/);
 await writeFile(path.join(web,'stale-preview-output.txt'),'should be removed');build('production');
 for(const file of ['config.js','index.html','app.js'])assert.deepEqual(await readFile(path.join(web,file)),await readFile(path.join(dist,file)),`${file} must be copied unchanged for production`);
 await assert.rejects(access(path.join(web,'mobile-check.html')));await assert.rejects(access(path.join(web,'stale-preview-output.txt')));
});
