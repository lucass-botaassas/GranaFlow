/**
 * ==========================================================================
 * GRANAFLOW — AGENDA, CALENDÁRIO E LEMBRETES (calendar.js)
 * Calendário Mensal, Semanal e Diário com Lembretes Integrados
 * ==========================================================================
 */

(function (window) {
  'use strict';

  var CalendarModule = {
    viewMode: 'month', // 'month', 'week', 'day'
    currentDate: new Date(),
    selectedDate: new Date(),

    init: function () {
      CalendarModule.renderCalendar();
      CalendarModule.renderUpcomingReminders();
      CalendarModule.renderSelectedDayTasks();
    },

    setToday: function () {
      CalendarModule.currentDate = new Date();
      CalendarModule.selectedDate = new Date();
      CalendarModule.renderCalendar();
      CalendarModule.renderSelectedDayTasks();
    },

    changeMonth: function (delta) {
      CalendarModule.currentDate.setMonth(CalendarModule.currentDate.getMonth() + delta);
      CalendarModule.renderCalendar();
    },

    selectDate: function (year, month, day) {
      CalendarModule.selectedDate = new Date(year, month, day);
      CalendarModule.renderCalendar();
      CalendarModule.renderSelectedDayTasks();

      // Atualiza o input de data no formulário de tarefa rápida
      var input = document.getElementById('task_form_date');
      if (input) {
        var mStr = (month + 1 < 10 ? '0' : '') + (month + 1);
        var dStr = (day < 10 ? '0' : '') + day;
        input.value = year + '-' + mStr + '-' + dStr;
      }
    },

    /**
     * Renderiza o calendário mensal com indicadores dos dias
     */
    renderCalendar: function () {
      var grid = document.getElementById('calendar_days_grid');
      var titleEl = document.getElementById('calendar_current_month_title');
      if (!grid) return;

      var year = CalendarModule.currentDate.getFullYear();
      var month = CalendarModule.currentDate.getMonth();

      var monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];

      if (titleEl) {
        titleEl.textContent = monthNames[month] + ' de ' + year;
      }

      var firstDayIndex = new Date(year, month, 1).getDay(); // 0 (Domingo) a 6 (Sábado)
      var totalDays = new Date(year, month + 1, 0).getDate();
      var prevMonthDays = new Date(year, month, 0).getDate();

      var today = new Date();
      var isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

      // Buscar todos os eventos, despesas e tarefas para mapear nos dias do calendário
      Promise.all([
        window.AppDB.getAll('tasks'),
        window.AppDB.getAll('expenses'),
        window.AppDB.getAll('events')
      ]).then(function (results) {
        var tasks = results[0] || [];
        var expenses = results[1] || [];
        var events = results[2] || [];

        // Mapear dias com itens
        var activityMap = {};

        function addActivity(dateStr, type) {
          if (!dateStr) return;
          if (!activityMap[dateStr]) activityMap[dateStr] = {};
          activityMap[dateStr][type] = true;
        }

        tasks.forEach(function (t) { if (t.status !== 'completed') addActivity(t.date, 'task'); });
        expenses.forEach(function (e) { if (e.status !== 'paid') addActivity(e.date, 'expense'); });
        events.forEach(function (ev) { if (ev.status !== 'received') addActivity(ev.date, 'event'); });

        var html = '';

        // Dias do mês anterior
        for (var i = firstDayIndex - 1; i >= 0; i--) {
          var dNum = prevMonthDays - i;
          html += '<div class="calendar-day-cell other-month">' + dNum + '</div>';
        }

        // Dias do mês atual
        for (var day = 1; day <= totalDays; day++) {
          var dateKey = year + '-' + (month + 1 < 10 ? '0' : '') + (month + 1) + '-' + (day < 10 ? '0' : '') + day;
          var isToday = isCurrentMonth && today.getDate() === day;
          var isSelected = CalendarModule.selectedDate.getFullYear() === year &&
                           CalendarModule.selectedDate.getMonth() === month &&
                           CalendarModule.selectedDate.getDate() === day;

          var cellClasses = 'calendar-day-cell';
          if (isToday) cellClasses += ' today';
          if (isSelected) cellClasses += ' selected';

          var dotsHtml = '<div class="day-event-dots">';
          if (activityMap[dateKey]) {
            if (activityMap[dateKey].expense) dotsHtml += '<span class="dot-indicator dot-expense"></span>';
            if (activityMap[dateKey].event) dotsHtml += '<span class="dot-indicator dot-event"></span>';
            if (activityMap[dateKey].task) dotsHtml += '<span class="dot-indicator dot-task"></span>';
          }
          dotsHtml += '</div>';

          html += '<div class="' + cellClasses + '" onclick="CalendarModule.selectDate(' + year + ', ' + month + ', ' + day + ')">' +
            '<span>' + day + '</span>' +
            dotsHtml +
          '</div>';
        }

        // Preencher o restante da grade para fechar 35 ou 42 células
        var totalCells = firstDayIndex + totalDays;
        var nextDays = (totalCells % 7 === 0) ? 0 : 7 - (totalCells % 7);
        for (var j = 1; j <= nextDays; j++) {
          html += '<div class="calendar-day-cell other-month">' + j + '</div>';
        }

        grid.innerHTML = html;
      });
    },

    /**
     * Renderiza as tarefas e compromissos do dia selecionado
     */
    renderSelectedDayTasks: function () {
      var container = document.getElementById('selected_day_tasks_list');
      var dateHeader = document.getElementById('selected_day_title');
      if (!container) return;

      var y = CalendarModule.selectedDate.getFullYear();
      var m = CalendarModule.selectedDate.getMonth() + 1;
      var d = CalendarModule.selectedDate.getDate();
      var dateStr = y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;

      if (dateHeader) {
        dateHeader.textContent = 'Atividades para ' + (d < 10 ? '0' : '') + d + '/' + (m < 10 ? '0' : '') + m + '/' + y;
      }

      Promise.all([
        window.AppDB.getAll('tasks'),
        window.AppDB.getAll('expenses'),
        window.AppDB.getAll('events')
      ]).then(function (results) {
        var dayTasks = (results[0] || []).filter(function (t) { return t.date === dateStr; });
        var dayExpenses = (results[1] || []).filter(function (e) { return e.date === dateStr; });
        var dayEvents = (results[2] || []).filter(function (ev) { return ev.date === dateStr; });

        if (dayTasks.length === 0 && dayExpenses.length === 0 && dayEvents.length === 0) {
          container.innerHTML = '<div style="text-align: center; padding: 18px; color: var(--text-muted); font-size: 0.8rem;">Nenhum compromisso ou vencimento neste dia.</div>';
          return;
        }

        var html = '';

        // Contas a vencer
        dayExpenses.forEach(function (exp) {
          var isPaid = exp.status === 'paid';
          html += '<div class="item-row" style="border-left: 3px solid #EF4444;">' +
            '<div class="item-main">' +
              '<div class="item-icon-box" style="background: rgba(239, 68, 68, 0.15); color: #EF4444;">💳</div>' +
              '<div class="item-info">' +
                '<span class="item-title">' + exp.name + ' (Conta a Pagar)</span>' +
                '<span class="item-subtitle">' + exp.category + ' • ' + (isPaid ? 'Paga' : 'Vencimento hoje') + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="item-value text-danger">' + window.AppFinance.formatBRL(exp.amount) + '</div>' +
          '</div>';
        });

        // Eventos
        dayEvents.forEach(function (ev) {
          html += '<div class="item-row" style="border-left: 3px solid #10B981;">' +
            '<div class="item-main">' +
              '<div class="item-icon-box" style="background: rgba(16, 185, 129, 0.15); color: #10B981;">🎤</div>' +
              '<div class="item-info">' +
                '<span class="item-title">' + ev.name + '</span>' +
                '<span class="item-subtitle">' + ev.quantity + 'x ' + ev.type + ' • ' + (ev.status === 'received' ? 'Recebido' : 'A receber') + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="item-value text-success">' + window.AppFinance.formatBRL(ev.totalValue) + '</div>' +
          '</div>';
        });

        // Tarefas
        dayTasks.forEach(function (t) {
          var isDone = t.status === 'completed';
          var priorityBadge = t.priority === 'high' ? '🔴 Alta' : (t.priority === 'medium' ? '🟡 Média' : '🟢 Baixa');

          html += '<div class="item-row" style="border-left: 3px solid #38BDF8; opacity: ' + (isDone ? '0.6' : '1') + ';">' +
            '<div class="item-main">' +
              '<button type="button" onclick="CalendarModule.toggleTaskStatus(' + t.id + ')" style="background:none; border:none; cursor:pointer; font-size: 1.2rem; padding: 4px;">' +
                (isDone ? '✅' : '⭕') +
              '</button>' +
              '<div class="item-info">' +
                '<span class="item-title" style="' + (isDone ? 'text-decoration: line-through;' : '') + '">' + t.title + '</span>' +
                '<span class="item-subtitle">' + (t.time || 'Dia todo') + ' • ' + t.category + ' • ' + priorityBadge + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="item-actions">' +
              '<button type="button" class="btn-icon-header" style="width: 30px; height: 30px;" onclick="CalendarModule.deleteTask(' + t.id + ')">🗑️</button>' +
            '</div>' +
          '</div>';
        });

        container.innerHTML = html;
      });
    },

    /**
     * Salva uma tarefa
     */
    saveTask: function (taskData) {
      var isUpdate = !!taskData.id;
      var operation = isUpdate ? window.AppDB.update('tasks', taskData) : window.AppDB.add('tasks', taskData);

      return operation.then(function () {
        if (window.App) {
          window.App.showToast('Compromisso salvo na agenda!', 'success');
        }
        CalendarModule.renderCalendar();
        CalendarModule.renderSelectedDayTasks();
        CalendarModule.renderUpcomingReminders();
      });
    },

    toggleTaskStatus: function (id) {
      window.AppDB.getById('tasks', id).then(function (t) {
        if (!t) return;
        t.status = (t.status === 'completed') ? 'pending' : 'completed';
        return window.AppDB.update('tasks', t);
      }).then(function () {
        CalendarModule.renderCalendar();
        CalendarModule.renderSelectedDayTasks();
      });
    },

    deleteTask: function (id) {
      if (!confirm('Deseja excluir esta tarefa?')) return;
      window.AppDB.delete('tasks', id).then(function () {
        CalendarModule.renderCalendar();
        CalendarModule.renderSelectedDayTasks();
        CalendarModule.renderUpcomingReminders();
      });
    },

    /**
     * Renderiza o card de Lembretes do Sistema (contas vencendo, fechar semana, etc.)
     */
    renderUpcomingReminders: function () {
      var container = document.getElementById('reminders_widget_container');
      var badgeDot = document.getElementById('header_notification_badge');
      if (!container) return;

      var todayStr = new Date().toISOString().split('T')[0];

      Promise.all([
        window.AppDB.getAll('expenses'),
        window.AppDB.getAll('events'),
        window.AppDB.getAll('tasks'),
        window.AppDB.getAll('weekly_closures')
      ]).then(function (results) {
        var expenses = results[0] || [];
        var events = results[1] || [];
        var tasks = results[2] || [];
        var closures = results[3] || [];

        var alerts = [];

        // 1. Contas a pagar pendentes
        expenses.forEach(function (exp) {
          if (exp.status === 'pending' && exp.date && exp.date <= todayStr) {
            alerts.push({
              icon: '🚨',
              title: 'Conta vencendo / vencida: ' + exp.name,
              detail: window.AppFinance.formatBRL(exp.amount) + ' (Vencimento: ' + exp.date.split('-').reverse().join('/') + ')',
              actionTab: 'expenses'
            });
          }
        });

        // 2. Fechamentos semanais pendentes de recebimento
        closures.forEach(function (c) {
          if (c.status === 'pending') {
            alerts.push({
              icon: '💵',
              title: 'Fechamento semanal a receber',
              detail: window.AppFinance.formatBRL(c.totalAmount) + ' (' + c.totalEvents + ' festas realizadas)',
              actionTab: 'events'
            });
          }
        });

        // 3. Tarefas de hoje
        tasks.forEach(function (t) {
          if (t.status !== 'completed' && t.date === todayStr) {
            alerts.push({
              icon: '⏰',
              title: 'Compromisso hoje: ' + t.title,
              detail: (t.time || 'Horário flexível') + ' • ' + t.category,
              actionTab: 'calendar'
            });
          }
        });

        // Atualizar badge do header
        if (badgeDot) {
          if (alerts.length > 0) {
            badgeDot.classList.add('active');
          } else {
            badgeDot.classList.remove('active');
          }
        }

        if (alerts.length === 0) {
          container.innerHTML = '<div style="padding: 12px; font-size: 0.78rem; color: var(--text-muted); text-align: center;">Tudo em dia! Sem pendências urgentes para hoje.</div>';
          return;
        }

        var html = '';
        alerts.slice(0, 4).forEach(function (a) {
          html += '<div class="item-row" style="margin-bottom: 6px; padding: 8px 12px; background: rgba(24, 34, 54, 0.7);">' +
            '<div style="font-size: 1.1rem; margin-right: 10px;">' + a.icon + '</div>' +
            '<div style="flex: 1; min-width: 0;">' +
              '<div style="font-size: 0.82rem; font-weight: 600; color: #FFFFFF;">' + a.title + '</div>' +
              '<div style="font-size: 0.72rem; color: var(--text-muted);">' + a.detail + '</div>' +
            '</div>' +
          '</div>';
        });

        container.innerHTML = html;
      });
    }
  };

  window.CalendarModule = CalendarModule;
})(window);
