# V10 — correção de PDF em branco

Problema corrigido:
- o renderizador anterior criava um elemento 100000px fora da tela;
- além disso, muitas questões eram convertidas em um único canvas muito alto, o que pode ultrapassar limites do navegador e resultar em PDF branco.

Nova geração:
- renderiza capa, questões e gabarito em blocos;
- cada questão vira um canvas independente;
- blocos grandes são divididos entre páginas;
- funciona com quantidade grande de questões sem depender de um canvas gigante;
- continua respeitando filtros, gabarito, explicações, case studies e formatos ricos.
