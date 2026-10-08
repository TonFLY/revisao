const names={1:'Comunidade SQL Server Expert',2:'Administração de SQL Server',3:'Infraestrutura no Azure',4:'Bancos de dados no Azure',5:'Linguagem SQL e prática',6:'Query Tuning',7:'Integration Services · SSIS',8:'Preparação DP-300',9:'Lives bônus 2024'};
let state={},files=[],mode='library',track=0;const $=s=>document.querySelector(s);const esc=s=>String(s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));function save(){CourseSync.persist()}function entry(id){return state[id]||(state[id]={})}
const videos=[];
