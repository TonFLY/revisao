const {sql,openPool,cleanUid,cleanExam}=require('../lib/db');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 const uid=cleanUid(req.query.uid),exam=cleanExam(req.query.exam);
 let pool;
 try{
  pool=await openPool();
  const base=()=>pool.request().input('uid',sql.NVarChar(100),uid).input('exam',sql.NVarChar(40),exam);
  if(req.method==='GET'){
   const r=await base().query(`SELECT c.id,c.front,c.back,c.topic,c.source_question_id,p.due_at,p.interval_days,p.repetitions,p.last_grade FROM dbo.dp300_flashcards c LEFT JOIN dbo.dp300_flashcard_progress p ON p.card_id=c.id AND p.user_id=c.user_id AND p.exam=c.exam WHERE c.user_id=@uid AND c.exam=@exam ORDER BY c.id DESC`);
   return res.status(200).json(r.recordset);
  }
  if(req.method!=='POST')return res.status(405).json({error:'Método não permitido'});
  const b=req.body||{},action=b.action||'create';
  if(action==='create'||action==='import'){
   const cards=action==='import'?b.cards:[b];
   if(!Array.isArray(cards)||cards.length<1||cards.length>300)return res.status(400).json({error:'Envie de 1 a 300 cartões por lote'});
   let count=0;
   for(const c of cards){
    const front=String(c.front||'').trim(),back=String(c.back||'').trim();
    if(!front||!back||front.length>10000||back.length>20000)continue;
    await base().input('front',sql.NVarChar(sql.MAX),front).input('back',sql.NVarChar(sql.MAX),back).input('topic',sql.NVarChar(200),String(c.topic||'Geral').slice(0,200)).query('INSERT INTO dbo.dp300_flashcards(user_id,exam,front,back,topic) VALUES(@uid,@exam,@front,@back,@topic)');
    count++;
   }
   return res.status(200).json({imported:count});
  }
  if(action==='generate'){
   const r=await base().query(`INSERT INTO dbo.dp300_flashcards(user_id,exam,front,back,topic,source_question_id)
    SELECT q.user_id,q.exam,q.question,COALESCE(NULLIF(q.memory_rule,N''),NULLIF(q.why_correct,N''),NULLIF(q.explanation,N''),N'Resp.: '+ISNULL(q.correct,N'?')),q.topic,q.id
    FROM dbo.dp300_questions q WHERE q.user_id=@uid AND q.exam=@exam AND q.question_type=N'single_choice'
    AND NOT EXISTS(SELECT 1 FROM dbo.dp300_flashcards c WHERE c.user_id=q.user_id AND c.exam=q.exam AND c.source_question_id=q.id);
    SELECT @@ROWCOUNT AS created`);
   return res.json(r.recordset[0]);
  }
  if(action==='grade'){
   const id=Number(b.id),grade=Number(b.grade);
   if(!Number.isSafeInteger(id)||id<1||![0,1,2].includes(grade))return res.status(400).json({error:'Avaliação inválida'});
   const check=await base().input('id',sql.Int,id).query('SELECT id FROM dbo.dp300_flashcards WHERE id=@id AND user_id=@uid AND exam=@exam');
   if(!check.recordset.length)return res.status(404).json({error:'Cartão não encontrado'});
   const prior=await base().input('id',sql.Int,id).query('SELECT interval_days,ease,repetitions FROM dbo.dp300_flashcard_progress WHERE user_id=@uid AND exam=@exam AND card_id=@id');
   const p=prior.recordset[0]||{interval_days:0,ease:2.5,repetitions:0};
   const reps=grade===0?0:Number(p.repetitions)+1;
   const ease=Math.max(1.3,Number(p.ease)+(grade===2?0.1:grade===1?-0.15:-0.2));
   const days=grade===0?0:grade===1?1:reps===1?1:reps===2?3:Math.max(4,Math.round(Number(p.interval_days)*ease));
   const due=new Date(Date.now()+(grade===0?10/1440:days)*86400000);
   await base().input('id',sql.Int,id).input('days',sql.Int,days).input('ease',sql.Float,ease).input('reps',sql.Int,reps).input('due',sql.DateTime2,due).input('grade',sql.NVarChar(12),['errei','dificil','acertei'][grade]).query(`UPDATE dbo.dp300_flashcard_progress SET interval_days=@days,ease=@ease,repetitions=@reps,due_at=@due,last_grade=@grade,updated_at=SYSUTCDATETIME() WHERE user_id=@uid AND exam=@exam AND card_id=@id;
    IF @@ROWCOUNT=0 INSERT INTO dbo.dp300_flashcard_progress(user_id,exam,card_id,interval_days,ease,repetitions,due_at,last_grade) VALUES(@uid,@exam,@id,@days,@ease,@reps,@due,@grade)`);
   return res.json({ok:true,due_at:due.toISOString()});
  }
  if(action==='delete'){
   const id=Number(b.id);
   if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'ID inválido'});
   await base().input('id',sql.Int,id).query('DELETE FROM dbo.dp300_flashcards WHERE id=@id AND user_id=@uid AND exam=@exam');
   return res.json({ok:true});
  }
  return res.status(400).json({error:'Ação inválida'});
 }catch(e){
  const code=String(e?.code||e?.originalError?.info?.number||'UNKNOWN');
  const msg=String(e?.message||'');
  console.error('[flashcards]',{code,message:msg,operation:req.method});
  let error='Não foi possível acessar os flashcards. Consulte os logs da Vercel.';
  let hint='Verifique os logs da função /api/flashcards.';
  if(/Invalid object name|208/.test(msg+' '+code)){error='Tabela de flashcards não encontrada no banco conectado à Vercel.';hint='Confirme DB_NAME e execute a migração nesse banco.'}
  else if(/Invalid column name|207/.test(msg+' '+code)){error='Estrutura da tabela de flashcards incompatível com a API.';hint='Confira as colunas das tabelas de flashcards.'}
  else if(/permission|denied|229/.test(msg+' '+code)){error='Usuário do SQL Server sem permissão para acessar os flashcards.';hint='Verifique SELECT, INSERT, UPDATE e DELETE nas tabelas.'}
  else if(/login failed|ELOGIN|18456/.test(msg+' '+code)){error='Falha de autenticação no SQL Server.';hint='Confira as credenciais DB_* na Vercel.'}
  else if(/ETIMEOUT|ESOCKET|ECONN|timeout|network/i.test(msg+' '+code)){error='Falha de conexão ou tempo esgotado ao consultar o SQL Server.';hint='Confira rede, firewall e disponibilidade do servidor.'}
  return res.status(500).json({error,code:code.replace(/[^A-Z0-9_-]/gi,'').slice(0,30),hint});
 }
 finally{if(pool)await pool.close().catch(()=>{})}
};
