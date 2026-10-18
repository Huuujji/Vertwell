import { array,record,invalidResponse } from './contracts';
import { ApiError,type createApiClient } from '../api-client';
import type { Role } from '../../data/demo';

export type SavedNotification={id:string;revision:string;kind:'Void requests'|'Duplicate activity';read:boolean;orderIds:string[];
  evidence:{actorId:string;actor:string;role:Role;time:string;reason?:string;threshold?:number;minutes?:number;startTime?:string;
    orders:{id:string;number:string}[]}};
type NotificationPage={version:1;items:SavedNotification[];total:number;unread:number;hasMore:boolean;snapshot:string};
export type NotificationFeed={items:SavedNotification[];unread:number};
function decodePage(value:unknown):NotificationPage {
  const page=record(value);
  if(page.version!==1||typeof page.snapshot!=='string'||typeof page.hasMore!=='boolean'||
    !Number.isSafeInteger(page.total)||Number(page.total)<0||!Number.isSafeInteger(page.unread)||Number(page.unread)<0||Number(page.unread)>Number(page.total))invalidResponse('notification page');
  const items=array(page.items).map(value=>{
    const item=record(value),proof=record(item.evidence),orderIds=array(item.orderIds);
    if(typeof item.id!=='string'||typeof item.revision!=='string'||!/^[1-9][0-9]*$/.test(item.revision)||typeof item.read!=='boolean'||
      !['Void requests','Duplicate activity'].includes(String(item.kind))||!orderIds.length||orderIds.some(id=>typeof id!=='string')||new Set(orderIds).size!==orderIds.length||
      typeof proof.actorId!=='string'||typeof proof.actor!=='string'||!['Owner','Admin','Staff'].includes(String(proof.role))||
      typeof proof.time!=='string'||!Number.isFinite(Date.parse(proof.time)))invalidResponse('notification evidence');
    const orders=array(proof.orders).map(value=>{const order=record(value);if(typeof order.id!=='string'||typeof order.number!=='string')invalidResponse('notification order');return {id:order.id,number:order.number};});
    if(orders.length!==orderIds.length||orders.some(order=>!orderIds.includes(order.id))||new Set(orders.map(order=>order.id)).size!==orders.length)invalidResponse('notification receipt set');
    if(item.kind==='Void requests'&&typeof proof.reason!=='string')invalidResponse('void notification reason');
    if(item.kind==='Duplicate activity'&&(!Number.isInteger(proof.threshold)||Number(proof.threshold)<2||!Number.isInteger(proof.minutes)||Number(proof.minutes)<1||typeof proof.startTime!=='string'||!Number.isFinite(Date.parse(proof.startTime))))invalidResponse('duplicate notification rule');
    return {...item,evidence:{...proof,orders},orderIds} as SavedNotification;
  });
  if(items.length>100)invalidResponse('notification page size');
  return {...page,items} as NotificationPage;
}
export const createNotificationsData=(request:ReturnType<typeof createApiClient>)=>({
  async read(signal?:AbortSignal):Promise<NotificationFeed>{
    const items:SavedNotification[]=[];let first:NotificationPage|undefined;
    for(let offset=0;offset<=1_000_000;offset+=100){
      const page=decodePage(await request(`/api/notifications?offset=${offset}&limit=100`,{signal}));
      first??=page;
      if(page.snapshot!==first.snapshot)throw new ApiError('Notifications changed while loading. The current evidence will load automatically.','conflict');
      items.push(...page.items);
      if(!page.hasMore){
        if(items.length!==page.total||new Set(items.map(item=>item.id)).size!==items.length||items.filter(item=>!item.read).length!==page.unread)invalidResponse('notification totals');
        return {items,unread:page.unread};
      }
      if(page.items.length!==100)invalidResponse('notification continuation');
    }
    invalidResponse('notification pagination limit');
  },
  async mark(item:SavedNotification,read:boolean){
    const result=record(await request(`/api/notifications/${encodeURIComponent(item.id)}/read`,{method:'PATCH',body:JSON.stringify({revision:item.revision,read})}));
    if(result.id!==item.id||result.revision!==item.revision||result.read!==read)invalidResponse('saved notification read marker');
  },
});
