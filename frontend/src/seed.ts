import { db } from './db';

let isSeeding = false;

export async function seedDatabase() {
  if (isSeeding) return;
  isSeeding = true;
  
  // Deduplicate accounts (Fix for React 18 StrictMode double mount)
  const allAccounts = await db.accounts.toArray();
  const seenNames = new Set<string>();
  for (const acc of allAccounts) {
    if (seenNames.has(acc.name)) {
      if (acc.id) await db.accounts.delete(acc.id);
    } else {
      seenNames.add(acc.name);
    }
  }

  const accountCount = await db.accounts.count();
  
  if (accountCount === 0) {
    // Add default accounts
    await db.accounts.bulkAdd([
      { name: 'Meu Banco', balance: 0 },
      { name: 'Dinheiro físico', balance: 0 }
    ]);
    
    // Nenhuma despesa ou receita fixa por padrão. 
    // O usuário poderá adicionar em Configurações.
    
    console.log("Database seeded successfully!");
  }
}
