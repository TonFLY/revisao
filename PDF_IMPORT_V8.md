# Importar PDF - V8

Nova aba **Importar PDF** no Certification Review.

## Opcoes
- quantidade maxima de questoes;
- filtro por assunto/palavras-chave (qualquer termo ou todos);
- pagina inicial/final;
- somente com gabarito, somente sem gabarito ou ambos;
- trazer/remover gabarito detectado;
- trazer/remover explicacao detectada;
- remover duplicadas ja existentes;
- selecao em ordem do PDF ou aleatoria;
- dificuldade e topico salvos;
- preview antes da importacao;
- exportacao em JSON V2;
- importacao direta no banco.

## Regras
- PDF processado no navegador.
- Parser reconhece questoes textuais com alternativas e Answer/Resposta/Gabarito.
- Single choice e multi-select sao preservados quando detectaveis.
- HOTSPOT, DRAG DROP e SIMULATION nao sao inventados a partir de texto parcial; sao ignorados por padrao.
- Questoes sem gabarito podem ser armazenadas, mas ficam fora de Estudar e Simulado REAL ate receberem resposta.
- Nao adiciona nenhuma Serverless Function.

## Dependencia de navegador
A pagina carrega PDF.js 3.11.174 pelo CDN cdnjs.
