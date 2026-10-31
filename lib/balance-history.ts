import {monthOf,today,type State} from './finance.ts';
// Opening balances have no historical date, so treat them as starting balances.
// Own-account transfers always have zero effect on the total balance.
export function balanceHistory(s:State,month:string,now=today()){
 if(!/^\d{4}-\d{2}$/.test(month)||month>monthOf(now))return [];
 const last=new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate();
 const days=month===monthOf(now)?Number(now.slice(8)):last;
 let balance=s.accounts.reduce((n,a)=>n+a.opening,0);
 for(const t of s.transactions)if(t.date<month+'-01')balance+=t.kind==='income'?t.amount:t.kind==='expense'?-t.amount:0;
 const result=[{day:0,balance}];
 for(let day=1;day<=days;day++){const date=month+'-'+String(day).padStart(2,'0');for(const t of s.transactions)if(t.date===date)balance+=t.kind==='income'?t.amount:t.kind==='expense'?-t.amount:0;result.push({day,balance});}
 return result;
}
