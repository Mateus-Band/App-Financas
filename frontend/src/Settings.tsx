import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { useGoogleLogin } from '@react-oauth/google';
import { initGoogleDriveApi, uploadBackup, syncWithDrive, triggerAutoSync } from './GoogleSync';
import { Trash2, Plus, Download, Upload, Settings as SettingsIcon } from 'lucide-react';
import { format } from 'date-fns';
import Loader from './components/Loader';
import Toast from './components/Toast';

export default function Settings() {
  const accounts = useLiveQuery(() => db.accounts.toArray());
  const fixedEntries = useLiveQuery(() => db.fixedEntries.toArray());
  
  // -- Sync State --
  const [googleToken, setGoogleToken] = useState<string | null>(localStorage.getItem('gdrive_token'));
  const [syncStatus, setSyncStatus] = useState(googleToken ? 'Conectado. Sincronizando...' : 'Desconectado');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -- Forms State --
  const [newAccountName, setNewAccountName] = useState('');
  
  const [fixedType, setFixedType] = useState<'Income' | 'Expense'>('Income');
  const [fixedName, setFixedName] = useState('');
  const [fixedAmount, setFixedAmount] = useState('');
  const [fixedDay, setFixedDay] = useState('');
  const [fixedAccountId, setFixedAccountId] = useState('');

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMsg(msg);
    setToastType(type);
  };

  useEffect(() => {
    initGoogleDriveApi().then(() => {
      console.log('GAPI inicializado');
    }).catch(e => console.error(e));
  }, []);

  // --- GOOGLE SYNC LOGIC ---
  const login = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/drive.appdata',
    onSuccess: async (tokenResponse) => {
      const token = tokenResponse.access_token;
      localStorage.setItem('gdrive_token', token);
      setGoogleToken(token);
      setSyncStatus('Buscando backup na nuvem...');
      try {
        await syncWithDrive(token);
        setSyncStatus('Restaurado com sucesso!');
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        console.log("Sem backup anterior ou erro:", err);
        setSyncStatus('Nenhum backup encontrado. Criando um novo...');
        try {
          await uploadBackup(token);
          setSyncStatus('Sincronizado na Nuvem');
        } catch (e) {
          setSyncStatus('Erro ao sincronizar');
        }
      }
    },
    onError: () => {
      setSyncStatus('Erro no Login');
      alert('Login falhou');
    }
  });

  if (accounts === undefined || fixedEntries === undefined) {
    return <Loader />;
  }


  const handleManualSync = async () => {
    if (!googleToken) return;
    setSyncStatus('Sincronizando...');
    try {
      await uploadBackup(googleToken);
      setSyncStatus('Sincronizado na Nuvem');
    } catch (e) {
      setSyncStatus('Erro ao sincronizar');
    }
  };

  const logout = () => {
    localStorage.removeItem('gdrive_token');
    setGoogleToken(null);
    setSyncStatus('Desconectado');
  };

  // --- MANUAL BACKUP LOGIC ---
  const handleExport = async () => {
    try {
      const blob = await db.export();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finance-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    } catch (error) {
      console.error("Erro ao exportar", error);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await db.delete();
      await db.open();
      await db.import(file);
      alert("Backup restaurado com sucesso!");
      window.location.reload();
    } catch (error) {
      console.error("Erro ao importar", error);
      alert("Erro ao importar dados.");
    }
  };

  // --- ACCOUNTS LOGIC ---
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName.trim()) return;
    await db.accounts.add({ 
      name: newAccountName.trim(), 
      balance: 0,
      updatedAt: new Date().toISOString()
    });
    setNewAccountName('');
    triggerAutoSync();
  };

  const handleUpdateBalance = async (id: number, newBalanceStr: string) => {
    const newBalance = parseFloat(newBalanceStr);
    if (isNaN(newBalance)) return;
    await db.accounts.update(id, { 
      balance: newBalance,
      balanceAsOf: format(new Date(), 'yyyy-MM-dd'),
      updatedAt: new Date().toISOString()
    });
    triggerAutoSync();
  };

  const handleDeleteAccount = async (id: number, name: string) => {
    if (name === 'Dinheiro físico') {
      showToast('A conta "Dinheiro físico" não pode ser apagada.', 'error');
      return;
    }
    if (confirm(`Tem certeza que deseja apagar a conta ${name}?`)) {
      await db.accounts.delete(id);
      triggerAutoSync();
    }
  };

  // --- FIXED ENTRIES LOGIC ---
  const handleAddFixedEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fixedName || !fixedAmount || !fixedDay || !fixedAccountId) return;
    await db.fixedEntries.add({
      type: fixedType,
      name: fixedName,
      amount: parseFloat(fixedAmount),
      day: parseInt(fixedDay),
      accountId: parseInt(fixedAccountId),
      startDate: format(new Date(), 'yyyy-MM-dd'),
      updatedAt: new Date().toISOString()
    });
    setFixedName('');
    setFixedAmount('');
    setFixedDay('');
    triggerAutoSync();
  };

  const handleDeleteFixedEntry = async (id: number) => {
    if (confirm('Apagar este registro fixo?')) {
      await db.fixedEntries.delete(id);
      triggerAutoSync();
    }
  };

  return (
    <div className="mb-20">
      <h1 className="text-2xl font-bold mb-8 flex items-center gap-2">
        <SettingsIcon /> Configurações
      </h1>

      {/* Cloud Sync */}
      <section className="mb-8 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--surface-color)] flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-sm">Sincronização em Nuvem</h3>
            <p className="text-xs text-secondary">{syncStatus}</p>
          </div>
          {googleToken ? (
            <button onClick={logout} className="text-xs text-red hover:underline">Sair</button>
          ) : null}
        </div>
        {!googleToken ? (
          <button onClick={() => login()} className="btn btn-outline w-full text-sm py-2">
            Conectar com Google Drive
          </button>
        ) : (
          <button onClick={handleManualSync} className="btn btn-primary w-full text-sm py-2">
            Forçar Sincronização Agora
          </button>
        )}
      </section>

      {/* Accounts Management */}
      <section className="mb-8 card">
        <h2 className="text-lg font-bold mb-4 border-b border-[var(--border-color)] pb-2">Minhas Contas</h2>
        <div className="flex flex-col gap-4">
          {accounts.map(acc => (
            <div key={acc.id} className="flex justify-between items-center border border-[var(--border-color)] p-3 rounded-lg">
              <div>
                <p className="font-semibold">{acc.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-secondary">Saldo Atual (ajustar quando conferir extrato): R$</span>
                  <input 
                    type="number" 
                    className="input-field text-sm" 
                    style={{ width: '100px', padding: '0.2rem 0.5rem', marginTop: 0 }}
                    defaultValue={acc.balance}
                    onBlur={(e) => acc.id && handleUpdateBalance(acc.id, e.target.value)}
                  />
                </div>
              </div>
              {acc.name !== 'Dinheiro físico' && (
                <button onClick={() => acc.id && handleDeleteAccount(acc.id, acc.name)} className="text-red p-2 bg-red-500/10 rounded-full hover:bg-red-500/20">
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleAddAccount} className="mt-4 flex gap-2">
          <input 
            type="text" 
            className="input-field flex-1" 
            placeholder="Nova conta (ex: Itaú)" 
            value={newAccountName}
            onChange={e => setNewAccountName(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary px-3">
            <Plus size={20} />
          </button>
        </form>
      </section>

      {/* Fixed Entries Management */}
      <section className="mb-8 card">
        <h2 className="text-lg font-bold mb-4 border-b border-[var(--border-color)] pb-2">Ganhos e Gastos Fixos</h2>
        <p className="text-xs text-secondary mb-4">Adicione valores que se repetem todo mês (Salário, Aluguel, etc) para impactar o saldo futuro.</p>
        
        <div className="flex flex-col gap-3 mb-4">
          {fixedEntries.map(f => (
            <div key={f.id} className="flex justify-between items-center border-b border-[var(--border-color)] pb-2">
              <div>
                <p className="font-semibold text-sm">{f.name}</p>
                <p className="text-xs text-secondary">Dia {f.day} • {accounts.find(a => a.id === f.accountId)?.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-semibold text-sm ${f.type === 'Income' ? 'text-green' : 'text-red'}`}>
                  R$ {f.amount.toFixed(2)}
                </span>
                <button onClick={() => f.id && handleDeleteFixedEntry(f.id)} className="text-red">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddFixedEntry} className="flex flex-col gap-2 p-3 bg-[var(--bg-color)] rounded-lg">
          <h3 className="text-sm font-semibold mb-1">Adicionar Novo Fixo</h3>
          <select className="input-field" value={fixedType} onChange={e => setFixedType(e.target.value as 'Income' | 'Expense')}>
            <option value="Income">Receita (+)</option>
            <option value="Expense">Despesa (-)</option>
          </select>
          <input type="text" className="input-field" placeholder="Descrição (ex: Salário)" value={fixedName} onChange={e => setFixedName(e.target.value)} required />
          <div className="flex gap-2">
            <input type="number" step="0.01" className="input-field flex-1" placeholder="Valor (R$)" value={fixedAmount} onChange={e => setFixedAmount(e.target.value)} required />
            <input type="number" min="1" max="31" className="input-field w-24" placeholder="Dia" value={fixedDay} onChange={e => setFixedDay(e.target.value)} required />
          </div>
          <select className="input-field" value={fixedAccountId} onChange={e => setFixedAccountId(e.target.value)} required>
            <option value="" disabled>Selecione a conta...</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary w-full mt-2 text-sm">Adicionar</button>
        </form>
      </section>

      {/* Manual Backup */}
      <section className="card">
        <h2 className="text-lg font-bold mb-4 border-b border-[var(--border-color)] pb-2">Backup Manual</h2>
        <div className="flex flex-col gap-3">
          <button onClick={handleExport} className="btn btn-primary w-full flex items-center justify-center gap-2">
            <Download size={18} /> Exportar Backup
          </button>
          <input type="file" accept=".json" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImport} />
          <button onClick={() => fileInputRef.current?.click()} className="btn btn-outline w-full flex items-center justify-center gap-2">
            <Upload size={18} /> Importar Backup
          </button>
        </div>
      </section>

      {toastMsg && <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg(null)} />}
    </div>
  );
}
