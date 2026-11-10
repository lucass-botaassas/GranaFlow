/**
 * ==========================================================================
 * GRANAFLOW — SISTEMA DE RECEITAS E EVENTOS (events.js)
 * Gestão de festas normais, solo, personalizadas e Fechamento Semanal
 * ==========================================================================
 */

(function (window) {
  'use strict';

  var EventsModule = {
    currentWeekData: {
      monday: { normal: 0, solo: 0 },
      tuesday: { normal: 0, solo: 0 },
      wednesday: { normal: 0, solo: 0 },
      thursday: { normal: 0, solo: 0 },
      friday: { normal: 0, solo: 0 },
      saturday: { normal: 0, solo: 0 },
      sunday: { normal: 0, solo: 0 }
    },

    unitValues: {
      normalCents: 10000,
      soloCents: 15000
    },

    init: function () {
      return EventsModule.loadUnitValues().then(function () {
        EventsModule.renderWeeklyBuilder();
        EventsModule.renderEventsList();
        EventsModule.renderClosuresHistory();
      });
    },

    loadUnitValues: function () {
      return Promise.all([
        window.AppDB.getSetting('normalEventValue', 10000),
        window.AppDB.getSetting('soloEventValue', 15000)
      ]).then(function (results) {
        EventsModule.unitValues.normalCents = parseInt(results[0], 10) || 10000;
        EventsModule.unitValues.soloCents = parseInt(results[1], 10) || 15000;
      });
    },

    saveUnitValues: function (newNormalCents, newSoloCents) {
      EventsModule.unitValues.normalCents = parseInt(newNormalCents, 10);
      EventsModule.unitValues.soloCents = parseInt(newSoloCents, 10);
      return Promise.all([
        window.AppDB.setSetting('normalEventValue', EventsModule.unitValues.normalCents),
        window.AppDB.setSetting('soloEventValue', EventsModule.unitValues.soloCents)
      ]).then(function () {
        EventsModule.updateWeeklyCalculations();
        if (window.App) window.App.showToast('Valores de festas atualizados!', 'success');
      });
    },

    /**
     * Ajusta contador de festas no fechamento semanal (+1 ou -1)
     */
    adjustDayCount: function (dayKey, type, delta) {
      if (!EventsModule.currentWeekData[dayKey]) return;
      var cur = EventsModule.currentWeekData[dayKey][type] || 0;
      var updated = Math.max(0, cur + delta);
      EventsModule.currentWeekData[dayKey][type] = updated;

      var span = document.getElementById('cnt_' + dayKey + '_' + type);
      if (span) span.textContent = updated;

      EventsModule.updateWeeklyCalculations();
    },

    /**
     * Zera os contadores da semana atual
     */
    resetWeeklyBuilder: function () {
      Object.keys(EventsModule.currentWeekData).forEach(function (dayKey) {
        EventsModule.currentWeekData[dayKey].normal = 0;
        EventsModule.currentWeekData[dayKey].solo = 0;
        var spanN = document.getElementById('cnt_' + dayKey + '_normal');
        var spanS = document.getElementById('cnt_' + dayKey + '_solo');
        if (spanN) spanN.textContent = '0';
        if (spanS) spanS.textContent = '0';
      });
      EventsModule.updateWeeklyCalculations();
    },

    /**
     * Atualiza os totais na tela de Fechamento da Semana em tempo real
     */
    updateWeeklyCalculations: function () {
      var totalNormal = 0;
      var totalSolo = 0;

      Object.keys(EventsModule.currentWeekData).forEach(function (day) {
        totalNormal += EventsModule.currentWeekData[day].normal;
        totalSolo += EventsModule.currentWeekData[day].solo;
      });

      var calc = window.AppFinance.calculateWeeklyTotals(
        totalNormal,
        totalSolo,
        [],
        EventsModule.unitValues.normalCents,
        EventsModule.unitValues.soloCents
      );

      var elNormCount = document.getElementById('summary_normal_count');
      var elSoloCount = document.getElementById('summary_solo_count');
      var elTotalCount = document.getElementById('summary_total_count');
      var elTotalAmount = document.getElementById('summary_total_amount');

      if (elNormCount) elNormCount.textContent = calc.normalCount + ' (' + window.AppFinance.formatBRL(calc.normalTotalCents) + ')';
      if (elSoloCount) elSoloCount.textContent = calc.soloCount + ' (' + window.AppFinance.formatBRL(calc.soloTotalCents) + ')';
      if (elTotalCount) elTotalCount.textContent = calc.totalEventsCount + ' festas';
      if (elTotalAmount) elTotalAmount.textContent = window.AppFinance.formatBRL(calc.grandTotalCents);

      return calc;
    },

    /**
     * Renderiza o painel interativo de dias da semana
     */
    renderWeeklyBuilder: function () {
      var container = document.getElementById('weekly_builder_days');
      if (!container) return;

      var days = [
        { key: 'monday', label: 'Segunda-feira' },
        { key: 'tuesday', label: 'Terça-feira' },
        { key: 'wednesday', label: 'Quarta-feira' },
        { key: 'thursday', label: 'Quinta-feira' },
        { key: 'friday', label: 'Sexta-feira' },
        { key: 'saturday', label: 'Sábado' },
        { key: 'sunday', label: 'Domingo' }
      ];

      var html = '';
      days.forEach(function (d) {
        var nVal = EventsModule.currentWeekData[d.key].normal;
        var sVal = EventsModule.currentWeekData[d.key].solo;

        html += '<div class="day-row-builder">' +
          '<div class="day-label">' + d.label + '</div>' +
          '<div class="day-inputs-group">' +
            // Normal
            '<div style="text-align: center;">' +
              '<div style="font-size: 0.68rem; color: var(--text-muted); margin-bottom: 2px;">Normal</div>' +
              '<div class="counter-stepper">' +
                '<button type="button" class="stepper-btn" onclick="EventsModule.adjustDayCount(\'' + d.key + '\', \'normal\', -1)">-</button>' +
                '<span class="stepper-val" id="cnt_' + d.key + '_normal">' + nVal + '</span>' +
                '<button type="button" class="stepper-btn" onclick="EventsModule.adjustDayCount(\'' + d.key + '\', \'normal\', 1)">+</button>' +
              '</div>' +
            '</div>' +
            // Solo
            '<div style="text-align: center;">' +
              '<div style="font-size: 0.68rem; color: var(--text-muted); margin-bottom: 2px;">Solo</div>' +
              '<div class="counter-stepper">' +
                '<button type="button" class="stepper-btn" onclick="EventsModule.adjustDayCount(\'' + d.key + '\', \'solo\', -1)">-</button>' +
                '<span class="stepper-val" id="cnt_' + d.key + '_solo">' + sVal + '</span>' +
                '<button type="button" class="stepper-btn" onclick="EventsModule.adjustDayCount(\'' + d.key + '\', \'solo\', 1)">+</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      });

      container.innerHTML = html;
      EventsModule.updateWeeklyCalculations();
    },

    /**
     * Finaliza a semana gerando o fechamento (com status PENDENTE / A RECEBER)
     */
    finalizeWeek: function () {
      var calc = EventsModule.updateWeeklyCalculations();
      if (calc.totalEventsCount === 0) {
        if (window.App) window.App.showToast('Insira ao menos uma festa para fechar a semana!', 'error');
        return;
      }

      var weekInput = document.getElementById('week_picker_date');
      var refDateStr = (weekInput && weekInput.value) ? weekInput.value : new Date().toISOString().split('T')[0];

      var closureObj = {
        refDate: refDateStr,
        normalCount: calc.normalCount,
        soloCount: calc.soloCount,
        totalEvents: calc.totalEventsCount,
        totalAmount: calc.grandTotalCents,
        status: 'pending', // Regra: Finalizar a semana NÃO marca como recebido automaticamente
        dayDetails: JSON.parse(JSON.stringify(EventsModule.currentWeekData))
      };

      window.AppDB.add('weekly_closures', closureObj).then(function (closureId) {
        // Criar eventos individuais para cada dia com festas para aparecerem na agenda e histórico
        var daysMap = {
          monday: { name: 'Festas de Segunda', offset: 0 },
          tuesday: { name: 'Festas de Terça', offset: 1 },
          wednesday: { name: 'Festas de Quarta', offset: 2 },
          thursday: { name: 'Festas de Quinta', offset: 3 },
          friday: { name: 'Festas de Sexta', offset: 4 },
          saturday: { name: 'Festas de Sábado', offset: 5 },
          sunday: { name: 'Festas de Domingo', offset: 6 }
        };

        var addPromises = [];

        Object.keys(EventsModule.currentWeekData).forEach(function (dKey) {
          var dayData = EventsModule.currentWeekData[dKey];
          if (dayData.normal > 0) {
            addPromises.push(window.AppDB.add('events', {
              name: 'Festa Normal (' + daysMap[dKey].name + ')',
              date: refDateStr,
              type: 'normal',
              quantity: dayData.normal,
              unitValue: EventsModule.unitValues.normalCents,
              totalValue: dayData.normal * EventsModule.unitValues.normalCents,
              status: 'pending',
              closureId: closureId,
              notes: 'Fechamento semanal #' + closureId
            }));
          }
          if (dayData.solo > 0) {
            addPromises.push(window.AppDB.add('events', {
              name: 'Festa Solo (' + daysMap[dKey].name + ')',
              date: refDateStr,
              type: 'solo',
              quantity: dayData.solo,
              unitValue: EventsModule.unitValues.soloCents,
              totalValue: dayData.solo * EventsModule.unitValues.soloCents,
              status: 'pending',
              closureId: closureId,
              notes: 'Fechamento semanal #' + closureId
            }));
          }
        });

        return Promise.all(addPromises);
      }).then(function () {
        if (window.App) {
          window.App.showToast('Semana finalizada com sucesso! Total a receber: ' + window.AppFinance.formatBRL(calc.grandTotalCents), 'success');
          window.App.refreshAll();
        }
        EventsModule.resetWeeklyBuilder();
        EventsModule.renderClosuresHistory();
        EventsModule.renderEventsList();
      }).catch(function (err) {
        console.error('Erro ao finalizar semana:', err);
        if (window.App) window.App.showToast('Erro ao salvar fechamento', 'error');
      });
    },

    /**
     * Confirma o recebimento de um fechamento semanal
     * Atualiza o fechamento e todos os eventos vinculados para 'received', aumentando o saldo disponível!
     */
    confirmClosurePayment: function (closureId) {
      window.AppDB.getById('weekly_closures', closureId).then(function (closure) {
        if (!closure) return;
        closure.status = 'received';
        closure.receivedAt = new Date().toISOString();

        return window.AppDB.update('weekly_closures', closure).then(function () {
          // Atualiza os eventos vinculados
          return window.AppDB.getAll('events');
        }).then(function (allEvents) {
          var updatePromises = [];
          allEvents.forEach(function (ev) {
            if (ev.closureId === closureId) {
              ev.status = 'received';
              updatePromises.push(window.AppDB.update('events', ev));
            }
          });
          return Promise.all(updatePromises);
        });
      }).then(function () {
        if (window.App) {
          window.App.showToast('Recebimento confirmado! Saldo atualizado com sucesso.', 'success');
          window.App.refreshAll();
        }
        EventsModule.renderClosuresHistory();
        EventsModule.renderEventsList();
      }).catch(function (err) {
        console.error('Erro ao confirmar recebimento:', err);
      });
    },

    /**
     * Salva ou atualiza um evento avulso
     */
    saveSingleEvent: function (formData) {
      var isUpdate = !!formData.id;
      var operation = isUpdate ? window.AppDB.update('events', formData) : window.AppDB.add('events', formData);

      return operation.then(function () {
        if (window.App) {
          window.App.showToast(isUpdate ? 'Evento atualizado!' : 'Evento registrado!', 'success');
          window.App.refreshAll();
        }
        EventsModule.renderEventsList();
      });
    },

    /**
     * Alterna status do evento individual (pending <-> received)
     */
    toggleEventStatus: function (id) {
      window.AppDB.getById('events', id).then(function (ev) {
        if (!ev) return;
        ev.status = (ev.status === 'received') ? 'pending' : 'received';
        return window.AppDB.update('events', ev);
      }).then(function () {
        if (window.App) {
          window.App.showToast('Status do evento atualizado!', 'info');
          window.App.refreshAll();
        }
        EventsModule.renderEventsList();
      });
    },

    /**
     * Exclui um evento
     */
    deleteEvent: function (id) {
      if (!confirm('Deseja realmente excluir este evento?')) return;
      window.AppDB.delete('events', id).then(function () {
        if (window.App) {
          window.App.showToast('Evento excluído.', 'info');
          window.App.refreshAll();
        }
        EventsModule.renderEventsList();
      });
    },

    /**
     * Renderiza a lista de eventos com filtros
     */
    renderEventsList: function () {
      var container = document.getElementById('events_list_container');
      if (!container) return;

      var filterStatus = document.getElementById('events_filter_status') ? document.getElementById('events_filter_status').value : 'all';

      window.AppDB.getAll('events').then(function (events) {
        if (!events || events.length === 0) {
          container.innerHTML = '<div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.85rem;">Nenhum evento registrado ainda.</div>';
          return;
        }

        // Ordenar decrescente por data
        events.sort(function (a, b) {
          return new Date(b.date || 0) - new Date(a.date || 0);
        });

        var filtered = events.filter(function (ev) {
          if (filterStatus === 'all') return true;
          return ev.status === filterStatus;
        });

        if (filtered.length === 0) {
          container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.85rem;">Nenhum evento encontrado para este filtro.</div>';
          return;
        }

        var html = '';
        filtered.forEach(function (ev) {
          var isReceived = ev.status === 'received';
          var statusClass = isReceived ? 'received' : 'pending';
          var statusLabel = isReceived ? 'Recebido' : 'A receber';
          var typeLabel = ev.type === 'normal' ? 'Festa Normal' : (ev.type === 'solo' ? 'Festa Solo' : 'Evento Especial');
          var dateFormatted = ev.date ? ev.date.split('-').reverse().join('/') : '-';

          html += '<div class="item-row">' +
            '<div class="item-main">' +
              '<div class="item-icon-box" style="background: rgba(16, 185, 129, 0.15); color: #10B981;">' +
                (ev.type === 'solo' ? '⭐' : '🎵') +
              '</div>' +
              '<div class="item-info">' +
                '<span class="item-title">' + (ev.name || typeLabel) + '</span>' +
                '<span class="item-subtitle">' + dateFormatted + ' • ' + (ev.quantity || 1) + 'x ' + typeLabel + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="item-actions">' +
              '<div style="text-align: right;">' +
                '<div class="item-value text-success">' + window.AppFinance.formatBRL(ev.totalValue) + '</div>' +
                '<button type="button" class="status-chip ' + statusClass + '" style="cursor: pointer; border: none; margin-top: 4px;" onclick="EventsModule.toggleEventStatus(' + ev.id + ')">' +
                  statusLabel +
                '</button>' +
              '</div>' +
              '<button type="button" class="btn-icon-header" style="width: 32px; height: 32px;" onclick="EventsModule.deleteEvent(' + ev.id + ')" title="Excluir">' +
                '🗑️' +
              '</button>' +
            '</div>' +
          '</div>';
        });

        container.innerHTML = html;
      });
    },

    /**
     * Renderiza o histórico de Fechamentos Semanais
     */
    renderClosuresHistory: function () {
      var container = document.getElementById('closures_history_container');
      if (!container) return;

      window.AppDB.getAll('weekly_closures').then(function (closures) {
        if (!closures || closures.length === 0) {
          container.innerHTML = '<div style="text-align: center; padding: 18px; color: var(--text-muted); font-size: 0.82rem;">Nenhum fechamento semanal finalizado.</div>';
          return;
        }

        closures.sort(function (a, b) {
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });

        var html = '';
        closures.forEach(function (c) {
          var isReceived = c.status === 'received';
          var statusClass = isReceived ? 'received' : 'pending';
          var statusLabel = isReceived ? 'Recebido no Saldo' : 'Pendente (A receber)';
          var dateFormatted = c.refDate ? c.refDate.split('-').reverse().join('/') : '-';

          html += '<div class="card" style="margin-bottom: 10px; border-left: 4px solid ' + (isReceived ? '#10B981' : '#F59E0B') + ';">' +
            '<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">' +
              '<div>' +
                '<strong style="font-size: 0.92rem; color: #FFFFFF;">Semana de ' + dateFormatted + '</strong>' +
                '<div style="font-size: 0.75rem; color: var(--text-muted);">' +
                  c.normalCount + ' normais, ' + c.soloCount + ' solo (Total: ' + c.totalEvents + ' festas)' +
                '</div>' +
              '</div>' +
              '<div style="text-align: right;">' +
                '<span class="item-value text-success" style="font-size: 1.05rem;">' + window.AppFinance.formatBRL(c.totalAmount) + '</span>' +
                '<div style="margin-top: 4px;"><span class="status-chip ' + statusClass + '">' + statusLabel + '</span></div>' +
              '</div>' +
            '</div>';

          if (!isReceived) {
            html += '<div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end;">' +
              '<button type="button" class="btn btn-success btn-sm" onclick="EventsModule.confirmClosurePayment(' + c.id + ')">' +
                '💰 Confirmar Recebimento' +
              '</button>' +
            '</div>';
          }

          html += '</div>';
        });

        container.innerHTML = html;
      });
    }
  };

  window.EventsModule = EventsModule;
})(window);
