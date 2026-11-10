/**
 * ==========================================================================
 * GRANAFLOW — NÚCLEO DE REGRAS E CÁLCULOS FINANCEIROS (finance.js)
 * Operações matemáticas 100% em centavos inteiros (Integer Cents)
 * ==========================================================================
 */

(function (window) {
  'use strict';

  var Finance = {
    /**
     * Converte número decimal ou string monetária ("R$ 150,50" ou "150.50") para centavos inteiros
     */
    toCents: function (val) {
      if (val === null || val === undefined || val === '') return 0;
      if (typeof val === 'number') {
        return Math.round(val * 100);
      }
      var clean = String(val)
        .replace(/[^\d,-]/g, '')
        .replace(',', '.');
      var num = parseFloat(clean);
      return isNaN(num) ? 0 : Math.round(num * 100);
    },

    /**
     * Formata valor em centavos para a representação da moeda brasileira BRL: "R$ 1.250,00"
     */
    formatBRL: function (cents) {
      var safeCents = parseInt(cents, 10);
      if (isNaN(safeCents)) safeCents = 0;
      var isNegative = safeCents < 0;
      var absCents = Math.abs(safeCents);
      var reais = Math.floor(absCents / 100);
      var centavos = absCents % 100;

      var reaisFormatted = reais.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      var centavosFormatted = (centavos < 10 ? '0' : '') + centavos;

      return (isNegative ? '- R$ ' : 'R$ ') + reaisFormatted + ',' + centavosFormatted;
    },

    /**
     * Formata centavos em string decimal para inputs numéricos: "150.00"
     */
    centsToDecimalStr: function (cents) {
      var safeCents = parseInt(cents, 10) || 0;
      return (safeCents / 100).toFixed(2);
    },

    /**
     * Calcula o fechamento semanal com base nas quantidades e valores unitários
     * Exemplo: 1 normal (100) + 2 normais (200) + 1 solo (150) + 1 normal (100) + 2 solo (300) = 850
     */
    calculateWeeklyTotals: function (normalCount, soloCount, customEventsArray, normalUnitCents, soloUnitCents) {
      var nQty = parseInt(normalCount, 10) || 0;
      var sQty = parseInt(soloCount, 10) || 0;
      var nUnit = parseInt(normalUnitCents, 10) || 10000;
      var sUnit = parseInt(soloUnitCents, 10) || 15000;

      var normalTotalCents = nQty * nUnit;
      var soloTotalCents = sQty * sUnit;

      var customTotalCents = 0;
      var customQty = 0;
      if (Array.isArray(customEventsArray)) {
        customEventsArray.forEach(function (ev) {
          var q = parseInt(ev.quantity, 10) || 0;
          var u = parseInt(ev.unitValue, 10) || 0;
          customQty += q;
          customTotalCents += (q * u);
        });
      }

      return {
        normalCount: nQty,
        soloCount: sQty,
        customCount: customQty,
        totalEventsCount: nQty + sQty + customQty,
        normalTotalCents: normalTotalCents,
        soloTotalCents: soloTotalCents,
        customTotalCents: customTotalCents,
        grandTotalCents: normalTotalCents + soloTotalCents + customTotalCents
      };
    },

    /**
     * Calcula todos os agregados financeiros do sistema
     * @param {Object} data - Objeto contendo { events, expenses, goals, investments }
     * @param {Object} filter - { startDate, endDate, month, year } opcional
     */
    computeFullBalances: function (data) {
      data = data || {};
      var events = data.events || [];
      var expenses = data.expenses || [];
      var goals = data.goals || [];
      var investments = data.investments || [];

      var now = new Date();
      var currentYear = now.getFullYear();
      var currentMonth = now.getMonth(); // 0 a 11

      // 1. RECEITAS
      var totalReceitasRecebidasCents = 0;
      var totalReceitasPendentesCents = 0;
      var totalRecebidoMesAtualCents = 0;
      var totalPendenteMesAtualCents = 0;

      events.forEach(function (ev) {
        var val = parseInt(ev.totalValue, 10) || 0;
        var isReceived = ev.status === 'received';

        var evDate = ev.date ? new Date(ev.date + 'T00:00:00') : new Date();
        var isCurrentMonth = evDate.getFullYear() === currentYear && evDate.getMonth() === currentMonth;

        if (isReceived) {
          totalReceitasRecebidasCents += val;
          if (isCurrentMonth) {
            totalRecebidoMesAtualCents += val;
          }
        } else {
          totalReceitasPendentesCents += val;
          if (isCurrentMonth) {
            totalPendenteMesAtualCents += val;
          }
        }
      });

      // 2. DESPESAS
      var totalDespesasPagasCents = 0;
      var totalDespesasPendentesCents = 0;
      var totalDespesasPagasMesCents = 0;
      var totalDespesasPendentesMesCents = 0;

      expenses.forEach(function (exp) {
        var val = parseInt(exp.amount, 10) || 0;
        var isPaid = exp.status === 'paid';

        var expDate = exp.date ? new Date(exp.date + 'T00:00:00') : new Date();
        var isCurrentMonth = expDate.getFullYear() === currentYear && expDate.getMonth() === currentMonth;

        if (isPaid) {
          totalDespesasPagasCents += val;
          if (isCurrentMonth) {
            totalDespesasPagasMesCents += val;
          }
        } else {
          totalDespesasPendentesCents += val;
          if (isCurrentMonth) {
            totalDespesasPendentesMesCents += val;
          }
        }
      });

      // 3. DINHEIRO RESERVADO EM METAS
      var totalReservadoMetasCents = 0;
      var totalAlvoMetasCents = 0;

      goals.forEach(function (g) {
        var saved = parseInt(g.savedAmount, 10) || 0;
        var target = parseInt(g.targetAmount, 10) || 0;
        totalReservadoMetasCents += saved;
        totalAlvoMetasCents += target;
      });

      // 4. INVESTIMENTOS (CARTEIRA)
      var totalInvestidoCents = 0;
      var totalPatrimonioInvestimentosCents = 0;

      investments.forEach(function (inv) {
        var applied = parseInt(inv.appliedAmount, 10) || 0;
        var current = parseInt(inv.currentAmount !== undefined ? inv.currentAmount : inv.appliedAmount, 10) || 0;
        totalInvestidoCents += applied;
        totalPatrimonioInvestimentosCents += current;
      });

      // 5. CÁLCULOS DOS SALDOS PRINCIPAIS
      // Saldo em Conta = Total Receitas Recebidas - Total Despesas Pagas - Total Investido da Conta - Total Reservado em Metas
      // Nota: As reservas para metas e aportes saem do saldo livre em conta para suas respectivas caixas.
      var saldoEmContaCents = totalReceitasRecebidasCents - totalDespesasPagasCents - totalInvestidoCents - totalReservadoMetasCents;

      // Dinheiro Disponível para Gastar ("Quanto posso gastar?")
      // Regra de Ouro: Saldo em Conta MENOS despesas pendentes do mês.
      // Jamais adiciona receitas pendentes como dinheiro disponível.
      var disponivelParaGastarCents = saldoEmContaCents - totalDespesasPendentesMesCents;

      // Patrimônio Financeiro Total Registrado:
      // Soma de tudo que o usuário possui: Saldo em conta + Dinheiro reservado em metas + Total investido
      var patrimonioTotalCents = saldoEmContaCents + totalReservadoMetasCents + totalPatrimonioInvestimentosCents;

      return {
        // Balanço Geral
        saldoEmContaCents: saldoEmContaCents,
        disponivelParaGastarCents: disponivelParaGastarCents,
        patrimonioTotalCents: patrimonioTotalCents,

        // Mês Atual
        totalRecebidoMesAtualCents: totalRecebidoMesAtualCents,
        totalPendenteMesAtualCents: totalPendenteMesAtualCents,
        totalDespesasPagasMesCents: totalDespesasPagasMesCents,
        totalDespesasPendentesMesCents: totalDespesasPendentesMesCents,

        // Totais Históricos
        totalReceitasRecebidasCents: totalReceitasRecebidasCents,
        totalReceitasPendentesCents: totalReceitasPendentesCents,
        totalDespesasPagasCents: totalDespesasPagasCents,
        totalDespesasPendentesCents: totalDespesasPendentesCents,

        // Metas & Investimentos
        totalReservadoMetasCents: totalReservadoMetasCents,
        totalAlvoMetasCents: totalAlvoMetasCents,
        totalInvestidoCents: totalInvestidoCents,
        totalPatrimonioInvestimentosCents: totalPatrimonioInvestimentosCents
      };
    },

    /**
     * Agrupa despesas por categoria calculando os totais em centavos
     */
    groupExpensesByCategory: function (expenses, filterPeriod) {
      var categoriesMap = {};
      var totalPeriodCents = 0;

      expenses.forEach(function (exp) {
        // Apenas despesas do período ou todas se não houver filtro
        var cat = exp.category || 'Outros';
        var val = parseInt(exp.amount, 10) || 0;

        if (!categoriesMap[cat]) {
          categoriesMap[cat] = 0;
        }
        categoriesMap[cat] += val;
        totalPeriodCents += val;
      });

      var result = [];
      Object.keys(categoriesMap).forEach(function (catName) {
        var amountCents = categoriesMap[catName];
        var percentage = totalPeriodCents > 0 ? (amountCents / totalPeriodCents) * 100 : 0;
        result.push({
          category: catName,
          amountCents: amountCents,
          percentage: percentage
        });
      });

      // Ordenar do maior para o menor gasto
      result.sort(function (a, b) {
        return b.amountCents - a.amountCents;
      });

      return {
        categories: result,
        totalCents: totalPeriodCents
      };
    },

    /**
     * Calcula o valor necessário para metas (quanto guardar por semana / mês)
     */
    calculateGoalSavingsPlan: function (targetCents, savedCents, deadlineDateStr) {
      var remainingCents = Math.max(0, targetCents - savedCents);
      if (remainingCents === 0 || !deadlineDateStr) {
        return {
          remainingCents: 0,
          weeksRemaining: 0,
          monthsRemaining: 0,
          perWeekCents: 0,
          perMonthCents: 0
        };
      }

      var now = new Date();
      var deadline = new Date(deadlineDateStr + 'T23:59:59');
      var diffMs = deadline - now;
      if (diffMs <= 0) {
        return {
          remainingCents: remainingCents,
          weeksRemaining: 0,
          monthsRemaining: 0,
          perWeekCents: remainingCents,
          perMonthCents: remainingCents
        };
      }

      var diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      var weeks = Math.max(1, Math.round(diffDays / 7));
      var months = Math.max(1, Math.round(diffDays / 30.4));

      return {
        remainingCents: remainingCents,
        weeksRemaining: weeks,
        monthsRemaining: months,
        perWeekCents: Math.ceil(remainingCents / weeks),
        perMonthCents: Math.ceil(remainingCents / months)
      };
    },

    /**
     * Simulador de Juros Compostos para Investimentos
     * @param {number} initialCents - Valor inicial em centavos
     * @param {number} monthlyCents - Aporte mensal em centavos
     * @param {number} months - Total de meses
     * @param {number} annualRatePercent - Taxa anual estimada (ex: 10.5 para 10,5% a.a.)
     */
    simulateCompoundInterest: function (initialCents, monthlyCents, months, annualRatePercent) {
      var monthlyRate = Math.pow(1 + (annualRatePercent / 100), 1 / 12) - 1;
      var points = [];
      var currentBalance = initialCents;
      var totalInvested = initialCents;

      for (var m = 1; m <= months; m++) {
        var interest = currentBalance * monthlyRate;
        currentBalance += interest + monthlyCents;
        totalInvested += monthlyCents;

        points.push({
          month: m,
          investedCents: Math.round(totalInvested),
          balanceCents: Math.round(currentBalance),
          interestAccumulatedCents: Math.round(currentBalance - totalInvested)
        });
      }

      return {
        finalBalanceCents: Math.round(currentBalance),
        totalInvestedCents: Math.round(totalInvested),
        totalInterestCents: Math.round(currentBalance - totalInvested),
        points: points
      };
    }
  };

  window.AppFinance = Finance;
})(window);
