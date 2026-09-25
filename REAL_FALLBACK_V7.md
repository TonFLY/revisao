# Simulado REAL — fallback para questões existentes

Nova regra:

1. Prioriza questões `origin = "real"` (JSON V2), respeitando o blueprint quando houver.
2. Se não houver questões REAL suficientes para completar o simulado, usa questões existentes `origin <> "real"`.
3. Questões cujo tópico começa com `Decoreba` NÃO entram no Simulado REAL.
4. Questões antigas continuam funcionando como `single_choice`.
5. Questões inéditas são priorizadas; depois entram as menos recentemente respondidas.
6. Não altera o número de Serverless Functions.

Exemplo:
- Simulado solicitado: 50
- V2/REAL disponíveis: 32
- Resultado: 32 REAL + 18 existentes
