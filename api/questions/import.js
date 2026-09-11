const sql=require('mssql');
const config={server:process.env.DB_HOST,port:parseInt(process.env.DB_PORT||'1433'),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,connectionTimeout:8000,requestTimeout:30000,options:{encrypt:false,trustServerCertificate:true,enableArithAbort:true}};
function normalizeExam(value){const v=String(value||'').trim().toUpperCase();return /^DP-\d{3}$/.test(v)?v:null;}
module.exports=async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(200).end(); if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const uid=(req.query.uid||'default').trim().toLowerCase().slice(0,50); const exam=normalizeExam(req.query.exam||'DP-300');
  if(!exam)return res.status(400).json({error:'Exame inválido. Use DP-XXX.'});
  const body=req.body||{}; const questions=Array.isArray(body)?body:(Array.isArray(body.questions)?body.questions:[]);
  if(!questions.length)return res.status(400).json({error:'Nenhuma questão encontrada.'});
  let pool;
  try{pool=await sql.connect(config); const result=await pool.request().input('user_id',sql.NVarChar(50),uid).input('exam',sql.NVarChar(20),exam).input('json',sql.NVarChar(sql.MAX),JSON.stringify(questions)).execute('dbo.ImportDpQuestions');
    const info=result.recordset?.[0]||{}; return res.status(201).json({ok:true,inserted:info.inserted||0,received:questions.length,exam,user_id:uid});
  }catch(e){console.error('[questions/import] error:',e);return res.status(500).json({error:e.message});}
  finally{if(pool)await pool.close().catch(()=>{});}
};
