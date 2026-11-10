/**
 * ==========================================================================
 * GRANAFLOW — CONTROLADOR PRINCIPAL DA APLICAÇÃO (app.js)
 * Orquestração, Navegação, Dashboard, Metas Financeiras e Segurança por PIN
 * ==========================================================================
 */

(function (window) {
  'use strict';

  var App = {
    currentScreen: 'dashboard',
    valuesVisible: true,
    activeModal: null,

    init: function () {
      console.log('Iniciando GranaFlow...');

      // Configurar eventos do botão voltar do Android
      window.addEventListener('popstate', App.handleAndroidBack);

      // 1. Inicializar Banco de Dados
      window.AppDB.init().then(function () {
        // Verificar bloqueio por PIN
        return App.checkSecurityPin();
      }).then(function (pinPassed) {
        if (!pinPassed) return; // Aguardando digitação do PIN

        // Carregar módulos
        return Promise.all([
          window.EventsModule.init(),
          window.ExpensesModule.init(),
          window.CalendarModule.init(),
          window.InvestmentsModule.init(),
          window.BackupModule.init()
        ]);
      }).then(function () {
        App.bindUIEvents();
        App.refreshAll();
        console.log('GranaFlow carregado com sucesso!');
      }).catch(function (err) {
        console.error('Erro na inicialização do GranaFlow:', err);
      });
    },

    /**
     * Tratamento inteligente do botão Voltar do Android
     */
    handleAndroidBack: function (event) {
      if (App.activeModal) {
        App.closeModal(App.activeModal);
        return;
      }

      if (App.currentScreen !== 'dashboard') {
        App.switchScreen('dashboard');
      }
    },

    pushStateForModal: function () {
      if (window.history && window.history.pushState) {
        window.history.pushState({ modalOpen: true }, '');
      }
    },

    /**
     * Alterna a visibilidade dos valores monetários para privacidade
     */
    toggleValuesVisibility: function () {
      App.valuesVisible = !App.valuesVisible;
      var eyeBtn = document.getElementById('btn_toggle_visibility');
      if (eyeBtn) {
        eyeBtn.textContent = App.valuesVisible ? '👁️' : '🙈';
      }
      App.renderDashboard();
    },

    /**
     * Alterna entre as 5 abas principais e telas auxiliares
     */
    switchScreen: function (screenId) {
      App.currentScreen = screenId;

      var views = document.querySelectorAll('.screen-view');
      views.forEach(function (v) { v.classList.remove('active'); });

      var targetView = document.getElementById('screen_' + screenId);
      if (targetView) targetView.classList.add('active');

      // Atualizar Bottom Navigation
      var navButtons = document.querySelectorAll('.bottom-nav .nav-item');
      navButtons.forEach(function (btn) {
        if (btn.dataset.screen === screenId) btn.classList.add('active');
        else btn.classList.remove('active');
      });

      // Título no Header
      var titleMap = {
        dashboard: 'GranaFlow',
        events: 'Receitas & Eventos',
        expenses: 'Despesas & Contas',
        calendar: 'Agenda & Lembretes',
        investments: 'Investimentos',
        reports: 'Relatórios Financeiros',
        backup: 'Meus Backups',
        settings: 'Configurações'
      };
      var headerTitle = document.getElementById('header_title');
      if (headerTitle) headerTitle.textContent = titleMap[screenId] || 'GranaFlow';

      // Atualizações sob demanda
      if (screenId === 'dashboard') App.renderDashboard();
      else if (screenId === 'events') window.EventsModule.init();
      else if (screenId === 'expenses') window.ExpensesModule.init();
      else if (screenId === 'calendar') window.CalendarModule.init();
      else if (screenId === 'investments') window.InvestmentsModule.init();
      else if (screenId === 'reports') window.ReportsModule.renderReports();
      else if (screenId === 'backup') window.BackupModule.init();

      window.scrollTo(0, 0);
    },

    /**
     * Atualiza os dados de todos os painéis e cálculos
     */
    refreshAll: function () {
      App.renderDashboard();
      App.renderGoalsList();
      window.CalendarModule.renderUpcomingReminders();
    },

    /**
     * Renderiza o Dashboard Principal (Tela Inicial)
     */
    renderDashboard: function () {
      Promise.all([
        window.AppDB.getAll('events'),
        window.AppDB.getAll('expenses'),
        window.AppDB.getAll('goals'),
        window.AppDB.getAll('investments')
      ]).then(function (results) {
        var events = results[0] || [];
        var expenses = results[1] || [];
        var goals = results[2] || [];
        var investments = results[3] || [];

        var balances = window.AppFinance.computeFullBalances({
          events: events,
          expenses: expenses,
          goals: goals,
          investments: investments
        });

        function formatVal(cents) {
          if (!App.valuesVisible) return '••••••';
          return window.AppFinance.formatBRL(cents);
        }

        // 1. Saldo em Conta
        var elSaldo = document.getElementById('dash_account_balance');
        if (elSaldo) elSaldo.textContent = formatVal(balances.saldoEmContaCents);

        // 2. Card Destacado: "Quanto Posso Gastar?"
        var elDisponivel = document.getElementById('dash_safe_spend_amount');
        if (elDisponivel) {
          elDisponivel.textContent = formatVal(balances.disponivelParaGastarCents);
          if (balances.disponivelParaGastarCents < 0) {
            elDisponivel.style.color = 'var(--danger)';
          } else {
            elDisponivel.style.color = '#FFFFFF';
          }
        }

        // 3. Grid de Métricas
        var elRecMes = document.getElementById('dash_received_month');
        var elPenMes = document.getElementById('dash_pending_month');
        var elDesPagasMes = document.getElementById('dash_expenses_paid_month');
        var elDesPendMes = document.getElementById('dash_expenses_pending_month');
        var elResMetas = document.getElementById('dash_goals_reserved');
        var elTotalInv = document.getElementById('dash_total_invested');
        var elPatrimonio = document.getElementById('dash_net_worth');

        if (elRecMes) elRecMes.textContent = formatVal(balances.totalRecebidoMesAtualCents);
        if (elPenMes) elPenMes.textContent = formatVal(balances.totalPendenteMesAtualCents);
        if (elDesPagasMes) elDesPagasMes.textContent = formatVal(balances.totalDespesasPagasMesCents);
        if (elDesPendMes) elDesPendMes.textContent = formatVal(balances.totalDespesasPendentesMesCents);
        if (elResMetas) elResMetas.textContent = formatVal(balances.totalReservadoMetasCents);
        if (elTotalInv) elTotalInv.textContent = formatVal(balances.totalInvestidoCents);
        if (elPatrimonio) elPatrimonio.textContent = formatVal(balances.patrimonioTotalCents);

        // 4. Próximas Contas a Vencer
        App.renderUpcomingExpensesWidget(expenses);

        // 5. Gráfico Dashboard
        App.drawDashboardChart(balances);
      });
    },

    /**
     * Renderiza o widget de próximas contas a vencer na tela inicial
     */
    renderUpcomingExpensesWidget: function (expenses) {
      var container = document.getElementById('dash_upcoming_expenses_list');
      if (!container) return;

      var pending = expenses.filter(function (e) { return e.status === 'pending'; });
      pending.sort(function (a, b) { return new Date(a.date || 0) - new Date(b.date || 0); });

      if (pending.length === 0) {
        container.innerHTML = '<div style="padding: 12px; font-size: 0.78rem; color: var(--text-muted); text-align: center;">Nenhuma conta pendente para os próximos dias! Parabéns.</div>';
        return;
      }

      var html = '';
      pending.slice(0, 3).forEach(function (exp) {
        var dateFormatted = exp.date ? exp.date.split('-').reverse().join('/') : '-';
        html += '<div class="item-row" style="margin-bottom: 6px; padding: 10px 12px;">' +
          '<div class="item-main">' +
            '<div class="item-icon-box" style="background: rgba(239, 68, 68, 0.12); color: #EF4444; width: 32px; height: 32px; font-size: 0.85rem;">💳</div>' +
            '<div class="item-info">' +
              '<span class="item-title" style="font-size: 0.84rem;">' + exp.name + '</span>' +
              '<span class="item-subtitle">Vence em: ' + dateFormatted + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="item-actions">' +
            '<span class="item-value text-danger" style="font-size: 0.88rem;">' + window.AppFinance.formatBRL(exp.amount) + '</span>' +
            '<button type="button" class="btn btn-sm btn-primary" onclick="window.ExpensesModule.toggleExpenseStatus(' + exp.id + ')" style="padding: 4px 8px; font-size: 0.7rem; min-height: 28px;">Pagar</button>' +
          '</div>' +
        '</div>';
      });

      container.innerHTML = html;
    },

    /**
     * Desenha gráfico visual no Dashboard
     */
    drawDashboardChart: function (balances) {
      var canvas = document.getElementById('dash_overview_chart');
      if (!canvas) return;

      var ctx = canvas.getContext('2d');
      var width = canvas.width = canvas.parentElement.clientWidth || 320;
      var height = canvas.height = 130;

      ctx.clearRect(0, 0, width, height);

      // Barras comparativas simples
      var items = [
        { label: 'Recebido', val: balances.totalRecebidoMesAtualCents, color: '#10B981' },
        { label: 'Despesas', val: balances.totalDespesasPagasMesCents, color: '#EF4444' },
        { label: 'Metas', val: balances.totalReservadoMetasCents, color: '#6366F1' },
        { label: 'Investido', val: balances.totalInvestidoCents, color: '#0EA5E9' }
      ];

      var max = Math.max.apply(null, items.map(function (i) { return i.val; }));
      if (max <= 0) max = 10000;

      var barW = (width - 40) / items.length - 12;

      items.forEach(function (it, idx) {
        var x = 20 + idx * (barW + 12);
        var barH = Math.max(4, (it.val / max) * (height - 45));
        var y = height - 25 - barH;

        ctx.fillStyle = it.color;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]) : ctx.fillRect(x, y, barW, barH);
        ctx.fill();

        ctx.fillStyle = '#94A3B8';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(it.label, x + barW / 2, height - 8);
      });
    },

    /**
     * SISTEMA DE METAS FINANCEIRAS
     */
    renderGoalsList: function () {
      var container = document.getElementById('dash_goals_container');
      if (!container) return;

      window.AppDB.getAll('goals').then(function (goals) {
        if (!goals || goals.length === 0) {
          container.innerHTML = '<div style="text-align:center; padding:16px; color:var(--text-muted); font-size:0.8rem;">Nenhuma meta cadastrada. Defina objetivos como comprar um celular ou viagem!</div>';
          return;
        }

        var html = '';
        goals.forEach(function (g) {
          var target = parseInt(g.targetAmount, 10) || 0;
          var saved = parseInt(g.savedAmount, 10) || 0;
          var pct = Math.min(100, target > 0 ? (saved / target) * 100 : 0).toFixed(1);
          var plan = window.AppFinance.calculateGoalSavingsPlan(target, saved, g.deadline);

          html += '<div class="goal-card">' +
            '<div class="goal-card-header">' +
              '<div>' +
                '<div class="goal-name">' + g.name + '</div>' +
                '<div class="goal-deadline">Prazo: ' + (g.deadline ? g.deadline.split('-').reverse().join('/') : 'Livre') + '</div>' +
              '</div>' +
              '<span class="text-success font-bold" style="font-size:0.92rem;">' + pct + '%</span>' +
            '</div>' +
            '<div class="goal-progress-bar-bg">' +
              '<div class="goal-progress-bar-fill" style="width: ' + pct + '%;"></div>' +
            '</div>' +
            '<div class="goal-values-row">' +
              '<span>Guardado: ' + window.AppFinance.formatBRL(saved) + '</span>' +
              '<span>Alvo: ' + window.AppFinance.formatBRL(target) + '</span>' +
            '</div>';

          if (plan.remainingCents > 0 && plan.weeksRemaining > 0) {
            html += '<div style="margin-top: 8px; font-size: 0.72rem; color: var(--text-muted); background: rgba(0,0,0,0.2); padding: 6px 8px; border-radius: 6px;">' +
              'Sugestão: Guardar <strong>' + window.AppFinance.formatBRL(plan.perWeekCents) + '</strong> por semana ou <strong>' + window.AppFinance.formatBRL(plan.perMonthCents) + '</strong> por mês.' +
            '</div>';
          }

          html += '<div style="display: flex; gap: 8px; margin-top: 10px;">' +
              '<button type="button" class="btn btn-sm btn-primary" style="flex: 1;" onclick="App.openDepositGoalModal(' + g.id + ')">💰 Guardar Dinheiro</button>' +
              '<button type="button" class="btn btn-sm btn-outline" onclick="App.openWithdrawGoalModal(' + g.id + ')">Resgatar</button>' +
              '<button type="button" class="btn-icon-header" style="width: 32px; height: 32px;" onclick="App.deleteGoal(' + g.id + ')">🗑️</button>' +
            '</div>' +
          '</div>';
        });

        container.innerHTML = html;
      });
    },

    saveGoal: function (goalData) {
      return window.AppDB.add('goals', goalData).then(function () {
        App.showToast('Meta criada com sucesso!', 'success');
        App.closeModal('modal_new_goal');
        App.refreshAll();
      });
    },

    deleteGoal: function (id) {
      if (!confirm('Deseja excluir esta meta financeira? O dinheiro economizado retornará ao saldo disponível.')) return;
      window.AppDB.delete('goals', id).then(function () {
        App.showToast('Meta excluída.', 'info');
        App.refreshAll();
      });
    },

    openDepositGoalModal: function (goalId) {
      window.AppDB.getById('goals', goalId).then(function (g) {
        if (!g) return;
        var amountStr = prompt('Quanto deseja guardar na meta "' + g.name + '"? (Ex: 100,00)');
        if (!amountStr) return;
        var depositCents = window.AppFinance.toCents(amountStr);
        if (depositCents <= 0) return;

        // Verificar se há saldo livre suficiente
        Promise.all([
          window.AppDB.getAll('events'),
          window.AppDB.getAll('expenses'),
          window.AppDB.getAll('goals'),
          window.AppDB.getAll('investments')
        ]).then(function (results) {
          var balances = window.AppFinance.computeFullBalances({
            events: results[0],
            expenses: results[1],
            goals: results[2],
            investments: results[3]
          });

          if (depositCents > balances.saldoEmContaCents) {
            alert('Saldo insuficiente na conta para reservar este valor!\nSaldo atual: ' + window.AppFinance.formatBRL(balances.saldoEmContaCents));
            return;
          }

          g.savedAmount = (parseInt(g.savedAmount, 10) || 0) + depositCents;
          return window.AppDB.update('goals', g).then(function () {
            App.showToast('Dinheiro reservado na meta com sucesso!', 'success');
            App.refreshAll();
          });
        });
      });
    },

    openWithdrawGoalModal: function (goalId) {
      window.AppDB.getById('goals', goalId).then(function (g) {
        if (!g) return;
        var current = parseInt(g.savedAmount, 10) || 0;
        if (current <= 0) {
          alert('Esta meta não possui dinheiro guardado para resgatar.');
          return;
        }

        var amountStr = prompt('Quanto deseja resgatar da meta "' + g.name + '" de volta para a conta? (Disponível: ' + window.AppFinance.formatBRL(current) + ')');
        if (!amountStr) return;
        var withdrawCents = window.AppFinance.toCents(amountStr);
        if (withdrawCents <= 0 || withdrawCents > current) {
          alert('Valor inválido ou maior que o valor economizado na meta!');
          return;
        }

        g.savedAmount = current - withdrawCents;
        return window.AppDB.update('goals', g).then(function () {
          App.showToast('Dinheiro resgatado com sucesso de volta para a conta!', 'success');
          App.refreshAll();
        });
      });
    },

    /**
     * MODAIS & CONTROLES
     */
    openModal: function (modalId) {
      var modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.add('active');
        App.activeModal = modalId;
        App.pushStateForModal();
      }
    },

    closeModal: function (modalId) {
      var modal = document.getElementById(modalId || App.activeModal);
      if (modal) {
        modal.classList.remove('active');
        App.activeModal = null;
      }
    },

    showToast: function (msg, type) {
      var container = document.getElementById('app_toast_container');
      if (!container) return;

      var toast = document.createElement('div');
      toast.className = 'toast ' + (type || 'info');
      toast.textContent = msg;

      container.appendChild(toast);
      setTimeout(function () {
        if (toast.parentElement) toast.parentElement.removeChild(toast);
      }, 3200);
    },

    /**
     * SEGURANÇA POR PIN
     */
    enteredPin: '',
    checkSecurityPin: function () {
      return Promise.all([
        window.AppDB.getSetting('pinEnabled', false),
        window.AppDB.getSetting('appPin', null)
      ]).then(function (results) {
        var enabled = results[0];
        var pin = results[1];

        if (!enabled || !pin) {
          return true; // Sem bloqueio por PIN
        }

        var overlay = document.getElementById('pin_lock_screen');
        if (overlay) overlay.style.display = 'flex';
        App.enteredPin = '';
        App.updatePinDots();
        return false; // Aguardar digitação
      });
    },

    handlePinInput: function (digit) {
      if (App.enteredPin.length < 4) {
        App.enteredPin += digit;
        App.updatePinDots();
      }

      if (App.enteredPin.length === 4) {
        window.AppDB.getSetting('appPin', null).then(function (savedPin) {
          if (App.enteredPin === String(savedPin)) {
            var overlay = document.getElementById('pin_lock_screen');
            if (overlay) overlay.style.display = 'none';
            App.refreshAll();
          } else {
            alert('PIN incorreto!');
            App.enteredPin = '';
            App.updatePinDots();
          }
        });
      }
    },

    handlePinBackspace: function () {
      if (App.enteredPin.length > 0) {
        App.enteredPin = App.enteredPin.slice(0, -1);
        App.updatePinDots();
      }
    },

    updatePinDots: function () {
      for (var i = 1; i <= 4; i++) {
        var dot = document.getElementById('pin_dot_' + i);
        if (dot) {
          if (i <= App.enteredPin.length) dot.classList.add('filled');
          else dot.classList.remove('filled');
        }
      }
    },

    /**
     * EVENT LISTENERS GERAIS
     */
    bindUIEvents: function () {
      // Navegação Bottom Nav
      var navBtns = document.querySelectorAll('.bottom-nav .nav-item');
      navBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var screen = btn.dataset.screen;
          App.switchScreen(screen);
        });
      });

      // Configurar formulário de novo evento
      var eventForm = document.getElementById('form_new_event');
      if (eventForm) {
        eventForm.addEventListener('submit', function (e) {
          e.preventDefault();
          var type = document.getElementById('event_form_type').value;
          var qty = parseInt(document.getElementById('event_form_qty').value, 10) || 1;
          var unitVal = (type === 'normal') ? window.EventsModule.unitValues.normalCents :
                        (type === 'solo' ? window.EventsModule.unitValues.soloCents :
                        window.AppFinance.toCents(document.getElementById('event_form_custom_val').value));

          var evData = {
            name: document.getElementById('event_form_name').value || (type === 'solo' ? 'Festa Solo' : 'Festa Normal'),
            date: document.getElementById('event_form_date').value,
            type: type,
            quantity: qty,
            unitValue: unitVal,
            totalValue: qty * unitVal,
            status: document.getElementById('event_form_status').value,
            notes: document.getElementById('event_form_notes').value
          };

          window.EventsModule.saveSingleEvent(evData).then(function () {
            App.closeModal('modal_new_event');
            eventForm.reset();
          });
        });
      }

      // Configurar formulário de nova despesa
      var expenseForm = document.getElementById('form_new_expense');
      if (expenseForm) {
        expenseForm.addEventListener('submit', function (e) {
          e.preventDefault();
          var expData = {
            name: document.getElementById('expense_form_name').value,
            amount: window.AppFinance.toCents(document.getElementById('expense_form_amount').value),
            date: document.getElementById('expense_form_date').value,
            category: document.getElementById('expense_category_select').value,
            paymentMethod: document.getElementById('expense_form_payment').value,
            type: document.getElementById('expense_form_type').value,
            status: document.getElementById('expense_form_status').value,
            notes: document.getElementById('expense_form_notes').value
          };

          window.ExpensesModule.saveExpense(expData).then(function () {
            App.closeModal('modal_new_expense');
            expenseForm.reset();
          });
        });
      }

      // Configurar formulário de nova despesa fixa
      var fixedForm = document.getElementById('form_new_fixed_expense');
      if (fixedForm) {
        fixedForm.addEventListener('submit', function (e) {
          e.preventDefault();
          var fixedData = {
            name: document.getElementById('fixed_expense_name').value,
            amount: window.AppFinance.toCents(document.getElementById('fixed_expense_amount').value),
            dueDay: parseInt(document.getElementById('fixed_expense_due_day').value, 10) || 10,
            category: document.getElementById('fixed_expense_category_select').value,
            frequency: 'Mensal',
            status: 'active'
          };

          window.ExpensesModule.saveFixedExpense(fixedData).then(function () {
            App.closeModal('modal_new_fixed_expense');
            fixedForm.reset();
          });
        });
      }

      // Configurar formulário de nova tarefa na agenda
      var taskForm = document.getElementById('form_new_task');
      if (taskForm) {
        taskForm.addEventListener('submit', function (e) {
          e.preventDefault();
          var taskData = {
            title: document.getElementById('task_form_title').value,
            description: document.getElementById('task_form_desc').value,
            date: document.getElementById('task_form_date').value,
            time: document.getElementById('task_form_time').value,
            category: document.getElementById('task_form_category').value,
            priority: document.getElementById('task_form_priority').value,
            reminder: document.getElementById('task_form_reminder').value === 'yes',
            status: 'pending'
          };

          window.CalendarModule.saveTask(taskData).then(function () {
            App.closeModal('modal_new_task');
            taskForm.reset();
          });
        });
      }

      // Configurar formulário de nova meta
      var goalForm = document.getElementById('form_new_goal');
      if (goalForm) {
        goalForm.addEventListener('submit', function (e) {
          e.preventDefault();
          var goalData = {
            name: document.getElementById('goal_form_name').value,
            targetAmount: window.AppFinance.toCents(document.getElementById('goal_form_target').value),
            savedAmount: window.AppFinance.toCents(document.getElementById('goal_form_saved').value || '0'),
            deadline: document.getElementById('goal_form_deadline').value,
            priority: document.getElementById('goal_form_priority').value,
            description: document.getElementById('goal_form_desc').value
          };

          App.saveGoal(goalData);
          goalForm.reset();
        });
      }

      // Configurar formulário de novo investimento
      var invForm = document.getElementById('form_new_investment');
      if (invForm) {
        invForm.addEventListener('submit', function (e) {
          e.preventDefault();
          var applied = window.AppFinance.toCents(document.getElementById('inv_form_amount').value);
          var invData = {
            name: document.getElementById('inv_form_name').value,
            institution: document.getElementById('inv_form_institution').value,
            appliedAmount: applied,
            currentAmount: applied,
            date: document.getElementById('inv_form_date').value,
            yieldRate: document.getElementById('inv_form_yield').value,
            liquidity: document.getElementById('inv_form_liquidity').value,
            notes: document.getElementById('inv_form_notes').value
          };

          window.InvestmentsModule.saveInvestment(invData).then(function () {
            App.closeModal('modal_new_investment');
            invForm.reset();
          });
        });
      }

      // Configurar inputs de data com a data de hoje por padrão
      var todayStr = new Date().toISOString().split('T')[0];
      var dateInputs = ['event_form_date', 'expense_form_date', 'task_form_date', 'inv_form_date', 'week_picker_date'];
      dateInputs.forEach(function (id) {
        var el = document.getElementById(id);
        if (el && !el.value) el.value = todayStr;
      });
    }
  };

  window.App = App;

  // Iniciar assim que o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', App.init);
  } else {
    App.init();
  }
})(window);
