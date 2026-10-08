const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const catalog=require('../public/courses/catalog.json');
function setup(){
 const queries=[],inputs=[],m={exports:{}};
 class Request {input(name,type,value){inputs.push({name,value});return this}async query(q){queries.push(q);return {recordsets:[[],[]]}}}
 class Pool {on(){}async connect(){return this}request(){return new Request()}}
 class Transaction {async begin(){}async commit(){}async rollback(){}}
 const sql={ConnectionPool:Pool,Request,Transaction,NVarChar:n=>n,VarChar:n=>n,Bit:1};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../api/courses.js'),'utf8'),{module:m,require:n=>n==='crypto'?crypto:n.includes('catalog')?catalog:{sql,config:{}},console});
 return {handler:m.exports,queries,inputs};
}
function response(){return {code:0,body:null,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(b){this.body=b;return this}}}
const headers=t=>({authorization:'Bearer '+t.repeat(64)});
test('progress requires a bearer credential',async()=>{const s=setup(),r=response();await s.handler({method:'GET',headers:{},query:{uid:'other'}},r);assert.equal(r.code,401);assert.equal(s.queries.length,0)});
test('identity derives from credential, never supplied uid',async()=>{const s=setup();for(const t of ['a','b'])await s.handler({method:'GET',headers:headers(t),query:{uid:'same'}},response());const u=s.inputs.filter(x=>x.name==='uid').map(x=>x.value);assert.notEqual(u[0],u[1]);assert(u.every(x=>x.length<100));assert(s.queries.every(q=>q.includes('WHERE user_id=@uid')))});
test('rejects unknown files and oversize notes before database access',async()=>{for(const item of [{id:'bad',done:false,fav:false,notes:''},{id:catalog[0].lessons[0].id,done:false,fav:false,notes:'x'.repeat(4001)}]){const s=setup(),r=response();await s.handler({method:'POST',headers:headers('a'),body:{items:[item]}},r);assert.equal(r.code,400);assert.equal(s.queries.length,0)}});
test('writes use fixed table and SQL parameters scoped to identity',async()=>{const s=setup(),r=response();const item={id:catalog[0].lessons[0].id,done:true,fav:false,notes:"quote' and text"};await s.handler({method:'POST',headers:headers('a'),body:{items:[item]}},r);assert.equal(r.code,200);assert(s.queries[0].includes('WHERE user_id=@uid AND lesson_id=@id'));assert(!s.queries[0].includes(item.notes));assert(s.inputs.some(x=>x.name==='notes'&&x.value===item.notes))});
test('catalog has stable unique IDs and matching lesson materials',()=>{const ids=new Set();let lessons=0,materials=0;for(const m of catalog){assert(!ids.has(m.id));ids.add(m.id);for(const l of m.lessons){assert(!ids.has(l.id));ids.add(l.id);lessons++;for(const x of l.materials){assert(!ids.has(x.id));ids.add(x.id);materials++}}for(const x of m.materials){assert(!ids.has(x.id));ids.add(x.id);materials++}}assert.equal(catalog.length,43);assert.equal(lessons,345);assert.equal(materials,347)});
