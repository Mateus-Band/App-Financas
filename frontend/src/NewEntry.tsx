import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { addMonths, format } from 'date-fns';
import { triggerAutoSync } from './GoogleSync';
import Loader from './components/Loader';

type EntryType = 'Income' | 'Expense' | 'Debt' | null;

export default function NewEntry() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const isDebtEdit = searchParams.get('isDebt') === 'true';

  const accounts = useLiveQuery(() => db.accounts.toArray());
  
  const [step, setStep] = useState(1);
  const [type, setType] = useState<EntryType>(null);
  
  // Form State
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [entryDate, setEntryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Expense specific
  const [paymentMethod, setPaymentMethod] = useState('');
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState('2');
  const [originalGroupId, setOriginalGroupId] = useState<string | undefined>(undefined);
  
  // Debt specific
  const [debtType, setDebtType] = useState('');
  const [personName, setPersonName] = useState('');

  const handleTypeSelect = (selected: EntryType) => {
    setType(selected);
    setStep(2);
  };

  // Load data for edit
  useState(() => {
    if (editId) {
      const id = parseInt(editId);
      if (isDebtEdit) {
        db.debts.get(id).then(d => {
          if (d) {
            setStep(2);
            setType('Debt');
            setPersonName(d.personName);
            setDebtType(d.type);
            setAmount(d.amount.toString());
            setDescription(d.description);
            setAccountId(d.accountId.toString());
            setEntryDate(d.date);
          }
        });
      } else {
        db.transactions.get(id).then(t => {
          if (t) {
            setStep(2);
            setType(t.type as EntryType);
            setCategory(t.category);
            setDescription(t.description);
            setAmount(t.amount.toString());
            setAccountId(t.accountId.toString());
            setEntryDate(t.date);
            if (t.type === 'Expense') {
              setPaymentMethod(t.paymentMethod || '');
              if (t.isInstallment) {
                setIsInstallment(true);
                setInstallmentCount(t.installmentCount?.toString() || '2');
                setOriginalGroupId(t.installmentGroupId);
                // Also set total amount for the group instead of a single installment amount
                if (t.installmentCount && t.amount) {
                  setAmount((t.amount * t.installmentCount).toString());
                }
              }
            }
          }
        });
      }
    }
  });

  if (accounts === undefined) {
    return <Loader />;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!type || !accountId || !amount) return;
    
    const numAmount = parseFloat(amount);
    const date = entryDate;
    const updatedAt = new Date().toISOString();

    if (type === 'Income') {
      const data = {
        date,
        type: 'Income' as const,
        category,
        description,
        amount: numAmount,
        accountId: parseInt(accountId),
        updatedAt
      };
      if (editId && !isDebtEdit) await db.transactions.update(parseInt(editId), data);
      else await db.transactions.add(data);
    }
    else if (type === 'Expense') {
      if (paymentMethod === 'Crédito' && isInstallment) {
        const count = parseInt(installmentCount);
        const installmentAmount = numAmount / count;
        const groupId = crypto.randomUUID();
        
        const installments = Array.from({ length: count }).map((_, i) => ({
          // Fix: when editing an existing group, date offset should probably be based on the edited date
          date: format(addMonths(new Date(entryDate + 'T00:00:00'), i), 'yyyy-MM-dd'),
          type: 'Expense' as const,
          category,
          description,
          amount: installmentAmount,
          accountId: parseInt(accountId),
          paymentMethod: 'Crédito' as const,
          isInstallment: true,
          installmentCount: count,
          currentInstallment: i + 1,
          installmentGroupId: groupId,
          updatedAt
        }));
        
        if (editId && originalGroupId) {
          const toDelete = await db.transactions.where({ installmentGroupId: originalGroupId }).primaryKeys();
          await db.transactions.bulkDelete(toDelete as number[]);
        } else if (editId) {
          await db.transactions.delete(parseInt(editId));
        }
        await db.transactions.bulkAdd(installments);
      } else {
        const data = {
          date,
          type: 'Expense' as const,
          category,
          description,
          amount: numAmount,
          accountId: parseInt(accountId),
          paymentMethod: paymentMethod as any,
          updatedAt
        };
        if (editId && originalGroupId) {
          const toDelete = await db.transactions.where({ installmentGroupId: originalGroupId }).primaryKeys();
          await db.transactions.bulkDelete(toDelete as number[]);
          await db.transactions.add(data);
        } else if (editId && !isDebtEdit) {
          await db.transactions.update(parseInt(editId), data);
        } else {
          await db.transactions.add(data);
        }
      }
    }
    else if (type === 'Debt') {
      const data = {
        personName,
        type: debtType as any,
        amount: numAmount,
        description,
        date,
        accountId: parseInt(accountId),
        updatedAt
      };
      if (editId && isDebtEdit) await db.debts.update(parseInt(editId), data);
      else await db.debts.add(data);
    }

    // Auto-sync after saving
    triggerAutoSync();

    navigate('/'); // Redirect to dashboard
  };

  return (
    <div className="mb-20">
      <div className="flex items-center gap-3 mb-6">
        {step > 1 && (
          <button onClick={() => setStep(1)} className="p-2 -ml-2 rounded-full hover:bg-[var(--surface-hover)]">
            <ArrowLeft size={20} />
          </button>
        )}
        <h1 className="text-2xl font-bold">{editId ? 'Editar Lançamento' : 'Novo Lançamento'}</h1>
      </div>

      <div className="card">
        {step === 1 && (
          <div className="flex flex-col gap-3">
            <p className="text-secondary mb-2">Selecione o tipo de lançamento:</p>
            <button onClick={() => handleTypeSelect('Income')} className="btn btn-green w-full text-lg py-4">Receita (Ganho)</button>
            <button onClick={() => handleTypeSelect('Expense')} className="btn btn-red w-full text-lg py-4">Despesa (Gasto)</button>
            <button onClick={() => handleTypeSelect('Debt')} className="btn btn-outline w-full text-lg py-4 border-[var(--primary-color)] text-[var(--primary-color)]">Empréstimo / Dívida</button>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold border-b border-[var(--border-color)] pb-2 mb-2">
              Detalhes: {type === 'Income' ? 'Receita' : type === 'Expense' ? 'Despesa' : 'Dívida'}
            </h2>

            {type === 'Debt' && (
              <>
                <div className="form-group">
                  <label className="input-label">O que aconteceu?</label>
                  <select className="input-field" value={debtType} onChange={e => setDebtType(e.target.value)} required>
                    <option value="">Selecione...</option>
                    <option value="Lent">Eu emprestei dinheiro</option>
                    <option value="Borrowed">Eu peguei emprestado</option>
                    <option value="Received">Recebi de volta</option>
                    <option value="Paid">Paguei o que devia</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="input-label">Nome da Pessoa</label>
                  <input type="text" className="input-field" value={personName} onChange={e => setPersonName(e.target.value)} required placeholder="Ex: João" />
                </div>
              </>
            )}

            {(type === 'Income' || type === 'Expense') && (
              <div className="form-group">
                <label className="input-label">Categoria</label>
                <select className="input-field" value={category} onChange={e => setCategory(e.target.value)} required>
                  <option value="">Selecione...</option>
                  {type === 'Income' ? (
                    <>
                      <option value="Prêmio">Prêmio</option>
                      <option value="Rendimento">Rendimento</option>
                      <option value="Presente">Presente</option>
                      <option value="Outro">Outro</option>
                    </>
                  ) : (
                    <>
                      <option value="Transporte">Transporte</option>
                      <option value="Alimentação">Alimentação (Refeição)</option>
                      <option value="Mercado">Mercado</option>
                      <option value="Lazer">Lazer</option>
                      <option value="Compras">Compras</option>
                      <option value="Farmácia">Farmácia</option>
                      <option value="Outro">Outro</option>
                    </>
                  )}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="input-label">Data</label>
              <input 
                type="date" 
                className="input-field" 
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="input-label">Descrição</label>
              <input type="text" className="input-field" value={description} onChange={e => setDescription(e.target.value)} required placeholder="Texto curto" />
            </div>

            <div className="form-group">
              <label className="input-label">Valor (R$)</label>
              <input type="number" step="0.01" min="0.01" className="input-field" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0,00" />
            </div>

            <div className="form-group">
              <label className="input-label">Conta Bancária {type === 'Debt' && '(Sempre via Pix)'}</label>
              <select className="input-field" value={accountId} onChange={e => setAccountId(e.target.value)} required>
                <option value="">Selecione...</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>

            {type === 'Expense' && (
              <div className="form-group">
                <label className="input-label">Meio de Pagamento</label>
                <select className="input-field" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} required>
                  <option value="">Selecione...</option>
                  <option value="Pix">Pix</option>
                  <option value="Crédito">Crédito</option>
                  <option value="Débito">Débito</option>
                  <option value="Dinheiro">Dinheiro</option>
                </select>
              </div>
            )}

            {type === 'Expense' && paymentMethod === 'Crédito' && (
              <div className="form-group p-3 border border-[var(--border-color)] rounded-lg bg-[var(--bg-color)] mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-[var(--primary-color)]" checked={isInstallment} onChange={e => setIsInstallment(e.target.checked)} />
                  <span className="text-sm font-medium">É parcelado?</span>
                </label>
                
                {isInstallment && (
                  <div className="mt-3">
                    <label className="input-label">Número de Parcelas</label>
                    <select className="input-field" value={installmentCount} onChange={e => setInstallmentCount(e.target.value)}>
                      {Array.from({ length: 11 }).map((_, i) => (
                        <option key={i+2} value={i+2}>{i+2}x</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <button type="submit" className="btn btn-primary w-full mt-4">Salvar Lançamento</button>
          </form>
        )}
      </div>
    </div>
  );
}
