function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      service: "revisao-gemini-sync"
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const dados = JSON.parse(e.postData.contents);

    const doc = DocumentApp.getActiveDocument();
    const body = doc.getBody();

    body.clear();

    body.appendParagraph("DP-300 — Revisão");
    body.appendParagraph("");
    body.appendParagraph("Usuário: " + (dados.user_id || "wellington"));
    body.appendParagraph("Exame: " + (dados.exam || "DP-300"));

    body.appendParagraph("");
    body.appendParagraph("PROGRESSO ATUAL");
    body.appendParagraph("Total: " + (dados.total ?? 0));
    body.appendParagraph("Acertei: " + (dados.acertei ?? 0));
    body.appendParagraph("Errei: " + (dados.errei ?? 0));
    body.appendParagraph("Revisar: " + (dados.revisar ?? 0));
    body.appendParagraph("Pendente: " + (dados.pendente ?? 0));

    const hist = dados.historico || {};

    body.appendParagraph("");
    body.appendParagraph("DESEMPENHO HISTÓRICO REAL");
    body.appendParagraph("Tentativas: " + (hist.attempts ?? 0));
    body.appendParagraph("Questões distintas respondidas: " + (hist.distinct_questions ?? 0));
    body.appendParagraph("Acertos históricos: " + (hist.correct ?? 0));
    body.appendParagraph("Erros históricos: " + (hist.wrong ?? 0));
    body.appendParagraph("Precisão histórica: " + (hist.accuracy_pct ?? 0) + "%");

    const frio = dados.frio || {};

    body.appendParagraph("");
    body.appendParagraph("ACERTO FRIO — ANTI-MEMORIZAÇÃO");
    body.appendParagraph(
      "Considera a primeira tentativa da questão e novas tentativas feitas após pelo menos 24 horas."
    );
    body.appendParagraph("Tentativas frias: " + (frio.attempts ?? 0));
    body.appendParagraph("Acertos frios: " + (frio.correct ?? 0));
    body.appendParagraph("Erros frios: " + (frio.wrong ?? 0));
    body.appendParagraph("Precisão fria: " + (frio.accuracy_pct ?? 0) + "%");

    body.appendParagraph("");
    body.appendParagraph("DESEMPENHO POR TÓPICO");

    const topicos = dados.topicos || [];

    if (!topicos.length) {
      body.appendParagraph("Ainda não há tentativas suficientes.");
    } else {
      topicos.forEach(function(t) {
        body.appendParagraph(
          "- " + t.topic +
          " | " + t.accuracy_pct + "% histórico" +
          " | " + t.wrong + " erros" +
          " | " + t.attempts + " tentativas" +
          " | " + t.distinct_questions + " questões distintas"
        );
      });
    }

    body.appendParagraph("");
    body.appendParagraph("DESEMPENHO POR DOMÍNIO OFICIAL");

    const dominios = dados.desempenho_por_dominio || [];
    if (!dominios.length) {
      body.appendParagraph("Ainda não há histórico por domínio.");
    } else {
      dominios.forEach(function(d) {
        body.appendParagraph(
          "- " + d.domain_code +
          " | " + d.accuracy_pct + "%" +
          " | " + d.correct + " acertos" +
          " | " + d.wrong + " erros" +
          " | " + d.attempts + " tentativas"
        );
      });
    }

    const sim = dados.ultimo_simulado;
    body.appendParagraph("");
    body.appendParagraph("ÚLTIMO SIMULADO REAL");
    if (!sim) {
      body.appendParagraph("Nenhum simulado REAL finalizado ainda.");
    } else {
      body.appendParagraph("Questões: " + sim.question_count);
      body.appendParagraph("Tempo configurado: " + sim.duration_minutes + " min");
      body.appendParagraph("Pontos: " + sim.points_earned + "/" + sim.points_max);
      body.appendParagraph("Acerto bruto: " + sim.raw_score_pct + "%");
      body.appendParagraph("Observação: o percentual bruto não equivale à pontuação escalonada oficial da Microsoft.");
    }

    body.appendParagraph("");
    body.appendParagraph("QUESTÕES MAIS ERRADAS");

    const erradas = dados.questoes_mais_erradas || [];

    if (!erradas.length) {
      body.appendParagraph("Nenhuma questão com erro registrada.");
    } else {
      erradas.forEach(function(q) {
        body.appendParagraph(
          "- Questão " + q.question_id +
          " | " + q.topic +
          " | " + q.wrong + " erros" +
          " | " + q.correct + " acertos" +
          " | " + q.attempts + " tentativas" +
          " | " + q.accuracy_pct + "%"
        );
      });
    }

    body.appendParagraph("");
    body.appendParagraph(
      "Atualizado em: " +
      Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        "dd/MM/yyyy HH:mm:ss"
      )
    );

    doc.saveAndClose();

    return ContentService
      .createTextOutput(JSON.stringify({
        ok: true
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (erro) {
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: false,
        error: erro.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
