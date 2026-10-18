import { useEffect,useState } from 'react';
import type { CheckoutLine,CheckoutStock,createCheckoutData } from '../lib/data/checkout';

// Changes in stock snapshots only refresh feedback. They never mutate the cart.
export default function useCheckoutStock(service:ReturnType<typeof createCheckoutData>,lines:CheckoutLine[],version:unknown,enabled=true):{data?:CheckoutStock;error?:string} {
  const [state,setState]=useState<{key:string;data?:CheckoutStock;error?:string}>();
  const key=JSON.stringify(lines);
  useEffect(()=>{
    if(!enabled||!lines.length){setState(undefined);return;}
    const controller=new AbortController();setState(undefined);
    const timer=setTimeout(()=>{void service.stock(lines,controller.signal).then(data=>{if(!controller.signal.aborted)setState({key,data});}).catch(cause=>{
      if(!controller.signal.aborted)setState({key,error:cause instanceof Error?cause.message:'Unable to load current stock.'});
    });},150);
    return()=>{clearTimeout(timer);controller.abort();};
  },[service,key,version,enabled]);
  return state?.key===key?state:{};
}
