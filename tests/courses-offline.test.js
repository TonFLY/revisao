const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const catalog=require('../public/courses/catalog.json');
test('all offline paths are unique, relative and retain Drive IDs',()=>{
 const files=catalog.flatMap(m=>[...m.lessons,...m.materials,...m.references,...m.lessons.flatMap(l=>l.materials)]);
 assert.equal(files.length,727);assert.equal(new Set(files.map(x=>x.relativePath.normalize('NFC').toLowerCase())).size,727);
 for(const x of files){assert.ok(x.relativePath.endsWith(x.title));assert.ok(!x.relativePath.startsWith('/')&&!x.relativePath.split('/').includes('..'));assert.ok(x.url.includes(x.id))}
});
test('service worker bypasses API, Drive, POST and video range requests',()=>{
 const handlers={};let intercepted=0;const self={location:{origin:'https://example.test'},addEventListener:(name,fn)=>handlers[name]=fn};
 vm.runInNewContext(fs.readFileSync('public/courses-offline-sw.js','utf8'),{self,URL});
 for(const [url,method,range]of [['/api/courses?uid=test','GET',false],['https://drive.google.com/file/d/example/preview','GET',false],['/courses.html','POST',false],['/courses.html','GET',true],['/index.html','GET',false]]){
 handlers.fetch({request:{url:new URL(url,self.location.origin).href,method,headers:{has:()=>range}},respondWith:()=>intercepted++});
 }
 assert.equal(intercepted,0);
});
