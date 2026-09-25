# Certification Review — Treino Interativo v3

Este overlay altera apenas `public/index.html`.

## O que muda
- Aba **Estudar** carrega `origin=legacy` + `origin=real`.
- Treino suporta `single_choice`, `multi_select`, `yes_no_matrix`, `hotspot_dropdown`, `build_list`, `drag_drop` e `image_hotspot`.
- `case_id` + `case_data` aparecem também no treino.
- Correção continua sendo feita pelo `/api/attempts`; o histórico e anti-memorização continuam funcionando.
- Importação mostra a distribuição por formato.
- Exportação passa a usar JSON `version: 2.0`.
- Tutorial foi refeito para gerar bancos em todos os formatos.
- Aba Decoreba continua deliberadamente apenas `single_choice`.

## Instalação
Substitua somente `public/index.html`, faça commit/push e aguarde a Vercel.
Nenhum SQL adicional e nenhuma Serverless Function nova.
