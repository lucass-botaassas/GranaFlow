/**
 * ==========================================================================
 * GRANAFLOW — RELATÓRIOS E ANÁLISES FINANCEIRAS (reports.js)
 * Gráficos nativos em Canvas (Donut e Barras) e Exportação em CSV
 * ==========================================================================
 */

(function (window) {
  'use strict';

  var ReportsModule = {
    currentFilter: 'month', // 'day', 'week', 'month', 'year', 'custom'

    init: function () {
      ReportsModule.renderReports();
    },

    setFilter: function (filterType) {
      ReportsModule.currentFilter = filterType;
      var buttons = document.querySelectorAll('.report-filter-btn');
      buttons.forEach(function (b) {
        if (b.dataset.filter === filterType) b.classList.add('active');
        else b.classList.remove('active');
      });

      var customDatesRow = document.getElementById('report_custom_dates_row');
      if (customDatesRow) {
        customDatesRow.style.display = (filterType === 'custom') ? 'flex' : 'none';
      }

      ReportsModule.renderReports();
    },

    /**
     * Retorna intervalo de datas (startDate, endDate) conforme o filtro selecionado
     */
    getDateRange: function () {
      var now = new Date();
      var start = new Date();
      var end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      if (ReportsModule.currentFilter === 'day') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      } else if (ReportsModule.currentFilter === 'week') {
        var dayOfWeek = now.getDay(); // 0 domingo
        var diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0);
      } else if (ReportsModule.currentFilter === 'month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      } else if (ReportsModule.currentFilter === 'year') {
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      } else if (ReportsModule.currentFilter === 'custom') {
        var startInput = document.getElementById('report_custom_start');
        var endInput = document.getElementById('report_custom_end');
        if (startInput && startInput.value) {
          start = new Date(startInput.value + 'T00:00:00');
        }
        if (endInput && endInput.value) {
          end = new Date(endInput.value + 'T23:59:59');
        }
      }

      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      };
    },

    /**
     * Renderiza o painel completo de relatórios
     */
    renderReports: function () {
      var range = ReportsModule.getDateRange();

      Promise.all([
        window.AppDB.getAll('events'),
        window.AppDB.getAll('expenses'),
        window.AppDB.getAll('goals'),
        window.AppDB.getAll('investments')
      ]).then(function (results) {
        var allEvents = results[0] || [];
        var allExpenses = results[1] || [];
        var allGoals = results[2] || [];
        var allInvestments = results[3] || [];

        // Filtrar pelo range
        var periodEvents = allEvents.filter(function (ev) {
          return ev.date && ev.date >= range.startDate && ev.date <= range.endDate;
        });

        var periodExpenses = allExpenses.filter(function (exp) {
          return exp.date && exp.date >= range.startDate && exp.date <= range.endDate;
        });

        var receivedCents = 0;
        var pendingIncomeCents = 0;
        periodEvents.forEach(function (ev) {
          var v = parseInt(ev.totalValue, 10) || 0;
          if (ev.status === 'received') receivedCents += v;
          else pendingIncomeCents += v;
        });

        var paidExpensesCents = 0;
        var pendingExpensesCents = 0;
        periodExpenses.forEach(function (exp) {
          var v = parseInt(exp.amount, 10) || 0;
          if (exp.status === 'paid') paidExpensesCents += v;
          else pendingExpensesCents += v;
        });

        var totalSavedGoalsCents = 0;
        allGoals.forEach(function (g) { totalSavedGoalsCents += (parseInt(g.savedAmount, 10) || 0); });

        var totalInvestedCents = 0;
        allInvestments.forEach(function (i) { totalInvestedCents += (parseInt(i.appliedAmount, 10) || 0); });

        // Cálculos gerais
        var fullBalances = window.AppFinance.computeFullBalances({
          events: allEvents,
          expenses: allExpenses,
          goals: allGoals,
          investments: allInvestments
        });

        // Atualizar textos dos cards de métricas
        var elRec = document.getElementById('report_received_total');
        var elPendingInc = document.getElementById('report_pending_income_total');
        var elPaid = document.getElementById('report_paid_expenses_total');
        var elPendingExp = document.getElementById('report_pending_expenses_total');
        var elSaved = document.getElementById('report_goals_saved_total');
        var elInvested = document.getElementById('report_invested_total');
        var elNetWorth = document.getElementById('report_net_worth_total');

        if (elRec) elRec.textContent = window.AppFinance.formatBRL(receivedCents);
        if (elPendingInc) elPendingInc.textContent = window.AppFinance.formatBRL(pendingIncomeCents);
        if (elPaid) elPaid.textContent = window.AppFinance.formatBRL(paidExpensesCents);
        if (elPendingExp) elPendingExp.textContent = window.AppFinance.formatBRL(pendingExpensesCents);
        if (elSaved) elSaved.textContent = window.AppFinance.formatBRL(totalSavedGoalsCents);
        if (elInvested) elInvested.textContent = window.AppFinance.formatBRL(totalInvestedCents);
        if (elNetWorth) elNetWorth.textContent = window.AppFinance.formatBRL(fullBalances.patrimonioTotalCents);

        // Agrupamento por categoria
        var categoryGroup = window.AppFinance.groupExpensesByCategory(periodExpenses);

        // Renderizar gráficos Canvas
        ReportsModule.drawDonutChart(categoryGroup);
        ReportsModule.drawComparisonBarChart(receivedCents, paidExpensesCents);
      });
    },

    /**
     * Desenha gráfico de rosca nativo (Donut Chart) de despesas por categoria
     */
    drawDonutChart: function (categoryGroup) {
      var canvas = document.getElementById('report_donut_canvas');
      var legendContainer = document.getElementById('report_donut_legend');
      if (!canvas || !legendContainer) return;

      var ctx = canvas.getContext('2d');
      var size = canvas.width = 220;
      canvas.height = 220;
      var centerX = size / 2;
      var centerY = size / 2;
      var radius = 80;
      var holeRadius = 52;

      ctx.clearRect(0, 0, size, size);

      var categories = categoryGroup.categories;
      var totalCents = categoryGroup.totalCents;

      var colors = ['#6366F1', '#EC4899', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#14B8A6', '#F43F5E', '#A855F7', '#64748B'];

      if (!categories || categories.length === 0 || totalCents === 0) {
        ctx.fillStyle = '#24334E';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.arc(centerX, centerY, holeRadius, 0, Math.PI * 2, true);
        ctx.fill();

        ctx.fillStyle = '#94A3B8';
        ctx.font = '12px ' + getComputedStyle(document.body).fontFamily;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Sem gastos no período', centerX, centerY);

        legendContainer.innerHTML = '';
        return;
      }

      var currentAngle = -Math.PI / 2;
      var legendHtml = '';

      categories.forEach(function (cat, idx) {
        var sliceAngle = (cat.amountCents / totalCents) * (Math.PI * 2);
        var endAngle = currentAngle + sliceAngle;
        var color = colors[idx % colors.length];

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, currentAngle, endAngle);
        ctx.arc(centerX, centerY, holeRadius, endAngle, currentAngle, true);
        ctx.closePath();
        ctx.fill();

        currentAngle = endAngle;

        legendHtml += '<div class="legend-item">' +
          '<span class="legend-color" style="background:' + color + ';"></span>' +
          '<span>' + cat.category + ' (' + cat.percentage.toFixed(1) + '% - ' + window.AppFinance.formatBRL(cat.amountCents) + ')</span>' +
        '</div>';
      });

      legendContainer.innerHTML = legendHtml;
    },

    /**
     * Desenha gráfico de barras comparando Entradas Recebidas vs Saídas Pagas
     */
    drawComparisonBarChart: function (incomeCents, expenseCents) {
      var canvas = document.getElementById('report_bar_canvas');
      if (!canvas) return;

      var ctx = canvas.getContext('2d');
      var width = canvas.width = canvas.parentElement.clientWidth || 320;
      var height = canvas.height = 140;

      ctx.clearRect(0, 0, width, height);

      var max = Math.max(incomeCents, expenseCents, 10000) * 1.15;
      var barWidth = 60;
      var chartHeight = height - 40;

      // Barra 1: Entradas (Verde)
      var hIncome = (incomeCents / max) * chartHeight;
      var xIncome = width * 0.28 - barWidth / 2;
      var yIncome = height - 25 - hIncome;

      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(xIncome, yIncome, barWidth, hIncome, [6, 6, 0, 0]) : ctx.fillRect(xIncome, yIncome, barWidth, hIncome);
      ctx.fill();

      // Barra 2: Saídas (Vermelho)
      var hExpense = (expenseCents / max) * chartHeight;
      var xExpense = width * 0.72 - barWidth / 2;
      var yExpense = height - 25 - hExpense;

      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(xExpense, yExpense, barWidth, hExpense, [6, 6, 0, 0]) : ctx.fillRect(xExpense, yExpense, barWidth, hExpense);
      ctx.fill();

      // Rótulos e Valores
      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';

      ctx.fillText(window.AppFinance.formatBRL(incomeCents), xIncome + barWidth / 2, yIncome - 8);
      ctx.fillText(window.AppFinance.formatBRL(expenseCents), xExpense + barWidth / 2, yExpense - 8);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '11px sans-serif';
      ctx.fillText('Entradas', xIncome + barWidth / 2, height - 8);
      ctx.fillText('Saídas', xExpense + barWidth / 2, height - 8);
    },

    /**
     * Exporta dados completos do relatório em formato CSV
     */
    exportCSVReport: function () {
      Promise.all([
        window.AppDB.getAll('events'),
        window.AppDB.getAll('expenses')
      ]).then(function (results) {
        var events = results[0] || [];
        var expenses = results[1] || [];

        var csvLines = [];
        csvLines.push('TIPO;NOME/DESCRICAO;DATA;CATEGORIA/TIPO_FESTA;FORMA_PAGTO;VALOR_R$;SITUACAO');

        events.forEach(function (ev) {
          var val = (parseInt(ev.totalValue, 10) / 100).toFixed(2).replace('.', ',');
          csvLines.push([
            'RECEITA_EVENTO',
            '"' + (ev.name || '').replace(/"/g, '""') + '"',
            ev.date || '',
            ev.type || '',
            'Eventos',
            val,
            ev.status === 'received' ? 'Recebido' : 'A receber'
          ].join(';'));
        });

        expenses.forEach(function (exp) {
          var val = (parseInt(exp.amount, 10) / 100).toFixed(2).replace('.', ',');
          csvLines.push([
            'DESPESA',
            '"' + (exp.name || '').replace(/"/g, '""') + '"',
            exp.date || '',
            exp.category || '',
            exp.paymentMethod || '',
            '-' + val,
            exp.status === 'paid' ? 'Paga' : 'Pendente'
          ].join(';'));
        });

        // Adiciona BOM UTF-8 (\uFEFF) para abrir com acentuação correta no Excel
        var csvContent = '\uFEFF' + csvLines.join('\r\n');
        var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);

        var a = document.createElement('a');
        a.href = url;
        a.download = 'granaflow_relatorio_' + new Date().toISOString().split('T')[0] + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (window.App) window.App.showToast('Relatório CSV baixado com sucesso!', 'success');
      }).catch(function (err) {
        console.error('Erro ao exportar CSV:', err);
        if (window.App) window.App.showToast('Erro ao exportar CSV', 'error');
      });
    }
  };

  window.ReportsModule = ReportsModule;
})(window);
