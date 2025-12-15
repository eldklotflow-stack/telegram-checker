import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, AlertCircle, FileText, Users, Shield, Lock } from 'lucide-react';

const App = () => {
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [phoneNumbers, setPhoneNumbers] = useState('');
  const [sheetId, setSheetId] = useState('');
  const [clientName, setClientName] = useState('');
  const [userName, setUserName] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [logs, setLogs] = useState([]);
  const [systemStatus, setSystemStatus] = useState({ locked: false, lockedBy: null, dailyUsed: 0 });

  useEffect(() => {
    checkSystemStatus();
    const interval = setInterval(checkSystemStatus, 10000); // Обновляем каждые 10 секунд
    return () => clearInterval(interval);
  }, []);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString('ru-RU');
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  const checkSystemStatus = async () => {
    try {
      const response = await fetch('/api/get-status');
      const data = await response.json();
      setSystemStatus(data);
    } catch (error) {
      console.error('Ошибка проверки статуса:', error);
    }
  };

  const handleCheck = async () => {
    if (!apiId || !apiHash || !phoneNumbers || !sheetId || !clientName || !userName) {
      addLog('Заполните все обязательные поля', 'error');
      return;
    }

    const phones = phoneNumbers.split('\n').filter(p => p.trim());
    
    if (systemStatus.dailyUsed + phones.length > 100) {
      addLog(`Превышен дневной лимит! Осталось: ${100 - systemStatus.dailyUsed} проверок`, 'error');
      return;
    }

    if (systemStatus.locked) {
      addLog(`Система занята пользователем: ${systemStatus.lockedBy}`, 'error');
      return;
    }

    setIsChecking(true);
    setResults([]);
    setLogs([]);
    setProgress({ current: 0, total: phones.length });
    
    addLog(`Начинаю проверку ${phones.length} номеров для клиента "${clientName}"`, 'info');
    addLog(`Пользователь: ${userName}`, 'info');

    // Блокируем систему
    try {
      await fetch('/api/lock-system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName })
      });
      await checkSystemStatus();
    } catch (error) {
      addLog('Ошибка блокировки системы', 'error');
      setIsChecking(false);
      return;
    }

    const foundResults = [];

    for (let i = 0; i < phones.length; i++) {
      const phone = phones[i].trim();
      setProgress({ current: i + 1, total: phones.length });
      
      addLog(`[${i + 1}/${phones.length}] Проверяю номер ${phone}...`, 'info');

      try {
        const response = await fetch('/api/check-phone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, api_id: apiId, api_hash: apiHash })
        });

        const result = await response.json();

        if (result.found) {
          addLog(`✓ НАЙДЕН: ${result.first_name} ${result.last_name} (@${result.username})`, 'success');
          foundResults.push({ ...result, checked_by: userName });
        } else {
          addLog(`✗ Не найден: ${phone}`, 'warning');
        }

        setResults(prev => [...prev, result]);

        if (i < phones.length - 1) {
          const waitTime = Math.floor(Math.random() * 41) + 40;
          addLog(`⏳ Пауза ${waitTime} секунд...`, 'info');
          await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        }
      } catch (error) {
        addLog(`Ошибка проверки ${phone}: ${error.message}`, 'error');
      }
    }

    // Записываем в Google Sheets
    if (foundResults.length > 0) {
      try {
        addLog('Запись результатов в Google Sheets...', 'info');
        await fetch('/api/write-sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sheet_id: sheetId,
            sheet_name: clientName,
            results: foundResults
          })
        });
        addLog('Данные успешно записаны в таблицу', 'success');
      } catch (error) {
        addLog('Ошибка записи в Google Sheets', 'error');
      }
    }

    // Разблокируем систему
    try {
      await fetch('/api/unlock-system', { method: 'POST' });
      await checkSystemStatus();
    } catch (error) {
      addLog('Ошибка разблокировки системы', 'error');
    }

    addLog(`Проверка завершена! Найдено: ${foundResults.length}/${phones.length}`, 'success');
    setIsChecking(false);
  };

  const remainingChecks = 100 - systemStatus.dailyUsed;
  const phonesCount = phoneNumbers.split('\n').filter(p => p.trim()).length;
  const canCheck = phonesCount <= remainingChecks && !systemStatus.locked && !isChecking;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Users className="w-8 h-8" />
              Telegram Account Checker
            </h1>
            <p className="mt-2 text-blue-100">Проверка номеров с защитой от перегрузки</p>
          </div>

          {/* Status Bar */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="text-xs text-gray-500">Использовано сегодня</div>
                    <div className="font-bold text-lg">{systemStatus.dailyUsed} / 100</div>
                  </div>
                </div>
                
                <div className="h-8 w-px bg-gray-300"></div>
                
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-green-600" />
                  <div>
                    <div className="text-xs text-gray-500">Осталось проверок</div>
                    <div className={`font-bold text-lg ${remainingChecks < 20 ? 'text-red-600' : 'text-green-600'}`}>
                      {remainingChecks}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {systemStatus.locked ? (
                  <div className="flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg">
                    <Lock className="w-4 h-4" />
                    <span className="text-sm font-medium">Занято: {systemStatus.lockedBy}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-lg">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Свободно</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Левая колонка - Форма */}
              <div className="space-y-6">
                {/* API Settings */}
                <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                  <h2 className="text-xl font-semibold mb-4">Настройки API</h2>
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={apiId}
                      onChange={(e) => setApiId(e.target.value)}
                      placeholder="API ID"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      disabled={isChecking}
                    />
                    <input
                      type="password"
                      value={apiHash}
                      onChange={(e) => setApiHash(e.target.value)}
                      placeholder="API Hash"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      disabled={isChecking}
                    />
                  </div>
                </div>

                {/* Google Sheets */}
                <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                  <h2 className="text-xl font-semibold mb-4">Google Sheets</h2>
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={sheetId}
                      onChange={(e) => setSheetId(e.target.value)}
                      placeholder="ID таблицы"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                      disabled={isChecking}
                    />
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Название клиента"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                      disabled={isChecking}
                    />
                  </div>
                </div>

                {/* User Name */}
                <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
                  <h2 className="text-xl font-semibold mb-4">Ваше имя</h2>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Введите ваше имя"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    disabled={isChecking}
                  />
                </div>

                {/* Phone Numbers */}
                <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-200">
                  <h2 className="text-xl font-semibold mb-4">Номера телефонов</h2>
                  <textarea
                    value={phoneNumbers}
                    onChange={(e) => setPhoneNumbers(e.target.value)}
                    placeholder="+79001234567&#10;+79007654321"
                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                    rows="8"
                    disabled={isChecking}
                  />
                  <div className="mt-2 flex justify-between text-xs">
                    <span className="text-gray-500">Каждый номер с новой строки</span>
                    <span className={`font-medium ${phonesCount > remainingChecks ? 'text-red-600' : 'text-gray-700'}`}>
                      {phonesCount} номеров
                    </span>
                  </div>
                </div>

                {!canCheck && phonesCount > remainingChecks && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <AlertCircle className="w-5 h-5 text-red-600 inline mr-2" />
                    <span className="text-sm text-red-800 font-medium">
                      Превышен лимит! Доступно: {remainingChecks}, указано: {phonesCount}
                    </span>
                  </div>
                )}

                <button
                  onClick={handleCheck}
                  disabled={!canCheck}
                  className={`w-full py-4 px-6 rounded-xl font-semibold text-white transition-all ${
                    !canCheck
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg'
                  }`}
                >
                  {isChecking ? (
                    <span className="flex items-center justify-center gap-2">
                      <Clock className="w-5 h-5 animate-spin" />
                      Проверяю... ({progress.current}/{progress.total})
                    </span>
                  ) : (
                    'Начать проверку'
                  )}
                </button>
              </div>

              {/* Правая колонка - Логи и результаты */}
              <div className="space-y-6">
                {isChecking && (
                  <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-200">
                    <h3 className="font-semibold mb-3">Прогресс</h3>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 h-3 rounded-full transition-all"
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-center mt-2 text-sm font-medium">
                      {progress.current} из {progress.total}
                    </p>
                  </div>
                )}

                <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <h3 className="font-semibold mb-3">Журнал событий</h3>
                  <div className="bg-white rounded-lg border h-96 overflow-y-auto p-4 font-mono text-xs space-y-1">
                    {logs.length === 0 ? (
                      <p className="text-gray-400 text-center py-8">Логи появятся после запуска...</p>
                    ) : (
                      logs.map((log, idx) => (
                        <div
                          key={idx}
                          className={`${
                            log.type === 'error' ? 'text-red-600' :
                            log.type === 'success' ? 'text-green-600' :
                            log.type === 'warning' ? 'text-yellow-600' : 'text-gray-700'
                          }`}
                        >
                          <span className="text-gray-400">[{log.timestamp}]</span> {log.message}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {results.filter(r => r.found).length > 0 && (
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                    <h3 className="font-semibold mb-3">
                      Найденные аккаунты ({results.filter(r => r.found).length})
                    </h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {results.filter(r => r.found).map((result, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-lg border text-sm">
                          <div className="font-medium">{result.first_name} {result.last_name}</div>
                          <div className="text-gray-600">@{result.username} • {result.phone}</div>
                          <div className="text-gray-400 text-xs">ID: {result.user_id}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Правила */}
        <div className="mt-6 bg-white rounded-xl p-6 shadow-lg border-l-4 border-yellow-500">
          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
            <Shield className="w-5 h-5 text-yellow-600" />
            Правила использования
          </h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>• Максимум 100 проверок в день для всей команды</li>
            <li>• Только один пользователь может работать одновременно</li>
            <li>• НЕ закрывайте вкладку во время проверки</li>
            <li>• Проверка занимает примерно 1 минуту на номер</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default App;