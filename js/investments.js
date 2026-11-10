/**
 * ==========================================================================
 * GRANAFLOW — INVESTIMENTOS, EDUCAÇÃO E SIMULADORES (investments.js)
 * Carteira Pessoal, Reserva de Emergência, Perfil e Simulador de Juros
 * ==========================================================================
 */

(function (window) {
  'use strict';

  var InvestmentsModule = {
    init: function () {
      InvestmentsModule.renderPortfolio();
      InvestmentsModule.renderEmergencyFundSimulator();
      InvestmentsModule.renderEducationalCards();
    },

    /**
     * Alterna sub-abas da tela de Investimentos
     */
    switchTab: function (tabId) {
      var tabs = document.querySelectorAll('#investments_screen .subtab-btn');
      var contents = document.querySelectorAll('#investments_screen .subtab-content');

      tabs.forEach(function (btn) { btn.classList.remove('active'); });
      contents.forEach(function (cnt) { cnt.classList.remove('active'); });

      var targetBtn = document.querySelector('#investments_screen .subtab-btn[data-tab="' + tabId + '"]');
      var targetContent = document.getElementById(tabId);

      if (targetBtn) targetBtn.classList.add('active');
      if (targetContent) targetContent.classList.add('active');

      if (tabId === 'tab_inv_simulador') {
        InvestmentsModule.runInvestmentSimulation();
      } else if (tabId === 'tab_inv_reserva') {
        InvestmentsModule.renderEmergencyFundSimulator();
      }
    },

    /**
     * Salva ou atualiza um investimento na carteira pessoal
     */
    saveInvestment: function (data) {
      var isUpdate = !!data.id;
      var operation = isUpdate ? window.AppDB.update('investments', data) : window.AppDB.add('investments', data);

      return operation.then(function () {
        if (window.App) {
          window.App.showToast(isUpdate ? 'Investimento atualizado!' : 'Aplicação registrada na carteira!', 'success');
          window.App.refreshAll();
        }
        InvestmentsModule.renderPortfolio();
      });
    },

    deleteInvestment: function (id) {
      if (!confirm('Deseja excluir este registro de investimento?')) return;
      window.AppDB.delete('investments', id).then(function () {
        if (window.App) {
          window.App.showToast('Investimento removido.', 'info');
          window.App.refreshAll();
        }
        InvestmentsModule.renderPortfolio();
      });
    },

    /**
     * Realiza um resgate (parcial ou total) do investimento de volta para o saldo em conta
     */
    withdrawInvestment: function (id, withdrawCents) {
      window.AppDB.getById('investments', id).then(function (inv) {
        if (!inv) return;
        var current = parseInt(inv.appliedAmount, 10) || 0;
        if (withdrawCents > current) {
          if (window.App) window.App.showToast('Valor de resgate maior que o saldo aplicado!', 'error');
          return;
        }

        inv.appliedAmount = current - withdrawCents;
        var promise = (inv.appliedAmount === 0) ? window.AppDB.delete('investments', id) : window.AppDB.update('investments', inv);

        return promise.then(function () {
          if (window.App) {
            window.App.showToast('Resgate de ' + window.AppFinance.formatBRL(withdrawCents) + ' realizado com sucesso!', 'success');
            window.App.refreshAll();
          }
          InvestmentsModule.renderPortfolio();
        });
      });
    },

    /**
     * Renderiza a Carteira de Investimentos
     */
    renderPortfolio: function () {
      var container = document.getElementById('portfolio_items_list');
      var totalBox = document.getElementById('portfolio_total_applied');
      if (!container) return;

      window.AppDB.getAll('investments').then(function (items) {
        if (!items || items.length === 0) {
          container.innerHTML = '<div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.85rem;">Nenhum investimento registrado na carteira.</div>';
          if (totalBox) totalBox.textContent = 'R$ 0,00';
          return;
        }

        var totalCents = 0;
        items.forEach(function (i) { totalCents += (parseInt(i.appliedAmount, 10) || 0); });
        if (totalBox) totalBox.textContent = window.AppFinance.formatBRL(totalCents);

        var html = '';
        items.forEach(function (inv) {
          var dateFormatted = inv.date ? inv.date.split('-').reverse().join('/') : '-';
          var percentage = totalCents > 0 ? ((inv.appliedAmount / totalCents) * 100).toFixed(1) : 0;

          html += '<div class="item-row">' +
            '<div class="item-main">' +
              '<div class="item-icon-box" style="background: rgba(14, 165, 233, 0.15); color: #0EA5E9;">📈</div>' +
              '<div class="item-info">' +
                '<span class="item-title">' + inv.name + '</span>' +
                '<span class="item-subtitle">' + (inv.institution || 'Corretora/Banco') + ' • ' + (inv.yieldRate || 'Renda Fixa') + ' (' + percentage + '%)</span>' +
              '</div>' +
            '</div>' +
            '<div class="item-actions">' +
              '<div style="text-align: right;">' +
                '<div class="item-value text-info">' + window.AppFinance.formatBRL(inv.appliedAmount) + '</div>' +
                '<div style="font-size: 0.7rem; color: var(--text-muted);">' + (inv.liquidity || 'Diária') + '</div>' +
              '</div>' +
              '<button type="button" class="btn-icon-header" style="width: 32px; height: 32px;" onclick="InvestmentsModule.deleteInvestment(' + inv.id + ')">🗑️</button>' +
            '</div>' +
          '</div>';
        });

        container.innerHTML = html;
      });
    },

    /**
     * Simulador de Reserva de Emergência (3, 6 e 12 meses)
     */
    renderEmergencyFundSimulator: function () {
      var container = document.getElementById('emergency_fund_results');
      if (!container) return;

      Promise.all([
        window.AppDB.getAll('fixed_expenses'),
        window.AppDB.getAll('expenses'),
        window.AppFinance.computeFullBalances
      ]).then(function (results) {
        var fixed = results[0] || [];
        var allExpenses = results[1] || [];

        // Calcular custo de vida mensal estimado
        var monthlyFixedTotal = 0;
        fixed.forEach(function (f) { monthlyFixedTotal += (parseInt(f.amount, 10) || 0); });

        var inputCost = document.getElementById('emergency_monthly_cost_input');
        if (inputCost && !inputCost.dataset.customized && monthlyFixedTotal > 0) {
          inputCost.value = window.AppFinance.centsToDecimalStr(monthlyFixedTotal);
        }

        var currentVal = inputCost ? window.AppFinance.toCents(inputCost.value) : monthlyFixedTotal;
        if (currentVal <= 0) currentVal = 150000; // Padrão R$ 1.500 se nada informado

        var target3 = currentVal * 3;
        var target6 = currentVal * 6;
        var target12 = currentVal * 12;

        // Buscar quanto há guardado (ex: saldo em conta + investimentos de liquidez diária)
        window.AppDB.getAll('investments').then(function (invs) {
          var emergencySavedCents = 0;
          invs.forEach(function (inv) {
            if ((inv.liquidity || '').toLowerCase().includes('diár') || (inv.liquidity || '').toLowerCase().includes('imediata')) {
              emergencySavedCents += (parseInt(inv.appliedAmount, 10) || 0);
            }
          });

          function renderTier(months, targetCents) {
            var pct = Math.min(100, targetCents > 0 ? (emergencySavedCents / targetCents) * 100 : 0).toFixed(1);
            var remaining = Math.max(0, targetCents - emergencySavedCents);

            return '<div class="card" style="margin-bottom: 10px;">' +
              '<div style="display:flex; justify-content:space-between; margin-bottom: 6px;">' +
                '<strong>' + months + ' meses (' + window.AppFinance.formatBRL(targetCents) + ')</strong>' +
                '<span class="text-info font-bold">' + pct + '%</span>' +
              '</div>' +
              '<div class="goal-progress-bar-bg">' +
                '<div class="goal-progress-bar-fill" style="width: ' + pct + '%; background: var(--secondary-gradient);"></div>' +
              '</div>' +
              '<div style="display:flex; justify-content:space-between; font-size: 0.75rem; color: var(--text-muted);">' +
                '<span>Guardado: ' + window.AppFinance.formatBRL(emergencySavedCents) + '</span>' +
                '<span>Falta: ' + window.AppFinance.formatBRL(remaining) + '</span>' +
              '</div>' +
            '</div>';
          }

          container.innerHTML =
            renderTier(3, target3) +
            renderTier(6, target6) +
            renderTier(12, target12);
        });
      });
    },

    /**
     * Executa a Simulação de Investimentos e desenha gráfico nativo em Canvas
     */
    runInvestmentSimulation: function () {
      var initialInput = document.getElementById('sim_initial_amount');
      var monthlyInput = document.getElementById('sim_monthly_amount');
      var monthsInput = document.getElementById('sim_period_months');
      var rateInput = document.getElementById('sim_annual_rate');

      var initialCents = initialInput ? window.AppFinance.toCents(initialInput.value) : 100000;
      var monthlyCents = monthlyInput ? window.AppFinance.toCents(monthlyInput.value) : 20000;
      var months = monthsInput ? parseInt(monthsInput.value, 10) || 24 : 24;
      var rate = rateInput ? parseFloat(rateInput.value) || 10.5 : 10.5;

      var sim = window.AppFinance.simulateCompoundInterest(initialCents, monthlyCents, months, rate);

      var elFinal = document.getElementById('sim_result_final');
      var elInvested = document.getElementById('sim_result_invested');
      var elInterest = document.getElementById('sim_result_interest');

      if (elFinal) elFinal.textContent = window.AppFinance.formatBRL(sim.finalBalanceCents);
      if (elInvested) elInvested.textContent = window.AppFinance.formatBRL(sim.totalInvestedCents);
      if (elInterest) elInterest.textContent = window.AppFinance.formatBRL(sim.totalInterestCents);

      // Renderizar gráfico Canvas nativo
      InvestmentsModule.drawSimulationCanvas(sim.points);
    },

    /**
     * Desenha gráfico de linhas/área do simulador no Canvas
     */
    drawSimulationCanvas: function (points) {
      var canvas = document.getElementById('simulation_chart_canvas');
      if (!canvas || !points || points.length === 0) return;

      var ctx = canvas.getContext('2d');
      var width = canvas.width = canvas.parentElement.clientWidth || 320;
      var height = canvas.height = 180;

      ctx.clearRect(0, 0, width, height);

      var maxVal = points[points.length - 1].balanceCents * 1.08;
      var padding = { top: 20, right: 15, bottom: 25, left: 15 };
      var chartW = width - padding.left - padding.right;
      var chartH = height - padding.top - padding.bottom;

      // Grade horizontal de fundo
      ctx.strokeStyle = '#24334E';
      ctx.lineWidth = 1;
      for (var g = 0; g <= 3; g++) {
        var yPos = padding.top + (chartH / 3) * g;
        ctx.beginPath();
        ctx.moveTo(padding.left, yPos);
        ctx.lineTo(width - padding.right, yPos);
        ctx.stroke();
      }

      // Função de mapeamento de coordenadas
      function getX(idx) {
        return padding.left + (chartW / (points.length - 1)) * idx;
      }
      function getY(cents) {
        return padding.top + chartH - (cents / maxVal) * chartH;
      }

      // 1. Linha do Total Investido (Cinza / Azul)
      ctx.beginPath();
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 2;
      points.forEach(function (p, idx) {
        var x = getX(idx);
        var y = getY(p.investedCents);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // 2. Linha do Saldo Acumulado (Verde / Turquesa)
      ctx.beginPath();
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 3;
      points.forEach(function (p, idx) {
        var x = getX(idx);
        var y = getY(p.balanceCents);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Destaque do ponto final
      var lastP = points[points.length - 1];
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.arc(getX(points.length - 1), getY(lastP.balanceCents), 5, 0, Math.PI * 2);
      ctx.fill();
    },

    /**
     * Calcula o Perfil do Investidor com base no questionário
     */
    calculateRiskProfile: function () {
      var q1 = parseInt(document.querySelector('input[name="quiz_q1"]:checked')?.value || 1, 10);
      var q2 = parseInt(document.querySelector('input[name="quiz_q2"]:checked')?.value || 1, 10);
      var q3 = parseInt(document.querySelector('input[name="quiz_q3"]:checked')?.value || 1, 10);
      var q4 = parseInt(document.querySelector('input[name="quiz_q4"]:checked')?.value || 1, 10);
      var q5 = parseInt(document.querySelector('input[name="quiz_q5"]:checked')?.value || 1, 10);
      var q6 = parseInt(document.querySelector('input[name="quiz_q6"]:checked')?.value || 1, 10);
      var q7 = parseInt(document.querySelector('input[name="quiz_q7"]:checked')?.value || 1, 10);

      var score = q1 + q2 + q3 + q4 + q5 + q6 + q7;
      var title = '';
      var desc = '';
      var color = '';

      if (score <= 11) {
        title = 'Perfil Conservador';
        color = '#38BDF8';
        desc = 'Você prioriza a segurança total do seu dinheiro e liquidez imediata. Prefere rentabilidade estável e previsível a correr riscos de oscilação. Produtos mais alinhados: Tesouro Selic, CDBs com liquidez diária e LCI/LCA com garantia do FGC.';
      } else if (score <= 17) {
        title = 'Perfil Moderado';
        color = '#F59E0B';
        desc = 'Você busca equilíbrio entre segurança e uma rentabilidade melhor. Aceita pequenas variações a médio prazo em troca de ganhos superiores à inflação. Produtos mais alinhados: Tesouro IPCA+, CDBs de médio prazo, Fundos Imobiliários e uma fatia controlada de renda variável.';
      } else {
        title = 'Perfil Arrojado';
        color = '#10B981';
        desc = 'Você tem boa tolerância a oscilações de mercado e foca no crescimento de patrimônio a longo prazo. Compreende os ciclos econômicos. Produtos mais alinhados: Ações, Fundos Imobiliários, ETFs e investimentos internacionais, mantendo sempre a reserva de emergência segura.';
      }

      var resultBox = document.getElementById('quiz_result_box');
      if (resultBox) {
        resultBox.style.display = 'block';
        resultBox.innerHTML = '<div class="card" style="border-left: 4px solid ' + color + '; margin-top: 14px;">' +
          '<h3 style="color: ' + color + '; margin-bottom: 6px;">' + title + ' (' + score + ' pts)</h3>' +
          '<p style="font-size: 0.82rem; color: var(--text-main); line-height: 1.5;">' + desc + '</p>' +
          '<div style="margin-top: 10px; font-size: 0.72rem; color: var(--text-muted); background: rgba(0,0,0,0.25); padding: 8px; border-radius: 6px;">' +
            'ℹ️ <em>Aviso legal: Esta classificação é apenas de caráter educativo. Rentabilidade passada não é garantia de rendimentos futuros. Verifique taxas vigentes (Selic/CDI) antes de aplicar.</em>' +
          '</div>' +
        '</div>';
      }
    },

    /**
     * Renderiza os cards educativos detalhados sobre as modalidades
     */
    renderEducationalCards: function () {
      var container = document.getElementById('educational_cards_container');
      if (!container) return;

      var guides = [
        {
          title: 'Tesouro Direto',
          tax: 'IR Regressivo (22,5% a 15%)',
          content: 'Títulos públicos emitidos pelo Governo Federal Brasileiro através do Tesouro Nacional. É considerado o investimento mais seguro do país. Modalidades: Tesouro Selic (liquidez diária, ideal para reserva), Tesouro IPCA+ (protege contra a inflação a médio/longo prazo) e Tesouro Prefixado (taxa fixa garantida se levado ao vencimento).'
        },
        {
          title: 'CDB (Certificado de Depósito Bancário)',
          tax: 'IR Regressivo (22,5% a 15%)',
          content: 'Empréstimo feito por você a um banco comercial. Conta com proteção do FGC (Fundo Garantidor de Créditos) de até R$ 250 mil por CPF e instituição. Pode ter liquidez diária (como em contas digitais a 100% do CDI) ou prazos fechados com taxas maiores.'
        },
        {
          title: 'LCI e LCA (Letras de Crédito Imobiliário e do Agronegócio)',
          tax: 'ISENTO de Imposto de Renda para Pessoa Física',
          content: 'Títulos emitidos por instituições financeiras para financiar os setores imobiliário e do agronegócio. Grande vantagem: isenção total de IR para pessoas físicas e proteção do FGC. Geralmente possuem carência mínima para resgate.'
        },
        {
          title: 'Fundos Imobiliários (FIIs)',
          tax: 'Rendimentos Mensais Isentos de IR (Ganhos de capital: 20%)',
          content: 'Permitem investir em imóveis de grande porte (galpões logísticos, lajes corporativas, shopping centers e títulos de crédito imobiliário) através de cotas negociadas na Bolsa (B3). Distribuem rendimentos (aluguéis) mensalmente. Como estão na renda variável, o valor das cotas oscila.'
        },
        {
          title: 'ETFs (Exchange Traded Funds)',
          tax: 'Geralmente 15% sobre o ganho de capital',
          content: 'Fundos de índice negociados em bolsa que replicam o desempenho de carteiras teóricas como o Ibovespa (BOVA11) ou S&P 500 dos EUA (IVVB11). Oferecem diversificação instantânea com baixo custo de administração.'
        },
        {
          title: 'Ações (Renda Variável)',
          tax: '15% sobre o ganho (Isenção até R$ 20 mil/mês em vendas normais)',
          content: 'Ao comprar uma ação, você se torna sócio de uma empresa listada em bolsa. O retorno ocorre pela valorização das ações e pelo recebimento de proventos (dividendos e juros sobre capital próprio). Exige visão de longo prazo e tolerância à volatilidade de mercado.'
        },
        {
          title: 'Poupança',
          tax: 'Isento de IR',
          content: 'Modalidade mais tradicional do Brasil, porém com histórico de rendimento inferior à inflação ou ao CDI. Rende 70% da Selic + TR quando a taxa Selic estiver abaixo de 8,5% a.a., e 0,5% ao mês + TR quando a Selic for maior. O rendimento só ocorre no aniversário do depósito.'
        }
      ];

      var html = '';
      guides.forEach(function (g, idx) {
        html += '<div class="edu-card">' +
          '<div class="edu-header" onclick="InvestmentsModule.toggleEduCard(' + idx + ')">' +
            '<h4>' + g.title + '</h4>' +
            '<span class="edu-badge-tax">' + g.tax + '</span>' +
          '</div>' +
          '<div class="edu-body" id="edu_body_' + idx + '">' +
            '<p>' + g.content + '</p>' +
            '<div style="margin-top: 8px; font-size: 0.72rem; color: #38BDF8;">Consulte sempre a taxa Selic/CDI atual do Banco Central do Brasil para simulações reais.</div>' +
          '</div>' +
        '</div>';
      });

      container.innerHTML = html;
    },

    toggleEduCard: function (idx) {
      var body = document.getElementById('edu_body_' + idx);
      if (body) {
        body.classList.toggle('active');
      }
    }
  };

  window.InvestmentsModule = InvestmentsModule;
})(window);
