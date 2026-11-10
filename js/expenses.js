/**
 * ==========================================================================
 * GRANAFLOW — SISTEMA DE DESPESAS (expenses.js)
 * Controle de despesas fixas e variáveis, categorias e recorrências
 * ==========================================================================
 */

(function (window) {
  'use strict';

  var ExpensesModule = {
    init: function () {
      return ExpensesModule.checkAndGenerateMonthlyFixedExpenses().then(function () {
        ExpensesModule.populateCategorySelects();
        ExpensesModule.renderExpensesList();
        ExpensesModule.renderFixedExpensesList();
      });
    },

    /**
     * Carrega as categorias do banco e preenche os selects da interface
     */
    populateCategorySelects: function () {
      var select = document.getElementById('expense_category_select');
      var fixedSelect = document.getElementById('fixed_expense_category_select');
      var filterSelect = document.getElementById('expense_filter_category');

      window.AppDB.getAll('categories').then(function (categories) {
        var expenseCats = (categories || []).filter(function (c) {
          return c.type === 'expense';
        });

        var optionsHtml = '';
        expenseCats.forEach(function (c) {
          optionsHtml += '<option value="' + c.name + '">' + (c.icon || '🏷️') + ' ' + c.name + '</option>';
        });

        if (select) select.innerHTML = optionsHtml;
        if (fixedSelect) fixedSelect.innerHTML = optionsHtml;

        if (filterSelect) {
          filterSelect.innerHTML = '<option value="all">Todas as Categorias</option>' + optionsHtml;
        }
      });
    },

    /**
     * Adiciona uma nova categoria personalizada
     */
    addCustomCategory: function (name, icon, color) {
      if (!name || !name.trim()) return Promise.reject(new Error('Nome da categoria é obrigatório'));

      var catObj = {
        name: name.trim(),
        type: 'expense',
        icon: icon || '🏷️',
        color: color || '#8B5CF6'
      };

      return window.AppDB.add('categories', catObj).then(function () {
        if (window.App) window.App.showToast('Categoria "' + catObj.name + '" criada!', 'success');
        ExpensesModule.populateCategorySelects();
      });
    },

    /**
     * Verifica e gera automaticamente as contas fixas do mês corrente sem duplicação
     */
    checkAndGenerateMonthlyFixedExpenses: function () {
      var now = new Date();
      var currentYear = now.getFullYear();
      var currentMonth = now.getMonth() + 1; // 1-12
      var monthKey = currentYear + '-' + (currentMonth < 10 ? '0' : '') + currentMonth;

      return Promise.all([
        window.AppDB.getAll('fixed_expenses'),
        window.AppDB.getAll('expenses')
      ]).then(function (results) {
        var fixedList = results[0] || [];
        var allExpenses = results[1] || [];

        var addPromises = [];

        fixedList.forEach(function (fixed) {
          // Verifica se já existe uma despesa vinculada a este fixedId gerada neste mês
          var alreadyExists = allExpenses.some(function (exp) {
            return exp.fixedExpenseId === fixed.id && exp.monthKey === monthKey;
          });

          if (!alreadyExists && fixed.status !== 'inactive') {
            var dueDay = parseInt(fixed.dueDay, 10) || 10;
            var safeDay = dueDay < 10 ? '0' + dueDay : dueDay;
            var dueDate = monthKey + '-' + safeDay;

            addPromises.push(window.AppDB.add('expenses', {
              name: fixed.name,
              amount: fixed.amount,
              date: dueDate,
              category: fixed.category,
              paymentMethod: fixed.paymentMethod || 'Boleto/Débito',
              notes: 'Despesa fixa recorrente (' + monthKey + ')',
              type: 'fixed',
              status: 'pending', // Inicia pendente até o usuário pagar
              fixedExpenseId: fixed.id,
              monthKey: monthKey
            }));
          }
        });

        return Promise.all(addPromises);
      }).catch(function (err) {
        console.warn('Erro ao processar despesas fixas recorrentes:', err);
      });
    },

    /**
     * Salva uma despesa avulsa (ou atualiza existente)
     */
    saveExpense: function (formData) {
      var isUpdate = !!formData.id;
      var operation = isUpdate ? window.AppDB.update('expenses', formData) : window.AppDB.add('expenses', formData);

      return operation.then(function () {
        if (window.App) {
          window.App.showToast(isUpdate ? 'Despesa atualizada!' : 'Despesa registrada!', 'success');
          window.App.refreshAll();
        }
        ExpensesModule.renderExpensesList();
      });
    },

    /**
     * Salva uma regra de despesa fixa
     */
    saveFixedExpense: function (formData) {
      var isUpdate = !!formData.id;
      var operation = isUpdate ? window.AppDB.update('fixed_expenses', formData) : window.AppDB.add('fixed_expenses', formData);

      return operation.then(function () {
        if (window.App) {
          window.App.showToast(isUpdate ? 'Despesa fixa atualizada!' : 'Despesa fixa cadastrada!', 'success');
        }
        ExpensesModule.checkAndGenerateMonthlyFixedExpenses().then(function () {
          if (window.App) window.App.refreshAll();
          ExpensesModule.renderFixedExpensesList();
          ExpensesModule.renderExpensesList();
        });
      });
    },

    /**
     * Alterna o status da despesa (pending <-> paid)
     * Regra: Quando paga, subtrai do saldo livre. Quando pendente, compromete o dinheiro disponível sem duplicar.
     */
    toggleExpenseStatus: function (id) {
      window.AppDB.getById('expenses', id).then(function (exp) {
        if (!exp) return;
        var nextStatus = (exp.status === 'paid') ? 'pending' : 'paid';
        exp.status = nextStatus;
        if (nextStatus === 'paid') {
          exp.paidAt = new Date().toISOString();
        }
        return window.AppDB.update('expenses', exp);
      }).then(function () {
        if (window.App) {
          window.App.showToast('Status da despesa atualizado!', 'info');
          window.App.refreshAll();
        }
        ExpensesModule.renderExpensesList();
      });
    },

    /**
     * Exclui uma despesa
     */
    deleteExpense: function (id) {
      if (!confirm('Deseja excluir esta despesa?')) return;
      window.AppDB.delete('expenses', id).then(function () {
        if (window.App) {
          window.App.showToast('Despesa excluída.', 'info');
          window.App.refreshAll();
        }
        ExpensesModule.renderExpensesList();
      });
    },

    /**
     * Exclui uma despesa fixa
     */
    deleteFixedExpense: function (id) {
      if (!confirm('Deseja excluir esta regra de despesa fixa? Os lançamentos passados serão mantidos.')) return;
      window.AppDB.delete('fixed_expenses', id).then(function () {
        if (window.App) window.App.showToast('Despesa fixa excluída.', 'info');
        ExpensesModule.renderFixedExpensesList();
      });
    },

    /**
     * Renderiza a lista de despesas com filtros
     */
    renderExpensesList: function () {
      var container = document.getElementById('expenses_list_container');
      if (!container) return;

      var filterStatus = document.getElementById('expense_filter_status') ? document.getElementById('expense_filter_status').value : 'all';
      var filterCategory = document.getElementById('expense_filter_category') ? document.getElementById('expense_filter_category').value : 'all';

      window.AppDB.getAll('expenses').then(function (expenses) {
        if (!expenses || expenses.length === 0) {
          container.innerHTML = '<div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.85rem;">Nenhuma despesa registrada ainda.</div>';
          return;
        }

        // Ordenação decrescente por data
        expenses.sort(function (a, b) {
          return new Date(b.date || 0) - new Date(a.date || 0);
        });

        var filtered = expenses.filter(function (exp) {
          if (filterStatus !== 'all' && exp.status !== filterStatus) return false;
          if (filterCategory !== 'all' && exp.category !== filterCategory) return false;
          return true;
        });

        if (filtered.length === 0) {
          container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.85rem;">Nenhuma despesa encontrada com estes filtros.</div>';
          return;
        }

        var html = '';
        filtered.forEach(function (exp) {
          var isPaid = exp.status === 'paid';
          var statusClass = isPaid ? 'paid' : 'pending';
          var statusLabel = isPaid ? 'Paga' : 'Pendente';
          var dateFormatted = exp.date ? exp.date.split('-').reverse().join('/') : '-';
          var isFixed = exp.type === 'fixed';

          html += '<div class="item-row">' +
            '<div class="item-main">' +
              '<div class="item-icon-box" style="background: rgba(239, 68, 68, 0.15); color: #EF4444;">' +
                (isFixed ? '📌' : '💸') +
              '</div>' +
              '<div class="item-info">' +
                '<span class="item-title">' + (exp.name || 'Gasto') + '</span>' +
                '<span class="item-subtitle">' + dateFormatted + ' • ' + (exp.category || 'Geral') + ' (' + (exp.paymentMethod || 'Dinheiro') + ')</span>' +
              '</div>' +
            '</div>' +
            '<div class="item-actions">' +
              '<div style="text-align: right;">' +
                '<div class="item-value text-danger">- ' + window.AppFinance.formatBRL(exp.amount) + '</div>' +
                '<button type="button" class="status-chip ' + statusClass + '" style="cursor: pointer; border: none; margin-top: 4px;" onclick="ExpensesModule.toggleExpenseStatus(' + exp.id + ')">' +
                  statusLabel +
                '</button>' +
              '</div>' +
              '<button type="button" class="btn-icon-header" style="width: 32px; height: 32px;" onclick="ExpensesModule.deleteExpense(' + exp.id + ')" title="Excluir">' +
                '🗑️' +
              '</button>' +
            '</div>' +
          '</div>';
        });

        container.innerHTML = html;
      });
    },

    /**
     * Renderiza a lista de despesas fixas recorrentes
     */
    renderFixedExpensesList: function () {
      var container = document.getElementById('fixed_expenses_list_container');
      if (!container) return;

      window.AppDB.getAll('fixed_expenses').then(function (fixedList) {
        if (!fixedList || fixedList.length === 0) {
          container.innerHTML = '<div style="text-align: center; padding: 18px; color: var(--text-muted); font-size: 0.82rem;">Nenhuma despesa fixa configurada. Adicione aluguel, internet, etc.</div>';
          return;
        }

        var html = '';
        fixedList.forEach(function (f) {
          html += '<div class="item-row">' +
            '<div class="item-main">' +
              '<div class="item-icon-box" style="background: rgba(139, 92, 246, 0.15); color: #8B5CF6;">' +
                '📅' +
              '</div>' +
              '<div class="item-info">' +
                '<span class="item-title">' + f.name + '</span>' +
                '<span class="item-subtitle">Vence todo dia ' + f.dueDay + ' • ' + f.category + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="item-actions">' +
              '<div class="item-value text-danger">' + window.AppFinance.formatBRL(f.amount) + '</div>' +
              '<button type="button" class="btn-icon-header" style="width: 32px; height: 32px;" onclick="ExpensesModule.deleteFixedExpense(' + f.id + ')" title="Excluir">' +
                '🗑️' +
              '</button>' +
            '</div>' +
          '</div>';
        });

        container.innerHTML = html;
      });
    }
  };

  window.ExpensesModule = ExpensesModule;
})(window);
