/**
 * ==========================================================================
 * GRANAFLOW — MEUS BACKUPS E PERSISTÊNCIA LOCAL (backup.js)
 * Exportação e Importação de JSON, Limpeza Segura e Estatísticas
 * ==========================================================================
 */

(function (window) {
  'use strict';

  var BackupModule = {
    init: function () {
      BackupModule.updateStorageStats();
    },

    /**
     * Atualiza contadores de dados salvos na área de backups
     */
    updateStorageStats: function () {
      var statsEl = document.getElementById('backup_storage_stats');
      if (!statsEl) return;

      Promise.all([
        window.AppDB.getAll('events'),
        window.AppDB.getAll('expenses'),
        window.AppDB.getAll('fixed_expenses'),
        window.AppDB.getAll('goals'),
        window.AppDB.getAll('investments'),
        window.AppDB.getAll('tasks')
      ]).then(function (results) {
        var countEvents = (results[0] || []).length;
        var countExpenses = (results[1] || []).length;
        var countFixed = (results[2] || []).length;
        var countGoals = (results[3] || []).length;
        var countInvestments = (results[4] || []).length;
        var countTasks = (results[5] || []).length;

        statsEl.innerHTML = '<div style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.6;">' +
          '<strong>Registros locais armazenados:</strong><br>' +
          '• ' + countEvents + ' eventos/festas<br>' +
          '• ' + (countExpenses + countFixed) + ' despesas cadastradas<br>' +
          '• ' + countGoals + ' metas financeiras<br>' +
          '• ' + countInvestments + ' investimentos na carteira<br>' +
          '• ' + countTasks + ' compromissos e tarefas na agenda' +
        '</div>';
      });
    },

    /**
     * Gera e realiza download do arquivo de backup JSON
     */
    downloadBackupJSON: function () {
      window.AppDB.exportAllData().then(function (exportObj) {
        var jsonStr = JSON.stringify(exportObj, null, 2);
        var blob = new Blob([jsonStr], { type: 'application/json' });
        var url = URL.createObjectURL(blob);

        var dateStr = new Date().toISOString().split('T')[0];
        var fileName = 'granaflow_backup_' + dateStr + '.json';

        var a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (window.App) window.App.showToast('Backup JSON gerado com sucesso!', 'success');
      }).catch(function (err) {
        console.error('Erro ao gerar backup:', err);
        if (window.App) window.App.showToast('Erro ao exportar backup', 'error');
      });
    },

    /**
     * Importa arquivo de backup JSON selecionado pelo usuário
     */
    importBackupJSON: function (file) {
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var parsed = JSON.parse(e.target.result);

          if (!parsed || parsed.appName !== 'GranaFlow' || !parsed.data) {
            alert('Arquivo inválido! O arquivo precisa ser um backup gerado pelo GranaFlow.');
            return;
          }

          var confirmRestore = confirm(
            'ATENÇÃO: Restaurar o backup substituirá todos os dados atuais do aplicativo pelos dados deste arquivo.\n\n' +
            'Data do arquivo: ' + (parsed.exportedAt || 'Desconhecida') + '\n\n' +
            'Deseja prosseguir?'
          );

          if (!confirmRestore) return;

          window.AppDB.importAllData(parsed).then(function () {
            alert('Backup restaurado com sucesso! O aplicativo será atualizado.');
            if (window.App) {
              window.App.refreshAll();
              window.App.switchScreen('dashboard');
            }
            BackupModule.updateStorageStats();
          }).catch(function (err) {
            console.error('Erro ao restaurar:', err);
            alert('Erro ao restaurar os dados do backup.');
          });

        } catch (err) {
          alert('Erro ao processar o arquivo JSON: ' + err.message);
        }
      };

      reader.readAsText(file);
    },

    /**
     * Limpa com segurança todos os dados do banco após confirmação dupla
     */
    wipeAllData: function () {
      var confirm1 = confirm('⚠️ ALERTA DE SEGURANÇA: Deseja realmente APAGAR TODOS OS SEUS DADOS do GranaFlow?\n\nEsta ação é irreversível a menos que você tenha um arquivo de backup salvo.');
      if (!confirm1) return;

      var confirm2 = prompt('Digite "APAGAR" em letras maiúsculas para confirmar a exclusão de todos os registros:');
      if (confirm2 !== 'APAGAR') {
        alert('Operação cancelada.');
        return;
      }

      Promise.all([
        window.AppDB.clearStore('events'),
        window.AppDB.clearStore('expenses'),
        window.AppDB.clearStore('fixed_expenses'),
        window.AppDB.clearStore('goals'),
        window.AppDB.clearStore('investments'),
        window.AppDB.clearStore('tasks'),
        window.AppDB.clearStore('weekly_closures')
      ]).then(function () {
        alert('Todos os dados foram apagados com sucesso.');
        if (window.App) {
          window.App.refreshAll();
          window.App.switchScreen('dashboard');
        }
        BackupModule.updateStorageStats();
      }).catch(function (err) {
        console.error('Erro ao limpar dados:', err);
      });
    }
  };

  window.BackupModule = BackupModule;
})(window);
