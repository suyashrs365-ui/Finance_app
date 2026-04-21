import { Transaction } from '../data';
import { cn, formatCurrency } from '../lib/utils';
import { motion } from 'motion/react';

interface TransactionRowProps {
  transaction: Transaction;
}

export function TransactionRow({ transaction }: TransactionRowProps) {
  const isCredit = transaction.cr > 0;
  
  return (
    <motion.tr 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="border-b border-zinc-100/50 hover:bg-zinc-50 transition-colors group cursor-default"
    >
      <td className="p-3">
        <span className="font-mono text-xs text-zinc-500 group-hover:text-zinc-900 transition-colors tracking-tighter">
          {transaction.date}
        </span>
      </td>
      <td className="p-3">
        <div className="flex flex-col gap-1 w-fit">
          {transaction.person && (
            <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-600 text-[8px] uppercase tracking-widest font-black leading-none border border-zinc-200 w-fit">
              {transaction.person}
            </span>
          )}
          {transaction.type && (
            <span className="px-1.5 py-0.5 bg-zinc-800 text-white text-[8px] uppercase tracking-widest font-black leading-none w-fit">
              {transaction.type}
            </span>
          )}
        </div>
      </td>
      <td className="p-3">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-black tracking-widest text-zinc-900">{transaction.mainCategory}</span>
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold font-mono">{transaction.subCategory}</span>
        </div>
      </td>
      <td className="p-3">
        <span className="text-sm font-medium text-zinc-700 tracking-tight">{transaction.description}</span>
      </td>
      <td className="p-3 text-center">
        <div className="inline-flex flex-col items-center">
          <span className="text-[9px] uppercase font-black tracking-widest text-zinc-900 mb-0.5 leading-none">{transaction.bank}</span>
          <span className="text-[8px] font-mono tracking-widest text-zinc-400 uppercase leading-none">{transaction.mode}</span>
        </div>
      </td>
      <td className="p-3 text-right">
        {transaction.dr > 0 && (
          <span className="text-rose-600 font-mono text-sm tracking-tighter">
            {formatCurrency(transaction.dr).replace('.00', '')}
          </span>
        )}
      </td>
      <td className="p-3 text-right">
        {isCredit && (
          <span className="text-emerald-600 font-mono font-bold text-sm tracking-tighter bg-emerald-50 px-2 py-0.5 border border-emerald-100">
            {formatCurrency(transaction.cr).replace('.00', '')}
          </span>
        )}
      </td>
      <td className="p-3">
        <span className="text-[10px] text-zinc-400 italic leading-snug block max-w-[160px]">
          {transaction.nature}
        </span>
      </td>
    </motion.tr>
  );
}
