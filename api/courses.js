const crypto = require('crypto');
const {sql,config} = require('../lib/db');
const catalog = require('../public/courses/catalog.json');
const modules = new Set(catalog.map(m=>m.id));
const lessons = new Set(catalog.flatMap(m=>m.lessons.map(l=>l.id)));
let poolPromise;
async function pool(){
  if(!poolPromise) {
    const p=new sql.ConnectionPool({...config,connectionTimeout:8000,requestTimeout:8000,pool:{max:2,min:0,idleTimeoutMillis:10000}});
    p.on('error',()=>{poolPromise=null;});
    poolPromise=p.connect().catch(e=>{poolPromise=null;throw e;});
  }
  return poolPromise;
}
function identity(req) {
  const h=req.headers.authorization||'';
  if(!/^Bearer [a-f0-9]{64}$/.test(h))return null;
  return 'course_'+crypto.createHash('sha256').update(h.slice(7)).digest('hex');
}
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('Vary','Authorization');
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Método não permitido.'});}
  const uid=identity(req);
  if(!uid)return res.status(401).json({error:'Abra a aba Cursos a partir do seu perfil.'});
  try{
    if(req.method==='GET'){
      const p=await pool();
      const r=await p.request().input('uid',sql.NVarChar(100),uid).query(`
        SELECT lesson_id AS id,completed,favorite,notes FROM courses.LessonProgress WHERE user_id=@uid;
        SELECT module_id AS id,completed,favorite,notes FROM courses.ModuleProgress WHERE user_id=@uid;
      `);
      return res.status(200).json({items:r.recordsets.flat()});
    }
    const b=req.body;
    if(!b||!Array.isArray(b.items)||!b.items.length||b.items.length>25)return res.status(400).json({error:'Envie de 1 a 25 registros.'});
    const seen=new Set();
    for(const x of b.items){
      if(!x||typeof x.id!=='string'||(!modules.has(x.id)&&!lessons.has(x.id))||seen.has(x.id)||typeof x.done!=='boolean'||typeof x.fav!=='boolean'||typeof x.notes!=='string'||x.notes.length>4000)
        return res.status(400).json({error:'Progresso inválido; notas limitadas a 4000 caracteres.'});
      seen.add(x.id);
    }
    // Fixed table/column names; IDs and all user data are SQL parameters.
    const p=await pool();
    const tx=new sql.Transaction(p);
    await tx.begin();
    try{
      for(const x of b.items){
        const lesson=lessons.has(x.id),table=lesson?'LessonProgress':'ModuleProgress',column=lesson?'lesson_id':'module_id';
        await new sql.Request(tx).input('uid',sql.NVarChar(100),uid).input('id',sql.VarChar(100),x.id)
          .input('done',sql.Bit,x.done).input('fav',sql.Bit,x.fav).input('notes',sql.NVarChar(4000),x.notes).query(`
          UPDATE courses.${table} WITH(UPDLOCK,SERIALIZABLE) SET completed=@done,favorite=@fav,notes=@notes,updated_at=SYSUTCDATETIME()
          ${lesson?',completed_at=CASE WHEN @done=1 THEN COALESCE(completed_at,SYSUTCDATETIME()) ELSE NULL END':''}
          WHERE user_id=@uid AND ${column}=@id;
          IF @@ROWCOUNT=0 INSERT courses.${table}(user_id,${column},completed,favorite,notes${lesson?',completed_at':''})
          VALUES(@uid,@id,@done,@fav,@notes${lesson?',CASE WHEN @done=1 THEN SYSUTCDATETIME() ELSE NULL END':''});
          `);
      }
      await tx.commit();
    }catch(e){await tx.rollback().catch(()=>{});throw e;}
    return res.status(200).json({saved:b.items.length});
  }catch(e){
    console.error('[courses]',e.code||e.name);
    return res.status(503).json({error:'Não foi possível sincronizar. Verifique a conexão com o banco e execute sql/004_cursos_sql.sql.'});
  }
};
module.exports.identity=identity;
