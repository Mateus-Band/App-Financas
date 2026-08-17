import { db } from './db';
import { format, isBefore, addMonths, startOfMonth, isAfter } from 'date-fns';

export async function materializeFixedEntries() {
  const fixedEntries = await db.fixedEntries.toArray();
  const accounts = await db.accounts.toArray();
  const accountsMap = new Map(accounts.map(a => [a.id, a]));
  const today = new Date();
  
  const transactionsToAdd: any[] = [];

  for (const fixed of fixedEntries) {
    if (!fixed.startDate) continue;
    
    const account = accountsMap.get(fixed.accountId);
    if (!account) continue;

    // Determine the start date of materialization
    const cutoffStr = account.balanceAsOf || '2000-01-01';
    let currentMonthDate = fixed.startDate.includes('T') ? new Date(fixed.startDate) : new Date(fixed.startDate + 'T12:00:00');
    
    // We start checking from the max(fixed.startDate, cutoffDate)
    const cutoffDate = new Date(cutoffStr + 'T12:00:00');
    if (isBefore(currentMonthDate, cutoffDate)) {
      currentMonthDate = new Date(cutoffDate);
    }

    // Move to the 1st of the currentMonthDate to iterate safely
    currentMonthDate = startOfMonth(currentMonthDate);

    // Iterate month by month until the current month (inclusive)
    const endMonthDate = startOfMonth(today);
    
    while (!isAfter(currentMonthDate, endMonthDate)) {
      // Calculate the specific day for this month
      let occurenceDate = new Date(currentMonthDate);
      
      const lastDayOfMonth = new Date(occurenceDate.getFullYear(), occurenceDate.getMonth() + 1, 0).getDate();
      const targetDay = Math.min(fixed.day, lastDayOfMonth);
      
      occurenceDate.setDate(targetDay);
      
        if (!isAfter(occurenceDate, today)) {
          const monthStr = format(occurenceDate, 'yyyy-MM');
          
          if (fixed.skippedMonths && fixed.skippedMonths.includes(monthStr)) {
            currentMonthDate = addMonths(currentMonthDate, 1);
            continue;
          }
        
        // Check if transaction already exists
        const existingTx = await db.transactions
          .where('sourceFixedEntryId').equals(fixed.id!)
          .filter(t => t.date.startsWith(monthStr))
          .first();
          
        if (!existingTx) {
          transactionsToAdd.push({
            type: fixed.type,
            category: 'Fixo',
            description: fixed.name,
            amount: fixed.amount,
            accountId: fixed.accountId,
            date: format(occurenceDate, 'yyyy-MM-dd'),
            sourceFixedEntryId: fixed.id,
            updatedAt: new Date().toISOString()
          });
        }
      }
      
      currentMonthDate = addMonths(currentMonthDate, 1);
    }
  }

  if (transactionsToAdd.length > 0) {
    await db.transactions.bulkAdd(transactionsToAdd);
  }
}
